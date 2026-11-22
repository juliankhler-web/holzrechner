/* HolzBuch – Rechnen (reine Rechenlogik, ohne Bildschirm)
   Festmeter (Huber-Formel), Rindenabzug je Baumart, Gewicht, Zahlen lesen und formatieren, Summen.
   Braucht: nichts. Wird geprüft in tests/ (node tests/alle.mjs und tests.html). */
"use strict";

/* Rindenabzug in cm vom Mitten-Ø MIT Rinde, gestaffelt nach Durchmesser.
   Quelle: RVR (Rahmenvereinbarung für den Rohholzhandel in Deutschland), Anlage VII
   „Rindenabzugswerte"; verifiziert gegen RVR-Originaldokument (5. Aufl. 2023) + forst-rast.de
   (deckungsgleich für alle 8 Arten). Fichte/Tanne/Douglasie/Buche/Esche = wissenschaftlich
   hergeleitet; Kiefer und Eiche/Lärche = RVR-Orientierungswert (regional abweichend).
   [Obergrenze cm, Abzug cm] – erster passender Schwellwert gilt. */
const RINDENABZUG = {
  fichte:    { name:"Fichte",    steps:[[26,1],[50,2],[Infinity,3]] },
  tanne:     { name:"Tanne",     steps:[[22,1],[38,2],[55,3],[Infinity,4]] },
  kiefer:    { name:"Kiefer",    steps:[[20,1],[36,2],[62,3],[Infinity,4]] },
  laerche:   { name:"Lärche",    steps:[[20,1],[31,2],[42,3],[53,4],[Infinity,5]] },
  douglasie: { name:"Douglasie", steps:[[20,1],[37,2],[53,3],[70,4],[Infinity,5]] },
  eiche:     { name:"Eiche",     steps:[[20,1],[31,2],[42,3],[53,4],[Infinity,5]] },
  buche:     { name:"Buche",     steps:[[41,1],[Infinity,2]] },
  esche:     { name:"Esche",     steps:[[18,1],[29,2],[44,3],[Infinity,4]] },
};

/* Arten, für die der RVR nur einen Orientierungswert nennt (nicht wiss. hergeleitet, regional abweichend). */
const ORIENTIERUNG = new Set(["kiefer","eiche","laerche"]);

/* Gewicht: Raumdichte R = kg Trockenmasse je Festmeter, bezogen auf das FRISCHE Volumen
   (so wird der Festmeter im Wald gemessen). Gewicht je Fm bei Wassergehalt w (Anteil an der
   Gesamtmasse, wie bei Brennholz üblich):  kg/Fm = R / (1 − w).
   Quelle: LWF Bayern, Merkblatt 12 „Der Energieinhalt von Holz" (Raumdichte nach Kollmann 1982):
   Fichte 379, Kiefer 431, Buche 558, Eiche 571 — Formel dort für w = 0/15/20/30/50 % bestätigt.
   Tanne, Lärche, Douglasie, Esche: NÄHERUNG (aus der TFZ-Darrdichte 0,41/0,55/0,47/0,64 g/cm³
   abzüglich Schwindmaß hergeleitet bzw. Literaturwert) → in App und PDF als Näherung markiert. */
const RAUMDICHTE = { fichte:379, tanne:363, kiefer:431, laerche:459, douglasie:413, eiche:571, buche:558, esche:560 };
const RD_NAEHERUNG = new Set(["tanne","laerche","douglasie","esche"]);
const WT_PRESETS = { frisch:50, lufttrocken:20, darr:0 };
const RM_PRESETS = { allgemein:[1.4,2.3], buche:[1.61,2.38], fichte:[1.55,2.52] };
/* --- Helfer --- */
/* de-DE-tolerant: Komma = Dezimaltrenner, Punkt = Tausendertrenner ("1.250,50"→1250.5, "1.200"→1200),
   einzelner Punkt bleibt Dezimaltrenner ("10.50"→10.5). */
const num = (v) => {
  let s = String(v).trim().replace(/[^0-9.,\-]/g, "");
  if(s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return parseFloat(s);
};
const round3 = (v) => Math.round((isFinite(v)?v:0)*1000)/1000;
const round2 = (v) => Math.round((isFinite(v)?v:0)*100)/100;
const fmt = (v,d=3) => (isFinite(v)?v:0).toLocaleString("de-DE",{minimumFractionDigits:d, maximumFractionDigits:d});
const euro = (v) => (isFinite(v)?v:0).toLocaleString("de-DE",{style:"currency", currency:"EUR"});
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nl2br = (s) => escapeHtml(s.trim()).replace(/\n/g,"<br>");

function barkDeduction(speciesKey, dCm){
  const t = RINDENABZUG[speciesKey];
  if(!t) return 0;
  for(const [max, cm] of t.steps){ if(dCm <= max) return cm; }
  return 0;
}
function volumeEach(it){
  let d = it.diameter;
  if(it.bark){ d -= barkDeduction(it.species, it.diameter); if(d < 0) d = 0; }
  const r = d / 200;
  return Math.PI * r * r * it.length;
}
function volumeTotal(it){ return volumeEach(it) * it.qty; }
function kgPerFm(speciesKey, w){
  const r = RAUMDICHTE[speciesKey];
  return r ? r / (1 - w/100) : null;
}
/* Gewicht eines Eintrags (ganze kg) aus dem gerundeten Festmeter – so ist die Summe nachrechenbar. */
function itemKg(it, w){
  const k = kgPerFm(it.species, w);
  return k == null ? null : Math.round(round3(volumeTotal(it)) * k);
}

/* Wassergehalt in % (0–90). Ungültig oder leer → null (dann wird KEIN Gewicht gezeigt statt eines falschen). */
function wasserGueltig(v){
  const w = num(v);
  return (isFinite(w) && w >= 0 && w <= 90) ? w : null;
}
/* Summen über alle Stämme. Jeden Stamm auf 3 Nachkommastellen runden und dann summieren –
   so ergibt die gedruckte Tabelle nachrechenbar die Summe und den €-Betrag. Geld auf ganze Cent,
   damit Netto + MwSt = Brutto immer aufgeht. w = Wassergehalt in % oder null (kein Gewicht). */
function summen(items, price, rate, w){
  const totalFm = round3(items.reduce((s,it)=>s+round3(volumeTotal(it)), 0));
  const netto = round2(totalFm * price);
  const mwst = round2(totalFm * price * rate/100);
  const kg = w != null ? items.reduce((s,it)=>s + (itemKg(it,w) || 0), 0) : null;
  return { totalFm, price, rate, netto, mwst, brutto: netto+mwst, stems: items.reduce((s,it)=>s+it.qty,0), w, kg };
}

/* ---- Holzsorten wie in der Praxis (RVR 2023, Anlage VI-b; Holzvermessungsanweisung Landesforsten RLP, Tab. 6 + 11) ----
   Abschnitt (Stammholz-Standardlänge bis 6 m): gewählt wird die Bestelllänge; abgelängt wird mit Übermaß (1 %, auf cm
     aufgerundet, mindestens 10 cm), gerechnet wird mit der Bestelllänge – das Übermaß zählt nicht.
   Langholz (über 6 m): gemessene Länge; das Übermaß wird abgezogen und auf 10 cm abgerundet (Julian 22.11.2026).
   Brennholz / Industrieholz (1–3 m): ohne Übermaß, Länge = Bestelllänge.
   Durchmesser: in der Praxis auf ganze Zentimeter ABGERUNDET (gilt für alle neu eingetragenen Stämme). */
const SORTEN = {
  abschnitt: { name: "Abschnitt", laengen: [3, 4, 5, 6], standard: 5, hinweis: {3: "Abschnitt", 4: "häufig", 5: "häufig", 6: "längster Standard"} },
  langholz:  { name: "Langholz",  laengen: null },
  brennholz: { name: "Brennholz", laengen: [1, 2, 3], standard: 1, hinweis: {1: "Meterholz", 2: "Schichtholz", 3: "Kurzholz"} },
};
/* Längenübermaß in m: 1 % der Länge, auf ganze cm aufgerundet, mindestens 10 cm */
function laengenUebermass(l){
  if(!(l > 0)) return 0;
  return Math.max(0.10, Math.ceil(l - 1e-9) / 100);
}
/* Rechen-Länge (m) je Sorte. Abschnitt/Brennholz: die Bestelllänge. Langholz: gemessen − Übermaß, auf 10 cm abgerundet
   (größte Länge auf 10 cm, deren Länge + Übermaß noch in die gemessene Länge passt). */
function rechenLaenge(sorte, l){
  if(!(l > 0)) return 0;
  if(sorte !== "langholz") return l;
  let b = Math.floor((l - laengenUebermass(l)) * 10 + 1e-9) / 10;
  while(b + 0.1 + laengenUebermass(b + 0.1) <= l + 1e-9) b = Math.round((b + 0.1) * 10) / 10;
  while(b > 0 && b + laengenUebermass(b) > l + 1e-9) b = Math.round((b - 0.1) * 10) / 10;
  return Math.max(0, b);
}
/* Ablängen auf … (m): nur bei Abschnitten, Bestelllänge + Übermaß */
function ablaengLaenge(l){ return l > 0 ? Math.round((l + laengenUebermass(l)) * 100) / 100 : 0; }
/* Durchmesser wie im Wald: auf ganze cm abgerundet */
function rechenDurchmesser(d){ return d > 0 ? Math.floor(d + 1e-9) : 0; }
