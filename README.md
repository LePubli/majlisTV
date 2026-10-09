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

## Étape 2A : conférences (liens YouTube/Vimeo), catalogue, espace organisateur
Nouveautés API (migration `002_talks.sql` appliquée automatiquement au démarrage) :
- `GET /categories`, `POST /categories` (admin)
- `GET /talks?q=mot&category=ID&limit=24&offset=0` (public), `GET /talks/:id` (public)
- `POST /talks` (organisateur/admin), `GET /me/talks`, `DELETE /talks/:id` (propriétaire ou admin)

Nouveautés site : catalogue avec recherche et filtre par catégorie, page de lecture (`/talks/ID`), espace `/organizer`.

Déploiement : push sur `main`, puis **Deploy Now** sur `majlistv-api` ET sur `majlistv-web` (aucune variable à changer).

Tester :
1. Donner le rôle organisateur à ton compte de test (connecté en admin) :
```bash
TOKEN=$(curl -s -X POST https://api-majlisstv.le-publicitaire.fr/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ADMIN_EMAIL","password":"ADMIN_PASSWORD"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
curl https://api-majlisstv.le-publicitaire.fr/admin/users -H "Authorization: Bearer $TOKEN"
curl -X PATCH https://api-majlisstv.le-publicitaire.fr/admin/users/ID_UTILISATEUR/role \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"role":"organizer"}'
```
2. Se reconnecter avec ce compte : le lien « Mes conférences » apparaît. Ajouter une conférence avec un lien YouTube, puis vérifier le catalogue.

Limites de cette étape : l'accès « premium » est seulement un marquage (le blocage viendra avec l'abonnement), les catégories sont en français, et la miniature n'existe que pour YouTube.

## Étape 2B-1 : stockage vidéo Garage
Voir `garage/README.md` (déploiement DockPanel et initialisation). Le code d'upload arrive à l'étape 2B-2.

## Étape 2B-2 : upload de vidéos vers Garage
Nouveautés : upload par morceaux de 32 Mo directement du navigateur vers le stockage (jusqu'à `MAX_UPLOAD_GB`, 10 par défaut), lecture par liens temporaires de 4 h, migration `003_uploads.sql`, CORS du bucket configuré automatiquement au démarrage de l'API.

Variables à ajouter au déploiement `majlistv-api` (puis Deploy Now) :
```
S3_ENDPOINT=https://s3-majlisstv.le-publicitaire.fr
S3_REGION=garage
S3_BUCKET=majlis-videos
S3_ACCESS_KEY=<Key ID de la clé majlis-api>
S3_SECRET_KEY=<secret de la clé majlis-api>
```
Les logs de l'API doivent contenir `CORS du bucket configuré.` S'ils affichent `CORS du bucket non configuré`, voir Debug.

Taille des morceaux : 32 Mo, donc sous la limite de 64 Mo que DockPanel applique dans Nginx au domaine du stockage. Aucun réglage Nginx n'est nécessaire. Si tu modifies `PART_SIZE` dans `api/src/routes/uploads.js`, garde-le sous cette limite (vérifiable avec `grep -n client_max_body_size /etc/nginx/sites-enabled/s3-majlisstv.le-publicitaire.fr.conf`).

Debug :
- Erreur 413 pendant l'envoi : un morceau dépasse la limite Nginx du domaine du stockage (voir ci-dessus).
- Lecture impossible ou upload bloqué dans le navigateur : ouvrir la console (F12), onglet Réseau ; une erreur CORS signifie que la configuration du bucket n'a pas été appliquée.
- Si l'API ne peut pas configurer le CORS (message dans les logs), l'appliquer avec un client S3 (par exemple awscli) sur le bucket `majlis-videos`, origine `https://majlisstv.le-publicitaire.fr`, méthodes GET/HEAD/PUT, en-tête exposé `ETag`.
- Pas de conversion à cette étape : les fichiers MP4 se lisent directement, les autres formats peuvent échouer jusqu'à l'étape 3.
- Les uploads abandonnés peuvent laisser des morceaux orphelins dans le bucket ; un nettoyage sera ajouté plus tard.
