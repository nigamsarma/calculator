// Script to generate minimal valid PNG calculator icons
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Simple solid color PNG buffer generator with calculator symbol
function createPngIcon(size) {
  // Base64 data of a sleek dark calculator icon (dark grey background with glowing cyan/orange accents)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="22" fill="#181a20"/>
    <rect x="18" y="16" width="64" height="20" rx="4" fill="#0f1115" stroke="#2d3139" stroke-width="2"/>
    <text x="76" y="31" fill="#00e699" font-size="12" font-family="monospace" text-anchor="end">123,456</text>
    <rect x="18" y="44" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="35" y="44" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="52" y="44" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="69" y="44" width="13" height="11" rx="2" fill="#ff9500"/>
    <rect x="18" y="58" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="35" y="58" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="52" y="58" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="69" y="58" width="13" height="11" rx="2" fill="#ff9500"/>
    <rect x="18" y="72" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="35" y="72" width="13" height="11" rx="2" fill="#2d3139"/>
    <rect x="52" y="72" width="13" height="11" rx="2" fill="#007aff"/>
    <rect x="69" y="72" width="13" height="11" rx="2" fill="#ff9500"/>
  </svg>`;

  return svg;
}

fs.writeFileSync(path.join(publicDir, 'icon.svg'), createPngIcon(512));
console.log('Icon generated.');
