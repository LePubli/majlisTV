"""Service de transcription Majlis TV.

Prend les conférences dont la vidéo est prête (video_status = 'ready') et dont la transcription est
en attente (transcript_status = 'pending'), extrait l'audio, le transcrit avec faster-whisper (CPU)
et enregistre les segments horodatés dans transcript_segments.
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import boto3
import psycopg2
import psycopg2.extras
from botocore.config import Config


def env(key, default=None, required=False):
    value = os.environ.get(key, default)
    if required and not value:
        print(f"Variable manquante : {key}", flush=True)
        sys.exit(1)
    return value


DATABASE_URL = env("DATABASE_URL", required=True)
BUCKET = env("S3_BUCKET", "majlis-videos")
MODEL_NAME = env("WHISPER_MODEL", "small")  # small | medium | large-v3-turbo | large-v3
THREADS = int(env("WHISPER_THREADS", "4"))  # laisse des cœurs au reste du serveur
BEAM = int(env("WHISPER_BEAM", "3"))
LANG_MODE = env("WHISPER_LANGUAGE_MODE", "declared")  # declared = langue de la conférence ; auto = détection
POLL = int(env("POLL_SECONDS", "10"))
WORK_DIR = env("WORK_DIR", "/work")
MAX_ATTEMPTS = 3

# Langues supportées par Whisper (repli sur la détection automatique pour les autres).
WHISPER_LANGS = {
    "af", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "fa", "fi",
    "fr", "gl", "he", "hi", "hr", "hu", "hy", "id", "is", "it", "ja", "ka", "kk", "ko", "lt", "lv", "mk", "ml",
    "mr", "ms", "ne", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "sw", "ta", "th", "tr", "uk",
    "ur", "uz", "vi", "zh",
}

stopping = False
current = None  # id de la conférence en cours
last_ok = None
_model = None


def log(*args):
    print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), *args, flush=True)


# --- Base de données ---------------------------------------------------------------------------
_conn = None


def db():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DATABASE_URL, client_encoding="UTF8")
        _conn.autocommit = True
    return _conn


def query(sql, params=None, fetch=False):
    for attempt in (1, 2):
        try:
            with db().cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params)
                return cur.fetchall() if fetch else cur.rowcount
        except psycopg2.OperationalError:
            global _conn
            _conn = None
            if attempt == 2:
                raise


def claim():
    rows = query(
        """UPDATE talks SET transcript_status = 'processing', transcript_progress = 0, transcript_error = NULL,
                  transcript_attempts = transcript_attempts + 1
           WHERE id = (SELECT id FROM talks
                       WHERE source = 'upload' AND video_status = 'ready' AND transcript_status = 'pending'
                       ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
           RETURNING id, video_ref, language, transcript_attempts""",
        fetch=True,
    )
    return rows[0] if rows else None


# --- Stockage ----------------------------------------------------------------------------------
s3 = boto3.client(
    "s3",
    endpoint_url=env("S3_ENDPOINT", required=True),
    region_name=env("S3_REGION", "garage"),
    aws_access_key_id=env("S3_ACCESS_KEY", required=True),
    aws_secret_access_key=env("S3_SECRET_KEY", required=True),
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"},
        request_checksum_calculation="when_required",  # compatibilité avec Garage
        response_checksum_validation="when_required",
    ),
)


# --- Audio et modèle ---------------------------------------------------------------------------
def has_audio(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout
    return bool(out.strip())


def extract_audio(src, wav):
    subprocess.run(
        ["nice", "-n", "10", "ffmpeg", "-y", "-nostdin", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
         "-c:a", "pcm_s16le", wav],
        check=True, capture_output=True, text=True,
    )


def audio_duration(wav):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip() or 0)


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        root = env("MODELS_DIR", "/models")
        if not os.access(root, os.W_OK):
            log(f"{root} non accessible en écriture : le modèle sera retéléchargé à chaque redémarrage")
            root = "/tmp/models"
        log(f"Chargement du modèle Whisper « {MODEL_NAME} » (premier lancement : téléchargement)")
        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8", cpu_threads=THREADS, download_root=root)
        log("Modèle prêt.")
    return _model


# --- Traitement --------------------------------------------------------------------------------
class Stop(Exception):
    pass


def process(job):
    talk_id = str(job["id"])
    work = os.path.join(WORK_DIR, talk_id)
    try:
        shutil.rmtree(work, ignore_errors=True)
        os.makedirs(work)
        src = os.path.join(work, "source")
        wav = os.path.join(work, "audio.wav")
        log(f"[{talk_id}] téléchargement")
        s3.download_file(BUCKET, job["video_ref"], src)
        if not has_audio(src):
            query("UPDATE talks SET transcript_status = 'unavailable' WHERE id = %s", (talk_id,))
            log(f"[{talk_id}] aucune piste audio : transcription ignorée")
            return
        extract_audio(src, wav)
        os.remove(src)
        duration = audio_duration(wav)

        declared = (job["language"] or "").split("-")[0].lower()
        language = declared if LANG_MODE == "declared" and declared in WHISPER_LANGS else None
        model = get_model()
        log(f"[{talk_id}] transcription de {duration:.0f} s (langue : {language or 'détection auto'})")
        started = time.time()
        segments, info = model.transcribe(
            wav, language=language, beam_size=BEAM, vad_filter=True, condition_on_previous_text=False,
        )

        rows, last, last_write = [], 0, 0.0
        for seg in segments:
            if stopping:
                raise Stop()
            text = seg.text.strip()
            if text:
                rows.append((talk_id, info.language, len(rows), int(seg.start * 1000), int(seg.end * 1000), text))
            pct = min(99, int(seg.end / duration * 100)) if duration else 0
            if pct > last and time.time() - last_write > 4:
                last, last_write = pct, time.time()
                query("UPDATE talks SET transcript_progress = %s WHERE id = %s", (pct, talk_id))

        elapsed = time.time() - started
        if not rows:
            raise RuntimeError("Aucune parole détectée")
        full_text = " ".join(r[5] for r in rows)
        try:
            with db().cursor() as cur:
                cur.execute("DELETE FROM transcript_segments WHERE talk_id = %s AND lang = %s", (talk_id, info.language))
                psycopg2.extras.execute_values(
                    cur,
                    "INSERT INTO transcript_segments (talk_id, lang, idx, start_ms, end_ms, text) VALUES %s",
                    rows, page_size=500,
                )
        except psycopg2.errors.ForeignKeyViolation:
            log(f"[{talk_id}] conférence supprimée entre-temps, abandon")
            return
        query(
            """UPDATE talks SET transcript_status = 'ready', transcript_progress = 100, transcript_error = NULL,
                      transcript_language = %s, transcript_text = %s WHERE id = %s""",
            (info.language, full_text, talk_id),
        )
        speed = duration / elapsed if elapsed else 0
        log(f"[{talk_id}] terminé : {len(rows)} segments, langue {info.language}, {elapsed:.0f} s ({speed:.1f}x temps réel)")
        global last_ok
        last_ok = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    except Stop:
        raise
    except Exception as err:  # noqa: BLE001
        attempts = job["transcript_attempts"]
        final = attempts >= MAX_ATTEMPTS
        log(f"[{talk_id}] échec ({attempts}/{MAX_ATTEMPTS}) : {err}")
        stderr = getattr(err, "stderr", None)
        message = f"{err} {stderr or ''}"[:1000]
        query("UPDATE talks SET transcript_status = %s, transcript_error = %s WHERE id = %s",
              ("failed" if final else "pending", message, talk_id))
    finally:
        shutil.rmtree(work, ignore_errors=True)


# --- Santé, arrêt propre, boucle principale ------------------------------------------------------
class Health(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        body = json.dumps({"status": "ok", "model": MODEL_NAME, "current": current, "lastOk": last_ok}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def on_signal(*_):
    global stopping
    stopping = True
    if current:
        try:
            query("UPDATE talks SET transcript_status = 'pending' WHERE id = %s AND transcript_status = 'processing'", (current,))
        except Exception:  # noqa: BLE001
            pass
    os._exit(0)


def main():
    global current
    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)
    server = HTTPServer(("0.0.0.0", int(env("PORT", "3000"))), Health)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    while True:  # attend la migration 005 ; reprend les transcriptions interrompues
        try:
            query("UPDATE talks SET transcript_status = 'pending' WHERE transcript_status = 'processing'")
            break
        except Exception as err:  # noqa: BLE001
            log("Base pas prête (migration 005 appliquée ?) :", err)
            time.sleep(POLL)
    log(f"Transcripteur prêt (modèle {MODEL_NAME}, {THREADS} threads).")

    while not stopping:
        job = None
        try:
            job = claim()
        except Exception as err:  # noqa: BLE001
            log("Erreur base :", err)
        if not job:
            time.sleep(POLL)
            continue
        current = str(job["id"])
        try:
            process(job)
        except Stop:
            pass
        current = None


if __name__ == "__main__":
    main()
