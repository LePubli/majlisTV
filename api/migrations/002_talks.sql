-- Catégories et conférences (vidéos YouTube/Vimeo ; l'upload viendra à l'étape 2B).
CREATE TABLE categories (
  id   serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);
INSERT INTO categories(name) VALUES ('Science'), ('Histoire'), ('Technologie'), ('Société');

CREATE TABLE talks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  speaker      text NOT NULL DEFAULT '',
  language     text NOT NULL DEFAULT 'fr',
  category_id  int REFERENCES categories(id) ON DELETE SET NULL,
  access       text NOT NULL DEFAULT 'free' CHECK (access IN ('free', 'premium')),
  source       text NOT NULL CHECK (source IN ('youtube', 'vimeo')),
  video_ref    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_talks_created ON talks(created_at DESC);
CREATE INDEX idx_talks_organizer ON talks(organizer_id);
