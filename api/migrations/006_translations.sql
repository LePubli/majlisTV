-- Traductions automatiques des sous-titres (service « translator », API Claude).
-- Une ligne par conférence et par langue cible demandée. Le texte traduit est stocké dans
-- transcript_segments (lang = langue cible, mêmes horodatages que la transcription d'origine) :
-- l'API, le lecteur et le panneau de transcription le servent donc sans changement.
CREATE TABLE transcript_translations (
  talk_id    uuid NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  lang       text NOT NULL CHECK (lang ~ '^[a-z]{2,3}$'),
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  progress   int  NOT NULL DEFAULT 0,
  error      text,
  attempts   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (talk_id, lang)
);
CREATE INDEX idx_translations_queue ON transcript_translations(created_at) WHERE status IN ('pending', 'processing');
