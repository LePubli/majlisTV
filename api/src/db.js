// Connexion PostgreSQL, migrations SQL et création de l'admin initial.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

// Applique dans l'ordre les fichiers .sql pas encore exécutés.
export async function migrate() {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
  );
  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (done.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Migration appliquée : ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// Crée le compte admin au premier démarrage s'il n'existe pas.
export async function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) return;
  const hash = await bcrypt.hash(config.adminPassword, 12);
  await pool.query(
    `INSERT INTO users(email, password_hash, name, role)
     VALUES ($1, $2, 'Administrateur', 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [config.adminEmail.toLowerCase(), hash]
  );
}
