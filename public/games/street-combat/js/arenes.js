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
  { id: 'horloge', nom: 'HORS DU TEMPS', ciel: ['#02080c', '#06202a', '#0c3a44', '#14505a'], sol: '#1a3a40', sol2: '#0a2228', deco: '#4fe0d0', deco2: '#ffd23f', boss: 'kairos' },
  { id: 'ring', nom: 'GRAND RING', ciel: ['#05030a', '#0e0818', '#1a0e24', '#24102a'], sol: '#2a2a6a', sol2: '#1a1a4a', deco: '#ffd23f', deco2: '#d8102a', boss: 'onyx' },
  { id: 'sommet', nom: 'SOMMET DE LA TOUR', ciel: ['#03040e', '#0a1030', '#1a2a5a', '#3a4a7a'], sol: '#4a4a5a', sol2: '#2a2a36', deco: '#c0d8ff', deco2: '#ffffff', boss: 'nemesis' },
  { id: 'neonfeu', nom: 'NÉON CITY EN FLAMMES', ciel: ['#140000', '#3a0806', '#7a1a0a', '#c8501a'], sol: '#1a0a08', sol2: '#2a0c08', deco: '#ff5a1a', deco2: '#ffc83a' },
  { id: 'dojopluie', nom: 'LE DOJO SOUS LA PLUIE', ciel: ['#05080e', '#0e1620', '#1a2430', '#2a3440'], sol: '#2a2420', sol2: '#1a1612', deco: '#8aa0c0', deco2: '#c8d8f0' },
  { id: 'engrenages', nom: 'AU CŒUR DE L’HORLOGE', ciel: ['#0a0804', '#1a1408', '#2a2010', '#3a2c14'], sol: '#2a2418', sol2: '#14100a', deco: '#ffd23f', deco2: '#4fe0d0' },
  { id: 'citadelle', nom: 'CITADELLE DE L’HORLOGE', ciel: ['#1a0804', '#4a1a0a', '#a04a14', '#e89040'], sol: '#4a3420', sol2: '#2a1c10', deco: '#e8a030', deco2: '#ffd23f', boss: 'vorn' },
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

/** Un engrenage. */
function engrenage(g, x, y, r, dents, c) {
  g.fillStyle = c;
  g.beginPath();
  for (let i = 0; i < dents * 2; i++) {
    const a = (i / (dents * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.15;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
}

const DECORS = {
  horloge(g, a, R) {
    ciel_etoile(g, R, 80, SOL);
    // De grands engrenages dans la brume.
    engrenage(g, 140, 180, 110, 14, 'rgba(79,224,208,0.12)');
    engrenage(g, 860, 120, 80, 12, 'rgba(255,210,63,0.12)');
    engrenage(g, 760, 360, 60, 10, 'rgba(79,224,208,0.15)');
    // L'horloge géante, au fond.
    g.strokeStyle = 'rgba(255,210,63,0.5)'; g.lineWidth = 8;
    g.beginPath(); g.arc(L / 2, 220, 150, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(6,32,42,0.6)'; g.fill();
    g.strokeStyle = 'rgba(255,210,63,0.6)'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(L / 2 + Math.cos(an) * 120, 220 + Math.sin(an) * 120); g.lineTo(L / 2 + Math.cos(an) * 140, 220 + Math.sin(an) * 140); g.stroke(); }
    // Les marches de pierre flottantes.
    g.fillStyle = '#0e2a30';
    for (let i = 0; i < 6; i++) g.fillRect(40 + i * 160, 400 - (i % 3) * 30, 90, 14);
  },
  ring(g, a, R) {
    // La foule, dans le noir.
    for (let rang = 0; rang < 4; rang++) {
      for (let i = 0; i < 40; i++) {
        const x = i * 26 + (rang % 2) * 13; const y = 250 + rang * 32;
        g.fillStyle = `rgba(${40 + rang * 12},${30 + rang * 8},${60 + rang * 10},1)`;
        g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
        g.fillRect(x - 13, y + 8, 26, 30);
      }
    }
    // L'écran géant et les banderoles.
    g.fillStyle = '#0a0a14'; g.fillRect(360, 60, 280, 120);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 4; g.strokeRect(360, 60, 280, 120);
    g.save(); g.font = '900 46px Impact, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.shadowColor = '#ffd23f'; g.shadowBlur = 18;
    g.fillText('CHAMPION', 500, 135); g.restore();
    // Les cordes du ring.
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = ['#d8102a', '#f0f0f0', '#1a4ad8'][i]; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, SOL - 40 - i * 32); g.lineTo(L, SOL - 40 - i * 32); g.stroke();
    }
    g.fillStyle = '#c8c8d8'; g.fillRect(20, SOL - 140, 16, 140); g.fillRect(L - 36, SOL - 140, 16, 140);
  },
  sommet(g, a, R) {
    ciel_etoile(g, R, 200, 300);
    soleil(g, 800, 120, 46, '#eef4ff', 3);
    // Les nuages, en contrebas.
    for (let i = 0; i < 14; i++) {
      const x = R() * L; const y = 330 + R() * 90;
      g.fillStyle = rgba('#c8d4f0', 0.35 + R() * 0.2);
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 28, y + Math.sin(k) * 6, 26 + R() * 14, 0, Math.PI * 2); g.fill(); }
    }
    // Les créneaux de la tour.
    g.fillStyle = '#3a3a4a';
    g.fillRect(0, SOL - 40, L, 40);
    for (let x = 0; x < L; x += 70) g.fillRect(x, SOL - 70, 40, 34);
    g.fillStyle = 'rgba(192,216,255,0.25)';
    for (let x = 0; x < L; x += 70) g.fillRect(x, SOL - 70, 40, 4);
  },
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
  /* Néon City après l'attaque de l'armée : la ville brûle. */
  neonfeu(g, a, R) {
    DECORS.neon(g, a, R);
    const lueur = g.createLinearGradient(0, 0, 0, SOL);
    lueur.addColorStop(0, 'rgba(60,0,0,0.35)'); lueur.addColorStop(1, 'rgba(255,90,20,0.35)');
    g.fillStyle = lueur; g.fillRect(0, 0, L, SOL);
    // La fumée, en grands panaches noirs.
    for (let i = 0; i < 9; i++) {
      const x = R() * L; const y = 60 + R() * 200;
      g.fillStyle = 'rgba(10,6,6,0.45)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 30, y - k * 18, 40 + R() * 30, 0, Math.PI * 2); g.fill(); }
    }
  },
  /* Le dojo, un soir de deuil : la pluie. */
  dojopluie(g, a, R) {
    DECORS.dojo(g, a, R);
    g.fillStyle = 'rgba(10,20,40,0.55)'; g.fillRect(0, 0, L, SOL);
  },
  /* Au cœur de l'horloge : des engrenages partout (ils tournent : voir animerArene). */
  engrenages(g, a, R) {
    ciel_etoile(g, R, 40, SOL);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,210,63,0.06)'; g.fillRect(i * 180, 0, 30, SOL); }
  },
  citadelle(g, a, R) {
    soleil(g, 780, 300, 90, '#ffb050', 2.4);
    // Les remparts de la citadelle, au loin, et sa grande horloge.
    g.fillStyle = '#2a140a';
    g.fillRect(120, 230, 760, 200);
    for (let x = 120; x < 880; x += 40) g.fillRect(x, 214, 24, 18);
    for (const x of [100, 840]) { g.fillRect(x, 150, 80, 280); for (let i = 0; i < 3; i++) g.fillRect(x + i * 30, 132, 20, 20); }
    g.fillStyle = '#3a1e0e'; g.fillRect(420, 120, 160, 310);
    g.fillStyle = '#e8a030'; g.beginPath(); g.arc(500, 200, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a140a'; g.beginPath(); g.arc(500, 200, 48, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(500 + Math.cos(an) * 38, 200 + Math.sin(an) * 38); g.lineTo(500 + Math.cos(an) * 46, 200 + Math.sin(an) * 46); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(500, 200); g.lineTo(500, 166); g.moveTo(500, 200); g.lineTo(524, 210); g.stroke();
    // La porte, et les rangs de soldats devant les murs.
    g.fillStyle = '#120804'; g.beginPath(); g.moveTo(450, 430); g.lineTo(450, 340); g.quadraticCurveTo(500, 300, 550, 340); g.lineTo(550, 430); g.fill();
    for (let rang = 0; rang < 2; rang++) {
      for (let i = 0; i < 26; i++) {
        const x = 20 + i * 38 + rang * 19; const y = 440 + rang * 14;
        if (x > 430 && x < 570) continue;
        g.fillStyle = rang ? '#1a0e06' : '#24140a';
        g.fillRect(x - 7, y - 40, 14, 30); g.beginPath(); g.arc(x, y - 46, 8, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#6a5030'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 9, y - 10); g.lineTo(x + 12, y - 80); g.stroke();
        g.fillStyle = 'rgba(122,216,208,0.8)'; g.fillRect(x - 3, y - 48, 7, 2);
      }
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
    case 'neonfeu':
      // Des flammes au pied des immeubles, des braises qui montent.
      for (let i = 0; i < 14; i++) {
        const x = (i * 77 + 30) % L; const h = 40 + Math.sin(t / 5 + i) * 14 + (i % 3) * 18;
        const gr = g.createLinearGradient(0, SOL - h - 20, 0, SOL);
        gr.addColorStop(0, 'rgba(255,200,60,0)'); gr.addColorStop(0.5, 'rgba(255,110,20,0.55)'); gr.addColorStop(1, 'rgba(255,60,10,0.75)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 26, SOL); g.quadraticCurveTo(x - 10 + Math.sin(t / 4 + i) * 8, SOL - h, x, SOL - h - 20); g.quadraticCurveTo(x + 10, SOL - h, x + 26, SOL); g.fill();
      }
      for (let i = 0; i < 50; i++) { const x = (R() * L + Math.sin(t / 30 + i) * 20) % L; const y = SOL - ((t * (1 + R() * 2) + R() * SOL) % SOL); g.fillStyle = rgba('#ffa040', 0.6); g.fillRect(x, y, 2, 2); }
      break;
    case 'dojopluie':
      g.strokeStyle = 'rgba(170,200,240,0.45)'; g.lineWidth = 1.2;
      for (let i = 0; i < 140; i++) { const x = (R() * L + t * 3) % L; const y = (R() * H + t * 22) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 18); g.stroke(); }
      // Les éclaboussures sur le sol.
      for (let i = 0; i < 12; i++) { const x = (R() * L + t * 7) % L; const r = (t + i * 11) % 20; g.strokeStyle = rgba('#c8d8f0', 0.5 * (1 - r / 20)); g.beginPath(); g.ellipse(x, SOL + 20 + (i % 4) * 25, r, r * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
      break;
    case 'engrenages':
      // De grands engrenages qui tournent lentement, d'autres plus vite.
      for (const [x, y, r, d, v, c] of [[140, 160, 120, 16, 0.004, 'rgba(255,210,63,0.22)'], [430, 90, 70, 12, -0.007, 'rgba(79,224,208,0.2)'], [700, 200, 150, 20, 0.003, 'rgba(255,210,63,0.18)'], [900, 80, 60, 10, -0.01, 'rgba(255,210,63,0.25)'], [560, 330, 50, 9, 0.012, 'rgba(79,224,208,0.22)']]) {
        g.save(); g.translate(x, y); g.rotate(t * v); engrenage(g, 0, 0, r, d, c); g.restore();
      }
      g.strokeStyle = 'rgba(255,210,63,0.4)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 380); g.lineTo(L, 380); g.stroke();
      break;
    case 'citadelle':
      // Les étendards de l'Horloge qui claquent au vent, et la poussière.
      for (const x of [140, 860, 300, 700]) {
        g.fillStyle = '#5a1a0a'; g.fillRect(x - 2, 90, 4, 140);
        g.fillStyle = '#c8501a';
        g.beginPath(); g.moveTo(x + 2, 96);
        for (let k = 0; k <= 6; k++) g.lineTo(x + 2 + k * 10, 96 + Math.sin(t / 6 + k * 0.8 + x) * 4);
        for (let k = 6; k >= 0; k--) g.lineTo(x + 2 + k * 10, 146 + Math.sin(t / 6 + k * 0.8 + x) * 4);
        g.fill();
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + 32, 121 + Math.sin(t / 6 + 2.4 + x) * 4, 9, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 40; i++) { const x = (R() * L + t * (1.5 + R() * 2)) % L; const y = 300 + R() * 200; g.fillStyle = rgba('#ffc080', 0.3); g.fillRect(x, y, 2, 1.5); }
      break;
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
    case 'horloge':
      // Des grains de sable qui remontent le temps.
      for (let i = 0; i < 40; i++) {
        const x = (R() * L + Math.sin(t / 40 + i) * 20) % L; const v = (t * (0.4 + R() * 0.5) + R() * H) % H;
        g.fillStyle = rgba(i % 3 ? '#4fe0d0' : '#ffd23f', 0.6 * (1 - v / H)); g.fillRect(x, H - v, 2, 2);
      }
      break;
    case 'ring':
      // Les projecteurs qui balaient la foule, les flashs.
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x0, vit] of [[200, 1], [800, -1.3]]) {
        const cible = L / 2 + Math.sin(t / 60 * vit) * 300;
        const gr = g.createLinearGradient(x0, 0, cible, SOL);
        gr.addColorStop(0, 'rgba(255,248,200,0.3)'); gr.addColorStop(1, 'rgba(255,248,200,0.02)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 14, 0); g.lineTo(x0 + 14, 0); g.lineTo(cible + 80, SOL); g.lineTo(cible - 80, SOL); g.fill();
      }
      for (let i = 0; i < 8; i++) if ((t + i * 13) % 47 < 2) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(30 + i * 125, 250 + (i % 4) * 30, 6, 0, Math.PI * 2); g.fill(); }
      g.restore();
      break;
    case 'sommet':
      for (let i = 0; i < 20; i++) {
        const x = (R() * L + t * (1 + R() * 2)) % L; const y = 100 + R() * 330;
        g.strokeStyle = 'rgba(220,230,255,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 40, y); g.stroke();
      }
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

/* ------------------------------------------------------------------ */
/* Les murs qu'on brise, et la zone d'à côté                           */
/* ------------------------------------------------------------------ */

/** Derrière chaque mur, une autre zone : le dojo donne sur son jardin sous la pluie, le ring sur la rue… */
export const SUITE = {
  dojo: 'dojopluie', dojopluie: 'dojo', neon: 'neonfeu', neonfeu: 'neon', citadelle: 'desert', desert: 'citadelle',
  ruines: 'foret', foret: 'ruines', volcan: 'trone', trone: 'volcan', station: 'celeste', celeste: 'cathedrale',
  cathedrale: 'celeste', jungle: 'ruines', toundra: 'abysses', abysses: 'jungle', ring: 'neon', horloge: 'engrenages',
  engrenages: 'horloge', sommet: 'celeste', zero: 'horloge',
};
/** L'arène où l'on se bat, après avoir brisé `etage` murs depuis celle du départ. */
export function areneApres(depart, etage = 0) {
  let id = depart;
  for (let i = 0; i < etage; i++) id = SUITE[id] || id;
  return ARENE[id] || ARENE.dojo;
}

/** Les deux murs, au bord de l'arène : plus ils ont pris de chocs, plus ils se fendent. */
export function dessinerMurs(g, a, murs, pvMax, t) {
  for (const cote of [0, 1]) {
    const degats = pvMax - murs[cote];
    const x0 = cote === 0 ? 0 : L - 26;
    g.save();
    const gr = g.createLinearGradient(x0, 0, x0 + 26, 0);
    const c = teinte(a.sol2, 0.12);
    gr.addColorStop(cote === 0 ? 0 : 1, teinte(c, -0.25)); gr.addColorStop(cote === 0 ? 1 : 0, c);
    g.fillStyle = gr;
    g.fillRect(x0, SOL - 300, 26, 300);
    // Les briques.
    g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = 1;
    for (let rang = 0, y = SOL - 300; y < SOL; rang += 1, y += 22) {
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 26, y); g.stroke();
      const dx = (rang % 2) * 13;
      g.beginPath(); g.moveTo(x0 + dx, y); g.lineTo(x0 + dx, y + 22); g.stroke();
    }
    g.fillStyle = rgba(a.deco, 0.7); g.fillRect(cote === 0 ? x0 + 23 : x0, SOL - 300, 3, 300);
    // Les fissures, et la lumière de l'autre côté qui passe à travers.
    if (degats > 0) {
      const xm = cote === 0 ? x0 + 24 : x0 + 2;
      g.strokeStyle = rgba('#120a04', 0.9); g.lineWidth = 2;
      for (let i = 0; i < degats * 3; i++) {
        const y = SOL - 60 - ((i * 53) % 220);
        g.beginPath(); g.moveTo(xm, y);
        for (let s = 1; s <= 4; s++) g.lineTo(xm + (cote === 0 ? -1 : 1) * s * 5, y + Math.sin(i * 7 + s) * 14);
        g.stroke();
      }
      if (degats >= pvMax - 1) {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = rgba(a.deco2, 0.25 + Math.sin(t / 5) * 0.12);
        g.fillRect(cote === 0 ? x0 + 6 : x0 + 4, SOL - 200, 16, 140);
      }
    }
    g.restore();
  }
}
