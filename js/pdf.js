/* HolzBuch – PDF und Drucken
   In der App: PDF mit jsPDF bauen und teilen. Im Browser: Druckvorlage („Als PDF sichern“).
   Braucht: app.js. */
"use strict";

/* --- PDF in der App (iOS/Android): Druckfunktion gibt es dort nicht → PDF mit jsPDF bauen und über „Teilen“
   speichern/senden. Inhalt wie das Druck-PDF der Web-Version. --- */
const PDF_ERSATZ = {"−":"-", "π":"pi", "≈":"ca. ", "→":"->", "×":"x", " ":" ", " ":" "};
function pdfText(x){
  return String(x).replace(/[^\x00-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, c => {
    if(PDF_ERSATZ[c] != null) return PDF_ERSATZ[c];
    const z = c.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    return /^[\x20-\x7E\xA0-\xFF]+$/.test(z) ? z : "";
  }).replace(/×/g, "x");
}
async function nativPdf(o){
  const J = window.jspdf && window.jspdf.jsPDF;
  if(!J) throw new Error("PDF-Baustein fehlt");
  const doc = new J({unit:"mm", format:"a4", compress:true});
  for(const m of ["text", "splitTextToSize", "getTextWidth"]){        // Sonderzeichen absichern
    const orig = doc[m];
    doc[m] = function(tx, ...rest){ const an = v => typeof v === "string" ? pdfText(v) : Array.isArray(v) ? v.map(an) : v; return orig.call(this, an(tx), ...rest); };
  }
  const t = o.t, L = 16, R = 194, W = R - L, GRUEN = [15,110,86], GRAU = [120,120,120];
  let y = 20;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...GRUEN);
  doc.text(appName, L, y);
  y += 3; doc.setDrawColor(...GRUEN); doc.setLineWidth(0.6); doc.line(L, y, R, y); y += 8;
  doc.setTextColor(0,0,0);
  const block = (label, text, x, align) => {
    let yy = y;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAU);
    doc.text(label.toUpperCase(), x, yy, {align}); yy += 4.5;
    doc.setFontSize(10); doc.setTextColor(0,0,0);
    const lines = doc.splitTextToSize(text, W/2 - 6);
    doc.text(lines, x, yy, {align}); yy += lines.length * 4.6;
    return yy;
  };
  const nrTxt = o.invNo ? "Rechnung Nr. " + o.invNo : "";
  const zeit = `${o.dateStr} · ${o.timeStr} Uhr`;
  if(o.issuer || o.recipient){
    const y1 = o.recipient ? block("Rechnungsempfänger", o.recipient, L, "left") : y;
    let y2 = o.issuer ? block("Rechnungssteller", o.issuer, R, "right") : y;
    doc.setFontSize(9); doc.setTextColor(...GRAU); doc.text(zeit, R, y2 + 1, {align:"right"}); y2 += 5;
    y = Math.max(y1, y2) + 4;
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0,0,0);
  doc.text("Festmeter-Aufstellung", L, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...GRAU);
  const rechts = (o.issuer || o.recipient) ? nrTxt : (nrTxt ? nrTxt + " · " : "") + zeit;
  if(rechts) doc.text(rechts, R, y, {align:"right"});
  y += 5;
  const head = ["Nr", "Länge (m)", "Baumart", "Ø gem.", "Rinde", "Ø ger.", "Anz.", "Fm"];
  if(t.wtOn) head.push("kg");
  const body = items.map((it, i) => {
    const ded = it.bark ? barkDeduction(it.species, it.diameter) : 0;
    const eff = it.bark ? Math.max(0, it.diameter - ded) : it.diameter;
    const row = [String(i+1), fmt(it.length,2), RINDENABZUG[it.species]?.name || "–", fmt(it.diaEin != null ? it.diaEin : it.diameter,1),
                 it.bark ? "-" + fmt(ded,0) + " cm" : "–", fmt(eff,1), String(it.qty), fmt(volumeTotal(it))];
    if(t.wtOn) row.push(fmt(itemKg(it, t.w) || 0, 0));
    return row;
  });
  const rechtsSp = {}; [1,3,4,5,6,7,8].forEach(i => rechtsSp[i] = {halign:"right"});
  doc.autoTable({
    startY: y, head: [head], body, theme: "plain", margin: {left:L, right:210-R},
    styles: {font:"helvetica", fontSize:9, cellPadding:1.6, textColor:[0,0,0], lineColor:[204,204,204]},
    headStyles: {fontStyle:"bold", lineWidth:{bottom:0.5}, lineColor:[51,51,51]},
    bodyStyles: {lineWidth:{bottom:0.15}},
    columnStyles: rechtsSp,
    didParseCell: (d) => { if(d.section === "head" && rechtsSp[d.column.index]) d.cell.styles.halign = "right"; },
  });
  y = doc.lastAutoTable.finalY + 8;
  const zeilen = [["Stämme gesamt", String(t.stems)], ["Festmeter gesamt", fmt(t.totalFm) + " Fm", !(t.price > 0)]];
  if(t.wtOn) zeilen.push([`Gewicht gesamt (${fmt(t.w,1).replace(/,0$/,"")} % Wasser)`, `ca. ${fmt(t.kg,0)} kg (${fmt(t.kg/1000,2)} t)`]);
  if(o.showRm){ zeilen.push(["Raummeter (Ster)", fmt(t.totalFm*o.rmF,2) + " Rm"]); zeilen.push(["Schüttraummeter", fmt(t.totalFm*o.srmF,2) + " Srm"]); }
  if(t.price > 0){
    zeilen.push(["Preis pro Fm", euro(t.price)]); zeilen.push(["Netto", euro(t.netto)]);
    if(els.vatToggle.checked && t.rate > 0){
      zeilen.push([`zzgl. ${fmt(t.rate,2).replace(/,00$/,"")} % MwSt`, euro(t.mwst)]);
      zeilen.push(["Brutto", euro(t.brutto), true]);
    }else zeilen.push(["Summe", euro(t.netto), true]);
  }
  const xL = L + W*0.4;
  if(y > 260){ doc.addPage(); y = 20; }
  for(const [lab, val, grand] of zeilen){
    if(grand){ doc.setDrawColor(51,51,51); doc.setLineWidth(0.5); doc.line(xL, y - 3.6, R, y - 3.6); y += 1.5; }
    doc.setFont("helvetica", grand ? "bold" : "normal"); doc.setFontSize(grand ? 12 : 10); doc.setTextColor(0,0,0);
    doc.text(lab, xL, y); doc.text(val, R, y, {align:"right"});
    y += grand ? 7 : 5.5;
  }
  if(o.payment){
    y += 4; if(y > 270){ doc.addPage(); y = 20; }
    doc.setFontSize(8); doc.setTextColor(...GRAU); doc.setFont("helvetica", "normal");
    doc.text("ZAHLUNG", L, y); y += 4.5;
    doc.setFontSize(9.5); doc.setTextColor(40,40,40);
    const pl = doc.splitTextToSize(o.payment, W); doc.text(pl, L, y); y += pl.length * 4.4;
  }
  const fuss = "Ø gem. = gemessener Mitten-Ø (mit Rinde) · Rinde = abgezogene Rindenstärke („–“ = nicht abgezogen, Ø enthält Rinde) · Ø ger. = für die Berechnung verwendeter Ø · Fm = Festmeter (m³). " +
    "Berechnung nach Huber-Formel V = pi·(Ø/200)²·Länge · Rindenabzug in cm nach Baumart (RVR, Anlage VII)." + (items.some(x => x.sorte) ? " Länge = Bestelllänge ohne Übermaß (Langholz: gemessen − Übermaß 1 %, mind. 10 cm, auf 10 cm abgerundet; Brennholz ohne Übermaß); Ø auf ganze cm abgerundet." : "") +
    (o.hasOrient ? " Kiefer/Eiche/Lärche = RVR-Orientierungswert (regional abweichend)." : "") +
    (t.wtOn ? ` Gewicht: Raumdichte (kg Trockenmasse je Festmeter, LWF-Merkblatt 12/Kollmann) ÷ (1 − Wassergehalt), Festmeter frisch gemessen.${o.hasNaeh ? " Tanne/Lärche/Douglasie/Esche = Näherungswerte." : ""}` : "") +
    (o.showRm ? ` Umrechnung Brennholz: 1 Fm = ${fmt(o.rmF,2)} Rm = ${fmt(o.srmF,2)} Srm (Richtwert gespaltenes Scheitholz).` : "") +
    ` · erstellt mit ${appName}`;
  y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAU);
  const fl = doc.splitTextToSize(fuss, W);
  if(y + fl.length*3.4 > 285){ doc.addPage(); y = 20; }
  doc.setDrawColor(204,204,204); doc.setLineWidth(0.15); doc.line(L, y - 3, R, y - 3);
  doc.text(fl, L, y);
  const iso = `${o.now.getFullYear()}-${String(o.now.getMonth()+1).padStart(2,"0")}-${String(o.now.getDate()).padStart(2,"0")}`;
  const name = (appName + " " + iso).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() + ".pdf";
  await nativDateiTeilen(doc.output("blob"), name);
}
/* Datei über das Teilen-Menü des Handys ausgeben (Speichern in Dateien, Mail, WhatsApp …) */
let nativTeilenLaeuft = false;
async function nativDateiTeilen(blob, name){
  const F = nativPlugin("Filesystem"), S = nativPlugin("Share");
  if(!F || !S) throw new Error("Teilen ist auf diesem Gerät nicht verfügbar");
  if(nativTeilenLaeuft) return;
  nativTeilenLaeuft = true;
  try{
    const durl = await new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = err; r.readAsDataURL(blob); });
    const w = await F.writeFile({path:`teilen/${Date.now()}/${name}`, data:String(durl).slice(String(durl).indexOf(",") + 1), directory:"CACHE", recursive:true});
    await S.share({title:name, files:[w.uri], dialogTitle:name});
  }catch(e){
    if(!/cancel/i.test(String(e && (e.message || e)))) throw e;   // Abbrechen ist kein Fehler
  }finally{ nativTeilenLaeuft = false; }
}

/* Holzart-Presets für die Brennholz-Umrechnung (TFZ Bayern, gespaltene 33-cm-Scheite). */
/* --- PDF / Drucken --- */
els.pdfBtn.addEventListener("click", ()=>{
  if(items.length === 0){ alert("Noch keine Balken zum Ausdrucken."); return; }
  const t = computeTotals();
  if(t.wtOn && t.kg == null){
    alert("Das Gewicht ist eingeschaltet, aber der Wassergehalt fehlt oder ist ungültig (0 bis 90 %). Bitte eintragen oder das Gewicht ausschalten.");
    return;
  }
  const now = new Date();
  const dateStr = now.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"});
  const timeStr = now.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});

  let rows = "";
  items.forEach((it,i)=>{
    const art = RINDENABZUG[it.species]?.name || "–";
    const ded = it.bark ? barkDeduction(it.species, it.diameter) : 0;
    const eff = it.bark ? Math.max(0, it.diameter - ded) : it.diameter;
    const dedTxt = it.bark ? "−" + fmt(ded,0) + " cm" : "–";
    const kgCell = t.wtOn ? `<td class="r">${fmt(itemKg(it,t.w) || 0,0)}</td>` : "";
    rows += `<tr><td>${i+1}</td><td class="r">${fmt(it.length,2)}</td><td>${art}</td>`
          + `<td class="r">${fmt(it.diaEin != null ? it.diaEin : it.diameter,1)}</td><td class="r">${dedTxt}</td><td class="r">${fmt(eff,1)}</td>`
          + `<td class="r">${it.qty}</td><td class="r">${fmt(volumeTotal(it))}</td>${kgCell}</tr>`;
  });

  let money = "";
  if(t.price > 0){
    const showVat = els.vatToggle.checked && t.rate > 0;
    money = `<div class="pt-row"><span>Preis pro Fm</span><span>${euro(t.price)}</span></div>`
          + `<div class="pt-row"><span>Netto</span><span>${euro(t.netto)}</span></div>`;
    if(showVat){
      money += `<div class="pt-row"><span>zzgl. ${fmt(t.rate,2).replace(/,00$/,'')} % MwSt</span><span>${euro(t.mwst)}</span></div>`
             + `<div class="pt-row grand"><span>Brutto</span><span>${euro(t.brutto)}</span></div>`;
    }else{
      money += `<div class="pt-row grand"><span>Summe</span><span>${euro(t.netto)}</span></div>`;
    }
  }

  const hasOrient = items.some(it => it.bark && ORIENTIERUNG.has(it.species));
  const rmF = num(els.rmFactor.value) || 0, srmF = num(els.srmFactor.value) || 0;
  const showRm = els.rmPdfToggle.checked;
  const rmRows = showRm
    ? `<div class="pt-row"><span>Raummeter (Ster)</span><span>${fmt(t.totalFm*rmF,2)} Rm</span></div>`
      + `<div class="pt-row"><span>Schüttraummeter</span><span>${fmt(t.totalFm*srmF,2)} Srm</span></div>`
    : "";
  const wtRow = t.wtOn
    ? `<div class="pt-row"><span>Gewicht gesamt (${fmt(t.w,1).replace(/,0$/,"")} % Wasser)</span><span>≈ ${fmt(t.kg,0)} kg (${fmt(t.kg/1000,2)} t)</span></div>`
    : "";
  const hasNaeh = t.wtOn && items.some(it => RD_NAEHERUNG.has(it.species));
  const wtNote = t.wtOn
    ? ` Gewicht: Raumdichte (kg Trockenmasse je Festmeter, LWF-Merkblatt 12/Kollmann) ÷ (1 − Wassergehalt), Festmeter frisch gemessen.${hasNaeh ? " Tanne/Lärche/Douglasie/Esche = Näherungswerte." : ""}`
    : "";
  const issuer = els.issuer.value.trim();
  const recipient = els.recipient.value.trim();
  const invNo = els.invNo.value.trim();
  const payment = els.payment.value.trim();
  const nrTxt = invNo ? "Rechnung Nr. " + escapeHtml(invNo) : "";
  let headHtml = `<div class="p-brand">${escapeHtml(appName)}</div><hr class="p-rule">`;
  if(issuer || recipient){
    headHtml += `<div class="p-parties">`
      + `<div class="p-party">` + (recipient ? `<div class="p-plabel">Rechnungsempfänger</div>${nl2br(recipient)}` : "") + `</div>`
      + `<div class="p-party right">` + (issuer ? `<div class="p-plabel">Rechnungssteller</div>${nl2br(issuer)}` : "")
        + `<div class="p-pdate">${dateStr} · ${timeStr} Uhr</div></div>`
      + `</div>`
      + `<div class="p-headline"><span class="p-sub">Festmeter-Aufstellung</span>${nrTxt ? `<span class="p-date">${nrTxt}</span>` : ""}</div>`;
  }else{
    headHtml += `<div class="p-headline"><span class="p-sub">Festmeter-Aufstellung</span><span class="p-date">${nrTxt ? nrTxt + " · " : ""}${dateStr} · ${timeStr} Uhr</span></div>`;
  }

  if(IST_NATIVE){
    nativPdf({now, dateStr, timeStr, t, invNo, issuer, recipient, payment, showRm, rmF, srmF, hasOrient, hasNaeh})
      .catch(e => alert("PDF konnte nicht erstellt werden: " + (e && e.message ? e.message : e)));
    return;
  }
  els.printArea.innerHTML = headHtml + `
    <table>
      <thead><tr><th>Nr</th><th class="r">Länge&nbsp;(m)</th><th>Baumart</th><th class="r">Ø&nbsp;gem.</th><th class="r">Rinde</th><th class="r">Ø&nbsp;ger.</th><th class="r">Anz.</th><th class="r">Fm</th>${t.wtOn ? '<th class="r">kg</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="p-tot">
      <div class="pt-row"><span>Stämme gesamt</span><span>${t.stems}</span></div>
      <div class="pt-row ${t.price>0?'':'grand'}"><span>Festmeter gesamt</span><span>${fmt(t.totalFm)} Fm</span></div>
      ${wtRow}
      ${rmRows}
      ${money}
    </div>
    ${payment ? `<div class="p-pay"><span class="p-plabel">Zahlung</span>${nl2br(payment)}</div>` : ""}
    <div class="p-foot">Ø gem. = gemessener Mitten-Ø (mit Rinde) · Rinde = abgezogene Rindenstärke („–“ = nicht abgezogen, Ø enthält Rinde) · Ø ger. = für die Berechnung verwendeter Ø · Fm = Festmeter (m³).<br>Berechnung nach Huber-Formel V = π·(Ø/200)²·Länge · Rindenabzug in cm nach Baumart (RVR, Anlage VII).${items.some(x => x.sorte) ? " Länge = Bestelllänge ohne Übermaß (Langholz: gemessen − Übermaß 1 %, mind. 10 cm, auf 10 cm abgerundet; Brennholz ohne Übermaß); Ø auf ganze cm abgerundet." : ""}${hasOrient ? " Kiefer/Eiche/Lärche = RVR-Orientierungswert (regional abweichend)." : ""}${wtNote}${showRm ? ` Umrechnung Brennholz: 1 Fm = ${fmt(rmF,2)} Rm = ${fmt(srmF,2)} Srm (Richtwert gespaltenes Scheitholz).` : ""}<br>erstellt mit ${escapeHtml(appName)}</div>`;

  const prevTitle = document.title;
  const isoLocal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  document.title = appName + " " + isoLocal;
  const restore = ()=>{ document.title = prevTitle; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 3000);
});


/* In der App heißt der PDF-Knopf passend zum Teilen-Menü */
if(IST_NATIVE){
  const lbl = [...els.pdfBtn.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
  if(lbl) lbl.textContent = " PDF erstellen und teilen";
}
