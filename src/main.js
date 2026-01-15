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

// ---------- small helpers ----------
const $ = (id) => document.getElementById(id);

function clampText(s, max = 4000) {
  const t = String(s ?? "");
  return t.length > max ? t.slice(-max) : t;
}

function cardStr(c) {
  if (!c) return "-";
  if (typeof c === "string") return c;
  // どんな型でも落ちないように
  return String(c.rank ?? c.r ?? "") + String(c.suit ?? c.s ?? "");
}

function cardsStr(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "(none)";
  return arr.map(cardStr).join(" ");
}

function streetLabel(street) {
  return street || "idle";
}

// ---------- UI skeleton ----------
function setApp(html) {
  const app = document.querySelector("#app");
  if (!app) {
    console.error(`#app が見つかりません。index.html に <div id="app"></div> が必要です`);
    return;
  }
  app.innerHTML = html;
}

function ensureUI() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div style="padding:12px; font-family:system-ui">
      <h2>MIXTABLE Poker</h2>

      <div style="margin-bottom:8px">
        <button id="btnStart">Start Hand</button>
        <button id="btnCall">Call / Check</button>
        <button id="btnRaise">Min Raise</button>
        <button id="btnFold">Fold</button>
        <button id="btnShow">SHOWDOWN</button>
      </div>

      <pre id="log" style="height:220px; overflow:auto; background:#111; color:#0f0; padding:8px"></pre>
    </div>
  `;
}
// ---------- rendering ----------
function render() {
  const st = getState?.() ?? null;

  // UIがまだ無ければ作る
  if (!$("uiLog")) ensureUI();

  if (!st) {
    $("uiLog").textContent = "state がありません（getState() が null）";
    return;
  }

  $("uiPot").textContent = String(st.pot ?? 0);
  $("uiStreet").textContent = streetLabel(st.street);
  $("uiBoard").textContent = cardsStr(st.community);

  // seats
  const seats = Array.isArray(st.seats) ? st.seats : [];
  const toAct = Number.isInteger(st.toAct) ? st.toAct : -1;

  const seatHtml = seats
    .map((s, i) => {
      const name = s?.name ?? (i === 0 ? "YOU" : `Seat ${i}`);
      const stack = s?.stack ?? 0;
      const bet = s?.bet ?? 0;
      const inHand = !!s?.inHand;
      const folded = !!s?.folded;
      const hole = Array.isArray(s?.hole) ? s.hole : [];

      const tags = [
        inHand && !folded ? `<span class="tag in">IN HAND</span>` : `<span class="tag out">OUT</span>`,
        i === toAct ? `<span class="tag act">▶ TO ACT</span>` : "",
        folded ? `<span class="tag fold">FOLDED</span>` : "",
      ].filter(Boolean).join(" ");

      return `
        <div class="seat ${i === toAct ? "isAct" : ""}">
          <div class="seatTop">
            <div class="seatName">Seat ${i} <b>${name}</b></div>
            <div class="seatTags">${tags}</div>
          </div>
          <div class="seatRow">
            <div>stack: <b>${stack}</b></div>
            <div>bet: <b>${bet}</b></div>
            <div>hole: <b>${cardsStr(hole)}</b></div>
          </div>
        </div>
      `;
    })
    .join("");

  $("uiSeats").innerHTML = seatHtml || `<div class="small">(no seats)</div>`;
}

// ---------- logging ----------
function clearLog() {
  if ($("uiLog")) $("uiLog").textContent = "";
}

function logLine(line) {
  if (!$("uiLog")) ensureUI();
  const cur = $("uiLog").textContent || "";
  $("uiLog").textContent = clampText(cur + (cur ? "\n" : "") + line, 8000);
  $("uiLog").scrollTop = $("uiLog").scrollHeight;
}
// ---------- actions ----------
function wireEventsOnce() {
$("btnShow")?.addEventListener("click", () => {
  console.log("---- SHOWDOWN ---- (button clicked)");
  try {
    forceShowdown();
    console.log("---- SHOWDOWN ---- (forceShowdown OK)");
    logLine("---- SHOWDOWN ----");
  } catch (e) {
    console.error(e);
    console.log("---- SHOWDOWN ---- (ERROR)");
    logLine("Showdown ERROR");
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
      // ここが重要： doShowdown() ではなく forceShowdown()
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
  // /poker/ 以外でも壊れないように
  ensureUI();

  try {
    createInitialState();
    exposeToWindow();
  } catch (e) {
    console.error(e);
  }

  wireEventsOnce();
  render();
});
// ===============================
// AUTO BOT LOOP (smart + safe)
// ===============================
if (s.toAct !== undefined) {
  const toAct = s.toAct;

  const seats = Array.isArray(s.seats) ? s.seats : [];
  const youIndex =
    seats.findIndex((p) => (p?.name || "").toUpperCase() === "YOU") ?? -1;

  const you = youIndex >= 0 ? youIndex : 0;

  // あなたの番なら止める
  if (toAct === you) return;

  // BOT 行動
  setTimeout(() => {
    actBot();
    render();
  }, 600);
}

function autoStepOnce() {
  const s = getState?.();
  if (!s) return;

  // idleなら何もしない（あなたが Start Hand 押す）
  if (s.street === "idle") return;

  // showdown なら自動で配当まで
  if (s.street === "showdown") {
    try {
      forceShowdown();
      logLine("AUTO: Showdown + Payout");
      render();
    } catch (e) {
      console.error(e);
      logLine("AUTO: showdown ERROR");
      stopAutoBot();
    }
    return;
  }

  const toAct = Number.isInteger(s.toAct) ? s.toAct : -1;
  if (toAct < 0) return;

  // あなた（Seat0）が番なら止める（安全）
  if (toAct === 0) return;

  const me = s.seats?.[toAct];
  if (!me || !me.inHand || me.folded) return;

  const toCall = calcToCall(s);

  // 行動の確率（安全寄り）
  // - toCall > 0: ほぼコール、たまにフォールド、稀にレイズ
  // - toCall == 0: ほぼチェック、たまにレイズ
  const r = Math.random();

  try {
    if (toCall > 0) {
      if (r < 0.06) {
        actFold();
        logLine(`AUTO: Seat${toAct} FOLD (toCall=${toCall})`);
      } else if (r < 0.10) {
        actMinRaise();
        logLine(`AUTO: Seat${toAct} MIN-RAISE (toCall=${toCall})`);
      } else {
        actCallCheck();
        logLine(`AUTO: Seat${toAct} CALL (toCall=${toCall})`);
      }
    } else {
      if (r < 0.12) {
        actMinRaise();
        logLine(`AUTO: Seat${toAct} MIN-RAISE (toCall=0)`);
      } else {
        actCallCheck();
        logLine(`AUTO: Seat${toAct} CHECK`);
      }
    }

    render();
  } catch (e) {
    console.error(e);
    logLine("AUTO: ERROR (stopped)");
    stopAutoBot();
  }
}

function startAutoBot() {
  if (__autoTimer) return;
  logLine("AUTO: ON");
  __autoTimer = setInterval(autoStepOnce, 900); // 少し速く
}

function stopAutoBot() {
  if (__autoTimer) clearInterval(__autoTimer);
  __autoTimer = null;
  logLine("AUTO: OFF");
}

window.startAutoBot = startAutoBot;
window.stopAutoBot = stopAutoBot;
