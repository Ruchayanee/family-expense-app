const SHEETS = {
  expenses: "Expenses",
  categories: "Categories",
  users: "Users",
  payers: "Payers",
  paymentMethods: "PaymentMethods",
  settings: "Settings",
  sessions: "Sessions"
};

const HEADERS = {
  [SHEETS.expenses]: ["id", "date", "title", "category", "amount", "payer", "paymentMethod", "note", "receiptUrl", "createdBy", "createdAt", "updatedAt"],
  [SHEETS.categories]: ["name", "active"],
  [SHEETS.users]: ["id", "name", "role", "pinHash", "active"],
  [SHEETS.payers]: ["name", "active"],
  [SHEETS.paymentMethods]: ["name", "active"],
  [SHEETS.settings]: ["key", "value"],
  [SHEETS.sessions]: ["token", "userId", "expiresAt"]
};

const DEFAULTS = {
  categories: ["ค่าอาหาร", "ค่าน้ำมัน", "ค่าเดินทาง", "ค่าไฟ", "ค่าน้ำ", "ค่าอินเทอร์เน็ต", "ค่าบ้าน", "ค่าของใช้", "ค่ารักษาพยาบาล", "ค่าซ่อมรถ", "ค่าซ่อมบ้าน", "ช้อปปิ้ง", "อื่น ๆ"],
  payers: ["โอม", "ป๊า", "ม๊า"],
  paymentMethods: ["เงินสด", "โอน", "QR", "บัตรเครดิต", "บัตรเดบิต"],
  users: [
    { id: "u_admin", name: "โอม", role: "Admin", pin: "123456" },
    { id: "u_pa", name: "ป๊า", role: "Viewer", pin: "111111" },
    { id: "u_ma", name: "ม๊า", role: "Viewer", pin: "222222" }
  ]
};

let cachedAccessToken = null;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "GET") {
        return json({ ok: true, data: { name: "Family Expense API", status: "ready" } }, cors);
      }

      if (request.method !== "POST") throw new Error("Method not allowed");
      const body = await request.json();
      const data = await routeAction(body.action, body.payload || {}, env);
      return json({ ok: true, data }, cors);
    } catch (error) {
      return json({ ok: false, error: error.message }, cors, 400);
    }
  }
};

async function routeAction(action, payload, env) {
  if (action === "setupWorkbook") return setupWorkbook(payload, env);
  if (action === "bootstrap") return bootstrap(env);
  if (action === "login") return login(payload.userId, payload.pin, env);
  if (action === "listExpenses") return listExpenses(payload.token, env);
  if (action === "createExpense") return createExpense(payload.token, payload.expense, env);
  if (action === "updateExpense") return updateExpense(payload.token, payload.expense, env);
  if (action === "deleteExpense") return deleteExpense(payload.token, payload.id, env);
  if (action === "summary") return getSummary(payload.token, payload.month, env);
  throw new Error("Unknown action");
}

async function setupWorkbook(payload, env) {
  if (!env.SETUP_SECRET || payload.setupSecret !== env.SETUP_SECRET) throw new Error("Invalid setup secret");

  const metadata = await sheetsFetch(env, "", { method: "GET" });
  const existingSheets = new Set(metadata.sheets.map((sheet) => sheet.properties.title));
  const addSheetRequests = Object.values(SHEETS)
    .filter((sheetName) => !existingSheets.has(sheetName))
    .map((sheetName) => ({ addSheet: { properties: { title: sheetName } } }));

  if (addSheetRequests.length) {
    await sheetsFetch(env, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: addSheetRequests })
    });
  }

  await Promise.all(Object.entries(HEADERS).map(([sheetName, headers]) => putValues(env, `${sheetName}!A1:${columnName(headers.length)}1`, [headers])));
  await seedNameSheet(env, SHEETS.categories, DEFAULTS.categories);
  await seedNameSheet(env, SHEETS.payers, DEFAULTS.payers);
  await seedNameSheet(env, SHEETS.paymentMethods, DEFAULTS.paymentMethods);
  await seedUsers(env);

  return { status: "ready" };
}

async function bootstrap(env) {
  return {
    users: (await readTable(env, SHEETS.users)).filter(isActive).map(({ id, name, role }) => ({ id, name, role })),
    categories: await activeNames(env, SHEETS.categories),
    payers: await activeNames(env, SHEETS.payers),
    paymentMethods: await activeNames(env, SHEETS.paymentMethods)
  };
}

async function login(userId, pin, env) {
  const user = (await readTable(env, SHEETS.users)).find((item) => item.id === userId && isActive(item));
  if (!user || user.pinHash !== await hashValue(pin)) throw new Error("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง");

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await appendRow(env, SHEETS.sessions, { token, userId: user.id, expiresAt });
  return { token, user: { id: user.id, name: user.name, role: user.role } };
}

async function listExpenses(token, env) {
  await requireSession(token, env);
  return (await readTable(env, SHEETS.expenses)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function createExpense(token, expense, env) {
  const auth = await requireRole(token, "Admin", env);
  const cleaned = validateExpense(expense);
  const now = new Date().toISOString();
  const row = { ...cleaned, id: crypto.randomUUID(), createdBy: auth.user.id, createdAt: now, updatedAt: now };
  await appendRow(env, SHEETS.expenses, row);
  return row;
}

async function updateExpense(token, expense, env) {
  await requireRole(token, "Admin", env);
  const cleaned = validateExpense(expense);
  if (!expense.id) throw new Error("Missing expense id");

  const rows = await readTable(env, SHEETS.expenses);
  const index = rows.findIndex((item) => item.id === expense.id);
  if (index === -1) throw new Error("ไม่พบรายการ");

  const next = { ...rows[index], ...cleaned, id: expense.id, updatedAt: new Date().toISOString() };
  await writeTableRow(env, SHEETS.expenses, index, next);
  return next;
}

async function deleteExpense(token, id, env) {
  await requireRole(token, "Admin", env);
  const rows = await readTable(env, SHEETS.expenses);
  const index = rows.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("ไม่พบรายการ");

  const sheetId = await getSheetId(env, SHEETS.expenses);
  await sheetsFetch(env, ":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: index + 1, endIndex: index + 2 }
        }
      }]
    })
  });
  return { id };
}

async function getSummary(token, month, env) {
  await requireSession(token, env);
  const rows = (await readTable(env, SHEETS.expenses)).filter((item) => String(item.date).startsWith(month));
  return {
    total: rows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    byCategory: groupSum(rows, "category"),
    byPayer: groupSum(rows, "payer")
  };
}

function validateExpense(expense) {
  if (!expense) throw new Error("Missing expense");
  if (!expense.date || !expense.title || !expense.category || !expense.payer || !expense.paymentMethod) throw new Error("กรอกข้อมูลไม่ครบ");
  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("จำนวนเงินไม่ถูกต้อง");
  return {
    date: String(expense.date),
    title: String(expense.title).trim(),
    category: String(expense.category),
    amount,
    payer: String(expense.payer),
    paymentMethod: String(expense.paymentMethod),
    note: String(expense.note || "").trim(),
    receiptUrl: String(expense.receiptUrl || "").trim()
  };
}

async function requireSession(token, env) {
  const session = (await readTable(env, SHEETS.sessions)).find((item) => item.token === token);
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) throw new Error("Session หมดอายุ กรุณา login ใหม่");

  const user = (await readTable(env, SHEETS.users)).find((item) => item.id === session.userId && isActive(item));
  if (!user) throw new Error("ไม่พบผู้ใช้");
  return { session, user };
}

async function requireRole(token, role, env) {
  const auth = await requireSession(token, env);
  if (auth.user.role !== role) throw new Error("ไม่มีสิทธิ์ทำรายการนี้");
  return auth;
}

async function activeNames(env, sheetName) {
  return (await readTable(env, sheetName)).filter(isActive).map((item) => item.name);
}

function isActive(item) {
  return String(item.active).toUpperCase() !== "FALSE";
}

async function readTable(env, sheetName) {
  const result = await valuesFetch(env, `${sheetName}!A:Z`, "GET");
  const values = result.values || [];
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => {
    return headers.reduce((obj, header, index) => {
      obj[header] = row[index] ?? "";
      return obj;
    }, {});
  });
}

async function appendRow(env, sheetName, item) {
  const headers = HEADERS[sheetName];
  await valuesFetch(env, `${sheetName}!A:${columnName(headers.length)}`, "POST", {
    values: [headers.map((header) => item[header] ?? "")]
  }, ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS");
}

async function writeTableRow(env, sheetName, rowIndex, item) {
  const headers = HEADERS[sheetName];
  await putValues(env, `${sheetName}!A${rowIndex + 2}:${columnName(headers.length)}${rowIndex + 2}`, [headers.map((header) => item[header] ?? "")]);
}

async function putValues(env, range, values) {
  return valuesFetch(env, range, "PUT", { values }, "?valueInputOption=RAW");
}

async function seedNameSheet(env, sheetName, names) {
  const current = (await readTable(env, sheetName)).map((item) => item.name);
  for (const name of names) {
    if (!current.includes(name)) await appendRow(env, sheetName, { name, active: true });
  }
}

async function seedUsers(env) {
  const current = (await readTable(env, SHEETS.users)).map((item) => item.id);
  for (const user of DEFAULTS.users) {
    if (!current.includes(user.id)) {
      await appendRow(env, SHEETS.users, {
        id: user.id,
        name: user.name,
        role: user.role,
        pinHash: await hashValue(user.pin),
        active: true
      });
    }
  }
}

async function getSheetId(env, sheetName) {
  const metadata = await sheetsFetch(env, "", { method: "GET" });
  const sheet = metadata.sheets.find((item) => item.properties.title === sheetName);
  if (!sheet) throw new Error(`Missing sheet: ${sheetName}`);
  return sheet.properties.sheetId;
}

async function valuesFetch(env, range, method, body, suffix = "") {
  const encodedRange = encodeURIComponent(range);
  return sheetsFetch(env, `/values/${encodedRange}${suffix}`, {
    method,
    body: body ? JSON.stringify(body) : undefined
  });
}

async function sheetsFetch(env, path, options) {
  if (env.SHEETS_FETCH) return env.SHEETS_FETCH(path, options);

  const token = await getAccessToken(env);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}`;
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const jsonBody = await response.json();
  if (!response.ok) {
    const message = jsonBody.error && jsonBody.error.message ? jsonBody.error.message : "Google Sheets API error";
    throw new Error(message);
  }
  return jsonBody;
}

async function getAccessToken(env) {
  if (env.GOOGLE_ACCESS_TOKEN) return env.GOOGLE_ACCESS_TOKEN;
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) return cachedAccessToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const unsignedJwt = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const signature = await signJwt(unsignedJwt, env.GOOGLE_PRIVATE_KEY);
  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || "Cannot get Google access token");

  cachedAccessToken = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000 };
  return cachedAccessToken.token;
}

async function signJwt(input, privateKeyPem) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return base64Url(signature);
}

function pemToArrayBuffer(pem) {
  const normalized = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function hashValue(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function groupSum(rows, key) {
  return rows.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
}

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((item) => item.trim());
  const allowOrigin = allowed.includes("*") || allowed.includes(origin) ? origin || "*" : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(payload, headers = {}, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json;charset=utf-8", ...headers }
  });
}

function base64UrlJson(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64Url(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function columnName(columnNumber) {
  let name = "";
  let remaining = columnNumber;
  while (remaining > 0) {
    const mod = (remaining - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    remaining = Math.floor((remaining - mod) / 26);
  }
  return name;
}
