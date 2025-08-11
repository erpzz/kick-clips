// normalize-seed.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname shim for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const FILE = path.resolve(__dirname, 'data/seed-clips.json');
const raw  = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);

function isSnake(obj) {
  return !!obj.clip_url && !!obj.video_url;
}

function extractStreamer(clipUrl) {
  try {
    const afterDomain = clipUrl.split('kick.com/')[1];
    return afterDomain.split('?')[0].toLowerCase();
  } catch {
    return null;
  }
}

const output = data.map(item => {
  if (isSnake(item)) return item;

  const streamer = extractStreamer(item.sourceUrl);

  return {
    id:             item.id,
    title:          item.title,
    clip_url:       item.sourceUrl,
    thumbnail_url:  item.thumbnailUrl,
    video_url:      item.videoUrl,
    created_at:     item.timestamp,
    view_count:     item.viewCount,
    creator: {
      username: streamer,
      slug:     streamer,
    },
  };
});

// Write out a new file so you can inspect before overwriting
const OUT = path.resolve(__dirname, 'seed-clips-normalized.json');
fs.writeFileSync(OUT, JSON.stringify(output, null, 2));

console.log(`✅ Converted ${data.length} records to snake_case and wrote to seed-clips-normalized.json`);
