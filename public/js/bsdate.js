// Uses the global `NepaliDate` class from nepali-date-converter (loaded via CDN)
// to power a plain year/month/day select picker for the Bikram Sambat calendar,
// since browsers only support Gregorian dates in native <input type="date">.

const BS_MONTH_NAMES = [
  "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

// Works out how many days are in a given BS month by converting the 1st of
// that month and the 1st of the next month to AD, and measuring the gap —
// avoids needing to hardcode a Nepali calendar data table ourselves.
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

function populateBsDateSelects(prefix) {
  const yearSel = document.getElementById(`${prefix}Year`);
  const monthSel = document.getElementById(`${prefix}Month`);
  const daySel = document.getElementById(`${prefix}Day`);

  const today = NepaliDate.now();
  const currentYear = today.getYear();

  yearSel.innerHTML = "";
  [currentYear, currentYear + 1].forEach((y) => {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSel.appendChild(opt);
  });

  monthSel.innerHTML = "";
  BS_MONTH_NAMES.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = name;
    monthSel.appendChild(opt);
  });

  function refreshDays(preserveDay) {
    const y = Number(yearSel.value);
    const m = Number(monthSel.value);
    const total = daysInBsMonth(y, m);
    const prevValue = preserveDay ? Number(daySel.value) || 1 : 1;
    daySel.innerHTML = "";
    for (let d = 1; d <= total; d++) {
      const opt = document.createElement("option");
      opt.value = String(d);
      opt.textContent = String(d);
      daySel.appendChild(opt);
    }
    daySel.value = String(Math.min(prevValue, total));
  }

  yearSel.addEventListener("change", () => {
    refreshDays(true);
    yearSel.dispatchEvent(new Event("bsdatechange", { bubbles: true }));
  });
  monthSel.addEventListener("change", () => {
    refreshDays(true);
    monthSel.dispatchEvent(new Event("bsdatechange", { bubbles: true }));
  });
  daySel.addEventListener("change", () => {
    daySel.dispatchEvent(new Event("bsdatechange", { bubbles: true }));
  });

  yearSel.value = String(today.getYear());
  monthSel.value = String(today.getMonth());
  refreshDays(false);
  daySel.value = String(today.getDate());
}

function getSelectedBsDate(prefix) {
  return {
    year: Number(document.getElementById(`${prefix}Year`).value),
    month: Number(document.getElementById(`${prefix}Month`).value),
    day: Number(document.getElementById(`${prefix}Day`).value)
  };
}
