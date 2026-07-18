const CONFIG = {
  expectedClass: "10",
  expectedSection: "C"
};

const state = {
  photoDataUrl: null,
  thumbnailDataUrl: null,
  stream: null,
  verified: false
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
    1: document.getElementById("panel-1"),
    2: document.getElementById("panel-2"),
    3: document.getElementById("panel-3"),
    done: document.getElementById("panel-done")
  },
  steps: document.querySelectorAll(".step"),
  video: document.getElementById("camera"),
  canvas: document.getElementById("captureCanvas"),
  previewImg: document.getElementById("previewImg"),
  scanFrame: document.getElementById("scanFrame"),
  fileInput: document.getElementById("fileInput"),
  captureBtn: document.getElementById("captureBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  ocrStatus: document.getElementById("ocrStatus"),
  ocrStatusText: document.getElementById("ocrStatusText"),
  stuName: document.getElementById("stuName"),
  stuRoll: document.getElementById("stuRoll"),
  stuClass: document.getElementById("stuClass"),
  stuSection: document.getElementById("stuSection"),
  applicantChip: document.getElementById("applicantChip"),
  submitBtn: document.getElementById("submitBtn"),
  verifyBadge: document.getElementById("verifyBadge"),
  manualConfirmRow: document.getElementById("manualConfirmRow"),
  manualConfirmCheckbox: document.getElementById("manualConfirmCheckbox"),
  toStep3Btn: document.getElementById("toStep3")
};

function goToStep(stepKey) {
  Object.entries(els.panels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === String(stepKey));
  });
  els.steps.forEach((stepEl) => {
    const n = Number(stepEl.dataset.step);
    stepEl.classList.remove("active", "done");
    if (n === stepKey) stepEl.classList.add("active");
    else if (n < stepKey) stepEl.classList.add("done");
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
    // No camera access (desktop, permissions denied) — fall back to upload only.
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

  let extracted = { name: "", roll: "", className: "", section: "" };
  try {
    extracted = await runOcrOnImage(imageDataUrl);
  } catch (err) {
    // fall through with empty fields — handled as unverified below
  } finally {
    els.captureBtn.disabled = false;
    els.uploadBtn.disabled = false;
  }

  els.stuName.value = extracted.name || "";
  els.stuRoll.value = extracted.roll || "";
  els.stuClass.value = extracted.className || "";
  els.stuSection.value = extracted.section || "";

  const allFieldsFound = extracted.name && extracted.roll && extracted.className && extracted.section;
  const classMatches = extracted.className === CONFIG.expectedClass;
  const sectionMatches = extracted.section === CONFIG.expectedSection;
  state.verified = Boolean(allFieldsFound && classMatches && sectionMatches);

  applyVerificationUi(extracted, allFieldsFound, classMatches, sectionMatches);

  els.ocrStatusText.textContent = state.verified
    ? "Card read successfully."
    : "Couldn't fully verify the card — check the details below.";
  setTimeout(() => goToStep(2), state.verified ? 400 : 700);
}

function applyVerificationUi(extracted, allFieldsFound, classMatches, sectionMatches) {
  const fields = [els.stuName, els.stuRoll, els.stuClass, els.stuSection];

  if (state.verified) {
    fields.forEach((f) => (f.readOnly = true));
    els.verifyBadge.className = "verify-badge ok";
    els.verifyBadge.innerHTML = "✓ Read automatically from your ID card. These fields are locked — rescan if something looks wrong.";
    els.manualConfirmRow.hidden = true;
    els.manualConfirmCheckbox.checked = false;
    els.toStep3Btn.disabled = false;
  } else {
    fields.forEach((f) => (f.readOnly = false));
    els.verifyBadge.className = "verify-badge warn";
    if (!allFieldsFound) {
      els.verifyBadge.innerHTML = "⚠ Couldn't read some details from the card. Fill them in carefully — this application will be marked as manually entered.";
    } else if (!classMatches || !sectionMatches) {
      els.verifyBadge.innerHTML = `⚠ This card doesn't show Class ${CONFIG.expectedClass}, Section ${CONFIG.expectedSection}. Double-check the fields, or rescan — this application will be marked as manually entered.`;
    }
    els.manualConfirmRow.hidden = false;
    els.manualConfirmCheckbox.checked = false;
    els.toStep3Btn.disabled = true;
  }
}

els.manualConfirmCheckbox?.addEventListener("change", () => {
  els.toStep3Btn.disabled = !els.manualConfirmCheckbox.checked;
});

function updateApplicantChip() {
  const name = els.stuName.value.trim() || "—";
  const roll = els.stuRoll.value.trim() || "—";
  const cls = els.stuClass.value.trim() || "—";
  const sec = els.stuSection.value.trim() || "—";
  els.applicantChip.textContent = `${name} · Class ${cls}-${sec} · Roll ${roll}`;
}

async function submitApplication() {
  const payload = {
    name: els.stuName.value.trim(),
    roll: els.stuRoll.value.trim(),
    className: els.stuClass.value.trim(),
    section: els.stuSection.value.trim(),
    dateFrom: document.getElementById("dateFrom").value,
    dateTo: document.getElementById("dateTo").value,
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
    goToStep("done");
  } catch (err) {
    alert("Couldn't send the application. Please check your connection and try again.");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Send application";
  }
}

function resetWizard() {
  state.photoDataUrl = null;
  state.thumbnailDataUrl = null;
  state.verified = false;
  els.previewImg.hidden = true;
  els.ocrStatus.hidden = true;
  els.verifyBadge.className = "verify-badge";
  els.verifyBadge.innerHTML = "";
  els.manualConfirmRow.hidden = true;
  [els.stuName, els.stuRoll, els.stuClass, els.stuSection].forEach((f) => {
    f.value = "";
    f.readOnly = false;
  });
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  document.getElementById("reasonType").value = "";
  document.getElementById("reasonDetails").value = "";
  document.getElementById("guardianContact").value = "";
  goToStep(1);
  startCamera();
}

els.captureBtn.addEventListener("click", captureFrame);
els.uploadBtn.addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", handleFileUpload);
document.getElementById("backTo1").addEventListener("click", () => {
  goToStep(1);
  startCamera();
});
document.getElementById("toStep3").addEventListener("click", () => {
  updateApplicantChip();
  goToStep(3);
});
document.getElementById("backTo2").addEventListener("click", () => goToStep(2));
els.submitBtn.addEventListener("click", submitApplication);
document.getElementById("restartBtn").addEventListener("click", resetWizard);

startCamera();