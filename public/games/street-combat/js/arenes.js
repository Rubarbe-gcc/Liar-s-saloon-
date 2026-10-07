/**
 * STREET COMBAT — les arènes.
 *
 * Chaque arène a un décor fixe (dessiné une fois, dans une image à part) et
 * ce qui bouge par-dessus : pétales, pluie, braises, neige, aurore, bulles,
 * lucioles, éclairs… L'arène fait 1000 × 600, le sol est à 470.
 */

import { rgba, teinte, etoile } from './dessin.js';

export const L = 1000;
export const H = 600;
export const SOL = 470;

export const ARENES = [
  { id: 'dojo', nom: 'DOJO SACRÉ', ciel: ['#1a0a02', '#5a2008', '#c8501a', '#ffb050'], sol: '#5a3214', sol2: '#3c1f0a', deco: '#c8641e', deco2: '#ff3c00' },
  { id: 'neon', nom: 'NÉON CITY', ciel: ['#000008', '#05082a', '#0a1450', '#1a0838'], sol: '#08102a', sol2: '#101c48', deco: '#00b4ff', deco2: '#ff0064' },
  { id: 'volcan', nom: 'VOLCAN INFERNAL', ciel: ['#140000', '#3c0000', '#7a0a00', '#c83200'], sol: '#2a0505', sol2: '#5a1000', deco: '#ff5000', deco2: '#ffc800' },
  { id: 'toundra', nom: 'TOUNDRA GLACÉE', ciel: ['#000514', '#001030', '#06284e', '#1a4a70'], sol: '#bcd8ec', sol2: '#8ab4d4', deco: '#00c8ff', deco2: '#c8f0ff' },
  { id: 'ruines', nom: 'RUINES ANTIQUES', ciel: ['#1a1000', '#4a3006', '#a0601a', '#e8a050'], sol: '#7a5a28', sol2: '#5a4018', deco: '#c8a03c', deco2: '#ffc850' },
  { id: 'station', nom: 'STATION SPATIALE', ciel: ['#000000', '#02000a', '#080020', '#10002a'], sol: '#1a1a2e', sol2: '#2a2a46', deco: '#6464c8', deco2: '#c864ff' },
  { id: 'jungle', nom: 'JUNGLE PRIMORDIALE', ciel: ['#001400', '#00280a', '#0a4a14', '#3a7a28'], sol: '#2a4a14', sol2: '#18300a', deco: '#00b41e', deco2: '#50ff3c' },
  { id: 'abysses', nom: 'ABYSSES MARINES', ciel: ['#00040e', '#00102a', '#002048', '#00366a'], sol: '#c8b48a', sol2: '#a08c64', deco: '#00a0dc', deco2: '#00ffc8' },
  { id: 'celeste', nom: 'CITÉ CÉLESTE', ciel: ['#5a82e6', '#8cb4ff', '#c8dcff', '#fff0d2'], sol: '#e6e8ff', sol2: '#c8ccf0', deco: '#ffdc64', deco2: '#ffffc8' },
  { id: 'desert', nom: 'DÉSERT MAUDIT', ciel: ['#2a1000', '#7a3006', '#d2700a', '#ffc050'], sol: '#c8963c', sol2: '#a0702a', deco: '#ff9600', deco2: '#c85000' },
  { id: 'foret', nom: 'FORÊT MAUDITE', ciel: ['#020602', '#081208', '#0e1e0e', '#1a2a14'], sol: '#14260c', sol2: '#0a1806', deco: '#50c828', deco2: '#28ff50' },
  { id: 'cathedrale', nom: 'CATHÉDRALE SOLAIRE', ciel: ['#3a2a10', '#8a6a28', '#d8b860', '#fff0b4'], sol: '#e6d6a0', sol2: '#c8b478', deco: '#ffc800', deco2: '#ffffb4', boss: 'solarius' },
  { id: 'trone', nom: 'TRÔNE INFERNAL', ciel: ['#050000', '#140000', '#2a0004', '#500008'], sol: '#140000', sol2: '#3c0006', deco: '#b40014', deco2: '#ff2800', boss: 'malvortex' },
  { id: 'zero', nom: 'DIMENSION ZÉRO', ciel: ['#000000', '#020005', '#08000c', '#1a0208'], sol: '#140200', sol2: '#500800', deco: '#7800c8', deco2: '#c81400', boss: 'lechaos' },
];
export const ARENE = Object.fromEntries(ARENES.map((a) => [a.id, a]));

/** Un hasard qui donne toujours le même décor. */
function alea(graine) {
  let s = graine >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const caches = new Map();

/** Le décor fixe de l'arène (mis en cache). */
export function fondArene(a) {
  if (caches.has(a.id)) return caches.get(a.id);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(L, H) : Object.assign(document.createElement('canvas'), { width: L, height: H });
  const g = cv.getContext('2d');
  // Le ciel.
  const ciel = g.createLinearGradient(0, 0, 0, SOL);
  a.ciel.forEach((c, i) => ciel.addColorStop(i / (a.ciel.length - 1), c));
  g.fillStyle = ciel;
  g.fillRect(0, 0, L, SOL + 2);
  const R = alea(a.id.length * 7919 + a.id.charCodeAt(0));
  (DECORS[a.id] || (() => {}))(g, a, R);
  sol(g, a, R);
  caches.set(a.id, cv);
  return cv;
}

/** Le sol : un dégradé, des lignes de fuite, une lumière au centre. */
function sol(g, a, R) {
  const gr = g.createLinearGradient(0, SOL, 0, H);
  gr.addColorStop(0, a.sol);
  gr.addColorStop(1, a.sol2);
  g.fillStyle = gr;
  g.fillRect(0, SOL, L, H - SOL);
  g.strokeStyle = rgba(teinte(a.sol, 0.25), 0.35);
  g.lineWidth = 1;
  for (let i = -10; i <= 10; i++) {
    g.beginPath(); g.moveTo(L / 2 + i * 40, SOL); g.lineTo(L / 2 + i * 150, H); g.stroke();
  }
  for (let y = SOL + 12; y < H; y += 10 + (y - SOL) * 0.35) {
    g.strokeStyle = rgba(teinte(a.sol, 0.2), 0.25);
    g.beginPath(); g.moveTo(0, y); g.lineTo(L, y); g.stroke();
  }
  // Le bord du sol, qui brille.
  g.fillStyle = rgba(a.deco, 0.55);
  g.fillRect(0, SOL - 1, L, 3);
  const lum = g.createRadialGradient(L / 2, SOL + 20, 10, L / 2, SOL + 20, 420);
  lum.addColorStop(0, rgba('#ffffff', 0.12));
  lum.addColorStop(1, rgba('#ffffff', 0));
  g.fillStyle = lum;
  g.fillRect(0, SOL, L, H - SOL);
  void R;
}

/* ------------------------------------------------------------------ */
/* Les décors fixes                                                    */
/* ------------------------------------------------------------------ */

const montagnes = (g, base, haut, c, R, pas = 60) => {
  g.fillStyle = c;
  g.beginPath(); g.moveTo(0, base);
  let y = base - haut * R();
  for (let x = 0; x <= L + pas; x += pas) { y = Math.max(base - haut, Math.min(base - haut * 0.25, y + (R() - 0.5) * haut * 0.6)); g.lineTo(x, y); }
  g.lineTo(L, base); g.closePath(); g.fill();
};
const soleil = (g, x, y, r, c, halo = 3) => {
  const gr = g.createRadialGradient(x, y, r * 0.3, x, y, r * halo);
  gr.addColorStop(0, rgba(c, 0.9)); gr.addColorStop(0.3, rgba(c, 0.35)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * halo, 0, Math.PI * 2); g.fill();
  g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
};
const ciel_etoile = (g, R, n, h = SOL) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rgba('#ffffff', 0.3 + R() * 0.7);
    const r = R() < 0.1 ? 1.6 : 0.8;
    g.beginPath(); g.arc(R() * L, R() * h, r, 0, Math.PI * 2); g.fill();
  }
};

const DECORS = {
  dojo(g, a, R) {
    soleil(g, 700, 250, 70, '#ffcf6a', 3.2);
    montagnes(g, 400, 160, '#3a1a0c', R, 70);
    montagnes(g, 440, 90, '#2a1206', R, 50);
    // La pagode.
    g.fillStyle = '#1a0a04';
    for (let i = 0; i < 4; i++) {
      const w = 150 - i * 28; const y = 400 - i * 52;
      g.fillRect(200 - w / 2 + 14, y - 40, w - 28, 40);
      g.beginPath(); g.moveTo(200 - w / 2 - 22, y - 36); g.quadraticCurveTo(200, y - 70, 200 + w / 2 + 22, y - 36); g.lineTo(200 + w / 2, y - 30); g.lineTo(200 - w / 2, y - 30); g.fill();
    }
    // Le torii.
    g.fillStyle = '#7a0a00';
    g.fillRect(760, 300, 14, 170); g.fillRect(880, 300, 14, 170);
    g.beginPath(); g.moveTo(735, 295); g.quadraticCurveTo(827, 280, 920, 295); g.lineTo(915, 308); g.lineTo(740, 308); g.fill();
    g.fillRect(750, 325, 155, 10);
    // Les lanternes.
    for (const x of [90, 330, 640]) {
      g.strokeStyle = '#1a0a04'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 300); g.stroke();
      soleil(g, x, 320, 16, '#ff6a2a', 2.2);
    }
  },
  neon(g, a, R) {
    ciel_etoile(g, R, 60, 200);
    for (let couche = 0; couche < 3; couche++) {
      const c = ['#0a0f2e', '#070b22', '#04061a'][couche];
      let x = -20;
      while (x < L) {
        const w = 50 + R() * 80; const h = 120 + R() * (220 - couche * 40) + couche * 40;
        g.fillStyle = c; g.fillRect(x, SOL - h, w, h);
        for (let wy = SOL - h + 10; wy < SOL - 10; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          if (R() < 0.35) { g.fillStyle = rgba(R() < 0.5 ? '#ffd27a' : '#7ad8ff', 0.4 + couche * 0.15); g.fillRect(wx, wy, 6, 8); }
        }
        x += w + R() * 10;
      }
    }
    // Les enseignes.
    const neon = (x, y, texte, c) => {
      g.save(); g.font = '900 34px "Arial Black", sans-serif'; g.shadowColor = c; g.shadowBlur = 22; g.fillStyle = c; g.fillText(texte, x, y); g.restore();
    };
    neon(110, 210, 'ARCADE', '#ff2a8a');
    neon(640, 170, '格闘', '#2ad8ff');
    neon(780, 280, 'K.O.', '#ffe02a');
  },
  volcan(g, a, R) {
    soleil(g, 520, 250, 30, '#ff8a2a', 6);
    g.fillStyle = '#1a0202';
    g.beginPath(); g.moveTo(240, SOL); g.lineTo(440, 170); g.lineTo(560, 165); g.lineTo(780, SOL); g.fill();
    const lave = g.createLinearGradient(0, 165, 0, 400);
    lave.addColorStop(0, '#ffd23a'); lave.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = lave;
    g.beginPath(); g.moveTo(450, 170); g.lineTo(550, 168); g.lineTo(520, 380); g.lineTo(480, 380); g.fill();
    montagnes(g, SOL, 120, '#280404', R, 40);
    // Rivières de lave au sol.
    g.strokeStyle = '#ff6a10'; g.lineWidth = 3; g.shadowColor = '#ff4000'; g.shadowBlur = 10;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(R() * L, SOL + 10); g.bezierCurveTo(R() * L, SOL + 40, R() * L, SOL + 80, R() * L, H); g.stroke(); }
    g.shadowBlur = 0;
  },
  toundra(g, a, R) {
    ciel_etoile(g, R, 160, 330);
    montagnes(g, 420, 230, '#2a4a6a', R, 80);
    g.fillStyle = '#e6f4ff';
    // Neige sur les sommets.
    montagnes(g, 330, 140, rgba('#e6f4ff', 0.25), R, 80);
    montagnes(g, 460, 110, '#1a3450', R, 50);
    // Sapins.
    for (let i = 0; i < 18; i++) {
      const x = R() * L; const h = 40 + R() * 50; const y = SOL;
      g.fillStyle = '#0a1a2a';
      g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - h * 0.3, y); g.lineTo(x + h * 0.3, y); g.fill();
      g.fillStyle = rgba('#ffffff', 0.6); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - h * 0.1, y - h * 0.7); g.lineTo(x + h * 0.1, y - h * 0.7); g.fill();
    }
  },
  ruines(g, a, R) {
    soleil(g, 250, 300, 60, '#ffd27a', 3.5);
    montagnes(g, 440, 80, '#4a2a0a', R, 60);
    g.fillStyle = '#5a3a14';
    for (const x of [120, 300, 680, 860]) {
      const h = 160 + R() * 120;
      g.fillRect(x, SOL - h, 34, h);
      g.fillRect(x - 8, SOL - h - 12, 50, 14);
      g.fillStyle = rgba('#000000', 0.25); g.fillRect(x + 24, SOL - h, 10, h); g.fillStyle = '#5a3a14';
    }
    g.beginPath(); g.arc(780, SOL - 230, 85, Math.PI, 0); g.lineTo(865, SOL - 230); g.lineTo(845, SOL - 230); g.arc(780, SOL - 230, 65, 0, Math.PI, true); g.closePath(); g.fill();
  },
  station(g, a, R) {
    ciel_etoile(g, R, 260, SOL);
    // La planète.
    const p = g.createRadialGradient(720, 200, 20, 760, 230, 170);
    p.addColorStop(0, '#5aa0ff'); p.addColorStop(0.6, '#1a4aa0'); p.addColorStop(1, '#020420');
    g.fillStyle = p; g.beginPath(); g.arc(760, 230, 150, 0, Math.PI * 2); g.fill();
    g.strokeStyle = rgba('#c8a0ff', 0.5); g.lineWidth = 4; g.beginPath(); g.ellipse(760, 230, 230, 36, -0.3, 0, Math.PI * 2); g.stroke();
    // Le hublot (les montants de la station).
    g.fillStyle = '#14142a';
    g.fillRect(0, 0, L, 40);
    for (const x of [0, 330, 660, 990]) g.fillRect(x - 10, 0, 24, SOL);
    g.fillRect(0, 360, L, 18);
    g.fillStyle = '#c864ff'; for (const x of [12, 342, 672]) g.fillRect(x, 50, 3, 290);
  },
  jungle(g, a, R) {
    for (let couche = 0; couche < 3; couche++) {
      const c = ['#0a3a12', '#06280a', '#031a06'][couche];
      for (let i = 0; i < 9; i++) {
        const x = R() * L; const h = 220 + R() * 200 - couche * 30;
        g.fillStyle = teinte(c, -0.3); g.fillRect(x - 8 - couche * 2, SOL - h, 16 + couche * 4, h);
        g.fillStyle = c;
        for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + (R() - 0.5) * 100, SOL - h + (R() - 0.5) * 50, 60 + R() * 40, 30 + R() * 20, 0, 0, Math.PI * 2); g.fill(); }
      }
    }
    // Les fougères au premier plan.
    g.fillStyle = '#0e4a14';
    for (let i = 0; i < 14; i++) { const x = R() * L; g.beginPath(); g.ellipse(x, SOL, 40, 18, 0, Math.PI, Math.PI * 2); g.fill(); }
  },
  abysses(g, a, R) {
    // Les rayons de lumière.
    for (let i = 0; i < 6; i++) {
      const x = 80 + i * 170 + R() * 40;
      const gr = g.createLinearGradient(0, 0, 0, SOL);
      gr.addColorStop(0, rgba('#9ae6ff', 0.18)); gr.addColorStop(1, rgba('#9ae6ff', 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 50, 0); g.lineTo(x + 140, SOL); g.lineTo(x + 40, SOL); g.fill();
    }
    montagnes(g, SOL, 110, '#00182e', R, 50);
    // Coraux.
    for (let i = 0; i < 10; i++) {
      const x = R() * L; const c = R() < 0.5 ? '#ff6a8a' : '#ffb04a';
      g.strokeStyle = c; g.lineWidth = 5; g.lineCap = 'round';
      for (let b = 0; b < 4; b++) { g.beginPath(); g.moveTo(x, SOL); g.quadraticCurveTo(x + (R() - 0.5) * 40, SOL - 30, x + (R() - 0.5) * 50, SOL - 40 - R() * 30); g.stroke(); }
    }
  },
  celeste(g, a, R) {
    soleil(g, 820, 120, 50, '#fff6c8', 4);
    for (let i = 0; i < 9; i++) {
      const x = R() * L; const y = 60 + R() * 260;
      g.fillStyle = rgba('#ffffff', 0.7);
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + k * 26 - 50, y + Math.sin(k) * 8, 26 + R() * 14, 0, Math.PI * 2); g.fill(); }
    }
    // Les îles flottantes et leurs flèches dorées.
    for (const [x, y] of [[180, 260], [520, 200], [840, 300]]) {
      g.fillStyle = '#c8b48a'; g.beginPath(); g.moveTo(x - 70, y); g.lineTo(x + 70, y); g.lineTo(x, y + 60); g.fill();
      g.fillStyle = '#f0e6c8'; g.fillRect(x - 40, y - 80, 80, 80);
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(x - 46, y - 80); g.lineTo(x, y - 140); g.lineTo(x + 46, y - 80); g.fill();
    }
  },
  desert(g, a, R) {
    soleil(g, 500, 280, 110, '#ffd26a', 2.2);
    g.fillStyle = '#a0601a';
    g.beginPath(); g.moveTo(0, 420); g.quadraticCurveTo(250, 330, 500, 410); g.quadraticCurveTo(750, 340, L, 400); g.lineTo(L, SOL); g.lineTo(0, SOL); g.fill();
    g.fillStyle = '#7a4a10';
    g.beginPath(); g.moveTo(0, 450); g.quadraticCurveTo(300, 400, 600, 455); g.quadraticCurveTo(820, 420, L, 450); g.lineTo(L, SOL); g.lineTo(0, SOL); g.fill();
    // Cactus et crânes.
    g.fillStyle = '#2a3a10';
    for (const x of [140, 820]) { g.fillRect(x, 360, 18, 110); g.fillRect(x - 24, 390, 24, 12); g.fillRect(x - 24, 370, 12, 30); g.fillRect(x + 18, 400, 22, 12); g.fillRect(x + 30, 380, 12, 30); }
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(420, SOL - 6, 10, 0, Math.PI * 2); g.fill();
  },
  foret(g, a, R) {
    for (let couche = 0; couche < 3; couche++) {
      for (let i = 0; i < 8; i++) {
        const x = R() * L; const h = 280 + R() * 150;
        g.strokeStyle = ['#0e1a0c', '#0a1408', '#050c04'][couche]; g.lineWidth = 14 + couche * 6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, SOL); g.bezierCurveTo(x + 30, SOL - h * 0.4, x - 40, SOL - h * 0.7, x + 10, SOL - h); g.stroke();
        g.lineWidth = 5;
        for (let b = 0; b < 4; b++) { const by = SOL - h * (0.5 + b * 0.12); g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x + (R() - 0.5) * 120, by - 40, x + (R() - 0.5) * 160, by - 20); g.stroke(); }
      }
    }
    const brume = g.createLinearGradient(0, 300, 0, SOL);
    brume.addColorStop(0, 'rgba(120,80,160,0)'); brume.addColorStop(1, 'rgba(120,80,160,0.35)');
    g.fillStyle = brume; g.fillRect(0, 300, L, SOL - 300);
  },
  cathedrale(g, a, R) {
    // Les vitraux.
    for (const x of [130, 400, 600, 870]) {
      g.fillStyle = '#4a3410'; g.fillRect(x - 60, 60, 120, 260);
      const cols = ['#ff5a5a', '#5aa0ff', '#ffd23f', '#7aff8a', '#c87aff'];
      for (let i = 0; i < 12; i++) { g.fillStyle = rgba(cols[i % 5], 0.75); g.fillRect(x - 52 + (i % 3) * 35, 70 + Math.floor(i / 3) * 60, 32, 56); }
      g.beginPath(); g.arc(x, 60, 60, Math.PI, 0); g.fillStyle = '#4a3410'; g.fill();
      g.fillStyle = rgba('#ffe680', 0.8); g.beginPath(); g.arc(x, 60, 48, Math.PI, 0); g.fill();
    }
    // Les piliers.
    g.fillStyle = '#c8a860';
    for (const x of [20, 265, 500, 735, 980]) { g.fillRect(x - 18, 0, 36, SOL); g.fillStyle = rgba('#000', 0.15); g.fillRect(x + 6, 0, 12, SOL); g.fillStyle = '#c8a860'; }
  },
  trone(g, a, R) {
    soleil(g, 500, 230, 40, '#ff2010', 5);
    // Le trône.
    g.fillStyle = '#0a0000';
    g.beginPath(); g.moveTo(420, SOL - 40); g.lineTo(420, 160); g.lineTo(450, 120); g.lineTo(480, 160); g.lineTo(500, 90); g.lineTo(520, 160); g.lineTo(550, 120); g.lineTo(580, 160); g.lineTo(580, SOL - 40); g.closePath(); g.fill();
    g.fillStyle = '#c80014'; g.beginPath(); g.arc(500, 200, 10, 0, Math.PI * 2); g.fill();
    // Les chaînes.
    g.strokeStyle = '#2a0a0a'; g.lineWidth = 4;
    for (const x of [100, 260, 740, 900]) { for (let y = 0; y < 300; y += 16) { g.beginPath(); g.ellipse(x + Math.sin(y / 40) * 6, y, 5, 8, 0, 0, Math.PI * 2); g.stroke(); } }
    montagnes(g, SOL, 90, '#1a0000', R, 40);
  },
  zero(g, a, R) {
    ciel_etoile(g, R, 90, SOL);
    // Des rochers qui flottent.
    for (let i = 0; i < 7; i++) {
      const x = R() * L; const y = 80 + R() * 260; const r = 14 + R() * 30;
      g.fillStyle = '#120818'; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r * 0.4, y - r * 0.6); g.lineTo(x + r, y - r * 0.2); g.lineTo(x + r * 0.3, y + r); g.closePath(); g.fill();
      g.strokeStyle = rgba('#c814ff', 0.5); g.lineWidth = 1.5; g.stroke();
    }
    // L'horizon rouge.
    const h = g.createLinearGradient(0, 360, 0, SOL);
    h.addColorStop(0, 'rgba(200,20,0,0)'); h.addColorStop(1, 'rgba(200,20,0,0.5)');
    g.fillStyle = h; g.fillRect(0, 360, L, SOL - 360);
  },
};

/* ------------------------------------------------------------------ */
/* Ce qui bouge                                                        */
/* ------------------------------------------------------------------ */

/** Les particules du décor : pétales, pluie, braises, neige, bulles… */
export function animerArene(g, a, t) {
  const R = alea(1234);
  switch (a.id) {
    case 'dojo':
      for (let i = 0; i < 26; i++) {
        const x = (R() * L + t * (0.6 + R())) % L; const y = (R() * H + t * (0.8 + R() * 0.6)) % SOL;
        g.fillStyle = rgba('#ffb6d0', 0.8); g.beginPath(); g.ellipse(x, y, 4, 2.4, t / 20 + i, 0, Math.PI * 2); g.fill();
      }
      break;
    case 'neon':
      g.strokeStyle = 'rgba(160,200,255,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 90; i++) { const x = (R() * L + t * 2) % L; const y = (R() * H + t * 18) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 14); g.stroke(); }
      // Le reflet des enseignes sur le sol mouillé.
      for (const [x, c, a] of [[190, '#ff2a8a', 0.16 + Math.sin(t / 15) * 0.05], [690, '#2ad8ff', 0.14], [830, '#ffe02a', 0.1]]) {
        const r = g.createRadialGradient(x, SOL + 30, 4, x, SOL + 30, 110);
        r.addColorStop(0, rgba(c, a)); r.addColorStop(1, rgba(c, 0));
        g.fillStyle = r; g.fillRect(x - 110, SOL, 220, 130);
      }
      break;
    case 'volcan': case 'trone':
      for (let i = 0; i < 40; i++) {
        const x = (R() * L + Math.sin(t / 30 + i) * 20) % L; const v = (t * (0.6 + R()) + R() * H) % H; const y = H - v;
        g.fillStyle = rgba(R() < 0.5 ? '#ffb000' : '#ff4000', 0.8 * (1 - v / H)); g.beginPath(); g.arc(x, y, 1.5 + R() * 2, 0, Math.PI * 2); g.fill();
      }
      if (a.id === 'trone') for (const x of [60, 940]) feuPilier(g, x, t);
      break;
    case 'toundra': {
      // L'aurore.
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = rgba(k === 1 ? '#7affc8' : '#5ad8ff', 0.18); g.lineWidth = 26 - k * 6;
        g.beginPath();
        for (let x = 0; x <= L; x += 20) g.lineTo(x, 90 + k * 26 + Math.sin(x / 120 + t / 60 + k) * 26);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 70; i++) { const x = (R() * L + Math.sin(t / 40 + i) * 30) % L; const y = (R() * H + t * (0.7 + R())) % H; g.beginPath(); g.arc(x, y, 1 + R() * 2, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'ruines': case 'desert':
      for (let i = 0; i < 40; i++) { const x = (R() * L + t * (1.5 + R() * 2)) % L; const y = 300 + R() * 200; g.fillStyle = rgba('#ffe0a0', 0.35); g.fillRect(x, y, 2, 1.5); }
      break;
    case 'station':
      for (let i = 0; i < 5; i++) { const on = Math.floor(t / 20 + i) % 3 === 0; g.fillStyle = on ? '#ff3a3a' : '#5a1a1a'; g.beginPath(); g.arc(80 + i * 200, 30, 4, 0, Math.PI * 2); g.fill(); }
      break;
    case 'jungle': case 'foret':
      for (let i = 0; i < 24; i++) {
        const x = (R() * L + Math.sin(t / 50 + i) * 40) % L; const y = 200 + R() * 260 + Math.cos(t / 40 + i) * 20;
        const v = 0.5 + Math.sin(t / 10 + i * 2) * 0.5;
        g.fillStyle = rgba(a.id === 'foret' ? '#b4ff5a' : '#e6ff7a', v * 0.8); g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
      }
      if (a.id === 'foret') {
        for (let i = 0; i < 4; i++) {
          if (Math.floor(t / 90 + i * 3) % 5 === 0) continue;
          const x = 80 + i * 260; const y = 260 + (i % 2) * 60;
          g.fillStyle = '#ffde3a'; g.beginPath(); g.ellipse(x, y, 4, 2, 0, 0, Math.PI * 2); g.ellipse(x + 14, y, 4, 2, 0, 0, Math.PI * 2); g.fill();
        }
      }
      break;
    case 'abysses':
      for (let i = 0; i < 30; i++) {
        const x = R() * L + Math.sin(t / 25 + i) * 10; const y = H - ((t * (0.5 + R()) + R() * H) % H);
        g.strokeStyle = rgba('#c8f4ff', 0.5); g.lineWidth = 1; g.beginPath(); g.arc(x, y, 2 + R() * 4, 0, Math.PI * 2); g.stroke();
      }
      // Les algues.
      g.strokeStyle = '#0e5a3a'; g.lineWidth = 7; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const x = 40 + i * 130; g.beginPath(); g.moveTo(x, SOL); g.quadraticCurveTo(x + Math.sin(t / 30 + i) * 30, SOL - 70, x + Math.sin(t / 25 + i) * 20, SOL - 130); g.stroke(); }
      break;
    case 'celeste':
      for (let i = 0; i < 3; i++) {
        const x = ((t * 0.3 + i * 400) % (L + 300)) - 150; const y = 360 + i * 30;
        g.fillStyle = rgba('#ffffff', 0.5);
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 30, y, 22, 0, Math.PI * 2); g.fill(); }
      }
      break;
    case 'cathedrale':
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const x of [130, 400, 600, 870]) {
        const gr = g.createLinearGradient(x, 60, x + 120, SOL);
        gr.addColorStop(0, rgba('#fff2a8', 0.16 + Math.sin(t / 40 + x) * 0.04)); gr.addColorStop(1, rgba('#fff2a8', 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 50, 80); g.lineTo(x + 50, 80); g.lineTo(x + 180, SOL); g.lineTo(x + 20, SOL); g.fill();
      }
      g.restore();
      break;
    case 'zero': {
      // Des fissures de lumière qui s'ouvrent dans le vide.
      const k = Math.floor(t / 70);
      const Rk = alea(k * 31 + 7);
      const x = Rk() * L; const y = 80 + Rk() * 260; const v = Math.sin(((t % 70) / 70) * Math.PI);
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ff50ff', v * 0.8); g.lineWidth = 2.5; g.shadowColor = '#c814ff'; g.shadowBlur = 16;
      g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 6; i++) g.lineTo(x + (Rk() - 0.5) * 120, y + (Rk() - 0.5) * 80); g.stroke();
      g.restore();
      for (let i = 0; i < 4; i++) etoile(g, (R() * L + t * 0.2) % L, R() * 300, 2 + R() * 2, '#e8d4ff', t / 30 + i);
      break;
    }
    default: break;
  }
}

function feuPilier(g, x, t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) {
    const v = (t * 2 + i * 9) % 90;
    g.fillStyle = rgba(i % 2 ? '#ff7a00' : '#ff2a00', 0.4 * (1 - v / 90));
    g.beginPath(); g.arc(x + Math.sin(t / 5 + i) * 8, SOL - v * 3, 18 - v / 8, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
