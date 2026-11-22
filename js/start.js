/* Holzmeter – Start
   Läuft als letzter Baustein: Daten aus dem App-Speicher zurückholen, erste Anzeige, Zurück-Taste (Android), Service Worker.
   Steht am Ende, damit alle anderen Bausteine schon geladen sind. */
"use strict";

if(IST_NATIVE){
  (async ()=>{
    const P = nativPlugin("Preferences");
    if(!P) return;
    try{
      let geholt = false;
      for(const k of [K_ITEMS, K_PREFS, K_LISTEN]){
        if(localStorage.getItem(k) == null){
          const r = await P.get({key:k});
          if(r && r.value != null){ localStorage.setItem(k, r.value); geholt = true; }
        }else{
          nativSpiegeln(k, localStorage.getItem(k));   // vorhandenen Stand absichern
        }
      }
      /* ohne Neuladen übernehmen: Ein Neuladen ließ unter iOS die Abstände zu Uhrzeit-Leiste und Home-Balken wegfallen */
      if(geholt){ items = load(); listen = lsLaden(); loadPrefs(); showTab(curTab); render(); lsRender(); }
    }catch(e){}
  })();
}
/* Android: Zurück-Taste schließt zuerst die Foto-Messung, sonst geht die App in den Hintergrund */
if(nativPlugin("App")){
  nativPlugin("App").addListener("backButton", ()=>{
    const ov = document.getElementById("camOverlay");
    if(ov && getComputedStyle(ov).display !== "none"){ const c = document.getElementById("camClose"); if(c) c.click(); return; }
    if(document.getElementById("lsOv").classList.contains("open")){ lsOvZu(); return; }
    if(document.getElementById("infoOv").classList.contains("open")){ infoZu(); return; }
    if(curTab === "liste" && lsOpen){ lsOpen = null; lsEditPos = null; savePrefs(); lsRender(); return; }
    nativPlugin("App").minimizeApp();
  });
}
/* --- Start --- */
fillZopfSelects();
loadPrefs();
showTab(curTab);
render();
lsRender();

/* Home-Screen: echtes PNG als iOS-Kachel setzen + Service Worker registrieren
   (Service Worker geht nur, wenn die Seite per http(s) ausgeliefert wird – bei
   lokaler Datei wird er still übersprungen, die App läuft trotzdem). */
try{ const ati=document.querySelector('link[rel="apple-touch-icon"]'); if(ati) ati.setAttribute("href", getIcons().i180); }catch(e){}
if(!IST_NATIVE && "serviceWorker" in navigator && location.protocol.indexOf("http")===0){
  window.addEventListener("load", ()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}
