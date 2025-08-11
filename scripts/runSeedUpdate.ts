// scripts/runSeedUpdate.ts
import { updateAndCleanSeedFile } from '../src/lib/updateSeedFile'; // Adjust path if needed
import 'dotenv/config'

// simple delay helper
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scheduledRun() {
  console.log(`[${new Date().toISOString()}] Starting seed file update…`);
  let attempt = 0;

  while (attempt < 2) {
    try {
      const result = await updateAndCleanSeedFile();
      console.log(`[${new Date().toISOString()}] Update Result: ${result.message}`);

      // assume result.success is a boolean and result.statusCode may exist
      const code = (result as any).statusCode;
      if (result.success) {
        console.log(`[${new Date().toISOString()}] Update succeeded.`);
        return;
      }

      // if it failed with a retryable code
      if ([400, 401, 403].includes(code)) {
        attempt++;
        if (attempt < 2) {
          console.log(`→ got status ${code}, retrying in 1 minute…`);
          await delay(60 * 1000);
          continue;
        }
      }

      console.error(`[${new Date().toISOString()}] Non-retryable failure or max retries reached.`);
      process.exit(1);

    } catch (err: any) {
      const status = err.statusCode ?? err.response?.status;
      if ([400, 401, 403].includes(status) && attempt < 1) {
        attempt++;
        console.log(`→ caught ${status}, retrying in 1 minute…`);
        await delay(60 * 1000);
        continue;
      }
      console.error(`[${new Date().toISOString()}] Fatal error:`, err);
      process.exit(1);
    }
  }
}

(async () => {
  // run immediately…
  await scheduledRun();

  const setTime = 130 * 60 * 1000;
  setInterval(scheduledRun, setTime);
})();
