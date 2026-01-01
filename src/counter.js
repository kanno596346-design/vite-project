// src/counter.js
// MIXTABLE Poker - Game State (最小実装)

export const state = {
  phase: "showdown",
  pot: 100,
  community: ["Ah", "7d", "2c", "Ts", "9h"],
  seats: [
    {
      i: 0,
      name: "P0",
      inHand: true,
      folded: false,
      hole: ["As", "Ad"],
      stack: 1000,
    },
    {
      i: 1,
      name: "P1",
      inHand: true,
      folded: false,
      hole: ["Kc", "Kd"],
      stack: 1000,
    },
  ],
};

// ★ これが eval7 接続の要
window.state = state;

console.log("✅ window.state connected", state);
