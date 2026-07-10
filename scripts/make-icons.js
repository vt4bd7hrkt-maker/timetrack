/*
 * Generates PWA icons without any native image tooling.
 * Draws an anthracite rounded square with a neon-green play triangle
 * directly into pixel buffers via pngjs.
 */
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'icons');
mkdirSync(out, { recursive: true });

const BG = [23, 25, 27]; // anthracite
const FG = [57, 255, 20]; // neon green

function inRoundedRect(x, y, size, pad, r) {
  const min = pad, max = size - pad;
  if (x < min || x > max || y < min || y > max) return false;
  // Clamp to the inner (radius-inset) rectangle; interior points clamp to
  // themselves (distance 0), corner points get a proper circular check.
  const cx = Math.max(min + r, Math.min(x, max - r));
  const cy = Math.max(min + r, Math.min(y, max - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inTriangle(px, py, a, b, c) {
  const s = (a[1] - c[1]) * (px - c[0]) + (c[0] - a[0]) * (py - c[1]);
  const t = (c[1] - b[1]) * (px - c[0]) + (b[0] - c[0]) * (py - c[1]);
  const d = (a[1] - c[1]) * (b[0] - c[0]) + (c[0] - a[0]) * (b[1] - c[1]);
  if (d === 0) return false;
  const u = s / d, v = t / d;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function makeIcon(size, { maskable = false } = {}) {
  const png = new PNG({ width: size, height: size });
  const pad = maskable ? 0 : Math.round(size * 0.04);
  const radius = maskable ? 0 : Math.round(size * 0.22);
  // Play triangle, slightly right-shifted for optical centering.
  const t = maskable ? 0.62 : 0.72; // triangle scale factor of inner area
  const h = size * 0.34 * (maskable ? 0.82 : 1);
  const cx = size / 2 + size * 0.035;
  const cy = size / 2;
  const A = [cx - h * 0.55, cy - h * 0.62 * t];
  const B = [cx - h * 0.55, cy + h * 0.62 * t];
  const C = [cx + h * 0.65, cy];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      let rgba = [0, 0, 0, 0];
      if (maskable || inRoundedRect(x, y, size, pad, radius)) rgba = [...BG, 255];
      if (rgba[3] && inTriangle(x, y, A, B, C)) rgba = [...FG, 255];
      png.data[i] = rgba[0];
      png.data[i + 1] = rgba[1];
      png.data[i + 2] = rgba[2];
      png.data[i + 3] = rgba[3];
    }
  }
  return PNG.sync.write(png);
}

writeFileSync(join(out, 'icon-192.png'), makeIcon(192));
writeFileSync(join(out, 'icon-512.png'), makeIcon(512));
writeFileSync(join(out, 'icon-maskable-512.png'), makeIcon(512, { maskable: true }));
writeFileSync(join(out, 'apple-touch-icon.png'), makeIcon(180, { maskable: true }));
console.log('icons written to', out);
