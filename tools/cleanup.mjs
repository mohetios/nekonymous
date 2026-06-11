/**
 * Full reset: purge all inbox DOs + delete all KV (user, conversation, UUID map, stats).
 * Run: WORKER_URL=https://nekonymous.mohet.ir BOT_SECRET_KEY=... pnpm cleanup
 */

const workerUrl = process.env.WORKER_URL?.replace(/\/$/, "");
const secret = process.env.BOT_SECRET_KEY;

if (!workerUrl || !secret) {
  console.error("Set WORKER_URL and BOT_SECRET_KEY.");
  process.exit(1);
}

const response = await fetch(`${workerUrl}/admin/cleanup`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await response.text();
if (!response.ok) {
  console.error(`Cleanup failed (${response.status}): ${body}`);
  process.exit(1);
}

console.log(body);
