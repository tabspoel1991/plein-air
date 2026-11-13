// input/ — afbeelding laden en de helderheid ervan meten.

export const DEFAULT_PAINTING = {
  url: 'assets/sterrennacht.jpg',
  name: 'De Sterrennacht · Vincent van Gogh, 1889',
  id: 'sterrennacht',
};

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Kan afbeelding niet laden: ' + url));
    img.src = url;
  });
}

export async function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Geen afbeelding');
  const url = URL.createObjectURL(file);
  try { return await loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

// Schaal naar maximaal `max` px (GPU-vriendelijk) en geef een canvas terug.
export function toCanvas(source, max = 2048) {
  const w0 = source.width, h0 = source.height, sc = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * sc); c.height = Math.round(h0 * sc);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c;
}

// Gemiddelde helderheid (0..1) van het schilderij zelf.
export function measureLuma(canvas) {
  const m = document.createElement('canvas'); m.width = m.height = 64;
  const mx = m.getContext('2d'); mx.drawImage(canvas, 0, 0, 64, 64);
  const d = mx.getImageData(0, 0, 64, 64).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  return Math.min(0.95, Math.max(0.03, s / (64 * 64)));
}
