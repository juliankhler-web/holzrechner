/* Holzmeter – Grundgerüst der Oberfläche
   Zustand, Speicher (Gerät + App-Speicher), Eingabefelder, Stämme-Liste, Brennholz, Preis, Reiter, Menüleiste.
   Braucht: rechnen.js. Läuft nur im Browser/in der App. */
"use strict";

let zMode = "q";
let zProjWahl = null;       // Kantholz „Aus Holzliste“: gewähltes Projekt
const TABS = ["stamm", "brenn", "kant", "liste", "rech"];
let curTab = "stamm";
let lsOpen = null, lsHide = false;     // Holzliste: offenes Projekt, erledigte ausblenden


/* Läuft als App (iOS/Android, Capacitor-Hülle)? Dann: PDF über „Teilen“, Daten zusätzlich im App-Speicher. */
const IST_NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
const nativPlugin = (name) => (IST_NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
/* Zweitablage im App-Speicher (Preferences): Das System darf den Web-Speicher der App im Notfall leeren,
   die Preferences nicht. Beim Start wird von dort zurückgeholt, falls der Web-Speicher leer ist. */
function nativSpiegeln(key, value){
  const P = nativPlugin("Preferences");
  if(P) P.set({key, value}).catch(()=>{});
}
const K_ITEMS = "koessler.items.v1";
const K_PREFS = "koessler.prefs.v1";
const K_LISTEN = "koessler.listen.v1";   // Holzlisten (Projekte mit Positionen)

/* Einmalige Übernahme evtl. vorhandener Daten der Vorgänger-Version (Balken UND Einstellungen) */
try{
  if(!localStorage.getItem(K_ITEMS) && localStorage.getItem("holzrechner.items.v1"))
    localStorage.setItem(K_ITEMS, localStorage.getItem("holzrechner.items.v1"));
  if(!localStorage.getItem(K_PREFS) && localStorage.getItem("holzrechner.prefs.v1"))
    localStorage.setItem(K_PREFS, localStorage.getItem("holzrechner.prefs.v1"));
}catch(e){}

let items = load();
let editId = null;

const $ = (id) => document.getElementById(id);
const els = {
  length:$("length"), diameter:$("diameter"), qty:$("qty"),
  barkToggle:$("barkToggle"), species:$("species"), speciesHint:$("speciesHint"),
  form:$("form"), submitLabel:$("submitLabel"), cancelBtn:$("cancelBtn"),
  list:$("list"), count:$("count"), totalVal:$("totalVal"), totalSub:$("totalSub"),
  totalEuro:$("totalEuro"), clearBtn:$("clearBtn"),
  price:$("price"), vatToggle:$("vatToggle"), vatRate:$("vatRate"), rateField:$("rateField"),
  vatCustom:$("vatCustom"), customRateRow:$("customRateRow"),
  breakdown:$("breakdown"), bNetto:$("bNetto"), bMwst:$("bMwst"), bMwstLbl:$("bMwstLbl"),
  bMwstRow:$("bMwstRow"), bBrutto:$("bBrutto"), pdfBtn:$("pdfBtn"), printArea:$("printArea"),
  issuer:$("issuer"), recipient:$("recipient"),
  appTitle:$("appTitle"), manifest:$("manifest"),
  rmFactor:$("rmFactor"), srmFactor:$("srmFactor"), rmVal:$("rmVal"), srmVal:$("srmVal"), rmPdfToggle:$("rmPdfToggle"),
  invNo:$("invNo"), payment:$("payment"), rmPreset:$("rmPreset"),
  wtToggle:$("wtToggle"), wtBody:$("wtBody"), wtPreset:$("wtPreset"), wtW:$("wtW"),
  wtKg:$("wtKg"), wtT:$("wtT"), wtHint:$("wtHint"), totalWt:$("totalWt"),
  zKlasse:$("zKlasse"), zB:$("zB"), zH:$("zH"), zN:$("zN"), zNField:$("zNField"),
  zVal:$("zVal"), zHint:$("zHint"), zDraw:$("zDraw"),
  zModeQ:$("zModeQ"), zModeD:$("zModeD"), zDiaRow:$("zDiaRow"), zDia:$("zDia"), zValK:$("zValK"),
  zValSub:$("zValSub"),
};


const DEFAULT_APP_NAME = "Holzmeter";
let appName = DEFAULT_APP_NAME;


/* Wassergehalt w in % (0–90). Ungültig/leer → null (dann wird KEIN Gewicht gezeigt statt eines falschen). */
function waterContent(){ return wasserGueltig(els.wtW.value); }
function setSelect(sel, value){
  if([...sel.options].some(o => o.value === value)) sel.value = value;
}

function currentVatRate(){
  if(!els.vatToggle.checked) return 0;
  if(els.vatRate.value === "custom") return num(els.vatCustom.value) || 0;
  return parseFloat(els.vatRate.value) || 0;
}
function computeTotals(){
  /* Gewicht nur, wenn eingeschaltet und der Wassergehalt gültig ist (sonst null) */
  const wtOn = els.wtToggle.checked;
  const w = wtOn ? waterContent() : null;
  return { ...summen(items, num(els.price.value) || 0, currentVatRate(), w), wtOn };
}

/* --- Speicher --- */
function load(){ try{ return JSON.parse(localStorage.getItem(K_ITEMS)) || []; }catch(e){ return []; } }
function save(){ const v = JSON.stringify(items); try{ localStorage.setItem(K_ITEMS, v); }catch(e){} nativSpiegeln(K_ITEMS, v); }
function loadPrefs(){
  try{
    const p = JSON.parse(localStorage.getItem(K_PREFS)) || {};
    els.barkToggle.checked = !!p.bark;
    if(p.species) setSelect(els.species, p.species);
    els.wtToggle.checked = !!p.wtOn;
    if(p.wtPreset) setSelect(els.wtPreset, p.wtPreset);
    if(p.wtW != null) els.wtW.value = p.wtW;
    if(p.zKlasse) setSelect(els.zKlasse, p.zKlasse);
    if(p.zB != null) els.zB.value = p.zB;
    else if(typeof p.zQuer === "string" && p.zQuer.includes("/")) els.zB.value = p.zQuer.split("/")[0];   // aus Version 1.2
    if(p.zH != null) els.zH.value = p.zH;
    else if(typeof p.zQuer === "string" && p.zQuer.includes("/")) els.zH.value = p.zQuer.split("/")[1];
    if(p.zN != null) els.zN.value = p.zN;
    if(p.zMode === "d" || p.zMode === "p") zMode = p.zMode;
    if(p.zLen != null) $("zLen").value = p.zLen;
    if(p.zProj) zProjWahl = p.zProj;
    if(p.zDia != null) els.zDia.value = p.zDia;
    if(TABS.includes(p.tab)) curTab = p.tab;
    lsOpen = typeof p.lsOpen === "string" ? p.lsOpen : null;
    lsHide = !!p.lsHide;
    if(p.price != null) els.price.value = p.price;
    els.vatToggle.checked = !!p.vat;
    if(p.vatRate) els.vatRate.value = p.vatRate;
    if(p.vatCustom != null) els.vatCustom.value = p.vatCustom;
    if(p.issuer != null) els.issuer.value = p.issuer;
    if(p.recipient != null) els.recipient.value = p.recipient;
    if(p.rmFactor != null) els.rmFactor.value = p.rmFactor;
    if(p.srmFactor != null) els.srmFactor.value = p.srmFactor;
    els.rmPdfToggle.checked = !!p.rmPdf;
    if(p.rmPreset) els.rmPreset.value = p.rmPreset;
    if(p.invNo != null) els.invNo.value = p.invNo;
    if(p.payment != null) els.payment.value = p.payment;
    appName = DEFAULT_APP_NAME;   /* Umbenennen gibt es nicht mehr: früher gespeicherte Namen werden ignoriert */
  }catch(e){}
  syncReveals();
  applyAppName(appName);
}
function savePrefs(){
  let v = null;
  try{ localStorage.setItem(K_PREFS, v = JSON.stringify({
    bark:els.barkToggle.checked, species:els.species.value,
    price:els.price.value, vat:els.vatToggle.checked,
    vatRate:els.vatRate.value, vatCustom:els.vatCustom.value,
    issuer:els.issuer.value, recipient:els.recipient.value,
    rmFactor:els.rmFactor.value, srmFactor:els.srmFactor.value, rmPdf:els.rmPdfToggle.checked,
    rmPreset:els.rmPreset.value, invNo:els.invNo.value, payment:els.payment.value,
    wtOn:els.wtToggle.checked, wtPreset:els.wtPreset.value, wtW:els.wtW.value,
    zKlasse:els.zKlasse.value, zB:els.zB.value, zH:els.zH.value, zN:els.zN.value,
    zMode, zDia:els.zDia.value, tab:curTab, lsOpen, lsHide, zLen:$("zLen").value, zProj:zProjWahl,
    appName,
  })); }catch(e){}
  if(v) nativSpiegeln(K_PREFS, v);
}

/* App-Name (oben editierbar) auf UI, Tab-Titel, iOS-Kachel und Android-Manifest anwenden. */
function appIconDataUri(){
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 512 512'>"
    + "<rect width='512' height='512' rx='104' fill='#b5651d'/>"
    + "<g transform='translate(112,112) scale(12)' fill='#ffffff'>"
    + "<path d='M12 2 6 9h3l-4 5h3l-4 5h16l-4-5h3l-4-5h3z'/><rect x='11' y='19' width='2' height='3'/></g></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
/* App-Icon als echtes PNG (iOS-Kachel/Android-Manifest mögen PNG lieber als SVG). */
function iconPng(size){
  try{
    const c = document.createElement("canvas"); c.width=size; c.height=size;
    const x = c.getContext("2d");
    x.fillStyle = "#b5651d";
    if(x.roundRect){ x.beginPath(); x.roundRect(0,0,size,size,Math.round(size*0.2)); x.fill(); }
    else x.fillRect(0,0,size,size);
    const s = size/24*0.58, off=(size-24*s)/2;
    x.save(); x.translate(off,off); x.scale(s,s);
    x.fillStyle="#ffffff";
    x.fill(new Path2D("M12 2 6 9h3l-4 5h3l-4 5h16l-4-5h3l-4-5h3z"));
    x.fillRect(11,19,2,3);
    x.restore();
    return c.toDataURL("image/png");
  }catch(e){ return appIconDataUri(); }
}
let ICONS = null;
function getIcons(){
  if(!ICONS) ICONS = { i180:iconPng(180), i192:iconPng(192), i512:iconPng(512) };
  return ICONS;
}
let manifestUrl = null;
function buildManifest(name){
  try{
    const ic = getIcons();
    const m = {
      name: name, short_name: name.slice(0,24),
      start_url: location.href, display: "standalone", orientation: "portrait",
      background_color: "#1a1917", theme_color: "#0f6e56",
      icons: [
        { src: ic.i192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: ic.i512, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(m)], { type: "application/manifest+json" });
    if(manifestUrl) URL.revokeObjectURL(manifestUrl);
    manifestUrl = URL.createObjectURL(blob);
    els.manifest.setAttribute("href", manifestUrl);
  }catch(e){}
}
function applyAppName(name){
  appName = (name && name.trim()) ? name.trim() : DEFAULT_APP_NAME;
  els.appTitle.textContent = appName;
  document.title = appName;
  const am = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(am) am.setAttribute("content", appName.slice(0,30));
  buildManifest(appName);
}
/* Info-Fenster (oben rechts) */
function infoAuf(){ $("infoOv").classList.add("open"); }
function infoZu(){ $("infoOv").classList.remove("open"); }

/* --- UI-Sync --- */
function syncReveals(){
  els.wtBody.style.display = els.wtToggle.checked ? "block" : "none";
  const vat = els.vatToggle.checked;
  els.rateField.style.opacity = vat ? "1" : ".4";
  els.rateField.style.pointerEvents = vat ? "auto" : "none";
  els.customRateRow.classList.toggle("open", vat && els.vatRate.value === "custom");
  updateSpeciesHint();
}
function updateSpeciesHint(){
  const show = els.barkToggle.checked && ORIENTIERUNG.has(els.species.value);
  els.speciesHint.classList.toggle("show", show);
  if(show){
    const nm = RINDENABZUG[els.species.value]?.name || "";
    els.speciesHint.textContent = `Hinweis: ${nm} ist ein RVR-Orientierungswert (nicht wissenschaftlich hergeleitet, regional abweichend).`;
  }
}

function render(){
  els.list.innerHTML = "";

  if(items.length === 0){
    els.list.innerHTML = `<div class="card empty">
      <svg viewBox="0 0 24 24"><path d="M12 2 6 9h3l-4 5h3l-4 5h16l-4-5h3l-4-5h3z"/></svg>
      Noch keine Balken.<br>Länge und Durchmesser eingeben und „Hinzufügen" tippen.</div>`;
    els.clearBtn.style.display = "none";
  }else{
    els.clearBtn.style.display = "block";
    const wNow = els.wtToggle.checked ? waterContent() : null;
    for(const it of items){
      const each = volumeEach(it);
      const tot = round3(volumeTotal(it));
      const artName = RINDENABZUG[it.species]?.name || "";
      let meta;
      if(it.bark){
        const ded = barkDeduction(it.species, it.diameter);
        const eff = Math.max(0, it.diameter - ded);
        meta = `${fmt(it.length,2)} m · ${artName} · Ø ${fmt(it.diameter,1)}→${fmt(eff,1)} cm · −${fmt(ded,0)} cm Rinde`;
      }else{
        meta = `${fmt(it.length,2)} m · ${artName} · Ø ${fmt(it.diameter,1)} cm · mit Rinde`;
      }
      const mult = it.qty > 1 ? `<span class="mult">(${it.qty} × ≈ ${fmt(each)} Fm)</span>` : "";
      const shown = fmt(tot);
      const kgItem = wNow != null ? itemKg(it, wNow) : null;
      const wtLine = kgItem != null ? `<div class="wt">≈ ${fmt(kgItem,0)} kg</div>` : "";
      const el = document.createElement("div");
      el.className = "card item" + (it.id === editId ? " active" : "");
      el.innerHTML = `
        <div class="info">
          <div class="fm">${shown} Fm ${mult}</div>
          <div class="meta">${meta}</div>
          ${wtLine}
        </div>
        <button class="icon-btn edit" aria-label="Bearbeiten">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>
        </button>
        <button class="icon-btn del" aria-label="Löschen">
          <svg viewBox="0 0 24 24"><path d="M6 7h12l-1 14H7zM9 4h6l1 2h4v2H4V6h4z"/></svg>
        </button>`;
      el.querySelector(".edit").onclick = () => startEdit(it.id);
      el.querySelector(".del").onclick  = () => removeItem(it.id);
      els.list.appendChild(el);
    }
  }

  const t = computeTotals();
  els.totalVal.textContent = fmt(t.totalFm);
  els.count.textContent = t.stems === 1 ? "1 Stamm" : t.stems + " Stämme";
  els.totalSub.textContent = items.length ? "Summe aller Balken" : "Länge × Mittendurchmesser eingeben";

  /* € in Gesamt-Karte + Aufschlüsselung */
  if(t.price > 0 && items.length){
    const showVat = els.vatToggle.checked && t.rate > 0;
    els.totalEuro.style.display = "block";
    els.totalEuro.innerHTML = "= " + euro(showVat ? t.brutto : t.netto) +
      (showVat ? ` <span>brutto · inkl. ${fmt(t.rate,2).replace(/,00$/,'')} % MwSt</span>` : ` <span>netto</span>`);
    els.breakdown.classList.add("show");
    els.bNetto.textContent = euro(t.netto);
    if(showVat){
      els.bMwstRow.style.display = "flex";
      els.bMwstLbl.textContent = `zzgl. ${fmt(t.rate,2).replace(/,00$/,'')} % MwSt`;
      els.bMwst.textContent = euro(t.mwst);
      els.bBrutto.textContent = euro(t.brutto);
    }else{
      els.bMwstRow.style.display = "none";
      els.bBrutto.textContent = euro(t.netto);
    }
  }else{
    els.totalEuro.style.display = "none";
    els.breakdown.classList.remove("show");
  }

  /* Brennholz-Umrechnung (Raummeter/Ster + Schüttraummeter) */
  els.rmVal.textContent = fmt(t.totalFm * (num(els.rmFactor.value) || 0), 2) + " Rm";
  els.srmVal.textContent = fmt(t.totalFm * (num(els.srmFactor.value) || 0), 2) + " Srm";

  /* Gewicht: Summenkarte + Gewichts-Karte */
  if(t.wtOn && t.kg != null && items.length){
    els.totalWt.style.display = "block";
    els.totalWt.innerHTML = "≈ " + fmt(t.kg,0) + " kg <span>(" + fmt(t.kg/1000,2) + " t) · " + fmt(t.w,1).replace(/,0$/,"") + " % Wasser</span>";
  }else{
    els.totalWt.style.display = "none";
  }
  if(t.wtOn){
    els.wtKg.textContent = t.kg != null ? fmt(t.kg,0) + " kg" : "–";
    els.wtT.textContent  = t.kg != null ? fmt(t.kg/1000,2) + " t" : "–";
    updateWtHint(t.w);
  }
  renderZopf();
}

/* Kantholz: Auswahl füllen */
function updateWtHint(w){
  if(w == null){
    els.wtHint.textContent = "Wassergehalt eingeben (0 bis 90 %), sonst kann kein Gewicht berechnet werden.";
    return;
  }
  const sp = els.species.value, nm = RINDENABZUG[sp]?.name || "";
  const r = RAUMDICHTE[sp], k = kgPerFm(sp, w);
  const naeh = RD_NAEHERUNG.has(sp) ? " (Näherungswert)" : "";
  els.wtHint.textContent =
    `Rechenbasis für die im Bereich „Stämme“ gewählte Baumart ${nm}: ${fmt(r,0)} kg Trockenmasse je Fm${naeh} → ${fmt(k,0)} kg je Fm bei ${fmt(w,1).replace(/,0$/,"")} % Wasser. ` +
    `Der Festmeter gilt frisch, wie im Wald gemessen. Bei „mit Rinde“ steckt die Rinde im Volumen – das Gewicht ist dann leicht zu hoch.`;
}

/* --- Aktionen --- */
els.form.addEventListener("submit", (e)=>{
  e.preventDefault();
  const length = num(els.length.value);
  const diameter = num(els.diameter.value);
  let qty = parseInt(els.qty.value, 10);
  if(!qty || qty < 1) qty = 1;
  if(!(length > 0)){ els.length.focus(); return; }
  if(!(diameter > 0)){ els.diameter.focus(); return; }

  const data = { length, diameter, qty, bark: els.barkToggle.checked, species: els.species.value };
  if(editId){
    const it = items.find(x=>x.id===editId);
    if(it) Object.assign(it, data);
    stopEdit();
  }else{
    data.id = "id" + (items.reduce((m,x)=>Math.max(m, +String(x.id).replace("id","")||0),0)+1);
    items.push(data);
  }
  save(); savePrefs(); render(); resetForm();
});

function resetForm(){ els.length.value=""; els.diameter.value=""; els.qty.value="1"; els.length.focus(); }

function startEdit(id){
  const it = items.find(x=>x.id===id);
  if(!it) return;
  editId = id;
  els.length.value = String(it.length).replace(".", ",");
  els.diameter.value = String(it.diameter).replace(".", ",");
  els.qty.value = it.qty;
  els.barkToggle.checked = it.bark;
  els.species.value = it.species;
  syncReveals();
  document.body.classList.add("editing");
  els.submitLabel.textContent = "Aktualisieren";
  render();
  window.scrollTo({top:0, behavior:"smooth"});
  els.length.focus();
}
function stopEdit(){ editId=null; document.body.classList.remove("editing"); els.submitLabel.textContent="Hinzufügen"; }
els.cancelBtn.onclick = ()=>{ stopEdit(); resetForm(); render(); };

function removeItem(id){
  if(id === editId){ stopEdit(); resetForm(); }
  items = items.filter(x=>x.id!==id);
  save(); render();
}
els.clearBtn.onclick = ()=>{
  if(confirm("Wirklich alle Balken löschen?")){ items=[]; stopEdit(); save(); render(); }
};

els.barkToggle.addEventListener("change", ()=>{ syncReveals(); savePrefs(); render(); });
els.species.addEventListener("change", ()=>{ savePrefs(); updateSpeciesHint(); render(); });
els.price.addEventListener("input", ()=>{ savePrefs(); render(); });
els.vatToggle.addEventListener("change", ()=>{ syncReveals(); savePrefs(); render(); });
els.vatRate.addEventListener("change", ()=>{ syncReveals(); savePrefs(); render(); });
els.vatCustom.addEventListener("input", ()=>{ savePrefs(); render(); });
els.issuer.addEventListener("input", savePrefs);
els.recipient.addEventListener("input", savePrefs);
$("infoBtn").addEventListener("click", infoAuf);
$("infoZu").addEventListener("click", infoZu);
$("infoOv").addEventListener("click", (e) => { if(e.target.id === "infoOv") infoZu(); });
function applyRmPreset(){
  const p = RM_PRESETS[els.rmPreset.value];
  if(p){
    els.rmFactor.value = String(p[0]).replace(".", ",");
    els.srmFactor.value = String(p[1]).replace(".", ",");
  }
}
els.rmPreset.addEventListener("change", ()=>{ applyRmPreset(); savePrefs(); render(); });
els.rmFactor.addEventListener("input", ()=>{ els.rmPreset.value = "eigene"; savePrefs(); render(); });
els.srmFactor.addEventListener("input", ()=>{ els.rmPreset.value = "eigene"; savePrefs(); render(); });
els.rmPdfToggle.addEventListener("change", savePrefs);
els.wtToggle.addEventListener("change", ()=>{ syncReveals(); savePrefs(); render(); });
els.wtPreset.addEventListener("change", ()=>{
  if(WT_PRESETS[els.wtPreset.value] != null) els.wtW.value = String(WT_PRESETS[els.wtPreset.value]);
  savePrefs(); render();
});
els.wtW.addEventListener("input", ()=>{
  /* passt der Wert zu einem Zustand, wird dieser angezeigt – sonst „Eigener Wert" */
  const w = waterContent();
  const hit = Object.keys(WT_PRESETS).find(k => WT_PRESETS[k] === w);
  els.wtPreset.value = hit || "eigen";
  savePrefs(); render();
});
/* --- Untere Leiste: Bereiche umschalten --- */
const TAB_UNTERTITEL = {stamm: "Festmeter (Fm) berechnen", brenn: "Raummeter, Schüttraummeter und Gewicht",
  kant: "Mindest-Zopf und passende Balken", liste: "Projekte abhaken und Listen einlesen", rech: "Preis, MwSt und PDF-Rechnung"};
function showTab(t){
  curTab = TABS.includes(t) ? t : "stamm";
  const sub = document.getElementById("appSub"); if(sub) sub.textContent = TAB_UNTERTITEL[curTab] || "";
  if(curTab === "kant" && zMode === "p" && typeof zPlanRender === "function") renderZopf();   // Holzliste kann sich geändert haben
  document.querySelectorAll("[data-tab]").forEach(el =>
    el.classList.toggle("tab-hide", !el.dataset.tab.split(" ").includes(curTab)));
  document.querySelectorAll("#tabbar button").forEach(b => {
    const on = b.dataset.go === curTab;
    b.classList.toggle("on", on);
    if(on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}
document.getElementById("tabbar").addEventListener("click", (e)=>{
  const b = e.target.closest("button[data-go]");
  if(!b) return;
  const same = b.dataset.go === curTab;
  showTab(b.dataset.go); savePrefs();
  window.scrollTo({top:0, behavior: same ? "smooth" : "auto"});
});
/* Handy-Tastatur offen → Leiste ausblenden, damit sie nicht über den Feldern hängt */
if(window.matchMedia && matchMedia("(pointer:coarse)").matches){
  const isField = (t) => t && t.matches && t.matches("input[type=text], input[type=number], textarea");
  /* Leiste nur ausblenden, solange wirklich ein Eingabefeld aktiv ist. Früher blieb sie weg, wenn ein aktives Feld
     neu aufgebaut wurde (z. B. nach „Hinzufügen“ in der Holzliste) – dann kam kein „Fokus weg“ mehr. */
  const kbPruefen = () => document.body.classList.toggle("kb", isField(document.activeElement));
  window.kbPruefen = kbPruefen;
  document.addEventListener("focusin", kbPruefen);
  document.addEventListener("focusout", () => setTimeout(kbPruefen, 60));
  document.addEventListener("click", () => setTimeout(kbPruefen, 60), true);
  document.addEventListener("touchend", () => setTimeout(kbPruefen, 120), true);
  document.addEventListener("visibilitychange", kbPruefen);
  window.addEventListener("pageshow", kbPruefen);
  if(window.visualViewport) visualViewport.addEventListener("resize", () => setTimeout(kbPruefen, 60));
  setInterval(kbPruefen, 1500);
}
els.invNo.addEventListener("input", savePrefs);
els.payment.addEventListener("input", savePrefs);
