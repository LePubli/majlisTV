// Lecture et validation des variables d'environnement.
const required = (key) => {
  const value = process.env[key];
  if (!value) {
    console.error(`Variable d'environnement manquante : ${key}`);
    process.exit(1);
  }
  return value;
};

export const config = {
  appName: process.env.APP_NAME || 'Majlis TV', // nom provisoire, modifiable dans .env
  port: Number(process.env.PORT || 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};

if (config.jwtSecret.length < 32) {
  console.error('JWT_SECRET doit contenir au moins 32 caractères.');
  process.exit(1);
}
