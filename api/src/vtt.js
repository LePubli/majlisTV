// Génération de sous-titres WebVTT à partir des segments horodatés.
const pad = (n, l = 2) => String(n).padStart(l, '0');

export function vttTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

const escapeCue = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/-->/g, '--&gt;');

// segments : [{ start_ms, end_ms, text }]
export function toVtt(segments) {
  const cues = segments.map((s, i) => `${i + 1}\n${vttTime(s.start_ms)} --> ${vttTime(Math.max(s.end_ms, s.start_ms + 200))}\n${escapeCue(s.text)}`);
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
