# Traducteur de sous-titres (Majlis TV)

## Description
Service qui traduit automatiquement la transcription d'une conférence dans les langues choisies par l'organisateur, avec l'**API Claude** (Anthropic). Il lit les demandes de la table `transcript_translations`, traduit les segments par paquets de 40 (avec les 3 dernières phrases du paquet précédent comme contexte, pour garder la cohérence), puis enregistre le résultat dans `transcript_segments` avec **les mêmes horodatages** que la transcription d'origine. Le site en tire, sans autre changement :
- des **sous-titres** supplémentaires dans le lecteur (la langue de l'interface est activée d'office si elle existe) ;
- le **panneau de transcription cliquable** dans chaque langue ;
- la **recherche** reste faite sur la langue d'origine.

Une langue n'apparaît dans le lecteur qu'une fois **entièrement** traduite (enregistrement atomique).

Cycle de vie d'une traduction : `pending` → `processing` (progression en %) → `ready` ; `failed` après 3 tentatives (ou tout de suite si la clé API est refusée). Une demande dont la transcription est indisponible passe en `failed` (« Transcription indisponible »). Une langue identique à celle de la conférence est ignorée.

## Prérequis
- API déployée avec la migration `006_translations.sql` (appliquée au démarrage de l'API) : **déployer l'API avant le traducteur**.
- Transcription (étape 3B) en place : on ne traduit que les conférences dont la transcription est `ready`.
- Un compte Anthropic avec une **clé API** (https://console.anthropic.com → API keys) et du crédit. Conseil : fixer une **limite de dépense mensuelle** dans la console.
- Le VPS doit pouvoir joindre `https://api.anthropic.com` (sortie HTTPS standard).
- Ressources : très légères (≈ 100 Mo de RAM, presque pas de CPU : le calcul se fait chez Anthropic).

## Installation (DockPanel Git Deploy)
Nouveau déploiement :
- Nom : `majlistv-translator` (minuscules)
- Dépôt / branche : les mêmes que l'API
- Dockerfile : `translator/Dockerfile`, contexte de build : `.`
- Port du conteneur : `3000` (page de santé), **aucun domaine**, aucun volume
- Variables d'environnement :
```
DATABASE_URL=<même valeur que majlistv-api : hôte 172.17.0.1>
ANTHROPIC_API_KEY=<ta clé, saisie uniquement dans DockPanel>
CLAUDE_MODEL=claude-haiku-5-5
```
Si DockPanel affiche « port is already allocated », imposer un port hôte libre (exemple 7050) puis Deploy Now :
```bash
ss -ltn | grep ':7050 ' || echo "7050 libre"
docker exec dockpanel-postgres sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-${POSTGRES_USER:-postgres}}" -c "UPDATE git_deploys SET host_port=7050 WHERE name='"'"'majlistv-translator'"'"';"'
```
Limites de ressources conseillées (à rejouer après chaque redéploiement) :
```bash
docker update --cpus 0.5 --memory 256m --memory-swap 256m $(docker ps -aq --filter name=translator)
```

## Configuration (.env)
| Variable | Défaut | Rôle |
|---|---|---|
| `DATABASE_URL` | obligatoire | même base que l'API (mot de passe avec `@` : écrire `%40`) |
| `ANTHROPIC_API_KEY` | obligatoire | clé API Anthropic. **Jamais dans Git, jamais dans un chat** |
| `CLAUDE_MODEL` | `claude-haiku-5-5` | modèle de traduction. `claude-sonnet-5-5` : meilleure qualité (arabe, vocabulaire spécialisé), plus cher |
| `TRANSLATE_CHUNK_SEGMENTS` | `40` | segments traduits par appel (baisser si « réponse tronquée ») |
| `TRANSLATE_CHUNK_CHARS` | `3000` | caractères maximum par appel |
| `TRANSLATE_MAX_CHARS` | `600000` | **garde-fou de coût** : une transcription plus longue est refusée |
| `POLL_SECONDS` | `10` | fréquence de recherche de nouvelles demandes |
| `ANTHROPIC_API_URL` | API officielle | pour les tests locaux avec la fausse API |

Changer de modèle = modifier la variable puis Deploy Now. Les traductions déjà faites ne sont pas refaites (voir Debug pour les relancer).

## Lancement et vérification
```bash
docker logs -f --tail 20 dockpanel-git-majlistv-translator   # « Traducteur prêt (modèle … ) »
curl -s http://127.0.0.1:7050/health                         # adapter le port hôte
```

## Utilisation
- **À l'envoi d'une conférence** (« Mes conférences » → fichier vidéo) : cocher les langues dans « Sous-titres traduits ». Les liens YouTube/Vimeo n'ont pas de transcription, donc pas de traduction.
- **Après coup** : sur la ligne de la conférence, menu « + Langue » pour ajouter une langue ; « Relancer » sur une traduction en échec ; « × » pour retirer une traduction (jamais la langue d'origine).
- Côté public : dans le lecteur, bouton de sous-titres ; dans le panneau de transcription, menu de langue.

## Coût (à vérifier sur ta console Anthropic)
Une conférence d'une heure représente environ 700 segments, soit de l'ordre de 15 000 jetons de texte à lire et autant à écrire **par langue cible** (plus pour l'arabe), plus quelques milliers de jetons de consignes répétées à chaque paquet. Multiplie par le prix des jetons du modèle choisi (https://www.anthropic.com/pricing) et par le nombre de langues. Mesure sur 2 ou 3 conférences réelles dans la console (Usage), puis décide de proposer les traductions à toutes les conférences ou seulement aux plus vues. `TRANSLATE_MAX_CHARS` empêche une très longue transcription de coûter trop cher par erreur.

## Debug
- État des traductions (dans le conteneur PostgreSQL de l'application, base `appmajlistv`) :
```sql
SELECT left(talk_id::text,8) AS talk, lang, status, progress, attempts, left(error,80) AS erreur FROM transcript_translations ORDER BY created_at DESC;
```
- Relancer une traduction en échec : `UPDATE transcript_translations SET status='pending', attempts=0, error=NULL WHERE talk_id='<id>' AND lang='<fr>';`
- Refaire une traduction déjà prête (changement de modèle) : `DELETE FROM transcript_segments WHERE talk_id='<id>' AND lang='fr'; UPDATE transcript_translations SET status='pending', attempts=0 WHERE talk_id='<id>' AND lang='fr';`
- `HTTP 401` : clé refusée ou expirée → corriger `ANTHROPIC_API_KEY` dans DockPanel, redéployer, relancer les traductions en échec. `HTTP 429` / `529` : limite de débit ou surcharge, le service réessaie tout seul (jusqu'à 5 fois par appel).
- `HTTP 400` avec « credit balance » : crédit épuisé → recharger le compte Anthropic.
- « Réponse tronquée (max_tokens) » : baisser `TRANSLATE_CHUNK_SEGMENTS` (ex. 20).
- Un seul traducteur doit tourner.

## Sécurité
- La clé API ne se saisit que dans les variables DockPanel ; elle n'apparaît ni dans le dépôt ni dans les logs.
- Le texte transcrit est traité comme une donnée à traduire, jamais comme des instructions (consigne explicite + sortie imposée par un outil structuré). Le modèle ne peut rien faire d'autre que renvoyer des phrases traduites.
- En cas de fuite d'une clé : la révoquer dans la console Anthropic, en créer une autre, la mettre dans DockPanel.

## Développement local
```bash
cd translator && pip install -r requirements.txt
# Test sans clé ni coût : fausse API Anthropic
MOCK_PORT=8099 python tests/mock_claude.py &
DATABASE_URL=postgres://... ANTHROPIC_API_KEY=test-key ANTHROPIC_API_URL=http://127.0.0.1:8099/v1/messages python src/main.py
```
La fausse API renvoie « [fr] texte » : utile pour vérifier toute la chaîne (base, lecteur, interface) sans appeler le vrai service. `MOCK_MODE=flaky|badlen|401` simule une limite de débit, une réponse incohérente, une clé refusée.
