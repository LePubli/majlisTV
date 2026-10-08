// Routes réservées aux administrateurs (gestion des utilisateurs et des rôles).
import { z } from 'zod';
import { pool } from '../db.js';

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const idSchema = z.object({ id: z.string().uuid() });
const roleSchema = z.object({ role: z.enum(['user', 'organizer', 'admin']) });

export default async function adminRoutes(app) {
  const adminOnly = { preHandler: app.requireRole('admin') };

  app.get('/admin/users', adminOnly, async (req) => {
    const { limit, offset } = listSchema.parse(req.query);
    const { rows } = await pool.query(
      `SELECT id, email, name, role, locale, created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  });

  app.patch('/admin/users/:id/role', adminOnly, async (req, reply) => {
    const { id } = idSchema.parse(req.params);
    const { role } = roleSchema.parse(req.body);
    if (id === req.user.sub) {
      return reply.code(400).send({ error: 'Impossible de modifier son propre rôle' });
    }
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
      [role, id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Utilisateur introuvable' });
    return rows[0];
  });
}
