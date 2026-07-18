// Single-box Bikram Sambat date picker, backed by the self-hosted
// nepali-date-converter library (see index.html for the load + unwrap step).

const BS_MONTH_NAMES = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function daysInBsMonth(year, monthIndex) {
  const nextMonthIndex = (monthIndex + 1) % 12;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const first = new NepaliDate(year, monthIndex, 1).toJsDate();
  const nextFirst = new NepaliDate(nextYear, nextMonthIndex, 1).toJsDate();
  return Math.round((nextFirst - first) / 86400000);
}

function bsDateToAdIso(year, monthIndex, day) {
  const jsDate = new NepaliDate(year, monthIndex, day).toJsDate();
  const y = jsDate.getFullYear();
  const m = String(jsDate.getMonth() + 1).padStart(2, "0");
  const d = String(jsDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bsDateLabel(year, monthIndex, day) {
  return `${day} ${BS_MONTH_NAMES[monthIndex]} ${year}`;
}

const bsPickerState = {};

function initBsDatePicker(prefix) {
  const input = document.getElementById(`${prefix}Input`);
  const popover = document.getElementById(`${prefix}Popover`);

  if (typeof NepaliDate === "undefined" || typeof NepaliDate !== "function") {
    console.error("NepaliDate library did not load correctly.");
    input.value = "Calendar unavailable";
    input.disabled = true;
    return false;
  }

  const today = NepaliDate.now();
  const picked = { year: today.getYear(), month: today.getMonth(), day: today.getDate() };
  const view = { year: today.getYear(), month: today.getMonth() };
  bsPickerState[prefix] = picked;

  input.value = bsDateLabel(picked.year, picked.month, picked.day);

  function render() {
    const totalDays = daysInBsMonth(view.year, view.month);
    const firstOfMonthAd = new NepaliDate(view.year, view.month, 1).toJsDate();
    const startWeekday = firstOfMonthAd.getDay(); // 0 = Sunday

    let html = `
      <div class="bs-cal-header">
        <button type="button" class="bs-cal-nav" data-nav="-1">&lsaquo;</button>
        <span class="bs-cal-title">${BS_MONTH_NAMES[view.month]} ${view.year}</span>
        <button type="button" class="bs-cal-nav" data-nav="1">&rsaquo;</button>
      </div>
      <div class="bs-cal-weekdays">${WEEKDAY_LABELS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="bs-cal-grid">
    `;

    for (let i = 0; i < startWeekday; i++) {
      html += `<button type="button" class="bs-day empty" disabled></button>`;
    }

    const todayAd = new Date();
    todayAd.setHours(0, 0, 0, 0);

    for (let d = 1; d <= totalDays; d++) {
      const thisAd = new NepaliDate(view.year, view.month, d).toJsDate();
      const isPast = thisAd < todayAd;
      const isToday = thisAd.getTime() === todayAd.getTime();
      const isSelected = picked.year === view.year && picked.month === view.month && picked.day === d;
      const classes = ["bs-day"];
      if (isToday) classes.push("today");
      if (isSelected) classes.push("selected");
      html += `<button type="button" class="${classes.join(" ")}" data-day="${d}" ${isPast ? "disabled" : ""}>${d}</button>`;
    }

    html += `</div>`;
    popover.innerHTML = html;

    popover.querySelector('[data-nav="-1"]').addEventListener("click", () => {
      view.month -= 1;
      if (view.month < 0) { view.month = 11; view.year -= 1; }
      render();
    });
    popover.querySelector('[data-nav="1"]').addEventListener("click", () => {
      view.month += 1;
      if (view.month > 11) { view.month = 0; view.year += 1; }
      render();
    });
    popover.querySelectorAll(".bs-day[data-day]").forEach((btn) => {
      btn.addEventListener("click", () => {
        picked.year = view.year;
        picked.month = view.month;
        picked.day = Number(btn.dataset.day);
        input.value = bsDateLabel(picked.year, picked.month, picked.day);
        popover.hidden = true;
        input.dispatchEvent(new Event("bsdatechange", { bubbles: true }));
      });
    });
  }

  input.addEventListener("click", () => {
    document.querySelectorAll(".bs-calendar-popover").forEach((p) => {
      if (p !== popover) p.hidden = true;
    });
    view.year = picked.year;
    view.month = picked.month;
    render();
    popover.hidden = !popover.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!popover.hidden && !popover.contains(e.target) && e.target !== input) {
      popover.hidden = true;
    }
  });

  render();
  input.dispatchEvent(new Event("bsdatechange", { bubbles: true }));
  return true;
}

function getSelectedBsDate(prefix) {
  return bsPickerState[prefix];
}