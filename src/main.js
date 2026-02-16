// =======================================
// MIXTABLE poker - single file main.js
// 6人 / ストリート進行 / 簡易ベットラウンド / BOT自動 / RESULTカード
// （ハンド評価は仮：まずUIと進行を壊さずに動かす）
// =======================================

const $ = (id) => document.getElementById(id);

let state = null;
let LOG = [];
let BOT_AUTO = true;
let BOT_TIMER = null;

// ================= LOG =================
function logLine(msg) {
  const s = String(msg);
  LOG.push(s);
  if (LOG.length > 900) LOG.shift();
  const el = $("logBox");
  if (el) el.textContent = LOG.join("\n");
  console.log(s);
}
function clearLog() {
  LOG = [];
  const el = $("logBox");
  if (el) el.textContent = "";
}

// ================= UI =================
function ensureApp() {
  let el = $("app");
  if (!el) {
    el = document.createElement("div");
    el.id = "app";
    document.body.appendChild(el);
  }
  return el;
}

function renderShell() {
  const app = ensureApp();
  app.innerHTML = `
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto}
  .wrap{max-width:1100px;margin:20px auto;padding:16px}
  .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px}
  .card{background:#0f172a;border:1px solid #334155;border-radius:16px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.25)}
  .title{font-weight:900;font-size:13px;margin-bottom:10px;color:#94a3b8;letter-spacing:.05em}
  .row{display:flex;flex-wrap:wrap;gap:8px}
  button{
    padding:9px 12px;border-radius:12px;background:#1e293b;color:#fff;
    border:1px solid #334155;cursor:pointer;font-weight:700
  }
  button:hover{filter:brightness(1.08)}
  .btnStart{background:#22c55e;border-color:#16a34a;color:#052e16}
  .btnFold{background:#ef4444;border-color:#dc2626}
  .btnBotOn{background:#2563eb;border-color:#1d4ed8}
  .btnBotOff{background:#0f172a}
  .muted{color:#94a3b8;font-size:12px}
  pre{margin:0;white-space:pre-wrap;line-height:1.4}
  .pill{display:inline-block;background:#020617;border:1px solid #334155;padding:6px 10px;border-radius:999px;font-size:12px;color:#cbd5e1}

  /* ===== RESULTカード ===== */
  .resultCard{display:flex;flex-direction:column;gap:10px}
  .resultHeader{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
  .resultHand{font-size:18px;font-weight:900;color:#22c55e}
  .winnerBadge{display:inline-block;background:#2563eb;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800}
  .payoutRow{display:flex;justify-content:space-between;background:#1e293b;padding:8px 10px;border-radius:10px;border:1px solid #334155}
  .mini{font-size:12px;color:#cbd5e1}
  .ok{color:#22c55e;font-weight:900}
  .warn{color:#fb7185;font-weight:900}

  @media(max-width:980px){.grid{grid-template-columns:1fr}}
</style>

<div class="wrap">
  <div class="card">
    <div class="title">MIXTABLE / poker</div>
    <div class="row">
      <button id="btnStart" class="btnStart">Start Hand</button>
      <button id="btnCall">Call / Check</button>
      <button id="btnRaise">Min-Raise</button>
      <button id="btnFold" class="btnFold">Fold</button>
      <button id="btnNext">Next Street</button>
      <button id="btnShow">Showdown</button>
      <button id="btnBotOn" class="btnBotOn">BOT Auto ON</button>
      <button id="btnBotOff" class="btnBotOff">BOT Auto OFF</button>
      <button id="btnDump">Dump State</button>
      <button id="btnClear">Clear Log</button>
    </div>

    <div class="muted" style="margin-top:10px">
      experimental / free / no guarantees · No real money
      <span class="pill" style="margin-left:10px">Street: <b id="streetVal">-</b></span>
      <span class="pill">Pot: <b id="potVal">-</b></span>
      <span class="pill">ToAct: <b id="toActVal">-</b></span>
    </div>
  </div>

  <div class="grid" style="margin-top:14px">
    <div class="card">
      <div class="title">TABLE</div>
      <pre id="tableBox">(loading...)</pre>

      <div style="height:12px"></div>

      <div class="title">RESULT</div>
      <div id="resultBox"></div>
    </div>

    <div class="card">
      <div class="title">LOG</div>
      <pre id="logBox"></pre>
    </div>
  </div>
</div>
  `;
}

// ================= STATE =================
function createInitialState() {
  state = {
    handNo: 0,
    street: "idle", // idle / preflop / flop / turn / river / showdown
    pot: 0,
    community: [],
    sb: 5,
    bb: 10,
    toAct: 0,
    dealer: 0,
    lastResult: null,
    _deck: null,
    seats: Array.from({ length: 6 }).map((_, i) => ({
      i,
      name: i === 0 ? "YOU" : `BOT${i}`,
      stack: 1000,
      bet: 0,
      inHand: true,
      folded: false,
      hole: [],
      lastAction: "",
    })),
  };
}

// ================= CARDS =================
const RANKS = "23456789TJQKA".split("");
const SUITS = "shdc".split(""); // spade/heart/diamond/club

function newDeck() {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function deal(st) {
  st._deck ||= newDeck();
  return st._deck.pop();
}
function burn(st) {
  st._deck ||= newDeck();
  st._deck.pop();
}

// ================= HELPERS =================
function aliveSeats(st) {
  return st.seats.filter((s) => s.inHand && !s.folded && s.stack >= 0);
}
function nextActiveIndex(st, fromIdx) {
  const n = st.seats.length;
  for (let k = 1; k <= n; k++) {
    const j = (fromIdx + k) % n;
    const s = st.seats[j];
    if (s.inHand && !s.folded) return j;
  }
  return fromIdx;
}
function resetBets(st) {
  st.seats.forEach((s) => (s.bet = 0));
}
function collectBetsToPot(st) {
  st.seats.forEach((s) => {
    if (s.bet > 0) {
      st.pot += s.bet;
      s.bet = 0;
    }
  });
}
function maxBet(st) {
  return Math.max(...st.seats.map((s) => s.bet || 0));
}
function toCallFor(st, idx) {
  const mb = maxBet(st);
  return Math.max(0, mb - (st.seats[idx].bet || 0));
}

// ================= HAND START =================
function startHand() {
  const st = state;
  st.handNo += 1;
  st.street = "preflop";
  st.community = [];
  st.lastResult = null;
  st.pot = 0;
  st._deck = newDeck();

  // reset seats
  st.seats.forEach((s) => {
    s.inHand = s.stack > 0;
    s.folded = false;
    s.bet = 0;
    s.hole = [];
    s.lastAction = "";
  });

  // deal 2 cards each (for active)
  st.seats.forEach((s) => {
    if (s.inHand) s.hole = [deal(st), deal(st)];
  });

  // dealer moves
  st.dealer = (st.dealer + 1) % st.seats.length;

  // blinds: next after dealer is SB, next is BB (簡易)
  const sbIdx = nextActiveIndex(st, st.dealer);
  const bbIdx = nextActiveIndex(st, sbIdx);

  const sb = st.seats[sbIdx];
  const bb = st.seats[bbIdx];

  const sbPay = Math.min(st.sb, sb.stack);
  sb.stack -= sbPay;
  sb.bet += sbPay;
  sb.lastAction = `SB ${sbPay}`;

  const bbPay = Math.min(st.bb, bb.stack);
  bb.stack -= bbPay;
  bb.bet += bbPay;
  bb.lastAction = `BB ${bbPay}`;

  // first to act = next after BB (preflop)
  st.toAct = nextActiveIndex(st, bbIdx);

  logLine(`Start Hand #${st.handNo} (D=${st.dealer} SB=${sbIdx} BB=${bbIdx})`);
  kickBotIfNeeded();
}

// ================= ACTIONS =================
function actFold() {
  const st = state;
  const p = st.seats[st.toAct];
  if (!p || p.folded || !p.inHand) return;

  p.folded = true;
  p.lastAction = "Fold";
  logLine(`${p.name}: Fold`);

  // if only 1 remains -> showdown immediately
  if (aliveSeats(st).length <= 1) {
    showdownByLastStanding();
    return;
  }

  st.toAct = nextActiveIndex(st, st.toAct);
  kickBotIfNeeded();
}

function actCallCheck() {
  const st = state;
  const p = st.seats[st.toAct];
  if (!p || p.folded || !p.inHand) return;

  const need = toCallFor(st, st.toAct);
  const pay = Math.min(need, p.stack);
  p.stack -= pay;
  p.bet += pay;
  p.lastAction = need > 0 ? `Call ${pay}` : "Check";
  logLine(`${p.name}: ${p.lastAction}`);

  st.toAct = nextActiveIndex(st, st.toAct);
  kickBotIfNeeded();
}

function actMinRaise() {
  const st = state;
  const p = st.seats[st.toAct];
  if (!p || p.folded || !p.inHand) return;

  const mb = maxBet(st);
  const target = mb + st.bb; // min-raise
  const need = Math.max(0, target - (p.bet || 0));
  const pay = Math.min(need, p.stack);

  p.stack -= pay;
  p.bet += pay;
  p.lastAction = `Raise ${pay}`;
  logLine(`${p.name}: ${p.lastAction}`);

  st.toAct = nextActiveIndex(st, st.toAct);
  kickBotIfNeeded();
}

// ================= STREET PROGRESS =================
function nextStreet() {
  const st = state;
  if (st.street === "idle" || st.street === "showdown") {
    logLine("Next Street: (not available)");
    return;
  }

  collectBetsToPot(st);
  resetBets(st);

  if (st.street === "preflop") {
    burn(st);
    st.community.push(deal(st), deal(st), deal(st));
    st.street = "flop";
  } else if (st.street === "flop") {
    burn(st);
    st.community.push(deal(st));
    st.street = "turn";
  } else if (st.street === "turn") {
    burn(st);
    st.community.push(deal(st));
    st.street = "river";
  } else if (st.street === "river") {
    st.street = "showdown";
    forceShowdown(); // river->showdown
    return;
  }

  // first to act = next after dealer (postflop)
  st.toAct = nextActiveIndex(st, st.dealer);
  logLine(`Street: ${st.street.toUpperCase()}`);
  kickBotIfNeeded();
}

function forceShowdown() {
  const st = state;
  if (st.street === "idle") {
    logLine("Showdown: idle");
    return;
  }

  // ensure board 5 cards
  while (st.community.length < 5) {
    if (st.community.length === 0) {
      burn(st);
      st.community.push(deal(st), deal(st), deal(st));
    } else {
      burn(st);
      st.community.push(deal(st));
    }
  }

  st.street = "showdown";
  collectBetsToPot(st);

  // ===== 仮評価：とにかく RESULT と配当UIが出ることを優先 =====
  // 今は "YOU" が生きていれば YOU勝ち、いなければ最初の生存者が勝ち
  const alive = aliveSeats(st);
  const youAlive = alive.find((s) => s.name === "YOU");
  const winner = youAlive ? youAlive : alive[0];

  st.lastResult = {
    name: "One Pair", // 仮
    winners: [winner.name],
    payouts: { [winner.name]: st.pot },
  };

  winner.stack += st.pot;
  st.pot = 0;

  logLine("---- SHOWDOWN ----");
  logLine(`Hand: ${st.lastResult.name}`);
  logLine(`Winners: ${st.lastResult.winners.join(", ")}`);
  logLine("---- PAYOUT ----");
  Object.entries(st.lastResult.payouts).forEach(([k, v]) => logLine(`${k}: ${v}`));
}

function showdownByLastStanding() {
  const st = state;
  collectBetsToPot(st);

  const alive = aliveSeats(st);
  const winner = alive[0];
  st.street = "showdown";
  st.lastResult = {
    name: "Win by Fold",
    winners: [winner?.name ?? "(none)"],
    payouts: winner ? { [winner.name]: st.pot } : {},
  };

  if (winner) winner.stack += st.pot;
  st.pot = 0;

  logLine("---- SHOWDOWN ----");
  logLine(`Hand: ${st.lastResult.name}`);
  logLine(`Winners: ${st.lastResult.winners.join(", ")}`);
  logLine("---- PAYOUT ----");
  Object.entries(st.lastResult.payouts).forEach(([k, v]) => logLine(`${k}: ${v}`));
}

// ================= BOT =================
function setBotAuto(on) {
  BOT_AUTO = !!on;
  logLine(`BOT Auto: ${BOT_AUTO ? "ON" : "OFF"}`);
  if (!BOT_AUTO && BOT_TIMER) {
    clearTimeout(BOT_TIMER);
    BOT_TIMER = null;
  }
  if (BOT_AUTO) kickBotIfNeeded();
}

function kickBotIfNeeded() {
  if (!BOT_AUTO) return;
  if (!state) return;
  const p = state.seats[state.toAct];
  if (!p) return;
  if (p.name === "YOU") return;
  if (state.street === "showdown" || state.street === "idle") return;
  if (p.folded || !p.inHand) {
    state.toAct = nextActiveIndex(state, state.toAct);
    return kickBotIfNeeded();
  }

  if (BOT_TIMER) clearTimeout(BOT_TIMER);
  BOT_TIMER = setTimeout(() => botAction(), 450);
}

function botAction() {
  BOT_TIMER = null;
  const st = state;
  if (!st) return;
  if (st.street === "showdown" || st.street === "idle") return;

  const p = st.seats[st.toAct];
  if (!p || p.name === "YOU" || p.folded || !p.inHand) return;

  // 超簡易：必要額が大きいとfold寄り、そうでなければcall多め
  const need = toCallFor(st, st.toAct);
  const r = Math.random();

  if (need >= 50 && r < 0.35) actFold();
  else if (r < 0.75) actCallCheck();
  else actMinRaise();

  render();
}

// ================= RENDER =================
function renderTable() {
  const box = $("tableBox");
  if (!box) return;

  const st = state;
  if (!st) {
    box.textContent = "(no state)";
    return;
  }

  $("streetVal").textContent = st.street;
  $("potVal").textContent = String(st.pot);
  $("toActVal").textContent = st.seats?.[st.toAct]?.name ?? "-";

  const board = st.community.length ? st.community.join(" ") : "(none)";

  let out = "";
  out += `Hand #${st.handNo}\n`;
  out += `Street: ${st.street}\n`;
  out += `Board: ${board}\n`;
  out += `Pot: ${st.pot}\n`;
  out += `ToAct: ${st.seats?.[st.toAct]?.name ?? "-"}\n\n`;

  st.seats.forEach((s) => {
    const hole = s.hole?.length ? s.hole.join(" ") : "(-- --)";
    const flags = [
      s.inHand ? "IN" : "OUT",
      s.folded ? "FOLDED" : "",
      st.toAct === s.i ? "◀" : "",
    ]
      .filter(Boolean)
      .join(" ");
    out += `Seat ${s.i} ${s.name} | stack=${s.stack} bet=${s.bet} | ${flags}\n`;
    out += `  hole: ${hole}\n`;
    if (s.lastAction) out += `  last: ${s.lastAction}\n`;
  });

  box.textContent = out;
}

function renderResult() {
  const box = $("resultBox");
  if (!box) return;

  if (!state || !state.lastResult) {
    box.innerHTML = `<div class="muted">(no result yet)</div>`;
    return;
  }

  const r = state.lastResult;

  let html = `<div class="resultCard">`;
  html += `<div class="resultHeader">`;
  html += `<div class="resultHand">${escapeHtml(r.name ?? "")}</div>`;
  html += `<div class="winnerBadge">Winner: ${escapeHtml((r.winners || []).join(", "))}</div>`;
  html += `</div>`;

  html += `<div class="mini">PAYOUT</div>`;
  const payouts = r.payouts && typeof r.payouts === "object" ? r.payouts : {};
  const entries = Object.entries(payouts);

  if (entries.length === 0) {
    html += `<div class="muted">(none)</div>`;
  } else {
    for (const [name, amt] of entries) {
      html += `<div class="payoutRow"><span>${escapeHtml(name)}</span><span>${escapeHtml(String(amt))}</span></div>`;
    }
  }

  html += `</div>`;
  box.innerHTML = html;
}

function render() {
  // shellが消えてても復元
  if (!$("tableBox") || !$("logBox") || !$("resultBox")) {
    renderShell();
    wireEventsOnce();
  }
  renderTable();
  renderResult();
}

// XSS避け（念のため）
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ================= EVENTS =================
function wireEventsOnce() {
  if (window.__mixtableWired) return;
  window.__mixtableWired = true;

  $("btnStart")?.addEventListener("click", () => {
    startHand();
    render();
  });

  $("btnCall")?.addEventListener("click", () => {
    actCallCheck();
    render();
  });

  $("btnRaise")?.addEventListener("click", () => {
    actMinRaise();
    render();
  });

  $("btnFold")?.addEventListener("click", () => {
    actFold();
    render();
  });

  $("btnNext")?.addEventListener("click", () => {
    nextStreet();
    render();
  });

  $("btnShow")?.addEventListener("click", () => {
    forceShowdown();
    render();
  });

  $("btnBotOn")?.addEventListener("click", () => {
    setBotAuto(true);
    render();
  });

  $("btnBotOff")?.addEventListener("click", () => {
    setBotAuto(false);
    render();
  });

  $("btnDump")?.addEventListener("click", () => {
    console.log("STATE:", state);
    logLine("Dumped state to console");
    render();
  });

  $("btnClear")?.addEventListener("click", () => {
    clearLog();
    render();
  });
}

// ================= LOCAL DEBUG HELPERS =================
function exposeToWindow() {
  window.state = state;
  window.getState = () => state;
  window.forceShowdown = forceShowdown;
  window.nextStreet = nextStreet;
  window.startHand = startHand;
  window.setBotAuto = setBotAuto;
}

// ================= BOOT =================
window.addEventListener("DOMContentLoaded", () => {
  renderShell();
  createInitialState();
  wireEventsOnce();
  exposeToWindow();
  render();
  logLine("Boot OK. Click Start Hand.");
});
