// ================= ENGINE =================

export function createGameState() {
  return {
    handNo: 0,
    street: "idle",
    pot: 0,
    community: [],
    dealer: 0,
    toAct: 0,
    sb: 5,
    bb: 10,
    lastResult: null,
    deck: [],
    seats: Array.from({ length: 6 }).map((_, i) => ({
      i,
      name: i === 0 ? "YOU" : `BOT${i}`,
      stack: 1000,
      bet: 0,
      folded: false,
      inHand: true,
      hole: [],
    })),
  };
}

const RANKS = "23456789TJQKA".split("");
const SUITS = "shdc".split("");

function newDeck() {
  const d = [];
  for (const r of RANKS)
    for (const s of SUITS)
      d.push(r + s);

  for (let i = d.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function startHand(state) {
  state.handNo++;
  state.street = "preflop";
  state.pot = 0;
  state.community = [];
  state.lastResult = null;
  state.deck = newDeck();

  state.seats.forEach(s => {
    s.folded = false;
    s.bet = 0;
    s.inHand = s.stack > 0;
    s.hole = s.inHand ? [state.deck.pop(), state.deck.pop()] : [];
  });

  state.dealer = (state.dealer + 1) % state.seats.length;
  state.toAct = (state.dealer + 3) % state.seats.length;
}

export function nextStreet(state) {
  if (state.street === "preflop") {
    state.community = [
      state.deck.pop(),
      state.deck.pop(),
      state.deck.pop(),
    ];
    state.street = "flop";
  } else if (state.street === "flop") {
    state.community.push(state.deck.pop());
    state.street = "turn";
  } else if (state.street === "turn") {
    state.community.push(state.deck.pop());
    state.street = "river";
  } else if (state.street === "river") {
    state.street = "showdown";
  }
}

// ================= HAND EVALUATION =================

const RANK_ORDER = "23456789TJQKA";

function rankValue(r) {
  return RANK_ORDER.indexOf(r);
}

function getRanks(cards) {
  return cards.map(c => c[0]).sort((a, b) => rankValue(b) - rankValue(a));
}

function getSuits(cards) {
  return cards.map(c => c[1]);
}

function countByRank(cards) {
  const map = {};
  cards.forEach(c => {
    const r = c[0];
    map[r] = (map[r] || 0) + 1;
  });
  return map;
}

function isFlush(cards) {
  const suits = getSuits(cards);
  return suits.every(s => s === suits[0]);
}

function isStraight(cards) {
  const ranks = [...new Set(getRanks(cards))];
  if (ranks.length < 5) return false;

  const values = ranks.map(rankValue);
  for (let i = 0; i <= values.length - 5; i++) {
    if (
      values[i] - 1 === values[i + 1] &&
      values[i + 1] - 1 === values[i + 2] &&
      values[i + 2] - 1 === values[i + 3] &&
      values[i + 3] - 1 === values[i + 4]
    ) return true;
  }
  return false;
}

export function evaluateHand(cards) {
  const rankCount = countByRank(cards);
  const counts = Object.values(rankCount).sort((a, b) => b - a);

  const flush = isFlush(cards);
  const straight = isStraight(cards);

  if (straight && flush) return { score: 8, name: "Straight Flush" };
  if (counts[0] === 4) return { score: 7, name: "Four of a Kind" };
  if (counts[0] === 3 && counts[1] === 2) return { score: 6, name: "Full House" };
  if (flush) return { score: 5, name: "Flush" };
  if (straight) return { score: 4, name: "Straight" };
  if (counts[0] === 3) return { score: 3, name: "Three of a Kind" };
  if (counts[0] === 2 && counts[1] === 2) return { score: 2, name: "Two Pair" };
  if (counts[0] === 2) return { score: 1, name: "One Pair" };

  return { score: 0, name: "High Card" };
}