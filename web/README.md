# Majlis TV — Étape 1B : front-end (Next.js)

## Description
Site web : thème sombre bleu ciel, 3 langues (français, anglais, arabe en RTL), pages d'accueil, inscription, connexion et compte. Le navigateur parle à l'API via un proxy interne `/api` (pas de CORS ; l'adresse de l'API se règle au runtime).

## Prérequis
Node.js 20+ (test local) ou DockPanel (production). L'API de l'étape 1A doit être en ligne.

## Configuration (variables d'environnement)
```
API_URL=https://majlisstv.le-publicitaire.fr
APP_NAME=Majlis TV
```

## Lancement en local
```bash
cd web
npm install
API_URL=https://majlisstv.le-publicitaire.fr npm run dev    # http://localhost:3001
```

## Déploiement DockPanel (second Git Deploy, même dépôt)
1. Git Deploy → New Deploy : Name `majlistv-web` (minuscules), même dépôt, Branch `main`.
2. Dockerfile Path : `web/Dockerfile` ; Build Context : `.` (racine) ; Container Port : `3000`.
3. Domain : `majlistv.le-publicitaire.fr` (DNS vers le VPS), HTTPS avec certificat automatique.
4. Variables : `API_URL` et `APP_NAME` ci-dessus.
5. Create, Deploy, puis ouvrir le domaine.

## Exemples d'utilisation
- Changer de langue avec le sélecteur en haut (l'arabe passe l'interface en RTL).
- Créer un compte, puis ouvrir « Mon compte » : nom, email et rôle s'affichent.
- Pour devenir admin : se connecter avec le compte `ADMIN_EMAIL` de l'API.

## Debug
- Logs : `docker logs --tail 50 dockpanel-git-majlistv-web`
- Erreur « API indisponible » : vérifier `API_URL` et que `https://majlisstv.le-publicitaire.fr/health` répond.
- Build qui ne trouve pas `web/Dockerfile` : essayer Dockerfile Path `Dockerfile` avec Build Context `web`, et adapter les `COPY` (retirer le préfixe `web/`).

## Notes de sécurité
Le token de connexion est stocké dans le navigateur (localStorage), choix simple pour cette étape. Une évolution vers un cookie httpOnly est prévue avant la mise en production publique.
