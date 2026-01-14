// src/main.js
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

/**
 * UI専用 main.js（安全に動く版）
 * - ボタンは id で拾って addEventListener（onclick文字列は使わない）
 * - 例外が出てもUIが固まらないように try/catch + ログ表示
 * - BOT番のとき自動で1手進める（最低限）
 */

const UI = {
  logLines: [],
  lastError: "",
};

function $(id) {
  return document.getElementById(id);
}

function safeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function cardStr(c) {
  // c が "Ah" みたいな文字列 or {r,s} みたいな形式でも落ちないようにする
  if (!c) return "--";
  if (typeof c === "string") return c;
  if (typeof c === "object") {
    const r = c.r ?? c.rank ?? "";
    const s = c.s ?? c.suit ?? "";
    const out = `${r}${s}`.trim();
    return out || "--";
  }
  return safeText(c);
}

function joinCards(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map(cardStr).join(" ");
}

function log(line) {
  UI.logLines.unshift(line);
  if (UI.logLines.length > 50) UI.logLines.length = 50;
  render();
}

function clearLog() {
  UI.logLines = [];
  UI.lastError = "";
  render();
}

function setError(e) {
  UI.lastError = e ? (e.stack || e.message || String(e)) : "Unknown error";
  render();
}

function getSt() {
  // gameState.js 側が window.state / window.gameState を持ってる想定
  try {
    const st = getState?.();
    if (st) return st;
  } catch (_) {}
  // fallback
  return window.state || window.gameState || null;
}

function ensureInit() {
  // 初回だけ初期化
  let st = getSt();
  if (!st) {
    createInitialState();
    exposeToWindow();
    st = getSt();
  }
  return st;
}

function withGuard(fn, label) {
  try {
    fn();
  } catch (e) {
    console.error(e);
    setError(e);
    log(`ERROR @ ${label}: ${e?.message || e}`);
  }
}

function doStartHand() {
  withGuard(() => {
    startHand();
    exposeToWindow();
    log("Start Hand: OK");
    // BOTが先なら自動1手
    maybeBotAct();
    render();
  }, "StartHand");
}

function doCallCheck() {
  withGuard(() => {
    actCallCheck();
    exposeToWindow();
    log("Action: Call/Check");
    maybeBotAct();
    render();
  }, "Call/Check");
}

function doMinRaise() {
  withGuard(() => {
    actMinRaise();
    exposeToWindow();
    log("Action: Min-Raise");
    maybeBotAct();
    render();
  }, "MinRaise");
}

function doFold() {
  withGuard(() => {
    actFold();
    exposeToWindow();
    log("Action: Fold");
    maybeBotAct();
    render();
  }, "Fold");
}

function doShowdown() {
  withGuard(() => {
    // ここが以前 doShowdown 未定義で止まっていたので、確実に forceShowdown を呼ぶ
    forceShowdown();
    exposeToWindow();
    log("---- SHOWDOWN ----");
    maybeBotAct();
    render();
  }, "Showdown");
}

function dumpState() {
  withGuard(() => {
    const st = ensureInit();
    console.log("STATE DUMP:", st);
    log("Dumped state to console.");
  }, "DumpState");
}

function maybeBotAct() {
  const st = getSt();
  if (!st) return;

  // toAct の表現がいくつかあり得るので広く見る
  const toActName =
    st.toActName ||
    st.toActPlayer ||
    (typeof st.toAct === "string" ? st.toAct : null) ||
    (typeof st.toAct === "number" ? (st.seats?.[st.toAct]?.name || null) : null);

  // BOT のときだけ軽く自動
  if (toActName && String(toActName).toUpperCase().includes("BOT")) {
    // 何度もループしないように少し遅延
    setTimeout(() => {
      withGuard(() => {
        // すごく単純：基本コール/チェック、たまにフォールド
        const r = Math.random();
        if (r < 0.15) {
          actFold();
          log("BOT: Fold");
        } else {
          actCallCheck();
          log("BOT: Call/Check");
        }
        exposeToWindow();
        render();
      }, "BotAct");
    }, 180);
  }
}

function render() {
  const st = ensureInit();

  const pot = st?.pot ?? 0;
  const street = st?.street ?? st?.phase ?? "idle";
  const board = joinCards(st?.community || st?.board || []);
  const seats = Array.isArray(st?.seats) ? st.seats : [];

  const seatRows = seats
    .map((s, i) => {
      const name = s?.name ?? (i === 0 ? "YOU" : `Seat ${i}`);
      const stack = s?.stack ?? 0;
      const bet = s?.bet ?? 0;
      const inHand = s?.inHand ?? true;
      const folded = s?.folded ?? false;

      const hole = joinCards(s?.hole || s?.cards || []);
      const badges = [
        inHand ? `<span class="badge ok">IN HAND</span>` : `<span class="badge">OUT</span>`,
        folded ? `<span class="badge warn">FOLDED</span>` : ``,
      ].join(" ");

      // toAct 表現が複数あるので広く判定
      const toAct =
        (typeof st?.toAct === "number" && st.toAct === i) ||
        (typeof st?.toActName === "string" && st.toActName === name) ||
        (typeof st?.toActPlayer === "string" && st.toActPlayer === name);

      return `
        <div class="seat ${toAct ? "toact" : ""}">
          <div class="seatHead">
            <div class="seatTitle">Seat ${i} <span class="name">${safeText(name)}</span> ${toAct ? `<span class="toactTag">▶ TO ACT</span>` : ""}</div>
            <div class="badges">${badges}</div>
          </div>
          <div class="seatBody">
            <div class="kv"><span class="k">stack</span><span class="v">${stack}</span></div>
            <div class="kv"><span class="k">bet</span><span class="v">${bet}</span></div>
            <div class="kv"><span class="k">hole</span><span class="v mono">${hole || "-- --"}</span></div>
          </div>
        </div>
      `;
    })
    .join("");

  const errorBox = UI.lastError
    ? `<div class="errorBox"><div class="errTitle">ERROR</div><pre class="mono">${safeText(UI.lastError)}</pre></div>`
    : "";

  const logBox = `
    <div class="panel">
      <div class="panelTitle">LOG</div>
      <div class="logBox mono">${UI.logLines.map((x) => `<div>${safeText(x)}</div>`).join("")}</div>
      ${errorBox}
    </div>
  `;

  const html = `
    <div class="wrap">
      <div class="topbar">
        <div class="title">MIXTABLE / ポーカー</div>
        <div class="status">
          <span class="pill"><span class="dot"></span> 実験的 / 無料 / 保証なし</span>
          <span class="pill">Pot: ${pot}</span>
          <span class="pill">Street: ${safeText(street)}</span>
        </div>
      </div>

      <div class="actions">
        <button id="btnStart" class="btn primary">Start Hand（ブラインド+配牌）</button>
        <button id="btnCall" class="btn">コール / チェック</button>
        <button id="btnRaise" class="btn">ミン・レイズ</button>
        <button id="btnFold" class="btn danger">フォールド</button>
        <button id="btnShow" class="btn">Showdown（役判定+配当）</button>
        <button id="btnDump" class="btn ghost">ダンプ状態</button>
        <button id="btnClear" class="btn ghost">ログ消去</button>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="panelTitle">TABLE</div>
          <div class="boardRow">
            <div class="label">Board:</div>
            <div class="mono boardCards">${board || "(none)"}</div>
          </div>
          <div class="seats">
            ${seatRows}
          </div>
        </div>
        ${logBox}
      </div>
    </div>
  `;

  const app = document.querySelector("#app");
  if (!app) {
    console.error("#app not found. poker/index.html needs <div id='app'></div>");
    return;
  }
  app.innerHTML = html;

  // ボタンを必ず生きたイベントにする（onclick文字列は使わない）
  $("btnStart")?.addEventListener("click", doStartHand);
  $("btnCall")?.addEventListener("click", doCallCheck);
  $("btnRaise")?.addEventListener("click", doMinRaise);
  $("btnFold")?.addEventListener("click", doFold);
  $("btnShow")?.addEventListener("click", doShowdown);
  $("btnDump")?.addEventListener("click", dumpState);
  $("btnClear")?.addEventListener("click", clearLog);
}

function injectStyleOnce() {
  if (document.getElementById("mixtable-style")) return;
  const style = document.createElement("style");
  style.id = "mixtable-style";
  style.textContent = `
    :root{ color-scheme: dark; }
    body{
      margin:0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial;
      background: radial-gradient(1200px 700px at 20% 10%, #0b3a2a 0%, rgba(11,58,42,.25) 25%, transparent 60%),
                  radial-gradient(900px 500px at 70% 15%, rgba(40,120,255,.20) 0%, transparent 60%),
                  linear-gradient(180deg, #07131f 0%, #06101a 100%);
      color:#e8f0ff;
    }
    .wrap{ max-width: 1200px; margin: 24px auto; padding: 0 16px; }
    .topbar{
      display:flex; align-items:center; justify-content:space-between;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 16px;
      padding: 14px 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,.25);
      backdrop-filter: blur(10px);
    }
    .title{ font-size: 20px; font-weight: 800; letter-spacing:.3px; }
    .status{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
    .pill{
      display:inline-flex; align-items:center; gap:8px;
      padding: 6px 10px; border-radius: 999px;
      background: rgba(0,0,0,.35);
      border: 1px solid rgba(255,255,255,.10);
      font-size: 12px;
    }
    .dot{ width:10px; height:10px; border-radius:999px; background:#1ee38a; box-shadow:0 0 18px rgba(30,227,138,.55); }
    .actions{ display:flex; gap:10px; flex-wrap:wrap; margin: 14px 0 16px; }
    .btn{
      border-radius: 12px;
      padding: 10px 14px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      color: #e8f0ff;
      cursor:pointer;
      font-weight: 700;
      box-shadow: 0 10px 24px rgba(0,0,0,.22);
    }
    .btn:hover{ background: rgba(255,255,255,.10); }
    .btn.primary{ background: linear-gradient(90deg, rgba(30,227,138,.95), rgba(30,180,227,.55)); color:#02110c; border-color: rgba(30,227,138,.35); }
    .btn.danger{ border-color: rgba(255,70,90,.30); }
    .btn.ghost{ opacity:.9; }
    .grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 980px){ .grid{ grid-template-columns:1fr; } }
    .panel{
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 16px;
      padding: 14px;
      box-shadow: 0 14px 44px rgba(0,0,0,.28);
      backdrop-filter: blur(10px);
      min-height: 280px;
    }
    .panelTitle{ font-weight: 900; opacity:.9; margin-bottom: 10px; letter-spacing:.4px; }
    .boardRow{ display:flex; gap:10px; align-items:center; margin-bottom: 10px; }
    .label{ opacity:.75; width:64px; }
    .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
    .boardCards{ font-size: 14px; }
    .seats{ display:flex; flex-direction:column; gap:10px; }
    .seat{
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(0,0,0,.25);
      padding: 10px 12px;
    }
    .seat.toact{ border-color: rgba(30,227,138,.30); box-shadow: 0 0 0 2px rgba(30,227,138,.10) inset; }
    .seatHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .seatTitle{ font-weight: 900; }
    .name{ opacity:.9; }
    .toactTag{ color:#1ee38a; font-weight:900; margin-left:6px; }
    .badges{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .badge{
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.06);
      opacity:.9;
    }
    .badge.ok{ border-color: rgba(30,227,138,.25); }
    .badge.warn{ border-color: rgba(255,70,90,.25); }
    .seatBody{ display:flex; gap:14px; margin-top: 8px; flex-wrap:wrap; }
    .kv{ display:flex; gap:8px; min-width: 140px; }
    .k{ opacity:.7; width:46px; }
    .v{ font-weight: 800; }
    .logBox{
      max-height: 220px;
      overflow:auto;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(0,0,0,.22);
    }
    .errorBox{
      margin-top: 10px;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,70,90,.30);
      background: rgba(255,70,90,.08);
    }
    .errTitle{ font-weight: 1000; margin-bottom: 6px; color: #ff6b78; }
    pre{ margin:0; white-space:pre-wrap; word-break:break-word; }
  `;
  document.head.appendChild(style);
}

window.addEventListener("DOMContentLoaded", () => {
  injectStyleOnce();
  ensureInit();
  render();
});
