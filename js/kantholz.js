/* Holzmeter – Kantholz-Bereich (Oberfläche)
   Mindest-Zopf, „Mein Ø“, „Aus Holzliste“ mit Auswahl der Maße und Abhaken.
   Braucht: zopf.js, holzliste-daten.js, app.js. */
"use strict";

function fillZopfSelects(){
  els.zKlasse.innerHTML = Object.keys(Z_KLASSEN).map(k => `<option value="${k}">${Z_KLASSEN[k]}</option>`).join("");
  els.zKlasse.value = "B";
}
let zPlanLetzt = null, zPlanMeldung = "", zPlanMass = null;
function zPlanRender(){
  const sel = $("zProj");
  const mitOffen = listen.filter(pr => zPlanOffen(pr).length);
  if(!listen.length){
    sel.innerHTML = ""; els.zValK.textContent = "Aus Holzliste schneiden"; els.zVal.textContent = "–";
    els.zValSub.textContent = "Lege zuerst im Bereich „Holzliste“ ein Projekt an oder lies eine Liste ein."; els.zDraw.innerHTML = ""; els.zHint.textContent = ""; return;
  }
  sel.innerHTML = listen.map(pr => { const n = zPlanOffen(pr).reduce((a, p) => a + p.rest, 0); return `<option value="${pr.id}">${escapeHtml(pr.name)} · ${n ? n + " Stück offen" : "fertig"}</option>`; }).join("");
  if(!listen.some(pr => pr.id === zProjWahl)) zProjWahl = (mitOffen[0] || listen[0]).id;
  sel.value = zProjWahl;
  const pr = listen.find(x => x.id === zProjWahl), kl = els.zKlasse.value;
  const D = num(els.zDia.value), Ls = num($("zLen").value);
  const hint = "Vorschlag ohne Gewähr: Je Maß der noch offenen Balken rechnet die App, wie viele Stück nebeneinander in den Zopf passen " +
    "(Schnittklasse wie oben, 3 mm Sägeschnitt, Zopf-Ø = dünnes Ende ohne Rinde) und welche Längen hintereinander aus der Stammlänge gehen. " +
    "Die Maße sind nach Ausbeute sortiert – das beste ist vorgewählt. Vor dem Einschnitt am Stamm prüfen.";
  const zeig = (k, v, sub) => { els.zValK.textContent = k; els.zVal.textContent = v; els.zValSub.textContent = sub; };
  els.zHint.textContent = hint;
  const offen = zPlanOffen(pr);
  if(!offen.length){ zeig("Aus Holzliste schneiden", "alles fertig", `In „${pr.name}“ ist nichts mehr offen.`); els.zDraw.innerHTML = ""; return; }
  if(!(D > 0 && D <= 300) || !(Ls > 0 && Ls <= 40)){ zeig("Aus Holzliste schneiden", "–", "Zopf-Ø (cm) und Stammlänge (m) oben eingeben"); els.zDraw.innerHTML = ""; return; }
  const erg = zGleichOptionen(D, Ls, kl, offen);
  if(!erg.optionen.length){
    zeig(`Aus Ø ${zCm(D)} cm · ${fmt(Ls, 2)} m`, "nichts passt", erg.zuLang.length && !erg.passtNicht.length ? "Alle offenen Balken sind länger als der Stamm." : "Kein offener Balken passt in diesen Zopf.");
    els.zDraw.innerHTML = zopfSvg([], 0, 0, D, `<b>Ø ${zCm(D)} cm</b> (Zopf)`);
    return;
  }
  if(!erg.optionen.some(o => o.key === zPlanMass)) zPlanMass = erg.optionen[0].key;
  const opt = erg.optionen.find(o => o.key === zPlanMass);
  zPlanLetzt = {pr: pr.id, opt};
  const jePos = {};
  for(const s2 of opt.nutz) for(const t of s2.teile){ (jePos[t.p.id] ||= {p: t.p, n: 0}).n++; }
  const posText = (o) => { const j = {}; for(const s2 of o.nutz) for(const t of s2.teile){ (j[t.p.id] ||= {p: t.p, n: 0}).n++; }
    return Object.values(j).sort((x, y) => x.p.nr - y.p.nr).map(x => `${x.n}× ${escapeHtml(x.p.bez)} ${fmt(x.p.l, 2)} m`).join(", "); };
  zeig(`${lsCm(opt.w)}/${lsCm(opt.h)} cm aus Ø ${zCm(D)} cm · ${fmt(Ls, 2)} m`, `${opt.stk} Stück`, `${fmt(opt.m3)} m³ Balken · Ausbeute ${Math.round(opt.ausbeute * 100)} % vom Zopf-Zylinder`);
  const rects = opt.rects.map((r, i) => Object.assign({}, r, {lab: String(opt.nutz[i] ? opt.nutz[i].teile[0].p.nr : "")}));
  els.zDraw.innerHTML = zopfSvg(rects, opt.cx, opt.cy, D, `<b>Ø ${zCm(D)} cm</b> (Zopf) · ${lsCm(opt.w)}/${lsCm(opt.h)} cm · Platz für ${opt.plaetze} Stück nebeneinander · Zahl = Position`);
  const auswahl = erg.optionen.map(o => `<button type="button" class="z-opt${o.key === opt.key ? " on" : ""}" data-zmass="${o.key}">
      <div class="z-opt-kopf"><b>${lsCm(o.w)}/${lsCm(o.h)} cm</b><span>${Math.round(o.ausbeute * 100)} %</span></div>
      <div class="z-opt-txt">${o.stk} Stück: ${posText(o)}</div></button>`).join("");
  const zeilen = Object.values(jePos).sort((a2, b2) => a2.p.nr - b2.p.nr).map(x =>
    `<div class="zp"><b>${x.p.nr}</b><div>${x.n}× ${escapeHtml(x.p.bez)} ${lsCm(x.p.b)}/${lsCm(x.p.h)} cm · ${fmt(x.p.l, 2)} m<br><span>danach noch ${x.p.rest - x.n} von ${x.p.rest} offen</span></div></div>`).join("");
  const mehrfach = opt.nutz.filter(s2 => s2.teile.length > 1).map(s2 => s2.teile.map(t => fmt(t.l, 2)).join(" + ") + " m");
  let rest = "";
  if(opt.offenStk > opt.stk) rest += `Von diesem Maß bleiben danach noch ${opt.offenStk - opt.stk} Stück offen. `;
  if(opt.nutz.length < opt.plaetze) rest += `Im Stamm wäre Platz für ${opt.plaetze} Stück, gebraucht werden nur ${opt.nutz.length}. `;
  if(erg.passtNicht.length) rest += `Passt nicht in diesen Zopf: ${erg.passtNicht.map(g => lsCm(g.w) + "/" + lsCm(g.h)).join(", ")}. `;
  if(erg.zuLang.length) rest += `Länger als der Stamm: ${erg.zuLang.map(g => lsCm(g.w) + "/" + lsCm(g.h)).join(", ")}.`;
  $("zPlan").innerHTML = (zPlanMeldung ? `<p class="ls-info">${zPlanMeldung}</p>` : "") +
    `<p class="z-opt-titel">Welches Maß willst du schneiden? (${erg.optionen.length} passen)</p><div class="z-opts">${auswahl}</div>
     <div class="z-plan-liste">${zeilen}</div>` +
    (mehrfach.length ? `<p class="z-plan-rest"><b>Hintereinander aus einer Stange:</b> ${mehrfach.join(" · ")}</p>` : "") +
    (rest ? `<p class="z-plan-rest">${rest}</p>` : "") +
    `<button type="button" class="btn-add" id="zPlanOk">${lsIco.check}Geschnitten – in Holzliste abhaken</button>`;
  $("zPlan").querySelectorAll("[data-zmass]").forEach(btn => btn.onclick = () => { zPlanMass = btn.dataset.zmass; renderZopf(); const d = $("zDraw"); if(d) d.scrollIntoView({behavior: "smooth", block: "start"}); });
  $("zPlanOk").onclick = () => {
    const pr2 = listen.find(x => x.id === zPlanLetzt.pr); if(!pr2) return;
    if(!confirm(`${opt.stk} Stück ${lsCm(opt.w)}/${lsCm(opt.h)} cm in „${pr2.name}“ als erstellt abhaken?`)) return;
    for(const x of Object.values(jePos)){ const p = pr2.pos.find(q => q.id === x.p.id); if(p){ p.fertig = Math.min(p.n || 1, lsFertig(p) + x.n); p.done = p.fertig >= (p.n || 1); if(p.done) p.doneAt = new Date().toISOString(); } }
    zPlanMeldung = `✓ ${opt.stk} Stück in „${escapeHtml(pr2.name)}“ abgehakt. Unten die Auswahl für den nächsten Stamm (Ø und Länge anpassen).`;
    lsSpeichern(); lsRender(); renderZopf(); zPlanMeldung = ""; window.scrollTo({top: 0, behavior: "smooth"});
  };
}
function renderZopf(){
  const rev = zMode === "d", plan = zMode === "p";
  els.zModeQ.classList.toggle("on", zMode === "q"); els.zModeQ.setAttribute("aria-pressed", String(zMode === "q"));
  els.zModeD.classList.toggle("on", rev);  els.zModeD.setAttribute("aria-pressed", String(rev));
  $("zModeP").classList.toggle("on", plan); $("zModeP").setAttribute("aria-pressed", String(plan));
  els.zDiaRow.style.display = (rev || plan) ? "block" : "none";
  $("zProjRow").style.display = $("zLenRow").style.display = plan ? "block" : "none";
  $("zMassRow").style.display = plan ? "none" : "";
  $("zPlan").innerHTML = "";
  if(plan){ zPlanRender(); return; }
  els.zNField.style.display = rev ? "none" : "";
  const kl = els.zKlasse.value;
  const b = num(els.zB.value), h = num(els.zH.value);
  const rule = "Eigene Berechnung nach den Regeln der Schnittklassen: S ohne Baumkante, A Baumkante bis 1/8 der Balkenhöhe, " +
    "B bis 1/3, C jede Seite angesägt; 3 mm Sägeschnitt zwischen den Balken, Ø auf 1 mm aufgerundet. Gilt für gerade, " +
    "einigermaßen runde Stämme ohne Rinde (krumm oder oval: stärker wählen). Gemeint ist der Zopf-Ø (dünnes Ende), " +
    "nicht der Mittendurchmesser. Ohne Gewähr – vor dem Einschnitt am Stamm prüfen.";
  const show = (k, v, sub, svg, hint) => {
    els.zValK.textContent = k; els.zVal.textContent = v; els.zValSub.textContent = sub;
    els.zDraw.innerHTML = svg; els.zHint.textContent = hint;
  };
  const kLabel = rev ? "Wie viele Stück passen?" : "Nötiger Zopf-Ø";
  if(!(b > 0 && h > 0 && b <= 150 && h <= 150)){
    show(kLabel, "–", "Breite und Höhe in cm eingeben (bis 150 cm)", "", rule); return;
  }
  if(!rev){
    const n = Number(els.zN.value);
    if(!(Number.isInteger(n) && n >= 1 && n <= 500)){ show(kLabel, "–", "Stückzahl 1 bis 500 eingeben", "", rule); return; }
    const r = zBestForCount(b, h, n, kl);
    if(!r){ show(kLabel, "–", "Zu viele Balken für eine Rechnung", "", rule); return; }
    const D = zUp(r.D);
    show(kLabel, zCm(D) + " cm", `Anordnung: ${r.label}`,
      zopfSvg(r.rects, r.cx, r.cy, D, `<b>Ø ${zCm(D)} cm</b> (Zopf) · ${n} Stück à ${zCm(b)} × ${zCm(h)} cm`), rule);
    return;
  }
  const D = num(els.zDia.value);
  if(!(D > 0 && D <= 300)){ show(kLabel, "–", "Zopf-Ø oben eingeben (bis 300 cm)", "", rule); return; }
  const r = zFitInD(D, b, h, kl);
  const sq = zMaxSquare(D, kl), sqTxt = sq >= 1 ? ` · größter quadratischer Balken: ${zCm(Math.floor(sq*10)/10)} × ${zCm(Math.floor(sq*10)/10)} cm` : "";
  if(r.count === 0){
    const need = zUp(zClassic(b, h, 0, kl).D);
    show(`Passt aus Ø ${zCm(D)} cm`, "passt nicht", `1 Stück ${zCm(b)} × ${zCm(h)} cm braucht Ø ${zCm(need)} cm` + sqTxt,
      zopfSvg([], 0, 0, D, `<b>Ø ${zCm(D)} cm</b> (Zopf)`), rule);
    return;
  }
  show(`Passt aus Ø ${zCm(D)} cm`, `${r.count} Stück`, `à ${zCm(b)} × ${zCm(h)} cm · ${r.label}` + sqTxt,
    zopfSvg(r.rects, r.cx, r.cy, D, `<b>Ø ${zCm(D)} cm</b> (Zopf) · ${r.count} Stück à ${zCm(b)} × ${zCm(h)} cm`), rule);
}
let zTimer = null;   /* „Aus Holzliste“ rechnet länger → beim Tippen kurz warten */
[els.zKlasse, els.zB, els.zH, els.zN, els.zDia].forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", ()=>{
  savePrefs(); clearTimeout(zTimer);
  if(zMode === "p" && el.tagName !== "SELECT") zTimer = setTimeout(renderZopf, 350); else renderZopf();
}));
els.zModeQ.addEventListener("click", ()=>{ if(zMode === "q") return; zMode = "q"; savePrefs(); renderZopf(); });
$("zModeP").addEventListener("click", ()=>{ if(zMode === "p") return; zMode = "p"; savePrefs(); renderZopf(); });
$("zProj").addEventListener("change", ()=>{ zProjWahl = $("zProj").value; savePrefs(); renderZopf(); });
$("zLen").addEventListener("input", ()=>{ savePrefs(); clearTimeout(zTimer); zTimer = setTimeout(renderZopf, 350); });
els.zModeD.addEventListener("click", ()=>{
  if(zMode === "d") return;
  zMode = "d"; savePrefs(); renderZopf();
  if(!els.zDia.value.trim()) els.zDia.focus();
});
