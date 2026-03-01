import { processDueBookingReminders } from "../src/lib/booking-reminders";

function parseIntegerEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

const intervalMs = Math.max(
  5_000,
  parseIntegerEnv(process.env.REMINDERS_WORKER_INTERVAL_MS, 60_000),
);
const batchSize = Math.max(
  1,
  Math.min(200, parseIntegerEnv(process.env.REMINDERS_WORKER_BATCH_SIZE, 50)),
);

let isStopping = false;
let running = false;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick() {
  if (running || isStopping) return;
  running = true;
  try {
    const result = await processDueBookingReminders({ limit: batchSize });
    const now = new Date().toISOString();
    console.log(
      `[${now}] reminders processed=${result.processed} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`,
    );
    if (result.error) {
      console.warn(`[${now}] reminders warning: ${result.error}`);
    }
  } catch (error) {
    const now = new Date().toISOString();
    console.error(`[${now}] reminders worker tick error:`, error);
  } finally {
    running = false;
  }
}

async function run() {
  const now = new Date().toISOString();
  console.log(
    `[${now}] reminders worker started interval=${intervalMs}ms batch=${batchSize}`,
  );

  await tick();

  while (!isStopping) {
    await wait(intervalMs);
    await tick();
  }
}

function shutdown(signal: string) {
  if (isStopping) return;
  isStopping = true;
  const now = new Date().toISOString();
  console.log(`[${now}] reminders worker stopping by ${signal}...`);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

run()
  .then(() => {
    const now = new Date().toISOString();
    console.log(`[${now}] reminders worker finished.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("reminders worker fatal error:", error);
    process.exit(1);
  });
