/* Holzmeter – Holzliste: reine Daten-Helfer (ohne Bildschirm)
   Teilmengen „x von n fertig“, Kubikmeter, Summen eines Projekts, offene Positionen für den Kantholz-Vorschlag.
   Braucht: rechnen.js (fmt). Wird geprüft in tests/. */
"use strict";

/* Teilmengen: „fertig“ = wie viele Stück einer Position schon erstellt sind (älter: nur done ja/nein) */
const lsFertig = (p) => Math.min(p.n || 1, Math.max(0, Math.round(p.fertig || 0)));
function lsNorm(pr){ (pr.pos || []).forEach(p => { if(typeof p.fertig !== "number") p.fertig = p.done ? (p.n || 1) : 0; p.fertig = lsFertig(p); p.done = p.fertig >= (p.n || 1); }); return pr; }
const lsNeueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const lsCm = (v) => isFinite(v) ? fmt(v, 1).replace(/,0$/, "") : "?";
const lsM3 = (p) => (isFinite(p.b) && isFinite(p.h) && isFinite(p.l)) ? p.b * p.h / 10000 * p.l * (p.n || 1) : 0;
function lsSumme(pr){
  const pos = pr.pos || [];
  const m3 = pos.reduce((s, p) => s + lsM3(p), 0);
  const m3f = pos.reduce((s, p) => s + lsM3(p) * lsFertig(p) / (p.n || 1), 0);
  const stk = pos.reduce((s, p) => s + (p.n || 0), 0), stkf = pos.reduce((s, p) => s + lsFertig(p), 0);
  return {anz: pos.length, fertig: pos.filter(p => p.done).length, m3, offen: Math.max(0, m3 - m3f), stk, stkf};
}
function zPlanOffen(pr){
  return (pr.pos || []).map((p, i) => ({id: p.id, nr: i + 1, bez: p.bez || "Position " + (i + 1), b: p.b, h: p.h, l: p.l, rest: (p.n || 1) - lsFertig(p)})).filter(p => p.rest > 0);
}
