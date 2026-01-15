// src/main.js
import "./style.css";

import {
  createInitialState,
  exposeToWindow,
  getState,
  startHand,
  actFold,
  actCallCheck,
  actMinRaise,
  forceShowdown,
  // optional: if your gameState exports these, fine; if not, they stay unused
  // startAutoBot,
  // stopAutoBot,
} from "./gameState.js";

// ---------- tiny helpers ----------
const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeText(id, value) {
  const el = $(id);
  if (!el) return; // ← nullでも落とさない
  el.textContent = value ?? "";
}

// LOG表示（画面側）
function logLine(line) {
  const box = $("logBox");
  if (!box) return;
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
  box.textContent += (box.textContent ? "\n" : "") + line;
  if (atBottom) box.scrollTop = box.scrollHeight;
}

function clearLog() {
  const box = $("logBox");
  if (!box) return;
  box.textContent = "";
}

// ---------- UI skeleton ----------
function ensureUI() {
  const root = $("app");
  if (!root) return;

  // すでにUIがあるなら最低限の不足だけ補う
  // （ただし今回のエラーはid不一致が多いので、ここで土台を固定します）
  root.innerHTML = `
    <div class="mx-wrap">
      <div class="mx-top">
        <div class="mx-title">MIXTABLE / ポーカー</div>
        <div class="mx-badges">
          <span class="mx-badge">実験的 / 無料 / 保証なし</span>
          <span class="mx-badge">Pot: <b id="potVal">0</b></span>
          <span class="mx-badge">Street: <b id="streetVal">idle</b></span>
        </div>
      </div>

      <div class="mx-actions">
        <button id="btnStart" class="mx-btn mx-btn-primary">Start Hand（ブラインド+配牌）</button>
        <button id="btnCall" class="mx-btn">コール / チェック</button>
        <button id="btnRaise" class="mx-btn">ミン・レイズ</button>
        <button id="btnFold" class="mx-btn mx-btn-warn">フォールド</button>
        <button id="btnShow" class="mx-btn mx-btn-dark">Showdown（役判定+配当）</button>
        <button id="btnDump" class="mx-btn">ダンプ状態</button>
        <button id="btnClear" class="mx-btn">ログ消去</button>
      </div>

      <div class="mx-grid">
        <div class="mx-card">
          <div class="mx-card-h">TABLE</div>
          <div class="mx-row"><span class="mx-k">Board</span><span class="mx-v" id="boardVal">(none)</span></div>
          <div id="tableBox" class="mx-tablebox"></div>
        </div>

        <div class="mx-card">
          <div class="mx-card-h">LOG</div>
          <pre id="logBox" class="mx-log"></pre>
        </div>
      </div>
    </div>
  `;
}

// ---------- render ----------
function render() {
  const st = getState?.();
  if (!st) {
    safeText("boardVal", "(no state)");
    safeText("potVal", "0");
    safeText("streetVal", "unknown");
    const tb = $("tableBox");
    if (tb) tb.innerHTML = `<div class="mx-muted">state がありません</div>`;
    return;
  }

  // pot / street
  safeText("potVal", String(st.pot ?? 0));
  safeText("streetVal", String(st.street ?? "idle"));

  // board
  const board = Array.isArray(st.community) ? st.community.join(" ") : "(none)";
  safeText("boardVal", board || "(none)");

  // seats
  const seats = Array.isArray(st.seats) ? st.seats : [];
  const toAct = st.toAct ?? null;

  const tb = $("tableBox");
  if (!tb) return;

  tb.innerHTML = seats
    .map((seat, i) => {
      const name = escapeHtml(seat?.name ?? `Seat ${i}`);
      const stack = seat?.stack ?? 0;
      const bet = seat?.bet ?? 0;
      const inHand = seat?.inHand ? "IN HAND" : "OUT";
      const folded = seat?.folded ? "FOLDED" : "";
      const hole =
        Array.isArray(seat?.hole) && seat.hole.length
          ? seat.hole.join(" ")
          : "(none)";
      const actMark = i === toAct ? "▶ TO ACT" : "";
      return `
        <div class="mx-seat ${i === toAct ? "mx-seat-act" : ""}">
          <div class="mx-seat-top">
            <div class="mx-seat-name">${name} ${actMark}</div>
            <div class="mx-pill">${inHand}</div>
          </div>
          <div class="mx-seat-mid">
            <div>stack: <b>${stack}</b></div>
            <div>bet: <b>${bet}</b></div>
            <div class="mx-muted">${folded}</div>
          </div>
          <div class="mx-seat-hole">hole: <b>${escapeHtml(hole)}</b></div>
        </div>
      `;
    })
    .join("");
}

// ---------- actions (wire once) ----------
function wireEventsOnce() {
  // 二重登録防止
  if (window.__mixtableWired) return;
  window.__mixtableWired = true;

  $("btnStart")?.addEventListener("click", () => {
    try {
      startHand();
      logLine("Start Hand: OK");
    } catch (e) {
      console.error(e);
      logLine("Start Hand: ERROR");
    }
    render();
  });

  $("btnCall")?.addEventListener("click", () => {
    try {
      actCallCheck();
      logLine("Action: Call/Check");
    } catch (e) {
      console.error(e);
      logLine("Action: Call/Check ERROR");
    }
    render();
  });

  $("btnRaise")?.addEventListener("click", () => {
    try {
      actMinRaise();
      logLine("Action: Min-Raise");
    } catch (e) {
      console.error(e);
      logLine("Action: Min-Raise ERROR");
    }
    render();
  });

  $("btnFold")?.addEventListener("click", () => {
    try {
      actFold();
      logLine("Action: Fold");
    } catch (e) {
      console.error(e);
      logLine("Action: Fold ERROR");
    }
    render();
  });

  $("btnShow")?.addEventListener("click", () => {
    try {
      // 重要： doShowdown ではなく forceShowdown
      forceShowdown();
      logLine("---- SHOWDOWN ----");
    } catch (e) {
      console.error(e);
      logLine("Showdown ERROR");
    }
    render();
  });

  $("btnDump")?.addEventListener("click", () => {
    const st = getState?.();
    console.log("STATE DUMP:", st);
    logLine("Dumped state to console (F12 Console)");
    render();
  });

  $("btnClear")?.addEventListener("click", () => {
    clearLog();
    render();
  });
}

// ---------- boot ----------
window.addEventListener("DOMContentLoaded", () => {
  ensureUI();

  try {
    createInitialState();
    exposeToWindow();
  } catch (e) {
    console.error(e);
    logLine("Boot ERROR (see console)");
  }

  wireEventsOnce();
  render();
});
