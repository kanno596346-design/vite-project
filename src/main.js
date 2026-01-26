// ===============================
// MIXTABLE / poker  main.js
// RESULT枠をTABLEの下に追加し、Showdown後に表示する完全版
// ===============================

// --- helper ---
const $ = (id) => document.getElementById(id);

// --- LOG ---
let LOG = [];
function logLine(msg) {
  const s = String(msg);
  LOG.push(s);
  if (LOG.length > 800) LOG.shift();
  const el = $("logBox");
  if (el) el.textContent = LOG.join("\n");
  console.log(s);
}
function clearLog() {
  LOG = [];
  const el = $("logBox");
  if (el) el.textContent = "";
}

// --- STATE ---
let state = null;

// ===============================
// UI SHELL
// ===============================
function ensureApp() {
  let app = $("app");
  if (!app) {
    app = document.createElement("div");
    app.id = "app";
    document.body.appendChild(app);
  }
  return app;
}

function renderShell() {
  const app = ensureApp();

  // ★ RESULT枠（id="resultBox"）がTABLEの下に必ず存在する
  app.innerHTML = `
  <style>
    :root{color-scheme:dark}
    body{margin:0;background:#0b1220;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto}
    .wrap{max-width:980px;margin:20px auto;padding:0 16px}
    .top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}
    .title{font-weight:900;font-size:18px}
    .badge{font-size:12px;color:#cbd5e1}
    .bar{position:sticky;top:0;background:#020617;border:1px solid #334155;border-radius:14px;padding:10px 12px}
    .row{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
    button{border-radius:12px;border:1px solid #334155;background:#0f172a;color:#e5e7eb;padding:10px 12px;cursor:pointer}
    button:hover{filter:brightness(1.1)}
    .primary{background:#22c55e;border-color:#16a34a;color:#052e16;font-weight:900}
    .warn{background:#fb7185;border-color:#f43f5e;color:#3b0a12;font-weight:900}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .col{display:flex;flex-direction:column;gap:12px}
    .card{background:#0b1220;border:1px solid #334155;border-radius:14px;overflow:hidden}
    .card h3{margin:0;padding:10px 12px;border-bottom:1px solid #334155;font-size:13px;letter-spacing:.04em;color:#cbd5e1}
    .card .body{padding:12px;white-space:pre-wrap}
    pre{margin:0;padding:12px;white-space:pre-wrap;min-height:220px;overflow:auto}
    .kv{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:#cbd5e1}
    .pill{border:1px solid #334155;border-radius:999px;padding:6px 10px;background:#020617}
    #resultBox{min-height:90px}
    @media(max-width:900px){.grid{grid-template-columns:1fr}}
  </style>

  <div class="wrap">
    <div class="bar">
      <div class="top">
        <div class="title">MIXTABLE / poker</div>
        <div class="badge">experimental / free / no guarantees · No real money</div>
      </div>

      <div class="kv">
        <span class="pill">Street: <b id="streetVal">-</b></span>
        <span class="pill">Pot: <b id="potVal">-</b></span>
        <span class="pill">ToAct: <b id="toActVal">-</b></span>
      </div>

      <div class="row">
        <button id="btnStart" class="primary">Start Hand</button>
        <button id="btnCall">Call / Check</button>
        <button id="btnRaise">Min-Raise</button>
        <button id="btnFold" class="warn">Fold</button>
        <button id="btnShow">Showdown</button>
        <button id="btnDump">Dump State</button>
        <button id="btnClear">Clear Log</button>
      </div>
    </div>

    <div class="grid">
      <div class="col">
        <div class="card">
          <h3>TABLE</h3>
          <div id="tableBox" class="body"></div>
        </div>

        <!-- ★ RESULT枠 -->
        <div class="card">
          <h3>RESULT</h3>
          <pre id="resultBox"></pre>
        </div>
      </div>

      <div class="card">
        <h3>LOG</h3>
        <pre id="logBox"></pre>
      </div>
    </div>
  </div>
  `;
}

// ===============================
// RENDER (TABLE / RESULT)
// ===============================
function seatLine(s) {
  const hole = Array.isArray(s.hole) ? s.hole.join(" ") : "(no hole)";
  return `Seat ${s.i} ${s.name} | stack=${s.stack} bet=${s.bet} | inHand=${!!s.inHand} folded=${!!s.folded} | hole=[${hole}]`;
}

function renderState() {
  // pills
  $("streetVal").textContent = state?.street ?? "-";
  $("potVal").textContent = String(state?.pot ?? "-");
  $("toActVal").textContent =
    state?.seats?.[state?.toAct]?.name ?? String(state?.toAct ?? "-");

  // table
  const box = $("tableBox");
  if (!box) return;

  if (!state) {
    box.textContent = "state: (null)\nClick Start Hand";
    return;
  }

  const board = Array.isArray(state.community) && state.community.length
    ? state.community.join(" ")
    : "(none)";

  const lines = [];
  lines.push(`Hand #${state.handNo}`);
  lines.push(`Street: ${state.street}`);
  lines.push(`Board: ${board}`);
  lines.push("");
  lines.push(...state.seats.map(seatLine));
  box.textContent = lines.join("\n");
}

function renderResult() {
  const box = $("resultBox");
  if (!box) return;

  // resultが無ければ空にする（常に存在はする）
  if (!state || !state.lastResult) {
    box.textContent = "";
    return;
  }

  const r = state.lastResult;
  const winners = Array.isArray(r.winners) ? r.winners : [];
  const name = r.name ?? "";
  const payouts = r.payouts ?? {};

  const out = [];
  if (name) out.push(`Hand: ${name}`);
  out.push(`Winners: ${winners.length ? winners.join(", ") : "(none)"}`);
  out.push("");
  out.push("PAYOUT");
  Object.entries(payouts).forEach(([k, v]) => out.push(`${k}: ${v}`));

  box.textContent = out.join("\n");
}

// ===============================
// GAME CORE
// ===============================
function createInitialState() {
  state = {
    handNo: 1,
    street: "idle",
    pot: 0,
    dealer: 0,
    sb: 5,
    bb: 10,
    toAct: 0,
    community: [],
    seats: [
      { i: 0, name: "YOU", stack: 1000, bet: 0, inHand: true, folded: false, hole: null, lastAction: "" },
      { i: 1, name: "BOT", stack: 1000, bet: 0, inHand: true, folded: false, hole: null, lastAction: "" },
    ],
    lastResult: null,
    _deck: null,
  };
}

// --- deck ---
const RANKS = "23456789TJQKA".split("");
const SUITS = "shdc".split("");
function newDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function dealOne(st) {
  st._deck ||= newDeck();
  return st._deck.pop();
}
function burn(st) {
  st._deck ||= newDeck();
  st._deck.pop();
}

// --- betting helpers ---
function resetBets(st) { for (const s of st.seats) s.bet = 0; }
function maxBet(st) { return Math.max(...st.seats.map((s) => s.bet || 0)); }
function toCallFor(st, idx) { return Math.max(0, maxBet(st) - (st.seats[idx].bet || 0)); }
function collectBetsToPot(st) {
  for (const s of st.seats) {
    const b = s.bet || 0;
    if (b > 0) { st.pot += b; s.bet = 0; }
  }
}

// --- start hand ---
function startHand() {
  const st = getState();
  if (!st) return;

  st._deck = newDeck();
  st.community = [];
  st.lastResult = null;
  st.street = "preflop";
  st.pot = 0;

  for (const s of st.seats) {
    s.inHand = true;
    s.folded = false;
    s.bet = 0;
    s.lastAction = "";
    s.hole = [dealOne(st), dealOne(st)];
  }

  // blinds HU
  const sbSeat = st.seats[0];
  const bbSeat = st.seats[1];

  const sbPay = Math.min(st.sb, sbSeat.stack);
  sbSeat.stack -= sbPay;
  sbSeat.bet += sbPay;

  const bbPay = Math.min(st.bb, bbSeat.stack);
  bbSeat.stack -= bbPay;
  bbSeat.bet += bbPay;

  st.toAct = 0;
  logLine("Start Hand: OK");
  exposeToWindow();
}

function actFold() {
  const st = getState();
  const p = st.seats[st.toAct];
  p.folded = true;
  p.inHand = false;
  p.lastAction = "Fold";
  logLine(`Action: Fold (${p.name})`);
  exposeToWindow();
}

function actCallCheck() {
  const st = getState();
  const p = st.seats[st.toAct];
  const need = toCallFor(st, st.toAct);
  const pay = Math.min(need, p.stack);
  p.stack -= pay;
  p.bet += pay;
  p.lastAction = need > 0 ? `Call ${pay}` : "Check";
  logLine(`Action: Call/Check (${p.name})`);
  st.toAct = (st.toAct + 1) % st.seats.length;
  exposeToWindow();
}

function actMinRaise() {
  const st = getState();
  const p = st.seats[st.toAct];

  const mb = maxBet(st);
  const target = mb + st.bb;
  const need = Math.max(0, target - (p.bet || 0));
  const pay = Math.min(need, p.stack);

  p.stack -= pay;
  p.bet += pay;
  p.lastAction = `Raise ${pay}`;
  logLine(`Action: Min-Raise (${p.name})`);

  st.toAct = (st.toAct + 1) % st.seats.length;
  exposeToWindow();
}

function forceShowdown() {
  const st = getState();
  if (!st || st.street === "idle") return;

  // boardを5枚に
  while (st.community.length < 5) {
    if (st.community.length === 0) {
      burn(st);
      st.community.push(dealOne(st), dealOne(st), dealOne(st));
    } else {
      burn(st);
      st.community.push(dealOne(st));
    }
  }

  st.street = "showdown";
  collectBetsToPot(st);

  // 仮：YOU勝ち（payout表示確認用）
  st.lastResult = {
    winners: ["YOU"],
    name: "One Pair",
    payouts: { YOU: st.pot },
  };

  st.seats[0].stack += st.pot;
  st.pot = 0;

  logLine("---- SHOWDOWN ----");
  logLine(`Hand: ${st.lastResult.name}`);
  logLine(`Winners: ${st.lastResult.winners.join(", ")}`);
  logLine("---- PAYOUT ----");
  Object.entries(st.lastResult.payouts).forEach(([k, v]) => logLine(`${k}: ${v}`));

  exposeToWindow();
}

// ===============================
// expose
// ===============================
function getState() { return state; }
function exposeToWindow() {
  window.state = state;
  window.getState = getState;
  window.startHand = startHand;
  window.actFold = actFold;
  window.actCallCheck = actCallCheck;
  window.actMinRaise = actMinRaise;
  window.forceShowdown = forceShowdown;
}

// ===============================
// events
// ===============================
function wireEventsOnce() {
  if (window.__mixtableWired) return;
  window.__mixtableWired = true;

  $("btnStart")?.addEventListener("click", () => { startHand(); render(); });
  $("btnCall")?.addEventListener("click", () => { actCallCheck(); render(); });
  $("btnRaise")?.addEventListener("click", () => { actMinRaise(); render(); });
  $("btnFold")?.addEventListener("click", () => { actFold(); render(); });
  $("btnShow")?.addEventListener("click", () => { forceShowdown(); render(); });

  $("btnDump")?.addEventListener("click", () => {
    console.log("STATE:", getState());
    logLine("Dumped state to console");
    render();
  });

  $("btnClear")?.addEventListener("click", () => { clearLog(); render(); });
}

// ===============================
// render loop
// ===============================
function render() {
  // shellが無いなら作る（resultBoxの存在もここで保証される）
  if (!$("tableBox") || !$("logBox") || !$("resultBox")) {
    renderShell();
    wireEventsOnce();
  }
  renderState();
  renderResult();
}

// ===============================
// boot
// ===============================
window.addEventListener("DOMContentLoaded", () => {
  renderShell();
  createInitialState();
  exposeToWindow();
  wireEventsOnce();
  render();
});
