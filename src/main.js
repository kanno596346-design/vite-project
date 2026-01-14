import {
  createInitialState,
  startHand,
  actCallCheck,
  actMinRaise,
  actFold,
  forceShowdown,
} from "./gameState.js";

import { eval7, compareScore, handName } from "./handEval.js";

// -------------------- state --------------------
let st = createInitialState();

// -------------------- dom helpers --------------------
function $(id) {
  return document.getElementById(id);
}

function setApp(html) {
  const app = document.querySelector("#app");
  if (!app) {
    console.error(`#app が見つかりません。index.html に <div id="app"></div> が必要です`);
    return;
  }
  app.innerHTML = html;
}

function clearLog() {
  const box = $("log");
  if (box) box.textContent = "";
}

function log(msg) {
  const box = $("log");
  if (!box) return;
  box.textContent += msg + "\n";
  box.scrollTop = box.scrollHeight;
}

function fmtCard(c) {
  // "Ah" "7c" みたいな2文字(稀に10は"T")想定
  if (!c) return "-";
  return c;
}

function fmtHole(hole) {
  if (!hole || !hole.length) return "-";
  return hole.map(fmtCard).join(" ");
}

function fmtBoard(comm) {
  if (!comm || !comm.length) return "(none)";
  return comm.map(fmtCard).join(" ");
}

// -------------------- ui / render --------------------
function render() {
  const pot = st.pot ?? 0;
  const street = st.street ?? "idle";
  const toAct = st.toAct ?? 0;

  const seatCards = st.seats
    .map((s, i) => {
      const name = s.name || (i === 0 ? "YOU" : `Seat ${i}`);
      const inHand = s.inHand ? "IN HAND" : "OUT";
      const isToAct = i === toAct && s.inHand && !s.folded;
      const badge = isToAct ? "▶ TO ACT" : "";
      const stack = s.stack ?? 0;
      const bet = s.bet ?? 0;
      const hole = fmtHole(s.hole);

      return `
        <div class="seat ${isToAct ? "toact" : ""}">
          <div class="seatTop">
            <div class="seatName">Seat ${i} ${name} <span class="badge">${badge}</span></div>
            <div class="pill ${s.inHand ? "ok" : "ng"}">${inHand}</div>
          </div>
          <div class="seatRow">
            <div class="kv"><span>stack</span><b>${stack}</b></div>
            <div class="kv"><span>bet</span><b>${bet}</b></div>
            <div class="kv"><span>hole</span><b>${hole}</b></div>
          </div>
        </div>
      `;
    })
    .join("");

  setApp(`
    <div class="wrap">
      <div class="topBar">
        <div class="title">MIXTABLE / ポーカー</div>
        <div class="statusPills">
          <span class="dot"></span>
          <span>実験的 / 無料 / 保証なし</span>
          <span class="chip">Pot: <b>${pot}</b></span>
          <span class="chip">Street: <b>${street}</b></span>
        </div>
      </div>

      <div class="btnRow">
        <button id="btnStart" class="btn primary">Start Hand（ブラインド+配牌）</button>
        <button id="btnCall" class="btn">コール / チェック</button>
        <button id="btnRaise" class="btn">ミン・レイズ</button>
        <button id="btnFold" class="btn danger">フォールド</button>
        <button id="btnShow" class="btn dark">Showdown（役判定+配当）</button>
        <button id="btnDump" class="btn">ダンプ状態</button>
        <button id="btnClear" class="btn">ログ消去</button>
      </div>

      <div class="grid">
        <div class="card">
          <div class="cardTitle">TABLE</div>
          <div class="board">Board: <b>${fmtBoard(st.community)}</b></div>
          <div class="seatList">
            ${seatCards}
          </div>
        </div>

        <div class="card">
          <div class="cardTitle">LOG</div>
          <pre id="log" class="log"></pre>
        </div>
      </div>
    </div>
  `);

  // ---- bind events (renderで作ったDOMに紐付け) ----
  $("btnStart")?.addEventListener("click", doStartHand);
  $("btnCall")?.addEventListener("click", doCallCheck);
  $("btnRaise")?.addEventListener("click", doMinRaise);
  $("btnFold")?.addEventListener("click", doFold);
  $("btnShow")?.addEventListener("click", doShowdown);
  $("btnDump")?.addEventListener("click", doDump);
  $("btnClear")?.addEventListener("click", clearLog);
}

// -------------------- showdown helpers --------------------
function evalBest7(hole2, board5) {
  // eval7 expects iterables: hole + board
  return eval7(hole2, board5);
}

function resolveShowdownWinners(st) {
  const alive = st.seats.filter((s) => s.inHand && !s.folded);
  if (alive.length === 0) return { winners: [], name: "ERROR: no alive", scores: [] };
  if (alive.length === 1) return { winners: [alive[0].i], name: "WIN by fold", scores: [] };

  if (!Array.isArray(st.community) || st.community.length !== 5) {
    return {
      winners: [],
      name: `ERROR: board is ${st.community?.length ?? 0} cards (need 5)`,
      scores: [],
    };
  }

  const scored = alive.map((p) => {
    const hole = p.hole;
    if (!Array.isArray(hole) || hole.length !== 2) {
      return { i: p.i, score: null };
    }
    return { i: p.i, score: evalBest7(hole, st.community) };
  });

  // score null は最後尾へ
  scored.sort((a, b) => {
    if (!a.score && !b.score) return 0;
    if (!a.score) return 1;
    if (!b.score) return -1;
    return compareScore(b.score, a.score); // 降順
  });

  const best = scored[0].score;
  if (!best) return { winners: [], name: "ERROR: score null", scores: scored };

  const winners = scored
    .filter((x) => x.score && compareScore(x.score, best) === 0)
    .map((x) => x.i);

  const name = handName(best);

  return { winners, name, scores: scored };
}

function payout(st, result) {
  // potを勝者で割る（端数は先頭winnerへ）
  const pot = st.pot ?? 0;
  if (!result.winners || result.winners.length === 0) {
    log("PAYOUT: no winners");
    return;
  }
  const share = Math.floor(pot / result.winners.length);
  const rem = pot - share * result.winners.length;

  result.winners.forEach((wi, idx) => {
    const add = share + (idx === 0 ? rem : 0);
    st.seats[wi].stack += add;
  });

  st.pot = 0;
  log(`Winner: Seat ${result.winners.join(", ")} / Hand: ${result.name} / +${share}${rem ? ` (+${rem} remainder)` : ""}`);
  log(`Stacks: ${st.seats.map((s) => `${s.name}:${s.stack}`).join(" / ")}`);
}

// -------------------- handlers --------------------
function doStartHand() {
  clearLog();
  startHand(st);
  log("Start Hand: OK");
  render();
}

function doCallCheck() {
  actCallCheck(st);
  log("Action: Call/Check");
  render();
}

function doMinRaise() {
  actMinRaise(st);
  log("Action: Min-Raise");
  render();
}

function doFold() {
  actFold(st);
  log("Action: Fold");
  render();
}

function doShowdown() {
  // ここが重要：doShowdown が無い問題の解決（ボタンから必ずここに来る）
  forceShowdown(st); // streetをshowdownへ進める（gameState側）
  log("---- SHOWDOWN ----");
  const result = resolveShowdownWinners(st);
  log(`Board: ${fmtBoard(st.community)}`);
  log(`Winners: ${result.winners.join(", ") || "(none)"}`);
  log(`Hand: ${result.name}`);

  log("---- PAYOUT ----");
  payout(st, result);
  render();
}

function doDump() {
  console.log("STATE DUMP:", st);
  log("[dump] state is printed to console");
}

// -------------------- boot --------------------
window.addEventListener("DOMContentLoaded", () => {
  // seatsに i を付けておく（winner判定で使う）
  st.seats.forEach((s, i) => (s.i = i));

  render();

  // 互換のためにwindowにも出しておく（onclick使ってても動く）
  window.doStartHand = doStartHand;
  window.doCallCheck = doCallCheck;
  window.doMinRaise = doMinRaise;
  window.doFold = doFold;
  window.doShowdown = doShowdown;
  window.forceShowdown = doShowdown;
  window.doDump = doDump;
});
