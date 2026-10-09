# Stockage S3 (Garage) pour les vidéos de Majlis TV. Contexte de build = racine du dépôt.
# L'image officielle ne contient pas de shell : on y copie seulement la configuration.
FROM dxflrs/garage:v2.1.0
COPY garage/garage.toml /etc/garage.toml
EXPOSE 3900
