# Majlis TV — Étape 1A : socle (API + authentification)

Nom provisoire : « Majlis TV » (modifiable via `APP_NAME`).

## Description
Plateforme de conférences vidéo à la demande. Cette étape fournit une API Node.js (Fastify) + PostgreSQL :
- inscription / connexion (JWT, mots de passe bcrypt)
- rôles `user`, `organizer`, `admin` (le statut abonné viendra avec le paiement)
- migrations SQL automatiques au démarrage, création de l'admin initial
- helmet, CORS, limitation de débit sur les routes sensibles

À venir : front-end (thème sombre bleu ciel, i18n + arabe RTL), upload, vidéo, paiement.

## Arborescence
```
├── Dockerfile              (utilisé par DockPanel Git Deploy)
├── .dockerignore
├── .env.example
├── README.md
├── local/docker-compose.yml   (test local uniquement)
├── web/                       (étape 1B : front-end Next.js, voir web/README.md)
└── api/
    ├── Dockerfile
    ├── package.json
    ├── migrations/001_init.sql
    └── src/ index.js, config.js, db.js, routes/auth.js, routes/admin.js
```
Important : ne pas remettre de `docker-compose.yml` à la racine du dépôt, DockPanel passerait en mode Compose et refuserait le build.

## Prérequis
Docker et Docker Compose (Ubuntu 24 : `curl -fsSL https://get.docker.com | sudo sh`), pour le test local. Pour la production : un VPS avec DockPanel.

## Configuration (.env)
```bash
cp .env.example .env
```
Modifier `POSTGRES_PASSWORD` (alphanumérique), `JWT_SECRET` (`openssl rand -hex 32`, 32 caractères minimum), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Lancement en local
```bash
cd local
docker compose --env-file ../.env up -d --build
docker compose logs -f api
```
API sur `http://127.0.0.1:3000`.

## Exemples d'utilisation
Remplacer l'URL de base par ton domaine en production.
```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/config

curl -X POST http://127.0.0.1:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"motdepasse123","name":"Test","locale":"ar"}'

curl -X POST http://127.0.0.1:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"VOTRE_MOT_DE_PASSE"}'

curl http://127.0.0.1:3000/auth/me -H 'Authorization: Bearer TOKEN'
curl http://127.0.0.1:3000/admin/users -H 'Authorization: Bearer TOKEN'
curl -X PATCH http://127.0.0.1:3000/admin/users/ID/role -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' -d '{"role":"organizer"}'
```
Note : `GET /` renvoie 404, c'est normal (pas de page d'accueil dans l'API).

## Déploiement : DockPanel (Git Deploy) sur VPS Ubuntu 24
1. **Base PostgreSQL** : DockPanel → Docker Apps → PostgreSQL (ex. `postgres-majlisstv`). Noter l'utilisateur, la base et le mot de passe (variables du conteneur).
2. **Adresse du conteneur** :
   ```bash
   docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{$v.IPAddress}}{{"\n"}}{{end}}' dockpanel-app-postgres-majlisstv
   docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' dockpanel-app-postgres-majlisstv | grep -E 'POSTGRES_(USER|DB)='
   ```
3. **Git Deploy → New Deploy** :
   - Name : minuscules uniquement (ex. `majlistv`), sinon Docker refuse le nom d'image
   - Repository URL, Branch `main`, Dockerfile Path `Dockerfile`, Container Port `3000`
   - Domain : ton sous-domaine API (DNS vers le VPS), HTTPS avec certificat automatique
4. **Variables d'environnement** (sans guillemets) :
```
DATABASE_URL=postgres://UTILISATEUR:MOTDEPASSE@172.17.0.3:5432/NOMBASE
JWT_SECRET=<openssl rand -hex 32>
APP_NAME=Majlis TV
CORS_ORIGIN=https://url-du-futur-front
ADMIN_EMAIL=ton@email.fr
ADMIN_PASSWORD=un_mot_de_passe_long
```
   Si le mot de passe contient `@ / # ? : %`, les encoder (`%40 %2F %23 %3F %3A %25`).
5. Create, puis Deploy. Vérifier `https://ton-domaine/health` → `{"status":"ok"}`.

## Debug
- Logs : `docker logs --tail 50 dockpanel-git-majlistv`
- 502 Bad Gateway : le conteneur redémarre en boucle, lire les logs. `Invalid URL` = `DATABASE_URL` mal formée ; `password authentication failed` = mauvais mot de passe ; `ECONNREFUSED` = mauvaise IP ou port de la base.
- L'IP du conteneur PostgreSQL peut changer s'il est recréé : refaire l'étape 2 et mettre à jour `DATABASE_URL`.
- « Deploy blocked: active critical/major incident » : résoudre les incidents actifs dans DockPanel (page Incidents).
- « Docker Compose refused » : supprimer tout `docker-compose.yml` de la racine du dépôt.
- Fichiers uploadés plus tard (vidéos) : prévoir un stockage séparé (MinIO), le conteneur Git Deploy n'a pas de stockage persistant.
