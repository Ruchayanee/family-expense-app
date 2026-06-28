const workerUrl = process.env.WORKER_URL;
const adminUserId = process.env.ADMIN_USER_ID || "u_admin";
const adminPin = process.env.ADMIN_PIN || "123456";

if (!workerUrl) {
  console.error("Usage: WORKER_URL=https://... npm run verify:worker");
  process.exit(1);
}

const health = await get(workerUrl);
assertOk("health", health);

const bootstrap = await post(workerUrl, "bootstrap", {});
assertOk("bootstrap", bootstrap);
assertHasArray("bootstrap users", bootstrap.data.users);
assertHasArray("bootstrap categories", bootstrap.data.categories);
assertHasArray("bootstrap payers", bootstrap.data.payers);
assertHasArray("bootstrap paymentMethods", bootstrap.data.paymentMethods);

const login = await post(workerUrl, "login", { userId: adminUserId, pin: adminPin });
assertOk("login", login);

const list = await post(workerUrl, "listExpenses", { token: login.data.token });
assertOk("listExpenses", list);
assertHasArray("expenses", list.data);

console.log("Worker verification passed.");
console.log(`Admin: ${login.data.user.name} (${login.data.user.role})`);
console.log(`Expenses visible: ${list.data.length}`);

async function get(url) {
  const response = await fetch(url);
  return response.json();
}

async function post(url, action, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload })
  });
  return response.json();
}

function assertOk(label, body) {
  if (!body || body.ok !== true) {
    console.error(`${label} failed: ${(body && body.error) || "unknown error"}`);
    process.exit(1);
  }
}

function assertHasArray(label, value) {
  if (!Array.isArray(value)) {
    console.error(`${label} is not an array`);
    process.exit(1);
  }
}
