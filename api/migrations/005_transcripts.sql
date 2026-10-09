-- Transcriptions (Whisper) : statut par conférence, segments horodatés par langue (sous-titres, texte cliquable).
ALTER TABLE talks
  ADD COLUMN transcript_status text NOT NULL DEFAULT 'pending'
    CHECK (transcript_status IN ('pending', 'processing', 'ready', 'failed', 'unavailable')),
  ADD COLUMN transcript_progress int NOT NULL DEFAULT 0,
  ADD COLUMN transcript_error text,
  ADD COLUMN transcript_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN transcript_language text,
  ADD COLUMN transcript_text text;

-- YouTube / Vimeo : pas de fichier à transcrire.
UPDATE talks SET transcript_status = 'unavailable' WHERE source <> 'upload';

CREATE TABLE transcript_segments (
  talk_id   uuid NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  lang      text NOT NULL,
  idx       int  NOT NULL,
  start_ms  int  NOT NULL,
  end_ms    int  NOT NULL,
  text      text NOT NULL,
  PRIMARY KEY (talk_id, lang, idx)
);
CREATE INDEX idx_talks_transcript_status ON talks(transcript_status) WHERE transcript_status IN ('pending', 'processing');
