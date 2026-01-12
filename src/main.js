// src/main.js
import "./style.css";

import { eval7, compareScore, handName } from "./handEval.js";
import {
  createInitialState,
  exposeToWindow,
  getState,
  startHand,
  actFold,
  actCallCheck,
  actMinRaise,
  forceShowdown,
} from "./gameState.js";

// -------- UI helpers --------
function setApp(html) {
  const app = document.querySelector("#app");
  if (!app) {
    console.error("#app が見つかりません。index.html に <div id='app'></div> が必要です");
    return;
  }
  app.innerHTML = html;
}
function $(id) {
  return document.getElementById(id);
}
function clearLog() {
  const el = $("log");
  if (el) el.textContent = "";
}
function log(msg) {
  const el = $("log");
  if (el) el.textContent += msg + "\n";
  console.log(msg);
}
function pretty(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

// -------- render --------
function seatLine(s) {
  const hole = Array.isArray(s.hole) ? s.hole.join(" ") : "(none)";
  const last = s.lastAction ?? "";
  return `Seat ${s.i} ${s.name} | stack=${s.stack} | bet=${s.bet} | inHand=${s.inHand} folded=${s.folded} | last=${last} | hole=[${hole}]`;
}

function render() {
   const st = getState() || {};
  const seats = st.seats || [];
  const street = st.street ?? "idle";
  const pot = st.pot ?? 0;
  const board = Array.isArray(st.community) ? st.community.join(" ") : "(none)";
  const toAct = st.toAct ?? 0;

  const you = seats[0] || {};
  const bot = seats[1] || {};

  const seatCard = (s, label, isYou) => {
    const stack = s.stack ?? 0;
    const bet = s.bet ?? 0;
    const folded = !!s.folded;
    const inHand = !!s.inHand;
    const hole = Array.isArray(s.hole) ? s.hole.join(" ") : "";
    const status = folded ? "FOLDED" : (inHand ? "IN HAND" : "OUT");
    const pillClass = folded ? "warn" : "ok";
    const act = (toAct === s.i) ? " ▶ TO ACT" : "";

    return `
      <div class="mx-card">
        <div class="row">
          <div class="name">${label}${isYou ? " (YOU)" : ""}${act}</div>
          <div class="mx-pill ${pillClass}">${status}</div>
        </div>
        <div class="row" style="margin-top:6px">
          <div>stack: <b style="color:var(--text)">${stack}</b></div>
          <div>bet: <b style="color:var(--text)">${bet}</b></div>
          <div>hole: <b style="color:var(--text)">${hole || "-"}</b></div>
        </div>
      </div>
    `;
  };

  const cardsHtml = seats.map(s => seatCard(s, `Seat ${s.i ?? "?"}`, (s.i === 0))).join("");

  setApp(`
    <div class="mx-wrap">
      <div class="mx-topbar">
        <div class="mx-brand">MIXTABLE / ポーカー</div>
        <div class="mx-badges">
          <span class="mx-badge"><span class="mx-dot"></span> 実験的 / 無料 / 保証なし</span>
          <span class="mx-badge">Pot: <b style="color:var(--text)">${pot}</b></span>
          <span class="mx-badge">Street: <b style="color:var(--text)">${street}</b></span>
        </div>
      </div>

      <div class="mx-controls">
        <button id="btnStart" class="mx-btn primary">Start Hand（ブラインド+配牌）</button>
        <button id="btnCall" class="mx-btn">コール / チェック</button>
        <button id="btnRaise" class="mx-btn">ミン・レイズ</button>
        <button id="btnFold" class="mx-btn danger">フォールド</button>
        <button id="btnShow" class="mx-btn">Showdown（役判定+配当）</button>
        <button id="btnDump" class="mx-btn">ダンプ状態</button>
        <button id="btnClear" class="mx-btn">ログ消去</button>
      </div>

      <div class="mx-table">
        <div class="mx-felt"></div>
        <div class="mx-grid">
          <div class="mx-panel">
            <h3>TABLE</h3>
            <div class="mx-note">Board: <b style="color:var(--text)">${board}</b></div>
            <div class="mx-cards" style="margin-top:10px">
              ${cardsHtml}
            </div>
          </div>

          <div class="mx-panel">
            <h3>LOG</h3>
            <pre class="mx-pre" id="log"></pre>
          </div>
        </div>
      </div>
    </div>
  `);

  // （既存のイベント付け直しはあなたの main.js に既にある想定）

}


// -------- showdown (eval7) + payout --------
function evalBest7(hole2, board5) {
  // eval7 expects iterables: holeCards + boardCards
  return eval7(hole2, board5);
}

function resolveShowdownWinners(st) {
  const alive = st.seats.filter((s) => s.inHand && !s.folded);
  if (alive.length === 0) {
    return { winners: [], name: "ERROR: no alive", scores: [] };
  }
  if (alive.length === 1) {
    return { winners: [alive[0].i], name: "WIN by fold", scores: [] };
  }

  // board must be 5
  if (!Array.isArray(st.community) || st.community.length !== 5) {
    return { winners: [], name: `ERROR: board is ${st.community?.length ?? 0} cards (need 5)`, scores: [] };
  }

  const scored = alive.map((p) => {
    const hole = p.hole;
    if (!Array.isArray(hole) || hole.length !== 2) {
      return { i: p.i, score: null };
    }
    return { i: p.i, score: evalBest7(hole, st.community) };
  });

  if (scored.some((x) => x.score == null)) {
    return { winners: [], name: "ERROR: missing hole", scores: scored };
  }

  // find best using compareScore
  let best = scored[0];
  for (const x of scored.slice(1)) {
    if (compareScore(x.score, best.score) > 0) best = x;
  }

  const winners = scored
    .filter((x) => compareScore(x.score, best.score) === 0)
    .map((x) => x.i);

  return { winners, name: handName(best.score), scores: scored };
}

function payout(st, result) {
  if (!result.winners || result.winners.length === 0) {
    log(`PAYOUT: ${result.name}`);
    return;
  }
  const pot = st.pot || 0;
  const share = Math.floor(pot / result.winners.length);
  for (const wi of result.winners) {
    st.seats[wi].stack += share;
  }
  st.pot = 0;

  // 余りチップ（1枚単位）を先頭winnerへ
  const rem = pot - share * result.winners.length;
  if (rem > 0) st.seats[result.winners[0]].stack += rem;

  log(`Winner: Seat ${result.winners.join(", ")} / Hand: ${result.name} / +${share}${rem ? ` (+${rem} remainder)` : ""}`);
  log(`Stacks: ${st.seats.map((s) => `${s.name}:${s.stack}`).join(" / ")}`);
}

// -------- handlers --------
function doStartHand() {
  clearLog();
  //startHand();
  exposeToWindow();
  log("Start Hand: OK");
  render();
}

function doCallCheck() {
  actCallCheck();
  exposeToWindow();
  log("Action: Call/Check");
  render();
}

function doMinRaise() {
  actMinRaise();
  exposeToWindow();
  log("Action: Min-Raise");
  render();
}

function doFold() {
  actFold();
  exposeToWindow();
  log("Action: Fold");
  render();
}

function doShowdownAndPayout() {
  const st = getState();
  if (!st) return;

  // 5枚ボードに揃える（フロップで押してもOKにする）
  forceShowdown();

  const st2 = getState();
  log("---- SHOWDOWN ----");
  log(`Board: ${st2.community.join(" ")}`);
  for (const s of st2.seats) log(seatLine(s));

  const result = resolveShowdownWinners(st2);
  log(`Hand: ${result.name}`);
  log(`Winners: ${result.winners.join(", ")}`);

  log("");
  log("---- PAYOUT ----");
  payout(st2, result);

  exposeToWindow();
  render();
}

function dumpState() {
  const st = getState();
  log("---- STATE DUMP ----");
  log(pretty(st));
}

// -------- mount UI --------
setApp(`
  <div style="max-width:1100px;margin:30px auto;padding:0 20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="background:#111;color:#fff;padding:14px 18px;border-radius:12px;font-weight:700;">
      実験的 / 無料 / 保証なし - No real money
      <span id="conn" style="margin-left:14px;color:#7CFC00;">(checking...)</span>
    </div>

    <h1 style="margin:22px 0 10px;font-size:40px;">MIXTABLE / ポーカー</h1>
    <div style="margin-bottom:12px;color:#333;">本体 state を使って、進行 + 役判定(eval7) + 配当まで動作確認します。</div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0;">
      <button id="btnStart">Start Hand(ブラインド+配牌)</button>
      <button id="btnCall">コール/チェック</button>
      <button id="btnRaise">ミン・レイズ</button>
      <button id="btnFold">フォールド</button>
      <button id="btnShow">Showdown(役判定+配当)</button>
      <button id="btnDump">ダンプ状態</button>
      <button id="btnClear">ログ消去</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">
      <pre id="statusBox" style="background:#f5f5f5;padding:14px;border-radius:12px;min-height:260px;white-space:pre-wrap;"></pre>
      <pre id="log" style="background:#0b0f14;color:#e8f0ff;padding:14px;border-radius:12px;min-height:260px;white-space:pre-wrap;"></pre>
    </div>

    <style>
      button{
        padding:10px 14px;border-radius:10px;border:1px solid #222;background:#fff;cursor:pointer;
      }
      button:hover{background:#f1f1f1;}
    </style>
  </div>
`);

$("btnStart")?.addEventListener("click", doStartHand);
$("btnCall")?.addEventListener("click", doCallCheck);
$("btnRaise")?.addEventListener("click", doMinRaise);
$("btnFold")?.addEventListener("click", doFold);
$("btnShow")?.addEventListener("click", doShowdownAndPayout);
$("btnDump")?.addEventListener("click", dumpState);
$("btnClear")?.addEventListener("click", () => {
  clearLog();
  render();
});

// 初期化（window.state作成）
if (location.pathname.startsWith("/poker")) {
  console.log("Poker mode detected");
  createInitialState();
  render();
} else {
  console.log("Landing page mode");
}
