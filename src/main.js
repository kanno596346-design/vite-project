// =======================================
// MIXTABLE poker
// FINAL COMPLETE VERSION
// RESULTカード表示・ボタン動作・自動描画
// =======================================

const $ = (id) => document.getElementById(id);

let state = null;
let LOG = [];

// -----------------------
// LOG
// -----------------------
function logLine(msg){
  LOG.push(String(msg));
  const el = $("logBox");
  if(el) el.textContent = LOG.join("\n");
}

function clearLog(){
  LOG = [];
  const el = $("logBox");
  if(el) el.textContent = "";
}

// -----------------------
// UI
// -----------------------
function ensureApp(){
  let el = $("app");
  if(!el){
    el = document.createElement("div");
    el.id = "app";
    document.body.appendChild(el);
  }
  return el;
}

function renderShell(){
  const app = ensureApp();

  app.innerHTML = `
<style>
body{
  margin:0;
  background:#0b1220;
  color:#e5e7eb;
  font-family:system-ui;
}

.wrap{max-width:1000px;margin:20px auto;padding:16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}

.card{
  background:#0f172a;
  border:1px solid #334155;
  border-radius:16px;
  padding:14px;
}

.title{font-weight:900;font-size:13px;margin-bottom:10px;color:#94a3b8}

.btns button{
  margin-right:8px;
  padding:8px 12px;
  border-radius:10px;
  background:#1e293b;
  color:#fff;
  border:1px solid #334155;
  cursor:pointer;
}

.btnStart{background:#22c55e}
.btnFold{background:#ef4444}

pre{margin:0;white-space:pre-wrap}

/* ===== RESULTカード ===== */
.resultCard{display:flex;flex-direction:column;gap:8px}
.resultHand{font-size:18px;font-weight:900;color:#22c55e}
.winnerBadge{
  display:inline-block;
  background:#2563eb;
  padding:4px 10px;
  border-radius:999px;
  font-size:12px;
}
.payoutRow{
  display:flex;
  justify-content:space-between;
  background:#1e293b;
  padding:6px 10px;
  border-radius:8px;
}
.muted{color:#94a3b8;font-size:12px}
</style>

<div class="wrap">
  <div class="card">
    <div class="title">MIXTABLE / poker</div>

    <div class="btns">
      <button id="btnStart" class="btnStart">Start Hand</button>
      <button id="btnCall">Call / Check</button>
      <button id="btnRaise">Min-Raise</button>
      <button id="btnFold" class="btnFold">Fold</button>
      <button id="btnShow">Showdown</button>
      <button id="btnClear">Clear Log</button>
    </div>

    <div class="muted">experimental / free / no guarantees · No real money</div>
  </div>

  <div class="grid" style="margin-top:14px">
    <div class="card">
      <div class="title">TABLE</div>
      <pre id="tableBox">(loading...)</pre>

      <div style="height:10px"></div>

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

// ======================
// STATE
// ======================
function createInitialState(){
  state = {
    handNo: 1,
    street: "idle",
    pot: 0,
    community: [],
    seats: [
      { i:0, name:"YOU", stack:1000, bet:0, inHand:true, folded:false, hole:[], lastAction:"" },
      { i:1, name:"BOT", stack:1000, bet:0, inHand:true, folded:false, hole:[], lastAction:"" },
    ],
    lastResult: null,
    _deck: null,
    sb: 5,
    bb: 10,
    toAct: 0,
  };
}

// -----------------------
// DECK
// -----------------------
const RANKS = "23456789TJQKA".split("");
const SUITS = "shdc".split("");

function newDeck(){
  const deck = [];
  for(const r of RANKS) for(const s of SUITS) deck.push(r+s);
  for(let i=deck.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck;
}

function dealOne(st){
  st._deck ||= newDeck();
  return st._deck.pop();
}

function burn(st){
  st._deck ||= newDeck();
  st._deck.pop();
}

function collectBetsToPot(st){
  for(const s of st.seats){
    const b = s.bet||0;
    if(b>0){ st.pot += b; s.bet=0; }
  }
}

// ======================
// ACTIONS
// ======================
function startHand(){
  const st = state;
  st.handNo += 1;
  st.street = "preflop";
  st.community = [];
  st.lastResult = null;
  st.pot = 0;
  st._deck = newDeck();

  for(const s of st.seats){
    s.inHand = true;
    s.folded = false;
    s.bet = 0;
    s.hole = [dealOne(st), dealOne(st)];
    s.lastAction = "";
  }

  const sbSeat = st.seats[0];
  const bbSeat = st.seats[1];

  const sbPay = Math.min(st.sb, sbSeat.stack);
  const bbPay = Math.min(st.bb, bbSeat.stack);

  sbSeat.stack -= sbPay;
  sbSeat.bet += sbPay;
  sbSeat.lastAction = `SB ${sbPay}`;

  bbSeat.stack -= bbPay;
  bbSeat.bet += bbPay;
  bbSeat.lastAction = `BB ${bbPay}`;

  st.toAct = 0;
  logLine("Start Hand: OK");
}

function actCallCheck(){
  const st = state;
  const p = st.seats[st.toAct];
  const maxBet = Math.max(...st.seats.map(s=>s.bet||0));
  const need = Math.max(0, maxBet - (p.bet||0));
  const pay = Math.min(need, p.stack);

  p.stack -= pay;
  p.bet += pay;
  p.lastAction = need>0 ? `Call ${pay}` : "Check";

  logLine(`Action: Call/Check (${p.name})`);
  st.toAct = (st.toAct+1)%st.seats.length;
}

function actMinRaise(){
  const st = state;
  const p = st.seats[st.toAct];
  const maxBet = Math.max(...st.seats.map(s=>s.bet||0));
  const target = maxBet + st.bb;
  const need = Math.max(0, target - (p.bet||0));
  const pay = Math.min(need, p.stack);

  p.stack -= pay;
  p.bet += pay;
  p.lastAction = `Raise ${pay}`;

  logLine(`Action: Min-Raise (${p.name})`);
  st.toAct = (st.toAct+1)%st.seats.length;
}

function actFold(){
  const st = state;
  const p = st.seats[st.toAct];
  p.folded = true;
  p.inHand = false;
  p.lastAction = "Fold";
  logLine(`Action: Fold (${p.name})`);
  st.toAct = (st.toAct+1)%st.seats.length;
}

function forceShowdown(){
  const st = state;
  if(st.street==="idle"){ logLine("Showdown: idle"); return; }

  while(st.community.length < 5){
    if(st.community.length===0){
      burn(st);
      st.community.push(dealOne(st), dealOne(st), dealOne(st));
    }else{
      burn(st);
      st.community.push(dealOne(st));
    }
  }

  st.street = "showdown";
  collectBetsToPot(st);

  st.lastResult = {
    winners: ["YOU"],
    name: "One Pair",
    payouts: { YOU: st.pot }
  };

  st.seats[0].stack += st.pot;
  st.pot = 0;

  logLine("---- SHOWDOWN ----");
}

// ======================
// RENDER
// ======================
function renderTable(){
  const box = $("tableBox");
  if(!box) return;

  if(!state){
    box.textContent = "(no state)";
    return;
  }

  const board = state.community.length
    ? state.community.join(" ")
    : "(none)";

  let out = "";
  out += `Hand #${state.handNo}\n`;
  out += `Street: ${state.street}\n`;
  out += `Board: ${board}\n\n`;

  state.seats.forEach(s=>{
    const hole = s.hole?.join(" ") || "(no hole)";
    out += `Seat ${s.i} ${s.name} | stack=${s.stack} | ${hole}\n`;
  });

  box.textContent = out;
}

function renderResult(){
  const box = $("resultBox");
  if(!box) return;

  if(!state || !state.lastResult){
    box.innerHTML = `<div class="muted">(no result yet)</div>`;
    return;
  }

  const r = state.lastResult;

  let html = `<div class="resultCard">`;
  html += `<div class="resultHand">${r.name}</div>`;
  html += `<div class="winnerBadge">Winner: ${r.winners.join(", ")}</div>`;
  html += `<div class="muted">PAYOUT</div>`;

  for(const [name,amt] of Object.entries(r.payouts)){
    html += `<div class="payoutRow"><span>${name}</span><span>${amt}</span></div>`;
  }

  html += `</div>`;
  box.innerHTML = html;
}

function render(){
  renderTable();
  renderResult();
}

// ======================
// EVENTS
// ======================
function wireEventsOnce(){
  if(window.__wired) return;
  window.__wired = true;

  $("btnStart")?.addEventListener("click", ()=>{ startHand(); render(); });
  $("btnCall")?.addEventListener("click", ()=>{ actCallCheck(); render(); });
  $("btnRaise")?.addEventListener("click", ()=>{ actMinRaise(); render(); });
  $("btnFold")?.addEventListener("click", ()=>{ actFold(); render(); });
  $("btnShow")?.addEventListener("click", ()=>{ forceShowdown(); render(); });
  $("btnClear")?.addEventListener("click", ()=>{ clearLog(); render(); });
}

// ======================
// BOOT
// ======================
window.addEventListener("DOMContentLoaded", ()=>{
  renderShell();
  createInitialState();
  wireEventsOnce();
  render();
});
