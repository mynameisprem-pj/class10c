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
  appList: document.getElementById("appList"),
  lightbox: document.getElementById("photoLightbox"),
  lightboxImg: document.getElementById("lightboxImg"),
  lightboxClose: document.getElementById("lightboxClose")
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

    const statusBadge = a.verified
      ? `<span class="verify-status ok">✓ Verified from ID</span>`
      : `<span class="verify-status warn">⚠ Manually entered</span>`;

    const photoHtml = a.idPhoto
      ? `<img class="app-card-photo" src="${a.idPhoto}" alt="ID card photo for ${escapeHtml(a.name)}">`
      : `<div class="app-card-photo app-card-photo-missing">No photo</div>`;

    const datesLabel = a.dateFromBS && a.dateToBS
      ? `${escapeHtml(a.dateFromBS)} &rarr; ${escapeHtml(a.dateToBS)}`
      : `${formatDate(a.dateFrom)} &rarr; ${formatDate(a.dateTo)}`;

    const durationLabel = leaveDurationLabel(a.dateFrom, a.dateTo);

    card.innerHTML = `
      <div class="app-card-body">
        ${photoHtml}
        <div class="app-card-info">
          <div class="app-card-top">
            <span class="app-card-name">${escapeHtml(a.name)}</span>
            <span class="app-card-meta">Roll ${escapeHtml(a.roll)} &middot; ${escapeHtml(a.className)}-${escapeHtml(a.section)}</span>
          </div>
          ${statusBadge}
          <div class="app-card-dates">${datesLabel}${durationLabel ? ` <span class="app-card-duration">${durationLabel}</span>` : ""}</div>
          <span class="app-card-reason-type">${escapeHtml(a.reasonType)}</span>
          <p class="app-card-details">${escapeHtml(a.reasonDetails)}</p>
          <div class="app-card-contact">Guardian contact: ${escapeHtml(a.guardianContact)}</div>
        </div>
      </div>
    `;
    el.appList.appendChild(card);
  });
}

function leaveDurationLabel(dateFromIso, dateToIso) {
  if (!dateFromIso || !dateToIso) return "";
  const from = new Date(dateFromIso);
  const to = new Date(dateToIso);
  if (isNaN(from) || isNaN(to) || to < from) return "";
  const dayCount = Math.round((to - from) / 86400000) + 1;
  return `${dayCount} day${dayCount === 1 ? "" : "s"}`;
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
function openLightbox(src) {
  el.lightboxImg.src = src;
  el.lightbox.classList.add("open");
}

function closeLightbox() {
  el.lightbox.classList.remove("open");
  el.lightboxImg.src = "";
}

el.appList.addEventListener("click", (e) => {
  if (e.target.matches("img.app-card-photo")) {
    openLightbox(e.target.src);
  }
});
el.lightbox.addEventListener("click", closeLightbox);
el.lightboxClose.addEventListener("click", (e) => {
  e.stopPropagation();
  closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

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