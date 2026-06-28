(function () {
  const storageKey = "family-expense-demo-data";

  const seedData = {
    categories: ["ค่าอาหาร", "ค่าน้ำมัน", "ค่าเดินทาง", "ค่าไฟ", "ค่าน้ำ", "ค่าอินเทอร์เน็ต", "ค่าบ้าน", "ค่าของใช้", "ค่ารักษาพยาบาล", "ค่าซ่อมรถ", "ค่าซ่อมบ้าน", "ช้อปปิ้ง", "อื่น ๆ"],
    payers: ["โอม", "ป๊า", "ม๊า"],
    paymentMethods: ["เงินสด", "โอน", "QR", "บัตรเครดิต", "บัตรเดบิต"],
    users: [
      { id: "u_admin", name: "โอม", role: "Admin", pin: "123456" },
      { id: "u_pa", name: "ป๊า", role: "Viewer", pin: "111111" },
      { id: "u_ma", name: "ม๊า", role: "Viewer", pin: "222222" }
    ],
    expenses: []
  };

  function loadDemoData() {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(storageKey, JSON.stringify(seedData));
    return JSON.parse(JSON.stringify(seedData));
  }

  function saveDemoData(data) {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  function isDemoMode() {
    const config = window.AppConfig || {};
    if (config.demoMode === true) return true;
    if (config.demoMode === false) return false;
    return !hasAppsScriptApi() && (!config.apiBaseUrl || config.apiBaseUrl.includes("PASTE_"));
  }

  async function request(action, payload) {
    if (hasAppsScriptApi() && !isDemoMode()) return appsScriptRequest(action, payload || {});
    if (isDemoMode()) return demoRequest(action, payload || {});

    const response = await fetch(window.AppConfig.apiBaseUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload: payload || {} })
    });

    const json = await response.json();
    if (!json.ok) throw new Error(json.error || "API error");
    return json.data;
  }

  function hasAppsScriptApi() {
    return typeof google !== "undefined" && google.script && google.script.run;
  }

  function appsScriptRequest(action, payload) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((json) => {
          if (!json || !json.ok) {
            reject(new Error((json && json.error) || "API error"));
            return;
          }
          resolve(json.data);
        })
        .withFailureHandler((error) => reject(new Error(error.message || "API error")))
        .api({ action, payload });
    });
  }

  async function demoRequest(action, payload) {
    const data = loadDemoData();

    if (action === "bootstrap") {
      return {
        users: data.users.map(({ id, name, role }) => ({ id, name, role })),
        categories: data.categories,
        payers: data.payers,
        paymentMethods: data.paymentMethods
      };
    }

    if (action === "login") {
      const user = data.users.find((item) => item.id === payload.userId && item.pin === payload.pin);
      if (!user) throw new Error("ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง");
      return { token: `demo-${user.id}-${Date.now()}`, user: { id: user.id, name: user.name, role: user.role } };
    }

    if (action === "listExpenses") return data.expenses;

    if (action === "createExpense") {
      const expense = { ...payload.expense, id: `exp_${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.expenses.push(expense);
      saveDemoData(data);
      return expense;
    }

    if (action === "updateExpense") {
      const index = data.expenses.findIndex((item) => item.id === payload.expense.id);
      if (index === -1) throw new Error("ไม่พบรายการ");
      data.expenses[index] = { ...data.expenses[index], ...payload.expense, updatedAt: new Date().toISOString() };
      saveDemoData(data);
      return data.expenses[index];
    }

    if (action === "deleteExpense") {
      const next = data.expenses.filter((item) => item.id !== payload.id);
      data.expenses = next;
      saveDemoData(data);
      return { id: payload.id };
    }

    throw new Error("ไม่รู้จักคำสั่ง API");
  }

  window.Api = { request };
})();
