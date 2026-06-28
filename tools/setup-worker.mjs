const workerUrl = process.env.WORKER_URL;
const setupSecret = process.env.SETUP_SECRET;

if (!workerUrl || !setupSecret) {
  console.error("Usage: WORKER_URL=https://... SETUP_SECRET=... npm run setup:worker");
  process.exit(1);
}

const response = await fetch(workerUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "setupWorkbook",
    payload: { setupSecret }
  })
});

const body = await response.json();

if (!response.ok || !body.ok) {
  console.error(body.error || `HTTP ${response.status}`);
  process.exit(1);
}

console.log("Google Sheet setup completed.");
console.log(JSON.stringify(body.data, null, 2));
