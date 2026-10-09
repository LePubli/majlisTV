-- Conversion HLS des vidéos envoyées (worker FFmpeg) : état, progression, miniature.
ALTER TABLE talks
  ADD COLUMN video_status text NOT NULL DEFAULT 'ready'
    CHECK (video_status IN ('pending', 'processing', 'ready', 'failed')),
  ADD COLUMN video_progress int NOT NULL DEFAULT 0,
  ADD COLUMN video_error text,
  ADD COLUMN transcode_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN duration_seconds int,
  ADD COLUMN poster_key text;

-- Les vidéos déjà envoyées seront converties par le worker.
UPDATE talks SET video_status = 'pending' WHERE source = 'upload';
CREATE INDEX idx_talks_video_status ON talks(video_status) WHERE video_status IN ('pending', 'processing');
