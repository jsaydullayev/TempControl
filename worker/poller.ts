/**
 * Ingest worker.
 *
 * A separate process on purpose: a setInterval inside Next.js would be
 * duplicated by every dev reload and by every server instance in production,
 * so the same reading would be written several times.
 *
 *   npm run worker
 */
import { evaluateAll } from "../src/server/alerts/evaluate";
import { pollOnce, trimOldReadings, RETENTION_DAYS } from "../src/server/ingest/poll";

const INTERVAL_MS = Number(process.env.POLL_INTERVAL_SEC ?? 180) * 1000;
const TRIM_EVERY_MS = 24 * 60 * 60 * 1000;

let stopping = false;

function log(message: string) {
  console.log(`[poller ${new Date().toISOString()}] ${message}`);
}

async function tick() {
  try {
    const result = await pollOnce();

    // Evaluate straight after ingest: alerts are only as fresh as the readings
    // they are derived from, and both run in this one process.
    const alerts = await evaluateAll();

    log(
      `sensors=${result.sensors} written=${result.written} skipped=${result.skipped} ` +
        `alerts(opened=${alerts.opened} resolved=${alerts.resolved})` +
        (result.errors.length ? ` errors=${result.errors.join("; ")}` : ""),
    );
  } catch (error) {
    // A failed cycle must never kill the worker — the next one may well succeed.
    log(`cycle failed: ${String(error)}`);
  }
}

async function trim() {
  try {
    const removed = await trimOldReadings();
    if (removed > 0) log(`trimmed ${removed} readings older than ${RETENTION_DAYS} days`);
  } catch (error) {
    log(`trim failed: ${String(error)}`);
  }
}

async function main() {
  log(`starting, interval ${INTERVAL_MS / 1000}s, provider ${process.env.PROVIDER ?? "mock"}`);

  await tick();
  await trim();

  const poll = setInterval(tick, INTERVAL_MS);
  const cleanup = setInterval(trim, TRIM_EVERY_MS);

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(poll);
    clearInterval(cleanup);
    log("stopped");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
