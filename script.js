function parse() {
  const dpInput = document.getElementById("dp-time");
  const errorMsg = document.getElementById("error-msg");
  const textareaErrorMsg = document.getElementById("textarea-error-msg");
  const textarea = document.getElementById("turn-times");
  const rawDelay = dpInput.value.trim();
  const BOARDING_TIME_MINUTES = 30;

  // Reset errors
  errorMsg.textContent = "";
  textareaErrorMsg.textContent = "";
  dpInput.classList.remove("error");
  textarea.classList.remove("error");

  // Validate delay input
  if (rawDelay === "" || !/^\d+$/.test(rawDelay)) {
    dpInput.classList.add("error");
    errorMsg.textContent = rawDelay === "" ? "Required" : "Must be a number";
    dpInput.focus();
    return;
  }

  // Validate textarea not empty
  if (textarea.value.trim() === "") {
    textarea.classList.add("error");
    textareaErrorMsg.textContent = "Paste turn time data first";
    return;
  }

  const delayMins = parseInt(rawDelay);
  const lines = textarea.value
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

  const result = {};
  for (let line of lines) {
    const match = line.match(/^(.*?)(\d{2}:\d{2})$/);
    if (match) {
      const key = formatKey(match[1].trim());
      result[key] = {
        mins: parseTime(match[2]),
        raw: match[2],
      };
    }
  }

  // Validate required fields are present
  const required = [
    "paxDeboardingStarted",
    "paxBoardingStarted",
    "paxBoardingEnded",
    "pwbSent",
    "doorsClosed",
    "brakesReleased",
  ];
  const missing = required.filter((k) => !result[k]);
  if (missing.length > 0) {
    textarea.classList.add("error");
    textareaErrorMsg.textContent = "Missing events — check data format";
    return;
  }

  const durations = {
    deboarding: {
      mins: result.paxBoardingStarted.mins - result.paxDeboardingStarted.mins,
      from: result.paxDeboardingStarted.raw,
      to: result.paxBoardingStarted.raw,
    },
    boarding: {
      mins: result.paxBoardingEnded.mins - result.paxBoardingStarted.mins,
      from: result.paxBoardingStarted.raw,
      to: result.paxBoardingEnded.raw,
    },
    scanToPWB: {
      mins: result.pwbSent.mins - result.paxBoardingEnded.mins,
      from: result.paxBoardingEnded.raw,
      to: result.pwbSent.raw,
    },
    pwbToDoors: {
      mins: result.doorsClosed.mins - result.pwbSent.mins,
      from: result.pwbSent.raw,
      to: result.doorsClosed.raw,
    },
  };

  const total = Object.values(durations).reduce((a, b) => a + b.mins, 0);

  const actualDeparture = result.brakesReleased.mins;
  const schedDeparture = actualDeparture - delayMins;
  const schedBoarding = schedDeparture - BOARDING_TIME_MINUTES;
  const actualBoarding = result.paxBoardingStarted.mins;

  const combinedBar = document.getElementById("combined-bar");
  const labelsBar = document.getElementById("labels-bar");
  combinedBar.innerHTML = labelsBar.innerHTML = "";

  const labelMap = {
    deboarding: "Deboarding",
    boarding: "Boarding",
    scanToPWB: "LS → PWB",
    pwbToDoors: "PWB → DC",
  };

  for (const [key, data] of Object.entries(durations)) {
    const w = (data.mins / total) * 100;
    const seg = document.createElement("div");
    seg.className = `segment ${key}`;
    seg.style.width = `${w}%`;
    seg.textContent = `${data.mins}m`;
    combinedBar.appendChild(seg);

    const lbl = document.createElement("div");
    lbl.className = "label";
    lbl.style.width = `${w}%`;
    lbl.innerHTML = `${labelMap[key]}<br><span style="opacity:0.5">${data.from}–${data.to}</span>`;
    labelsBar.appendChild(lbl);
  }

  function diffLabel(actualM, schedM) {
    const d = actualM - schedM;
    if (d === 0) return `<span class="diff-ok">On time</span>`;
    const abs = Math.abs(d);
    const cls = abs <= 5 ? "diff-ok" : abs <= 15 ? "diff-warn" : "diff-bad";
    return `<span class="${cls}">${d > 0 ? "+" : "−"}${abs}m</span>`;
  }

  const card = document.getElementById("summary-card");
  card.classList.add("visible");
  document.getElementById("row-departure").innerHTML = `
    <div class="row-type"><span class="row-dot" style="background:var(--marker-departure)"></span>Dep</div>
    <div class="row-sched">${minsToTime(schedDeparture)}</div>
    <div class="row-actual">${minsToTime(actualDeparture)}<div class="row-diff">${diffLabel(actualDeparture, schedDeparture)}</div></div>
  `;
  document.getElementById("row-boarding").innerHTML = `
    <div class="row-type"><span class="row-dot" style="background:var(--marker-boarding)"></span>Boarding</div>
    <div class="row-sched">${minsToTime(schedBoarding)}</div>
    <div class="row-actual">${minsToTime(actualBoarding)}<div class="row-diff">${diffLabel(actualBoarding, schedBoarding)}</div></div>
  `;

  const copyText = `FS ${result.paxBoardingStarted.raw} LS ${result.paxBoardingEnded.raw} PWB ${result.pwbSent.raw}`;
  const copyBtn = document.getElementById("copy-btn");
  copyBtn.classList.add("visible");
  copyBtn.textContent = `Copy  ·  ${copyText}`;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = `Copy  ·  ${copyText}`;
      }, 2000);
    });
  };
}

document.getElementById("boton").addEventListener("click", parse);

document.getElementById("dp-time").addEventListener("keydown", (e) => {
  if (e.key === "Enter") parse();
});

document.getElementById("dp-time").addEventListener("input", function () {
  this.classList.remove("error");
  document.getElementById("error-msg").textContent = "";
});

document.getElementById("turn-times").addEventListener("input", function () {
  this.classList.remove("error");
  document.getElementById("textarea-error-msg").textContent = "";
});

function formatKey(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}

function parseTime(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60) % 24,
    m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
