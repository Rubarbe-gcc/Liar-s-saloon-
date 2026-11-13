// ORBITE NOIRE — rendu 3D (Three.js). THREE est passé en paramètre : global r128 (aperçu) ou module r170 (jeu).
// Le rendu ne fait que LIRE l'état du moteur (aucune règle de jeu ici).
export function creerRendu(THREE, hote, { W, H, UN, BA }) {
  const REV = parseInt(THREE.REVISION, 10) || 128, LK = REV >= 155 ? Math.PI : 1, V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lisse = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const TC = [0x4cc9f0, 0xf25c54, 0xd6a84a];
  const VIEUX = REV < 152, lin = c => (VIEUX ? new THREE.Color(c).convertSRGBToLinear() : c); // r128 : pas de gestion automatique des couleurs

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace; else renderer.outputEncoding = THREE.sRGBEncoding;
  hote.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x03040a); scene.fog = new THREE.Fog(0x05060f, 60, 150);
  const cam = new THREE.PerspectiveCamera(38, 1, 1, 400);
  const cible = new V3(8, 0.5, 8); let dist = 25, yaw = 0, orb = false, shake = 0; const PITCH = 1.0;

  // ---------- outils ----------
  const canvasTex = (w, h, draw, rep) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t;
  };
  const glowTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const GC = {}, G = (k, f) => GC[k] || (GC[k] = f());
  function rbox(w, h, d) { // boîte « coussin » : coins arrondis (silhouettes moins jouet, reflets sur les arêtes)
    const r = Math.min(.09, Math.min(w, h, d) * .32), g = new THREE.BoxGeometry(w, h, d, 6, 6, 6), p = g.attributes.position, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new V3(), c = new V3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz)); const d2 = v.clone().sub(c); if (d2.lengthSq() > 1e-9) { d2.normalize().multiplyScalar(r); v.copy(c).add(d2); p.setXYZ(i, v.x, v.y, v.z); } }
    g.computeVertexNormals(); return g;
  }
  const box = (w, h, d) => G(`b${w},${h},${d}`, () => rbox(w, h, d));
  const cyl = (rt, rb, h, s = 12, ts = 0, tl = Math.PI * 2) => G(`c${rt},${rb},${h},${s},${ts},${tl}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, false, ts, tl));
  const sph = (r, w = 14, h = 10) => G(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
  const cone = (r, h, s = 8) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
  const oct = r => G(`o${r}`, () => new THREE.OctahedronGeometry(r));
  const tor = (r, t, seg = 28) => G(`t${r},${t},${seg}`, () => new THREE.TorusGeometry(r, t, 8, seg));
  const dod = r => G(`d${r}`, () => new THREE.DodecahedronGeometry(r));
  const MC = {}, MT = (c, o = {}) => { const k = c + JSON.stringify(o); if (MC[k]) return MC[k]; const pr = Object.assign({ color: c, roughness: .55, metalness: .35 }, o); pr.color = lin(pr.color); if (pr.emissive !== undefined) pr.emissive = lin(pr.emissive); return (MC[k] = new THREE.MeshStandardMaterial(pr)); };
  const glow = (c, ei = 1) => MT(c, { emissive: c, emissiveIntensity: ei, roughness: .4, metalness: 0 });
  const verre = (c, op = .35) => MT(c, { transparent: true, opacity: op, roughness: .1, metalness: .2, emissive: c, emissiveIntensity: .25, depthWrite: false });
  function add(p, geo, mat, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.s) m.scale.set(...o.s); if (o.r) m.rotation.set(...o.r);
    m.castShadow = !o.ns; p.add(m); return m;
  }
  const sprite = (c, taille, op = 1, add_ = true) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lin(c), transparent: true, opacity: op, depthWrite: false, blending: add_ ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.scale.set(taille, taille, 1); return s;
  };

  // ---------- relief : plateau rocheux en orbite (falaises vers le vide, plateaux des bases, sols de faction) ----------
  let bases = [], plats = [], carte = 0, crateres = [], R0 = 0, carteMini = null;
  const CTR = 23.5;
  function bordure(x, z) { // distance au bord du plateau, contour irrégulier (négatif : le vide)
    const b = Math.min(x + 2.2, z + 2.2, 49.7 - x, 49.7 - z);
    return b + .8 * Math.sin(x * .41 + z * .13 + R0) + .55 * Math.sin(z * .57 - x * .21 + 2 * R0) + .3 * Math.sin((x + z) * 1.3 + R0);
  }
  function plateau(x, z) { // 0..1 : hauteur du plateau des bases, rampe tournée vers le centre
    let pl = 0;
    for (const b of bases) {
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz); if (d > 13) continue;
      const a = Math.atan2(dz, dx), ac = Math.atan2(CTR - b.z, CTR - b.x); let da = Math.abs(a - ac); if (da > Math.PI) da = 2 * Math.PI - da;
      const rampe = lisse(1 - da / .5), R = 9.6 + .55 * Math.sin(a * 3 + b.x) + .3 * Math.sin(a * 7 + b.z), w = .75 + 3.6 * rampe;
      pl = Math.max(pl, lisse((R - d) / w + .5));
    }
    return pl;
  }
  function haut(x, z) {
    const bd = bordure(x, z);
    const n = .26 * Math.sin(x * .33 + 1.7) * Math.cos(z * .29 + .4) + .14 * Math.sin(x * .8 + z * .65) + .06 * Math.cos(x * 1.7 - z * 1.3);
    let fl = 0; for (const f of plats) fl = Math.max(fl, lisse((3 - Math.hypot(x - f.x, z - f.z)) / 1.5));
    let h = plateau(x, z) * 1.45 + n * (1 - fl);
    for (const c of crateres) { const d = Math.hypot(x - c.x, z - c.z) / c.r; if (d < 1.6) h += (d < 1 ? -(1 - d * d) * .32 * c.r : 0) + .1 * c.r * Math.exp(-(((d - 1) / .2) ** 2)); }
    if (bd < 1) { const k = clamp((1 - bd) / 1.6, 0, 1); h -= 13 * k * k * (3 - 2 * k) + (k > .2 ? .6 * Math.sin(x * 2.1 + z * 1.7) * k : 0); }
    return h;
  }
  // textures du sol (canvas, en nuances : la couleur vient des sommets)
  const alea = g => { let r = g; return () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296; };
  const bruitCanvas = (c, w, h, rnd, n, a, b, taille) => { for (let k = 0; k < n; k++) { const v = a + rnd() * (b - a) | 0, s = taille * (.4 + rnd()); c.fillStyle = `rgba(${v},${v},${v},${.25 + rnd() * .5})`; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, s, s * (.5 + rnd() * .5), rnd() * 3, 0, 7); c.fill(); } };
  const texSol = canvasTex(512, 512, (c, w, h) => { // régolithe : grains, cailloux, fissures
    const rnd = alea(17); c.fillStyle = '#b4b4b4'; c.fillRect(0, 0, w, h);
    bruitCanvas(c, w, h, rnd, 260, 120, 210, 26); bruitCanvas(c, w, h, rnd, 2200, 110, 225, 3);
    for (let k = 0; k < 140; k++) { const x = rnd() * w, y = rnd() * h, s = 2 + rnd() * 5; c.fillStyle = 'rgba(40,36,32,.55)'; c.beginPath(); c.ellipse(x + 1.5, y + 1.5, s, s * .7, 0, 0, 7); c.fill(); c.fillStyle = `rgb(${190 + rnd() * 50 | 0},${185 + rnd() * 45 | 0},${175 + rnd() * 40 | 0})`; c.beginPath(); c.ellipse(x, y, s, s * .7, rnd() * 3, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(50,44,40,.45)'; for (let k = 0; k < 26; k++) { let x = rnd() * w, y = rnd() * h; c.lineWidth = .8 + rnd() * 1.4; c.beginPath(); c.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (rnd() - .5) * 40; y += (rnd() - .5) * 40; c.lineTo(x, y); } c.stroke(); }
    const d = c.getImageData(0, 0, w, h), p = d.data; for (let i = 0; i < p.length; i += 4) { const e = (rnd() - .5) * 26; p[i] += e; p[i + 1] += e; p[i + 2] += e; } c.putImageData(d, 0, 0);
  });
  texSol.wrapS = texSol.wrapT = THREE.RepeatWrapping;
  const texRoc = canvasTex(256, 256, (c, w, h) => { // falaises : strates et fissures verticales
    const rnd = alea(29); for (let y = 0; y < h; y += 1) { const v = 120 + 50 * Math.sin(y * .11) + 30 * Math.sin(y * .37 + 1) + 18 * Math.sin(y * 1.3) | 0; c.fillStyle = `rgb(${v},${v - 4},${v - 10})`; c.fillRect(0, y, w, 1); }
    bruitCanvas(c, w, h, rnd, 500, 60, 200, 6);
    for (let k = 0; k < 40; k++) { let x = rnd() * w, y = rnd() * h; c.strokeStyle = `rgba(20,18,16,${.4 + rnd() * .4})`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); c.moveTo(x, y); for (let i = 0; i < 5; i++) { x += (rnd() - .5) * 10; y += 8 + rnd() * 14; c.lineTo(x, y); } c.stroke(); }
  });
  texRoc.wrapS = texRoc.wrapT = THREE.RepeatWrapping;
  const texDal = canvasTex(256, 256, (c, w, h) => { // dalles métalliques (Ligue de Fer)
    const rnd = alea(5); c.fillStyle = '#4a5160'; c.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = 150 + rnd() * 40 | 0, g = c.createLinearGradient(i * 64, j * 64, i * 64 + 64, j * 64 + 64); g.addColorStop(0, `rgb(${v + 20},${v + 24},${v + 32})`); g.addColorStop(1, `rgb(${v - 20},${v - 16},${v - 8})`); c.fillStyle = g; c.fillRect(i * 64 + 1, j * 64 + 1, 62, 62);
      c.fillStyle = '#6b7385'; for (const [a, b] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { c.beginPath(); c.arc(i * 64 + a, j * 64 + b, 2.2, 0, 7); c.fill(); }
      if (rnd() < .2) { c.save(); c.beginPath(); c.rect(i * 64 + 6, j * 64 + 26, 52, 12); c.clip(); for (let s = -64; s < 64; s += 10) { c.fillStyle = '#d8a83a'; c.beginPath(); c.moveTo(i * 64 + s, j * 64 + 38); c.lineTo(i * 64 + s + 5, j * 64 + 38); c.lineTo(i * 64 + s + 17, j * 64 + 26); c.lineTo(i * 64 + s + 12, j * 64 + 26); c.fill(); } c.restore(); }
      else if (rnd() < .25) { c.fillStyle = '#2b303b'; for (let s = 0; s < 5; s++) c.fillRect(i * 64 + 14, j * 64 + 14 + s * 8, 36, 4); } }
    bruitCanvas(c, w, h, rnd, 300, 70, 140, 4);
  });
  texDal.wrapS = texDal.wrapT = THREE.RepeatWrapping;
  const texMou = canvasTex(256, 256, (c, w, h) => { // prairie vivante (Bosquet)
    const rnd = alea(41); c.fillStyle = '#4f7a3c'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { const v = rnd(); c.fillStyle = v < .5 ? `rgba(${40 + rnd() * 30 | 0},${90 + rnd() * 60 | 0},${30 + rnd() * 30 | 0},.7)` : `rgba(${110 + rnd() * 40 | 0},${150 + rnd() * 50 | 0},${60 + rnd() * 30 | 0},.5)`; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, 2 + rnd() * 6, 1 + rnd() * 3, rnd() * 3, 0, 7); c.fill(); }
    for (let k = 0; k < 60; k++) { c.fillStyle = 'rgba(200,255,140,.85)'; c.beginPath(); c.arc(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 0, 7); c.fill(); }
  });
  texMou.wrapS = texMou.wrapT = THREE.RepeatWrapping;
  const texGly = canvasTex(256, 256, (c, w, h) => { // pierre gravée (Échos)
    const rnd = alea(53); c.fillStyle = '#3a3550'; c.fillRect(0, 0, w, h); bruitCanvas(c, w, h, rnd, 400, 50, 110, 8);
    c.strokeStyle = '#1c1830'; c.lineWidth = 3; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 64 + (j % 2) * 32, y = j * 64; c.beginPath(); for (let a = 0; a < 7; a++) { const t = a / 6 * Math.PI * 2 + Math.PI / 6; c.lineTo(x + 32 + Math.cos(t) * 34, y + 32 + Math.sin(t) * 34); } c.stroke(); }
  });
  texGly.wrapS = texGly.wrapT = THREE.RepeatWrapping;
  const texEm = canvasTex(256, 256, (c, w, h) => { // lueurs : R = joints des dalles, G = gravures des Échos
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'lighter'; const rnd = alea(11);
    c.strokeStyle = 'rgb(255,0,0)'; c.lineWidth = 1.5; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { if (rnd() < .5) { c.beginPath(); c.moveTo(i * 64 + 1.5, j * 64); c.lineTo(i * 64 + 1.5, j * 64 + 64); c.stroke(); } if (rnd() < .4) { c.fillStyle = 'rgb(255,0,0)'; c.fillRect(i * 64 + 28, j * 64 + 2, 8, 2); } }
    c.strokeStyle = 'rgb(0,255,0)'; c.lineWidth = 1.2; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 64 + (j % 2) * 32, y = j * 64; if (rnd() < .6) { c.beginPath(); c.arc(x + 32, y + 32, 9 + rnd() * 8, 0, 7); c.stroke(); } if (rnd() < .5) { c.beginPath(); c.moveTo(x + 32, y + 10); c.lineTo(x + 32, y + 54); c.stroke(); } }
  });
  texEm.wrapS = texEm.wrapT = THREE.RepeatWrapping;
  const FW = W * 2, FH = H * 2, fa = new Float32Array(FW * FH), fb = new Float32Array(FW * FH);
  let terrain = null, decor = new THREE.Group(), cartesObjs = new THREE.Group(), fogTex = null, fogData = null, fogMesh = null;
  scene.add(decor); scene.add(cartesObjs);
  const matSol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: .04 });
  matSol.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tSol: { value: texSol }, tRoc: { value: texRoc }, tDal: { value: texDal }, tMou: { value: texMou }, tGly: { value: texGly }, tEm: { value: texEm } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aMix; attribute vec3 aEm; varying vec4 vMix; varying vec3 vEm; varying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMix = aMix; vEm = aEm; vWp = (modelMatrix * vec4(position, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tSol, tRoc, tDal, tMou, tGly, tEm; varying vec4 vMix; varying vec3 vEm; varying vec3 vWp;')
      .replace('#include <map_fragment>', `vec2 q_ = vWp.xz;
        vec3 cS = texture2D(tSol, q_ * .21).rgb * (.8 + .4 * texture2D(tSol, q_ * .027 + .37).g);
        vec3 cR = texture2D(tRoc, vec2((vWp.x - vWp.z) * .16, vWp.y * .2)).rgb * (.85 + .3 * texture2D(tSol, q_ * .09).r);
        vec3 cc = mix(cS, cR, vMix.x); cc = mix(cc, texture2D(tDal, q_ * .25).rgb, vMix.y); cc = mix(cc, texture2D(tMou, q_ * .2).rgb, vMix.z); cc = mix(cc, texture2D(tGly, q_ * .16).rgb, vMix.w);
        diffuseColor.rgb *= cc;
        vec3 emis_ = vEm * (texture2D(tEm, q_ * .25).r * vMix.y + texture2D(tEm, q_ * .16).g * vMix.w);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += emis_;');
  };
  const ROCHE = [
    G('r0', () => roche(1, 3)), G('r1', () => roche(2, 7)), G('r2', () => roche(3, 13)),
  ];
  function roche(det, gr) { // rocher anguleux : icosaèdre déformé de façon reproductible
    const g = new THREE.IcosahedronGeometry(1, det > 2 ? 1 : 1), p = g.attributes.position, v = new V3(), rnd = alea(gr), cache = new Map();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`; if (!cache.has(k)) cache.set(k, .72 + rnd() * .5); v.multiplyScalar(cache.get(k)); v.y *= .7; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  }
  const matRoche = MT(0x6a6259, { roughness: .95, metalness: 0, flatShading: true }), matRoche2 = MT(0x47433f, { roughness: .95, metalness: 0, flatShading: true });
  const libre = (x, z, rb = 9.8, rm = 3.2) => !(plats.some(f => Math.hypot(x - f.x, z - f.z) < rm) || bases.some(b => Math.hypot(x - b.x, z - b.z) < rb));
  function semer(geo, mat, liste, ombre = true) { // InstancedMesh : beaucoup d'objets, un seul appel de dessin
    if (!liste.length) return; const im = new THREE.InstancedMesh(geo, mat, liste.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    liste.forEach(([x, y, z, s, sy, ry, rx = 0], i) => { e.set(rx, ry, rx * .6); q.setFromEuler(e); m4.compose(new V3(x, y, z), q, new V3(s, s * sy, s)); im.setMatrixAt(i, m4); });
    im.castShadow = ombre; im.receiveShadow = true; decor.add(im); return im;
  }

  function bati(s) {
    for (const o of [terrain, fogMesh]) if (o) scene.remove(o);
    decor.clear ? decor.clear() : decor.children.slice().forEach(c => decor.remove(c));
    cartesObjs.clear ? cartesObjs.clear() : cartesObjs.children.slice().forEach(c => cartesObjs.remove(c));
    carte = s.carte | 0; R0 = carte * 1.7;
    const qgs = s.ent.filter(e => BA[e.k] && BA[e.k].qg);
    bases = qgs.map(e => ({ x: e.x / 1000, z: e.y / 1000, f: s.fac[e.eq], eq: e.eq }));
    plats = [...s.mines.map(m => ({ x: m.x / 1000, z: m.y / 1000 })), ...s.relais.map(r => ({ x: r.x / 1000, z: r.y / 1000 }))];
    const rnd = alea((carte + 1) * 7919);
    crateres = []; for (let i = 0; i < 40 && crateres.length < 9; i++) { const x = 4 + rnd() * 40, z = 4 + rnd() * 40, r = 1.2 + rnd() * 2.2; if (libre(x, z, 12, 4 + r) && crateres.every(c => Math.hypot(x - c.x, z - c.z) > c.r + r + 2)) crateres.push({ x, z, r }); }
    const N = 208, geo = new THREE.PlaneGeometry(68, 68, N, N); geo.rotateX(-Math.PI / 2); geo.translate(CTR, 0, CTR);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), mix = new Float32Array(p.count * 4), em = new Float32Array(p.count * 3);
    const tc = new THREE.Color(), A = new THREE.Color(0xa08f78), Bc = new THREE.Color(0x58524c), Pc = new THREE.Color(0xa8977c), Rc = new THREE.Color(0x8c8a90);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = haut(x, z); p.setY(i, y);
      const sl = Math.hypot(haut(x + .3, z) - haut(x - .3, z), haut(x, z + .3) - haut(x, z - .3)) / .6;
      const cav = (haut(x + 1, z) + haut(x - 1, z) + haut(x, z + 1) + haut(x, z - 1)) / 4 - y;
      const bd = bordure(x, z), pl = plateau(x, z);
      const n1 = clamp(.5 + .45 * Math.sin(x * .19 + z * .07 + R0) * Math.cos(z * .23 - x * .05) + .3 * Math.sin(x * .07 - z * .11 + 1) + .15 * Math.sin(x * .5 + z * .41), 0, 1), n2 = .5 + .5 * Math.sin(x * .9 + 2) * Math.sin(z * .8);
      let roc = clamp((sl - .55) * 2.2, 0, 1); if (bd < .9) roc = Math.max(roc, clamp((.9 - bd) * 2, 0, 1));
      // sols de faction autour des bases de départ
      let dal = 0, mou = 0, gly = 0, er = 0, eg = 0, eb = 0;
      for (const b of bases) {
        const dx = Math.abs(x - b.x), dz = Math.abs(z - b.z), d = Math.hypot(dx, dz), c = new THREE.Color(TC[b.eq]);
        if (b.f === 'fer') { const k = lisse((5.6 - Math.max(dx, dz)) / .25); if (k > dal) { dal = k; er = c.r * k * .9; eg = c.g * k * .9; eb = c.b * k * .9; } }
        else if (b.f === 'bosquet') mou = Math.max(mou, lisse((6.2 + .9 * Math.sin(Math.atan2(z - b.z, x - b.x) * 5 + n2 * 3) - d) / 1.2));
        else { const k = lisse((5.2 - d) / .2); if (k > gly) { gly = k; er = c.r * k * .8; eg = c.g * k * .8; eb = c.b * k * .8; } }
      }
      roc *= 1 - Math.max(dal, gly);
      mix[i * 4] = roc; mix[i * 4 + 1] = dal; mix[i * 4 + 2] = mou * (1 - roc); mix[i * 4 + 3] = gly; em[i * 3] = er; em[i * 3 + 1] = eg; em[i * 3 + 2] = eb;
      tc.copy(A).lerp(Bc, clamp(n1 * 1.2 - .1, 0, 1)).lerp(Pc, pl * .45).lerp(Rc, roc);
      let k = 1 - clamp(cav * .5, 0, .45); k *= clamp(1 + y / 9, .12, 1); k *= .92 + .16 * n2;
      if (dal || gly || mou) k = k * (1 - Math.max(dal, gly, mou)) + Math.max(dal, gly, mou);
      col[i * 3] = tc.r * k; col[i * 3 + 1] = tc.g * k; col[i * 3 + 2] = tc.b * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aMix', new THREE.BufferAttribute(mix, 4)); geo.setAttribute('aEm', new THREE.BufferAttribute(em, 3)); geo.computeVertexNormals();
    terrain = new THREE.Mesh(geo, matSol); terrain.receiveShadow = true; scene.add(terrain);
    // fond de la mini-carte (une case = un pixel)
    carteMini = document.createElement('canvas'); carteMini.width = W; carteMini.height = H; { const c = carteMini.getContext('2d'), im = c.createImageData(W, H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = i + .5, z = j + .5, y = haut(x, z), o = (j * W + i) * 4, pl = plateau(x, z); let r = 92 + y * 22, g = 84 + y * 20, b = 74 + y * 18;
        for (const ba of bases) if (Math.hypot(x - ba.x, z - ba.z) < 5.5) { if (ba.f === 'bosquet') { r = 70; g = 110; b = 55; } else if (ba.f === 'fer') { r = 100; g = 108; b = 122; } else { r = 80; g = 72; b = 110; } }
        if (pl > .1 && pl < .9) { r *= .7; g *= .7; b *= .7; } im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = 255; }
      c.putImageData(im, 0, 0); }
    // brouillard de guerre : plan translucide dont l'opacité vient de la grille de visibilité
    fogData = new Uint8Array(FW * FH * 4); fogTex = new THREE.DataTexture(fogData, FW, FH, THREE.RGBAFormat);
    fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter; fogTex.needsUpdate = true;
    const fg = new THREE.PlaneGeometry(W, H); fg.rotateX(-Math.PI / 2);
    fogMesh = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, fog: false }));
    fogMesh.position.set(CTR, 3.4, CTR); fogMesh.renderOrder = 10; scene.add(fogMesh);
    // décor : rochers sur les crêtes et les bords, cailloux, éclats de cristal, plantes lumineuses, épaves (purement visuel)
    const gros = [[], [], []], cailloux = [], eclats = [], tiges = [], bulbes = [];
    const pose = (x, z) => haut(x, z);
    for (let i = 0; i < 900; i++) { // crêtes : là où ça monte fort
      const x = -1 + rnd() * 50, z = -1 + rnd() * 50, bd = bordure(x, z), pl = plateau(x, z);
      const crete = (bd > .6 && bd < 2.4) || (pl > .15 && pl < .85); if (!crete || !libre(x, z, 0, 3.4)) continue;
      if (bases.some(b => Math.hypot(x - b.x, z - b.z) < 7.6)) continue;
      const s_ = .22 + rnd() * .5; gros[i % 3].push([x, pose(x, z) + s_ * .15, z, s_, .8 + rnd() * .6, rnd() * 6.3, (rnd() - .5) * .5]);
    }
    for (let i = 0; i < 260; i++) { // rochers isolés en plaine
      const x = 1 + rnd() * 46, z = 1 + rnd() * 46; if (!libre(x, z, 10, 3.6) || bordure(x, z) < 1.5) continue;
      const s_ = rnd() < .85 ? .16 + rnd() * .3 : .45 + rnd() * .5; gros[i % 3].push([x, pose(x, z) + s_ * .1, z, s_, .7 + rnd() * .5, rnd() * 6.3, (rnd() - .5) * .4]);
    }
    for (let i = 0; i < 1400; i++) { const x = rnd() * 48, z = rnd() * 48; if (!libre(x, z, 6.5, 2.4) || bordure(x, z) < 1) continue; const s_ = .05 + rnd() * .1; cailloux.push([x, pose(x, z) + .02, z, s_, .6, rnd() * 6.3, rnd()]); }
    for (let c = 0; c < 16; c++) { const cx = 2 + rnd() * 44, cz = 2 + rnd() * 44; if (!libre(cx, cz, 10.5, 4) || bordure(cx, cz) < 2) continue;
      const n = 3 + rnd() * 6 | 0; for (let k = 0; k < n; k++) { const x = cx + (rnd() - .5) * 1.6, z = cz + (rnd() - .5) * 1.6, s_ = .12 + rnd() * .16; eclats.push([x, pose(x, z) - .05, z, s_, 1.6 + rnd() * 2.2, rnd() * 6.3, (rnd() - .5) * .9]); } }
    for (let c = 0; c < 14; c++) { const cx = 2 + rnd() * 44, cz = 2 + rnd() * 44; if (!libre(cx, cz, 10, 3.8) || bordure(cx, cz) < 2) continue;
      const n = 4 + rnd() * 7 | 0; for (let k = 0; k < n; k++) { const x = cx + (rnd() - .5) * 2.4, z = cz + (rnd() - .5) * 2.4, hh = .3 + rnd() * .6, y0 = pose(x, z), ry = rnd() * 6.3, rx = (rnd() - .5) * .35; tiges.push([x, y0 + hh / 2, z, .035, hh / .035, ry, rx]); bulbes.push([x + Math.sin(rx) * 0, y0 + hh, z, .07 + rnd() * .07, 1.3, ry, 0]); } }
    gros.forEach((l, i) => semer(ROCHE[i], i === 1 ? matRoche2 : matRoche, l));
    semer(ROCHE[0], matRoche2, cailloux, false);
    semer(G('eclat', () => { const g = new THREE.CylinderGeometry(.5, .7, 1, 6); g.translate(0, .5, 0); const t = new THREE.ConeGeometry(.5, .5, 6); t.translate(0, 1.25, 0); return fusion([g, t]); }), MT(0x6fd6ff, { emissive: 0x2a8cff, emissiveIntensity: .9, roughness: .15, metalness: .1, flatShading: true }), eclats, false);
    semer(cyl(1, 1, 1, 5), MT(0x4a5a3a, { roughness: .9, metalness: 0 }), tiges, false);
    semer(sph(1, 10, 8), MT(0xc8ff9a, { emissive: 0x8cff5a, emissiveIntensity: 1.3, roughness: .4, metalness: 0 }), bulbes, false);
    for (let i = 0; i < 7; i++) { // épaves de vaisseaux tombés
      const x = 3 + rnd() * 42, z = 3 + rnd() * 42; if (!libre(x, z, 11, 4.5) || bordure(x, z) < 2.5) continue;
      const g = new THREE.Group(); g.position.set(x, pose(x, z) - .1, z); g.rotation.set((rnd() - .5) * .3, rnd() * 6.3, (rnd() - .5) * .4);
      const mc = MT(0x6e6a66, { roughness: .7, metalness: .6 }), mr = MT(0x7a4a32, { roughness: .9, metalness: .3 });
      add(g, box(1.6, .5, .9), mc, 0, .2, 0, { r: [0, 0, .25] }); add(g, box(.9, .25, .5), mr, -.9, .1, .3, { r: [.2, .4, -.3] }); add(g, cyl(.18, .26, 1.1, 8), mc, .7, .45, -.2, { r: [0, 0, 1.3] }); add(g, box(1.2, .08, .4), mr, .1, .5, .55, { r: [.5, .2, 0] });
      add(g, sph(.06), glow(0xff7a3a, 2), .95, .5, -.2, { ns: true }); decor.add(g);
    }
    // champs de Prismes : colonnes de cristal en arc, tournées dos à la base la plus proche
    const crist = G('crist', () => { const g = new THREE.CylinderGeometry(.17, .21, 1, 6); g.translate(0, .5, 0); const t = new THREE.ConeGeometry(.17, .32, 6); t.translate(0, 1.16, 0); return fusion([g, t]); });
    const MCr = [MT(0x4fc3ff, { emissive: 0x1e78ff, emissiveIntensity: .75, roughness: .1, metalness: .15, flatShading: true }), MT(0x86e4ff, { emissive: 0x3aa8ff, emissiveIntensity: .9, roughness: .1, metalness: .1, flatShading: true }), MT(0x9a8cff, { emissive: 0x5a3cff, emissiveIntensity: .8, roughness: .12, metalness: .15, flatShading: true })];
    s.mines.forEach((m, i) => {
      const mx = m.x / 1000, mz = m.y / 1000, g = new THREE.Group(); g.position.set(mx, 0, mz);
      let bp = null, bdd = 1e9; for (const b of bases) { const d = Math.hypot(mx - b.x, mz - b.z); if (d < bdd) { bdd = d; bp = b; } }
      const ang = bp && bdd < 15 ? Math.atan2(mz - bp.z, mx - bp.x) : Math.atan2(mz - CTR, mx - CTR) + Math.PI, cr = [], r2 = alea(i * 31 + 7);
      for (let k = 0; k < 9; k++) {
        const a = ang + (k / 8 - .5) * 2.3, r = .75 + (k % 2) * .45 + r2() * .2, x = Math.cos(a) * r, z = Math.sin(a) * r, y0 = haut(mx + x, mz + z) - .08;
        const sg = new THREE.Group(); sg.position.set(x, y0, z); g.add(sg); cr.push(sg);
        P(sg, ROCHE[k % 3], matRoche2, 0, .05, 0, { s: [.42, .3, .42], r: [0, r2() * 6, 0] });
        const nb = 2 + (r2() * 2 | 0); for (let c = 0; c < nb; c++) { const h = .45 + r2() * .55 - (k % 2) * .12; P(sg, crist, MCr[(k + c) % 3], (r2() - .5) * .3, 0, (r2() - .5) * .3, { s: [.8 + r2() * .3, h, .8 + r2() * .3], r: [(r2() - .5) * .6, r2() * 6, (r2() - .5) * .6] }); }
      }
      const gl = sprite(0x4aa8ff, 3.6, .3); gl.position.set(Math.cos(ang) * .9, haut(mx, mz) + .6, Math.sin(ang) * .9); g.add(gl);
      compacter(g, 'mine' + carte + ':' + i); g.userData = { q0: m.q, mine: m, gl, cr, idx: i }; cartesObjs.add(g);
    });
    // Relais d'Énergie : pylône sur une bouche de chaleur
    s.relais.forEach(rl => {
      const x0 = rl.x / 1000, z0 = rl.y / 1000, g = new THREE.Group(); g.position.set(x0, haut(x0, z0), z0);
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283; P(g, ROCHE[k % 3], k % 2 ? matRoche : matRoche2, Math.cos(a) * 1.55, .05, Math.sin(a) * 1.55, { s: [.42, .5 + (k % 3) * .15, .42], r: [0, a * 2, 0] }); }
      add(g, cyl(1.25, 1.25, .04, 24), MT(0x2a1a10, { emissive: 0xff7a2a, emissiveIntensity: .5, roughness: .8 }), 0, -.02, 0, { ns: true });
      P(g, cyl(.9, 1.1, .25, 8), MT(0x4a4f5a, { roughness: .5, metalness: .7 }), 0, .12, 0); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .4; P(g, box(.18, 1.6, .18), MT(0x5c6270, { roughness: .45, metalness: .75 }), Math.cos(a) * .6, .85, Math.sin(a) * .6, { r: [Math.sin(a) * .18, 0, -Math.cos(a) * .18] }); }
      P(g, cyl(.12, .2, 2.4, 8), MT(0x8a93a3, { metalness: .8, roughness: .35 }), 0, 1.4, 0);
      const r1 = add(g, tor(.65, .05), glow(0xffffff, 1), 0, 1.3, 0, { r: [Math.PI / 2, 0, 0] }), r2 = add(g, tor(.45, .04), glow(0xffffff, 1), 0, 1.9, 0, { r: [Math.PI / 2, 0, 0] });
      const orb = add(g, sph(.22), glow(0xffffff, 1.4), 0, 2.75, 0), halo = sprite(0xffffff, 2.2, .7); halo.position.y = 2.75; g.add(halo);
      const vap = []; for (let k = 0; k < 5; k++) { const v = sprite(0xffb070, 1.1, .2); v.position.set(0, .3, 0); g.add(v); vap.push(v); }
      const disc = add(g, cyl(2.4, 2.4, .02, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), 0, .05, 0, { ns: true });
      compacter(g, 'relais'); g.userData = { rl, r1, r2, orb, halo, disc, vap }; cartesObjs.add(g);
    });
  }
  function fusion(geos) { // fusionne des géométries non indexées (évite d'importer BufferGeometryUtils)
    const gs = geos.map(g => g.index ? g.toNonIndexed() : g), n = gs.reduce((a, g) => a + g.attributes.position.count, 0), P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
    for (const g of gs) { P.set(g.attributes.position.array, o * 3); Nn.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
    const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); r.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return r;
  }

  // ---------- ciel ----------
  { const st = new Float32Array(1800 * 3); for (let i = 0; i < 1800; i++) { const u = Math.random() * 6.283, v = Math.acos(2 * Math.random() - 1), R = 170 + Math.random() * 30; st[i * 3] = R * Math.sin(v) * Math.cos(u); st[i * 3 + 1] = R * Math.cos(v) * .8; st[i * 3 + 2] = R * Math.sin(v) * Math.sin(u); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(st, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false })));
    for (const [x, y, z, c, s_] of [[-110, -25, -80, 0x5b3bd6, 190], [120, -15, -100, 0x1f6fd6, 170], [20, -40, 130, 0x9b2fd6, 200], [-120, -30, 90, 0x1a8f9b, 150]]) { const sp = sprite(c, s_, .35); sp.material.fog = false; sp.position.set(x, y, z); scene.add(sp); } }
  const rimTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, w * .34, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.72, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  function planete(x, y, z, r, col, rim) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshStandardMaterial({ color: lin(col), roughness: .95, metalness: 0, fog: false })); m.position.set(x, y, z); scene.add(m);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: rimTex, color: lin(rim), transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); h.scale.set(r * 2.7, r * 2.7, 1); h.position.set(x, y, z); scene.add(h);
  }
  planete(-75, -34, 30, 28, 0x141a36, 0x5b7bff); planete(100, -58, 75, 12, 0x2a1230, 0xff6ad0); planete(10, -50, -95, 20, 0x10222c, 0x3fe0c8);
  const NP = 380, pp = new Float32Array(NP * 3), pv = []; for (let i = 0; i < NP; i++) { pp[i * 3] = Math.random() * 56 - 4; pp[i * 3 + 1] = .3 + Math.random() * 7; pp[i * 3 + 2] = Math.random() * 56 - 4; pv.push([(Math.random() - .3) * .5, .05 + Math.random() * .25, (Math.random() - .5) * .4]); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  scene.add(new THREE.Points(dustG, new THREE.PointsMaterial({ map: glowTex, color: lin(0xa9c0ff), size: 3.2, sizeAttenuation: false, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  const feux = [];
  const roches = []; { const gm = MT(0x232838, { roughness: .95, flatShading: true }); for (let i = 0; i < 46; i++) { const a = Math.random() * 6.283, d = 36 + Math.random() * 45, sz = .5 + Math.random() * 2.6; const m = new THREE.Mesh(dod(1), gm); m.scale.set(sz, sz * (.6 + Math.random() * .6), sz * (.8 + Math.random() * .5)); m.position.set(24 + Math.cos(a) * d, -22 + Math.random() * 30, 24 + Math.sin(a) * d); m.userData = { w: (Math.random() - .5) * .4, b: Math.random() * 6, y0: m.position.y }; if (i % 5 === 0) { const c = new THREE.Mesh(cone(.18, 1.2, 5), glow(i % 10 ? 0x5ad1ff : 0xa46bff, 1.4)); c.position.set(0, .9, 0); c.scale.setScalar(1 / sz); m.add(c); } m.castShadow = false; scene.add(m); roches.push(m); } }
  scene.add(new THREE.HemisphereLight(0xb4c2e6, 0x3a2e24, .8 * LK));
  const sun = new THREE.DirectionalLight(0xffe2c0, 2.2 * LK); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 120 }); sun.shadow.bias = -.0006; scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x6a8cff, .35 * LK); rim.position.set(30, 20, -30); scene.add(rim);

  // ---------- modèles ----------
  const FER = [0x8e98aa, 0x505b6c], BK = 0x4b3a2a, GR = 0x3f8f4a, GL = 0x9dff7a, PU = 0x7a5cff, CY = 0xb8f1ff;
  const fen = (g, pts) => pts.forEach(([x, y, z]) => P(g, box(.17, .1, .03), glow(0xffe3a0, 1.6), x, y, z, { ns: true }));
  function pata(g, u, geo, mat, x, y0, z, h, ph, o = {}) { const pv_ = new THREE.Group(); pv_.position.set(x, y0 + h, z); g.add(pv_); add(pv_, geo, mat, 0, -h / 2, 0, o); (u.pattes = u.pattes || []).push([pv_, ph]); }
  const Ring = (g, r, eq) => P(g, tor(r, .045, 40), glow(TC[eq], 1.3), 0, .07, 0, { r: [Math.PI / 2, 0, 0], ns: true });
  // pièces fixes (P) : fusionnées par matériau à la création de l'unité (quelques appels de dessin par unité, même avec beaucoup de détails)
  const P = (p, geo, mat, x = 0, y = 0, z = 0, o = {}) => { const m = add(p, geo, mat, x, y, z, o); m.userData.st = 1; return m; };
  const jambe = (g, u, x, y, z, ph) => { const pv_ = new THREE.Group(); pv_.position.set(x, y, z); g.add(pv_); (u.pattes = u.pattes || []).push([pv_, ph]); return pv_; };
  const PEINT = eq => MT(TC[eq], { roughness: .42, metalness: .35 });
  const ACIER = MT(0xa9b1bc, { roughness: .4, metalness: .35 }), ACIER2 = MT(0x5f6876, { roughness: .45, metalness: .4 }), JOINT = MT(0x23272e, { roughness: .6, metalness: .5 }), CAOUT = MT(0x1a1c20, { roughness: .9, metalness: 0 });
  const BOIS = MT(0x5e4331, { roughness: .9, metalness: 0 }), BOIS2 = MT(0x3b2a1f, { roughness: .92, metalness: 0 }), MOUSSE = MT(0x4f8a3a, { roughness: .85, metalness: 0 }), MOUSSE2 = MT(0x2f6a2c, { roughness: .85, metalness: 0 }), CARAP = MT(0x6b5238, { roughness: .6, metalness: .1 }), OS = MT(0xd8d0b0, { roughness: .55, metalness: 0 }), SEVE = glow(0x9dff7a, 1.6);
  const CADRE = MT(0x2a2440, { roughness: .3, metalness: .85 }), OR = MT(0xc9a96a, { roughness: .28, metalness: .9 }), CRIS = MT(0xb79cff, { emissive: 0x6a3cff, emissiveIntensity: .6, roughness: .1, metalness: .1, flatShading: true });
  // un seul matériau pour toutes les pièces fixes : couleur, lueur, rugosité et métal sont portés par les sommets
  const MATU = new THREE.MeshStandardMaterial({ vertexColors: true });
  MATU.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aEmi; attribute vec2 aRM; varying vec3 vEmi; varying vec2 vRM;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmi = aEmi; vRM = aRM;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vEmi; varying vec2 vRM;').replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRM.x;').replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRM.y;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmi;');
  };
  const FUS = new Map();
  function compacter(o, cle) {
    o.children.filter(c => !c.isMesh && c.children && c.children.length).forEach((c, i) => compacter(c, cle + '/' + i));
    const st = o.children.filter(c => c.isMesh && c.userData.st && !c.material.transparent); if (st.length < 2) return;
    let L = FUS.get(cle);
    if (!L) {
      const parts = st.map(m => { m.updateMatrix(); const gg = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); gg.applyMatrix4(m.matrix); return [gg, m.material]; });
      const n = parts.reduce((a, [gg]) => a + gg.attributes.position.count, 0), Pp = new Float32Array(n * 3), Nn = new Float32Array(n * 3), Cc = new Float32Array(n * 3), Ee = new Float32Array(n * 3), RM = new Float32Array(n * 2); let k = 0;
      for (const [gg, mt] of parts) { const c = gg.attributes.position.count, e = mt.emissive ? mt.emissive.clone().multiplyScalar(mt.emissiveIntensity || 0) : null; Pp.set(gg.attributes.position.array, k * 3); Nn.set(gg.attributes.normal.array, k * 3);
        for (let i = k; i < k + c; i++) { Cc[i * 3] = mt.color.r; Cc[i * 3 + 1] = mt.color.g; Cc[i * 3 + 2] = mt.color.b; if (e) { Ee[i * 3] = e.r; Ee[i * 3 + 1] = e.g; Ee[i * 3 + 2] = e.b; } RM[i * 2] = mt.roughness ?? .5; RM[i * 2 + 1] = mt.metalness ?? 0; } k += c; }
      L = new THREE.BufferGeometry(); L.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); L.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); L.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); L.setAttribute('aEmi', new THREE.BufferAttribute(Ee, 3)); L.setAttribute('aRM', new THREE.BufferAttribute(RM, 2));
      L.computeBoundingSphere(); FUS.set(cle, L);
    }
    for (const m of st) o.remove(m);
    const m = new THREE.Mesh(L, MATU); m.castShadow = true; m.receiveShadow = true; o.add(m);
  }
  const B = {
    // --- Ligue de Fer : acier, caoutchouc, peinture à la couleur de l'équipe
    ouvrier(g, eq, u) {
      for (const x of [-1, 1]) { P(g, box(.15, .2, .6), CAOUT, x * .25, .12, 0); for (const z of [-.21, 0, .21]) P(g, cyl(.075, .075, .17, 10), ACIER2, x * .25, .11, z, { r: [0, 0, Math.PI / 2] }); P(g, box(.03, .06, .46), PEINT(eq), x * .335, .2, 0); }
      P(g, box(.4, .16, .52), ACIER2, 0, .28, 0); P(g, box(.34, .27, .3), ACIER, 0, .49, -.05); P(g, box(.27, .08, .04), glow(0x9fe8ff, 1.5), 0, .54, .11, { ns: true }); P(g, box(.36, .05, .32), PEINT(eq), 0, .64, -.05);
      P(g, cyl(.08, .08, .3, 10), ACIER2, 0, .45, -.28, { r: [0, 0, Math.PI / 2] }); P(g, box(.05, .05, .05), glow(0xffd28a, 1.6), .14, .45, -.36, { ns: true });
      P(g, cyl(.012, .012, .34, 4), JOINT, .12, .8, -.14); P(g, sph(.028, 6, 4), glow(0xff5a3a, 2), .12, .97, -.14, { ns: true });
      for (const x of [-1, 1]) { P(g, box(.07, .07, .3), ACIER2, x * .2, .42, .22, { r: [-.45, 0, 0] }); P(g, box(.06, .06, .2), JOINT, x * .2, .32, .4, { r: [.5, 0, 0] }); P(g, box(.11, .04, .07), ACIER, x * .2, .25, .48); }
      P(g, cone(.04, .14, 6), glow(0xffd28a, 1.4), .2, .25, .56, { r: [Math.PI / 2, 0, 0], ns: true });
      u.hb = .95;
    },
    fantassin(g, eq, u) {
      for (const x of [-1, 1]) { const j = jambe(g, u, x * .11, .5, 0, x); P(j, box(.13, .24, .15), ACIER2, 0, -.12, 0); P(j, box(.14, .07, .1), PEINT(eq), 0, -.21, .07); P(j, box(.11, .22, .13), JOINT, 0, -.35, 0); P(j, box(.15, .08, .23), ACIER2, 0, -.46, .03); }
      P(g, box(.3, .12, .2), JOINT, 0, .55, 0); P(g, box(.38, .3, .26), ACIER, 0, .78, 0); P(g, box(.26, .16, .06), ACIER2, 0, .8, .14); P(g, box(.1, .04, .02), glow(TC[eq], 1.3), 0, .86, .175, { ns: true });
      P(g, box(.3, .32, .14), ACIER2, 0, .78, -.19); P(g, cyl(.05, .05, .26, 8), JOINT, -.09, .8, -.28); P(g, cyl(.05, .05, .26, 8), JOINT, .09, .8, -.28); P(g, cyl(.012, .012, .24, 4), JOINT, .12, 1.02, -.22);
      for (const x of [-1, 1]) { P(g, sph(.12, 10, 8), PEINT(eq), x * .25, .92, 0, { s: [1, .75, 1.1] }); P(g, box(.1, .24, .11), ACIER2, x * .25, .72, .03); }
      P(g, box(.2, .2, .22), ACIER, 0, 1.05, .01); P(g, box(.17, .05, .03), glow(0x9fe8ff, 1.7), 0, 1.06, .125, { ns: true }); P(g, box(.23, .05, .25), PEINT(eq), 0, 1.16, 0);
      P(g, box(.07, .09, .52), JOINT, .2, .7, .28); P(g, box(.04, .13, .08), ACIER2, .2, .61, .22); P(g, cyl(.022, .022, .2, 6), ACIER2, .2, .72, .62, { r: [Math.PI / 2, 0, 0] }); P(g, box(.03, .03, .05), glow(TC[eq], 1.5), .2, .76, .4, { ns: true });
      u.hb = 1.4;
    },
    tireur(g, eq, u) {
      for (const x of [-1, 1]) { const j = jambe(g, u, x * .1, .52, 0, x); P(j, box(.11, .26, .13), ACIER2, 0, -.13, 0); P(j, box(.1, .24, .11), JOINT, 0, -.37, 0); P(j, box(.13, .07, .2), ACIER2, 0, -.48, .03); }
      P(g, box(.28, .1, .18), JOINT, 0, .56, 0); P(g, box(.32, .3, .22), ACIER2, 0, .78, 0); P(g, box(.22, .12, .05), ACIER, 0, .82, .12); P(g, box(.34, .5, .04), PEINT(eq), 0, .7, -.14, { r: [.12, 0, 0] });
      for (const x of [-1, 1]) { P(g, box(.13, .09, .16), ACIER, x * .21, .92, 0); P(g, box(.08, .24, .09), JOINT, x * .21, .74, .05); }
      P(g, sph(.11, 12, 10), ACIER, 0, 1.03, 0, { s: [1, 1.05, 1.1] }); P(g, sph(.04, 8, 6), glow(0xff6a4a, 2.2), .04, 1.04, .1, { ns: true }); P(g, cyl(.01, .01, .3, 4), JOINT, -.07, 1.2, -.04);
      P(g, box(.06, .07, 1.05), JOINT, .17, .78, .38); P(g, box(.05, .14, .1), ACIER2, .17, .68, .2); P(g, cyl(.035, .035, .2, 8), ACIER2, .17, .86, .3, { r: [Math.PI / 2, 0, 0] }); P(g, sph(.025, 6, 4), glow(0x9fe8ff, 2), .17, .86, .41, { ns: true }); P(g, box(.08, .08, .1), ACIER2, .17, .78, .92);
      u.hb = 1.4;
    },
    blinde(g, eq, u) {
      for (const x of [-1, 1]) { P(g, box(.3, .3, 1.55), CAOUT, x * .56, .18, 0); for (let i = 0; i < 5; i++) P(g, cyl(.11, .11, .32, 10), ACIER2, x * .56, .17, -.6 + i * .3, { r: [0, 0, Math.PI / 2] }); P(g, box(.36, .08, 1.62), ACIER2, x * .56, .37, 0); P(g, box(.04, .1, 1.1), PEINT(eq), x * .75, .37, 0); }
      P(g, box(.84, .3, 1.38), ACIER, 0, .42, -.02); P(g, box(.8, .16, .42), ACIER2, 0, .5, .7, { r: [-.5, 0, 0] }); P(g, box(.72, .16, .3), JOINT, 0, .56, -.66);
      for (const x of [-.24, .24]) { P(g, cyl(.05, .06, .32, 8), JOINT, x, .76, -.7); P(g, box(.1, .05, .03), glow(0xfff2c8, 2.2), x * 1.25, .5, .86, { ns: true }); }
      const t = new THREE.Group(); t.position.set(0, .6, -.05); g.add(t);
      P(t, cyl(.36, .42, .2, 8), ACIER, 0, .1, 0); P(t, box(.58, .2, .62), ACIER, 0, .26, -.02); P(t, box(.52, .05, .5), PEINT(eq), 0, .38, -.06); P(t, cyl(.11, .11, .08, 10), ACIER2, -.15, .4, -.16);
      for (const x of [-.09, .09]) { P(t, cyl(.045, .05, .95, 8), ACIER2, x, .26, .7, { r: [Math.PI / 2, 0, 0] }); P(t, cyl(.065, .065, .13, 8), JOINT, x, .26, 1.14, { r: [Math.PI / 2, 0, 0] }); }
      P(t, cyl(.012, .012, .62, 4), JOINT, .2, .64, -.26); P(t, box(.12, .06, .03), glow(TC[eq], 1.4), 0, .28, .3, { ns: true });
      u.tour = t; u.hb = 1.45;
    },
    marechal(g, eq, u) {
      for (const x of [-1, 1]) { const j = jambe(g, u, x * .4, 1.1, 0, x); P(j, box(.28, .5, .32), ACIER2, 0, -.25, .05, { r: [-.25, 0, 0] }); P(j, sph(.15, 10, 8), JOINT, 0, -.52, .14); P(j, box(.24, .52, .26), ACIER, 0, -.78, .06, { r: [.18, 0, 0] }); P(j, box(.18, .1, .22), PEINT(eq), 0, -.4, .22, { r: [-.25, 0, 0] }); P(j, box(.36, .1, .5), ACIER2, 0, -1.05, .1); }
      P(g, box(.7, .25, .45), JOINT, 0, 1.12, 0); P(g, box(1.0, .6, .8), ACIER, 0, 1.45, 0); P(g, box(.86, .2, .4), ACIER2, 0, 1.38, .38, { r: [-.4, 0, 0] }); P(g, box(.5, .1, .05), glow(0x9fe8ff, 1.8), 0, 1.55, .42, { ns: true }); P(g, box(.9, .06, .7), PEINT(eq), 0, 1.78, 0);
      P(g, box(.6, .5, .3), ACIER2, 0, 1.45, -.5); for (const x of [-.18, .18]) P(g, cyl(.08, .1, .5, 8), JOINT, x, 1.85, -.55); P(g, cyl(.015, .015, .7, 4), JOINT, -.35, 2.1, -.3);
      for (const x of [-1, 1]) { P(g, box(.3, .3, .5), PEINT(eq), x * .68, 1.62, 0); P(g, box(.24, .24, .95), JOINT, x * .8, 1.42, .35); for (const y of [-.06, .06]) P(g, cyl(.05, .05, .4, 8), ACIER2, x * .8, 1.42 + y, .95, { r: [Math.PI / 2, 0, 0] }); P(g, sph(.08, 8, 6), glow(TC[eq], 1.6), x * .8, 1.42, 1.15, { ns: true }); }
      g.scale.setScalar(1.15); u.hb = 2.6;
    },
    // --- Bosquet : écorce, mousse, os et sève lumineuse
    semeur(g, eq, u) {
      P(g, sph(.27, 14, 10), BOIS2, 0, .32, 0, { s: [1, .7, 1.25] }); for (let i = 0; i < 3; i++) P(g, sph(.24 - i * .03, 12, 8), MOUSSE, 0, .4 + i * .02, -.15 + i * .14, { s: [1.05, .45, .7] });
      P(g, sph(.13, 10, 8), BOIS, 0, .3, .32); for (const x of [-1, 1]) { P(g, cone(.025, .16, 5), OS, x * .06, .26, .45, { r: [1.4, x * .4, 0] }); P(g, sph(.028, 6, 4), SEVE, x * .07, .35, .41, { ns: true }); }
      for (const x of [-1, 1]) for (let i = 0; i < 3; i++) { const j = jambe(g, u, x * .22, .26, -.15 + i * .15, (i % 2 ? 1 : -1) * x); P(j, cyl(.025, .02, .28, 5), BOIS2, x * .08, -.12, 0, { r: [0, 0, x * .7] }); }
      P(g, sph(.11, 10, 8), glow(TC[eq], 1.1), 0, .58, -.08); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .4; P(g, cone(.06, .22, 4), MOUSSE2, Math.cos(a) * .1, .6, -.08 + Math.sin(a) * .1, { r: [Math.sin(a) * .9, 0, -Math.cos(a) * .9], s: [1, 1, .3] }); }
      u.hb = .95;
    },
    rejeton(g, eq, u) {
      P(g, sph(.27, 14, 10), BOIS, 0, .52, 0, { s: [1, .82, 1.7] }); P(g, sph(.2, 12, 8), MOUSSE, 0, .66, -.05, { s: [.9, .45, 1.4] });
      for (let i = 0; i < 5; i++) P(g, cone(.06, .3, 5), MOUSSE2, 0, .78, -.3 + i * .14, { r: [-.5, 0, 0] });
      for (const x of [-1, 1]) P(g, box(.02, .06, .4), glow(TC[eq], 1.2), x * .25, .52, 0, { ns: true });
      P(g, sph(.16, 12, 8), BOIS2, 0, .58, .48, { s: [1, .9, 1.2] }); P(g, box(.2, .06, .2), BOIS2, 0, .46, .58); for (const x of [-.06, 0, .06]) P(g, cone(.02, .08, 4), OS, x, .5, .66, { r: [Math.PI, 0, 0] });
      for (const x of [-1, 1]) { P(g, sph(.035, 6, 4), SEVE, x * .08, .63, .64, { ns: true }); P(g, cone(.03, .2, 5), OS, x * .1, .74, .44, { r: [-.6, 0, x * .5] }); }
      P(g, cone(.08, .5, 6), BOIS2, 0, .5, -.55, { r: [-1.9, 0, 0] });
      for (const [x, z] of [[-.17, .26], [.17, .26], [-.17, -.26], [.17, -.26]]) { const j = jambe(g, u, x, .42, z, x * z > 0 ? 1 : -1); P(j, cyl(.06, .045, .26, 6), BOIS, 0, -.13, 0); P(j, cyl(.04, .03, .18, 6), BOIS2, 0, -.32, .03); P(j, cone(.04, .08, 4), OS, 0, -.41, .07, { r: [Math.PI / 2, 0, 0] }); }
      u.hb = 1.1;
    },
    epine(g, eq, u) {
      for (let i = 0; i < 3; i++) { const a = i * 2.09; const j = jambe(g, u, Math.cos(a) * .12, .3, Math.sin(a) * .12, i % 2 ? 1 : -1); P(j, cone(.07, .4, 5), BOIS2, Math.cos(a) * .12, -.18, Math.sin(a) * .12, { r: [Math.PI + Math.sin(a) * .5, 0, -Math.cos(a) * .5] }); }
      P(g, cyl(.13, .22, .9, 7), BOIS, 0, .7, 0); P(g, cyl(.15, .13, .2, 7), MOUSSE, 0, .4, 0);
      for (let i = 0; i < 10; i++) { const a = i * .63, y = .55 + (i % 4) * .14; P(g, cone(.03, .3, 4), OS, Math.cos(a) * .17, y, Math.sin(a) * .17, { r: [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2] }); }
      P(g, sph(.17, 12, 10), SEVE, 0, 1.25, .04); for (let i = 0; i < 6; i++) { const a = i * 1.05; P(g, cone(.09, .3, 4), MOUSSE2, Math.cos(a) * .15, 1.18, .04 + Math.sin(a) * .15, { r: [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3], s: [1, 1, .35] }); }
      P(g, tor(.27, .025, 20), glow(TC[eq], 1.2), 0, .42, 0, { r: [Math.PI / 2, 0, 0], ns: true });
      u.hb = 1.75;
    },
    colosse(g, eq, u) {
      P(g, sph(.7, 18, 12), BOIS2, 0, .95, 0, { s: [1.05, .82, 1.35] });
      for (let i = 0; i < 5; i++) { P(g, sph(.5 - Math.abs(i - 2) * .06, 14, 8), i % 2 ? BOIS : CARAP, 0, 1.22 - Math.abs(i - 2) * .06, -.66 + i * .33, { s: [1.25, .42, .62], r: [.25, 0, 0] }); P(g, cone(.06, .32, 5), OS, 0, 1.5 - Math.abs(i - 2) * .07, -.66 + i * .33, { r: [-.35, 0, 0] }); }
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + .5; P(g, sph(.13, 8, 6), MOUSSE, Math.cos(a) * .62, 1.0 + (i % 2) * .1, Math.sin(a) * .75, { s: [1.2, .55, 1.2] }); }
      for (let i = 0; i < 4; i++) P(g, oct(.11), glow(TC[eq], 1.1), (i % 2 ? .38 : -.38), 1.3 + (i % 2) * .05, -.5 + i * .25, { s: [.7, 1.7, .7], r: [0, 0, (i % 2 ? -.3 : .3)] });
      P(g, sph(.34, 12, 10), BOIS, 0, 1.0, .92, { s: [1, .85, 1] }); P(g, box(.36, .1, .25), BOIS2, 0, .8, 1.08);
      for (const x of [-1, 1]) { P(g, cone(.09, .75, 6), OS, x * .26, .85, 1.25, { r: [1.15, 0, x * .3] }); P(g, sph(.07, 8, 6), SEVE, x * .14, 1.1, 1.2, { ns: true }); }
      for (const z of [.5, 0, -.5]) for (const x of [-1, 1]) { const j = jambe(g, u, x * .55, .75, z, (z === 0 ? -1 : 1) * x); P(j, cyl(.16, .12, .45, 7), BOIS, x * .05, -.22, 0, { r: [0, 0, x * .3] }); P(j, cyl(.11, .14, .35, 7), BOIS2, x * .12, -.55, 0); }
      g.scale.setScalar(1.1); u.hb = 2.15;
    },
    ancien(g, eq, u) {
      for (const x of [-1, 1]) { const j = jambe(g, u, x * .28, .7, 0, x); P(j, cyl(.18, .24, .7, 7), BOIS2, 0, -.35, 0); for (let i = 0; i < 3; i++) { const a = i * 1.2 - 1.2; P(j, cone(.07, .35, 5), BOIS2, Math.sin(a) * .2, -.65, Math.cos(a) * .2, { r: [Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3] }); } }
      P(g, cyl(.32, .48, 1.5, 8), BOIS, 0, 1.4, 0); P(g, box(.5, .08, .3), BOIS2, 0, 1.2, .3); for (const x of [-.12, .12]) P(g, sph(.06, 8, 6), SEVE, x, 1.65, .36, { ns: true });
      for (const x of [-1, 1]) { P(g, cyl(.08, .14, 1, 6), BOIS, x * .6, 1.75, .1, { r: [.3, 0, x * 1.0] }); P(g, sph(.3, 10, 8), MOUSSE, x * 1.0, 2.15, .2, { s: [1, .75, 1] }); P(g, sph(.07, 6, 4), SEVE, x * 1.05, 2.0, .45, { ns: true }); }
      P(g, sph(.85, 16, 12), MOUSSE, 0, 2.45, 0, { s: [1.15, .8, 1.1] }); P(g, sph(.55, 14, 10), MOUSSE2, .5, 2.75, -.25); P(g, sph(.5, 14, 10), MOUSSE2, -.55, 2.7, .2);
      for (let i = 0; i < 7; i++) { const a = i * .9; P(g, sph(.07, 6, 4), SEVE, Math.cos(a) * .85, 2.35 + (i % 3) * .2, Math.sin(a) * .75, { ns: true }); }
      const o = add(g, tor(.9, .04), glow(TC[eq], 1.4), 0, 1.0, 0, { r: [Math.PI / 2, 0, 0], ns: true }); u.an.push(t => { o.rotation.z = t * .8; });
      g.scale.setScalar(1.05); u.hb = 3.6;
    },
    // --- Échos : cristal, cadres d'or sombre, énergie ; ils flottent
    tisseur(g, eq, u) {
      P(g, oct(.17), CRIS, 0, .8, 0, { s: [1, 1.5, 1] }); P(g, tor(.2, .025, 18), OR, 0, .8, 0, { r: [Math.PI / 2, 0, 0] }); P(g, cyl(.05, .1, .12, 6), CADRE, 0, .58, 0);
      for (const x of [-1, 1]) { P(g, box(.05, .04, .26), OR, x * .2, .72, .08, { r: [0, x * .3, 0] }); P(g, cone(.04, .12, 6), CADRE, x * .24, .68, .22, { r: [Math.PI / 2, 0, 0] }); P(g, sph(.03, 6, 4), glow(CY, 2), x * .24, .68, .3, { ns: true }); P(g, box(.02, .14, .1), CADRE, x * .22, .86, -.12); }
      P(g, sph(.05, 8, 6), glow(TC[eq], 1.8), 0, .8, .14, { ns: true });
      const r = add(g, tor(.3, .018, 24), glow(TC[eq], 1.2), 0, .8, 0, { ns: true }); u.an.push(t => { r.rotation.set(t * 1.3, t * .7, 0); });
      u.flot = .09; u.hb = 1.3;
    },
    eclat(g, eq, u) {
      P(g, oct(.2), CRIS, 0, .85, .15, { s: [.5, .7, 2.6] }); P(g, tor(.17, .03, 16), OR, 0, .85, -.05); P(g, sph(.07, 8, 6), glow(TC[eq], 1.8), 0, .85, -.05, { ns: true });
      for (const x of [-1, 1]) { P(g, cone(.12, .6, 4), CRIS, x * .26, .82, .1, { r: [Math.PI / 2, 0, x * .5], s: [1, 1, .3] }); P(g, box(.16, .03, .05), OR, x * .14, .85, -.05); P(g, cone(.05, .25, 4), CADRE, x * .1, .9, -.3, { r: [-Math.PI / 2 - .3, 0, 0] }); }
      const s1 = add(g, oct(.06), glow(CY, 1.4), .3, .85, 0, { ns: true }), s2 = add(g, oct(.06), glow(TC[eq], 1.4), -.3, .85, 0, { ns: true });
      u.an.push(t => { s1.position.set(Math.cos(t * 3) * .34, .85 + Math.sin(t * 2) * .08, Math.sin(t * 3) * .34 - .05); s2.position.set(-Math.cos(t * 3) * .34, .85, -Math.sin(t * 3) * .34 - .05); });
      u.flot = .1; u.hb = 1.35;
    },
    pulse(g, eq, u) {
      P(g, tor(.3, .05, 24), OR, 0, .85, 0, { r: [0, 0, 0] }); P(g, sph(.17, 14, 10), glow(CY, 1.3), 0, .85, 0); P(g, sph(.21, 14, 10), CRIS, 0, .85, -.08, { s: [1, 1, .6] });
      for (let i = 0; i < 3; i++) { const a = i * 2.09 + Math.PI / 2; P(g, cone(.05, .42, 5), CADRE, Math.cos(a) * .3, .85 + Math.sin(a) * .3, .2, { r: [Math.PI / 2, 0, 0] }); P(g, sph(.03, 6, 4), glow(TC[eq], 2), Math.cos(a) * .3, .85 + Math.sin(a) * .3, .42, { ns: true }); }
      P(g, cone(.1, .3, 6), CADRE, 0, .5, 0, { r: [Math.PI, 0, 0] });
      const r1 = add(g, tor(.4, .022, 28), glow(PU, 1.3), 0, .85, 0, { ns: true }), r2 = add(g, tor(.47, .018, 28), glow(TC[eq], 1.3), 0, .85, 0, { ns: true });
      const h = sprite(0x9fe8ff, 1.1, .25); h.position.y = .85; g.add(h); u.an.push(t => { r1.rotation.set(t * 1.7, t, 0); r2.rotation.set(0, t * 1.3, t * 1.9); });
      u.flot = .08; u.hb = 1.45;
    },
    sentinelle(g, eq, u) {
      P(g, oct(.42), CRIS, 0, 1.2, 0, { s: [.75, 2.3, .75] }); P(g, oct(.2), glow(CY, 1.4), 0, 1.2, 0, { s: [.8, 1.9, .8] });
      P(g, cyl(.5, .62, .12, 8), OR, 0, .38, 0); P(g, cyl(.4, .5, .1, 8), CADRE, 0, .48, 0); for (let i = 0; i < 4; i++) { const a = i * 1.57 + .78; P(g, box(.08, .5, .08), OR, Math.cos(a) * .42, .7, Math.sin(a) * .42, { r: [Math.sin(a) * .25, 0, -Math.cos(a) * .25] }); }
      P(g, tor(.3, .03, 20), OR, 0, 1.55, 0, { r: [Math.PI / 2, 0, 0] }); P(g, sph(.06, 8, 6), glow(TC[eq], 2), 0, 2.2, 0, { ns: true });
      const pl = new THREE.Group(); pl.position.y = 1.15; g.add(pl); for (let i = 0; i < 3; i++) { const a = i * 2.09; P(pl, box(.32, .55, .05), CRIS, Math.cos(a) * .62, 0, Math.sin(a) * .62, { r: [0, -a + Math.PI / 2, 0] }); P(pl, box(.34, .04, .07), OR, Math.cos(a) * .62, .29, Math.sin(a) * .62, { r: [0, -a + Math.PI / 2, 0] }); }
      const r = add(g, tor(.72, .04, 30), glow(TC[eq], 1.4), 0, .42, 0, { r: [Math.PI / 2, 0, 0], ns: true }); u.an.push(t => { pl.rotation.y = t * .9; r.rotation.z = t * 1.2; });
      u.flot = .06; u.hb = 2.4;
    },
    oracle(g, eq, u) {
      P(g, oct(.55), CRIS, 0, 1.7, 0, { s: [.85, 1.9, .85] }); P(g, oct(.28), glow(CY, 1.6), 0, 1.7, 0, { s: [.9, 1.5, .9] });
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + .78; P(g, box(.07, 1.3, .07), OR, Math.cos(a) * .55, 1.7, Math.sin(a) * .55, { r: [Math.sin(a) * .3, 0, -Math.cos(a) * .3] }); P(g, oct(.08), glow(TC[eq], 1.6), Math.cos(a) * .72, 2.45, Math.sin(a) * .72, { ns: true }); }
      P(g, tor(.55, .04, 24), OR, 0, 2.45, 0, { r: [Math.PI / 2, 0, 0] }); P(g, tor(.6, .04, 24), OR, 0, .95, 0, { r: [Math.PI / 2, 0, 0] }); P(g, cone(.25, .5, 8), CADRE, 0, .68, 0, { r: [Math.PI, 0, 0] });
      const orb = new THREE.Group(); orb.position.y = 1.7; g.add(orb); for (let i = 0; i < 6; i++) { const a = i * 1.05; P(orb, oct(.13), i % 2 ? CRIS : glow(TC[eq], 1.4), Math.cos(a) * 1.05, Math.sin(a * 2) * .2, Math.sin(a) * 1.05, { s: [.7, 1.4, .7] }); }
      const r = add(g, tor(.95, .05, 32), glow(TC[eq], 1.4), 0, .55, 0, { r: [Math.PI / 2, 0, 0], ns: true }); const h = sprite(0xa58bff, 3, .28); h.position.y = 1.7; g.add(h);
      u.an.push(t => { orb.rotation.y = t * 1.2; r.rotation.z = t * .9; }); u.flot = .12; u.hb = 3.3;
    },
    gardien(g, eq, u) { const A = 0xd6a84a; P(g, sph(.4), MT(0x5a4420, { roughness: .8 }), 0, .55, 0, { s: [1, .8, 1.2] }); for (let i = 0; i < 7; i++) { const a = i * .9; P(g, cone(.07, .42, 5), glow(A, .8), Math.cos(a) * .35, .75 + (i % 2) * .15, Math.sin(a) * .35, { r: [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0] }); } add(g, sph(.07), glow(0xff5030, 2.5), -.12, .62, .42); P(g, sph(.07), glow(0xff5030, 2.5), .12, .62, .42); for (const [x, z] of [[-.25, .2], [.25, .2], [-.25, -.2], [.25, -.2]]) add(g, cone(.06, .35), MT(0x3a2c14), x, .15, z, { r: [Math.PI, 0, 0] }); u.hb = 1.3; },
    // --- bâtiments Ligue de Fer
    noyau(g, eq, u) { P(g, box(3.2, .45, 3.2), MT(FER[1]), 0, .22, 0); P(g, box(2.2, .9, 2.2), MT(FER[0]), 0, .9, 0); P(g, box(1.4, 1.1, 1.4), MT(FER[1]), 0, 1.9, 0); P(g, sph(.7, 16, 10), MT(FER[0]), 0, 2.45, 0, { s: [1, .6, 1] });
      for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { P(g, cyl(.22, .26, 1.3, 8), MT(FER[0]), x, .85, z); P(g, sph(.2), glow(TC[eq], 1.4), x, 1.6, z); }
      add(g, box(2.3, .1, .22), glow(TC[eq], 1.2), 0, 1.3, 1.12); P(g, cyl(.04, .04, 1.6), MT(FER[1]), .4, 3.1, 0); const d = add(g, cyl(.45, .1, .12, 12), MT(0xaab2c2), 0, 3.0, 0, { r: [.6, 0, 0] }); const rd = new THREE.Group(); rd.position.set(.4, 3.5, 0); g.add(rd); P(rd, box(.9, .06, .35), MT(0xaab2c2), 0, 0, 0); P(rd, sph(.08), glow(0xff4040, 2), .4, 0, 0); u.an.push(t => { rd.rotation.y = t * 1.5; }); g.remove(d); fen(g, [[-.6, .95, 1.12], [-.2, .95, 1.12], [.2, .95, 1.12], [.6, .95, 1.12], [-.4, 1.9, .72], [0, 1.9, .72], [.4, 1.9, .72]]); Ring(g, 2.2, eq); u.hb = 3.8; u.bw = 3; },
    caserne(g, eq, u) { P(g, box(2.2, .2, 2.2), MT(FER[1]), 0, .1, 0); P(g, box(2, .95, 1.8), MT(FER[0]), 0, .65, 0); P(g, cyl(1, 1, 2.1, 18, 0, Math.PI), MT(FER[1]), 0, 1.12, 0, { r: [0, 0, Math.PI / 2], s: [.5, 1, .92] }); P(g, box(.9, .75, .1), MT(0x12161d), 0, .55, .92); P(g, box(.9, .06, .12), glow(TC[eq], 1.3), 0, 1.02, .93); P(g, cyl(.03, .03, 1.3), MT(0xaaa), -.9, 1.85, -.7); P(g, box(.45, .3, .03), glow(TC[eq], 1), -.68, 2.35, -.7); fen(g, [[-.7, .9, .91], [.7, .9, .91], [-.7, .55, .91], [.7, .55, .91]]); Ring(g, 1.45, eq); u.hb = 2.7; u.bw = 2.1; },
    atelier(g, eq, u) { P(g, box(2.4, .2, 2.4), MT(FER[1]), 0, .1, 0); P(g, box(2.2, 1.05, 2), MT(FER[0]), 0, .72, 0); P(g, box(1.4, .5, 1.2), MT(FER[1]), -.3, 1.5, -.2); for (const x of [-.7, .6]) { P(g, cyl(.14, .18, 1.3, 8), MT(FER[1]), x, 1.7, -.7); P(g, sph(.15), glow(0xff8a3a, 1.6), x, 2.4, -.7); } add(g, box(1.1, .8, .1), MT(0x12161d), .3, .55, 1.01); P(g, box(.12, .12, 1.5), MT(FER[0]), 1.0, 1.9, .2); const gr = add(g, cyl(.35, .35, .1, 10), MT(0xaab2c2), -.9, 1.3, 1.02, { r: [Math.PI / 2, 0, 0] }); u.an.push(t => { gr.rotation.y = t * 2; }); P(g, box(2.2, .06, .12), glow(TC[eq], 1.2), 0, 1.22, 1.02); fen(g, [[-.8, .95, 1.01], [-.5, .95, 1.01], [-.2, .95, 1.01], [.8, .95, 1.01]]); Ring(g, 1.6, eq); u.hb = 3; u.bw = 2.3; },
    tour(g, eq, u) { P(g, cyl(.75, .9, .5, 12), MT(FER[1]), 0, .25, 0); P(g, cyl(.45, .6, .6, 12), MT(FER[0]), 0, .8, 0); const t = new THREE.Group(); t.position.y = 1.25; g.add(t); P(t, box(.7, .4, .8), MT(FER[0]), 0, 0, 0); for (const x of [-.18, .18]) add(t, cyl(.06, .06, 1.1, 8), MT(0x1c2129), x, .02, .7, { r: [Math.PI / 2, 0, 0] }); P(t, sph(.12), glow(TC[eq], 1.6), 0, .28, -.2); u.tour = t; Ring(g, 1, eq); u.hb = 2.2; u.bw = 1.4; },
    // --- bâtiments Bosquet
    coeur(g, eq, u) { for (let i = 0; i < 9; i++) { const a = i * .7; P(g, cone(.3, 2, 6), MT(BK, { roughness: .95 }), Math.cos(a) * 1.7, .35, Math.sin(a) * 1.7, { r: [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25] }); }
      add(g, sph(1.5, 20, 14), MT(GR, { roughness: .85, emissive: 0x1d5a28, emissiveIntensity: .4 }), 0, 1.6, 0, { s: [1, 1.2, 1] }); P(g, sph(.9, 16, 12), glow(GL, 1.2), 0, 1.8, 0); P(g, sph(1.15, 16, 12), verre(0x6fd88a, .3), 0, 1.8, 0);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; P(g, cone(.16, 1.1, 5), glow(GL, .8), Math.cos(a) * .9, 3.0, Math.sin(a) * .9, { r: [Math.sin(a) * .7, 0, -Math.cos(a) * .7] }); } const o = add(g, tor(1.9, .06), glow(TC[eq], 1.4), 0, .15, 0, { r: [Math.PI / 2, 0, 0] }); const h = sprite(0x9dff7a, 5, .35); h.position.y = 1.8; g.add(h); u.an.push(t => { h.material.opacity = .2 + .08 * Math.sin(t * 2); }); u.hb = 4.4; u.bw = 3; },
    ruche(g, eq, u) { P(g, sph(1.1, 16, 10), MT(GR, { roughness: .9, emissive: 0x1d5a28, emissiveIntensity: .35 }), 0, .45, 0, { s: [1, .95, 1] }); for (let i = 0; i < 7; i++) { const a = i * .9; P(g, sph(.2), MT(0x16301b), Math.cos(a) * .85, .6 + (i % 3) * .3, Math.sin(a) * .85); P(g, sph(.07), glow(GL, 1.6), Math.cos(a) * .98, .62 + (i % 3) * .3, Math.sin(a) * .98); } for (let i = 0; i < 5; i++) { const a = i * 1.26 + .3; P(g, cone(.12, .8, 5), MT(BK), Math.cos(a) * 1.1, .2, Math.sin(a) * 1.1, { r: [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2] }); } add(g, cone(.2, .8, 6), glow(TC[eq], 1.2), 0, 1.7, 0); Ring(g, 1.4, eq); u.hb = 2.4; u.bw = 2.1; },
    serre(g, eq, u) { P(g, cyl(1.3, 1.4, .3, 16), MT(BK), 0, .15, 0); P(g, sph(1.25, 18, 12, 0), verre(0x8fe6a0, .3), 0, .45, 0, { s: [1, .95, 1] }); for (let i = 0; i < 6; i++) { const a = i * 1.05; P(g, cone(.18, .9 + (i % 2) * .4, 5), MT(GR, { emissive: 0x2c7a38, emissiveIntensity: .5 }), Math.cos(a) * .55, .6, Math.sin(a) * .55); } add(g, sph(.25), glow(GL, 1.6), 0, 1.2, 0); P(g, tor(1.22, .05), MT(BK), 0, .45, 0, { r: [Math.PI / 2, 0, 0] }); Ring(g, 1.55, eq); u.hb = 2.1; u.bw = 2.3; },
    ronce(g, eq, u) { P(g, cone(.55, 2.2, 7), MT(BK, { roughness: .9 }), 0, 1.1, 0); for (let i = 0; i < 8; i++) { const a = i * .78; P(g, cone(.08, .6, 5), MT(GR), Math.cos(a) * .42, .6 + (i % 3) * .5, Math.sin(a) * .42, { r: [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0] }); } add(g, sph(.2), glow(GL, 2), 0, 2.3, 0); const h = sprite(0x9dff7a, 1.8, .6); h.position.y = 2.3; g.add(h); Ring(g, .9, eq); u.hb = 3; u.bw = 1.3; },
    // --- bâtiments Échos
    nexus(g, eq, u) { P(g, cyl(2.1, 2.3, .3, 24), MT(0x1c1838, { metalness: .6 }), 0, .15, 0); const r = add(g, tor(1.7, .08), glow(TC[eq], 1.5), 0, .5, 0, { r: [Math.PI / 2, 0, 0] }); P(g, oct(.9), glow(PU, .8), 0, 2.4, 0, { s: [.8, 2.4, .8] }); P(g, oct(.45), glow(CY, 1.6), 0, 2.4, 0, { s: [.8, 2.1, .8] });
      const o = new THREE.Group(); o.position.y = 1.4; g.add(o); for (let i = 0; i < 3; i++) { const a = i * 2.09; P(o, oct(.3), glow(i === 0 ? TC[eq] : PU, 1.2), Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6, { s: [.8, 1.7, .8] }); } const r2 = add(g, tor(1.2, .05), glow(CY, 1.2), 0, 1.6, 0, { r: [Math.PI / 2, 0, 0] }); const h = sprite(0xa58bff, 6, .4); h.position.y = 2.4; g.add(h); u.an.push(t => { o.rotation.y = t * .6; r.rotation.z = -t * .5; r2.rotation.z = t * .8; h.material.opacity = .22 + .06 * Math.sin(t * 2); }); u.hb = 5; u.bw = 3; },
    foyer(g, eq, u) { P(g, cyl(1.5, 1.6, .25, 20), MT(0x1c1838, { metalness: .6 }), 0, .12, 0); for (const x of [-1, 1]) add(g, oct(.45), glow(PU, .8), x * 1.0, 1.1, 0, { s: [.7, 2.2, .7] }); P(g, tor(1.0, .09, 24), glow(CY, 1.2), 0, 1.25, 0, { r: [0, 0, 0], s: [1, 1, 1] }); const c = add(g, oct(.35), glow(TC[eq], 1.8), 0, 1.25, 0); u.an.push(t => { c.rotation.y = t * 2; c.position.y = 1.25 + Math.sin(t * 2) * .1; }); Ring(g, 1.55, eq); u.hb = 2.8; u.bw = 2.1; },
    forge(g, eq, u) { P(g, cyl(1.6, 1.7, .25, 20), MT(0x1c1838, { metalness: .6 }), 0, .12, 0); const rs = []; for (let i = 0; i < 3; i++) rs.push(add(g, tor(1.0 - i * .22, .07), glow(i === 1 ? TC[eq] : PU, 1.3), 0, .7 + i * .55, 0, { r: [Math.PI / 2, 0, 0] })); P(g, sph(.4), glow(CY, 1.7), 0, 1.3, 0); P(g, cyl(.1, .1, 1.8), glow(PU, .8), 0, 1.2, 0); u.an.push(t => rs.forEach((r, i) => { r.rotation.z = t * (i % 2 ? -1.2 : 1.4); })); Ring(g, 1.7, eq); u.hb = 2.6; u.bw = 2.3; },
    phare(g, eq, u) { P(g, cyl(.8, .9, .3, 16), MT(0x1c1838, { metalness: .6 }), 0, .15, 0); P(g, cone(.5, 2.6, 4), glow(PU, .7), 0, 1.5, 0, { r: [0, .78, 0] }); const o = add(g, sph(.2), glow(CY, 2.2), 0, 3.0, 0); const r = add(g, tor(.5, .04), glow(TC[eq], 1.5), 0, 2.4, 0, { r: [Math.PI / 2, 0, 0] }); const h = sprite(0x9fe8ff, 2.2, .6); h.position.y = 3.0; g.add(h); u.an.push(t => { r.rotation.z = t * 2; h.material.opacity = .45 + .2 * Math.sin(t * 4); }); Ring(g, .95, eq); u.hb = 3.6; u.bw = 1.4; },
  };

  // ---------- effets ----------
  const fx = []; const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1), sparkG = new THREE.OctahedronGeometry(1), ringG = new THREE.RingGeometry(.85, 1, 32);
  const addFx = (o, ttl, upd, fin) => { scene.add(o); fx.push({ o, t: 0, ttl, upd, fin }); if (fx.length > 260) { const d = fx.shift(); scene.remove(d.o); } };
  const mb = (c, op = 1) => new THREE.MeshBasicMaterial({ color: lin(c), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  function flash(x, y, z, taille, c, ttl) { const s = sprite(c, taille, 1); s.position.set(x, y, z); addFx(s, ttl, (f, k) => { s.scale.setScalar(taille * (.4 + .9 * k)); s.material.opacity = 1 - k; }); }
  function trait(a, b, c, ep, ttl) {
    const d = new V3().subVectors(b, a), L = d.length() || .01, m = new THREE.Mesh(unitCyl, mb(c, .95)); m.position.copy(a).addScaledVector(d, .5); m.scale.set(ep, L, ep);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); addFx(m, ttl, (f, k) => { m.material.opacity = .95 * (1 - k); m.scale.x = m.scale.z = ep * (1 - k * .6); });
  }
  function bolt(a, b, c, lourd) {
    const d = new V3().subVectors(b, a), L = d.length() || .01, T = clamp(L / (lourd ? 14 : 22), .06, .5), g = new THREE.Group();
    const m = new THREE.Mesh(unitCyl, mb(c, 1)); m.scale.set(lourd ? .11 : .045, lourd ? .8 : .6, lourd ? .11 : .045); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize()); g.add(m);
    g.add(sprite(c, lourd ? 1.1 : .6, 1)); g.position.copy(a);
    addFx(g, T, (f, k) => { g.position.copy(a).addScaledVector(d, k); }, () => { etincelles(b, c, lourd ? 9 : 4); flash(b.x, b.y, b.z, lourd ? 1.6 : .8, lourd ? 0xffc080 : c, .18); if (lourd) onde(b.x, b.y - .3, b.z, 1.6, c, .3); });
  }
  function etincelles(p, c, n, v = 2.2) {
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(sparkG, mb(c, 1)); const s0 = .05 + Math.random() * .06; m.scale.setScalar(s0); m.position.copy(p);
      const vel = new V3((Math.random() - .5) * v, Math.random() * v * .9 + .5, (Math.random() - .5) * v); addFx(m, .4 + Math.random() * .4, (f, k, dt) => { vel.y -= 5 * dt; m.position.addScaledVector(vel, dt); m.material.opacity = 1 - k; }); }
  }
  function onde(x, y, z, r, c, ttl) { const m = new THREE.Mesh(ringG, mb(c, .8)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); addFx(m, ttl, (f, k) => { m.scale.setScalar(.3 + r * k); m.material.opacity = .8 * (1 - k); }); }
  function explosion(x, y, z, gros) {
    shake = Math.min(.55, shake + (gros ? .4 : .07) / (1 + Math.hypot(x - cible.x, z - cible.z) * .09));
    flash(x, y + .4, z, gros ? 4 : 1.8, 0xffa850, .5); flash(x, y + .4, z, gros ? 2 : .9, 0xffffff, .22); onde(x, y + .1, z, gros ? 4.5 : 2.2, 0xffc080, .5);
    const n = gros ? 22 : 9;
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(i % 2 ? sparkG : new THREE.BoxGeometry(1, 1, 1), MT(i % 3 ? 0x3b4350 : 0xff8a3a, { emissive: i % 3 ? 0x000000 : 0xff6a1a, emissiveIntensity: 1 })); const s0 = (gros ? .12 : .07) * (.6 + Math.random()); m.scale.setScalar(s0); m.position.set(x, y + .4, z);
      const sp = gros ? 5 : 3.2, vel = new V3((Math.random() - .5) * sp, 2 + Math.random() * sp, (Math.random() - .5) * sp), rv = new V3(Math.random() * 6, Math.random() * 6, 0);
      addFx(m, .9 + Math.random() * .6, (f, k, dt) => { vel.y -= 9 * dt; m.position.addScaledVector(vel, dt); if (m.position.y < haut(m.position.x, m.position.z) + .05) { m.position.y = haut(m.position.x, m.position.z) + .05; vel.multiplyScalar(0); } m.rotation.x += rv.x * dt; m.rotation.y += rv.y * dt; if (k > .7) m.scale.setScalar(s0 * (1 - (k - .7) / .3)); }); }
  }
  function majFx(dt) { for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const k = Math.min(1, f.t / f.ttl); f.upd(f, k, dt); if (k >= 1) { if (f.fin) f.fin(); scene.remove(f.o); if (f.o.material && f.o.material.dispose && f.o.material.transparent) f.o.material.dispose(); fx.splice(i, 1); } } }

  // ---------- entités ----------
  const ents = new Map(), anneaux = new Map(); let t0 = performance.now(), dernierFog = -1, fantome = null, fantomeK = null;
  const hbMat = c => new THREE.SpriteMaterial({ color: lin(c), depthTest: false, transparent: true });
  const poolG = new THREE.CircleGeometry(1, 24), circG = new THREE.CircleGeometry(.92, 32), ringSel = new THREE.RingGeometry(.9, 1, 32), ghostMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: .42, depthWrite: false });
  function creerEnt(e) {
    const g = new THREE.Group(), u = { g, k: e.k, eq: e.eq, an: [], hb: 1.2, flot: 0, tour: null, bw: BA[e.k] ? 2 : .9, px: e.x / 1000, pz: e.y / 1000, lastHt: -1, lastPc: 0, cap: 0 };
    B[e.k](g, e.eq, u);
    compacter(g, e.k + ':' + e.eq);
    if (!BA[e.k]) { g.rotation.order = 'YXZ'; u.pool = new THREE.Mesh(poolG, new THREE.MeshBasicMaterial({ color: lin(TC[e.eq]), transparent: true, opacity: .13, depthWrite: false, blending: THREE.AdditiveBlending })); u.pool.rotation.x = -Math.PI / 2; u.pool.scale.setScalar(UN[e.k].pv > 200 ? .8 : .42); scene.add(u.pool); }
    if (UN[e.k] && UN[e.k].ch) { const c = add(g, tor(.55, .035), glow(0xffd84a, 1.6), 0, .06, 0, { r: [Math.PI / 2, 0, 0], ns: true }); u.an.push(t => { c.rotation.z = t; }); }
    if (UN[e.k] && UN[e.k].bm) { u.bulle = new THREE.Mesh(sph(.85, 18, 12), new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); u.bulle.position.y = .85; g.add(u.bulle); }
    u.bg = new THREE.Sprite(hbMat(0x0c1016)); u.fg = new THREE.Sprite(hbMat(0x45ff7a)); u.fg.center.set(0, .5); u.bg.renderOrder = 30; u.fg.renderOrder = 31; u.bg.visible = u.fg.visible = false;
    scene.add(g, u.bg, u.fg); return u;
  }
  const dir = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  function sync(s, C, dt, t) {
    const idx = new Map(); for (const e of s.ent) idx.set(e.id, e);
    const v = s.vis[C.ME], selSet = new Set(C.sel);
    for (const e of s.ent) {
      let u = ents.get(e.id); if (!u) { u = creerEnt(e); ents.set(e.id, u); u.neuf = s.tick > 3; }
      const x = e.x / 1000, z = e.y / 1000, cell = clamp(Math.floor(z), 0, H - 1) * W + clamp(Math.floor(x), 0, W - 1);
      const vu = C.tout || e.eq === C.ME || v[cell] === 2; u.vu = vu; u.g.visible = vu; u.hb_ = vu;
      const y0 = haut(x, z), isB = !!BA[e.k], dx = x - u.px, dz = z - u.pz, bouge = dx * dx + dz * dz > 1e-6;
      if (u.neuf) { u.neuf = false; if (vu) { const c = TC[e.eq]; flash(x, y0 + .6, z, isB ? 5 : 2.2, c, .55); onde(x, y0 + .1, z, isB ? 4 : 2.2, c, .7); etincelles(new V3(x, y0 + .3, z), c, isB ? 14 : 6, 3); } }
      if (u.pool) { u.pool.position.set(x, y0 + .04, z); u.pool.visible = vu; }
      u.g.position.set(x, y0 + (u.flot ? .25 + Math.sin(t * 2 + e.id) * u.flot : 0) + (bouge && !u.flot && !isB ? Math.abs(Math.sin(t * 9 + e.id)) * .07 : 0), z);
      const tg = e.tg !== undefined ? idx.get(e.tg) : null, recent = tg && s.tick - e.ht < 8;
      let cap = u.cap;
      if (recent && !isB) cap = Math.atan2(tg.x / 1000 - x, tg.y / 1000 - z); else if (bouge) cap = Math.atan2(dx, dz);
      if (!isB) { let da = cap - u.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); u.g.rotation.y += da * Math.min(1, dt * 12); u.cap = cap; u.g.rotation.x += ((bouge ? .09 : 0) - u.g.rotation.x) * Math.min(1, dt * 8); u.g.rotation.z = bouge ? Math.sin(t * 9 + e.id) * .05 : u.g.rotation.z * .8; }
      if (u.tour) { let d = 0; if (recent) { d = Math.atan2(tg.x / 1000 - x, tg.y / 1000 - z) - u.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); } u.tour.rotation.y += (d - u.tour.rotation.y) * Math.min(1, dt * 10); }
      u.px = x; u.pz = z; for (const f of u.an) f(t);
      if (u.pattes) for (const [pg, ph] of u.pattes) pg.rotation.x += ((bouge ? Math.sin(t * 11 + (ph > 0 ? 0 : Math.PI)) * .75 : 0) - pg.rotation.x) * Math.min(1, dt * 14);
      if (isB) u.g.scale.y = e.cons ? .2 + .8 * (1 - e.cons / BA[e.k].tc) : 1;
      if (isB && e.cons && vu) { u.nx = (u.nx || 0) - dt; if (u.nx <= 0) { u.nx = .12; etincelles(new V3(x + (Math.random() - .5) * 1.6, y0 + 2.2 * (1 - e.cons / BA[e.k].tc) + .3, z + (Math.random() - .5) * 1.6), 0xffd080, 2, 2.5); } }
      if (u.bulle) u.bulle.material.opacity = e.bc > 0 && e.rg < 10 ? (.06 + .22 * (e.bc / e.bm)) * (1 - e.rg / 10) : 0; // le bouclier ne se voit que quand il encaisse
      // tirs
      if (e.ht !== undefined && e.ht !== u.lastHt) {
        u.lastHt = e.ht;
        if (vu && tg && s.tick - e.ht < 3) {
          const d = UN[e.k] || BA[e.k], A = new V3(x, y0 + (isB ? e.k === 'tour' || e.k === 'ronce' || e.k === 'phare' ? 1.5 : 1 : .8), z), Bp = new V3(tg.x / 1000, haut(tg.x / 1000, tg.y / 1000) + (BA[tg.k] ? 1 : .6), tg.y / 1000);
          const fac = ['fer', 'bosquet', 'echos'][['ouvrier', 'semeur', 'tisseur'].includes(e.k) ? 0 : 0], lourd = ['blinde', 'colosse', 'sentinelle', 'marechal', 'ancien', 'oracle', 'tour', 'ronce', 'phare'].includes(e.k);
          const c = ['fantassin', 'tireur', 'blinde', 'marechal', 'tour'].includes(e.k) ? 0xffe08a : ['rejeton', 'epine', 'colosse', 'ancien', 'ronce'].includes(e.k) ? 0x9dff7a : e.eq === 2 ? 0xffb060 : 0x7ff3ff;
          if (d.pt > 2500 || BA[e.k]) { bolt(A, Bp, c, lourd); flash(A.x, A.y, A.z, lourd ? .9 : .5, c, .1); }
          else { flash(Bp.x, Bp.y, Bp.z, .7, c, .14); etincelles(Bp, c, 4); }
        }
      }
      if (e.pc !== undefined && e.pc > u.lastPc + 500 && vu) { const c = e.k === 'marechal' ? 0xff7a40 : e.k === 'ancien' ? 0x9dff7a : 0x7ff3ff; onde(x, y0 + .1, z, e.k === 'marechal' ? 6 : 10, c, .8); flash(x, y0 + 1, z, 5, c, .5); }
      u.lastPc = e.pc || 0;
      // barres de vie
      const frac = e.pv / e.max, montre = !!(vu && !orb && (frac < .999 || selSet.has(e.id) || e.cons)), by = u.g.position.y + u.hb + (u.flot ? .1 : 0);
      u.bg.visible = u.fg.visible = montre;
      if (montre) { const bw = u.bw; u.bg.position.set(x, by, z); u.bg.scale.set(bw + .07, .13, 1); u.fg.position.set(x - bw / 2, by, z); const f = e.cons ? 1 - e.cons / BA[e.k].tc : frac; u.fg.scale.set(Math.max(.001, bw * f), .09, 1); u.fg.material.color.set(lin(e.cons ? 0x4cc9f0 : frac > .6 ? 0x45ff7a : frac > .3 ? 0xffd84a : 0xff4a3a)); }
    }
    for (const [id, u] of ents) if (!idx.has(id)) {
      if (u.vu) { const gros = !!BA[u.k] || (UN[u.k] && UN[u.k].pv > 200); explosion(u.g.position.x, u.g.position.y, u.g.position.z, gros); if (BA[u.k]) { onde(u.g.position.x, u.g.position.y + .1, u.g.position.z, 7, 0xffc080, .8); } }
      scene.remove(u.g, u.bg, u.fg, u.pool); ents.delete(id);
    }
    // anneaux de sélection
    for (const [id, m] of anneaux) if (!selSet.has(id) || !ents.has(id)) { scene.remove(m); anneaux.delete(id); }
    for (const id of selSet) { const u = ents.get(id); if (!u) continue; let m = anneaux.get(id); if (!m) { m = new THREE.Mesh(ringSel, new THREE.MeshBasicMaterial({ color: lin(0x7dff7d), transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.renderOrder = 5; m.add(new THREE.Mesh(circG, new THREE.MeshBasicMaterial({ color: lin(0x7dff7d), transparent: true, opacity: .14, depthWrite: false, blending: THREE.AdditiveBlending }))); const r = BA[u.k] ? (BA[u.k].qg ? 2.3 : u.bw * .75) : (UN[u.k].pv > 200 ? .85 : .55); m.scale.setScalar(r); scene.add(m); anneaux.set(id, m); } m.position.set(u.g.position.x, haut(u.px, u.pz) + .08, u.g.position.z); m.visible = u.g.visible; }
    // ressources / Relais
    for (const o of cartesObjs.children) {
      const d = o.userData; if (d.mine) { const m = d.mine, cell = clamp(Math.floor(m.y / 1000), 0, H - 1) * W + clamp(Math.floor(m.x / 1000), 0, W - 1); o.visible = (C.tout || v[cell] > 0) && m.q > 0; const nv = Math.ceil(d.cr.length * clamp(m.q / d.q0, 0, 1)); d.cr.forEach((c, i) => { c.visible = i < nv; }); d.gl.material.opacity = .35 + .15 * Math.sin(t * 2 + m.x); }
      else if (d.rl) {
        const r = d.rl, cell = clamp(Math.floor(r.y / 1000), 0, H - 1) * W + clamp(Math.floor(r.x / 1000), 0, W - 1); o.visible = C.tout || v[cell] > 0;
        const c = r.own < 0 ? 0xaab4c8 : TC[r.own]; for (const m of [d.r1, d.r2, d.orb]) m.material = glow(c, 1.3); d.halo.material.color.set(lin(c));
        d.vap.forEach((v, i) => { const k = (t * .35 + i / 5) % 1; v.position.y = .3 + k * 3.2; v.material.opacity = .22 * Math.sin(k * Math.PI); v.scale.setScalar(.8 + k * 1.6); }); d.r1.rotation.z = t * 1.4; d.r2.rotation.z = -t * 1.9; d.orb.position.y = 2.75 + Math.sin(t * 2) * .08;
        d.disc.material.color.set(lin(r.prog > 0 ? TC[0] : TC[1])); d.disc.material.opacity = Math.abs(r.prog) < 100 ? Math.abs(r.prog) / 100 * .35 : 0;
      }
    }
    // fantôme de placement
    if (C.place !== fantomeK) { if (fantome) scene.remove(fantome); fantome = null; fantomeK = C.place; if (C.place) { const g = new THREE.Group(), u = { an: [], hb: 1, bw: 1 }; B[C.place](g, C.ME, u); g.traverse(m => { if (m.isMesh) { m.material = ghostMat; m.castShadow = false; } }); fantome = g; scene.add(g); } }
    if (fantome && C.souris) { const p = sol(C.souris.x, C.souris.y); if (p) { const x = Math.round(p.x / 1000), z = Math.round(p.y / 1000); fantome.position.set(x, haut(x, z), z); } }
    // brouillard
    if (dernierFog !== s.tick || C.tout !== fogTex.tout) { if (s.tick % 5 === 0 || dernierFog < 0 || C.tout !== fogTex.tout) {
      for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const q = C.tout ? 2 : v[(j >> 1) * W + (i >> 1)]; fa[j * FW + i] = q === 2 ? 0 : q === 1 ? 135 : 238; }
      for (let p = 0; p < 2; p++) { for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { let sum = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < FW && y < FH) { sum += fa[y * FW + x]; n++; } } fb[j * FW + i] = sum / n; } fa.set(fb); }
      for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) { const o = ((FH - 1 - j) * FW + i) * 4; fogData[o] = fogData[o + 1] = fogData[o + 2] = 0; fogData[o + 3] = fa[j * FW + i]; }
      fogTex.needsUpdate = true; fogTex.tout = C.tout; } dernierFog = s.tick; }
  }

  // ---------- caméra, picking ----------
  const ray = new THREE.Raycaster(), plan = new THREE.Plane(new V3(0, 1, 0), 0);
  function appliquer() {
    cible.x = clamp(cible.x, 3, 44); cible.z = clamp(cible.z, 3, 44); dist = clamp(dist, 9, 40);
    const pit = orb ? .6 : PITCH; cam.position.set(cible.x + Math.sin(yaw) * dist * Math.cos(pit), cible.y + dist * Math.sin(pit), cible.z + Math.cos(yaw) * dist * Math.cos(pit)); cam.lookAt(cible); if (shake > .005) { cam.position.x += (Math.random() - .5) * shake; cam.position.y += (Math.random() - .5) * shake; shake *= .9; }
    sun.position.set(cible.x - 22, 38, cible.z + 18); sun.target.position.copy(cible); sun.target.updateMatrixWorld();
  }
  function sol(px, py) {
    const r = renderer.domElement.getBoundingClientRect(), w = r.width || 1, h = r.height || 1;
    ray.setFromCamera({ x: (px / w) * 2 - 1, y: -(py / h) * 2 + 1 }, cam);
    const hit = terrain ? ray.intersectObject(terrain)[0] : null; let p = hit ? hit.point : ray.ray.intersectPlane(plan, new V3());
    return p ? { x: p.x * 1000, y: p.z * 1000 } : null;
  }
  function mineSous(px, py) { // la mine (indice) dont un cristal est sous la souris, sinon -1
    const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera({ x: (px / (r.width || 1)) * 2 - 1, y: -(py / (r.height || 1)) * 2 + 1 }, cam);
    const ms = cartesObjs.children.filter(o => o.userData.mine && o.visible), h = ray.intersectObjects(ms, true)[0]; if (!h) return -1;
    let o = h.object; while (o && !o.userData.mine) o = o.parent; return o ? o.userData.idx : -1;
  }
  function proj(xm, ym, ho = .5) { const v = new V3(xm / 1000, haut(xm / 1000, ym / 1000) + ho, ym / 1000).project(cam), r = renderer.domElement; return { x: (v.x * .5 + .5) * (r.clientWidth || 1), y: (-v.y * .5 + .5) * (r.clientHeight || 1), z: v.z }; }
  function coins() { const r = renderer.domElement, w = r.clientWidth, h = r.clientHeight; return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => { const p = sol(x, y); return p ? [p.x / 1000, p.y / 1000] : [cible.x, cible.z]; }); }
  // ---------- post-traitement : lueur (bloom), tonalité filmique, aberration chromatique légère, vignette ----------
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null), camQ = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sceneQ = new THREE.Scene(); quad.frustumCulled = false; sceneQ.add(quad);
  const VSH = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const PM = (fs, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VSH, fragmentShader: fs, depthTest: false, depthWrite: false });
  const mBright = PM('varying vec2 vUv; uniform sampler2D t; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = dot(c, vec3(.2126,.7152,.0722)); gl_FragColor = vec4(c * smoothstep(.95, 2., l), 1.); }', { t: { value: null } });
  const mBlur = PM('varying vec2 vUv; uniform sampler2D t; uniform vec2 d; void main(){ vec3 s = texture2D(t, vUv).rgb * .227; s += (texture2D(t, vUv + d*1.38).rgb + texture2D(t, vUv - d*1.38).rgb) * .316; s += (texture2D(t, vUv + d*3.23).rgb + texture2D(t, vUv - d*3.23).rgb) * .07; gl_FragColor = vec4(s, 1.); }', { t: { value: null }, d: { value: new THREE.Vector2() } });
  const mCopy = PM('varying vec2 vUv; uniform sampler2D t; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.); }', { t: { value: null } });
  const mComp = PM(`varying vec2 vUv; uniform sampler2D t, b1, b2; uniform float ex, tm;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
    void main(){ vec2 d = vUv - .5; float r2 = dot(d, d);
      vec3 c = vec3(texture2D(t, vUv + d*r2*.006).r, texture2D(t, vUv).g, texture2D(t, vUv - d*r2*.006).b);
      c += texture2D(b1, vUv).rgb * .6 + texture2D(b2, vUv).rgb * .5;
      c = aces(c * ex);
      c = mix(vec3(dot(c, vec3(.299,.587,.114))), c, 1.1) * vec3(.97, 1., 1.05);
      c *= 1. - smoothstep(.3, .9, length(d) * 1.3) * .5;
      c = pow(c, vec3(1. / 2.2)); c += (fract(sin(dot(vUv * tm, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.;
      gl_FragColor = vec4(c, 1.); }`, { t: { value: null }, b1: { value: null }, b2: { value: null }, ex: { value: .8 }, tm: { value: 1 } });
  const HDR = !!(renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')));
  const mkRT = (w, h, depth) => new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: HDR ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: !!depth, stencilBuffer: false });
  let rt = null, rH = null, rH2 = null, rQ = null, rQ2 = null;
  let SSV = renderer.getPixelRatio() >= 1.5 ? 1 : 1.5, W0 = 800, H0 = 500, tt = 0, nf = 0; // qualité adaptative : le sur-échantillonnage baisse si la machine rame
  function redim(w, h) { W0 = w; H0 = h; const pr = renderer.getPixelRatio(), ss = SSV, X = w * pr * ss, Y = h * pr * ss; const t_ = (r, w_, h_, d) => { w_ = Math.max(2, w_ | 0); h_ = Math.max(2, h_ | 0); if (!r) return mkRT(w_, h_, d); if (r.width !== w_ || r.height !== h_) r.setSize(w_, h_); return r; };
    renderer.setRenderTarget(null); rt = t_(rt, X, Y, true); rH = t_(rH, X / 2, Y / 2); rH2 = t_(rH2, X / 2, Y / 2); rQ = t_(rQ, X / 4, Y / 4); rQ2 = t_(rQ2, X / 4, Y / 4); }
  function passe(mat, src, dst, d) { quad.material = mat; mat.uniforms.t.value = src.texture; if (d) mat.uniforms.d.value.set(d[0], d[1]); renderer.setRenderTarget(dst); renderer.render(sceneQ, camQ); }
  function rendre() {
    renderer.setRenderTarget(rt); renderer.render(scene, cam);
    passe(mBright, rt, rH); passe(mBlur, rH, rH2, [1 / rH.width, 0]); passe(mBlur, rH2, rH, [0, 1 / rH.height]);
    passe(mCopy, rH, rQ); passe(mBlur, rQ, rQ2, [1 / rQ.width, 0]); passe(mBlur, rQ2, rQ, [0, 1 / rQ.height]);
    mComp.uniforms.t.value = rt.texture; mComp.uniforms.b1.value = rH.texture; mComp.uniforms.b2.value = rQ.texture; mComp.uniforms.tm.value = 1 + (performance.now() % 1000) / 1000;
    quad.material = mComp; renderer.setRenderTarget(null); renderer.render(sceneQ, camQ);
  }
  function resize() { const w = hote.clientWidth || 800, h = hote.clientHeight || 500; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); redim(w, h); }

  // ---------- portraits 3D (interface) : un second rendu minuscule, mis en cache ----------
  const portraits = new Map(); let r2 = null;
  function portrait(k, eq, taille = 128) {
    const key = k + ':' + eq + ':' + taille; if (portraits.has(key)) return portraits.get(key);
    if (!r2) { r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r2.setPixelRatio(1); r2.setSize(taille, taille); if ('outputColorSpace' in r2) r2.outputColorSpace = THREE.SRGBColorSpace; else r2.outputEncoding = THREE.sRGBEncoding; r2.toneMapping = THREE.ACESFilmicToneMapping; r2.toneMappingExposure = .95; r2.setClearColor(0x000000, 0); }
    if (r2.domElement.width !== taille) r2.setSize(taille, taille);
    const sc = new THREE.Scene(), g = new THREE.Group(), u = { an: [], hb: 1, bw: 1 }; B[k](g, eq, u); g.rotation.y = .7; sc.add(g);
    for (const f of u.an) f(1.3);
    sc.add(new THREE.HemisphereLight(0xb8c8ff, 0x2a2038, 1.1 * LK)); const dl = new THREE.DirectionalLight(0xfff0dd, 1.7 * LK); dl.position.set(-3, 5, 4); sc.add(dl); const rm = new THREE.DirectionalLight(0x6a8cff, 1 * LK); rm.position.set(4, 2, -3); sc.add(rm);
    g.position.y = u.flot ? .0 : 0; g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g), ctr = bb.getCenter(new V3()), sz = bb.getSize(new V3()), R_ = Math.max(sz.x, sz.y * 1.05, sz.z);
    const c = new THREE.PerspectiveCamera(30, 1, .1, 60), D = R_ * 1.0 / Math.tan(15 * Math.PI / 180) * .46; c.position.set(ctr.x + D * .45, ctr.y + D * .38, ctr.z + D * .82); c.lookAt(ctr.x, ctr.y - sz.y * .04, ctr.z);
    r2.render(sc, c); const url = r2.domElement.toDataURL('image/png'); portraits.set(key, url); return url;
  }
  return {
    portrait, carteMini: () => carteMini, qualite(v) { SSV = v; redim(W0, H0); }, canvas: renderer.domElement, resize, sol, mineSous, proj, coins, scene,
    init(s) { for (const [, u] of ents) scene.remove(u.g, u.bg, u.fg, u.pool); ents.clear(); for (const [, m] of anneaux) scene.remove(m); anneaux.clear(); for (const f of fx) scene.remove(f.o); fx.length = 0; dernierFog = -1; fantomeK = null; if (fantome) { scene.remove(fantome); fantome = null; } bati(s); resize(); },
    deplacer(dx, dz) { cible.x += dx; cible.z += dz; }, zoom(d) { dist *= d; }, centrer(x, z) { cible.x = x; cible.z = z + 3; },
    vue: () => ({ x: cible.x, z: cible.z }),
    maj(s, C) { const now = performance.now(), dt = Math.min(.1, (now - t0) / 1000); t0 = now; const t = now / 1000; tt += dt; if (++nf >= 60) { if (tt / nf > .05 && SSV > 1) { SSV = Math.max(1, SSV - .25); redim(W0, H0); } tt = 0; nf = 0; } appliquer(); if (orb) yaw += dt * .06; for (const m of roches) { m.rotation.y += m.userData.w * dt; m.rotation.x += m.userData.w * .5 * dt; m.position.y = m.userData.y0 + Math.sin(t * .3 + m.userData.b) * .6; } feux.forEach((f, i) => { f.material.opacity = .45 + .4 * Math.sin(t * 2 + i * .8); });
      for (let i = 0; i < NP; i++) { const q = pv[i]; pp[i * 3] += q[0] * dt; pp[i * 3 + 1] += (Math.sin(t * .5 + i) * .15 + q[1]) * dt * .6; pp[i * 3 + 2] += q[2] * dt; if (pp[i * 3] > 52) pp[i * 3] -= 56; if (pp[i * 3] < -4) pp[i * 3] += 56; if (pp[i * 3 + 1] > 8) pp[i * 3 + 1] = .3; if (pp[i * 3 + 2] > 52) pp[i * 3 + 2] -= 56; if (pp[i * 3 + 2] < -4) pp[i * 3 + 2] += 56; } dustG.attributes.position.needsUpdate = true; sync(s, C, dt, t); majFx(dt); rendre(); },
    menu(on) { orb = on; if (on) { cible.set(24, .5, 24); dist = 15; } else yaw = 0; }, suivre(x, z) { cible.x += (x - cible.x) * .03; cible.z += (z - cible.z) * .03; },
  };
}
