# Majlis TV — Stockage vidéo (Garage, compatible S3)

## Description
Garage est un stockage d'objets compatible S3 (MinIO étant abandonné). Il reçoit les vidéos envoyées par les organisateurs. Le code de l'API utilise le protocole S3 standard : on pourra passer plus tard à un stockage S3 hébergé en changeant seulement des variables d'environnement.

## Prérequis
DockPanel sur le VPS, un sous-domaine (ex. `s3-majlisstv.le-publicitaire.fr`) pointant vers le VPS, et de la place disque (`df -h`).

## Configuration
Variable d'environnement du déploiement : `GARAGE_RPC_SECRET` = résultat de `openssl rand -hex 32`. La configuration (`garage.toml`) ne contient aucun secret.

## Déploiement (DockPanel → Git Deploy → New Deploy)
- Name : `majlistv-storage` ; même dépôt, Branch `main`
- Dockerfile Path : `garage/Dockerfile` ; Build Context : `.`
- Container Port : `3900` ; Domain : `s3-majlisstv.le-publicitaire.fr` ; HTTPS Let's Encrypt
- Persistent Volumes : `/var/lib/garage/meta` et `/var/lib/garage/data`
- Variable : `GARAGE_RPC_SECRET`
Vérifier ensuite le port hôte attribué (`docker ps --format '{{.Names}}\t{{.Ports}}'`) : il ne doit pas entrer en conflit avec un autre projet.

## Initialisation (une seule fois)
```bash
G="docker exec dockpanel-git-majlistv-storage /garage"
$G status                                   # noter l'identifiant du nœud
$G layout assign -z dc1 -c 40G IDENTIFIANT_DU_NOEUD
$G layout apply --version 1
$G bucket create majlis-videos
$G key create majlis-api
$G bucket allow --read --write --owner majlis-videos --key majlis-api
$G key info majlis-api                      # Key ID et secret : à garder, ne pas les partager
$G bucket set-quotas majlis-videos --max-size 40GiB   # protège le disque du VPS
```
Adapter `40G` à la place disponible (vérifier avec `df -h`).

## Exemples d'utilisation
- Test d'accessibilité : `curl -s https://s3-majlisstv.le-publicitaire.fr/` répond une erreur XML (Access Denied) : c'est normal, le service répond.
- Variables que l'API utilisera à l'étape suivante : `S3_ENDPOINT`, `S3_REGION=garage`, `S3_BUCKET=majlis-videos`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

## Debug
- Logs : `docker logs --tail 50 dockpanel-git-majlistv-storage`
- Erreur sur le secret RPC au démarrage : vérifier que `GARAGE_RPC_SECRET` est bien défini (64 caractères hexadécimaux).
- Espace disque : `df -h` et `docker exec dockpanel-git-majlistv-storage /garage bucket info majlis-videos`
- Les fichiers sont dans les volumes persistants : ne pas supprimer le déploiement sans sauvegarde.
