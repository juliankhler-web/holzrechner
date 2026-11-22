/* Holzmeter – Durchmesser per Foto messen (Oberfläche)
   Braucht: app.js. */
"use strict";

/* --- Kamera: Durchmesser per Foto messen ---
   Foto vom Stamm-Ende + Referenz (bekannte Länge) im Bild. Nutzer zieht je 2 Punkte
   für Referenz (grün) und Durchmesser (orange). Ø[cm] = diaPx · refCm / refPx. */
const cam = {
  overlay:$("camOverlay"), stage:$("camStage"), canvas:$("camCanvas"),
  empty:$("camEmpty"), ctrl:$("camCtrl"), ref:$("camRef"), readout:$("camReadout"), input:$("camInput"),
};
cam.ctx = cam.canvas.getContext("2d");
let camImg = null, camPts = null, camDrag = null;
const cdist = (a,b)=>Math.hypot(a.x-b.x, a.y-b.y);

function openCam(){
  cam.overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  if(camImg){ showCanvas(); fitCanvas(); drawCam(); } else { showEmpty(); }
}
function closeCam(){ cam.overlay.classList.remove("open"); document.body.style.overflow = ""; }
function showEmpty(){ cam.empty.style.display="block"; cam.canvas.style.display="none"; cam.ctrl.style.display="none"; }
function showCanvas(){ cam.empty.style.display="none"; cam.canvas.style.display="block"; cam.ctrl.style.display="block"; }

function fitCanvas(){
  if(!camImg) return;
  const availW = cam.stage.clientWidth - 16, availH = cam.stage.clientHeight - 16;
  const ratio = Math.min(availW/camImg.naturalWidth, availH/camImg.naturalHeight, 1) || 1;
  const cw = Math.max(60, Math.round(camImg.naturalWidth*ratio));
  const ch = Math.max(60, Math.round(camImg.naturalHeight*ratio));
  cam.canvas.width = cw; cam.canvas.height = ch;
  cam.canvas.style.width = cw+"px"; cam.canvas.style.height = ch+"px";
}
function initHandles(){
  const w=cam.canvas.width, h=cam.canvas.height;
  camPts = {
    ref:[{x:w*0.22,y:h*0.82},{x:w*0.52,y:h*0.82}],
    dia:[{x:w*0.34,y:h*0.42},{x:w*0.66,y:h*0.42}],
  };
}
function loadPhoto(file){
  const r = new FileReader();
  r.onload = ()=>{
    const img = new Image();
    img.onload = ()=>{ camImg=img; showCanvas(); fitCanvas(); initHandles(); drawCam(); };
    img.src = r.result;
  };
  r.readAsDataURL(file);
}
function drawLineCam(pts,color){
  const c=cam.ctx;
  c.lineWidth=2; c.strokeStyle=color;
  c.beginPath(); c.moveTo(pts[0].x,pts[0].y); c.lineTo(pts[1].x,pts[1].y); c.stroke();
  for(const p of pts){
    c.beginPath(); c.arc(p.x,p.y,9,0,Math.PI*2); c.fillStyle=color; c.fill();
    c.lineWidth=2.5; c.strokeStyle="#fff"; c.stroke();
  }
}
function drawCam(){
  const c=cam.ctx, cv=cam.canvas;
  c.clearRect(0,0,cv.width,cv.height);
  if(camImg) c.drawImage(camImg,0,0,cv.width,cv.height);
  if(camPts){ drawLineCam(camPts.ref,"#39d98a"); drawLineCam(camPts.dia,"#ffa53a"); }
  updateCamReadout();
}
function computeCamDia(){
  if(!camPts) return null;
  const refCm=num(cam.ref.value);
  const refPx=cdist(camPts.ref[0],camPts.ref[1]);
  const diaPx=cdist(camPts.dia[0],camPts.dia[1]);
  if(!(refCm>0) || refPx<1) return null;
  return diaPx*refCm/refPx;
}
function updateCamReadout(){
  const d=computeCamDia();
  cam.readout.innerHTML = d==null
    ? "Referenz-Länge eingeben und die Punkte an die Enden ziehen."
    : `Durchmesser ≈ <b>${fmt(d,1)} cm</b>`;
}
function camCanvasPt(e){
  const r=cam.canvas.getBoundingClientRect();
  return { x:(e.clientX-r.left)*(cam.canvas.width/r.width), y:(e.clientY-r.top)*(cam.canvas.height/r.height) };
}
cam.canvas.addEventListener("pointerdown", (e)=>{
  if(!camPts) return;
  e.preventDefault();
  const p=camCanvasPt(e); let best=null, bd=32;
  for(const ln of ["ref","dia"]) for(let i=0;i<2;i++){ const d=cdist(p,camPts[ln][i]); if(d<bd){bd=d; best={ln,i};} }
  if(best){ camDrag=best; try{ cam.canvas.setPointerCapture(e.pointerId); }catch(_){} }
});
cam.canvas.addEventListener("pointermove", (e)=>{
  if(!camDrag) return;
  e.preventDefault();
  const p=camCanvasPt(e);
  camPts[camDrag.ln][camDrag.i] = { x:Math.max(0,Math.min(cam.canvas.width,p.x)), y:Math.max(0,Math.min(cam.canvas.height,p.y)) };
  drawCam();
});
const endCamDrag = ()=>{ camDrag=null; };
cam.canvas.addEventListener("pointerup", endCamDrag);
cam.canvas.addEventListener("pointercancel", endCamDrag);
window.addEventListener("resize", ()=>{
  if(!camImg || !cam.overlay.classList.contains("open")) return;
  const oldW=cam.canvas.width, oldH=cam.canvas.height;
  fitCanvas();
  if(camPts && oldW && oldH){
    const sx=cam.canvas.width/oldW, sy=cam.canvas.height/oldH;
    for(const ln of ["ref","dia"]) for(const p of camPts[ln]){ p.x*=sx; p.y*=sy; }
  }
  drawCam();
});

$("measureBtn").onclick = openCam;
$("camShoot").onclick = ()=> cam.input.click();
$("camRetake").onclick = ()=> cam.input.click();
$("camClose").onclick = closeCam;
cam.ref.addEventListener("input", drawCam);
cam.input.addEventListener("change", (e)=>{
  const f = e.target.files && e.target.files[0];
  if(f){ if(!cam.overlay.classList.contains("open")) openCam(); loadPhoto(f); }
  e.target.value = "";
});
$("camApply").onclick = ()=>{
  const d = computeCamDia();
  if(d==null){ alert("Bitte Referenz-Länge eingeben und die beiden Linien setzen."); return; }
  els.diameter.value = fmt(d,1);
  closeCam();
  els.diameter.focus();
};
