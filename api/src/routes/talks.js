// Catalogue public + gestion des conférences par les organisateurs.
import { z } from 'zod';
import { pool } from '../db.js';

// Extrait la plateforme et l'identifiant d'une URL YouTube ou Vimeo.
export function parseVideoUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^(www|m)\./, '');
  const yt = /^[\w-]{11}$/;
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    return yt.test(id) ? { source: 'youtube', ref: id } : null;
  }
  if (host === 'youtube.com') {
    const m = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/);
    const id = m ? m[1] : u.searchParams.get('v');
    return id && yt.test(id) ? { source: 'youtube', ref: id } : null;
  }
  if (host === 'vimeo.com') {
    const m = u.pathname.match(/^\/(\d+)/);
    return m ? { source: 'vimeo', ref: m[1] } : null;
  }
  return null;
}

const listSchema = z.object({
  q: z.string().max(100).optional(),
  category: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
const idSchema = z.object({ id: z.string().uuid() });
const talkSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(''),
  speaker: z.string().trim().max(200).default(''),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('fr'),
  categoryId: z.number().int().positive().optional(),
  access: z.enum(['free', 'premium']).default('free'),
  videoUrl: z.string().url().max(500),
});

const SELECT = `SELECT t.id, t.title, t.description, t.speaker, t.language, t.access, t.source,
  t.video_ref, t.category_id, c.name AS category, t.created_at
  FROM talks t LEFT JOIN categories c ON c.id = t.category_id`;

export default async function talksRoutes(app) {
  const organizer = { preHandler: app.requireRole('organizer', 'admin') };

  app.get('/categories', async () => (await pool.query('SELECT id, name FROM categories ORDER BY name')).rows);

  app.post('/categories', { preHandler: app.requireRole('admin') }, async (req, reply) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
    try {
      const { rows } = await pool.query('INSERT INTO categories(name) VALUES ($1) RETURNING id, name', [name]);
      return reply.code(201).send(rows[0]);
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Catégorie déjà existante' });
      throw err;
    }
  });

  // Catalogue public avec recherche par mot-clé et filtre par catégorie.
  app.get('/talks', async (req) => {
    const p = listSchema.parse(req.query);
    const { rows } = await pool.query(
      `${SELECT}
       WHERE ($1::text IS NULL OR t.title ILIKE '%' || $1 || '%' OR t.speaker ILIKE '%' || $1 || '%'
              OR t.description ILIKE '%' || $1 || '%')
         AND ($2::int IS NULL OR t.category_id = $2)
       ORDER BY t.created_at DESC LIMIT $3 OFFSET $4`,
      [p.q ?? null, p.category ?? null, p.limit, p.offset]
    );
    return rows;
  });

  app.get('/talks/:id', async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const { rows } = await pool.query(`${SELECT} WHERE t.id = $1`, [id]);
    if (!rows[0]) return reply.code(404).send({ error: 'Conférence introuvable' });
    return rows[0];
  });

  app.get('/me/talks', { preHandler: app.authenticate }, async (req) => {
    const { rows } = await pool.query(`${SELECT} WHERE t.organizer_id = $1 ORDER BY t.created_at DESC`, [req.user.sub]);
    return rows;
  });

  app.post('/talks', organizer, async (req, reply) => {
    const b = talkSchema.parse(req.body);
    const video = parseVideoUrl(b.videoUrl);
    if (!video) return reply.code(400).send({ error: 'Lien YouTube ou Vimeo non reconnu' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO talks(organizer_id, title, description, speaker, language, category_id, access, source, video_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [req.user.sub, b.title, b.description, b.speaker, b.language, b.categoryId ?? null, b.access, video.source, video.ref]
      );
      return reply.code(201).send(rows[0]);
    } catch (err) {
      if (err.code === '23503') return reply.code(400).send({ error: 'Catégorie inconnue' });
      throw err;
    }
  });

  // Un organisateur supprime ses conférences ; un admin peut supprimer toutes les conférences.
  app.delete('/talks/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const admin = req.user.role === 'admin';
    const { rowCount } = await pool.query(
      'DELETE FROM talks WHERE id = $1 AND ($3 OR organizer_id = $2)', [id, req.user.sub, admin]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Conférence introuvable' });
    return reply.code(204).send();
  });
}
