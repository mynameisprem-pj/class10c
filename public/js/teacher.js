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
  lightboxClose: document.getElementById("lightboxClose"),
  detailModal: document.getElementById("detailModal"),
  detailContent: document.getElementById("detailContent"),
  detailClose: document.getElementById("detailClose")
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

    localStorage.setItem(SESSION_KEY, data.token);
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
  localStorage.removeItem(SESSION_KEY);
  showLogin();
}

async function loadApplications() {
  const token = localStorage.getItem(SESSION_KEY);
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
      ? `<span class="verify-status ok">✓ Verified</span>`
      : `<span class="verify-status warn">⚠ Manual</span>`;

    const photoHtml = a.idPhoto
      ? `<img class="app-card-photo" src="${a.idPhoto}" alt="ID card photo for ${escapeHtml(a.name)}">`
      : `<div class="app-card-photo app-card-photo-missing">No photo</div>`;

    const datesLabel = a.dateFromBS && a.dateToBS
      ? `${escapeHtml(a.dateFromBS)} &rarr; ${escapeHtml(a.dateToBS)}`
      : `${formatDate(a.dateFrom)} &rarr; ${formatDate(a.dateTo)}`;

    const durationLabel = leaveDurationLabel(a.dateFrom, a.dateTo);

    // Compact summary row only — full details live in the tap-through sheet.
    card.innerHTML = `
      ${photoHtml}
      <div class="app-card-info">
        <div class="app-card-top">
          <span class="app-card-name">${escapeHtml(a.name)}</span>
          ${statusBadge}
        </div>
        <div class="app-card-meta">Roll ${escapeHtml(a.roll)} &middot; ${escapeHtml(a.className)}-${escapeHtml(a.section)}</div>
        <div class="app-card-dates">${datesLabel}${durationLabel ? ` <span class="app-card-duration">${durationLabel}</span>` : ""}</div>
      </div>
      <span class="app-card-chevron">&rsaquo;</span>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".app-card-photo")) return; // photo has its own lightbox handler
      openDetail(a);
    });

    el.appList.appendChild(card);
  });
}

function openDetail(a) {
  const statusBadge = a.verified
    ? `<span class="verify-status ok">✓ Verified from ID</span>`
    : `<span class="verify-status warn">⚠ Manually entered</span>`;

  const photoHtml = a.idPhoto
    ? `<img class="detail-photo" src="${a.idPhoto}" alt="ID card photo for ${escapeHtml(a.name)}">`
    : `<div class="detail-photo detail-photo-missing">No photo attached</div>`;

  const datesLabel = a.dateFromBS && a.dateToBS
    ? `${escapeHtml(a.dateFromBS)} &rarr; ${escapeHtml(a.dateToBS)}`
    : `${formatDate(a.dateFrom)} &rarr; ${formatDate(a.dateTo)}`;

  const durationLabel = leaveDurationLabel(a.dateFrom, a.dateTo);

  el.detailContent.innerHTML = `
    ${photoHtml}
    <div class="detail-name-row">
      <h2 class="detail-name">${escapeHtml(a.name)}</h2>
      ${statusBadge}
    </div>
    <div class="detail-meta">Roll ${escapeHtml(a.roll)} &middot; Class ${escapeHtml(a.className)}-${escapeHtml(a.section)}</div>

    <div class="detail-row">
      <span class="detail-label">Leave dates</span>
      <span class="detail-value">${datesLabel}${durationLabel ? ` (${durationLabel})` : ""}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Reason</span>
      <span class="detail-value">${escapeHtml(a.reasonType)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Details</span>
      <span class="detail-value">${escapeHtml(a.reasonDetails)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Guardian contact</span>
      <span class="detail-value">${escapeHtml(a.guardianContact)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Submitted</span>
      <span class="detail-value">${a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}</span>
    </div>
  `;

  el.detailModal.classList.add("open");
}

function closeDetail() {
  el.detailModal.classList.remove("open");
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
el.detailClose.addEventListener("click", closeDetail);
el.detailModal.addEventListener("click", (e) => {
  if (e.target === el.detailModal) closeDetail();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLightbox();
    closeDetail();
  }
});

el.loginBtn.addEventListener("click", login);
el.passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
el.logoutBtn.addEventListener("click", logout);
el.refreshBtn.addEventListener("click", loadApplications);

if (localStorage.getItem(SESSION_KEY)) {
  showDashboard();
} else {
  showLogin();
}