/* Holzmeter – Holzliste einlesen (reine Rechenlogik, ohne Bildschirm)
   PDF-/Foto-Zeilen, CSV, Excel, XML/BTLx und cadwork-Listendatei (.cwlm) → Positionen.
   Braucht: nichts (PDF-Leser und Texterkennung liefert holzliste.js). Wird geprüft in tests/ und _holzliste/test_parser.mjs. */
"use strict";

/* HOLZLISTE-PARSER START – reine Rechenlogik ohne Bildschirm, wird in tests/node geprüft */
/* Eingang: Zeilen aus PDF, Texterkennung, CSV, Excel oder XML. Jede Zeile = Liste von Zellen {t, x0, x1}.
   Ausgang: Positionen mit Rohwerten (b, h, l, n) und der vermuteten Einheit; die Prüf-Ansicht rechnet erst
   beim Übernehmen in cm / m um, damit der Nutzer die Einheit noch umstellen kann. */
const LP = (() => {
  const low = (s) => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").trim();
  const ROLLEN = [
    ["pos", /^(pos\.?|position|pos\.?-?nr\.?|nr\.?|lfd\.?(nr\.?)?|lnr\.?|znr\.?|hnr\.?|n°|#|singlemembernumber|ordernumber|teil-?nr\.?)$/],
    ["n",   /^(anz\.?|anzahl|stk\.?|stueck|stueckzahl|st\.|menge|count|qty|quantity|anz\.?\s*stk\.?)$/],
    ["bez", /^(bezeichnung|bez\.?|benennung|bauteil|bauteilname|name|element|designation|annotation|beschreibung|identbez\.?|teil|holzteil|bauteilbezeichnung|text)$/],
    ["mat", /^(material|holzart|guete|qualitaet|sortierung|festigkeit(sklasse)?|klasse|timbergrade|qualitygrade|holz|werkstoff)$/],
    ["bh",  /^(querschnitt|qs|q\.?-?schnitt|b\s*[\/x×*]\s*h|b\s*[\/x×*]\s*h\s*[\/x×*]\s*l|abmessung(en)?|dimension(en)?|masse|profil|format)$/],
    ["b",   /^(b|b\.|breite|width|dicke|staerke|bre\.?)$/],
    ["h",   /^(h|h\.|hoehe|height|hoe\.?)$/],
    ["l",   /^(l|l\.|laenge|length|lg\.?|einzellaenge|wahre laenge|schnittlaenge|zuschnittlaenge|lae\.?|stablaenge)$/],
    ["x",   /^(vol\.?|volumen|volum|m³|m3|cbm|fm|kubik|gesamt|summe|preis|gewicht|gewi|kg|laufm\.?|lfm|gesamtlaenge|oberfl\.?|einh\.?|pr\/einh|bestnr|identnr\.?|pkt|gebel|lo|ba|kstnr\.?|bzgw|gw\/bz|stabart)$/],
  ];
  const EINH = /[\[(]\s*(mm|cm|m)\s*[\])]|(?:^|\s|\/)(mm|cm|m)$/;
  /* Kopfzelle → Rolle (+ Einheit, falls dabei) */
  function rolle(text){
    let s = low(text).replace(/[:]+$/, "");
    let einheit = null;
    const mu = s.match(EINH);
    if(mu){ einheit = mu[1] || mu[2]; s = s.replace(EINH, "").trim(); }
    s = s.replace(/\s+/g, " ").replace(/[.]+$/, ".");
    for(const [r, re] of ROLLEN) if(re.test(s) || re.test(s.replace(/\.$/, ""))) return {r, einheit};
    if(!s && einheit) return {r:"einheit", einheit};
    /* zusammengesetzte Kopfzellen (z. B. cadwork-Stückliste): erst Summen/Volumen ausschließen, dann nach Wortanfang */
    if(/\b(total|gesamt|summe|m3|m³|vol|volumen|preis|gewicht|kg|lfm|laufm)\b/.test(s)) return {r:"x", einheit};
    const w = s.split(/[\s\/]+/)[0];
    const anf = [["b", /^(breite|width|dicke|staerke)$/], ["h", /^(hoehe|height)$/], ["l", /^(laenge|length|lg)$/],
                 ["n", /^(anzahl|anz|stk|stueck|stueckzahl|menge|count)$/], ["bez", /^(bezeichnung|benennung|bauteil|name|designation)$/],
                 ["mat", /^(material|holzart|qualitaet|sortierung|festigkeitsklasse)$/], ["pos", /^(nr|pos|position|lfd)$/]];
    for(const [r, re] of anf) if(re.test(w)) return {r, einheit};
    return null;
  }
  /* deutsche und englische Zahlen: "6,20" "6.20" "1.250,5" "6200" */
  let punktDezimal = false;
  function zahl(t){
    let s = String(t).trim().replace(/\s/g, "");
    if(!/^-?\d+([.,]\d+)*$/.test(s)) return NaN;
    if(punktDezimal && /^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if(s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if(s.includes(",")) s = /^\d{1,3}(,\d{3})+$/.test(s) && s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
    else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    return parseFloat(s);
  }
  /* Lesefehler der Texterkennung in Zahlen: O→0, l/I/|→1 (nur wenn die Zelle sonst aus Ziffern besteht) */
  function ocrZiffern(t){
    if(!/\d/.test(t)) return t;
    if(/^[\dOoIl|.,\/xX×]+$/.test(t)) return t.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
    return t;
  }
  const ZAHL = "\\d+(?:[.,]\\d+)?";
  const QS = new RegExp("(" + ZAHL + ")\\s*(mm|cm)?\\s*[\\/xX×*]\\s*(" + ZAHL + ")(?:\\s*(mm|cm)?\\s*[\\/xX×*]\\s*(" + ZAHL + "))?\\s*(mm|cm|m)?(?![\\d²³])");
  const SKIP = /\b(summe|gesamtsumme|gesamt|total|uebertrag|zwischensumme|seite\s*\d|blatt\s*\d)\b/;

  /* freie Zeile ohne Tabellenkopf: "14 Stk Sparren 8/18 6,20 m" */
  /* locker = Texterkennung: Zeile auch ohne lesbaren Querschnitt behalten (Schrägstrich oft nicht erkannt) */
  function freiZeile(text, locker){
    let s = " " + String(text).replace(/\s+/g, " ").replace(/\b(?:pos(?:ition)?|nr)\.?\s*\d+[a-z]?\b/gi, " ").replace(/\b[lbh]\s*=\s*/gi, " ") + " ";
    const m = s.match(QS);
    if(!m && !locker) return null;
    const r = {b: NaN, h: NaN, secU: null, l: NaN, lenU: null, n: NaN};
    if(m){
      r.b = zahl(m[1]); r.h = zahl(m[3]); r.secU = m[2] || m[4] || null;
      if(m[5] != null){ r.l = zahl(m[5]); r.lenU = m[6] || null; }
      else if(m[6] && m[6] !== "m") r.secU = r.secU || m[6];
      s = s.replace(m[0], " # ");
    }
    if(!isFinite(r.l)){
      const ml = s.match(new RegExp("(" + ZAHL + ")\\s*(mm|cm|m)(?![a-zA-Z²³\\d])"));
      if(ml){ r.l = zahl(ml[1]); r.lenU = ml[2]; s = s.replace(ml[0], " # "); }
      else{
        const md = s.match(new RegExp("(?:^|\\s)(\\d{1,2}[.,]\\d{1,3})(?=\\s|$)"));
        if(md){ r.l = zahl(md[1]); r.lenU = "m"; s = s.replace(md[1], " # "); }
        else{
          const ints = [...s.matchAll(/(?:^|\s)(\d{3,5})(?=\s|$)/g)].map(x => x[1]);
          if(ints.length){ const g = ints.sort((a, b) => b - a)[0]; r.l = zahl(g); s = s.replace(g, " # "); }
        }
      }
    }
    const mn = s.match(/(\d{1,4})\s*(?:stk\.?|stck\.?|stueck|stück|st\.|x(?=\s)|×)/i) || s.match(/(?:stk\.?|anz\.?|anzahl)\s*:?\s*(\d{1,4})/i);
    if(mn){ r.n = parseInt(mn[1], 10); s = s.replace(mn[0], " # "); }
    else{
      const ints = [...s.matchAll(/(?:^|\s)(\d{1,4})(?=\s|$)/g)].map(x => x[1]);
      if(ints.length >= 2){ r.n = parseInt(ints[1], 10); }
      else if(ints.length === 1){ r.n = parseInt(ints[0], 10); r.nUnsicher = true; }
    }
    r.bez = s.replace(/#/g, " ").replace(/(?:^|\s)\d+(?:[.,]\d+)?(?=\s|$)/g, " ")
             .replace(/(?:^|\s)(stk|stck|st|stück|stueck|mm|cm|m|lfm|anz|x|lang|lg)\.?(?=[\s,;]|$)/gi, " ").replace(/[|;~]+/g, " ")
             .replace(/\s+[,.:]+(?=\s|$)/g, " ").replace(/^[\s,.:\-]+|[\s,.:\-]+$/g, "").replace(/\s+/g, " ").trim();
    return r;
  }

  /* Kopfzeile erkennen: mindestens Länge und Querschnitt (b+h oder b/h) und drei Rollen insgesamt */
  function kopf(zellen){
    const sp = [];
    for(const c of zellen){
      const ro = rolle(c.t);
      if(!ro){ sp.push({r:"?", x0:c.x0, x1:c.x1, einheit:null}); continue; }
      if(ro.r === "einheit"){ const v = sp[sp.length - 1]; if(v && !v.einheit) v.einheit = ro.einheit; continue; }
      sp.push({r:ro.r, x0:c.x0, x1:c.x1, einheit:ro.einheit});
    }
    const hat = (r) => sp.some(s => s.r === r);
    const bekannt = sp.filter(s => s.r !== "?" && s.r !== "x").length;
    if(!(hat("l") && ((hat("b") && hat("h")) || hat("bh")) && bekannt >= 3)) return null;
    if(sp.filter(s => s.r === "?").length > bekannt + 2) return null;
    return sp;
  }
  /* Datenzellen den Spalten zuordnen: liegt die Zelle unter einer Kopfzelle, gilt diese (größte Überlappung);
     sonst der Bereich ab Beginn einer Kopfzelle bis zum Beginn der nächsten (rechtsbündige Zahlen unter linksbündigem Kopf) */
  function zuordnen(sp, zellen){
    const tx = sp.map(() => []);
    for(const c of zellen){
      let best = -1, bestOv = 0;
      sp.forEach((s, i) => { const ov = Math.min(s.x1, c.x1) - Math.max(s.x0, c.x0); if(ov > bestOv){ bestOv = ov; best = i; } });
      if(best < 0){
        const cx = (c.x0 + c.x1) / 2;
        best = 0;
        sp.forEach((s, i) => { if(s.x0 <= cx) best = i; });
      }
      tx[best].push(c.t);
    }
    return tx.map(a => a.join(" ").trim());
  }
  function ausKopf(sp, zellen){
    const tx = zuordnen(sp, zellen);
    const r = {b:NaN, h:NaN, l:NaN, n:NaN, bez:"", secU:null, lenU:null};
    const teile = [];
    sp.forEach((s, i) => {
      const t = tx[i];
      if(!t) return;
      if(s.r === "b"){ if(!isFinite(r.b)){ r.b = zahl(t); r.secU = r.secU || s.einheit; } }
      else if(s.r === "h"){ if(!isFinite(r.h)){ r.h = zahl(t); r.secU = r.secU || s.einheit; } }
      else if(s.r === "l"){ if(!isFinite(r.l)){ r.l = zahl(t.replace(/\s*(mm|cm|m)$/i, "")); r.lenU = s.einheit || (t.match(/(mm|cm|m)$/i) || [])[1] || null; } }
      else if(s.r === "n"){ const m = t.match(/\d+(?:[.,]\d+)?/); if(m){ const v = zahl(m[0]); if(Number.isInteger(v)) r.n = v; } }
      else if(s.r === "bh"){ const m = (" " + t + " ").match(QS); if(m){ r.b = zahl(m[1]); r.h = zahl(m[3]); r.secU = r.secU || m[2] || m[4] || s.einheit; if(m[5] != null && !isFinite(r.l)) r.l = zahl(m[5]); } }
      else if(s.r === "bez" || s.r === "mat"){ teile.push(t); }
    });
    r.bez = teile.join(" · ").replace(/\s+/g, " ").trim();
    if(!(isFinite(r.b) && isFinite(r.h))){
      const f = freiZeile(zellen.map(c => c.t).join(" "));
      if(f && isFinite(f.b) && isFinite(f.h)){ r.b = f.b; r.h = f.h; r.secU = r.secU || f.secU; if(!isFinite(r.l)){ r.l = f.l; r.lenU = f.lenU; } if(!r.bez) r.bez = f.bez; if(!isFinite(r.n)) r.n = f.n; }
    }
    return r;
  }
  /* Kopf über mehrere Zeilen (cadwork: „Breite“ / „SL“ / „[cm]“ übereinander): Zellen aller Kopfzeilen nach waagrechter
     Überlappung zu Spalten zusammenfassen, Text von oben nach unten aneinanderhängen */
  const istZahl = (t) => /^-?\d+([.,]\d+)*$/.test(String(t).trim());
  const kopfartig = (zellen) => zellen.length && !zellen.some(c => istZahl(c.t)) && zellen.some(c => rolle(c.t));
  function mischen(zeilen){
    const alle = []; zeilen.forEach((z, i) => z.forEach(c => alle.push({t: c.t, x0: c.x0, x1: c.x1, i})));
    alle.sort((a, b) => a.x0 - b.x0);
    const gr = [];
    for(const c of alle){
      const g = gr[gr.length - 1];
      if(g && c.x0 < g.x1 - 0.5) { g.c.push(c); g.x1 = Math.max(g.x1, c.x1); }
      else gr.push({x0: c.x0, x1: c.x1, c: [c]});
    }
    return gr.map(g => ({t: g.c.sort((a, b) => a.i - b.i || a.x0 - b.x0).map(c => c.t).join(" "), x0: g.x0, x1: g.x1}));
  }
  const median = (a) => { const s = a.filter(isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

  /* Hauptfunktion: zeilen = [[{t,x0,x1}, …], …] */
  function lies(zeilen, opt){
    opt = opt || {};
    /* Schreibt das Dokument Dezimalpunkte („0.080“, „6200.000“, „6.2“) und nirgends Dezimalkommas? Dann ist „6.200“ = 6,2 */
    const alleZ = zeilen.flat().map(c => String(c.t).trim()).filter(t => /^\d+([.,]\d+)+$/.test(t));
    const punkt = alleZ.filter(t => /^0\.\d+$|^\d{4,}\.\d+$|^\d+\.\d{1,2}$|^\d+\.\d{4,}$/.test(t)).length;
    const komma = alleZ.filter(t => /^\d+,\d+$/.test(t)).length;
    punktDezimal = punkt > 0 && komma === 0;
    let sp = null, name = "", kpuf = [];
    const pos = [];
    for(const roh of zeilen){
      const zellen = roh.map(c => ({t: opt.ocr ? ocrZiffern(String(c.t).trim()) : String(c.t).trim(), x0:c.x0, x1:c.x1})).filter(c => c.t);
      if(!zellen.length) continue;
      const text = zellen.map(c => c.t).join(" ");
      const k = kopf(zellen);
      if(k){ sp = k; kpuf = []; continue; }
      if(sp && zellen.every(c => { const ro = rolle(c.t); return ro && ro.r === "einheit"; })){
        /* Einheitenzeile unter dem Kopf („[mm] [mm] [m]“): Einheit der darüberliegenden Spalte zuordnen */
        for(const c of zellen){ const ro = rolle(c.t); let best = null, bo = 0; for(const s of sp){ const ov = Math.min(s.x1, c.x1) - Math.max(s.x0, c.x0); if(ov > bo){ bo = ov; best = s; } } if(best && !best.einheit) best.einheit = ro.einheit; }
        continue;
      }
      if(kopfartig(zellen)){
        kpuf.push(zellen); if(kpuf.length > 4) kpuf.shift();
        if(kpuf.length > 1){ const km = kopf(mischen(kpuf)); if(km){ sp = km; kpuf = []; continue; } }
      }else kpuf = [];
      if(!name){
        const NAME = /^(?:projekt(?:name)?|bauvorhaben|bv|objekt|auftrag|kommission|baustelle)\s*(?:nr\.?)?\s*[:.\-]\s*(.{2,60})$/i;
        const c = zellen.find(c => NAME.test(c.t)) || (NAME.test(text) ? {t: text} : null);
        if(c){ name = c.t.match(NAME)[1].split(/\s{2,}/)[0].replace(/\s+(?:datum|date|seite|blatt|tel\.?|telefon|kunde|bearbeiter|stand)\b.*$/i, "").trim(); continue; }
      }
      if(SKIP.test(low(text))) continue;
      let r = sp ? ausKopf(sp, zellen) : freiZeile(text);
      let unvollst = false;
      if((!r || !(isFinite(r.b) && isFinite(r.h))) && opt.ocr){
        /* Foto/Scan: Zeile mit Namen und Länge behalten, Querschnitt muss der Nutzer nachtragen */
        const f = freiZeile(text, true);
        if(f && /[a-zäöüß]{3,}/i.test(f.bez) && isFinite(f.l) && f.lenU === "m"){ r = Object.assign({}, f, r && r.bez ? {bez: r.bez} : {}); r.b = NaN; r.h = NaN; unvollst = true; }
      }
      if(!r) continue;
      if(!unvollst && (!(isFinite(r.b) && isFinite(r.h)) || r.b <= 0 || r.h <= 0)) continue;
      if(!isFinite(r.l) || r.l <= 0) r.l = NaN;
      if(!/[a-zäöüß]/i.test(r.bez)) r.bez = r.bez.replace(/[^\wäöüß .\-\/]/gi, "").trim();
      if(opt.ocr) r.bez = r.bez.replace(/(?:^|\s)[^\s\d](?=\s|$)/g, " ").replace(/[%§$&@]+/g, " ").replace(/\s+/g, " ").trim();
      pos.push({bez: r.bez || "", b: r.b, h: r.h, l: r.l, n: isFinite(r.n) && r.n > 0 ? r.n : 1,
                nUnsicher: !isFinite(r.n) || !!r.nUnsicher, secU: r.secU, lenU: r.lenU, src: text, kopf: !!sp, unvollst});
    }
    /* Einheit fürs ganze Dokument schätzen, wo sie nicht dabei stand */
    const secRoh = pos.filter(p => !p.secU && isFinite(p.b)).map(p => Math.max(p.b, p.h));
    const mS = median(secRoh);
    const secU = !isFinite(mS) ? "cm" : mS < 1.5 ? "m" : mS <= 45 ? "cm" : "mm";
    const lenRoh = pos.filter(p => !p.lenU && isFinite(p.l)).map(p => p.l);
    const mL = median(lenRoh);
    const lenU = !isFinite(mL) ? "m" : mL <= 40 ? "m" : "mm";
    const expl = (k) => { const c = {}; pos.forEach(p => { if(p[k]) c[p[k]] = (c[p[k]] || 0) + 1; }); const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : null; };
    return {pos, name, secU: expl("secU") || secU, lenU: expl("lenU") || lenU, mitKopf: pos.some(p => p.kopf)};
  }

  /* CSV/TXT: Trennzeichen erkennen (Dietrich's: ~), Zellen bekommen ihre Spaltennummer als Lage */
  function csvZeilen(text){
    const zeilen = String(text).replace(/\r\n?/g, "\n").split("\n").filter(z => z.trim());
    const probe = zeilen.slice(0, 20).join("\n");
    const kand = ["~", ";", "\t", "|", ","];
    let sep = ";", best = -1;
    for(const k of kand){ const n = probe.split(k).length - 1; if(n > best * 1.2 || (k !== "," && n > 0 && best <= 0)){ if(n > 0){ best = n; sep = k; } } }
    if(sep === "," && /\d,\d/.test(probe) && (probe.split(";").length > 1)) sep = ";";
    const teile = (z) => {
      const out = []; let cur = "", q = false;
      for(let i = 0; i < z.length; i++){
        const ch = z[i];
        if(ch === '"'){ if(q && z[i + 1] === '"'){ cur += '"'; i++; } else q = !q; }
        else if(ch === sep && !q){ out.push(cur); cur = ""; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    };
    return zeilen.map(z => teile(z).map((t, i) => ({t: t.trim(), x0: i, x1: i + 0.999})));
  }
  /* XML: BTLx (Abbundmaschinen) und allgemeine Listen, bei denen ein Element pro Balken Länge/Breite/Höhe trägt */
  function xmlZeilen(doc){
    const out = [];
    let kopfZ = null;
    const btlx = /btlx/i.test((doc.documentElement && (doc.documentElement.localName || doc.documentElement.nodeName)) || "");
    const alle = doc.getElementsByTagName("*");
    for(let i = 0; i < alle.length; i++){
      const el = alle[i];
      const werte = {};
      for(const a of Array.from(el.attributes || [])) werte[a.name] = a.value;
      for(const k of Array.from(el.children || [])) if(!k.children.length && k.textContent.trim()) werte[k.localName || k.nodeName] = k.textContent.trim();
      const namen = Object.keys(werte);
      if(btlx && (el.localName || el.nodeName) !== "Part") continue;
      const rollen = namen.map(n => (rolle(n) || rolle(n.replace(/[_\-]/g, " ")) || {r:"?"}).r);
      const hat = (r) => rollen.includes(r);
      if(!(hat("l") && ((hat("b") && hat("h")) || hat("bh")))) continue;
      const sp = [];
      namen.forEach((n, j) => { if(rollen[j] !== "?" && rollen[j] !== "x" && rollen[j] !== "pos") sp.push({n, r: rollen[j]}); });
      const reihenfolge = ["n", "bez", "mat", "bh", "b", "h", "l"];
      sp.sort((a, b) => reihenfolge.indexOf(a.r) - reihenfolge.indexOf(b.r));
      const titel = sp.map(s => s.r === "n" ? "Anzahl" : s.r === "bez" ? "Bezeichnung" : s.r === "mat" ? "Material" : s.r === "bh" ? "Querschnitt" : s.r === "b" ? "Breite" : s.r === "h" ? "Höhe" : "Länge");
      const sig = titel.join("|");
      if(sig !== kopfZ){ out.push(titel.map((t, j) => ({t, x0: j, x1: j + 0.999}))); kopfZ = sig; }
      out.push(sp.map((s, j) => ({t: werte[s.n], x0: j, x1: j + 0.999})));
    }
    return {zeilen: out, btlx};
  }
  /* PDF-/Texterkennungs-Bruchstücke {t,x0,x1,y,hgt} → Zeilen (gleiche Höhe = gleiche Zeile) */
  function zuZeilen(stuecke){
    const s = stuecke.filter(p => String(p.t).trim()).sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const zeilen = [];
    for(const p of s){
      const z = zeilen[zeilen.length - 1];
      const tol = Math.max(2, (p.hgt || 8) * 0.55);
      if(z && Math.abs(z.y - p.y) <= tol){ z.c.push(p); z.y = (z.y * (z.c.length - 1) + p.y) / z.c.length; }
      else zeilen.push({y: p.y, c: [p]});
    }
    return zeilen.map(z => {
      z.c.sort((a, b) => a.x0 - b.x0);
      /* direkt aneinanderstoßende Stücke (ein Wort in mehreren Teilen) zusammenfügen */
      const m = [];
      for(const p of z.c){
        const v = m[m.length - 1];
        const luecke = v ? p.x0 - v.x1 : 99;
        if(v && luecke < Math.max(0.5, (p.hgt || 8) * 0.06)){ v.t += p.t; v.x1 = Math.max(v.x1, p.x1); }
        else m.push({t: String(p.t), x0: p.x0, x1: p.x1});
      }
      return m.flatMap(c => {
        /* Zellen mit großen Leerräumen („Sparren      8/18“) in Teile aufteilen */
        const teile = c.t.split(/\s{2,}/);
        if(teile.length < 2) return [{t: c.t.trim(), x0: c.x0, x1: c.x1}];
        const breite = (c.x1 - c.x0) / Math.max(1, c.t.length);
        let pos = 0; const r = [];
        for(const t of c.t.split(/(\s{2,})/)){ if(/^\s+$/.test(t) || !t){ pos += t.length; continue; } r.push({t: t.trim(), x0: c.x0 + pos * breite, x1: c.x0 + (pos + t.length) * breite}); pos += t.length; }
        return r;
      });
    });
  }
  /* Excel (.xlsx) ohne fremden Baustein: ZIP-Inhaltsverzeichnis lesen, Dateien mit DecompressionStream entpacken */
  async function zipDateien(buf, gesucht, alsBytes){
    const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let e = u.length - 22;
    while(e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if(e < 0) throw new Error("Keine gültige Excel-Datei");
    const anzahl = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const td = new TextDecoder("utf-8"), aus = {};
    for(let i = 0; i < anzahl; i++){
      if(dv.getUint32(p, true) !== 0x02014b50) break;
      const methode = dv.getUint16(p + 10, true), groesse = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), kl = dv.getUint16(p + 32, true);
      const lokal = dv.getUint32(p + 42, true);
      const name = td.decode(u.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + kl;
      if(!gesucht(name)) continue;
      const start = lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true);
      const roh = u.subarray(start, start + groesse);
      let daten;
      if(methode === 0) daten = roh;
      else if(methode === 8){
        if(typeof DecompressionStream === "undefined") throw new Error("Dieses Gerät kann Excel-Dateien nicht entpacken. Bitte die Liste als CSV oder PDF speichern.");
        const st = new Blob([roh]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        daten = new Uint8Array(await new Response(st).arrayBuffer());
      }else continue;
      aus[name] = alsBytes ? daten : td.decode(daten);
    }
    return aus;
  }
  async function xlsxZeilen(buf, DP){
    const f = await zipDateien(buf, n => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    const blatt = Object.keys(f).filter(n => n.startsWith("xl/worksheets/")).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))[0];
    if(!blatt) throw new Error("Kein Tabellenblatt gefunden");
    const P = new DP(), alle = (d, n) => Array.from(d.getElementsByTagName(n));
    const geteilt = f["xl/sharedStrings.xml"] ? alle(P.parseFromString(f["xl/sharedStrings.xml"], "text/xml"), "si").map(si => alle(si, "t").map(t => t.textContent).join("")) : [];
    const doc = P.parseFromString(f[blatt], "text/xml");
    const spalte = (ref) => { let n = 0; for(const ch of String(ref).replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    return alle(doc, "row").map(r => alle(r, "c").map(c => {
      const typ = c.getAttribute("t"), v = (c.getElementsByTagName("v")[0] || {}).textContent;
      let t = typ === "s" ? geteilt[+v] : typ === "inlineStr" ? alle(c, "t").map(x => x.textContent).join("") : v;
      if(t == null) t = "";
      if(typ !== "s" && typ !== "inlineStr" && typ !== "str" && /^-?\d+\.\d+(e-?\d+)?$/i.test(t)) t = String(+(+t).toFixed(6)).replace(".", ",");
      const i = spalte(c.getAttribute("r"));
      return {t: String(t), x0: i, x1: i + 0.999};
    }).filter(c => c.t !== ""));
  }
  /* Texterkennung: deren eigene Zeilen nehmen (bleiben auch bei schiefem Foto zusammen). Die Lage der Wörter
     wird auf die Zeilenneigung zurückgerechnet, damit die Spalten über die ganze Seite zusammenpassen. */
  function ocrZeilen(daten){
    const zeilen = (daten.lines || []).filter(l => l.words && l.words.length);
    let neig = [];
    for(const l of zeilen){ const w = l.words; if(w.length >= 3){ const a = w[0].bbox, b = w[w.length - 1].bbox; const dx = b.x0 - a.x0; if(dx > 100) neig.push(((b.y0 + b.y1) - (a.y0 + a.y1)) / 2 / dx); } }
    neig.sort((x, y) => x - y);
    const t = neig.length ? neig[Math.floor(neig.length / 2)] : 0;
    return zeilen.map(l => l.words.map(w => {
      const yc = (w.bbox.y0 + w.bbox.y1) / 2;
      return {t: w.text, x0: w.bbox.x0 + yc * t, x1: w.bbox.x1 + yc * t};
    }));
  }
  /* cadwork-Listendatei (.cwlm): ZIP mit Firebird-Datenbank (ODS 11) CONTENT_3D.FDB. Die Stückliste steht in der
     Tabelle CWLM_MODELS (ein Datensatz je Stück: NUMBER_TIMBER_LISTE, WIDTH/HEIGHT/LENGTH_LIST in mm, NAME_ID → CW_ATTRIBUTES,
     MATERIAL_ID → CW_MATERIALS), der Projektname in CWLM_GENERAL_DATA. Gelesen wird nur, nichts verändert. */
  function cadworkListe(u){
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    if(u.length < 4096 || u[0] !== 1) throw new Error("Die cadwork-Datei ist beschädigt oder unvollständig.");
    const ps = dv.getUint16(0x10, true), ods = dv.getUint16(0x12, true) & 0x7fff;
    if(ods !== 11 || ps < 1024 || ps > 65536) throw new Error("Diese cadwork-Version kann Holzmeter noch nicht direkt lesen. Bitte in cadwork die Stückliste als PDF ausgeben.");
    const seiten = Math.floor(u.length / ps), lat = new TextDecoder("latin1"), utf = new TextDecoder("utf-8");
    const rle = (b) => { const out = []; let i = 0; while(i < b.length){ const c = (b[i] << 24) >> 24; i++; if(c > 0){ for(let k = 0; k < c && i < b.length; k++) out.push(b[i++]); } else if(c < 0){ const v = b[i++]; for(let k = 0; k < -c; k++) out.push(v); } } return Uint8Array.from(out); };
    const zeileAuf = (pg, line) => { const o = pg * ps, off = dv.getUint16(o + 24 + 4*line, true), ln = dv.getUint16(o + 26 + 4*line, true); return u.subarray(o + off, o + off + ln); };
    const ganz = (r) => {
      const rv = new DataView(r.buffer, r.byteOffset, r.byteLength), fl = rv.getUint16(10, true);
      if(!(fl & 8)) return rle(r.subarray(13));
      const teile = [r.subarray(22)]; let fp = rv.getUint32(16, true), fln = rv.getUint16(20, true);
      for(let n = 0; n < 60; n++){
        const fr = zeileAuf(fp, fln), fv = new DataView(fr.buffer, fr.byteOffset, fr.byteLength), ffl = fv.getUint16(10, true);
        if(ffl & 8){ teile.push(fr.subarray(22)); fp = fv.getUint32(16, true); fln = fv.getUint16(20, true); } else { teile.push(fr.subarray(13)); break; }
      }
      const ges = new Uint8Array(teile.reduce((a, t) => a + t.length, 0)); let o = 0; for(const t of teile){ ges.set(t, o); o += t.length; }
      return rle(ges);
    };
    /* alle gültigen Datensätze je Tabelle sammeln (nur die benötigten Tabellen entpacken) */
    const relSaetze = (wanted) => {
      const out = {};
      for(let pg = 0; pg < seiten; pg++){
        const o = pg * ps; if(u[o] !== 5) continue;
        const rel = dv.getUint16(o + 20, true), cnt = dv.getUint16(o + 22, true);
        if(!wanted.has(rel)) continue;
        for(let k = 0; k < cnt; k++){
          const off = dv.getUint16(o + 24 + 4*k, true), ln = dv.getUint16(o + 26 + 4*k, true);
          if(!off || ln < 13) continue;
          const r = u.subarray(o + off, o + off + ln), fl = r[10] | (r[11] << 8);
          if(fl & (1 | 2 | 4 | 16)) continue;
          (out[rel] ||= []).push(ganz(r));
        }
      }
      return out;
    };
    const txt = (d, a, n) => lat.decode(d.subarray(a, a + n)).trim();
    const sys = relSaetze(new Set([2, 5, 6]));
    const relId = {}; for(const d of sys[6] || []) if(d.length > 73) relId[txt(d, 42, 31)] = d[32] | (d[33] << 8);
    const dom = {}; for(const d of sys[2] || []) if(d.length > 126) dom[txt(d, 4, 31)] = [d[120] | (d[121] << 8), d[124] | (d[125] << 8)];
    const feldListe = {}; for(const d of sys[5] || []) if(d.length > 308){ (feldListe[txt(d, 35, 31)] ||= []).push([d[306] | (d[307] << 8), txt(d, 4, 31), txt(d, 66, 31)]); }
    const AUSR = {14:1, 37:2, 7:2, 8:4, 27:8, 16:8, 35:8, 10:4, 12:4, 13:4, 23:1};
    const lay = (tab) => {
      const fl = (feldListe[tab] || []).sort((a, b) => a[0] - b[0]); let off = Math.floor((fl.length + 7) / 8); const L = {};
      for(const [, n, src] of fl){ const [ln, ty] = dom[src] || [0, 0]; const a = AUSR[ty] || 1; off = Math.ceil(off / a) * a; L[n] = [off, ty, ln]; off += ty === 37 ? ln + 2 : ln; }
      return L;
    };
    const wert = (d, L, n) => {
      if(!L[n]) return null; const [off, ty, ln] = L[n]; if(off + 1 > d.length) return null;
      const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
      if(ty === 27) return v.getFloat64(off, true);
      if(ty === 16) return Number(v.getBigInt64(off, true));
      if(ty === 8) return v.getInt32(off, true);
      if(ty === 7) return v.getInt16(off, true);
      if(ty === 37){ const l = v.getUint16(off, true); return utf.decode(d.subarray(off + 2, off + 2 + l)).trim(); }
      if(ty === 14) return utf.decode(d.subarray(off, off + ln)).replace(/[\s\u0000]+$/, "").trim();
      return null;
    };
    const T = ["CWLM_MODELS", "CW_ATTRIBUTES", "CW_MATERIALS", "CWLM_GENERAL_DATA"];
    if(relId.CWLM_MODELS == null) throw new Error("In dieser cadwork-Datei ist keine Stückliste gespeichert. Bitte in cadwork die Stückliste als PDF ausgeben.");
    const daten = relSaetze(new Set(T.filter(t => relId[t] != null).map(t => relId[t])));
    const L = {}; T.forEach(t => L[t] = lay(t));
    const nam = {}; for(const d of daten[relId.CW_ATTRIBUTES] || []) nam[wert(d, L.CW_ATTRIBUTES, "ID")] = wert(d, L.CW_ATTRIBUTES, "NAME_AL");
    const mat = {}; for(const d of daten[relId.CW_MATERIALS] || []) mat[wert(d, L.CW_MATERIALS, "ID")] = wert(d, L.CW_MATERIALS, "NAME_AL");
    let name = ""; for(const d of daten[relId.CWLM_GENERAL_DATA] || []) name = name || wert(d, L.CWLM_GENERAL_DATA, "PROJECT_NAME") || "";
    const gruppen = new Map();
    for(const d of daten[relId.CWLM_MODELS] || []){
      const w = (n) => wert(d, L.CWLM_MODELS, n);
      const b = Math.round(w("WIDTH_LIST") * 10) / 10, h = Math.round(w("HEIGHT_LIST") * 10) / 10, l = Math.round(w("LENGTH_LIST") * 10) / 10;
      if(!(b > 0 && h > 0 && l > 0)) continue;
      const nr = w("NUMBER_TIMBER_LISTE") || 0, m = mat[w("MATERIAL_ID")] || "", nm = nam[w("NAME_ID")] || "";
      const key = [nr, b, h, l, m].join("|");
      const g = gruppen.get(key) || {nr, b, h, l, m, namen: new Set(), n: 0};
      g.n += Math.max(1, w("QUANTITY") || 1); if(nm) g.namen.add(nm); gruppen.set(key, g);
    }
    const pos = [...gruppen.values()].sort((a, c) => a.nr - c.nr || c.h - a.h || c.l - a.l).map(g => ({
      bez: [[...g.namen].join(" / "), g.m].filter(Boolean).join(" · "), b: g.b, h: g.h, l: g.l, n: g.n, nUnsicher: false,
      secU: "mm", lenU: "mm", src: `cadwork Nr ${g.nr}: ${[...g.namen].join(" / ") || "ohne Namen"}, ${g.b} × ${g.h} mm, ${g.l} mm, ${g.n} Stück`, kopf: true, unvollst: false}));
    return {pos, name, secU: "mm", lenU: "mm", mitKopf: true};
  }
  const FAKTOR_SEC = {cm: 1, mm: 0.1, m: 100};
  const FAKTOR_LEN = {m: 1, cm: 0.01, mm: 0.001};
  return {lies, csvZeilen, xmlZeilen, xlsxZeilen, ocrZeilen, cadworkListe, zipDateien, zuZeilen, zahl, rolle, freiZeile, FAKTOR_SEC, FAKTOR_LEN};
})();
/* HOLZLISTE-PARSER ENDE */
