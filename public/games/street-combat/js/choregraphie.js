/**
 * STREET COMBAT — la chorégraphie des ultimes.
 *
 * Pendant un ultime, le moteur tient les deux combattants immobiles (c.cine
 * de type « ulti » : un portrait, puis 130 images, le coup à l'image 70).
 * Ici, on décide de ce qu'ils font à l'écran, sans rien changer au combat :
 * celui qui frappe charge, s'élève, frappe le sol, tend les bras… ; l'autre
 * encaisse, gèle, puis est soufflé par l'impact. Tout se déduit de l'état du
 * moteur (pas de hasard) : chacun voit la même chose, en ligne aussi.
 */

const lisse = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const entre = (u, a, b) => lisse((u - a) / (b - a));
const IMPACT = 68;

/** Ce que fait celui qui frappe, ultime par ultime : (t) → { pose, p, dx, dy, enLAir }. */
const ATTAQUE = {
  // Ryuken : les mains en coupe contre la hanche, le ki se forme, puis il pousse les deux paumes.
  hadoken: (t) => (t < 46 ? { pose: 'ulti-charge', p: t / 46 } : t < 104 ? { pose: 'ulti', p: 1 } : { pose: 'garde' }),
  // Blazero : il s'élève, bras au ciel, appelle les météores, puis les abat d'un geste.
  meteores: (t) => {
    const leve = 34 * entre(t, 8, 30) * (1 - entre(t, 92, 116));
    if (t < 58) return { pose: 'invoque', p: 1, dy: -leve, enLAir: leve > 1 };
    if (t < 96) return { pose: 'ulti', p: 1, dy: -leve, enLAir: leve > 1 };
    return { pose: 'garde', dy: -leve, enLAir: leve > 1 };
  },
  // Frostbyte : il pose la main au sol, le givre file jusqu'à l'adversaire, le glacier le prend.
  zero: (t) => (t < 22 ? { pose: 'ulti-charge', p: t / 22 } : t < 100 ? { pose: 'frappe-sol', p: 1 } : { pose: 'garde' }),
  foudre: (t) => (t < 46 ? { pose: 'invoque', p: 1 } : t < 104 ? { pose: 'v-pointe' } : { pose: 'garde' }),
  omega: (t) => (t < 40 ? { pose: 'ulti-charge', p: t / 40 } : t < 100 ? { pose: 'ulti' } : { pose: 'garde' }),
  serpent: (t) => (t < 30 ? { pose: 'ulti-charge', p: t / 30 } : t < 100 ? { pose: 'ulti' } : { pose: 'garde' }),
  singularite: (t) => (t < 100 ? { pose: t < 20 ? 'ulti-charge' : 'invoque', p: 1 } : { pose: 'garde' }),
  eclipse: (t) => leve(t, 'invoque', 30),
  dragon: (t) => (t < 34 ? { pose: 'ulti-charge', p: t / 34 } : t < 100 ? { pose: 'ulti' } : { pose: 'garde' }),
  'mille-lames': (t, e) => disparait(t, e),
  supernova: (t) => leve(t, 'v-bras-ecartes', 34),
  tectonique: (t) => (t < 16 ? { pose: 'invoque', p: 1 } : t < 100 ? { pose: 'frappe-sol', p: 1 } : { pose: 'garde' }),
  ouragan: (t) => (t < 52 ? { pose: 'tourne', p: 1 } : t < 100 ? { pose: 'ulti' } : { pose: 'garde' }),
  oubli: (t) => (t < 40 ? { pose: 'invoque', p: 1 } : t < 100 ? { pose: 'ruee' } : { pose: 'garde' }),
  maelstrom: (t) => leve(t, 'invoque', 20),
  divine: (t) => leve(t, 'invoque', 36),
  armageddon: (t) => (t < 56 ? { pose: 'v-bras-ecartes' } : t < 100 ? { pose: 'ulti' } : { pose: 'garde' }),
  chrono: (t) => (t < 100 ? { pose: t < 40 ? 'v-salut-mili' : 'v-pointe' } : { pose: 'garde' }),
  ring: (t, e) => direct(t, e),
  miroirs: (t) => (t < 24 ? { pose: 'ulti-charge', p: t / 24 } : t < 100 ? { pose: 'ulti' } : { pose: 'garde' }),
  legion: (t) => (t < 40 ? { pose: 'invoque', p: 1 } : t < 100 ? { pose: 'v-pointe' } : { pose: 'garde' }),
  'sablier-infini': (t) => leve(t, 'invoque', 22),
  'eclipse-totale': (t, e) => disparait(t, e),
  'aube-eternelle': (t) => leve(t, 'v-bras-ecartes', 40),
  'mille-boucles': (t) => (t < 100 ? { pose: t < 44 ? 'garde' : 'v-pointe' } : { pose: 'garde' }),
  'omega-collapse': (t) => leve(t, 'v-bras-ecartes', 30),
  vide: (t, e) => disparait(t, e),
  // Le héros.
  'heros-fracture': (t) => (t < 50 ? { pose: 'ulti-charge', p: t / 50 } : t < 100 ? { pose: 'poing', p: 1 } : { pose: 'garde' }),
  'heros-phenix': (t) => leve(t, 'invoque', 26),
  'heros-tempete': (t) => (t < 50 ? { pose: 'tourne', p: 1 } : t < 100 ? { pose: 'ulti' } : { pose: 'garde' }),
  'heros-sceau': (t) => (t < 100 ? { pose: t < 40 ? 'invoque' : 'v-pointe', p: 1 } : { pose: 'garde' }),
  'heros-comete': (t, e) => disparait(t, e),
  'heros-eveil': (t) => (t < 56 ? { pose: 'garde' } : t < 100 ? { pose: 'poing', p: entre(t, 56, 68) } : { pose: 'garde' }),
  'heros-horizon': (t, e) => (t < 56 ? { pose: 'ulti-charge', p: t / 56 } : t < 62 ? { pose: 'ruee', dx: (e + 100) * entre(t, 56, 62) } : disparait(Math.max(t, 60), e)),
  'heros-promesses': (t) => leve(t, 'invoque', 20),
};

/** Il s'élève (de h), dans une pose, puis redescend. */
function leve(t, pose, h) {
  const l = h * entre(t, 6, 30) * (1 - entre(t, 96, 118));
  return { pose: t < 104 ? pose : 'garde', p: 1, dy: -l, enLAir: l > 1 };
}
/** Il disparaît dans l'ombre, frappe sans être vu, réapparaît derrière l'adversaire, puis revient à sa place. */
function disparait(t, e) {
  if (t < 8) return { pose: 'garde', alpha: 1 - t / 8 };
  if (t < 60) return { pose: 'garde', alpha: 0 };
  if (t < 104) return { pose: 'v-garde-honneur', dx: e + 80, alpha: entre(t, 60, 64) };
  if (t < 114) return { pose: 'garde', dx: e + 80, alpha: 1 - entre(t, 104, 114) };
  return { pose: 'garde', alpha: entre(t, 116, 126) };
}
/** Il fonce sur l'adversaire, enchaîne les directs, finit par l'uppercut, puis revient en marchant. */
function direct(t, e) {
  const pres = Math.max(0, e - 70);
  if (t < 20) return { pose: 'ruee', dx: pres * entre(t, 4, 20) };
  if (t < 60) return { pose: 'poing', p: ((t - 20) % 4) / 4 * 1.4, dx: pres };
  if (t < 100) return { pose: t < 84 ? 'uppercut' : 'v-poing', p: 1, dx: pres };
  return { pose: 'marche', dx: pres * (1 - entre(t, 100, 128)) };
}

/** Ce que subit l'autre : avant l'impact il se raidit (ou gèle), après il est soufflé. */
function defense(t, visuel) {
  const gel = visuel === 'zero' && t >= 40 && t < IMPACT + 6;
  const lent = visuel === 'chrono' && t >= 10 && t < IMPACT;
  // Aspiré par un trou noir, emporté par un ouragan, soulevé par la roche ou le maelström.
  const souleve = { singularite: 60, ouragan: 70, tectonique: 50, maelstrom: 34 }[visuel] || 0;
  if (t < IMPACT && souleve) {
    const s = entre(t, 30, IMPACT) * souleve;
    return { pose: 'tenu-leve', p: entre(t, 30, 50), dy: -s, enLAir: s > 1 };
  }
  if (t < IMPACT) {
    // Les météores le secouent un peu à chaque chute.
    const secoue = visuel === 'meteores' && t > 30 ? Math.abs(Math.sin(t / 2.2)) * 0.6 : 0.25;
    return { pose: gel ? 'touche' : 'tenu', p: secoue, statuts: gel ? { gel: 1 } : lent ? { lenteur: 1 } : null };
  }
  const u = t - IMPACT;
  const souffle = entre(u, 0, 10);
  const retombe = entre(t, 112, 130);
  return {
    pose: 'projete', p: 0.75 * souffle,
    dx: 26 * souffle * (1 - retombe * 0.7),
    dy: -(30 * souffle) * (1 - retombe * 0.75),
    enLAir: true,
    statuts: gel ? { gel: 1 } : null,
  };
}

/**
 * Ce qu'il faut dessiner pendant un ultime, ou null.
 * @returns {null | { att, def, joueurs }} pour chacun : { pose, p, x, y, enLAir, statuts? }
 */
export function animerUlti(c, PERSO) {
  const k = c.cine;
  if (!k || k.type !== 'ulti') return null;
  const att = c.joueurs[k.att];
  const def = c.joueurs[k.def];
  const visuel = PERSO[att.id]?.ulti?.visuel;
  const plan = ATTAQUE[visuel];
  if (!plan) return null;
  const dir = att.dir || 1;
  // Pendant le portrait, il prend déjà sa pose de charge.
  if (k.phase !== 'cine') {
    const a = plan(0);
    return { att: { pose: a.pose, p: 0, t: att.anim, x: att.x, y: att.y }, def: null, joueurs: [k.att, k.def] };
  }
  const a = plan(k.t, Math.abs(def.x - att.x));
  const d = defense(k.t, visuel);
  return {
    att: { pose: a.pose, p: a.p ?? 0, t: att.anim, x: att.x + dir * (a.dx || 0), y: att.y + (a.dy || 0), enLAir: !!a.enLAir, alpha: a.alpha ?? 1, ...(a.dx > 0 && a.pose === 'v-garde-honneur' ? { dir: -dir } : {}) },
    def: { pose: d.pose, p: d.p, t: def.anim, x: def.x + dir * (d.dx || 0), y: def.y + (d.dy || 0), enLAir: !!d.enLAir, statuts: d.statuts || undefined },
    joueurs: [k.att, k.def],
  };
}
