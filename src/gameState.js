// src/gameState.js
// MIXTABLE / poker - state本体（window.stateに必ず載せる）
//
// exports:
//  createInitialState, getState, exposeToWindow,
//  startHand, actFold, actCallCheck, actMinRaise,
//  forceShowdown

let state = null;

// -------------------- util --------------------
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function rankStrToVal(r) {
  if (r === "A") return 14;
  if (r === "K") return 13;
  if (r === "Q") return 12;
  if (r === "J") return 11;
  if (r === "T") return 10;
  return Number(r);
}

function makeDeck() {
  const suits = ["s", "h", "d", "c"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const deck = [];
  for (const r of ranks) for (const s of suits) deck.push(`${r}${s}`);
  return deck;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextIndex(i, n) {
  return (i + 1) % n;
}

function aliveSeats(st) {
  return st.seats.filter((s) => s.inHand && !s.folded);
}

function maxBet(st) {
  return Math.max(...st.seats.map((s) => s.bet || 0));
}

function toCall(st) {
  const p = st.seats[st.toAct];
  if (!p) return 0;
  return Math.max(0, maxBet(st) - (p.bet || 0));
}

function resetBets(st) {
  for (const s of st.seats) s.bet = 0;
}

function collectBetsToPot(st) {
  let sum = 0;
  for (const s of st.seats) {
    const b = s.bet || 0;
    sum += b;
    s.bet = 0;
  }
  st.pot += sum;
}

function burn(st) {
  st.deck.pop();
}

function dealOne(st) {
  return st.deck.pop();
}

function ensureLastAction(st) {
  for (const s of st.seats) {
    if (s.lastAction == null) s.lastAction = "";
  }
}

// -------------------- window.state --------------------
export function exposeToWindow() {
  if (typeof window !== "undefined") {
    window.state = state; // 最重要：UI側が window.state を読む
  }
  return state;
}

export function getState() {
  return state;
}

// -------------------- init --------------------
export function createInitialState() {
  // 2人固定（YOU vs BOT）最小
  state = {
    handNo: 0,
    street: "idle", // idle | preflop | flop | turn | river | showdown
    dealer: 0,
    toAct: 0,
    pot: 0,
    community: [],
    deck: [],
    sb: 5,
    bb: 10,
    seats: [
      { i: 0, name: "YOU", stack: 1000, bet: 0, inHand: true, folded: false, hole: [], lastAction: "" },
      { i: 1, name: "BOT", stack: 1000, bet: 0, inHand: true, folded: false, hole: [], lastAction: "" },
    ],
  };
  exposeToWindow();
  return state;
}

// -------------------- hand flow --------------------
export function startHand() {
  const st = state ?? createInitialState();

  st.handNo += 1;
  st.street = "preflop";
  st.pot = 0;
  st.community = [];
  st.deck = shuffle(makeDeck());

  // dealer交代
  st.dealer = st.handNo % st.seats.length;

  // seat reset
  for (const s of st.seats) {
    s.inHand = true;
    s.folded = false;
    s.hole = [];
    s.bet = 0;
    s.lastAction = "";
  }

  // blinds (heads-up: dealerがSB、もう一人がBB、preflopはSBが先)
  const sbIdx = st.dealer;
  const bbIdx = nextIndex(st.dealer, st.seats.length);

  const sbPay = Math.min(st.sb, st.seats[sbIdx].stack);
  st.seats[sbIdx].stack -= sbPay;
  st.seats[sbIdx].bet += sbPay;
  st.seats[sbIdx].lastAction = `SB ${sbPay}`;

  const bbPay = Math.min(st.bb, st.seats[bbIdx].stack);
  st.seats[bbIdx].stack -= bbPay;
  st.seats[bbIdx].bet += bbPay;
  st.seats[bbIdx].lastAction = `BB ${bbPay}`;

  // deal 2 cards each
  // 簡単：1枚ずつ配る×2周
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < st.seats.length; k++) {
      const idx = nextIndex(st.dealer, st.seats.length); // dealer左から…っぽく見えるが2人なのでOK
      // 2人固定なので順番は単純に 0,1 でもOK。ここでは i順
      st.seats[0].hole.push(dealOne(st));
      st.seats[1].hole.push(dealOne(st));
      break;
    }
  }
  // ↑上のbreakで固定2人配牌にしてます（ミス防止）

  ensureLastAction(st);

  // preflop action: SB(=dealer)が先
  st.toAct = sbIdx;

  exposeToWindow();
  return st;
}

function everyoneMatchedOrAllIn(st) {
  const alive = aliveSeats(st);
  if (alive.length <= 1) return true;
  const m = maxBet(st);
  return alive.every((s) => (s.bet || 0) === m || s.stack === 0);
}

function advanceStreet(st) {
  resetBets(st);

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

  // 次の人：dealerの左（heads-upはSB=dealerが先）
  st.toAct = nextIndex(st.dealer, st.seats.length);
  ensureLastAction(st);
  return st;
}

// -------------------- actions --------------------
export function actFold() {
  const st = state;
  if (!st || st.street === "idle" || st.street === "showdown") return st;

  const p = st.seats[st.toAct];
  if (!p) return st;

  p.folded = true;
  p.lastAction = "FOLD";

  // ベットはポットへ
  collectBetsToPot(st);

  st.street = "showdown";
  exposeToWindow();
  return st;
}

export function actCallCheck() {
  const st = state;
  if (!st || st.street === "idle" || st.street === "showdown") return st;

  const p = st.seats[st.toAct];
  if (!p) return st;

  const need = Math.max(0, maxBet(st) - (p.bet || 0));
  const pay = Math.min(need, p.stack);

  p.stack -= pay;
  p.bet += pay;

  p.lastAction = need === 0 ? "CHECK" : `CALL ${pay}`;

  // 次の人
  st.toAct = nextIndex(st.toAct, st.seats.length);

  // もし全員揃ったらストリート進行（ベット回収→次のストリート）
  if (everyoneMatchedOrAllIn(st)) {
    collectBetsToPot(st);
    advanceStreet(st);
  }

  exposeToWindow();
  return st;
}

export function actMinRaise() {
  const st = state;
  if (!st || st.street === "idle" || st.street === "showdown") return st;

  const p = st.seats[st.toAct];
  if (!p) return st;

  const m = maxBet(st);
  const target = m + st.bb; // 最小レイズをBB固定にする（最小実装）
  const need = Math.max(0, target - (p.bet || 0));
  const pay = Math.min(need, p.stack);

  p.stack -= pay;
  p.bet += pay;

  p.lastAction = `RAISE to ${p.bet}`;

  // 次の人へ
  st.toAct = nextIndex(st.toAct, st.seats.length);

  exposeToWindow();
  return st;
}

// -------------------- showdown helper --------------------
export function forceShowdown() {
  const st = state;
  if (!st || st.street === "idle") return st;

  // まず未回収ベットをポットへ
  collectBetsToPot(st);

  // ボードを5枚に揃える（eval7が必須）
  while (st.community.length < 5) {
    if (st.community.length === 0) {
      // preflop → flop
      burn(st);
      st.community.push(dealOne(st), dealOne(st), dealOne(st));
      st.street = "flop";
    } else if (st.community.length === 3) {
      burn(st);
      st.community.push(dealOne(st));
      st.street = "turn";
    } else if (st.community.length === 4) {
      burn(st);
      st.community.push(dealOne(st));
      st.street = "river";
    } else {
      // 念のため
      st.community.push(dealOne(st));
    }
  }

  st.street = "showdown";
  ensureLastAction(st);

  exposeToWindow();
  return st;
}
