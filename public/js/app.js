const CONFIG = {
  expectedClass: "10",
  expectedSection: "C"
};

const state = {
  photoDataUrl: null,
  thumbnailDataUrl: null,
  stream: null,
  verified: false,
  datesValid: false
};

function createThumbnail(imageSrc, maxWidth = 480) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = imageSrc;
  });
}

const els = {
  panels: {
    welcome: document.getElementById("panel-welcome"),
    form: document.getElementById("panel-form"),
    done: document.getElementById("panel-done")
  },
  continueBtn: document.getElementById("continueBtn"),
  backToWelcomeBtn: document.getElementById("backToWelcome"),
  video: document.getElementById("camera"),
  canvas: document.getElementById("captureCanvas"),
  previewImg: document.getElementById("previewImg"),
  scanFrame: document.getElementById("scanFrame"),
  fileInput: document.getElementById("fileInput"),
  captureBtn: document.getElementById("captureBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  ocrStatus: document.getElementById("ocrStatus"),
  ocrStatusText: document.getElementById("ocrStatusText"),
  verifyBadge: document.getElementById("verifyBadge"),
  identityGrid: document.getElementById("identityGrid"),
  stuName: document.getElementById("stuName"),
  stuRoll: document.getElementById("stuRoll"),
  stuClass: document.getElementById("stuClass"),
  stuSection: document.getElementById("stuSection"),
  dateFromError: document.getElementById("dateFromError"),
  dateToError: document.getElementById("dateToError"),
  submitBtn: document.getElementById("submitBtn")
};

function goToPanel(key) {
  Object.entries(els.panels).forEach(([k, panel]) => {
    panel.classList.toggle("active", k === key);
  });
}

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    els.video.srcObject = state.stream;
    els.video.hidden = false;
    els.previewImg.hidden = true;
  } catch (err) {
    els.captureBtn.disabled = true;
    els.captureBtn.textContent = "Camera unavailable — use upload";
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
}

function captureFrame() {
  const video = els.video;
  const canvas = els.canvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  state.photoDataUrl = canvas.toDataURL("image/jpeg", 0.92);

  els.previewImg.src = state.photoDataUrl;
  els.previewImg.hidden = false;
  els.video.hidden = true;
  stopCamera();

  createThumbnail(state.photoDataUrl).then((thumb) => (state.thumbnailDataUrl = thumb));
  runOcr(state.photoDataUrl);
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.photoDataUrl = reader.result;
    els.previewImg.src = state.photoDataUrl;
    els.previewImg.hidden = false;
    els.video.hidden = true;
    stopCamera();
    createThumbnail(state.photoDataUrl).then((thumb) => (state.thumbnailDataUrl = thumb));
    runOcr(state.photoDataUrl);
  };
  reader.readAsDataURL(file);
}

async function runOcr(imageDataUrl) {
  els.ocrStatus.hidden = false;
  els.captureBtn.disabled = true;
  els.uploadBtn.disabled = true;
  els.identityGrid.hidden = true;
  els.verifyBadge.className = "verify-badge";
  els.verifyBadge.innerHTML = "";

  let extracted = { name: "", roll: "", className: "", section: "" };
  try {
    extracted = await runOcrOnImage(imageDataUrl);
  } catch (err) {
    // fall through with empty fields — handled as unverified below
  } finally {
    els.captureBtn.disabled = false;
    els.uploadBtn.disabled = false;
    els.ocrStatus.hidden = true;
  }

  els.stuName.value = extracted.name || "";
  els.stuRoll.value = extracted.roll || "";
  els.stuClass.value = extracted.className || "";
  els.stuSection.value = extracted.section || "";
  els.identityGrid.hidden = false;

  const allFieldsFound = extracted.name && extracted.roll && extracted.className && extracted.section;
  const classMatches = extracted.className === CONFIG.expectedClass;
  const sectionMatches = extracted.section === CONFIG.expectedSection;
  state.verified = Boolean(allFieldsFound && classMatches && sectionMatches);

  applyVerificationUi(allFieldsFound, classMatches, sectionMatches);
}

function applyVerificationUi(allFieldsFound, classMatches, sectionMatches) {
  if (state.verified) {
    els.verifyBadge.className = "verify-badge ok";
    els.verifyBadge.innerHTML = "✓ Read automatically from your ID card.";
  } else {
    els.verifyBadge.className = "verify-badge warn";
    if (!allFieldsFound) {
      els.verifyBadge.innerHTML = "⚠ Couldn't clearly read your ID card. Rescan with better lighting, hold the card flat, and fill the frame.";
    } else if (!classMatches || !sectionMatches) {
      els.verifyBadge.innerHTML = `⚠ This card doesn't show Class ${CONFIG.expectedClass}, Section ${CONFIG.expectedSection} — this form is only for that class. Rescan if this is a misread.`;
    }
  }
  updateSubmitAvailability();
}

function todayAdStartOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function validateDates() {
  const today = todayAdStartOfDay();

  const from = getSelectedBsDate("dateFrom");
  const to = getSelectedBsDate("dateTo");
  const fromAd = new Date(bsDateToAdIso(from.year, from.month, from.day));
  const toAd = new Date(bsDateToAdIso(to.year, to.month, to.day));

  els.dateFromError.hidden = true;
  els.dateToError.hidden = true;
  let valid = true;

  if (fromAd < today) {
    els.dateFromError.textContent = "This date has already passed. Please choose today or a future date.";
    els.dateFromError.hidden = false;
    valid = false;
  }

  if (toAd < today) {
    els.dateToError.textContent = "This date has already passed. Please choose today or a future date.";
    els.dateToError.hidden = false;
    valid = false;
  } else if (toAd < fromAd) {
    els.dateToError.textContent = "\"Leave to\" can't be before \"Leave from\".";
    els.dateToError.hidden = false;
    valid = false;
  }

  state.datesValid = valid;
  updateSubmitAvailability();
}

document.addEventListener("bsdatechange", validateDates);

function updateSubmitAvailability() {
  els.submitBtn.disabled = !(state.verified && state.datesValid);
}

async function submitApplication() {
  if (!state.verified) {
    alert("Your ID card couldn't be verified. Please scan it before submitting.");
    return;
  }
  if (!state.datesValid) {
    alert("Please choose valid leave dates (today or a future date) before submitting.");
    return;
  }

  const from = getSelectedBsDate("dateFrom");
  const to = getSelectedBsDate("dateTo");

  const payload = {
    name: els.stuName.value.trim(),
    roll: els.stuRoll.value.trim(),
    className: els.stuClass.value.trim(),
    section: els.stuSection.value.trim(),
    dateFrom: bsDateToAdIso(from.year, from.month, from.day),
    dateTo: bsDateToAdIso(to.year, to.month, to.day),
    dateFromBS: bsDateLabel(from.year, from.month, from.day),
    dateToBS: bsDateLabel(to.year, to.month, to.day),
    reasonType: document.getElementById("reasonType").value,
    reasonDetails: document.getElementById("reasonDetails").value.trim(),
    guardianContact: document.getElementById("guardianContact").value.trim(),
    verified: state.verified,
    idPhoto: state.thumbnailDataUrl || null,
    submittedAt: new Date().toISOString()
  };

  const required = ["name", "roll", "className", "section", "dateFrom", "dateTo", "reasonType", "reasonDetails", "guardianContact"];
  const missing = required.filter((k) => !payload[k]);
  if (missing.length) {
    alert("Please fill in every field before sending.");
    return;
  }

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Sending…";

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Request failed");
    stopCamera();
    goToPanel("done");
  } catch (err) {
    alert("Couldn't send the application. Please check your connection and try again.");
  } finally {
    els.submitBtn.disabled = !(state.verified && state.datesValid);
    els.submitBtn.textContent = "Send application";
  }
}

function resetWizard() {
  state.photoDataUrl = null;
  state.thumbnailDataUrl = null;
  state.verified = false;

  els.previewImg.hidden = true;
  els.ocrStatus.hidden = true;
  els.identityGrid.hidden = true;
  els.verifyBadge.className = "verify-badge";
  els.verifyBadge.innerHTML = "";

  [els.stuName, els.stuRoll, els.stuClass, els.stuSection].forEach((f) => (f.value = ""));
  populateBsDateSelects("dateFrom");
  populateBsDateSelects("dateTo");
  els.dateFromError.hidden = true;
  els.dateToError.hidden = true;
  state.datesValid = true;
  document.getElementById("reasonType").value = "";
  document.getElementById("reasonDetails").value = "";
  document.getElementById("guardianContact").value = "";

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Send application";

  goToPanel("welcome");
}

els.continueBtn.addEventListener("click", () => {
  goToPanel("form");
  startCamera();
});
els.backToWelcomeBtn.addEventListener("click", () => {
  stopCamera();
  goToPanel("welcome");
});
els.captureBtn.addEventListener("click", captureFrame);
els.uploadBtn.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", handleFileUpload);
els.submitBtn.addEventListener("click", submitApplication);
document.getElementById("restartBtn").addEventListener("click", resetWizard);

populateBsDateSelects("dateFrom");
populateBsDateSelects("dateTo");
state.datesValid = true;