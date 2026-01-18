// ===============================
// MIXTABLE / poker  (single-file working main.js)
// PART 1/4: UI + logging + safe helpers
// ===============================

// --- small helpers ---
const $ = (id) => document.getElementById(id);

let LOG = [];
function logLine(msg) {
  const s = String(msg);
  LOG.push(s);
  if (LOG.length > 500) LOG.shift();
  const el = $("logBox");
  if (el) el.textContent = LOG.join("\n");
  console.log(s);
}
function clearLog() {
  LOG = [];
  const el = $("logBox");
  if (el) el.textContent = "";
}

// --- state (single source of truth) ---
let state = null;

// --- UI: make sure #app exists and render base layout ---
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
    .card{background:#0b1220;border:1px solid #334155;border-radius:14px;overflow:hidden}
    .card h3{margin:0;padding:10px 12px;border-bottom:1px solid #334155;font-size:13px;letter-spacing:.04em;color:#cbd5e1}
    .card .body{padding:12px;white-space:pre-wrap}
    pre{margin:0;padding:12px;white-space:pre-wrap;min-height:260px;overflow:auto}
    .kv{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12px;color:#cbd5e1}
    .pill{border:1px solid #334155;border-radius:999px;padding:6px 10px;background:#020617}
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
      <div class="card">
        <h3>TABLE</h3>
        <div id="tableBox" class="body"></div>
      </div>
      <div class="card">
        <h3>LOG</h3>
        <pre id="logBox"></pre>
      </div>
    </div>
  </div>
  `;
}

// --- minimal table text (safe even if state is null) ---
function seatLine(s) {
  const hole = Array.isArray(s.hole) ? s.hole.join(" ") : "(no hole)";
  return `Seat ${s.i} ${s.name} | stack=${s.stack} bet=${s.bet} | inHand=${!!s.inHand} folded=${!!s.folded} | hole=[${hole}]`;
}

function renderState() {
  // update pills
  $("streetVal").textContent = state?.street ?? "-";
  $("potVal").textContent = String(state?.pot ?? "-");
  $("toActVal").textContent =
    state?.seats?.[state?.toAct]?.name ?? String(state?.toAct ?? "-");

  // table box
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

// PART2 で「状態作成 + アクション + showdown + window公開」を入れます
// ===============================
// PART 2/4: create state + core actions + expose
// ===============================

// --- create initial test state (必ず動く) ---
function createInitialState() {
  state = {
    handNo: 1,
    street: "idle", // idle / preflop / flop / turn / river / showdown
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
  };
}

// --- simple deck ---
const RANKS = "23456789TJQKA".split("");
const SUITS = "shdc".split(""); // spade/heart/diamond/club
function newDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  // shuffle
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
function resetBets(st) {
  for (const s of st.seats) s.bet = 0;
}
function maxBet(st) {
  return Math.max(...st.seats.map((s) => s.bet || 0));
}
function toCallFor(st, idx) {
  return Math.max(0, maxBet(st) - (st.seats[idx].bet || 0));
}
function collectBetsToPot(st) {
  for (const s of st.seats) {
    const b = s.bet || 0;
    if (b > 0) {
      st.pot += b;
      s.bet = 0;
    }
  }
}

// --- start hand (SB/BB + deal hole) ---
function startHand() {
  const st = getState();
  if (!st) return;

  st._deck = newDeck();
  st.community = [];
  st.lastResult = null;
  st.street = "preflop";
  st.pot = 0;

  // reset seats
  for (const s of st.seats) {
    s.inHand = true;
    s.folded = false;
    s.bet = 0;
    s.lastAction = "";
    s.hole = [dealOne(st), dealOne(st)];
  }

  // blinds: heads-up想定（0=SB, 1=BB）
  const sbSeat = st.seats[0];
  const bbSeat = st.seats[1];

  const sbPay = Math.min(st.sb, sbSeat.stack);
  sbSeat.stack -= sbPay;
  sbSeat.bet += sbPay;
  sbSeat.lastAction = `SB ${sbPay}`;

  const bbPay = Math.min(st.bb, bbSeat.stack);
  bbSeat.stack -= bbPay;
  bbSeat.bet += bbPay;
  bbSeat.lastAction = `BB ${bbPay}`;

  st.toAct = 0; // HUはSBが最初（簡易）
  logLine("Start Hand: OK");
  exposeToWindow();
}

// --- actions ---
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
  const target = mb + st.bb; // min-raise
  const need = Math.max(0, target - (p.bet || 0));
  const pay = Math.min(need, p.stack);

  p.stack -= pay;
  p.bet += pay;
  p.lastAction = `Raise ${pay}`;

  logLine(`Action: Min-Raise (${p.name})`);
  st.toAct = (st.toAct + 1) % st.seats.length;
  exposeToWindow();
}

// --- advance street (very simple) ---
function advanceStreet() {
  const st = getState();
  collectBetsToPot(st);

  if (st.street === "preflop") {
    burn(st);
    st.community.push(dealOne(st), dealOne(st), dealOne(st));
    st.street = "flop";
  } else if (st.street === "flop") {
    burn(st);
    st.community.push(dealOne(st));
    st.street = "turn";
  } else if (st.street === "turn") {
    burn(st);
    st.community.push(dealOne(st));
    st.street = "river";
  } else if (st.street === "river") {
    st.street = "showdown";
  }

  resetBets(st);
  st.toAct = 0;
  logLine(`Advance: ${st.street.toUpperCase()}`);
  exposeToWindow();
}

// --- showdown result store (PART3 で UI表示まで完成させる) ---
function forceShowdown() {
  const st = getState();
  if (!st) return;

  // riverまで無ければ配る
  if (st.street === "idle") return;
  if (st.street !== "showdown") {
    while (st.community.length < 5) {
      if (st.community.length === 0) {
        burn(st); st.community.push(dealOne(st), dealOne(st), dealOne(st));
      } else {
        burn(st); st.community.push(dealOne(st));
      }
    }
    st.street = "showdown";
    collectBetsToPot(st);
  }

  // 仮：YOU勝ちにする（PART3で lastResult→LOG に出す）
  st.lastResult = {
    winners: ["YOU"],
    name: "One Pair",
    payouts: { YOU: st.pot },
  };

  // pot を配当（簡易）
  st.seats[0].stack += st.pot;
  st.pot = 0;

  logLine("---- SHOWDOWN ----");
  exposeToWindow();
}

// --- getter/expose ---
function getState() {
  return state;
}

function exposeToWindow() {
  // 外から確認できるように必ず載せる
  window.state = state;
  window.getState = getState;

  // buttons用
  window.startHand = startHand;
  window.actFold = actFold;
  window.actCallCheck = actCallCheck;
  window.actMinRaise = actMinRaise;
  window.advanceStreet = advanceStreet;
  window.forceShowdown = forceShowdown;
window.getState = getState;

}
