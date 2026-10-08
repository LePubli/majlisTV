# Majlis TV — Étape 1A : socle (infrastructure + API + authentification)

Nom provisoire : « Majlis TV » (modifiable via `APP_NAME` dans `.env`).

## Description
Plateforme de conférences vidéo à la demande. Cette étape fournit :
- PostgreSQL + API Node.js (Fastify) en Docker Compose
- inscription / connexion (JWT, mots de passe hachés avec bcrypt)
- rôles : `user`, `organizer`, `admin` (le statut abonné viendra à l'étape paiement)
- migrations SQL automatiques, création de l'admin au premier démarrage
- protections : helmet, CORS, limitation de débit sur les routes sensibles

Hors de cette étape (prévu ensuite) : front-end Next.js (thème sombre bleu ciel, i18n + arabe RTL), upload, vidéo, paiement.

## Arborescence
```
majlis-tv/
├── docker-compose.yml
├── .env.example
├── README.md
└── api/
    ├── Dockerfile
    ├── package.json
    ├── migrations/001_init.sql
    └── src/
        ├── index.js        (serveur, plugins, hooks d'auth)
        ├── config.js       (variables d'environnement)
        ├── db.js           (PostgreSQL, migrations, admin initial)
        └── routes/
            ├── auth.js     (register, login, me)
            └── admin.js    (liste des utilisateurs, changement de rôle)
```

## Prérequis (Ubuntu 24)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # puis se reconnecter
docker compose version
```

## Installation et configuration
```bash
cp .env.example .env
nano .env
```
À modifier obligatoirement : `POSTGRES_PASSWORD` (alphanumérique), `JWT_SECRET` (`openssl rand -hex 32`), `ADMIN_EMAIL` et `ADMIN_PASSWORD`.

## Lancement
```bash
docker compose up -d --build
docker compose logs -f api
```
L'API écoute sur `http://127.0.0.1:3000`.

## Exemples d'utilisation
```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/config

# Inscription
curl -X POST http://127.0.0.1:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"motdepasse123","name":"Test","locale":"ar"}'

# Connexion admin (récupérer le token)
curl -X POST http://127.0.0.1:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"VOTRE_MOT_DE_PASSE"}'

# Profil et liste des utilisateurs (remplacer TOKEN)
curl http://127.0.0.1:3000/auth/me -H 'Authorization: Bearer TOKEN'
curl http://127.0.0.1:3000/admin/users -H 'Authorization: Bearer TOKEN'

# Donner le rôle organisateur à un utilisateur
curl -X PATCH http://127.0.0.1:3000/admin/users/ID_UTILISATEUR/role \
  -H 'Authorization: Bearer TOKEN' -H 'Content-Type: application/json' -d '{"role":"organizer"}'
```

## Debug
- Logs : `docker compose logs -f api` ou `docker compose logs db`
- État : `docker compose ps`
- Base : `docker compose exec db psql -U majlis -d majlis -c 'SELECT email, role FROM users;'`
- Repartir de zéro (efface les données) : `docker compose down -v`
- L'API refuse de démarrer si `JWT_SECRET` fait moins de 32 caractères.

## Déploiement avec DockPanel (VPS Ubuntu 24)
1. Si DockPanel n'est pas encore installé : `curl -sL https://dockpanel.dev/install.sh | sudo bash` (le panneau est ensuite sur le port 8443).
2. Copier le projet sur le serveur, par exemple dans `/opt/majlis-tv` (`git clone` de ton dépôt, ou `scp -r majlis-tv user@serveur:/opt/`).
3. Configurer : `cd /opt/majlis-tv && cp .env.example .env && nano .env`
4. Démarrer : `docker compose up -d --build`
5. Dans DockPanel, créer un site en reverse proxy vers `http://127.0.0.1:3000` avec ton domaine (ex. `api.tondomaine.fr`) et activer le certificat SSL Let's Encrypt. Les intitulés exacts des menus peuvent varier selon la version du panneau.
6. Mettre `CORS_ORIGIN` à l'URL du futur front-end, puis `docker compose up -d`.
7. Mise à jour : `git pull && docker compose up -d --build`

Notes :
- L'API n'écoute que sur `127.0.0.1:3000` : seul le proxy du panneau la publie sur Internet.
- Un stack lancé en ligne de commande peut ne pas apparaître comme « stack géré » dans le panneau. Pour tout piloter depuis DockPanel, utilise sa fonction de déploiement Git ou de stack Compose (le `docker-compose.yml` construit l'image depuis `./api`, donc le dépôt complet doit être disponible).
- Sauvegardes : la base est dans le volume Docker `db_data` ; exemple d'export : `docker compose exec db pg_dump -U majlis majlis > sauvegarde.sql`
