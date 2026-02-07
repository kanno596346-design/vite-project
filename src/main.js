const $ = (id) => document.getElementById(id);

let state = null;
let LOG = [];

// ---------------- LOG ----------------
function logLine(msg) {
  LOG.push(String(msg));
  const el = $("logBox");
  if (el) el.textContent = LOG.join("\n");
}

// ---------------- STATE ----------------
function createInitialState() {
  state = {
    street: "idle",
    pot: 0,
    toAct: 0,
    community: [],
    seats: [
      { name: "YOU", stack: 1000, hole: [] },
      { name: "BOT1", stack: 1000, hole: [] },
      { name: "BOT2", stack: 1000, hole: [] },
      { name: "BOT3", stack: 1000, hole: [] },
    ],
    lastResult: null,
    deck: []
  };
}

// ---------------- CARDS ----------------
const ranks = "23456789TJQKA".split("");
const suits = "shdc".split("");

function newDeck() {
  const d = [];
  for (const r of ranks)
    for (const s of suits)
      d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function deal(st) {
  return st.deck.pop();
}

// ---------------- GAME ----------------
function startHand() {
  state.street = "preflop";
  state.pot = 0;
  state.community = [];
  state.deck = newDeck();
  state.lastResult = null;

  state.seats.forEach(s => {
    s.hole = [deal(state), deal(state)];
  });

  logLine("Start Hand");
  render();
}

function forceShowdown() {
  while (state.community.length < 5) {
    state.community.push(deal(state));
  }

  state.street = "showdown";

  state.lastResult = {
    name: "One Pair",
    winners: ["YOU"],
    payouts: { YOU: 50 }
  };

  logLine("SHOWDOWN");
  render();
}

// ---------------- BOT ----------------
function runBots() {
  for (let i = 1; i < state.seats.length; i++) {
    if (Math.random() < 0.5)
      logLine(`${state.seats[i].name}: Check`);
    else
      logLine(`${state.seats[i].name}: Call`);
  }
}

// ---------------- UI ----------------
function renderShell() {
  document.body.innerHTML = `
  <style>
    body{margin:0;background:#0b1220;color:#e5e7eb;font-family:system-ui}
    .wrap{max-width:1000px;margin:20px auto;padding:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .card{background:#0f172a;border:1px solid #334155;border-radius:16px;padding:14px}
    .btn{padding:8px 12px;margin:4px;border-radius:8px;background:#1f2937;color:white;border:none}
    .cards{display:flex;gap:6px;margin-top:6px}
    .cardImg{
      width:40px;height:56px;
      border-radius:6px;
      background:white;
      color:black;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:bold;
    }
    .resultWin{
      background:#1d4ed8;
      padding:8px;
      border-radius:8px;
      margin-top:8px;
    }
  </style>

  <div class="wrap">
    <button class="btn" onclick="startHand()">Start</button>
    <button class="btn" onclick="forceShowdown()">Showdown</button>

    <div class="grid">
      <div class="card">
        <div>TABLE</div>
        <div id="tableBox"></div>
      </div>

      <div class="card">
        <div>LOG</div>
        <pre id="logBox"></pre>
      </div>
    </div>
  </div>
  `;
}

function renderCard(c) {
  return `<div class="cardImg">${c}</div>`;
}

function renderTable() {
  const box = $("tableBox");
  if (!box) return;

  let html = "";

  state.seats.forEach(s => {
    html += `<div>${s.name} (${s.stack})</div>`;
    html += `<div class="cards">${s.hole.map(renderCard).join("")}</div>`;
  });

  html += `<hr>`;
  html += `<div>Board</div>`;
  html += `<div class="cards">${state.community.map(renderCard).join("")}</div>`;

  if (state.lastResult) {
    html += `
      <div class="card" style="margin-top:12px">
        <div>${state.lastResult.name}</div>
        <div class="resultWin">Winner: ${state.lastResult.winners.join(", ")}</div>
      </div>
    `;
  }

  box.innerHTML = html;
}

function renderLog() {
  const el = $("logBox");
  if (el) el.textContent = LOG.join("\n");
}

function render() {
   renderState();
  renderTable();
  renderResult();
  renderLog();

  // BOTの番なら自動行動
  setTimeout(botAutoAction, 500);
}}

// ---------------- BOOT ----------------
window.startHand = startHand;
window.forceShowdown = forceShowdown;

window.onload = () => {
  renderShell();
  createInitialState();
  render();
};
// -----------------------
// BOT AUTO ACTION
// -----------------------
function botAutoAction() {
  const st = state;
  if (!st) return;

  const seat = st.seats[st.toAct];
  if (!seat) return;

  // BOTの番だけ動く
  if (seat.name !== "BOT") return;

  // ランダム行動
  const r = Math.random();

  if (r < 0.15) {
    actFold();
  } else if (r < 0.75) {
    actCallCheck();
  } else {
    actMinRaise();
  }

  render();
}
