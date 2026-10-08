-- Utilisateurs et rôles (user = visiteur connecté, organizer, admin).
-- Le statut "abonné" sera ajouté à l'étape abonnements.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'organizer', 'admin')),
  locale        text NOT NULL DEFAULT 'fr',
  created_at    timestamptz NOT NULL DEFAULT now()
);
