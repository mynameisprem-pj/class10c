const SESSION_KEY = "teacher_session_token";

const el = {
  loginPanel: document.getElementById("loginPanel"),
  dashboardPanel: document.getElementById("dashboardPanel"),
  passwordInput: document.getElementById("passwordInput"),
  eyeToggle: document.getElementById("eyeToggle"),
  eyeIconOpen: document.getElementById("eyeIconOpen"),
  eyeIconClosed: document.getElementById("eyeIconClosed"),
  loginBtn: document.getElementById("loginBtn"),
  loginError: document.getElementById("loginError"),
  logoutBtn: document.getElementById("logoutBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  dashCount: document.getElementById("dashCount"),
  emptyState: document.getElementById("emptyState"),
  appList: document.getElementById("appList")
};

function showDashboard() {
  el.loginPanel.classList.remove("active");
  el.dashboardPanel.classList.add("active");
  loadApplications();
}

function showLogin() {
  el.dashboardPanel.classList.remove("active");
  el.loginPanel.classList.add("active");
}

async function login() {
  const password = el.passwordInput.value;
  if (!password) return;

  el.loginBtn.disabled = true;
  el.loginError.hidden = true;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (!res.ok) {
      el.loginError.textContent = data.error || "Login failed.";
      el.loginError.hidden = false;
      return;
    }

    sessionStorage.setItem(SESSION_KEY, data.token);
    el.passwordInput.value = "";
    showDashboard();
  } catch {
    el.loginError.textContent = "Could not reach the server. Check your connection.";
    el.loginError.hidden = false;
  } finally {
    el.loginBtn.disabled = false;
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
}

async function loadApplications() {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    showLogin();
    return;
  }

  el.appList.innerHTML = "";
  el.dashCount.textContent = "Loading…";

  try {
    const res = await fetch("/api/applications", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const data = await res.json();
    renderApplications(data.applications || []);
  } catch {
    el.dashCount.textContent = "Could not load applications.";
  }
}

function renderApplications(apps) {
  el.dashCount.textContent = `${apps.length} application${apps.length === 1 ? "" : "s"}`;
  el.emptyState.hidden = apps.length !== 0;
  el.appList.innerHTML = "";

  apps.forEach((a) => {
    const card = document.createElement("div");
    card.className = "app-card";
    card.innerHTML = `
      <div class="app-card-top">
        <span class="app-card-name">${escapeHtml(a.name)}</span>
        <span class="app-card-meta">Roll ${escapeHtml(a.roll)} &middot; ${escapeHtml(a.className)}-${escapeHtml(a.section)}</span>
      </div>
      <div class="app-card-dates">${formatDate(a.dateFrom)} &rarr; ${formatDate(a.dateTo)}</div>
      <span class="app-card-reason-type">${escapeHtml(a.reasonType)}</span>
      <p class="app-card-details">${escapeHtml(a.reasonDetails)}</p>
      <div class="app-card-contact">Guardian contact: ${escapeHtml(a.guardianContact)}</div>
    `;
    el.appList.appendChild(card);
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function togglePasswordVisibility() {
  const isHidden = el.passwordInput.type === "password";
  el.passwordInput.type = isHidden ? "text" : "password";
  el.eyeIconOpen.hidden = isHidden;
  el.eyeIconClosed.hidden = !isHidden;
  el.eyeToggle.setAttribute("aria-pressed", String(isHidden));
  el.eyeToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
}

el.eyeToggle.addEventListener("click", togglePasswordVisibility);
el.loginBtn.addEventListener("click", login);
el.passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
el.logoutBtn.addEventListener("click", logout);
el.refreshBtn.addEventListener("click", loadApplications);

if (sessionStorage.getItem(SESSION_KEY)) {
  showDashboard();
} else {
  showLogin();
}