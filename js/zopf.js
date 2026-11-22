/* Holzmeter – Kantholz-Geometrie (reine Rechenlogik, ohne Bildschirm)
   Mindest-Zopf-Ø nach Schnittklassen, wie viele Balken in einen Stamm passen, Zeichnung als SVG-Text,
   Vorschlag „ein Maß je Stamm“ aus der Holzliste (zGleichOptionen).
   Braucht: rechnen.js (fmt). Wird geprüft in tests/. */
"use strict";

/* Kantholz: Mindest-Zopf-Ø – EIGENE Berechnung (keine Tabellenwerte in der App).
   Regeln der Schnittklassen, 3 mm Sägeschnitt zwischen den Balken:
   S scharfkantig: alle Ecken im Stamm (kleinster Umkreis um die Balken).
   C gestreift:    jede Seite jedes Balkens wird von der Säge berührt (1,5 mm Streifen).
   B baumkantig:   Baumkante (schräg über die Ecke gemessen) höchstens 1/3 der Balkenhöhe, dazu C.
   A vollkantig:   Baumkante höchstens 1/8 der Balkenhöhe, dazu C; ein einzelner Balken mindestens 0,963 × Diagonale.
   Die Stamm-Mitte wird so verschoben, dass der nötige Ø am kleinsten ist.
   Gegen eine gedruckte Mindest-Zopf-Tabelle geprüft: im Mittel unter 1 mm Abweichung. */
const Z_KLASSEN = {
  S:"S · scharfkantig (ohne Baumkante)",
  A:"A · vollkantig (Baumkante bis 1/8)",
  B:"B · baumkantig (Baumkante bis 1/3)",
  C:"C · gestreift (jede Seite angesägt)",
};
const Z_ARTEN = [
  {n:1, t:"1 Stück"},
  {n:2, t:"2 Stück nebeneinander"},
  {n:3, t:"3 Stück nebeneinander"},
  {n:3, t:"3 Stück (1 stehend, 2 liegend)"},
  {n:4, t:"4 Stück (2 × 2)"},
  {n:6, t:"6 Stück (3 × 2)"},
];
const Z_FUGE = 0.3;
const zR = (x, y, w, h) => ({x, y, w, h});
/* klassische Einschnittarten (b ≤ h, h senkrecht) */
function zopfLayout(b, h, art){
  const K = Z_FUGE, R = zR;
  switch(art){
    case 0: return [R(0,0,b,h)];
    case 1: return [R(0,0,b,h), R(b+K,0,b,h)];
    case 2: return [R(0,0,b,h), R(b+K,0,b,h), R(2*(b+K),0,b,h)];
    case 3: { const H = Math.max(h, 2*b+K), ya = (H-h)/2;
              return [R(0,ya,b,h), R(b+K,0,h,b), R(b+K,b+K,h,b)]; }
    case 4: return [R(0,0,b,h), R(b+K,0,b,h), R(0,h+K,b,h), R(b+K,h+K,b,h)];
    case 5: return [0,1,2].flatMap(i => [R(i*(b+K),0,b,h), R(i*(b+K),h+K,b,h)]);
  }
  return [];
}
/* kleinster Kreis um eine Punktmenge (wenige Punkte → Durchprobieren reicht) */
function zMinCircle(pts){
  const d = (a,c) => Math.hypot(a.x-c.x, a.y-c.y);
  const inside = (c,r) => pts.every(p => d(p,c) <= r + 1e-6);
  let best = null;
  const take = (c,r) => { if(inside(c,r) && (!best || r < best.r)) best = {x:c.x, y:c.y, r}; };
  for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
    const c = {x:(pts[i].x+pts[j].x)/2, y:(pts[i].y+pts[j].y)/2}; take(c, d(pts[i],c));
    for(let k=j+1;k<pts.length;k++){
      const A=pts[i], B=pts[j], C=pts[k];
      const D = 2*(A.x*(B.y-C.y) + B.x*(C.y-A.y) + C.x*(A.y-B.y));
      if(Math.abs(D) < 1e-9) continue;
      const a2=A.x*A.x+A.y*A.y, b2=B.x*B.x+B.y*B.y, c2=C.x*C.x+C.y*C.y;
      const u = {x:(a2*(B.y-C.y)+b2*(C.y-A.y)+c2*(A.y-B.y))/D, y:(a2*(C.x-B.x)+b2*(A.x-C.x)+c2*(B.x-A.x))/D};
      take(u, d(A,u));
    }
  }
  return best;
}
const zCorners = (rs) => rs.flatMap(r => [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x,y:r.y+r.h},{x:r.x+r.w,y:r.y+r.h}]);
/* Abstand Kreismitte → nächster Punkt einer waagrechten/senkrechten Balkenseite */
function zSegDist(cx, cy, x0, y0, x1, y1){
  const px = Math.min(Math.max(cx, x0), x1), py = Math.min(Math.max(cy, y0), y1);
  return Math.hypot(px-cx, py-cy);
}
/* Strecke von einer Ecke entlang einer Seite, bis Holz kommt (Kreis mit Radius R um 0/0) */
function zAlong(ax, ay, ux, uy, L, R){
  const A = ux*ux+uy*uy, B = 2*(ax*ux+ay*uy), C = ax*ax+ay*ay-R*R, disc = B*B-4*A*C;
  if(disc < 0) return L;
  const t = (-B - Math.sqrt(disc)) / (2*A);
  return Math.min(Math.max(t, 0), L);
}
/* Erfüllt Balken r bei Stamm (Mitte cx/cy, Radius R) die Regeln der Klasse? hp = Balkenhöhe (größere Seite) */
function zRectOk(r, cx, cy, R, kl, hp){
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
  if(kl === "S"){
    const R2 = (R + 1e-9) * (R + 1e-9);
    return [[x0,y0],[x1,y0],[x0,y1],[x1,y1]].every(([x,y]) => (x-cx)*(x-cx) + (y-cy)*(y-cy) <= R2);
  }
  /* jede Seite muss angesägt sein (gilt für C, B und A) */
  const Rc = R - Z_FUGE/2;
  if(zSegDist(cx,cy,x0,y0,x1,y0) >= Rc || zSegDist(cx,cy,x0,y1,x1,y1) >= Rc ||
     zSegDist(cx,cy,x0,y0,x0,y1) >= Rc || zSegDist(cx,cy,x1,y0,x1,y1) >= Rc) return false;
  if(kl === "C") return true;
  const lim = (kl === "A" ? 1/8 : 1/3) * hp + 1e-9;
  for(const [px,py,sx,sy] of [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]]){
    const dx = px - cx, dy = py - cy;
    if(dx*dx + dy*dy <= R*R) continue;
    const u = zAlong(dx, dy, sx, 0, r.w, R), v = zAlong(dx, dy, 0, sy, r.h, R);
    if(u >= r.w || v >= r.h) return false;
    if(Math.hypot(u, v) > lim) return false;
  }
  return true;
}
/* Kleinster Ø für feste Balken-Anordnung; die Stamm-Mitte wird optimal verschoben */
function zNeedD(rs, kl, hp){
  const mc = zMinCircle(zCorners(rs));
  if(kl === "S") return {D: 2*mc.r, cx: mc.x, cy: mc.y};
  const ok = (cx, cy, R) => rs.every(r => zRectOk(r, cx, cy, R, kl, hp));
  const dAt = (cx, cy) => {
    let lo = 0, hi = mc.r + 4;
    for(let i=0;i<40;i++){ const m = (lo+hi)/2; if(ok(cx, cy, m)) hi = m; else lo = m; }
    return 2*hi;
  };
  let best = {D: dAt(mc.x, mc.y), cx: mc.x, cy: mc.y}, step = 1;
  while(step > 0.02){
    let imp = false;
    for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){
      const cx = best.cx + dx, cy = best.cy + dy, D = dAt(cx, cy);
      if(D < best.D - 1e-6){ best = {D, cx, cy}; imp = true; }
    }
    if(!imp) step /= 2;
  }
  return best;
}
/* Klassische Einschnittart (b/h in beliebiger Reihenfolge eingegeben) */
function zClassic(b, h, art, kl){
  const bb = Math.min(b,h), hh = Math.max(b,h), rects = zopfLayout(bb, hh, art);
  const res = zNeedD(rects, kl, hh);
  if(kl === "A" && art === 0) res.D = Math.max(res.D, 0.963 * Math.hypot(b, h));
  return {...res, rects, label: Z_ARTEN[art].t, count: Z_ARTEN[art].n};
}
/* Viele Balken: Reihen übereinander, jede Reihe mittig so lang wie möglich (beide Lagen probiert).
   Liefert die größte Stückzahl für den Ø D; Stamm-Mitte = 0/0. */
function zRowsFit(D, b, h, kl){
  const R = D/2, K = Z_FUGE, hp = Math.max(b, h);
  let best = null;
  for(const [w, hh, turned] of [[b, h, false], [h, b, true]]){
    if(turned && w === hh) continue;
    /* großzügige Obergrenzen: mit Baumkante dürfen Balken über den Kreis ragen */
    const kMax = Math.floor((D + 2*hp + K) / (hh + K)), mCap = Math.floor((D + 2*hp + K) / (w + K));
    for(let k=1; k<=kMax; k++){
      const Hs = k*hh + (k-1)*K;
      for(const off of (k === 1 ? [0] : [0, 0.25, 0.5])){
        const y0 = -Hs/2 + off*(hh + K)/2;
        const per = [];
        let count = 0;
        for(let j=0; j<k; j++){
          const y = y0 + j*(hh + K);
          const fits = (m) => { const Wm = m*w + (m-1)*K; return zRectOk(zR(Wm/2 - w, y, w, hh), 0, 0, R, kl, hp); };
          let lo = 0, hi = mCap;            // größtes m mit fits(m) (fits ist fallend in m)
          while(lo < hi){ const m = Math.floor((lo + hi + 1)/2); if(fits(m)) lo = m; else hi = m - 1; }
          per.push(lo); count += lo;
        }
        if(!best || count > best.count) best = {count, per, w, hh, turned, y0};
      }
    }
  }
  if(!best || best.count === 0) return {count:0, rects:[], cx:0, cy:0, label:""};
  const rects = [];
  best.per.forEach((m, j) => {
    const y = best.y0 + j*(best.hh + K), Wm = m*best.w + (m-1)*K;
    for(let i=0; i<m; i++) rects.push(zR(-Wm/2 + i*(best.w + K), y, best.w, best.hh));
  });
  const rows = best.per.filter(m => m > 0);
  const label = (rows.length === 1 ? `${rows[0]} Stück nebeneinander`
               : rows.length <= 6 ? `${rows.length} Reihen: ${rows.join(" + ")}`
               : `${rows.length} Reihen mit ${Math.min(...rows)} bis ${Math.max(...rows)} Stück`) +
                (best.turned ? " (Balken liegend)" : "");
  return {count: best.count, rects, cx:0, cy:0, label};
}
/* Maß → nötiger Ø für n Stück: beste klassische Einschnittart oder Reihen-Anordnung */
function zBestForCount(b, h, n, kl){
  let best = null;
  Z_ARTEN.forEach((a, i) => { if(a.n === n){ const c = zClassic(b, h, i, kl); if(!best || c.D < best.D - 1e-6) best = c; } });
  if(n > 1){
    let lo = 0, hi = Math.max(b, h) * 2;
    while(zRowsFit(hi, b, h, kl).count < n && hi < 3000) hi *= 1.5;
    if(hi < 3000){
      for(let i=0;i<32;i++){ const m = (lo+hi)/2; if(zRowsFit(m, b, h, kl).count >= n) hi = m; else lo = m; }
      const f = zRowsFit(hi, b, h, kl);
      if(!best || hi < best.D - 0.05){
        let rects = f.rects;
        if(rects.length > n){       // überzählige Balken (die äußersten) weglassen
          const far = r => Math.max(...zCorners([r]).map(p => Math.hypot(p.x, p.y)));
          rects = rects.slice().sort((p, q) => far(p) - far(q)).slice(0, n);
        }
        best = {D: hi, cx: 0, cy: 0, rects, label: f.label + (f.count > n ? ` (davon ${n} genutzt)` : ""), count: n};
      }
    }
  }
  /* angezeigter Ø (auf 1 mm aufgerundet) muss die Stückzahl sicher ergeben */
  if(best){
    let D = zUp(best.D), guard = 0;
    while(zFitInD(D, b, h, kl).count < n && guard++ < 50) D = Math.round((D + 0.1) * 10) / 10;
    best.D = D;
  }
  return best;
}
/* Mein Ø → wie viele Stück passen? */
function zFitInD(D, b, h, kl){
  let res = zRowsFit(D, b, h, kl);
  Z_ARTEN.forEach((a, i) => {
    if(a.n > res.count){ const c = zClassic(b, h, i, kl); if(c.D <= D + 1e-9) res = c; }
  });
  if(kl === "A" && res.count === 1 && D < 0.963 * Math.hypot(b, h) - 1e-9) res = {count:0, rects:[], cx:0, cy:0, label:""};
  return res;
}
/* größter quadratischer Einzelbalken aus Ø D */
function zMaxSquare(D, kl){
  let lo = 0, hi = D;
  for(let i=0;i<30;i++){ const m = (lo+hi)/2; if(zClassic(m, m, 0, kl).D <= D) lo = m; else hi = m; }
  return lo;
}
const zUp = (v) => Math.ceil(v*10 - 1e-6) / 10;            // Ø immer auf 1 mm aufrunden
const zCm = (v) => fmt(v, 1).replace(/,0$/, "");
/* Zeichnung: Stammquerschnitt mit den Balken im Maßstab; Rot = Baumkante */
function zopfSvg(rects, cx, cy, D, cap){
  const r = D/2;
  const far = rects.length ? Math.max(...zCorners(rects).map(p => Math.hypot(p.x-cx, p.y-cy))) : 0;
  const half = Math.max(r, far) * 1.08 + 1;
  const vb = `${(cx-half).toFixed(2)} ${(cy-half).toFixed(2)} ${(2*half).toFixed(2)} ${(2*half).toFixed(2)}`;
  const many = rects.length > 1500;
  const rectEls = (fill, extra="") => many ? "" : rects.map(R => `<rect x="${R.x.toFixed(2)}" y="${R.y.toFixed(2)}" width="${R.w}" height="${R.h}" fill="${fill}" ${extra}/>`).join("");
  const id = "zc" + Math.random().toString(36).slice(2,8);
  const rings = [0.78,0.56,0.34].map(f => `<circle cx="${cx}" cy="${cy}" r="${(r*f).toFixed(2)}" fill="none" stroke="#c9a173" stroke-width="0.6" vector-effect="non-scaling-stroke" opacity=".7"/>`).join("");
  const wane = far > r + 0.05;
  return `<svg viewBox="${vb}" role="img" aria-label="Stammquerschnitt Ø ${zCm(D)} cm">
    <defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#e9cfa6" stroke="#8a4c14" stroke-width="3" vector-effect="non-scaling-stroke"/>
    ${rings}
    ${wane ? rectEls("#e57368", 'opacity=".85"') : ""}
    <g clip-path="url(#${id})">${rectEls("#f6e3c4")}</g>
    ${rectEls("none", 'stroke="#3b2a17" stroke-width="' + (rects.length > 200 ? 0.6 : 1.6) + '" vector-effect="non-scaling-stroke"')}
    ${rects.filter(R => R.lab).map(R => `<text x="${(R.x + R.w/2).toFixed(2)}" y="${(R.y + R.h/2).toFixed(2)}" font-size="${Math.max(1.2, Math.min(R.w, R.h) * 0.42).toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="#3b2a17" font-weight="700" font-family="-apple-system,Segoe UI,Roboto,sans-serif">${R.lab}</text>`).join("")}
  </svg>
  <div class="z-cap">${cap}${many ? "<br>Zu viele Balken zum Zeichnen." :
    wane ? '<br><span style="color:var(--danger)">Rot</span> = Baumkante (dort fehlt Holz an den Kanten)'
         : (r - far > 0.3 ? "<br>Scharfkantig – rundum bleibt noch Holz übrig" : "<br>Scharfkantig: die Ecken berühren gerade den Stamm")}</div>`;
}
/* --- Kantholz „Aus Holzliste“: aus einem Stamm schneidet man ein Maß. Je Querschnitt der offenen Balken:
   wie viele passen nebeneinander in den Zopf (zFitInD, Schnittklasse, 3 mm Fuge) und welche Längen gehen hintereinander
   aus der Stammlänge (größte zuerst, 5 mm Kappzugabe). Ergebnis = Auswahl aller passenden Maße, beste Ausbeute zuerst. */
/* Holz, das in einem Balken-Querschnitt wirklich steckt (Rechteck ∩ Stammkreis) in cm² – mit Baumkante weniger als b·h.
   Mittelpunkt-Regel über 400 Streifen: Fehler weit unter 0,1 %. */
function zHolzFlaeche(r, cx, cy, R){
  const x1 = Math.max(r.x - cx, -R), x2 = Math.min(r.x + r.w - cx, R);
  if(!(x2 > x1)) return 0;
  const y1 = r.y - cy, y2 = r.y + r.h - cy, N = 400, dx = (x2 - x1) / N;
  let a = 0;
  for(let i = 0; i < N; i++){
    const x = x1 + (i + 0.5) * dx, s = Math.sqrt(Math.max(0, R * R - x * x));
    a += Math.max(0, Math.min(y2, s) - Math.max(y1, -s));
  }
  return a * dx;
}
const Z_LAENGE_FUGE = 0.005;          // m Säge-/Kappzugabe zwischen zwei Stücken auf einer Stange
function zGleichOptionen(D, Ls, kl, offen){
  const gruppen = {};
  for(const p of offen){
    if(!(p.b > 0 && p.h > 0 && p.l > 0)) continue;
    const w = Math.min(p.b, p.h), h = Math.max(p.b, p.h), key = w + "x" + h;
    (gruppen[key] ||= {key, w, h, pos: []}).pos.push(p);
  }
  const optionen = [], passtNicht = [], zuLang = [];
  const m3Stamm = Math.PI * (D/2) * (D/2) / 10000 * Ls;
  for(const g of Object.values(gruppen)){
    const fit = zFitInD(D, g.w, g.h, kl);
    if(!fit.count){ passtNicht.push(g); continue; }
    /* Stücke in Stangen der Stammlänge packen */
    const stuecke = [];
    for(const p of g.pos){ if(p.l > Ls + 1e-9) continue; for(let i = 0; i < Math.min(p.rest, 500); i++) stuecke.push({p, l: p.l}); }
    if(!stuecke.length){ zuLang.push(g); continue; }
    stuecke.sort((a, b) => b.l - a.l);
    const stangen = [];
    for(const st of stuecke){
      const s2 = stangen.find(x => x.len + Z_LAENGE_FUGE + st.l <= Ls + 1e-9);
      if(s2){ s2.len += Z_LAENGE_FUGE + st.l; s2.teile.push(st); } else stangen.push({len: st.l, teile: [st]});
    }
    stangen.sort((a, b) => b.len - a.len);
    const nutz = stangen.slice(0, fit.count);
    /* nur so viele Plätze zeichnen wie gebraucht – die innersten; die längste Stange auf den innersten Platz */
    const far = r => Math.max(...zCorners([r]).map(q => Math.hypot(q.x - fit.cx, q.y - fit.cy)));
    const rects = fit.rects.slice().sort((a, b) => far(a) - far(b)).slice(0, nutz.length);
    const m3 = nutz.reduce((a, s2) => a + s2.teile.reduce((b, t) => b + g.w * g.h / 10000 * t.l, 0), 0);
    /* Ausbeute aus dem Holz, das wirklich im Stamm steckt: fehlende Baumkante zählt nicht mit
       (sonst käme bei Klasse C mehr als 100 % heraus, weil die Balken über den Stamm hinausragen dürfen) */
    const holz = nutz.reduce((a, s2, i) => a + zHolzFlaeche(rects[i], fit.cx, fit.cy, D / 2) / 10000 * s2.teile.reduce((b, t) => b + t.l, 0), 0);
    optionen.push({key: g.key, w: g.w, h: g.h, plaetze: fit.count, label: fit.label, nutz, rects, cx: fit.cx, cy: fit.cy,
                   m3, holz, ausbeute: m3Stamm > 0 ? Math.min(1, holz / m3Stamm) : 0, stk: nutz.reduce((a, s2) => a + s2.teile.length, 0),
                   offenStk: stuecke.length});
  }
  optionen.sort((a, b) => b.ausbeute - a.ausbeute || b.stk - a.stk);
  return {optionen, passtNicht, zuLang};
}
