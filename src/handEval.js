// src/handEval.js
// Texas Hold'em hand evaluator: 7 cards -> best 5-card hand.
// Card format: "As","Kd","Th","2c" (rank + suit)
// Returns comparable score object + human name.

const RANK_TO_VAL = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};
const VAL_TO_RANK = { 14:"A", 13:"K", 12:"Q", 11:"J", 10:"T", 9:"9", 8:"8", 7:"7", 6:"6", 5:"5", 4:"4", 3:"3", 2:"2" };

function parseCard(cs) {
  if (!cs || cs.length < 2) throw new Error("Bad card: " + cs);
  const r = cs[0].toUpperCase();
  const s = cs[1].toLowerCase();
  const v = RANK_TO_VAL[r];
  if (!v) throw new Error("Bad rank: " + cs);
  if (!"shdc".includes(s)) throw new Error("Bad suit: " + cs);
  return { v, s, cs: r + s };
}

function combos5(cards) {
  // cards length 7 -> 21 combos
  const out = [];
  const n = cards.length;
  for (let a=0;a<n-4;a++)
    for (let b=a+1;b<n-3;b++)
      for (let c=b+1;c<n-2;c++)
        for (let d=c+1;d<n-1;d++)
          for (let e=d+1;e<n;e++)
            out.push([cards[a],cards[b],cards[c],cards[d],cards[e]]);
  return out;
}

function sortDesc(nums) { return nums.slice().sort((x,y)=>y-x); }

function isStraight(valsDesc) {
  // valsDesc: unique ranks sorted desc
  // returns high card of straight or null
  // Handle wheel A-2-3-4-5 as high=5
  const vals = valsDesc.slice();
  // Add wheel support: if has Ace and 5..2
  const hasA = vals.includes(14);
  const wheel = hasA && vals.includes(5) && vals.includes(4) && vals.includes(3) && vals.includes(2);
  if (wheel) return 5;

  for (let i=0;i<=vals.length-5;i++){
    const a = vals[i];
    let ok = true;
    for (let k=1;k<5;k++){
      if (!vals.includes(a-k)) { ok=false; break; }
    }
    if (ok) return a;
  }
  return null;
}

function eval5(cards5) {
  // returns score {cat, kickers, name, best5} where:
  // cat: 8 SF,7 4K,6 FH,5 FL,4 ST,3 3K,2 2P,1 1P,0 HC
  // kickers: array of numbers for tie-break (desc), lexicographic
  const vals = cards5.map(c=>c.v);
  const suits = cards5.map(c=>c.s);

  const counts = new Map();
  for (const v of vals) counts.set(v, (counts.get(v)||0)+1);

  const uniqueVals = Array.from(counts.keys()).sort((a,b)=>b-a); // desc
  const groups = Array.from(counts.entries())
    .map(([v,c])=>({v, c}))
    .sort((g1,g2)=> (g2.c-g1.c) || (g2.v-g1.v)); // by count desc, then rank desc

  const flush = suits.every(s=>s===suits[0]);
  const straightHigh = isStraight(uniqueVals);

  // Straight Flush
  if (flush && straightHigh) {
    return {
      cat: 8,
      kickers: [straightHigh],
      name: (straightHigh===14 ? "Royal Flush" : "Straight Flush"),
      best5: cards5
    };
  }

  // Four of a kind
  if (groups[0].c === 4) {
    const quad = groups[0].v;
    const kicker = uniqueVals.filter(v=>v!==quad)[0];
    return { cat:7, kickers:[quad,kicker], name:"Four of a Kind", best5: cards5 };
  }

  // Full House
  if (groups[0].c === 3 && groups[1]?.c === 2) {
    return { cat:6, kickers:[groups[0].v, groups[1].v], name:"Full House", best5: cards5 };
  }

  // Flush
  if (flush) {
    const ks = sortDesc(vals);
    return { cat:5, kickers: ks, name:"Flush", best5: cards5 };
  }

  // Straight
  if (straightHigh) {
    return { cat:4, kickers:[straightHigh], name:"Straight", best5: cards5 };
  }

  // Three of a kind
  if (groups[0].c === 3) {
    const trip = groups[0].v;
    const kickers = uniqueVals.filter(v=>v!==trip).slice(0,2);
    return { cat:3, kickers:[trip, ...kickers], name:"Three of a Kind", best5: cards5 };
  }

  // Two Pair
  if (groups[0].c === 2 && groups[1]?.c === 2) {
    const highPair = Math.max(groups[0].v, groups[1].v);
    const lowPair  = Math.min(groups[0].v, groups[1].v);
    const kicker = uniqueVals.filter(v=>v!==highPair && v!==lowPair)[0];
    return { cat:2, kickers:[highPair, lowPair, kicker], name:"Two Pair", best5: cards5 };
  }

  // One Pair
  if (groups[0].c === 2) {
    const pair = groups[0].v;
    const kickers = uniqueVals.filter(v=>v!==pair).slice(0,3);
    return { cat:1, kickers:[pair, ...kickers], name:"One Pair", best5: cards5 };
  }

  // High Card
  return { cat:0, kickers: sortDesc(vals), name:"High Card", best5: cards5 };
}

export function compareScore(a, b) {
  // returns 1 if a wins, -1 if b wins, 0 tie
  if (a.cat !== b.cat) return a.cat > b.cat ? 1 : -1;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i=0;i<len;i++){
    const av = a.kickers[i] ?? 0;
    const bv = b.kickers[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

export function eval7(boardCards, holeCards) {
  // boardCards: ["Ah","7d","2c","Ts","9h"] (0..5)
  // holeCards:  ["Ks","Kd"] (2)
  const all = [...boardCards, ...holeCards].map(parseCard);
  if (all.length !== 7) throw new Error("eval7 expects 7 cards total. got=" + all.length);

  let best = null;
  for (const c5 of combos5(all)) {
    const sc = eval5(c5);
    if (!best || compareScore(sc, best) > 0) best = sc;
  }

  // Add pretty string for best5
  const best5Str = best.best5
    .map(c => VAL_TO_RANK[c.v] + c.s)
    .join(" ");

  return {
    cat: best.cat,
    kickers: best.kickers,
    name: best.name,
    best5: best.best5,
    best5Str
  };
}

export function handName(score) {
  // score from eval7
  return score.name;
}
