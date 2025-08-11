// fix-channel.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES‑module __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const IN   = path.resolve(__dirname, 'data/seed-clips.json');
const OUT  = path.resolve(__dirname, 'data/seed-clips-fixed.json');
const raw  = fs.readFileSync(IN, 'utf8');
const data = JSON.parse(raw);

// Figure out whether we have a top‑level array or an object { clips: [...] }
let clipsArray;
let rootIsArray = Array.isArray(data);
if (rootIsArray) {
  clipsArray = data;
} else if (Array.isArray(data.clips)) {
  clipsArray = data.clips;
} else {
  console.error('❌ Could not find a clips array in seed-clips.json');
  process.exit(1);
}

// Transform each entry
const fixedClips = clipsArray.map(item => {
  // pull off source & author
  const { source: _drop1, author, ...rest } = item;

  // build channel object
  const username = author;
  const slug     = author ? author.toLowerCase() : null;

  return {
    ...rest,
    channel: { username, slug },
  };
});

// Reassemble
const output = rootIsArray
  ? fixedClips
  : { ...data, clips: fixedClips };

fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`✅ Wrote ${fixedClips.length} entries to seed-clips-fixed.json`);
