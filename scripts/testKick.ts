/**
 * Call Kick’s clip API two ways and print the status codes.
 */

import https from 'node:https';
//import { fetch, setGlobalDispatcher, Agent } from 'undici';

const CLIP = 'clip_01K1QMVPWW9BVY3175JPZY4GHW';
const URL  = `https://kick.com/api/v2/clips/${CLIP}`;
const H    = { 'User-Agent': 'Mozilla/5.0' } as const;

function httpsGetStatus(): Promise<number> {
  return new Promise(res => {
    https.get(URL, { headers: H }, r => res(r.statusCode ?? 0));
  });
}

async function run() {
  // A) built-in https  (curl-style)
  console.log('https  :', await httpsGetStatus());

  // B) Node global fetch (undici, keep-alive on)
  console.log('fetch  :', await fetch(URL, { headers: H }).then(r => r.status));

  // C) fetch with keep-alive **off**
  setGlobalDispatcher(new Agent({ keepAlive: false }));
  console.log('fetch-noKA:', await fetch(URL, { headers: H }).then(r => r.status));
}

run();
