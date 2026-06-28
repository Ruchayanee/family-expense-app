import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

test("worker supports setup, login, admin CRUD, and viewer read-only access", async () => {
  const sheets = createSheetsMock();
  const env = {
    ALLOWED_ORIGIN: "https://example.github.io",
    SETUP_SECRET: "setup-secret",
    SHEETS_FETCH: sheets.fetch
  };

  const setup = await callWorker("setupWorkbook", { setupSecret: "setup-secret" }, env);
  assert.equal(setup.status, "ready");
  assert.deepEqual(Object.keys(sheets.data).sort(), ["Categories", "Expenses", "Payers", "PaymentMethods", "Sessions", "Settings", "Users"].sort());

  const bootstrap = await callWorker("bootstrap", {}, env);
  assert.deepEqual(bootstrap.users.map((user) => user.name), ["โอม", "ป๊า", "ม๊า"]);
  assert.ok(bootstrap.categories.includes("ค่าอาหาร"));

  const adminSession = await callWorker("login", { userId: "u_admin", pin: "123456" }, env);
  assert.equal(adminSession.user.role, "Admin");

  const expense = await callWorker("createExpense", {
    token: adminSession.token,
    expense: {
      date: "2026-06-28",
      title: "อาหารเย็น",
      category: "ค่าอาหาร",
      amount: 250,
      payer: "โอม",
      paymentMethod: "QR",
      note: "",
      receiptUrl: ""
    }
  }, env);
  assert.equal(expense.title, "อาหารเย็น");

  const rows = await callWorker("listExpenses", { token: adminSession.token }, env);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 250);

  const viewerSession = await callWorker("login", { userId: "u_pa", pin: "111111" }, env);
  const viewerRows = await callWorker("listExpenses", { token: viewerSession.token }, env);
  assert.equal(viewerRows.length, 1);

  const forbidden = await rawCallWorker("deleteExpense", { token: viewerSession.token, id: expense.id }, env);
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error, "ไม่มีสิทธิ์ทำรายการนี้");
});

test("worker returns CORS headers for allowed origins", async () => {
  const response = await worker.fetch(new Request("https://worker.test", {
    method: "OPTIONS",
    headers: { Origin: "https://example.github.io" }
  }), { ALLOWED_ORIGIN: "https://example.github.io" });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://example.github.io");
});

async function callWorker(action, payload, env) {
  const body = await rawCallWorker(action, payload, env);
  assert.equal(body.ok, true, body.error);
  return body.data;
}

async function rawCallWorker(action, payload, env) {
  const response = await worker.fetch(new Request("https://worker.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.github.io"
    },
    body: JSON.stringify({ action, payload })
  }), env);

  return response.json();
}

function createSheetsMock() {
  const data = {};
  const sheetIds = {};
  let nextSheetId = 1;

  function ensureSheet(name) {
    if (!data[name]) {
      data[name] = [];
      sheetIds[name] = nextSheetId;
      nextSheetId += 1;
    }
  }

  return {
    data,
    async fetch(path, options) {
      if (path === "" && options.method === "GET") {
        return {
          sheets: Object.keys(data).map((title) => ({ properties: { title, sheetId: sheetIds[title] } }))
        };
      }

      if (path === ":batchUpdate") {
        const body = JSON.parse(options.body);
        for (const request of body.requests) {
          if (request.addSheet) {
            ensureSheet(request.addSheet.properties.title);
          }

          if (request.deleteDimension) {
            const target = Object.entries(sheetIds).find(([, id]) => id === request.deleteDimension.range.sheetId);
            if (!target) throw new Error("Unknown sheet id");
            const [sheetName] = target;
            data[sheetName].splice(request.deleteDimension.range.startIndex, request.deleteDimension.range.endIndex - request.deleteDimension.range.startIndex);
          }
        }
        return {};
      }

      if (!path.startsWith("/values/")) throw new Error(`Unhandled mock path: ${path}`);
      return handleValuesPath(path, options, data);
    }
  };
}

function handleValuesPath(path, options, data) {
  const pathWithoutPrefix = path.slice("/values/".length);
  const encodedRange = pathWithoutPrefix.split(/:append|\?/)[0];
  const range = decodeURIComponent(encodedRange);
  const sheetName = range.split("!")[0];

  if (!data[sheetName]) data[sheetName] = [];

  if (options.method === "GET") {
    return { values: data[sheetName] };
  }

  const body = JSON.parse(options.body);

  if (options.method === "PUT") {
    const startRow = getStartRow(range);
    body.values.forEach((row, index) => {
      data[sheetName][startRow + index] = row;
    });
    return {};
  }

  if (options.method === "POST" && path.includes(":append")) {
    data[sheetName].push(...body.values);
    return {};
  }

  throw new Error(`Unhandled mock values call: ${options.method} ${path}`);
}

function getStartRow(range) {
  const match = range.match(/![A-Z]+(\d+)/);
  return match ? Number(match[1]) - 1 : 0;
}
