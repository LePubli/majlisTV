-- Vidéos envoyées par les organisateurs (stockage S3 / Garage).
ALTER TABLE talks DROP CONSTRAINT talks_source_check;
ALTER TABLE talks ADD CONSTRAINT talks_source_check CHECK (source IN ('youtube', 'vimeo', 'upload'));

CREATE TABLE uploads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key     text NOT NULL UNIQUE,
  s3_upload_id   text NOT NULL,
  filename       text NOT NULL,
  size           bigint NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_uploads_organizer ON uploads(organizer_id);
