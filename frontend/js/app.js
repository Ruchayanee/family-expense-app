(function () {
  const state = {
    bootstrap: null,
    expenses: [],
    activeView: "dashboard"
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindElements();
    bindEvents();
    setDefaultDates();
    await loadBootstrap();
    restoreSession();
  }

  function bindElements() {
    [
      "loginView", "mainView", "loginForm", "loginUser", "loginPin", "loginError", "currentUserName",
      "logoutBtn", "refreshBtn", "expenseForm", "expenseId", "expenseDate", "expenseTitle",
      "expenseCategory", "expenseAmount", "expensePayer", "expensePayment", "expenseNote",
      "expenseReceipt", "saveExpenseBtn", "cancelEditBtn", "expenseMessage", "searchInput",
      "filterCategory", "sortInput", "expenseList", "monthTotal", "todayTotal", "entryCount",
      "topCategory", "categoryChart", "summaryMonth", "summaryTotal", "dailyChart",
      "summaryCategoryList", "summaryPayerList", "exportCsvBtn", "printPdfBtn"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", handleLogin);
    els.logoutBtn.addEventListener("click", handleLogout);
    els.refreshBtn.addEventListener("click", loadExpenses);
    els.expenseForm.addEventListener("submit", handleSaveExpense);
    els.cancelEditBtn.addEventListener("click", resetExpenseForm);
    els.searchInput.addEventListener("input", renderList);
    els.filterCategory.addEventListener("change", renderList);
    els.sortInput.addEventListener("change", renderList);
    els.summaryMonth.addEventListener("change", renderSummary);
    els.exportCsvBtn.addEventListener("click", exportCsv);
    els.printPdfBtn.addEventListener("click", () => window.print());

    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
  }

  function setDefaultDates() {
    const today = new Date();
    els.expenseDate.value = toDateInput(today);
    els.summaryMonth.value = toDateInput(today).slice(0, 7);
  }

  async function loadBootstrap() {
    state.bootstrap = await window.Api.request("bootstrap");
    fillSelect(els.loginUser, state.bootstrap.users, "name", "id");
    fillSelect(els.expenseCategory, state.bootstrap.categories);
    fillSelect(els.filterCategory, ["", ...state.bootstrap.categories], null, null, "ทุกหมวด");
    fillSelect(els.expensePayer, state.bootstrap.payers);
    fillSelect(els.expensePayment, state.bootstrap.paymentMethods);
  }

  function restoreSession() {
    const session = window.Auth.getSession();
    if (session) showApp(session.user);
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginError.textContent = "";

    try {
      const session = await window.Api.request("login", { userId: els.loginUser.value, pin: els.loginPin.value });
      window.Auth.setSession(session);
      els.loginPin.value = "";
      showApp(session.user);
    } catch (error) {
      els.loginError.textContent = error.message;
    }
  }

  function showApp(user) {
    els.currentUserName.textContent = `${user.name} (${user.role})`;
    els.loginView.classList.add("hidden");
    els.mainView.classList.remove("hidden");
    document.querySelectorAll(".admin-only").forEach((item) => item.classList.toggle("hidden", user.role !== "Admin"));
    if (user.role !== "Admin" && ["add", "reports"].includes(state.activeView)) switchView("dashboard");
    loadExpenses();
  }

  function handleLogout() {
    window.Auth.clearSession();
    els.mainView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
  }

  function switchView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll(".tab-btn").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    document.getElementById(`${viewName}Panel`).classList.add("active");
    if (viewName === "summary") renderSummary();
  }

  async function loadExpenses() {
    state.expenses = await window.Api.request("listExpenses", { token: window.Auth.getSession().token });
    renderDashboard();
    renderList();
    renderSummary();
  }

  async function handleSaveExpense(event) {
    event.preventDefault();
    const session = window.Auth.getSession();
    if (!session || session.user.role !== "Admin") return;

    const expense = readExpenseForm();
    const action = expense.id ? "updateExpense" : "createExpense";

    try {
      await window.Api.request(action, { token: session.token, expense });
      els.expenseMessage.textContent = expense.id ? "แก้ไขเรียบร้อย" : "บันทึกเรียบร้อย";
      resetExpenseForm();
      await loadExpenses();
      switchView("list");
    } catch (error) {
      els.expenseMessage.textContent = error.message;
    }
  }

  function readExpenseForm() {
    return {
      id: els.expenseId.value,
      date: els.expenseDate.value,
      title: els.expenseTitle.value.trim(),
      category: els.expenseCategory.value,
      amount: Number(els.expenseAmount.value),
      payer: els.expensePayer.value,
      paymentMethod: els.expensePayment.value,
      note: els.expenseNote.value.trim(),
      receiptUrl: els.expenseReceipt.value.trim()
    };
  }

  function resetExpenseForm() {
    els.expenseForm.reset();
    els.expenseId.value = "";
    els.expenseDate.value = toDateInput(new Date());
    els.saveExpenseBtn.textContent = "บันทึกรายจ่าย";
    els.cancelEditBtn.classList.add("hidden");
  }

  function renderDashboard() {
    const today = toDateInput(new Date());
    const month = today.slice(0, 7);
    const monthExpenses = state.expenses.filter((item) => item.date && item.date.startsWith(month));
    const todayExpenses = state.expenses.filter((item) => item.date === today);
    const byCategory = groupSum(monthExpenses, "category");
    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    els.monthTotal.textContent = money(sum(monthExpenses));
    els.todayTotal.textContent = money(sum(todayExpenses));
    els.entryCount.textContent = monthExpenses.length;
    els.topCategory.textContent = top ? top[0] : "-";
    renderBars(els.categoryChart, byCategory);
  }

  function renderList() {
    const query = els.searchInput.value.trim().toLowerCase();
    const category = els.filterCategory.value;
    const sort = els.sortInput.value;
    const session = window.Auth.getSession();

    const rows = state.expenses
      .filter((item) => !category || item.category === category)
      .filter((item) => !query || [item.title, item.category, item.payer, item.note].join(" ").toLowerCase().includes(query))
      .sort(sortExpenses(sort));

    els.expenseList.innerHTML = rows.map((item) => expenseItemTemplate(item, session.user.role === "Admin")).join("") || "<p class=\"hint-text\">ยังไม่มีรายการ</p>";

    els.expenseList.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editExpense(button.dataset.edit)));
    els.expenseList.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteExpense(button.dataset.delete)));
  }

  function expenseItemTemplate(item, canEdit) {
    const note = item.note ? `<span>${escapeHtml(item.note)}</span>` : "";
    const receipt = item.receiptUrl ? `<a href="${escapeHtml(item.receiptUrl)}" target="_blank" rel="noreferrer">สลิป</a>` : "";
    const actions = canEdit ? `<div class="item-actions"><button class="secondary-btn" data-edit="${item.id}" type="button">แก้ไข</button><button class="danger-btn" data-delete="${item.id}" type="button">ลบ</button></div>` : "";

    return `
      <article class="expense-item">
        <div class="expense-main">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="expense-amount">${money(item.amount)}</span>
        </div>
        <div class="expense-meta">
          <span>${formatDate(item.date)}</span>
          <span>${escapeHtml(item.category)}</span>
          <span>${escapeHtml(item.payer)}</span>
          <span>${escapeHtml(item.paymentMethod)}</span>
          ${note}
          ${receipt}
        </div>
        ${actions}
      </article>
    `;
  }

  function editExpense(id) {
    const item = state.expenses.find((expense) => expense.id === id);
    if (!item) return;
    els.expenseId.value = item.id;
    els.expenseDate.value = item.date;
    els.expenseTitle.value = item.title;
    els.expenseCategory.value = item.category;
    els.expenseAmount.value = item.amount;
    els.expensePayer.value = item.payer;
    els.expensePayment.value = item.paymentMethod;
    els.expenseNote.value = item.note || "";
    els.expenseReceipt.value = item.receiptUrl || "";
    els.saveExpenseBtn.textContent = "บันทึกการแก้ไข";
    els.cancelEditBtn.classList.remove("hidden");
    switchView("add");
  }

  async function deleteExpense(id) {
    if (!confirm("ต้องการลบรายการนี้ใช่ไหม")) return;
    await window.Api.request("deleteExpense", { token: window.Auth.getSession().token, id });
    await loadExpenses();
  }

  function renderSummary() {
    const month = els.summaryMonth.value || new Date().toISOString().slice(0, 7);
    const rows = state.expenses.filter((item) => item.date && item.date.startsWith(month));
    els.summaryTotal.textContent = `ยอดรวม ${money(sum(rows))}`;
    renderBars(els.dailyChart, groupSum(rows, (item) => item.date.slice(8, 10)));
    renderSummaryRows(els.summaryCategoryList, groupSum(rows, "category"));
    renderSummaryRows(els.summaryPayerList, groupSum(rows, "payer"));
  }

  function exportCsv() {
    const headers = ["วันที่", "รายการ", "หมวดหมู่", "จำนวนเงิน", "ผู้จ่าย", "วิธีชำระ", "หมายเหตุ", "สลิป"];
    const rows = state.expenses.map((item) => [item.date, item.title, item.category, item.amount, item.payer, item.paymentMethod, item.note || "", item.receiptUrl || ""]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `family-expenses-${toDateInput(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderBars(container, grouped) {
    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map((entry) => entry[1]), 1);
    container.innerHTML = entries.map(([label, value]) => `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.max(4, (value / max) * 100)}%"></span></span>
        <span class="bar-value">${money(value)}</span>
      </div>
    `).join("") || "<p class=\"hint-text\">ยังไม่มีข้อมูล</p>";
  }

  function renderSummaryRows(container, grouped) {
    const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
    container.innerHTML = entries.map(([label, value]) => `<div class="summary-row"><strong>${escapeHtml(label)}</strong><span>${money(value)}</span></div>`).join("") || "<p class=\"hint-text\">ยังไม่มีข้อมูล</p>";
  }

  function fillSelect(select, items, labelKey, valueKey, emptyLabel) {
    select.innerHTML = items.map((item) => {
      const isObject = typeof item === "object";
      const label = isObject ? item[labelKey] : item;
      const value = isObject ? item[valueKey] : item;
      return `<option value="${escapeHtml(value)}">${escapeHtml(label || emptyLabel)}</option>`;
    }).join("");
  }

  function groupSum(rows, key) {
    return rows.reduce((acc, item) => {
      const label = typeof key === "function" ? key(item) : item[key];
      acc[label] = (acc[label] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
  }

  function sum(rows) {
    return rows.reduce((total, item) => total + Number(item.amount || 0), 0);
  }

  function sortExpenses(type) {
    return (a, b) => {
      if (type === "dateAsc") return a.date.localeCompare(b.date);
      if (type === "amountDesc") return Number(b.amount) - Number(a.amount);
      if (type === "amountAsc") return Number(a.amount) - Number(b.amount);
      return b.date.localeCompare(a.date);
    };
  }

  function money(value) {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(value || 0));
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value));
  }

  function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function csvCell(value) {
    return `"${String(value || "").replace(/"/g, '""')}"`;
  }
})();
