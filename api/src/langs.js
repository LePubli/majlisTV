// Langues de sous-titres proposées aux organisateurs (code ISO 639-1).
// Ajouter une langue ici ET dans translator/src/main.py (LANG_NAMES).
export const TRANSLATION_LANGS = ['ar', 'de', 'en', 'es', 'fr', 'id', 'it', 'nl', 'pt', 'ru', 'tr', 'ur'];

// « fr-FR » -> « fr »
export const baseLang = (code) => String(code || '').split('-')[0].toLowerCase();
