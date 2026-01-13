// src/main.js
import "./style.css";
import { eval7, compareScore, handName } from "./handEval.js";
import {
  createInitialState,
  exposeToWindow,
  getState,
  startHand,
  actCallCheck,
  actFold,
  actMinRaise,
  forceShowdown,
} from "./gameState.js";

/** ========== small helpers ========== */
const $ = (id) => document.getElementById(id);

function setApp(html) {
  const app = document.querySelector("#app");
  if (!app) {
    console.error('#app が見つかりません。index.html に <div id="app"></div> が必要です');
    return;
  }
  app.innerHTML = html;
}

const logs = [];
function log(line) {
  logs.push(String(line));
  // ログが無限に増えないように
  if (logs.length > 300) logs.splice(0, logs.length - 300);
}
function clearLog() {
  logs.length = 0;
}

/** ========== poker helpers ========== */
function fmtCard(c) {
  // c が {r:'A', s:'h'} の想定 / 文字列ならそのまま
  if (!c) return "-";
  if (typeof c === "string") return c;
  const r = c.r ?? c.rank ?? "?";
  const s = c.s ?? c.suit ?? "?";
  return `${r}${s}`;
}

function fmtBoard(st) {
  const board = st?.community ?? st?.board ?? [];
  if (!Array.isArray(board) || board.length === 0) return "(none)";
  return board.map(fmtCard).join(" ");
}

function seatLabel(seat, i) {
  if (!seat) return `Seat ${i}`;
  const name = seat.name ?? (i === 0 ? "YOU" : `P${i}`);
  return `Seat ${i} (${name})`;
}

function seatBadge(seat, st, i) {
  const toAct = st?.toAct ?? st?.toActSeat ?? 0;
  const folded = !!seat?.folded;
  const inHand = seat?.inHand !== false; // undefined は true 扱い
  if (folded) return `<span class="badge badge-bad">FOLDED</span>`;
  if (!inHand) return `<span class="badge">OUT</span>`;
  return i === toAct
    ? `<span class="badge badge-good">TO ACT</span>`
    : `<span class="badge">IN HAND</span>`;
}

/** showdown winner (fallback) */
function resolveShowdownWinners(st) {
  // 既に gameState 側に勝者計算がある想定だが、
  // UI上の表示/ログ用に最低限のフォールバックを用意
  const seats = st?.seats ?? [];
  const alive = seats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s && (s.inHand !== false) && !s.folded);

  if (alive.length === 0) return { winners: [], name: "ERROR: no alive", scores: [] };
  if (alive.length === 1) return { winners: [alive[0].i], name: "WIN by fold", scores: [] };

  const board = st?.community ?? st?.board ?? [];
  const scored = alive.map(({ s, i }) => {
    const hole = s.hole ?? s.holeCards ?? [];
    // eval7 expects iterable of 5+ cards (hole+board)
    try {
      const score = eval7([...hole, ...board]);
      return { i, score };
    } catch (e) {
      return { i, score: null };
    }
  });

  // score が null の人がいたら一旦 0 扱い（落ちないため）
  scored.sort((a, b) => compareScore(b.score ?? 0, a.score ?? 0));
  const best = scored[0]?.score ?? 0;
  const winners = scored.filter((x) => compareScore(x.score ?? 0, best) === 0).map((x) => x.i);
  const name = handName(best);
  return { winners, name, scores: scored };
}

/** payout (simple) */
function payout(st, result) {
  // ここは “動作確認用の超簡易”
  // 1) 勝者が1人なら pot 全取り
  // 2) 複数なら均等割、余りは先頭勝者へ
  const seats = st.seats ?? [];
  const pot = st.pot ?? 0;
  const winners = result.winners ?? [];
  if (winners.length === 0 || pot <= 0) return;

  const share = Math.floor(pot / winners.length);
  const rem = pot - share * winners.length;

  winners.forEach((wi) => {
    if (seats[wi]) seats[wi].stack = (seats[wi].stack ?? 0) + share;
  });
  if (rem > 0 && seats[winners[0]]) seats[winners[0]].stack += rem;

  st.pot = 0;

  log("---- PAYOUT ----");
  log(`Winner: Seat ${winners.join(", ")} / Hand: ${result.name} / +${share}${rem ? ` (+${rem} remainder)` : ""}`);
  log(`Stacks: ${seats.map((s) => `${s.name ?? "P"}:${s.stack ?? 0}`).join(" / ")}`);
}

/** ========== actions ========== */
function doStartHand() {
  clearLog();
  startHand();
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
  // gameState 側に forceShowdown がある前提
  // まず強制ショーダウンまで進める
  forceShowdown();
  exposeToWindow();

  const st = getState();
  log("---- SHOWDOWN ----");
  log(`Board: ${fmtBoard(st)}`);

  const result = resolveShowdownWinners(st);
  const winners = result.winners ?? [];
  log(`Winners: ${winners.join(", ") || "(none)"}`);
  log(`Hand: ${result.name}`);

  payout(st, result);
  exposeToWindow();
  render();
}

function dumpState() {
  const st = getState();
  console.log("STATE", st);
  log("Dumped state to console.");
  render();
}
/** ========== UI render ========== */
function render() {
  const st = getState();
  const seats = st?.seats ?? [];
  const pot = st?.pot ?? 0;
  const street = st?.street ?? "idle";

  const html = `
  <div class="wrap">
    <div class="topbar">
      <div class="title">MIXTABLE / ポーカー</div>
      <div class="chips">
        <span class="chip"><span class="dot"></span> 実験的 / 無料 / 保証なし</span>
        <span class="chip">Pot: <b>${pot}</b></span>
        <span class="chip">Street: <b>${street}</b></span>
      </div>
    </div>

    <div class="controls">
      <button id="btnStart" class="btn btn-primary">Start Hand（ブラインド+配牌）</button>
      <button id="btnCall" class="btn">コール / チェック</button>
      <button id="btnRaise" class="btn">ミン・レイズ</button>
      <button id="btnFold" class="btn btn-danger">フォールド</button>
      <button id="btnShow" class="btn btn-ghost">Showdown（役判定+配当）</button>
      <button id="btnDump" class="btn btn-ghost">ダンプ状態</button>
      <button id="btnClear" class="btn btn-ghost">ログ消去</button>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-h">TABLE</div>
        <div class="muted">Board: <b>${fmtBoard(st)}</b></div>

        <div class="seats">
          ${seats
            .map((seat, i) => {
              const name = seat?.name ?? (i === 0 ? "YOU" : "BOT");
              const stack = seat?.stack ?? 0;
              const bet = seat?.bet ?? 0;
              const hole = Array.isArray(seat?.hole) ? seat.hole.map(fmtCard).join(" ") : "-";
              const badge = seatBadge(seat, st, i);

              return `
                <div class="seat">
                  <div class="seat-top">
                    <div class="seat-name">${seatLabel(seat, i)} ${i === 0 ? "▶" : ""} ${badge}</div>
                  </div>
                  <div class="seat-row">
                    <div>stack: <b>${stack}</b></div>
                    <div>bet: <b>${bet}</b></div>
                    <div class="right">hole: <b>${hole}</b></div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>

      <div class="card">
        <div class="card-h">LOG</div>
        <pre class="logbox" id="logBox">${logs.join("\n")}</pre>
      </div>
    </div>
  </div>
  `;

  setApp(html);

  // ✅ ここが重要：onclick ではなく、id でイベントを紐付ける（名前ズレで壊れない）
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
}

/** ========== boot ========== */
window.addEventListener("DOMContentLoaded", () => {
  createInitialState();
  exposeToWindow();
  log("Poker mode detected");
  render();
});
