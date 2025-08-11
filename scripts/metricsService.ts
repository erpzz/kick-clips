import 'dotenv/config';
import { refreshAll } from './refreshMetrics';  // export refreshAll from your file

const HOURS = 3;
const MS    = HOURS * 3600_000;

(async function loop() {
  console.log('[service] first run');
  await refreshAll();              // 45-min job
  console.log(`[service] sleeping ${HOURS} h`);
  setInterval(() => refreshAll().catch(console.error), MS);
})();
