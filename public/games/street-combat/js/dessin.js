/**
 * STREET COMBAT — le dessin des combattants.
 *
 * Un squelette (hanches, buste, tête, bras et jambes en deux segments) que
 * chaque pose plie à sa façon, habillé selon l'allure du combattant :
 * coiffure, capuche, casque, ailes, cape, faux, katana… Les membres de
 * derrière sont un peu plus sombres, pour la profondeur.
 *
 * Tout est en coordonnées du combattant : les pieds en (0, 0), l'avant vers
 * la droite (le dessin se retourne selon le sens du regard).
 */

const rad = (d) => (d * Math.PI) / 180;
/** Un point au bout d'un segment : l'angle part du bas, positif vers l'avant. */
const bout = (p, angle, l) => ({ x: p.x + Math.sin(rad(angle)) * l, y: p.y + Math.cos(rad(angle)) * l });
const melange = (a, b, t) => a + (b - a) * t;
const doux = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));

/** Assombrit (ou éclaircit) une couleur #rrggbb. */
export function teinte(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** La carrure : taille, largeur des épaules, épaisseur des membres. */
const CARRURES = {
  normal: { h: 1, l: 1, m: 1 },
  fin: { h: 0.98, l: 0.86, m: 0.84 },
  massif: { h: 1.04, l: 1.24, m: 1.22 },
  geant: { h: 1.16, l: 1.38, m: 1.36 },
};

/* ------------------------------------------------------------------ */
/* Les poses                                                           */
/* ------------------------------------------------------------------ */

/*
 * Une pose : penché du buste (b), tête (tt), bras avant (av: épaule, coude),
 * bras arrière (ar), jambe avant (ja: hanche, genou), jambe arrière (jr),
 * hauteur des hanches (dy, positif = plus bas), rotation du corps entier (rot).
 */
const GARDE = { b: 6, tt: 0, av: [55, -105], ar: [30, -115], ja: [16, -10], jr: [-16, 14], dy: 2, rot: 0 };

function poseDe(nom, t, p = 0) {
  const s = Math.sin(t / 9);
  switch (nom) {
    case 'repos': return { ...GARDE, dy: 2 + s * 1.6, av: [55 + s * 3, -105], ar: [30 + s * 2, -115] };
    case 'marche': {
      const m = Math.sin(t / 4.2);
      return { ...GARDE, b: 9, ja: [m * 26, -Math.max(0, -m) * 30 - 6], jr: [-m * 26, -Math.max(0, m) * 30 - 6], dy: 3 - Math.abs(m) * 3 };
    }
    case 'saut': return { ...GARDE, b: 8, ja: [55, -95], jr: [20, -85], av: [70, -100], ar: [45, -90], dy: 0 };
    case 'accroupi': return { ...GARDE, b: 18, ja: [80, -125], jr: [-10, -110], dy: 34 };
    case 'garde': return { ...GARDE, b: -4, av: [62, -130], ar: [52, -128], tt: 6, ja: [12, -8], jr: [-20, 18] };
    case 'garde-bas': return { ...GARDE, b: 14, av: [70, -130], ar: [58, -128], ja: [80, -125], jr: [-10, -110], dy: 34, tt: 6 };
    case 'poing': {
      const e = doux(p * 1.6);
      return { ...GARDE, b: melange(6, 16, e), av: [melange(55, 92, e), melange(-105, 0, e)], ar: [melange(30, -10, e), -120], ja: [24, -8], jr: [-24, 16] };
    }
    case 'pied': {
      const e = doux(p * 1.5);
      return { ...GARDE, b: melange(6, -18, e), ja: [melange(16, 98, e), melange(-10, 0, e)], jr: [-12, 8], av: [40, -110], ar: [-20, -60] };
    }
    case 'poing-bas': {
      const e = doux(p * 1.6);
      return { ...GARDE, b: 20, ja: [80, -125], jr: [-10, -110], dy: 34, av: [melange(55, 88, e), melange(-105, -4, e)] };
    }
    case 'balayage': {
      const e = doux(p * 1.4);
      return { ...GARDE, b: 30, dy: 52, ja: [melange(60, 88, e), melange(-120, 0, e)], jr: [-30, -120], av: [20, -40], ar: [-50, -30] };
    }
    case 'poing-air': return { ...GARDE, b: 20, ja: [55, -95], jr: [20, -85], av: [118, 0], ar: [20, -110] };
    case 'pied-air': return { ...GARDE, b: -10, ja: [70, 0], jr: [10, -100], av: [60, -120], ar: [-30, -60] };
    case 'touche': return { ...GARDE, b: -24, tt: -18, av: [-10, -40], ar: [-40, -20], ja: [26, -16], jr: [-26, 10] };
    case 'vol': return { ...GARDE, b: -30, tt: -20, av: [-80, -20], ar: [-120, -10], ja: [40, -30], jr: [10, -50], rot: -40 };
    case 'sol': case 'ko': return { ...GARDE, b: 0, tt: -10, av: [-150, 0], ar: [-170, -20], ja: [5, -5], jr: [-5, 10], rot: -90, sol: true };
    case 'victoire': return { ...GARDE, b: -4, tt: -6, av: [172, -20 + s * 10], ar: [40, -120], ja: [14, -4], jr: [-14, 4] };
    case 'saisie': return { ...GARDE, b: 16, av: [84, -25], ar: [76, -40], ja: [26, -10], jr: [-26, 14] };
    case 'lance': {
      const e = doux(p * 1.5);
      return { ...GARDE, b: melange(0, 14, e), av: [melange(30, 88, e), melange(-120, -6, e)], ar: [melange(20, 78, e), melange(-120, -18, e)], ja: [30, -12], jr: [-30, 16], dy: 6 };
    }
    case 'ruee': return { ...GARDE, b: 32, av: [96, -6], ar: [-30, -90], ja: [50, -60], jr: [-50, 10] };
    case 'uppercut': return { ...GARDE, b: -6, av: [172, -6], ar: [-10, -100], ja: [70, -110], jr: [-6, 6], dy: 0 };
    case 'tourne': return { ...GARDE, b: 0, av: [100, -20], ar: [-100, -20], ja: [92, 0], jr: [-10, -30], rot: (t * 30) % 360 };
    case 'ulti': return { ...GARDE, b: -8, tt: -10, av: [140, -30], ar: [130, -40], ja: [34, -6], jr: [-34, 6], dy: 6 + s };
    default: return GARDE;
  }
}

/* ------------------------------------------------------------------ */
/* Le combattant                                                       */
/* ------------------------------------------------------------------ */

/**
 * Dessine un combattant.
 * @param {CanvasRenderingContext2D} g
 * @param {object} perso    la fiche (persos.js)
 * @param {object} o        { x, y, dir, pose, t, p (progression du coup 0..1), echelle, alpha, aura, statuts, eclat, ombre, corrompu }
 */
/*
 * L'éclat d'un coup et la teinte du gel ne doivent colorer que le
 * combattant : on le dessine d'abord à part, sur une petite toile, qu'on
 * colle ensuite à sa place.
 */
const TAMPON = { l: 440, h: 440, x: 220, y: 380, r: 2 };
let tampon = null;

export function dessinerCombattant(g, perso, o) {
  const teinter = !o.__tampon && (o.ombre || o.eclat > 0.02 || (o.statuts && (o.statuts.gel || o.statuts.lenteur)));
  if (teinter && typeof document !== 'undefined') {
    if (!tampon) {
      tampon = document.createElement('canvas');
      tampon.width = TAMPON.l * TAMPON.r;
      tampon.height = TAMPON.h * TAMPON.r;
    }
    const b = tampon.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, tampon.width, tampon.height);
    b.setTransform(TAMPON.r, 0, 0, TAMPON.r, 0, 0);
    dessinerCombattant(b, perso, { ...o, x: TAMPON.x, y: TAMPON.y, alpha: 1, sansOmbre: true, __tampon: true });
    b.globalCompositeOperation = 'source-atop';
    if (o.statuts?.gel || o.statuts?.lenteur) { b.fillStyle = o.statuts.gel ? 'rgba(140,220,255,0.4)' : 'rgba(170,120,255,0.35)'; b.fillRect(0, 0, TAMPON.l, TAMPON.h); }
    // Une silhouette : on ne voit que sa forme.
    if (o.ombre) { b.fillStyle = 'rgba(6,3,14,0.94)'; b.fillRect(0, 0, TAMPON.l, TAMPON.h); }
    if (o.eclat > 0.02) { b.fillStyle = `rgba(255,255,255,${Math.min(1, o.eclat)})`; b.fillRect(0, 0, TAMPON.l, TAMPON.h); }
    b.globalCompositeOperation = 'source-over';
    // L'ombre au sol, puis le combattant teinté.
    if (!o.sansOmbre) {
      g.save(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(o.x, o.y + 2, 38 * (o.echelle || 1), 8, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    g.save();
    if (o.alpha !== undefined) g.globalAlpha = o.alpha;
    g.drawImage(tampon, o.x - TAMPON.x, o.y - TAMPON.y, TAMPON.l, TAMPON.h);
    g.restore();
    return;
  }
  const k = perso.c;
  const L = perso.look;
  const car = CARRURES[L.corps] || CARRURES.normal;
  const e = (o.echelle || 1) * car.h;
  const pose = poseDe(o.pose || 'repos', o.t || 0, o.p || 0);
  const t = o.t || 0;

  g.save();
  g.translate(o.x, o.y);
  if (o.alpha !== undefined) g.globalAlpha = o.alpha;
  g.scale(o.dir < 0 ? -e : e, e);

  // L'ombre au sol.
  if (!o.sansOmbre) {
    g.save();
    g.scale(o.dir < 0 ? -1 : 1, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(0, 2, 38 * car.l, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Les membres, par cinématique directe.
  const cuisse = 36;
  const tibia = 37;
  const brasH = 27;
  const avantBras = 27;
  let hanche = { x: 0, y: -(cuisse + tibia) + (pose.dy || 0) };
  const pieds = (h) => {
    const ka = bout(h, pose.ja[0], cuisse); const fa = bout(ka, pose.ja[0] + pose.ja[1], tibia);
    const kr = bout(h, pose.jr[0], cuisse); const fr = bout(kr, pose.jr[0] + pose.jr[1], tibia);
    return { ka, fa, kr, fr };
  };
  let jambes = pieds(hanche);
  // Au sol : les pieds touchent terre.
  if (!o.enLAir && !pose.sol) {
    const bas = Math.max(jambes.fa.y, jambes.fr.y);
    hanche = { x: hanche.x, y: hanche.y - bas };
    jambes = pieds(hanche);
  }
  const buste = (l) => bout(hanche, 180 + pose.b, l);
  const epaule = buste(46);
  const cou = buste(52);
  const tete = bout(hanche, 180 + pose.b + (pose.tt || 0) * 0.3, 68);
  const epA = { x: epaule.x + 4, y: epaule.y + 2 };
  const epR = { x: epaule.x - 5, y: epaule.y + 1 };
  const coudeA = bout(epA, pose.av[0], brasH); const mainA = bout(coudeA, pose.av[0] + pose.av[1], avantBras);
  const coudeR = bout(epR, pose.ar[0], brasH); const mainR = bout(coudeR, pose.ar[0] + pose.ar[1], avantBras);

  // Rotation du corps entier (vol, à terre, tourbillon), autour des hanches.
  if (pose.rot) {
    const cx = hanche.x;
    const cy = pose.sol ? -14 : hanche.y;
    g.translate(cx, cy);
    g.rotate(rad(pose.rot));
    g.translate(-cx, pose.sol ? -hanche.y - 6 : -cy);
  }

  const m = car.m;
  const l = car.l;
  const ombre = (c) => teinte(c, -0.28);
  const sombre = (c) => teinte(c, -0.12);

  // L'aura (jauge pleine, ultime).
  if (o.aura) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const r = 90 + Math.sin(t / 5) * 8;
    const grad = g.createRadialGradient(0, -80, 10, 0, -80, r);
    grad.addColorStop(0, rgba(k.aura, 0.4 * o.aura));
    grad.addColorStop(1, rgba(k.aura, 0));
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(0, -80, r * 0.7, r, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // Corrompu par la Fracture : des flammes violettes et noires qui montent derrière lui.
  if (o.corrompu) corruptionDerriere(g, t);

  const membre = (a, b, c, ep, couleur, ep2 = ep * 0.86) => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = couleur;
    g.lineWidth = ep;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    g.lineWidth = ep2;
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(c.x, c.y); g.stroke();
  };
  const poing = (p, couleur, r = 7.5) => {
    g.fillStyle = couleur;
    g.beginPath(); g.arc(p.x, p.y, r * m, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath(); g.arc(p.x - 2, p.y - 2, r * m * 0.45, 0, Math.PI * 2); g.fill();
  };
  const pied = (p, genou, couleur) => {
    const a = Math.atan2(p.y - genou.y, p.x - genou.x) - Math.PI / 2;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(a * 0.2);
    g.fillStyle = couleur;
    g.beginPath();
    g.roundRect(-6 * m, -5, 18 * m, 9, 4);
    g.fill();
    g.restore();
  };

  const pantalon = L.extras.includes('robe') || L.extras.includes('jupe') ? k.peau : k.tenue;
  const chaussure = L.tete === 'rocher' ? teinte(k.peau, -0.3) : teinte(k.tenue, -0.55);

  /* ---- derrière le corps : cape, ailes, queue, armes dans le dos ---- */
  arriere(g, perso, { hanche, epaule, cou, t, l, m, pose, e: o });

  /* ---- jambe et bras de derrière ---- */
  membre(hanche, jambes.kr, jambes.fr, 15 * m, ombre(pantalon), 13 * m);
  pied(jambes.fr, jambes.kr, ombre(chaussure));
  if (L.extras.includes('general')) genouillere(g, jambes.kr, m, true);
  membre(epR, coudeR, mainR, 11 * m, ombre(manche(perso)), 10 * m);
  const gros = L.extras.includes('gants-boxe') ? 11.5 : 7.5;
  poing(mainR, ombre(gant(perso)), gros);
  armeArriere(g, perso, mainR, coudeR, o, t);

  /* ---- le buste ---- */
  const largeur = 22 * l;
  const taille = 15 * l;
  g.save();
  g.translate(hanche.x, hanche.y);
  g.rotate(rad(pose.b));
  const gradB = g.createLinearGradient(-largeur, 0, largeur, 0);
  // Torse nu (le boxeur) : la peau, et les muscles.
  const nu = L.extras.includes('torse-nu');
  const haut = nu ? k.peau : k.tenue;
  gradB.addColorStop(0, sombre(haut));
  gradB.addColorStop(0.5, haut);
  gradB.addColorStop(1, ombre(haut));
  g.fillStyle = gradB;
  g.beginPath();
  g.moveTo(-taille, 4);
  g.lineTo(taille, 4);
  g.quadraticCurveTo(largeur + 3, -26, largeur, -48);
  g.quadraticCurveTo(0, -56, -largeur, -48);
  g.quadraticCurveTo(-largeur - 3, -26, -taille, 4);
  g.fill();
  torse(g, perso, { largeur, taille, t, l });
  if (o.corrompu) corruptionTorse(g, t, largeur);
  if (nu) {
    g.strokeStyle = teinte(k.peau, -0.3); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -44); g.lineTo(0, -12); g.moveTo(-9, -36); g.quadraticCurveTo(0, -31, 9, -36);
    g.moveTo(-7, -26); g.lineTo(7, -26); g.moveTo(-6, -18); g.lineTo(6, -18); g.stroke();
  }
  // La ceinture.
  g.fillStyle = k.ceinture;
  g.beginPath(); g.roundRect(-taille - 1, -6, (taille + 1) * 2, 9, 3); g.fill();
  g.fillStyle = teinte(k.ceinture, -0.25);
  g.beginPath(); g.moveTo(taille - 4, 2); g.lineTo(taille + 4, 14); g.lineTo(taille - 1, 14); g.closePath(); g.fill();
  if (L.extras.includes('ceinture-champion')) {
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.ellipse(0, -2, 11, 8, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6400'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#d8102a'; g.beginPath(); g.arc(0, -2, 3.5, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  // Jupe, robe, haori : par-dessus les jambes.
  if (L.extras.includes('robe') || L.extras.includes('jupe') || L.extras.includes('haori')) {
    g.fillStyle = L.extras.includes('haori') ? teinte(k.tenue, 0.08) : k.tenue;
    const long = L.extras.includes('robe') ? 46 : L.extras.includes('haori') ? 30 : 24;
    g.beginPath();
    g.moveTo(hanche.x - 16 * l, hanche.y - 4);
    g.lineTo(hanche.x + 16 * l, hanche.y - 4);
    g.lineTo(hanche.x + 24 * l + Math.sin(t / 7) * 2, hanche.y + long);
    g.lineTo(hanche.x - 22 * l + Math.sin(t / 6) * 2, hanche.y + long);
    g.closePath(); g.fill();
    g.strokeStyle = k.c1; g.lineWidth = 2;
    g.beginPath(); g.moveTo(hanche.x + 24 * l, hanche.y + long); g.lineTo(hanche.x - 22 * l, hanche.y + long); g.stroke();
  }

  /* ---- la tête ---- */
  // Le cou (le ninja le cache sous son masque).
  g.strokeStyle = L.tete === 'ninja' ? teinte(k.c2, -0.55) : k.peau;
  g.lineWidth = 9 * m;
  g.beginPath(); g.moveTo(cou.x, cou.y); g.lineTo(tete.x, tete.y + 8); g.stroke();
  dessinerTete(g, perso, tete.x, tete.y, { t, regard: o.pose, touche: ['touche', 'vol', 'ko', 'sol'].includes(o.pose), ko: o.pose === 'ko', rot: pose.b + (pose.tt || 0), m, corrompu: o.corrompu });

  /* ---- jambe et bras de devant ---- */
  membre(hanche, jambes.ka, jambes.fa, 16 * m, pantalon, 14 * m);
  pied(jambes.fa, jambes.ka, chaussure);
  if (L.extras.includes('general')) genouillere(g, jambes.ka, m);
  epaulieres(g, perso, epaule, l, t);
  membre(epA, coudeA, mainA, 12 * m, manche(perso), 11 * m);
  if (L.extras.includes('canon')) canon(g, coudeA, mainA, k);
  poing(mainA, gant(perso), gros);
  armeAvant(g, perso, mainA, coudeA, o, t);
  devant(g, perso, { hanche, epaule, mainA, mainR, t, l, m });

  // Les statuts : du feu, du venin, du givre.
  if (o.statuts) statutsVisibles(g, o.statuts, t, hanche);
  if (o.corrompu) eclatsFlottants(g, t);
  g.restore();
}

/* ------------------------------------------------------------------ */
/* La corruption de la Fracture                                        */
/* ------------------------------------------------------------------ */

const VIOLET = '#c814ff';

/** Derrière lui : un halo malade, des flammes violettes et noires. */
function corruptionDerriere(g, t) {
  g.save();
  const r = 104 + Math.sin(t / 4) * 10;
  // Une ombre noire d'abord, puis la lueur.
  const noir = g.createRadialGradient(0, -80, 10, 0, -80, r);
  noir.addColorStop(0, 'rgba(20,0,30,0.35)'); noir.addColorStop(1, 'rgba(20,0,30,0)');
  g.fillStyle = noir; g.beginPath(); g.ellipse(0, -80, r * 0.8, r, 0, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(0, -80, 10, 0, -80, r);
  gr.addColorStop(0, 'rgba(200,20,255,0.3)'); gr.addColorStop(0.6, 'rgba(120,0,200,0.16)'); gr.addColorStop(1, 'rgba(80,0,140,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, -80, r * 0.75, r, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 7; i++) {
    const x = -38 + i * 12.5 + Math.sin(t / 7 + i) * 4;
    const h = 60 + ((t * 1.6 + i * 23) % 56);
    const base = -6 - (i % 3) * 22;
    g.fillStyle = i % 2 ? 'rgba(255,60,255,0.26)' : 'rgba(140,20,230,0.32)';
    g.beginPath(); g.moveTo(x - 9, base);
    g.quadraticCurveTo(x - 6 + Math.sin(t / 5 + i) * 6, base - h * 0.6, x + Math.sin(t / 4 + i) * 8, base - h);
    g.quadraticCurveTo(x + 6, base - h * 0.5, x + 9, base); g.fill();
  }
  g.restore();
}

/** Sur la poitrine : l'éclat planté, et les veines violettes qui en partent. */
function corruptionTorse(g, t, largeur) {
  const p = 0.6 + Math.sin(t / 6) * 0.4;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = `rgba(255,80,255,${0.5 + p * 0.4})`; g.lineWidth = 1.7; g.lineCap = 'round';
  g.shadowColor = VIOLET; g.shadowBlur = 8;
  const veines = [[[-6, -36], [-12, -40], [-17, -47]], [[8, -28], [13, -21], [largeur - 4, -15]], [[0, -24], [-6, -14], [-11, 0]], [[3, -36], [10, -44], [6, -52]], [[-5, -28], [-largeur + 5, -24]]];
  for (const v of veines) { g.beginPath(); g.moveTo(1, -31); for (const [x, y] of v) g.lineTo(x, y); g.stroke(); }
  const halo = g.createRadialGradient(1, -31, 0, 1, -31, 18);
  halo.addColorStop(0, `rgba(255,120,255,${0.8 * p})`); halo.addColorStop(1, 'rgba(200,20,255,0)');
  g.shadowBlur = 0;
  g.fillStyle = halo; g.beginPath(); g.arc(1, -31, 18, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = '#e070ff'; g.strokeStyle = '#ffe6ff'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(1, -41); g.lineTo(6, -31); g.lineTo(1, -21); g.lineTo(-4, -31); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath(); g.moveTo(0, -38); g.lineTo(2, -32); g.lineTo(-1, -32); g.closePath(); g.fill();
}

/** Autour de lui : de petits éclats qui tournent. */
function eclatsFlottants(g, t) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const a = t / 22 + (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * 46;
    const y = -86 + Math.sin(a) * 60;
    const devant = Math.sin(a) > 0;
    g.fillStyle = rgba(devant ? '#ff7aff' : '#9a30ff', devant ? 0.9 : 0.5);
    g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 3, y); g.lineTo(x, y + 6); g.lineTo(x - 3, y); g.closePath(); g.fill();
  }
  g.restore();
}

/** Les genouillères dorées du Général. */
function genouillere(g, k, m, derriere = false) {
  g.fillStyle = derriere ? '#a07a20' : '#ffd23f';
  g.beginPath(); g.ellipse(k.x + 2, k.y, 7.5 * m, 6 * m, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = derriere ? '#5a4410' : '#8a5a10';
  g.beginPath(); g.moveTo(k.x + 8 * m, k.y - 3); g.lineTo(k.x + 15 * m, k.y); g.lineTo(k.x + 8 * m, k.y + 3); g.fill();
}
const manche = (p) => (p.figurant || p.look.extras.includes('general') || ['ironclad', 'stoneback', 'lechaos', 'malvortex', 'shadowkira', 'voidreaper'].includes(p.id) ? p.c.tenue : p.c.peau);
const gant = (p) => (p.look.extras.includes('gants-boxe') ? '#d8102a' : p.look.extras.includes('griffes') ? teinte(p.c.peau, -0.2) : p.id === 'stoneback' ? teinte(p.c.peau, -0.15) : p.c.c1);

/* ------------------------------------------------------------------ */
/* La tête                                                             */
/* ------------------------------------------------------------------ */

export function dessinerTete(g, perso, x, y, o = {}) {
  const k = perso.c;
  const L = perso.look;
  const t = o.t || 0;
  const r = 15;
  g.save();
  g.translate(x, y);
  g.rotate(rad((o.rot || 0) * 0.35));

  // Derrière la tête : cheveux longs, couettes, capuche.
  if (L.tete === 'longs') {
    g.fillStyle = k.cheveux;
    g.beginPath();
    g.moveTo(-14, -10);
    g.quadraticCurveTo(-30 + Math.sin(t / 8) * 3, 20, -22 + Math.sin(t / 7) * 4, 46);
    g.quadraticCurveTo(-6, 30, 4, 4);
    g.closePath(); g.fill();
  }
  if (L.tete === 'couettes') {
    g.fillStyle = k.cheveux;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(-4 + s * 15, 4 + Math.sin(t / 8 + s) * 2, 7, 18, rad(s * 20), 0, Math.PI * 2);
      g.fill();
    }
  }
  if (L.tete === 'capuche') {
    g.fillStyle = teinte(k.tenue, 0.08);
    g.beginPath();
    g.moveTo(-22, 22); g.quadraticCurveTo(-26, -24, 2, -26); g.quadraticCurveTo(26, -22, 20, 10); g.lineTo(14, 22); g.closePath();
    g.fill();
  }

  // Le faucheur : un crâne sous une capuche en lambeaux.
  if (L.tete === 'crane') {
    crane(g, k, o);
    g.restore();
    return;
  }
  // Némésis : un masque de miroir, sans visage.
  if (L.tete === 'miroir') {
    const m = g.createLinearGradient(-14, -16, 16, 16);
    m.addColorStop(0, '#ffffff'); m.addColorStop(0.35, '#b8cdf0'); m.addColorStop(0.55, '#f4f8ff'); m.addColorStop(1, '#5a6aa8');
    g.fillStyle = m;
    g.beginPath(); g.ellipse(1, -1, 15, 17, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-8, -12); g.lineTo(2, 8); g.moveTo(-2, -15); g.lineTo(7, 2); g.stroke();
    g.strokeStyle = '#3a4a7a'; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(1, -1, 15, 17, 0, 0, Math.PI * 2); g.stroke();
    if (!o.ko) { lueur(g, 9, -2, 4, k.c2); g.fillStyle = '#ffffff'; g.fillRect(4, -3, 11, 2); }
    // Une couronne d'éclats.
    for (let i = 0; i < 5; i++) {
      const a = rad(-150 + i * 30);
      g.fillStyle = i % 2 ? '#e6f2ff' : '#a8c4e8';
      g.beginPath(); g.moveTo(Math.cos(a) * 15, -1 + Math.sin(a) * 17); g.lineTo(Math.cos(a) * 26, -1 + Math.sin(a) * 28); g.lineTo(Math.cos(a + 0.12) * 16, -1 + Math.sin(a + 0.12) * 18); g.fill();
    }
    g.restore();
    return;
  }

  // Les soldats de l'Horloge : un heaume fermé, une fente qui luit, une horloge au front.
  if (L.tete === 'heaume') {
    const general = L.extras.includes('general');
    if (general) {
      // Le long panache rouge, qui flotte derrière le heaume.
      const v = Math.sin(t / 6) * 3;
      g.fillStyle = '#a00a20';
      g.beginPath(); g.moveTo(-2, -24);
      g.quadraticCurveTo(-26, -34 + v, -50, -10 + v * 2); g.quadraticCurveTo(-40, -6 + v, -30, 4 + v * 2);
      g.quadraticCurveTo(-22, -12, -8, -14); g.closePath(); g.fill();
      g.fillStyle = '#d8203a';
      g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(-22, -30 + v, -42, -12 + v * 2); g.quadraticCurveTo(-22, -18, -6, -16); g.closePath(); g.fill();
    }
    const m = g.createLinearGradient(-14, -18, 14, 18);
    m.addColorStop(0, teinte(k.tenue, 0.55)); m.addColorStop(0.5, teinte(k.tenue, 0.25)); m.addColorStop(1, teinte(k.tenue, -0.25));
    g.fillStyle = m;
    g.beginPath(); g.moveTo(-15, 14); g.quadraticCurveTo(-18, -20, 2, -19); g.quadraticCurveTo(20, -18, 17, 6); g.lineTo(14, 17); g.lineTo(-10, 18); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.stroke();
    // La fente des yeux.
    g.fillStyle = '#05080a'; g.fillRect(-2, -5, 18, 5);
    if (!o.ko) { const c = o.corrompu ? '#ff40ff' : k.c1; lueur(g, 8, -2.5, 4, c); g.fillStyle = rgba(c, 0.95); g.fillRect(0, -4, 14, 2.4); }
    // Les grilles de la bouche.
    g.strokeStyle = teinte(k.tenue, -0.4); g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(3 + i * 3.5, 4); g.lineTo(3 + i * 3.5, 12); g.stroke(); }
    // L'horloge au front.
    g.fillStyle = k.ceinture; g.beginPath(); g.arc(4, -12, 4.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1206'; g.lineWidth = 1; g.beginPath(); g.moveTo(4, -12); g.lineTo(4, -15); g.moveTo(4, -12); g.lineTo(6.4, -12); g.stroke();
    if (general) {
      // Les bords dorés, les ailes sur les tempes, le cimier d'or.
      g.strokeStyle = '#ffd23f'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-15, 14); g.quadraticCurveTo(-18, -20, 2, -19); g.quadraticCurveTo(20, -18, 17, 6); g.lineTo(14, 17); g.stroke();
      g.fillStyle = '#e8a030';
      g.beginPath(); g.moveTo(-10, -4); g.lineTo(-30, -20); g.lineTo(-24, -6); g.lineTo(-32, -2); g.lineTo(-12, 4); g.closePath(); g.fill();
      g.strokeStyle = '#8a5a10'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#ffd23f';
      // Le cimier : une crête d'or dressée sur le sommet du heaume.
      g.beginPath(); g.moveTo(-12, -14); g.quadraticCurveTo(-8, -34, 6, -36); g.quadraticCurveTo(4, -28, 12, -18); g.quadraticCurveTo(0, -22, -12, -14); g.closePath(); g.fill();
      g.strokeStyle = '#8a5a10'; g.lineWidth = 1; g.stroke();
      // La bande d'or sur le front, avec ses rivets.
      g.fillStyle = '#ffd23f'; g.fillRect(-14, -9, 31, 2.6);
      g.fillStyle = '#8a5a10'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-11 + i * 6.5, -7.7, 0.9, 0, Math.PI * 2); g.fill(); }
    }
    // Le plumet des officiers.
    if (L.extras.includes('plumet')) {
      g.fillStyle = k.c1;
      g.beginPath(); g.moveTo(-2, -18); g.quadraticCurveTo(-16, -40 + Math.sin(t / 6) * 2, -30, -28); g.quadraticCurveTo(-16, -30, -8, -16); g.fill();
    }
    g.restore();
    return;
  }

  // Le visage.
  const grad = g.createRadialGradient(-4, -6, 3, 0, 0, r + 4);
  grad.addColorStop(0, teinte(k.peau, 0.18));
  grad.addColorStop(1, teinte(k.peau, -0.18));
  g.fillStyle = grad;
  g.beginPath();
  if (L.tete === 'rocher') {
    g.moveTo(-15, -10); g.lineTo(-6, -17); g.lineTo(10, -16); g.lineTo(17, -4); g.lineTo(15, 12); g.lineTo(2, 17); g.lineTo(-13, 12); g.closePath();
  } else {
    g.ellipse(0, 0, r, r + 1.5, 0, 0, Math.PI * 2);
  }
  g.fill();
  // La mâchoire, un peu en avant.
  g.fillStyle = teinte(k.peau, -0.05);
  g.beginPath(); g.ellipse(5, 8, 9, 7, 0, 0, Math.PI * 2); g.fill();

  // Les yeux.
  const luisants = o.corrompu || L.extras.includes('yeux-luisants') || L.tete === 'capuche';
  if (L.extras.includes('oeil-rouge') && !o.corrompu) {
    lueur(g, 7, -2, 6, '#ff2020');
    g.fillStyle = '#ffdddd'; g.beginPath(); g.ellipse(7, -2, 4, 2.4, 0, 0, Math.PI * 2); g.fill();
  } else if (luisants) {
    const c = o.corrompu ? '#ff40ff' : k.c1;
    lueur(g, 3, -2, 5, c); lueur(g, 11, -2, 5, c);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(3, -2, 3, 1.6, 0, 0, Math.PI * 2); g.ellipse(11, -2, 3, 1.6, 0, 0, Math.PI * 2); g.fill();
  } else if (o.ko) {
    g.strokeStyle = '#222'; g.lineWidth = 1.8;
    for (const ex of [3, 11]) { g.beginPath(); g.moveTo(ex - 3, -5); g.lineTo(ex + 3, 1); g.moveTo(ex + 3, -5); g.lineTo(ex - 3, 1); g.stroke(); }
  } else {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(3, -2, 3.6, 3, 0, 0, Math.PI * 2); g.ellipse(11, -2, 3.4, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = o.touche ? '#552222' : L.tete === 'ninja' ? k.c1 : '#111';
    g.beginPath(); g.arc(4.4, -1.6, 1.8, 0, Math.PI * 2); g.arc(12.2, -1.6, 1.7, 0, Math.PI * 2); g.fill();
    // Les sourcils, froncés.
    g.strokeStyle = teinte(k.cheveux, -0.3); g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(7, -5.5); g.moveTo(9, -5.5); g.lineTo(15, -7.5); g.stroke();
  }
  // La bouche.
  g.strokeStyle = 'rgba(60,20,20,0.8)'; g.lineWidth = 1.6;
  g.beginPath();
  if (o.touche) { g.ellipse(9, 9, 3, 2.4, 0, 0, Math.PI * 2); } else { g.moveTo(5, 9); g.lineTo(12, 8); }
  g.stroke();

  // Une longue barbe blanche.
  if (L.extras.includes('barbe')) {
    g.fillStyle = k.cheveux;
    g.beginPath();
    g.moveTo(-6, 6); g.quadraticCurveTo(6, 4, 16, 6);
    g.quadraticCurveTo(14, 26, 4 + Math.sin(t / 9) * 2, 38); g.quadraticCurveTo(-2, 24, -6, 6); g.fill();
    g.strokeStyle = teinte(k.cheveux, -0.2); g.lineWidth = 1;
    g.beginPath(); g.moveTo(5, 12); g.lineTo(5, 28); g.moveTo(10, 10); g.lineTo(9, 24); g.stroke();
  }

  // Le ninja : un masque sur le bas du visage.
  if (L.tete === 'ninja') {
    g.save();
    g.beginPath(); g.ellipse(0, 0, r + 0.5, r + 2, 0, 0, Math.PI * 2); g.ellipse(5, 8, 9.5, 7.5, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = teinte(k.c2, -0.55);
    g.fillRect(-22, 3, 44, 24);
    g.strokeStyle = rgba(k.c1, 0.55); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-14, 8); g.quadraticCurveTo(4, 6, 16, 9); g.moveTo(-12, 13); g.quadraticCurveTo(4, 12, 15, 14); g.stroke();
    g.restore();
  }

  // Le dessus de la tête.
  coiffure(g, perso, t);
  g.restore();
}

/** Le crâne du faucheur, sa capuche déchirée, ses orbites qui luisent. */
function crane(g, k, o) {
  const capuche = teinte(k.tenue, 0.14);
  // La capuche, derrière, au bas en lambeaux.
  g.fillStyle = capuche;
  g.beginPath();
  g.moveTo(-24, 24); g.quadraticCurveTo(-31, -30, 2, -31); g.quadraticCurveTo(31, -27, 25, 8);
  for (let i = 0; i <= 6; i++) g.lineTo(24 - i * 8, 26 + (i % 2 ? 9 : 0));
  g.closePath(); g.fill();
  // Le crâne.
  const os = g.createRadialGradient(0, -7, 2, 3, 0, 19);
  os.addColorStop(0, '#fffaf0'); os.addColorStop(1, '#a89c86');
  g.fillStyle = os;
  g.beginPath(); g.ellipse(3, -3, 14, 14.5, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.roundRect(-2, 6, 14, 10, 3); g.fill();
  // Les orbites, et ce qui luit au fond.
  g.fillStyle = '#0a0010';
  g.beginPath(); g.ellipse(3, -2, 4.4, 5, 0.2, 0, Math.PI * 2); g.ellipse(12, -2, 3.8, 4.8, -0.2, 0, Math.PI * 2); g.fill();
  if (!o.ko) {
    lueur(g, 3.5, -1.5, 3.6, k.c1); lueur(g, 12, -1.5, 3.4, k.c1);
    g.fillStyle = '#f2d8ff';
    g.beginPath(); g.arc(3.5, -1.5, 1.4, 0, Math.PI * 2); g.arc(12, -1.5, 1.3, 0, Math.PI * 2); g.fill();
  }
  // Le nez, les dents.
  g.fillStyle = '#0a0010';
  g.beginPath(); g.moveTo(8, 3); g.lineTo(6.3, 7); g.lineTo(9.7, 7); g.closePath(); g.fill();
  g.strokeStyle = '#5a5040'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 11); g.lineTo(12, 11);
  for (let x = 1; x <= 11; x += 2.5) { g.moveTo(x, 8.5); g.lineTo(x, 14); }
  g.stroke();
  // Le bord de la capuche, qui tombe sur le front.
  g.fillStyle = capuche;
  g.beginPath();
  g.moveTo(-19, 16); g.quadraticCurveTo(-24, -24, 2, -26); g.quadraticCurveTo(24, -24, 21, -9);
  g.quadraticCurveTo(10, -18, -4, -13); g.quadraticCurveTo(-13, -3, -12, 16); g.closePath(); g.fill();
}

function lueur(g, x, y, r, c) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
  gr.addColorStop(0, rgba(c, 0.9));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r * 2.4, 0, Math.PI * 2); g.fill();
  g.restore();
}

function coiffure(g, p, t) {
  const k = p.c;
  const L = p.look;
  g.fillStyle = k.cheveux;
  switch (L.tete) {
    case 'bandeau': {
      g.beginPath(); g.ellipse(-2, -10, 16, 9, 0, Math.PI, Math.PI * 2); g.fill();
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-14 + i * 6, -12); g.lineTo(-10 + i * 6, -22 - (i % 2) * 3); g.lineTo(-6 + i * 6, -12); g.fill(); }
      g.fillStyle = k.ceinture;
      g.fillRect(-15, -12, 30, 6);
      if (L.extras.includes('bandeau-long')) {
        g.beginPath(); g.moveTo(-14, -11);
        g.quadraticCurveTo(-28, -10 + Math.sin(t / 5) * 4, -38, -4 + Math.sin(t / 4) * 6);
        g.lineTo(-36, 0 + Math.sin(t / 4) * 6); g.quadraticCurveTo(-26, -4, -14, -7); g.fill();
      }
      break;
    }
    case 'pics': {
      for (let i = 0; i < 6; i++) {
        const h = 22 + (i % 3) * 7 + Math.sin(t / 3 + i) * 3;
        g.fillStyle = i % 2 ? k.cheveux : teinte(k.cheveux, 0.3);
        g.beginPath(); g.moveTo(-16 + i * 6, -8); g.lineTo(-18 + i * 6 - 4, -8 - h); g.lineTo(-10 + i * 6, -10); g.fill();
      }
      break;
    }
    case 'cristaux': {
      g.beginPath(); g.ellipse(0, -9, 16, 8, 0, Math.PI, Math.PI * 2); g.fill();
      for (let i = 0; i < 5; i++) {
        g.fillStyle = rgba('#e6faff', 0.9);
        const h = 14 + (i === 2 ? 10 : i % 2 ? 4 : 7);
        g.beginPath(); g.moveTo(-12 + i * 6, -13); g.lineTo(-9 + i * 6, -13 - h); g.lineTo(-6 + i * 6, -13); g.fill();
      }
      break;
    }
    case 'rase': {
      // Le crâne rasé, qui brille ; une cicatrice.
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(-3, -11, 7, 3, -0.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = teinte(k.peau, -0.4); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(9, -10); g.lineTo(13, -4); g.stroke();
      g.fillStyle = k.cheveux;
      g.beginPath(); g.ellipse(9, 13, 6, 2.5, 0, 0, Math.PI); g.fill();
      break;
    }
    case 'ninja': {
      // Des mèches en pointe, le bandeau et ses deux pans qui flottent.
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? k.cheveux : teinte(k.cheveux, 0.25);
        g.beginPath(); g.moveTo(-15 + i * 6, -9); g.lineTo(-19 + i * 5, -27 - (i % 3) * 4); g.lineTo(-8 + i * 6, -11); g.fill();
      }
      g.fillStyle = k.c1;
      g.fillRect(-15, -11, 31, 6);
      g.fillStyle = '#d8d8e8';
      g.beginPath(); g.roundRect(4, -10.5, 8, 5, 1.5); g.fill();
      g.fillStyle = k.c1;
      for (const [dy, f] of [[0, 1], [4, 0.8]]) {
        g.beginPath(); g.moveTo(-14, -10 + dy * 0.5);
        g.quadraticCurveTo(-28, -10 + dy + Math.sin(t / 4 + dy) * 5, -42 * f, -4 + dy + Math.sin(t / 3 + dy) * 7);
        g.lineTo(-40 * f, 0 + dy + Math.sin(t / 3 + dy) * 7); g.quadraticCurveTo(-26, -4 + dy, -14, -6 + dy * 0.5); g.fill();
      }
      break;
    }
    case 'capuche': {
      g.fillStyle = teinte(k.tenue, 0.08);
      g.beginPath(); g.moveTo(-20, 16); g.quadraticCurveTo(-24, -24, 2, -24); g.quadraticCurveTo(22, -22, 20, -2); g.quadraticCurveTo(10, -14, -6, -12); g.quadraticCurveTo(-14, 0, -12, 16); g.fill();
      break;
    }
    case 'crete': {
      g.beginPath(); g.ellipse(-2, -9, 15, 7, 0, Math.PI, Math.PI * 2); g.fill();
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-12 + i * 4.5, -13); g.lineTo(-14 + i * 4.5, -32 + Math.abs(i - 2.5) * 3); g.lineTo(-7 + i * 4.5, -13); g.fill(); }
      break;
    }
    case 'visiere': {
      g.fillStyle = teinte(k.tenue, 0.2);
      g.beginPath(); g.ellipse(0, -4, 18, 17, 0, Math.PI * 1.05, Math.PI * 2.02); g.fill();
      g.fillRect(-17, -6, 34, 6);
      lueur(g, 8, -3, 9, '#ff3030');
      g.fillStyle = '#ff5050'; g.beginPath(); g.roundRect(-4, -5, 22, 5, 2); g.fill();
      break;
    }
    case 'longs': {
      g.beginPath(); g.ellipse(-2, -9, 17, 10, 0, Math.PI * 0.95, Math.PI * 2.05); g.fill();
      g.beginPath(); g.moveTo(-16, -6); g.quadraticCurveTo(-20, 8, -14, 16); g.lineTo(-10, 2); g.fill();
      if (p.look.extras.includes('diademe-lune')) {
        g.strokeStyle = '#e8f4ff'; g.lineWidth = 2.5;
        g.beginPath(); g.arc(2, -16, 7, rad(200), rad(340)); g.stroke();
        lueur(g, 2, -18, 4, '#cfe8ff');
      }
      break;
    }
    case 'halo': {
      g.beginPath(); g.ellipse(-2, -10, 15, 7, 0, Math.PI, Math.PI * 2); g.fill();
      g.save();
      g.strokeStyle = k.c1; g.lineWidth = 3; g.shadowColor = k.c1; g.shadowBlur = 12;
      g.beginPath(); g.ellipse(0, -30 + Math.sin(t / 10) * 2, 16, 5, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      break;
    }
    case 'cornes': {
      g.beginPath(); g.ellipse(-2, -10, 15, 7, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = p.id === 'malvortex' ? '#2a0a0a' : '#e8d6b0';
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(-2 + s * 8, -12);
        g.quadraticCurveTo(-2 + s * 22, -18, -2 + s * 18, -34);
        g.quadraticCurveTo(-2 + s * 14, -20, -2 + s * 3, -14); g.fill();
      }
      break;
    }
    case 'chignon': {
      g.beginPath(); g.ellipse(-2, -9, 16, 8, 0, Math.PI, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-6, -22, 6, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = p.c.c1; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -12); g.lineTo(14, -12); g.stroke();
      break;
    }
    case 'couettes': {
      g.beginPath(); g.ellipse(-1, -9, 17, 9, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = p.c.c1;
      for (const s of [-1, 1]) { g.beginPath(); g.arc(-3 + s * 12, -12, 3, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'rocher': {
      g.strokeStyle = teinte(p.c.peau, -0.4); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-8, -12); g.lineTo(-2, -4); g.lineTo(-6, 4); g.moveTo(6, -14); g.lineTo(10, -6); g.stroke();
      g.fillStyle = '#5f8f3a';
      g.beginPath(); g.ellipse(-4, -15, 9, 3, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'plumes': {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i % 2 ? k.cheveux : teinte(k.cheveux, -0.2);
        g.beginPath(); g.ellipse(-12 + i * 2, -14 - i, 4, 14, rad(-60 + i * 8 + Math.sin(t / 6) * 4), 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'casque': {
      g.fillStyle = teinte(k.tenue, 0.25);
      g.beginPath(); g.ellipse(0, -5, 18, 17, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = k.c1;
      g.beginPath(); g.moveTo(-6, -20); g.quadraticCurveTo(-18, -36, -26, -30); g.quadraticCurveTo(-14, -26, -12, -16); g.fill();
      g.beginPath(); g.moveTo(-17, -4); g.lineTo(-26, 4); g.lineTo(-16, 6); g.fill();
      break;
    }
    case 'couronne-etoiles': {
      for (let i = 0; i < 7; i++) {
        const a = rad(-160 + i * 23);
        const rr = 26 + Math.sin(t / 6 + i) * 3;
        etoile(g, Math.cos(a) * rr, -8 + Math.sin(a) * rr * 0.9, 4 + (i % 2) * 2, i % 3 ? '#e8d4ff' : '#ffd84a', t / 20 + i);
      }
      break;
    }
    default: break;
  }
}

export function etoile(g, x, y, r, c, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = c;
  g.shadowColor = c;
  g.shadowBlur = 8;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.4 : r;
    const a = (i * Math.PI) / 4;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Le buste, les épaules, les accessoires                              */
/* ------------------------------------------------------------------ */

function torse(g, p, { largeur, taille, t, l }) {
  const k = p.c;
  const X = p.look.extras;
  // Le kimono ouvert : la peau en V.
  if (['ryuken', 'blazero', 'thunderox', 'pyroclaw'].includes(p.id)) {
    g.fillStyle = k.peau;
    g.beginPath(); g.moveTo(-8, -48); g.lineTo(10, -48); g.lineTo(2, -18); g.closePath(); g.fill();
    g.strokeStyle = teinte(k.peau, -0.3); g.lineWidth = 1;
    g.beginPath(); g.moveTo(1, -40); g.lineTo(1, -24); g.stroke();
  }
  if (X.includes('armure') || X.includes('armure-or') || X.includes('armure-noire')) {
    const c = X.includes('armure-or') ? '#ffd23f' : X.includes('armure-noire') ? '#1a0508' : teinte(k.tenue, 0.35);
    g.fillStyle = c;
    g.beginPath(); g.moveTo(-largeur + 4, -44); g.lineTo(largeur - 4, -44); g.lineTo(largeur - 8, -18); g.lineTo(0, -10); g.lineTo(-largeur + 8, -18); g.closePath(); g.fill();
    g.strokeStyle = X.includes('armure-noire') ? '#c80014' : 'rgba(255,255,255,0.45)'; g.lineWidth = 1.5;
    g.stroke();
    if (X.includes('armure') && p.id === 'ironclad') { lueur(g, 2, -32, 5, '#4fd8ff'); g.fillStyle = '#bff3ff'; g.beginPath(); g.arc(2, -32, 4, 0, Math.PI * 2); g.fill(); }
  }
  // Le Général : la cuirasse d'acier bordée d'or, l'écharpe rouge, la grande horloge, les médailles.
  if (X.includes('general')) {
    const cu = g.createLinearGradient(-largeur, -48, largeur, -8);
    cu.addColorStop(0, '#6a7480'); cu.addColorStop(0.45, '#2e3640'); cu.addColorStop(1, '#14181e');
    g.fillStyle = cu;
    g.beginPath(); g.moveTo(-largeur + 1, -47); g.lineTo(largeur - 1, -47); g.lineTo(largeur - 4, -16); g.quadraticCurveTo(0, -3, -largeur + 4, -16); g.closePath(); g.fill();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 2.2; g.stroke();
    // Les pectoraux gravés.
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-largeur + 6, -38); g.quadraticCurveTo(-6, -30, 0, -38); g.quadraticCurveTo(6, -30, largeur - 6, -38); g.moveTo(0, -38); g.lineTo(0, -12); g.stroke();
    // L'écharpe rouge du commandement, en travers.
    g.fillStyle = '#b0102a';
    g.beginPath(); g.moveTo(-largeur + 2, -47); g.lineTo(-largeur + 11, -47); g.lineTo(largeur - 2, -18); g.lineTo(largeur - 6, -12); g.closePath(); g.fill();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 1; g.stroke();
    // La grande horloge de l'armée, dont les aiguilles tournent.
    g.fillStyle = '#120c04'; g.beginPath(); g.arc(1, -29, 10.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(1, -29, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1a06'; g.beginPath(); g.arc(1, -29, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd23f'; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(1 + Math.cos(a) * 5, -29 + Math.sin(a) * 5); g.lineTo(1 + Math.cos(a) * 6.6, -29 + Math.sin(a) * 6.6); g.stroke(); }
    lueur(g, 1, -29, 4, k.c1);
    g.strokeStyle = '#ffe6a0'; g.lineWidth = 1.4; g.lineCap = 'round';
    const a1 = t / 30; const a2 = t / 360;
    g.beginPath(); g.moveTo(1, -29); g.lineTo(1 + Math.cos(a1) * 5.5, -29 + Math.sin(a1) * 5.5); g.moveTo(1, -29); g.lineTo(1 + Math.cos(a2) * 3.6, -29 + Math.sin(a2) * 3.6); g.stroke();
    // Les médailles.
    for (let i = 0; i < 3; i++) {
      const x = -largeur + 7 + i * 5;
      g.fillStyle = ['#c8102e', '#1a4ad8', '#2a8a4a'][i]; g.fillRect(x - 1.8, -44, 3.6, 6);
      g.fillStyle = i === 1 ? '#e8e8f0' : '#ffd23f'; g.beginPath(); g.arc(x, -36.5, 2.4, 0, Math.PI * 2); g.fill();
    }
    // Les tassettes, sur les hanches.
    for (const sx of [-1, 1]) {
      g.fillStyle = '#3a434e';
      g.beginPath(); g.moveTo(sx * 2, 2); g.lineTo(sx * (taille + 4), 2); g.lineTo(sx * (taille + 6), 20); g.lineTo(sx * 4, 18); g.closePath(); g.fill();
      g.strokeStyle = '#ffd23f'; g.lineWidth = 1.4; g.stroke();
    }
  }
  // L'insigne de l'armée de l'Horloge, sur la poitrine.
  if (X.includes('insigne')) {
    g.fillStyle = '#1a1206'; g.beginPath(); g.arc(2, -32, 7.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = k.ceinture; g.beginPath(); g.arc(2, -32, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1206'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(2, -32); g.lineTo(2, -37); g.moveTo(2, -32); g.lineTo(5.5, -30); g.stroke();
  }
  if (X.includes('ecailles')) {
    g.strokeStyle = rgba(k.c1, 0.5); g.lineWidth = 1;
    for (let y = -42; y < -6; y += 7) for (let x = -largeur + 6; x < largeur - 4; x += 8) { g.beginPath(); g.arc(x + ((y / 7) % 2) * 4, y, 3.5, 0, Math.PI); g.stroke(); }
  }
  if (X.includes('fissures') || X.includes('mousse')) {
    g.strokeStyle = teinte(k.tenue, -0.45); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-10, -44); g.lineTo(-4, -30); g.lineTo(-12, -18); g.moveTo(8, -40); g.lineTo(12, -26); g.stroke();
    g.fillStyle = '#5f8f3a'; g.beginPath(); g.ellipse(-largeur + 8, -44, 9, 4, 0, 0, Math.PI * 2); g.fill();
  }
  if (X.includes('fissures-energie')) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(k.c1, 0.6 + Math.sin(t / 4) * 0.3); g.lineWidth = 2; g.shadowColor = k.c1; g.shadowBlur = 10;
    g.beginPath(); g.moveTo(-12, -46); g.lineTo(-4, -32); g.lineTo(-10, -20); g.lineTo(2, -8); g.moveTo(10, -44); g.lineTo(4, -30); g.lineTo(12, -16); g.stroke();
    g.restore();
  }
  if (X.includes('eclairs') && Math.floor(t / 3) % 4 === 0) {
    g.strokeStyle = '#fff3a0'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-largeur, -40); g.lineTo(-largeur + 6, -30); g.lineTo(-largeur + 1, -24); g.lineTo(-largeur + 8, -12); g.stroke();
  }
  void l; void taille;
}

function epaulieres(g, p, ep, l, t) {
  const X = p.look.extras;
  const k = p.c;
  if (X.includes('epaulettes-glace')) {
    g.fillStyle = rgba('#e6faff', 0.95);
    for (const s of [0, 1]) { g.beginPath(); g.moveTo(ep.x - 8 + s * 10, ep.y + 2); g.lineTo(ep.x - 4 + s * 12, ep.y - 16 - s * 4); g.lineTo(ep.x + 2 + s * 10, ep.y + 2); g.fill(); }
  }
  if (X.includes('armure') || X.includes('armure-or') || X.includes('armure-noire')) {
    g.fillStyle = X.includes('armure-or') ? '#ffd23f' : X.includes('armure-noire') ? '#2a0a10' : teinte(k.tenue, 0.4);
    g.beginPath(); g.ellipse(ep.x + 4, ep.y + 2, 13 * l, 9, rad(-10), 0, Math.PI * 2); g.fill();
    if (X.includes('armure-noire')) { g.fillStyle = '#c80014'; g.beginPath(); g.moveTo(ep.x, ep.y - 4); g.lineTo(ep.x + 6, ep.y - 18); g.lineTo(ep.x + 10, ep.y - 4); g.fill(); }
  }
  if (X.includes('general')) {
    for (let i = 2; i >= 0; i--) {
      const y = ep.y + 3 + i * 7;
      const gr = g.createLinearGradient(ep.x - 14, y - 10, ep.x + 18, y + 8);
      gr.addColorStop(0, '#7a8490'); gr.addColorStop(0.5, '#3a434e'); gr.addColorStop(1, '#1a1e24');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(ep.x + 4, y, (18 - i * 2.5) * l, 11 - i * 1.5, rad(-10), Math.PI * 0.95, Math.PI * 2.05); g.closePath(); g.fill();
      g.strokeStyle = '#ffd23f'; g.lineWidth = 1.6; g.stroke();
    }
    g.fillStyle = '#ffd23f';
    for (let i = 0; i < 3; i++) {
      const x = ep.x - 8 * l + i * 9 * l;
      g.beginPath(); g.moveTo(x - 3, ep.y - 5); g.lineTo(x - 2 + i, ep.y - 19 - (i === 1 ? 5 : 0)); g.lineTo(x + 3, ep.y - 5); g.closePath(); g.fill();
    }
  }
  if (X.includes('brassards')) { g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(ep.x + 6, ep.y + 14, 7, 4, 0, 0, Math.PI * 2); g.fill(); }
  void t;
}

function canon(g, coude, main, k) {
  g.save();
  const a = Math.atan2(main.y - coude.y, main.x - coude.x);
  g.translate(coude.x, coude.y);
  g.rotate(a);
  g.fillStyle = teinte(k.tenue, 0.3);
  g.beginPath(); g.roundRect(4, -8, 26, 16, 4); g.fill();
  g.fillStyle = '#ff5050';
  g.beginPath(); g.arc(30, 0, 4, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Ce qui se dessine derrière le corps. */
function arriere(g, p, { hanche, epaule, cou, t, l, pose }) {
  const X = p.look.extras;
  const k = p.c;
  if (X.includes('cape')) {
    const vent = Math.sin(t / 7) * 6;
    const general = X.includes('general');
    const long = general ? 30 : 0;
    const grad = g.createLinearGradient(0, epaule.y, 0, hanche.y + 40 + long);
    grad.addColorStop(0, general ? '#a0102a' : teinte(k.tenue, 0.1));
    grad.addColorStop(1, p.id === 'malvortex' ? '#5a0010' : general ? '#3a0410' : teinte(k.c2, -0.2));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(epaule.x - 14 * l, epaule.y);
    g.quadraticCurveTo(epaule.x - 40 - long * 0.6 + vent, hanche.y, epaule.x - 50 - long + vent * 2, hanche.y + 50 + long);
    g.lineTo(epaule.x - 10 + vent, hanche.y + 56 + long);
    g.quadraticCurveTo(epaule.x - 6, hanche.y, epaule.x + 8, epaule.y);
    g.closePath(); g.fill();
    if (general) { g.strokeStyle = '#ffd23f'; g.lineWidth = 2.2; g.stroke(); }
  }
  if (X.includes('ailes') || X.includes('ailes-dragon') || X.includes('ailes-lumiere')) {
    const bat = Math.sin(t / 6) * 10 + (pose.rot ? 20 : 0);
    g.save();
    if (X.includes('ailes-lumiere')) { g.globalCompositeOperation = 'lighter'; g.shadowColor = k.c1; g.shadowBlur = 16; }
    for (const [s, f] of [[1, 0.75], [0, 1]]) {
      g.fillStyle = X.includes('ailes-dragon') ? teinte(k.c2, -0.1 - s * 0.2) : X.includes('ailes-lumiere') ? rgba('#fff2a8', 0.55 - s * 0.15) : teinte(k.cheveux, -s * 0.25);
      g.beginPath();
      const bx = epaule.x - 6 - s * 6;
      const by = epaule.y + 6;
      g.moveTo(bx, by);
      if (X.includes('ailes-dragon')) {
        g.lineTo(bx - 50 * f, by - 50 * f - bat);
        g.lineTo(bx - 70 * f, by - 6 - bat * 0.5);
        g.lineTo(bx - 52 * f, by + 4);
        g.lineTo(bx - 40 * f, by + 22);
        g.lineTo(bx - 22 * f, by + 18);
      } else {
        for (let i = 0; i <= 5; i++) {
          const a = rad(200 + i * 18);
          const rr = (62 - i * 6) * f;
          g.lineTo(bx + Math.cos(a) * rr - 6, by + Math.sin(a) * rr - bat * (1 - i / 6));
        }
      }
      g.closePath(); g.fill();
    }
    g.restore();
  }
  if (X.includes('queue') || X.includes('queue-dragon')) {
    g.strokeStyle = X.includes('queue-dragon') ? teinte(k.peau, -0.1) : k.c1;
    g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hanche.x - 6, hanche.y + 2);
    g.quadraticCurveTo(hanche.x - 40, hanche.y + 30 + Math.sin(t / 6) * 6, hanche.x - 58 + Math.sin(t / 5) * 6, hanche.y + 10);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(hanche.x - 58 + Math.sin(t / 5) * 6, hanche.y + 10); g.lineTo(hanche.x - 66 + Math.sin(t / 5) * 6, hanche.y - 2); g.stroke();
  }
  if (X.includes('katana')) {
    g.save(); g.translate(epaule.x - 8, epaule.y + 4); g.rotate(rad(-130));
    g.fillStyle = '#1a1a22'; g.fillRect(0, -3, 60, 6);
    g.fillStyle = k.c1; g.fillRect(-14, -3, 14, 6);
    g.restore();
  }
  if (X.includes('echarpe')) {
    g.fillStyle = k.c1;
    g.beginPath();
    g.moveTo(cou.x - 6, cou.y);
    g.quadraticCurveTo(cou.x - 30, cou.y + 4 + Math.sin(t / 5) * 4, cou.x - 54, cou.y - 4 + Math.sin(t / 4) * 8);
    g.lineTo(cou.x - 50, cou.y + 6 + Math.sin(t / 4) * 8);
    g.quadraticCurveTo(cou.x - 28, cou.y + 12, cou.x - 4, cou.y + 8);
    g.fill();
  }
  if (X.includes('horloge')) {
    const cx = epaule.x - 14;
    const cy = epaule.y - 26;
    g.save();
    g.shadowColor = k.c1; g.shadowBlur = 14;
    g.strokeStyle = '#ffd23f'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, 36, 0, Math.PI * 2); g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = rgba(k.c2, 0.55);
    g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
    g.strokeStyle = rgba(k.c1, 0.9); g.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28); g.lineTo(cx + Math.cos(a) * (i % 3 ? 31 : 33), cy + Math.sin(a) * (i % 3 ? 31 : 33)); g.stroke(); }
    // Les aiguilles tournent.
    g.strokeStyle = '#ffd23f'; g.lineCap = 'round';
    g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t / 40) * 18, cy + Math.sin(t / 40) * 18); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t / 6) * 26, cy + Math.sin(t / 6) * 26); g.stroke();
    g.restore();
  }
  if (X.includes('aura-noire')) {
    g.save(); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 6; i++) {
      const a = t / 12 + i;
      g.fillStyle = 'rgba(40,0,60,0.25)';
      g.beginPath(); g.arc(Math.cos(a) * 30, hanche.y - 30 + Math.sin(a * 1.3) * 40, 22, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}

/** Ce qui se dessine devant : orbes, étoiles, flammes. */
function devant(g, p, { hanche, mainA, mainR, t }) {
  const X = p.look.extras;
  const k = p.c;
  if (X.includes('eclats')) {
    for (let i = 0; i < 5; i++) {
      const a = t / 20 + (i * Math.PI * 2) / 5;
      const x = Math.cos(a) * 44;
      const y = hanche.y - 50 + Math.sin(a * 1.2) * 46;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = i % 2 ? '#ffffff' : '#a8c4e8';
      g.shadowColor = '#c0d8ff'; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(0, -7); g.lineTo(3.5, 0); g.lineTo(0, 7); g.lineTo(-3.5, 0); g.closePath(); g.fill();
      g.restore();
    }
  }
  if (X.includes('orbes')) {
    for (let i = 0; i < 3; i++) {
      const a = t / 14 + (i * Math.PI * 2) / 3;
      const x = Math.cos(a) * 42;
      const y = hanche.y - 40 + Math.sin(a) * 14;
      lueur(g, x, y, 5, k.c1);
      g.fillStyle = '#1b0640'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
  }
  if (X.includes('etoiles')) {
    for (let i = 0; i < 4; i++) {
      const a = t / 18 + i * 1.7;
      etoile(g, Math.cos(a) * 36, hanche.y - 50 + Math.sin(a * 1.4) * 40, 3 + (i % 2), i % 2 ? '#fff' : k.c1, a);
    }
  }
  if (X.includes('flammes')) {
    for (const mn of [mainA, mainR]) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const fy = mn.y - 6 - ((t * 2 + i * 7) % 18);
        g.fillStyle = rgba(i ? '#ffb000' : '#ff4000', 0.5 * (1 - ((t * 2 + i * 7) % 18) / 18));
        g.beginPath(); g.arc(mn.x + Math.sin(t / 3 + i) * 3, fy, 5 - i, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }
  if (X.includes('nageoires')) {
    g.fillStyle = rgba(k.c1, 0.8);
    g.beginPath(); g.moveTo(mainR.x, mainR.y - 10); g.lineTo(mainR.x - 14, mainR.y - 22); g.lineTo(mainR.x - 2, mainR.y - 4); g.fill();
  }
}

/** Les armes tenues : la faux, le trident (main arrière). */
function armeArriere(g, p, main, coude, o, t) {
  const X = p.look.extras;
  const k = p.c;
  const a = Math.atan2(main.y - coude.y, main.x - coude.x);
  if (X.includes('faux')) {
    g.save(); g.translate(main.x, main.y); g.rotate(a + rad(90));
    g.strokeStyle = '#2a1b10'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 40); g.lineTo(0, -70); g.stroke();
    g.fillStyle = '#d8d8e8';
    g.shadowColor = k.c1; g.shadowBlur = 10;
    g.beginPath(); g.moveTo(0, -70); g.quadraticCurveTo(46, -86, 62, -50); g.quadraticCurveTo(36, -70, 0, -60); g.closePath(); g.fill();
    g.restore();
  }
  if (X.includes('trident')) {
    g.save(); g.translate(main.x, main.y); g.rotate(a + rad(90));
    g.strokeStyle = '#d4b04a'; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 30); g.lineTo(0, -70); g.stroke();
    g.beginPath(); g.moveTo(-10, -60); g.lineTo(-10, -80); g.moveTo(0, -70); g.lineTo(0, -88); g.moveTo(10, -60); g.lineTo(10, -80); g.moveTo(-10, -60); g.lineTo(10, -60); g.stroke();
    g.restore();
  }
  void o; void t;
}

/** Les armes de la main avant : katana tiré, épée, griffes. */
function armeAvant(g, p, main, coude, o, t) {
  const X = p.look.extras;
  const k = p.c;
  const a = Math.atan2(main.y - coude.y, main.x - coude.x);
  const attaque = ['poing', 'ruee', 'tourne', 'uppercut', 'lance', 'ulti', 'poing-air', 'saisie'].includes(o.pose);
  if ((X.includes('katana') && attaque) || X.includes('epee')) {
    g.save(); g.translate(main.x, main.y); g.rotate(a);
    g.shadowColor = k.c1; g.shadowBlur = 14;
    const grad = g.createLinearGradient(0, 0, 70, 0);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, X.includes('epee') ? '#ffe680' : k.c1);
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(4, -2.5); g.lineTo(74, -1); g.lineTo(80, 0); g.lineTo(74, 2); g.lineTo(4, 2.5); g.closePath(); g.fill();
    g.fillStyle = '#ffd23f'; g.fillRect(-2, -6, 5, 12);
    g.restore();
  }
  if (X.includes('griffes')) {
    g.save(); g.translate(main.x, main.y); g.rotate(a);
    g.fillStyle = '#fff2d8';
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(6, i * 4 - 1.5); g.lineTo(20, i * 6); g.lineTo(6, i * 4 + 1.5); g.fill(); }
    g.restore();
  }
  void t;
}

function statutsVisibles(g, statuts, t, hanche) {
  if (statuts.brulure) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const v = (t * 3 + i * 13) % 40;
      g.fillStyle = rgba(i % 2 ? '#ff9a1a' : '#ff3a00', 0.45 * (1 - v / 40));
      g.beginPath(); g.arc(-16 + i * 8 + Math.sin(t / 4 + i) * 3, hanche.y - 20 - v * 2, 7 - v / 8, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  if (statuts.poison) {
    for (let i = 0; i < 3; i++) {
      const v = (t * 1.5 + i * 20) % 60;
      g.fillStyle = rgba('#5cff6a', 0.6 * (1 - v / 60));
      g.beginPath(); g.arc(-10 + i * 10, hanche.y - 40 - v, 3.5, 0, Math.PI * 2); g.fill();
    }
  }

}

/* ------------------------------------------------------------------ */
/* Portraits                                                           */
/* ------------------------------------------------------------------ */

/** Le portrait d'un combattant (tête et épaules), dans un carré de `taille` pixels. */
export function dessinerPortrait(g, perso, taille, o = {}) {
  g.save();
  // Un inconnu : un fond gris, une silhouette.
  if (o.ombre) perso = { ...perso, c: { ...perso.c, c1: '#8a7aa8', c2: '#2a2238' } };
  const fond = g.createLinearGradient(0, 0, 0, taille);
  fond.addColorStop(0, teinte(perso.c.c2, -0.35));
  fond.addColorStop(1, teinte(perso.c.c1, -0.55));
  g.fillStyle = fond;
  g.fillRect(0, 0, taille, taille);
  // Un halo de la couleur du combattant.
  const h = g.createRadialGradient(taille * 0.5, taille * 0.45, 0, taille * 0.5, taille * 0.45, taille * 0.6);
  h.addColorStop(0, rgba(perso.c.c1, 0.55));
  h.addColorStop(1, rgba(perso.c.c1, 0));
  g.fillStyle = h;
  g.fillRect(0, 0, taille, taille);
  const e = taille / 95;
  const car = CARRURES[perso.look.corps] || CARRURES.normal;
  dessinerCombattant(g, perso, {
    x: taille * 0.5, y: taille * 2.02, dir: o.dir || 1, pose: o.pose || 'repos', t: o.t || 0,
    echelle: e * 1.15 / car.h, sansOmbre: true, aura: o.aura, ombre: o.ombre, corrompu: o.corrompu,
  });
  g.restore();
}
