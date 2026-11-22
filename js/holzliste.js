/* HolzBuch – Holzliste (Oberfläche)
   Projekte, Positionen abhaken, PDF zum Abhaken, Einlesen mit Prüf-Ansicht.
   Braucht: holzliste-daten.js, holzliste-parser.js, app.js. */
"use strict";

/* --- Holzliste: Projekte mit Positionen zum Abhaken, Einlesen aus PDF / Foto / XML / CSV / Excel --- */
function lsLaden(){ try{ const v = JSON.parse(localStorage.getItem(K_LISTEN)); return Array.isArray(v) ? v.map(lsNorm) : []; }catch(e){ return []; } }
function lsSpeichern(){ listen.forEach(lsNorm); const v = JSON.stringify(listen); try{ localStorage.setItem(K_LISTEN, v); }catch(e){ alert("Speicher voll: Die Holzliste konnte nicht gesichert werden."); } nativSpiegeln(K_LISTEN, v); }
let listen = lsLaden();
let lsEditPos = null;          // Position, die gerade im Formular geändert wird
const lsProj = () => listen.find(p => p.id === lsOpen) || null;
const lsIco = {
  check: '<svg viewBox="0 0 24 24"><path d="M9.5 16.6 4.9 12l-1.4 1.4 6 6 11-11-1.4-1.4z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6zm3-10h2v9H9zm4 0h2v9h-2zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  zopf: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 110 16 8 8 0 010-16zM8 8h8v8H8z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  datei: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm4 18H6V4h7v5h5zM8 12h8v2H8zm0 4h8v2H8z"/></svg>',
  pdf: '<svg viewBox="0 0 24 24"><path d="M19 2H8a2 2 0 00-2 2v12a2 2 0 002 2h11a2 2 0 002-2V4a2 2 0 00-2-2zM8 4h11v12H8zm-4 4H2v12a2 2 0 002 2h12v-2H4z"/></svg>',
  foto: '<svg viewBox="0 0 24 24"><path d="M9 3 7.5 5H4a2 2 0 00-2 2v11a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2h-3.5L15 3zm3 5a5 5 0 110 10 5 5 0 010-10zm0 2.2A2.8 2.8 0 1012 15.8 2.8 2.8 0 0012 10.2z"/></svg>',
};

function lsRender(){
  const v = $("lsView");
  if(!v) return;
  const pr = lsProj();
  if(!pr){ lsOpen = null; v.innerHTML = lsUebersichtHtml(); }
  else v.innerHTML = lsProjektHtml(pr);
}
function lsUebersichtHtml(){
  let h = `<div class="list-head"><h2>Holzlisten</h2></div>`;
  if(!listen.length){
    h += `<div class="card empty">${lsIco.datei}Noch keine Holzliste. Lege ein Projekt an, z. B. „Dachstuhl Müller“, und trage die Balken ein. Oder lies eine fertige Liste ein.</div>`;
  }else{
    h += `<div class="ls-plist">` + listen.map(pr => {
      const s = lsSumme(pr), proz = s.anz ? Math.round(s.fertig / s.anz * 100) : 0, ganz = s.anz && s.fertig === s.anz;
      return `<button type="button" class="card ls-proj" data-ls-open="${pr.id}">
        <div class="top"><span class="nm">${escapeHtml(pr.name)}</span><span class="cnt">${ganz ? "✓ fertig" : s.fertig + "/" + s.anz}</span></div>
        <div class="ls-bar"><i style="width:${proz}%"></i></div>
        <div class="ls-meta">${s.anz} Position${s.anz === 1 ? "" : "en"} · ${fmt(s.m3)} m³${s.anz && !ganz ? " · noch " + fmt(s.offen) + " m³ offen" : ""}</div>
      </button>`;
    }).join("") + `</div>`;
  }
  h += `<button type="button" class="btn-add" data-ls="neu">${lsIco.plus}Neues Projekt</button>
        <div class="ls-zwei">
          <button type="button" class="btn-pdf" data-ls="import">${lsIco.datei}Datei einlesen</button>
          <button type="button" class="btn-pdf" data-ls="foto">${lsIco.foto}Liste fotografieren</button>
        </div>
        <p class="ls-hinweis">Einlesen: cadwork-Liste (.cwlm), PDF, XML (auch BTLx), CSV, Excel oder ein Foto der Liste. Vor dem Übernehmen prüfst du jede Zeile.</p>`;
  return h;
}
function lsProjektHtml(pr){
  const s = lsSumme(pr);
  const ed = lsEditPos ? (pr.pos || []).find(p => p.id === lsEditPos) : null;
  const val = (k, d) => ed ? (k === "bez" ? escapeHtml(ed.bez || "") : k === "l" ? (isFinite(ed.l) ? fmt(ed.l, 2) : "") : k === "n" ? String(ed.n || 1) : (isFinite(ed[k]) ? lsCm(ed[k]) : "")) : d;
  let h = `<button type="button" class="ls-back" data-ls="zurueck">‹ Alle Holzlisten</button>
  <div class="total" role="status">
    <div class="lbl ls-titel"><span>${escapeHtml(pr.name)}</span></div>
    <div class="val">${s.fertig}<small> von ${s.anz} erledigt</small></div>
    <div class="ls-bar hell"><i style="width:${s.anz ? Math.round(s.fertig / s.anz * 100) : 0}%"></i></div>
    <div class="sub">${fmt(s.m3)} m³ gesamt${s.anz ? " · noch " + fmt(s.offen) + " m³ offen" : ""} · ${s.stkf} von ${s.stk} Stück fertig</div>
  </div>
  <div class="ls-tools">
    <button type="button" data-ls="umbenennen" aria-label="Projekt umbenennen">${lsIco.edit}Name</button>
    <button type="button" data-ls="import" aria-label="Datei einlesen">${lsIco.datei}Datei</button>
    <button type="button" data-ls="foto" aria-label="Liste fotografieren">${lsIco.foto}Foto</button>
    <button type="button" data-ls="projLoeschen" class="rot" aria-label="Projekt löschen">${lsIco.del}Löschen</button>
  </div>
  <form class="card pad mb" id="lsForm" autocomplete="off">
    <p class="card-title">${lsIco.plus}${ed ? "Position ändern" : "Position hinzufügen"}</p>
    <div class="row"><div class="field"><label for="lsBez">Bezeichnung</label><input type="text" id="lsBez" placeholder="Sparren" value="${val("bez", "")}" maxlength="80"></div></div>
    <div class="row">
      <div class="field"><label for="lsB">Breite (cm)</label><input type="text" id="lsB" inputmode="decimal" placeholder="8" value="${val("b", "")}"></div>
      <div class="field"><label for="lsH">Höhe (cm)</label><input type="text" id="lsH" inputmode="decimal" placeholder="18" value="${val("h", "")}"></div>
    </div>
    <div class="row">
      <div class="field"><label for="lsL">Länge (m)</label><input type="text" id="lsL" inputmode="decimal" placeholder="6,20" value="${val("l", "")}"></div>
      <div class="field small"><label for="lsN">Stück</label><input type="number" id="lsN" inputmode="numeric" min="1" step="1" value="${val("n", "1")}"></div>
    </div>
    <button type="submit" class="btn-add">${lsIco.plus}<span>${ed ? "Änderung speichern" : "Hinzufügen"}</span></button>
    ${ed ? `<button type="button" class="btn-cancel" style="display:block" data-ls="editAbbruch">Ändern abbrechen</button>` : ""}
  </form>`;
  const pos = pr.pos || [];
  if(pos.length){
    h += `<div class="list-head"><h2>Positionen</h2>
      <label class="ls-hide"><input type="checkbox" id="lsHideChk" ${lsHide ? "checked" : ""}> Erledigte ausblenden</label></div>`;
    const sicht = pos.filter(p => !(lsHide && p.done));
    h += `<div class="ls-items">` + sicht.map(p => {
      const nr = pos.indexOf(p) + 1;
      const fehlt = !(isFinite(p.b) && isFinite(p.h) && isFinite(p.l));
      return `<div class="card item ls-row${p.done ? " done" : ""}${lsEditPos === p.id ? " active" : ""}">
        <button type="button" class="ls-chk${p.done ? " on" : ""}" data-ls-done="${p.id}" role="checkbox" aria-checked="${p.done ? "true" : "false"}" aria-label="${escapeHtml(p.bez || "Position " + nr)} erledigt"><span>${p.done ? lsIco.check : lsFertig(p) > 0 ? "<i>" + lsFertig(p) + "</i>" : ""}</span></button>
        <div class="info">
          <div class="fm">${escapeHtml(p.bez || "Position " + nr)}</div>
          ${lsFertig(p) > 0 && !p.done ? `<div class="ls-teil">${lsFertig(p)} von ${p.n || 1} Stück fertig</div>` : ""}
          <div class="meta">${p.n || 1} Stück · ${lsCm(p.b)}/${lsCm(p.h)} cm · ${isFinite(p.l) ? fmt(p.l, 2) : "?"} m · ${fmt(lsM3(p))} m³${fehlt ? ' · <b class="ls-warn">Maß fehlt</b>' : ""}</div>
        </div>
        <button type="button" class="icon-btn edit" data-ls-zopf="${p.id}" aria-label="Im Kantholz-Rechner prüfen" title="Nötigen Zopf-Ø im Kantholz-Rechner zeigen">${lsIco.zopf}</button>
        <button type="button" class="icon-btn edit" data-ls-edit="${p.id}" aria-label="Ändern">${lsIco.edit}</button>
        <button type="button" class="icon-btn del" data-ls-del="${p.id}" aria-label="Löschen">${lsIco.del}</button>
      </div>`;
    }).join("") + `</div>`;
    if(lsHide && sicht.length < pos.length) h += `<p class="ls-hinweis">${pos.length - sicht.length} erledigte Position${pos.length - sicht.length === 1 ? "" : "en"} ausgeblendet.</p>`;
    h += `<button type="button" class="btn-pdf" data-ls="pdf">${lsIco.pdf}${IST_NATIVE ? "PDF erstellen und teilen" : "Als PDF herunterladen"}</button>`;
  }else{
    h += `<div class="card empty">Noch keine Positionen. Oben eintragen oder mit „Einlesen“ aus einer Datei übernehmen.</div>`;
  }
  return h;
}

/* Klicks im Bereich Holzliste */
document.addEventListener("click", (e) => {
  const v = $("lsView");
  if(!v || !v.contains(e.target)) return;
  const t = e.target.closest("[data-ls],[data-ls-open],[data-ls-done],[data-ls-edit],[data-ls-del],[data-ls-zopf]");
  if(!t) return;
  const pr = lsProj();
  if(t.dataset.lsOpen){ lsOpen = t.dataset.lsOpen; lsEditPos = null; savePrefs(); lsRender(); window.scrollTo({top: 0}); return; }
  if(t.dataset.lsDone && pr){
    const p = pr.pos.find(x => x.id === t.dataset.lsDone); if(!p) return;
    p.done = !p.done; p.fertig = p.done ? (p.n || 1) : 0; p.doneAt = p.done ? new Date().toISOString() : null;
    lsSpeichern(); lsRender(); return;
  }
  if(t.dataset.lsEdit && pr){ lsEditPos = t.dataset.lsEdit; lsRender(); const f = $("lsForm"); if(f) f.scrollIntoView({behavior: "smooth", block: "start"}); return; }
  if(t.dataset.lsDel && pr){
    const p = pr.pos.find(x => x.id === t.dataset.lsDel); if(!p) return;
    if(!confirm(`Position „${p.bez || "ohne Namen"}“ löschen?`)) return;
    pr.pos = pr.pos.filter(x => x !== p); if(lsEditPos === p.id) lsEditPos = null;
    lsSpeichern(); lsRender(); return;
  }
  if(t.dataset.lsZopf && pr){
    const p = pr.pos.find(x => x.id === t.dataset.lsZopf); if(!p) return;
    if(!(isFinite(p.b) && isFinite(p.h))){ alert("Für diese Position fehlt der Querschnitt."); return; }
    els.zB.value = lsCm(p.b); els.zH.value = lsCm(p.h); els.zN.value = 1; zMode = "q";
    showTab("kant"); savePrefs(); renderZopf(); window.scrollTo({top: 0}); return;
  }
  switch(t.dataset.ls){
    case "neu": {
      const n = prompt("Name des Projekts (z. B. Dachstuhl Müller):", "");
      if(n == null) return;
      const pr2 = {id: lsNeueId(), name: n.trim().slice(0, 80) || "Neues Projekt", angelegt: new Date().toISOString(), pos: []};
      listen.unshift(pr2); lsOpen = pr2.id; lsEditPos = null; lsSpeichern(); savePrefs(); lsRender(); window.scrollTo({top: 0});
      setTimeout(() => { const b = $("lsBez"); if(b) b.focus(); }, 50);
      return;
    }
    case "zurueck": lsOpen = null; lsEditPos = null; savePrefs(); lsRender(); window.scrollTo({top: 0}); return;
    case "umbenennen": {
      if(!pr) return;
      const n = prompt("Neuer Name:", pr.name); if(n == null || !n.trim()) return;
      pr.name = n.trim().slice(0, 80); lsSpeichern(); lsRender(); return;
    }
    case "projLoeschen": {
      if(!pr) return;
      if(!confirm(`Projekt „${pr.name}“ mit ${pr.pos.length} Positionen löschen? Das lässt sich nicht rückgängig machen.`)) return;
      listen = listen.filter(x => x !== pr); lsOpen = null; lsEditPos = null; lsSpeichern(); savePrefs(); lsRender(); return;
    }
    case "editAbbruch": lsEditPos = null; lsRender(); return;
    case "import": $("lsFile").click(); return;
    case "foto": $("lsCam").click(); return;
    case "pdf": if(pr) lsPdf(pr); return;
  }
});
document.addEventListener("change", (e) => {
  if(e.target && e.target.id === "lsHideChk"){ lsHide = e.target.checked; savePrefs(); lsRender(); }
});
document.addEventListener("submit", (e) => {
  if(!e.target || e.target.id !== "lsForm") return;
  e.preventDefault();
  const pr = lsProj(); if(!pr) return;
  const bez = $("lsBez").value.trim().slice(0, 80), b = num($("lsB").value), h = num($("lsH").value), l = num($("lsL").value);
  const n = Math.max(1, Math.round(num($("lsN").value) || 1));
  if(!(b > 0 && b <= 200) || !(h > 0 && h <= 200)){ alert("Bitte Breite und Höhe in cm eintragen (z. B. 8 und 18)."); return; }
  if(!(l > 0 && l <= 60)){ alert("Bitte die Länge in Metern eintragen (z. B. 6,20)."); return; }
  if(lsEditPos){
    const p = pr.pos.find(x => x.id === lsEditPos);
    if(p){ Object.assign(p, {bez, b, h, l, n}); p.fertig = lsFertig(p); p.done = p.fertig >= n; }
    lsEditPos = null;
  }else pr.pos.push({id: lsNeueId(), bez, b, h, l, n, fertig: 0, done: false});
  lsSpeichern(); lsRender();
  const f = $("lsBez"); if(f && !lsEditPos){ f.focus(); }
});

/* --- PDF der Holzliste (zum Abhaken in der Werkstatt) --- */
function lsPdf(pr){
  const pos = pr.pos || [], s = lsSumme(pr);
  if(!pos.length){ alert("Die Liste ist noch leer."); return; }
  const now = new Date();
  const dateStr = now.toLocaleDateString("de-DE", {day: "2-digit", month: "2-digit", year: "numeric"});
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dateiname = ("Holzliste " + pr.name + " " + iso).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() + ".pdf";
  if(IST_NATIVE){
    (async () => {
      const J = window.jspdf && window.jspdf.jsPDF;
      if(!J) throw new Error("PDF-Baustein fehlt");
      const doc = new J({unit: "mm", format: "a4", compress: true});
      for(const m of ["text", "splitTextToSize", "getTextWidth"]){
        const orig = doc[m];
        doc[m] = function(tx, ...rest){ const an = v => typeof v === "string" ? pdfText(v) : Array.isArray(v) ? v.map(an) : v; return orig.call(this, an(tx), ...rest); };
      }
      const L = 16, R = 194, GRUEN = [15, 110, 86], GRAU = [120, 120, 120];
      let y = 20;
      doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...GRUEN); doc.text(appName, L, y);
      y += 3; doc.setDrawColor(...GRUEN); doc.setLineWidth(0.6); doc.line(L, y, R, y); y += 8;
      doc.setTextColor(0, 0, 0); doc.setFontSize(13); doc.text("Holzliste: " + pr.name, L, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...GRAU); doc.text(dateStr, R, y, {align: "right"});
      y += 5;
      const body = pos.map((p, i) => ["", String(i + 1), p.bez || "", lsCm(p.b) + "/" + lsCm(p.h), isFinite(p.l) ? fmt(p.l, 2) : "?", (lsFertig(p) > 0 && !p.done ? lsFertig(p) + " von " : "") + (p.n || 1), fmt(lsM3(p))]);
      const rechts = {1: {halign: "right"}, 4: {halign: "right"}, 5: {halign: "right"}, 6: {halign: "right"}};
      doc.autoTable({
        startY: y, head: [["", "Nr", "Bezeichnung", "B/H (cm)", "Länge (m)", "Stück", "m³"]], body, theme: "plain", margin: {left: L, right: 210 - R},
        styles: {font: "helvetica", fontSize: 9.5, cellPadding: 1.8, textColor: [0, 0, 0], lineColor: [204, 204, 204]},
        headStyles: {fontStyle: "bold", lineWidth: {bottom: 0.5}, lineColor: [51, 51, 51]},
        bodyStyles: {lineWidth: {bottom: 0.15}}, columnStyles: Object.assign({0: {cellWidth: 9}}, rechts),
        didParseCell: (d) => { if(d.section === "head" && rechts[d.column.index]) d.cell.styles.halign = "right"; if(d.section === "body" && pos[d.row.index].done) d.cell.styles.textColor = [130, 130, 130]; },
        didDrawCell: (d) => {
          if(d.section !== "body" || d.column.index !== 0) return;
          const k = 4, x = d.cell.x + 2, yy = d.cell.y + (d.cell.height - k) / 2;
          doc.setDrawColor(...GRUEN); doc.setLineWidth(0.35); doc.rect(x, yy, k, k);
          if(pos[d.row.index].done){ doc.setLineWidth(0.6); doc.line(x + 0.8, yy + 2.1, x + 1.7, yy + 3.2); doc.line(x + 1.7, yy + 3.2, x + 3.4, yy + 0.8); }
        },
      });
      y = doc.lastAutoTable.finalY + 8; if(y > 265){ doc.addPage(); y = 20; }
      doc.setFontSize(10.5); doc.setTextColor(0, 0, 0);
      [["Positionen", `${s.anz} (${s.fertig} erledigt)`], ["Stück", `${s.stk} (${s.stkf} fertig)`], ["Holz gesamt", fmt(s.m3) + " m³"], ["Davon noch offen", fmt(s.offen) + " m³"]]
        .forEach(([a, b]) => { doc.text(a, L + 90, y); doc.text(b, R, y, {align: "right"}); y += 5.5; });
      y += 4; doc.setFontSize(7.5); doc.setTextColor(...GRAU);
      doc.text("m³ = Breite × Höhe × Länge × Stück (ohne Verschnitt) · erstellt mit " + appName, L, y);
      await nativDateiTeilen(doc.output("blob"), dateiname);
    })().catch(e => alert("PDF konnte nicht erstellt werden: " + (e && e.message ? e.message : e)));
    return;
  }
  const rows = pos.map((p, i) => `<tr${p.done ? ' style="color:#888"' : ""}><td style="font-size:14px">${p.done ? "☑" : "☐"}</td><td class="r">${i + 1}</td><td>${escapeHtml(p.bez || "")}</td><td class="r">${lsCm(p.b)}/${lsCm(p.h)}</td><td class="r">${isFinite(p.l) ? fmt(p.l, 2) : "?"}</td><td class="r">${lsFertig(p) > 0 && !p.done ? lsFertig(p) + " von " : ""}${p.n || 1}</td><td class="r">${fmt(lsM3(p))}</td></tr>`).join("");
  els.printArea.innerHTML = `<div class="p-brand">${escapeHtml(appName)}</div><hr class="p-rule">
    <div class="p-headline"><span class="p-sub"><b>Holzliste: ${escapeHtml(pr.name)}</b></span><span class="p-date">${dateStr}</span></div>
    <table><thead><tr><th></th><th class="r">Nr</th><th>Bezeichnung</th><th class="r">B/H&nbsp;(cm)</th><th class="r">Länge&nbsp;(m)</th><th class="r">Stück</th><th class="r">m³</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="p-tot">
      <div class="pt-row"><span>Positionen</span><span>${s.anz} (${s.fertig} erledigt)</span></div>
      <div class="pt-row"><span>Stück</span><span>${s.stk} (${s.stkf} fertig)</span></div>
      <div class="pt-row"><span>Holz gesamt</span><span>${fmt(s.m3)} m³</span></div>
      <div class="pt-row grand"><span>Davon noch offen</span><span>${fmt(s.offen)} m³</span></div>
    </div>
    <div class="p-foot">m³ = Breite × Höhe × Länge × Stück (ohne Verschnitt) · erstellt mit ${escapeHtml(appName)}</div>`;
  const prevTitle = document.title;
  document.title = dateiname.replace(/\.pdf$/, "");
  const restore = () => { document.title = prevTitle; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 3000);
}

/* --- Einlesen --- */
const lsOv = {el: $("lsOv"), body: $("lsOvBody")};
let lsRev = null;              // Prüf-Ansicht: {pos, secU, lenU, name, quelle, ocr, ziel}
let lsAbbruch = false;
let lsOcrWorker = null;
function lsOvAuf(){ lsOv.el.classList.add("open"); document.body.style.overflow = "hidden"; }
function lsOvZu(){
  lsAbbruch = true; lsOv.el.classList.remove("open"); document.body.style.overflow = ""; lsRev = null;
  if(lsOcrWorker){ const w = lsOcrWorker; lsOcrWorker = null; w.terminate().catch(() => {}); }
}
$("lsOvClose").addEventListener("click", lsOvZu);
function lsStatus(text, anteil){
  lsOv.body.innerHTML = `<div class="ls-lade"><div class="ls-spin" aria-hidden="true"></div><p>${escapeHtml(text)}</p>
    ${anteil != null ? `<div class="ls-bar"><i style="width:${Math.round(anteil * 100)}%"></i></div>` : ""}
    <button type="button" class="btn-cancel" style="display:block" id="lsStop">Abbrechen</button></div>`;
  $("lsStop").onclick = lsOvZu;
}
const lsSkript = (src) => new Promise((ok, err) => {
  if(document.querySelector(`script[data-src="${src}"]`)) return ok();
  const s = document.createElement("script"); s.src = src; s.dataset.src = src; s.onload = ok; s.onerror = () => err(new Error("Baustein fehlt: " + src)); document.head.appendChild(s);
});
let lsPdfjs = null;
async function lsPdfBaustein(){
  if(lsPdfjs) return lsPdfjs;
  const m = await import(new URL("libs/pdfjs/pdf.min.mjs", document.baseURI).href);
  m.GlobalWorkerOptions.workerSrc = new URL("libs/pdfjs/pdf.worker.min.mjs", document.baseURI).href;
  return lsPdfjs = m;
}
async function lsOcrBaustein(fortschritt){
  await lsSkript("libs/tesseract/tesseract.min.js");
  if(lsOcrWorker) return lsOcrWorker;
  const basis = new URL("libs/tesseract/", document.baseURI).href;
  /* Sprachdatei liegt ungepackt bei: Android entfernt beim Bauen die Endung „.gz“ aus dem App-Paket */
  let fehler = null;
  const w = await Promise.race([
    Tesseract.createWorker("deu", 1, {
      workerPath: basis + "worker.min.js", corePath: basis + "core", langPath: basis + "lang", gzip: false,
      workerBlobURL: false, cacheMethod: "none",
      logger: (m) => { if(m && m.status === "recognizing text" && fortschritt) fortschritt(m.progress); },
      errorHandler: (e) => { fehler = e; },
    }),
    new Promise((_, nein) => { const t0 = Date.now(); const iv = setInterval(() => {
      if(fehler || Date.now() - t0 > 60000){ clearInterval(iv); nein(new Error("Die Texterkennung konnte nicht starten" + (fehler ? ": " + (fehler.message || fehler) : " (Zeitüberschreitung)."))); }
      if(lsOcrWorker || lsAbbruch) clearInterval(iv);
    }, 300); }),
  ]);
  await w.setParameters({tessedit_pageseg_mode: "6", preserve_interword_spaces: "1"});
  return lsOcrWorker = w;
}
/* Foto aufbereiten: auf gut lesbare Größe bringen, Grau, Kontrast strecken, leicht schärfen */
async function lsBildAufbereiten(quelle){
  const img = await new Promise((ok, err) => {
    if(quelle instanceof HTMLCanvasElement) return ok(quelle);
    const i = new Image(); const u = URL.createObjectURL(quelle);
    i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); err(new Error("Das Bild konnte nicht geöffnet werden.")); }; i.src = u;
  });
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const lang = Math.max(w0, h0);
  const f = lang < 2400 ? Math.min(2, 2400 / lang) : lang > 3600 ? 3600 / lang : 1;
  const W = Math.round(w0 * f), H = Math.round(h0 * f);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", {willReadFrequently: true});
  x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H), p = d.data, g = new Uint8ClampedArray(W * H), hist = new Uint32Array(256);
  for(let i = 0, j = 0; i < p.length; i += 4, j++){ const v = (p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8; g[j] = v; hist[v]++; }
  let lo = 0, hi = 255, acc = 0; const cut = W * H * 0.01;
  for(; lo < 255; lo++){ acc += hist[lo]; if(acc > cut) break; }
  acc = 0; for(; hi > 0; hi--){ acc += hist[hi]; if(acc > cut) break; }
  const sp = Math.max(1, hi - lo);
  for(let j = 0; j < g.length; j++) g[j] = Math.max(0, Math.min(255, (g[j] - lo) * 255 / sp));
  for(let yy = 0; yy < H; yy++) for(let xx = 0; xx < W; xx++){
    const j = yy * W + xx, i = j * 4;
    let v = g[j];
    if(xx > 0 && yy > 0 && xx < W - 1 && yy < H - 1) v = v * 2 - (g[j - 1] + g[j + 1] + g[j - W] + g[j + W]) / 4;
    v = Math.max(0, Math.min(255, v)); p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}
async function lsOcr(bild, text){
  lsStatus(text + " Texterkennung wird vorbereitet …", 0);
  const w = await lsOcrBaustein((a) => { if(!lsAbbruch) lsStatus(text + " Texterkennung läuft …", a); });
  const c = await lsBildAufbereiten(bild);
  if(lsAbbruch) return [];
  const r = await w.recognize(c);
  return LP.ocrZeilen(r.data);
}
async function lsDateiLesen(f){
  const name = f.name || "Liste", endung = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || "";
  const typ = (f.type || "").toLowerCase(), e = endung.toLowerCase();
  const text = async () => { const b = await f.arrayBuffer(); try{ return new TextDecoder("utf-8", {fatal: true}).decode(b); }catch(_){ return new TextDecoder("windows-1252").decode(b); } };
  /* Dateianfang prüfen statt nur der Endung (Handys hängen z. B. „.zip“ an): ZIP = Excel oder cadwork, sonst Binärdatei abweisen */
  const kopfBytes = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
  const istZip = kopfBytes[0] === 0x50 && kopfBytes[1] === 0x4B;
  const istPdf = kopfBytes[0] === 0x25 && kopfBytes[1] === 0x50 && kopfBytes[2] === 0x44 && kopfBytes[3] === 0x46;
  const istBild = (kopfBytes[0] === 0xFF && kopfBytes[1] === 0xD8) || (kopfBytes[0] === 0x89 && kopfBytes[1] === 0x50) || typ.startsWith("image/") || /^(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/.test(e);
  const CADWORK = "Das ist eine cadwork-Projektdatei, darin steckt das ganze 3D-Modell und keine fertige Liste. Bitte in cadwork die Stückliste als PDF ausgeben (oder als Excel/CSV) und diese Datei einlesen.";
  if(istZip){
    const namen = new TextDecoder("latin1").decode(new Uint8Array(await f.arrayBuffer()).subarray(0, Math.min(f.size, 4 * 1024 * 1024)));
    if(/CONTENT_3D\.FDB/.test(namen)){
      lsStatus("cadwork-Datei wird gelesen …");
      const z = await LP.zipDateien(await f.arrayBuffer(), n => n === "CONTENT_3D.FDB", true);
      if(!z["CONTENT_3D.FDB"]) throw new Error(CADWORK);
      const erg = LP.cadworkListe(z["CONTENT_3D.FDB"]);
      if(!erg.pos.length) throw new Error("In dieser cadwork-Datei ist keine Stückliste mit Maßen gespeichert. Bitte in cadwork die Stückliste als PDF ausgeben.");
      return {erg, ocr: false, quelle: name, zeilen: []};
    }
    if(/\.cwlm|\.3d\b/i.test(namen) || /^(cwlm|cwp|cwps|3d)$/.test(e) || /\.cwlm\./i.test(name)) throw new Error(CADWORK);
    if(/xl\/worksheets\//.test(namen)){
      lsStatus("Excel-Datei wird gelesen …");
      const zeilen = await LP.xlsxZeilen(await f.arrayBuffer(), DOMParser);
      return {erg: LP.lies(zeilen), ocr: false, quelle: name, zeilen};
    }
    throw new Error("Das ist eine gepackte Datei (ZIP). Bitte zuerst entpacken und dann die Liste (PDF, Excel, CSV oder XML) einlesen.");
  }
  if(!istPdf && !istBild){
    let steuer = 0; const n = Math.min(kopfBytes.length, 4096);
    for(let i = 0; i < n; i++){ const c = kopfBytes[i]; if(c === 0 || (c < 9) || (c > 13 && c < 32 && c !== 27)) steuer++; }
    if(n && steuer / n > 0.02) throw new Error(/^(cwlm|cwp|cwps|3d|2dc|ivx)$/.test(e) || /\.cwlm/i.test(name) ? CADWORK : "Diese Datei kann Holzmeter nicht lesen. Möglich sind PDF, Foto, XML (auch BTLx), CSV, TXT und Excel (.xlsx).");
  }
  if(istPdf || e === "pdf" || typ === "application/pdf"){
    lsStatus("PDF wird gelesen …");
    const pdfjs = await lsPdfBaustein();
    const doc = await pdfjs.getDocument({data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false, useSystemFonts: true, disableFontFace: true}).promise;
    const seiten = Math.min(doc.numPages, 30);
    let zeilen = [], ocr = false;
    for(let s = 1; s <= seiten; s++){
      if(lsAbbruch) return null;
      lsStatus(`PDF wird gelesen … Seite ${s} von ${seiten}`, (s - 1) / seiten);
      const pg = await doc.getPage(s), vp = pg.getViewport({scale: 1}), tc = await pg.getTextContent();
      const st = tc.items.filter(it => it.str != null && it.str.trim()).map(it => ({t: it.str, x0: it.transform[4], x1: it.transform[4] + it.width, y: vp.height - it.transform[5], hgt: Math.abs(it.transform[3]) || it.height}));
      if(st.reduce((n, it) => n + it.t.length, 0) >= 25){ zeilen.push(...LP.zuZeilen(st)); continue; }
      /* eingescannte Seite (nur Bild) → Seite als Bild zeichnen und Texterkennung */
      ocr = true;
      const skal = Math.min(3, 2600 / Math.max(vp.width, vp.height));
      const v2 = pg.getViewport({scale: skal}), c = document.createElement("canvas");
      c.width = Math.round(v2.width); c.height = Math.round(v2.height);
      await pg.render({canvasContext: c.getContext("2d"), viewport: v2}).promise;
      zeilen.push(...await lsOcr(c, `Seite ${s} von ${seiten}:`));
    }
    return {erg: LP.lies(zeilen, {ocr}), ocr, quelle: name, zeilen};
  }
  if(typ.startsWith("image/") || /^(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/.test(e)){
    const zeilen = await lsOcr(f, "");
    return {erg: LP.lies(zeilen, {ocr: true}), ocr: true, quelle: name, zeilen};
  }
  if(e === "xlsx" || typ.includes("spreadsheetml")){
    lsStatus("Excel-Datei wird gelesen …");
    const zeilen = await LP.xlsxZeilen(await f.arrayBuffer(), DOMParser);
    return {erg: LP.lies(zeilen), ocr: false, quelle: name, zeilen};
  }
  if(/^(cwlm|cwp|3d|2dc|ivx|cwps)$/.test(e)) throw new Error("Das ist eine cadwork-Projektdatei, darin steckt das ganze 3D-Modell. Bitte in cadwork die Stückliste als PDF ausgeben (oder als Excel/CSV) und diese Datei einlesen.");
  if(e === "xls") throw new Error("Alte Excel-Dateien (.xls) kann die App nicht lesen. Bitte in Excel als .xlsx oder CSV speichern.");
  if(/^(xml|btlx)$/.test(e) || typ.includes("xml")){
    lsStatus("XML wird gelesen …");
    const doc = new DOMParser().parseFromString(await text(), "text/xml");
    if(doc.getElementsByTagName("parsererror").length) throw new Error("Die XML-Datei ist beschädigt oder unvollständig.");
    const x = LP.xmlZeilen(doc);
    const erg = LP.lies(x.zeilen);
    const pn = doc.documentElement.getAttribute("Projekt") || ((doc.getElementsByTagName("Project")[0] || {getAttribute: () => ""}).getAttribute("Name"));
    if(!erg.name && pn) erg.name = pn;
    return {erg, ocr: false, quelle: name, zeilen: x.zeilen};
  }
  lsStatus("Datei wird gelesen …");
  const zeilen = LP.csvZeilen(await text());
  return {erg: LP.lies(zeilen), ocr: false, quelle: name, zeilen};
}
/* iPhone/iPad: Mit Dateitypen-Filter wären unbekannte Endungen (z. B. .btlx) grau – dort ohne Filter, die App prüft selbst */
if(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || (IST_NATIVE && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === "ios")) $("lsFile").removeAttribute("accept");
$("lsCam").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if(f) lsEinlesen(f); });
$("lsFile").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if(f) lsEinlesen(f);
});
async function lsEinlesen(f){
  if(f.size > 40 * 1024 * 1024){ alert("Die Datei ist zu groß (über 40 MB)."); return; }
  lsAbbruch = false; lsOvAuf();
  try{
    const r = await lsDateiLesen(f);
    if(!r || lsAbbruch) return;
    const ziel = lsProj() ? lsOpen : "neu";
    const ausName = r.ocr && /^(img|image|photo|foto|bild|dsc|pxl|scan|camera|kamera)?[\s_-]*[\d_-]+$|^image$/i.test(r.quelle.replace(/\.[a-z0-9]+$/i, ""))
      ? "Holzliste " + new Date().toLocaleDateString("de-DE", {day: "2-digit", month: "2-digit", year: "numeric"})
      : r.quelle.replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").trim();
    lsRev = {pos: r.erg.pos.map(p => Object.assign({use: true}, p)), secU: r.erg.secU, lenU: r.erg.lenU,
             name: r.erg.name || ausName, quelle: r.quelle, ocr: r.ocr, ziel,
             roh: r.zeilen.map(z => z.map(c => c.t).join("  ")).filter(Boolean).slice(0, 400)};
    lsPruefRender();
  }catch(err){
    if(lsAbbruch) return;
    lsOv.body.innerHTML = `<div class="card pad"><p><b>Die Datei konnte nicht gelesen werden.</b></p><p class="ls-hinweis">${escapeHtml(err && err.message ? err.message : String(err))}</p>
      <button type="button" class="btn-pdf" id="lsErrZu">Schließen</button></div>`;
    $("lsErrZu").onclick = lsOvZu;
  }
}
const lsRoh = (v) => isFinite(v) ? String(+v.toFixed(4)).replace(".", ",") : "";
function lsPruefen(p){
  const fs_ = LP.FAKTOR_SEC[lsRev.secU], fl = LP.FAKTOR_LEN[lsRev.lenU];
  const b = p.b * fs_, h = p.h * fs_, l = p.l * fl, w = [];
  if(!(b > 0) || !(h > 0)) w.push("Querschnitt fehlt");
  else if(b > 100 || h > 100 || b < 1 || h < 1) w.push("Querschnitt unplausibel – Einheit prüfen");
  if(!(l > 0)) w.push("Länge fehlt");
  else if(l > 30 || l < 0.05) w.push("Länge unplausibel – Einheit prüfen");
  if(p.nUnsicher) w.push("Stückzahl prüfen");
  return w;
}
function lsZeileWarnung(row){
  const p = lsRev.pos[+row.dataset.i], w = p.use ? lsPruefen(p) : [];
  row.classList.toggle("warn", w.length > 0);
  let d = row.querySelector(".ls-warn");
  if(!w.length){ if(d) d.remove(); return; }
  if(!d){ d = document.createElement("div"); d.className = "ls-warn"; row.insertBefore(d, row.querySelector(".ls-src")); }
  d.textContent = w.join(" · ");
}
function lsPruefRender(){
  const r = lsRev;
  const aktiv = r.pos.filter(p => p.use).length;
  const zielOpt = `<option value="neu">Neues Projekt anlegen</option>` + listen.map(pr => `<option value="${pr.id}"${r.ziel === pr.id ? " selected" : ""}>Zu „${escapeHtml(pr.name)}“ hinzufügen</option>`).join("");
  const sel = (id, wert, opts) => `<select id="${id}">${opts.map(o => `<option value="${o[0]}"${o[0] === wert ? " selected" : ""}>${o[1]}</option>`).join("")}</select>`;
  let h = `<div class="ls-info${r.ocr ? " warn" : ""}">${r.pos.length ? `<b>${r.pos.length} Position${r.pos.length === 1 ? "" : "en"} erkannt</b> in „${escapeHtml(r.quelle)}“. Bitte jede Zeile mit der Vorlage vergleichen.` : `<b>Keine Balken erkannt</b> in „${escapeHtml(r.quelle)}“.`}
    ${r.ocr ? (r.pos.length ? "<br>Aus Foto/Scan gelesen: Zahlen besonders genau prüfen (8 und 6, Komma, Schrägstrich)." : "<br>Tipp: Liste gerade von oben, hell und scharf fotografieren, ganz im Bild. Oder die Balken von Hand eintragen.") : (r.pos.length ? "" : "<br>Die Datei enthält keine erkennbare Holzliste mit Querschnitt und Länge. Du kannst die Zeilen auch von Hand ergänzen.")}</div>
  <div class="card pad mb">
    <div class="row"><div class="field"><label for="lsRevZiel">Übernehmen in</label><select id="lsRevZiel">${zielOpt}</select></div></div>
    <div class="row" id="lsRevNameRow"${r.ziel !== "neu" ? ' style="display:none"' : ""}><div class="field"><label for="lsRevName">Projektname</label><input type="text" id="lsRevName" value="${escapeHtml(r.name)}" maxlength="80"></div></div>
    <div class="row">
      <div class="field"><label for="lsRevSec">Breite/Höhe stehen in</label>${sel("lsRevSec", r.secU, [["cm", "cm"], ["mm", "mm"], ["m", "m"]])}</div>
      <div class="field"><label for="lsRevLen">Länge steht in</label>${sel("lsRevLen", r.lenU, [["m", "m"], ["cm", "cm"], ["mm", "mm"]])}</div>
    </div>
  </div>`;
  h += `<div class="ls-rev">` + r.pos.map((p, i) => {
    const w = lsPruefen(p);
    return `<div class="card ls-revrow${p.use ? "" : " aus"}${w.length && p.use ? " warn" : ""}" data-i="${i}">
      <div class="ls-revtop"><label class="ls-use"><input type="checkbox" data-f="use" ${p.use ? "checked" : ""}> übernehmen</label>
        <input type="text" data-f="bez" value="${escapeHtml(p.bez)}" placeholder="Bezeichnung" aria-label="Bezeichnung"></div>
      <div class="ls-revnum">
        <label>B (${r.secU})<input type="text" inputmode="decimal" data-f="b" value="${lsRoh(p.b)}"></label>
        <label>H (${r.secU})<input type="text" inputmode="decimal" data-f="h" value="${lsRoh(p.h)}"></label>
        <label>L (${r.lenU})<input type="text" inputmode="decimal" data-f="l" value="${lsRoh(p.l)}"></label>
        <label>Stück<input type="text" inputmode="numeric" data-f="n" value="${p.n}"></label>
      </div>
      ${w.length && p.use ? `<div class="ls-warn">${w.join(" · ")}</div>` : ""}
      <div class="ls-src">gelesen: ${escapeHtml(p.src)}</div>
    </div>`;
  }).join("") + `</div>`;
  h += `<button type="button" class="btn-measure" id="lsRevPlus" style="margin-top:10px">${lsIco.plus}Zeile hinzufügen</button>`;
  if(r.roh && r.roh.length) h += `<details class="ls-roh"><summary>Gelesenen Text anzeigen</summary><pre>${escapeHtml(r.roh.join("\n"))}</pre></details>`;
  h += `<button type="button" class="btn-add" id="lsRevOk">${lsIco.check}${aktiv ? `${aktiv} Position${aktiv === 1 ? "" : "en"} übernehmen` : r.ziel === "neu" ? "Leeres Projekt anlegen" : "Nichts übernehmen"}</button>
        <button type="button" class="btn-cancel" style="display:block" id="lsRevAbbr">Abbrechen</button>`;
  lsOv.body.innerHTML = h;
}
lsOv.body.addEventListener("input", (e) => {
  if(!lsRev) return;
  const t = e.target, row = t.closest(".ls-revrow");
  if(t.id === "lsRevName"){ lsRev.name = t.value; return; }
  if(!row || !t.dataset.f || t.type === "checkbox") return;
  const p = lsRev.pos[+row.dataset.i], f = t.dataset.f;
  if(f === "bez") p.bez = t.value;
  else if(f === "n"){ const v = parseInt(t.value, 10); p.n = v > 0 ? v : NaN; p.nUnsicher = false; }
  else p[f] = num(t.value);
});
lsOv.body.addEventListener("change", (e) => {
  if(!lsRev) return;
  const t = e.target, row = t.closest(".ls-revrow");
  if(t.id === "lsRevZiel"){ lsRev.ziel = t.value; $("lsRevNameRow").style.display = t.value === "neu" ? "" : "none"; return; }
  if(t.id === "lsRevSec"){ lsRev.secU = t.value; lsPruefRender(); return; }
  if(t.id === "lsRevLen"){ lsRev.lenU = t.value; lsPruefRender(); return; }
  if(row && t.dataset.f === "use"){ lsRev.pos[+row.dataset.i].use = t.checked; lsPruefRender(); return; }
  if(row && t.dataset.f) lsZeileWarnung(row);       // nur diese Zeile neu prüfen (Fokus bleibt im nächsten Feld)
});
lsOv.body.addEventListener("click", (e) => {
  if(!lsRev) return;
  const t = e.target.closest("button"); if(!t) return;
  if(t.id === "lsRevAbbr"){ lsOvZu(); return; }
  if(t.id === "lsRevPlus"){ lsRev.pos.push({use: true, bez: "", b: NaN, h: NaN, l: NaN, n: 1, src: "von Hand ergänzt"}); lsPruefRender(); const r = lsOv.body.querySelectorAll(".ls-revrow"); if(r.length) r[r.length - 1].scrollIntoView({block: "center"}); return; }
  if(t.id === "lsRevOk"){
    const fs_ = LP.FAKTOR_SEC[lsRev.secU], fl = LP.FAKTOR_LEN[lsRev.lenU];
    const nimm = lsRev.pos.filter(p => p.use);
    const schlecht = nimm.map((p, i) => ({p, i, w: lsPruefen(p).filter(x => !/Stückzahl/.test(x))})).filter(x => x.w.length);
    const fehlt = schlecht.filter(x => x.w.some(w => /fehlt/.test(w)));
    if(fehlt.length){ alert(`Bei ${fehlt.length} Zeile${fehlt.length === 1 ? "" : "n"} fehlt ein Maß. Bitte eintragen oder „übernehmen“ abwählen.`); const el = lsOv.body.querySelector(".ls-revrow.warn"); if(el) el.scrollIntoView({block: "center"}); return; }
    if(schlecht.length && !confirm(`${schlecht.length} Zeile${schlecht.length === 1 ? " hat" : "n haben"} ungewöhnliche Maße (z. B. falsche Einheit). Trotzdem übernehmen?`)) return;
    let pr;
    if(lsRev.ziel === "neu"){
      pr = {id: lsNeueId(), name: (lsRev.name || "").trim().slice(0, 80) || "Eingelesene Liste", angelegt: new Date().toISOString(), quelle: lsRev.quelle, pos: []};
      listen.unshift(pr);
    }else pr = listen.find(x => x.id === lsRev.ziel);
    if(!pr){ alert("Das Projekt gibt es nicht mehr."); return; }
    for(const p of nimm) pr.pos.push({id: lsNeueId(), bez: (p.bez || "").trim().slice(0, 80), b: +(p.b * fs_).toFixed(2), h: +(p.h * fs_).toFixed(2), l: +(p.l * fl).toFixed(3), n: p.n > 0 ? p.n : 1, fertig: 0, done: false});
    lsOpen = pr.id; lsEditPos = null; lsSpeichern(); savePrefs();
    lsOvZu(); showTab("liste"); savePrefs(); lsRender(); window.scrollTo({top: 0});
  }
});
