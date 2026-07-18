const state = {
  photoDataUrl: null,
  stream: null
};

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
  submitBtn: document.getElementById("submitBtn")
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
    runOcr(state.photoDataUrl);
  };
  reader.readAsDataURL(file);
}

async function runOcr(imageDataUrl) {
  els.ocrStatus.hidden = false;
  els.captureBtn.disabled = true;
  els.uploadBtn.disabled = true;

  try {
    const extracted = await runOcrOnImage(imageDataUrl);

    els.stuName.value = extracted.name || "";
    els.stuRoll.value = extracted.roll || "";
    els.stuClass.value = extracted.className || "";
    els.stuSection.value = extracted.section || "";

    els.ocrStatusText.textContent = "Done reading card. Please check the details.";
    setTimeout(() => goToStep(2), 400);
  } catch (err) {
    els.ocrStatusText.textContent = "Couldn't read the card automatically — please retake the photo or fill details manually.";
    setTimeout(() => goToStep(2), 900);
  } finally {
    els.captureBtn.disabled = false;
    els.uploadBtn.disabled = false;
  }
}

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
  els.previewImg.hidden = true;
  els.ocrStatus.hidden = true;
  [els.stuName, els.stuRoll, els.stuClass, els.stuSection].forEach((f) => (f.value = ""));
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
