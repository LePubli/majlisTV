// Réécriture des playlists HLS : le master pointe vers l'API, les variantes vers des liens S3 signés.
export const HLS_PATH = /^(master\.m3u8|v\d+\/index\.m3u8)$/;

// Master : les lignes d'URI (variantes) reçoivent le jeton de lecture.
export function rewriteMaster(text, token) {
  return text.split('\n').map((l) => (l && !l.startsWith('#') ? `${l.trim()}?t=${encodeURIComponent(token)}` : l)).join('\n');
}

// Variante : init et segments deviennent des liens signés (signUrl(chemin relatif) -> URL).
export async function rewriteVariant(text, signUrl) {
  const out = [];
  for (const l of text.split('\n')) {
    if (l.startsWith('#EXT-X-MAP:')) {
      const m = l.match(/URI="([^"]+)"/);
      out.push(m ? l.replace(m[0], `URI="${await signUrl(m[1])}"`) : l);
    } else if (l && !l.startsWith('#')) {
      out.push(await signUrl(l.trim()));
    } else out.push(l);
  }
  return out.join('\n');
}
