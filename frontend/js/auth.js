(function () {
  const sessionKey = "family-expense-session";

  function getSession() {
    const raw = localStorage.getItem(sessionKey);
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(session) {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(sessionKey);
  }

  function isAdmin() {
    const session = getSession();
    return session && session.user && session.user.role === "Admin";
  }

  window.Auth = { getSession, setSession, clearSession, isAdmin };
})();
