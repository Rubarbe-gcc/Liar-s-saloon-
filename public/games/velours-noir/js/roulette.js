/**
 * LE VELOURS NOIR — la roulette, avec Henri.
 *
 * La roue est dessinée sur un canvas (le cylindre qui tourne est rendu une
 * fois puis seulement pivoté) ; le numéro est tiré d'abord, et la bille est
 * guidée pour finir dans sa case : elle tourne à l'envers de la roue, ralentit,
 * quitte la piste, rebondit sur les losanges et se pose. Pendant le lancer,
 * la roue passe au premier plan et la caméra s'approche de la bille.
 */

import * as R from '../../../shared/casino/roulette.js';
import { makeRng } from '../../../shared/hasard.js';
import { creerCroupier } from './croupier.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';
import * as EL from './enligne.js';
import * as RX from './reactions.js';

const $ = (id) => document.getElementById(id);
const JETONS = [1, 5, 25, 100, 500];
const CLE_HISTO = 'velours.roulette.historique';
const T = 1440;                    // taille du canvas
const C = T / 2;
const PAS = (Math.PI * 2) / 37;
const RAYON_PISTE = C * 0.79, RAYON_CASE = C * 0.575;

/* ------------------------------------------------------------------ */
/* Le dessin de la roue                                                */
/* ------------------------------------------------------------------ */

function calque(f) {
  const c = document.createElement('canvas');
  c.width = c.height = T;
  f(c.getContext('2d'));
  return c;
}

/** Le bois et la piste : ce qui ne tourne pas. */
const FOND = typeof document === 'undefined' ? null : calque((g) => {
  g.translate(C, C);
  let gr = g.createRadialGradient(0, 0, C * 0.7, 0, 0, C);
  gr.addColorStop(0, '#2a1508'); gr.addColorStop(0.55, '#6b3d1a'); gr.addColorStop(0.8, '#3b1d0e'); gr.addColorStop(1, '#1b0c05');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, C * 0.98, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d9b45a'; g.lineWidth = C * 0.012; g.beginPath(); g.arc(0, 0, C * 0.955, 0, Math.PI * 2); g.stroke();
  // la piste de la bille, en bois verni
  gr = g.createRadialGradient(0, 0, C * 0.7, 0, 0, C * 0.86);
  gr.addColorStop(0, '#1a0d06'); gr.addColorStop(0.6, '#4a2810'); gr.addColorStop(1, '#2a1508');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, C * 0.86, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,220,160,.25)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, C * 0.84, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
  // les losanges qui font rebondir la bille
  for (let k = 0; k < 8; k++) {
    g.save(); g.rotate((k * Math.PI) / 4 + Math.PI / 8); g.translate(0, -C * 0.72);
    const lg = g.createLinearGradient(-14, 0, 14, 0);
    lg.addColorStop(0, '#8a6a24'); lg.addColorStop(0.5, '#fff1c2'); lg.addColorStop(1, '#8a6a24');
    g.fillStyle = lg;
    g.beginPath(); g.moveTo(0, -26); g.lineTo(11, 0); g.lineTo(0, 26); g.lineTo(-11, 0); g.closePath(); g.fill();
    g.restore();
  }
});

/** Le cylindre : cases, numéros, cône et tourelle. */
const CYLINDRE = typeof document === 'undefined' ? null : calque((g) => {
  g.translate(C, C);
  const r1 = C * 0.68, r2 = C * 0.52, r3 = C * 0.45;
  for (let k = 0; k < 37; k++) {
    const n = R.ROUE[k];
    const a = -Math.PI / 2 + k * PAS;
    const coul = n === 0 ? '#1f8a5a' : R.ROUGES.has(n) ? '#b3243a' : '#16121a';
    g.fillStyle = coul;
    g.beginPath(); g.arc(0, 0, r1, a - PAS / 2, a + PAS / 2); g.arc(0, 0, r2, a + PAS / 2, a - PAS / 2, true); g.closePath(); g.fill();
    // le fond de case, plus sombre
    g.fillStyle = n === 0 ? '#145c3c' : R.ROUGES.has(n) ? '#7a1626' : '#0c0a0e';
    g.beginPath(); g.arc(0, 0, r2, a - PAS / 2, a + PAS / 2); g.arc(0, 0, r3, a + PAS / 2, a - PAS / 2, true); g.closePath(); g.fill();
    // le numéro
    g.save(); g.rotate(a + Math.PI / 2);
    g.fillStyle = '#fff'; g.font = `700 ${C * 0.058}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 0, -(r1 + r2) / 2 - C * 0.01);
    g.restore();
  }
  // les frettes dorées
  g.strokeStyle = '#d9b45a'; g.lineWidth = 3;
  for (let k = 0; k < 37; k++) {
    const a = -Math.PI / 2 + k * PAS + PAS / 2;
    g.beginPath(); g.moveTo(Math.cos(a) * r3, Math.sin(a) * r3); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
  }
  g.lineWidth = 5;
  for (const r of [r1, r2, r3]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  // le cône en bois
  const gr = g.createRadialGradient(-C * 0.08, -C * 0.1, C * 0.05, 0, 0, r3);
  gr.addColorStop(0, '#a8692c'); gr.addColorStop(0.6, '#6b3d1a'); gr.addColorStop(1, '#3b1d0e');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r3 - 3, 0, Math.PI * 2); g.fill();
  // la tourelle
  g.strokeStyle = '#d9b45a'; g.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    g.save(); g.rotate((k * Math.PI) / 2);
    g.lineWidth = C * 0.03; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -C * 0.3); g.stroke();
    const bg = g.createRadialGradient(-6, -C * 0.31 - 6, 2, 0, -C * 0.3, C * 0.045);
    bg.addColorStop(0, '#fff6d8'); bg.addColorStop(1, '#a8822c');
    g.fillStyle = bg; g.beginPath(); g.arc(0, -C * 0.3, C * 0.04, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const cg = g.createRadialGradient(-10, -10, 4, 0, 0, C * 0.09);
  cg.addColorStop(0, '#fff6d8'); cg.addColorStop(0.5, '#d9b45a'); cg.addColorStop(1, '#6b4c12');
  g.fillStyle = cg; g.beginPath(); g.arc(0, 0, C * 0.085, 0, Math.PI * 2); g.fill();
});

function dessiner(g, angleRoue, bille) {
  g.clearRect(0, 0, T, T);
  g.drawImage(FOND, 0, 0);
  g.save(); g.translate(C, C); g.rotate(angleRoue); g.drawImage(CYLINDRE, -C, -C); g.restore();
  if (bille) {
    const x = C + Math.cos(bille.a) * bille.r, y = C + Math.sin(bille.a) * bille.r;
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(x + 6, y + 8, C * 0.028, C * 0.022, 0, 0, Math.PI * 2); g.fill();
    const bg = g.createRadialGradient(x - 6, y - 7, 2, x, y, C * 0.03);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#e6e8ee'); bg.addColorStop(1, '#8c93a0');
    g.fillStyle = bg; g.beginPath(); g.arc(x, y, C * 0.027, 0, Math.PI * 2); g.fill();
  }
  // le reflet de la lampe au-dessus de la table
  const lg = g.createRadialGradient(C * 0.7, C * 0.55, 10, C * 0.8, C * 0.7, C * 0.9);
  lg.addColorStop(0, 'rgba(255,230,180,.16)'); lg.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(C, C, C * 0.98, 0, Math.PI * 2); g.fill();
}

const easeOut2 = (k) => 1 - (1 - k) ** 2;
const easeOut3 = (k) => 1 - (1 - k) ** 3;

/** La roue, pour d'autres écrans (le mode croupier). */
export const ROUE_DESSIN = { dessiner, T, C, PAS, RAYON_PISTE, RAYON_CASE, easeOut2, easeOut3 };

/* ------------------------------------------------------------------ */
/* La table                                                            */
/* ------------------------------------------------------------------ */

export function monterRoulette(app) {
  const rng = makeRng(Date.now() ^ 0x0de1);
  const croupier = creerCroupier($('rl-croupier'), 'henri');
  const placeDe = (s) => $('rl-joueurs').querySelector(`[data-s="${s}"]`);
  RX.brancher('s-roulette', { ancre: () => (enLigne && placeDe(moi)) || $('rl-jetons'), envoyer: (e) => { if (enLigne) EL.envoyer({ t: 'reaction', e }); } });
  const toile = $('rl-roue');
  toile.width = toile.height = T;
  const g = toile.getContext('2d');
  const cadre = $('rl-roue-cadre');
  const place = $('rl-roue-place');
  const scene = $('rl-scene');
  const tapis = $('rl-tapis');
  const soldeBarre = document.querySelector('#s-roulette .barre-solde');
  let angle = 0, oisive = 0, occupe = false;
  let paris = {}, actions = [], derniers = {};
  let jeton = 5;
  let histo = (() => { try { return JSON.parse(localStorage.getItem(CLE_HISTO)) || []; } catch { return []; } })();

  /* la roue tourne doucement quand personne ne joue */
  function ralenti(t0) {
    let prec = t0;
    const pas = (t) => {
      if (occupe || !$('s-roulette').classList.contains('is-active')) { oisive = 0; return; }
      angle += ((t - prec) / 1000) * 0.25; prec = t;
      dessiner(g, angle, null);
      oisive = requestAnimationFrame(pas);
    };
    oisive = requestAnimationFrame(pas);
  }

  /* ---------- le tapis ---------- */
  const zonesEl = {};
  for (const z of R.ZONES) {
    const el = document.createElement('div');
    el.className = `z ${z.point ? 'point' : z.type === 'plein' ? `case ${R.couleurDe(z.nums[0])}` : z.type}`;
    el.style.cssText = `--i:${z.i};--j:${z.j};--w:${z.w};--h:${z.h}`;
    el.dataset.id = z.id;
    el.title = `${z.nom} — paie ${R.paiement(z.nums)} pour 1`;
    if (z.type === 'plein') el.innerHTML = `<span class="num">${z.nums[0]}</span>`;
    else if (z.type === 'douzaine') el.innerHTML = `<span>${['1re 12', '2e 12', '3e 12'][Number(z.id[1]) - 1]}</span>`;
    else if (z.type === 'colonne') el.innerHTML = '<span>2:1</span>';
    else if (z.id === 'rouge' || z.id === 'noir') el.innerHTML = `<i class="losange ${z.id}"></i>`;
    else if (z.type === 'simple') el.innerHTML = `<span>${{ manque: '1-18', passe: '19-36', pair: 'Pair', impair: 'Impair' }[z.id]}</span>`;
    tapis.appendChild(el);
    zonesEl[z.id] = el;
  }
  const couverts = (id) => R.PAR_ID[id].nums.map((n) => zonesEl[`p${n}`]);
  tapis.addEventListener('pointerover', (e) => {
    const z = e.target.closest('.z');
    if (z) for (const c of couverts(z.dataset.id)) c.classList.add('survol');
  });
  tapis.addEventListener('pointerout', (e) => {
    const z = e.target.closest('.z');
    if (z) for (const c of couverts(z.dataset.id)) c.classList.remove('survol');
  });
  tapis.addEventListener('click', (e) => {
    const z = e.target.closest('.z');
    if (z) poser(z.dataset.id);
  });
  tapis.addEventListener('contextmenu', (e) => {
    const z = e.target.closest('.z');
    if (!z || occupe || !paris[z.dataset.id]) return;
    e.preventDefault();
    retirer(z.dataset.id);
  });

  const totalMise = () => Object.values(paris).reduce((s, v) => s + v, 0);

  function dessinerPile(id) {
    const el = zonesEl[id];
    el.querySelector('.pile')?.remove();
    if (paris[id] > 0) el.appendChild(fx.pile(paris[id], { max: 6 }));
  }

  function majCommandes() {
    const t = totalMise();
    $('rl-total').textContent = `Mise : ${fx.nombre(t)}`;
    $('rl-lancer').disabled = occupe || t === 0;
    $('rl-effacer').disabled = occupe || t === 0;
    $('rl-annuler').disabled = occupe || !actions.length;
    $('rl-doubler').disabled = occupe || t === 0 || t * 2 > app.solde();
    const d = Object.values(derniers).reduce((s, v) => s + v, 0);
    $('rl-remiser').disabled = occupe || d === 0 || d + t > app.solde();
    for (const j of $('rl-jetons').children) j.classList.toggle('trop', Number(j.dataset.v) + t > app.solde());
    if (enLigne && !occupe) envoyerParis();
  }

  function poser(id, v = jeton, { anime = true } = {}) {
    if (occupe) return;
    if (totalMise() + v > app.solde()) {
      croupier?.dire('Vous n’avez pas assez de jetons pour cela.', { voix: false });
      return;
    }
    nettoyerResultat();
    paris[id] = (paris[id] || 0) + v;
    actions.push({ id, v });
    dessinerPile(id);
    if (anime) {
      sfx.jeton();
      const p = zonesEl[id].querySelector('.pile');
      const choisi = $('rl-jetons').querySelector('.choisi');
      if (p && choisi) fx.arriver(p, choisi, { duree: 280, echelle: 1 });
    }
    majCommandes();
  }
  function retirer(id) {
    const v = paris[id];
    delete paris[id];
    actions = actions.filter((a) => a.id !== id);
    fx.volerJetons(v, zonesEl[id], $('rl-jetons'));
    sfx.jeton();
    dessinerPile(id);
    majCommandes();
  }

  /* les jetons à poser */
  for (const v of JETONS) {
    const j = fx.elJeton(v);
    j.setAttribute('role', 'button');
    j.setAttribute('aria-label', `Jeton de ${v}`);
    j.tabIndex = 0;
    j.addEventListener('click', () => {
      jeton = v;
      for (const x of $('rl-jetons').children) x.classList.toggle('choisi', x === j);
      sfx.clic();
    });
    if (v === jeton) j.classList.add('choisi');
    $('rl-jetons').appendChild(j);
  }

  $('rl-annuler').addEventListener('click', () => {
    const a = actions.pop();
    if (!a || occupe) return;
    paris[a.id] -= a.v;
    if (paris[a.id] <= 0) delete paris[a.id];
    sfx.jeton();
    dessinerPile(a.id);
    majCommandes();
  });
  $('rl-effacer').addEventListener('click', () => {
    if (occupe) return;
    for (const id of Object.keys(paris)) { fx.volerJetons(paris[id], zonesEl[id], $('rl-jetons'), { max: 3 }); }
    sfx.jetons(5);
    const ids = Object.keys(paris);
    paris = {}; actions = [];
    ids.forEach(dessinerPile);
    majCommandes();
  });
  $('rl-remiser').addEventListener('click', () => {
    if (occupe) return;
    for (const [id, v] of Object.entries(derniers)) poser(id, v, { anime: false });
    sfx.jetons(6);
  });
  $('rl-doubler').addEventListener('click', () => {
    if (occupe) return;
    for (const [id, v] of Object.entries({ ...paris })) poser(id, v, { anime: false });
    sfx.jetons(6);
  });

  /* ---------- l'historique ---------- */
  function majHisto() {
    $('rl-historique').innerHTML = histo.slice(0, 12).map((n) => `<span class="n-${R.couleurDe(n)}">${n}</span>`).join('');
  }

  /* ---------- le résultat posé sur le tapis ---------- */
  function nettoyerResultat() {
    tapis.querySelectorAll('.dolly').forEach((d) => d.remove());
    tapis.querySelectorAll('.gagnante').forEach((d) => d.classList.remove('gagnante'));
  }

  /* ---------- le lancer ---------- */
  function animerLancer(numero) {
    return new Promise((fin) => {
      const reduit = fx.reduit();
      const D = reduit ? 1500 : 7600;
      const W0 = angle, Wtot = Math.PI * 2 * (reduit ? 0.3 : 1.7);
      const B0 = -Math.PI / 2 + 0.3;
      const r0 = B0 - W0;
      const k = R.ROUE.indexOf(numero);
      const theta = -Math.PI / 2 + k * PAS;
      const cible = r0 - Math.PI * 2 * (reduit ? 2 : 9);
      const rFin = theta + Math.PI * 2 * Math.round((cible - theta) / (Math.PI * 2));
      const Tl = 0.84, T1 = 0.5;
      const W = (u) => W0 + Wtot * easeOut2(u);
      // la caméra : où sera la bille à la fin
      const aFin = W(1) + rFin;
      const ox = 50 + (Math.cos(aFin) * RAYON_CASE / T) * 100, oy = 50 + (Math.sin(aFin) * RAYON_CASE / T) * 100;
      let zoome = false, rienNeVaPlus = false, fini = false;
      // un onglet en arrière-plan ne dessine plus : la bille arrive quand même
      const terminer = () => {
        if (fini) return;
        fini = true;
        angle = W(1);
        dessiner(g, angle, { a: angle + rFin, r: RAYON_CASE });
        fin();
      };
      setTimeout(terminer, D + 400);
      const t0 = performance.now();
      const pas = (t) => {
        if (fini) return;
        const u = Math.min(1, (t - t0) / D);
        const a = W(u);
        const ur = Math.min(1, u / Tl);
        let r = r0 + (rFin - r0) * easeOut3(ur);
        let rayon = RAYON_PISTE;
        if (u > T1) {
          const v = Math.min(1, (u - T1) / (Tl - T1));
          rayon = RAYON_PISTE + (RAYON_CASE - RAYON_PISTE) * easeOut2(v);
          // les rebonds sur les losanges, puis contre les frettes
          rayon += Math.abs(Math.sin(v * Math.PI * 5)) * 26 * (1 - v) ** 1.5;
          r += Math.sin(v * Math.PI * 7) * 0.08 * (1 - v) ** 2;
        }
        angle = a;
        dessiner(g, a, { a: a + r, r: rayon });
        if (!rienNeVaPlus && u > 0.35) {
          rienNeVaPlus = true;
          annonceScene('Rien ne va plus');
          croupier.dire('Rien ne va plus.', { duree: 1500 });
        }
        if (!zoome && u > 0.62 && !reduit) {
          zoome = true;
          cadre.style.transformOrigin = `${ox}% ${oy}%`;
          cadre.style.transform = 'scale(1.75)';
        }
        if (u < 1) requestAnimationFrame(pas);
        else terminer();
      };
      requestAnimationFrame(pas);
      sfx.bille(D / 1000);
    });
  }

  function annonceScene(txt, classe = '') {
    let a = scene.querySelector('.annonce');
    if (!a) { a = document.createElement('p'); a.className = 'annonce'; scene.appendChild(a); }
    a.className = `annonce ${classe}`;
    a.textContent = txt;
    a.animate([{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 300, fill: 'both' });
  }

  async function lancer() {
    if (occupe || !totalMise()) return;
    if (enLigne) {
      EL.envoyer({ t: 'pret' });
      $('rl-lancer').disabled = true;
      $('rl-lancer').textContent = 'Prêt ✓';
      return;
    }
    await tourner(R.tirer(rng));
  }

  /** Un tour de roue jusqu'à `numero` (tiré ici quand on joue seul, par le serveur en ligne). */
  async function tourner(numero) {
    let total = totalMise();
    if (total && !app.debiter(total)) {
      croupier.dire('Vous n’avez pas assez de jetons : vos mises sont retirées.', { voix: false });
      const ids = Object.keys(paris);
      paris = {}; actions = [];
      ids.forEach(dessinerPile);
      total = 0;
    }
    occupe = true;
    cancelAnimationFrame(oisive);
    majCommandes();
    nettoyerResultat();
    if (total) derniers = { ...paris };
    croupier.lance();
    croupier.dire('Les jeux sont faits.');
    sfx.jetons(4);
    await fx.attendre(700);

    // la roue au premier plan
    scene.hidden = false;
    scene.querySelector('.annonce')?.remove();
    scene.appendChild(cadre);
    cadre.style.transform = '';
    await animerLancer(numero);

    const coul = R.couleurDe(numero);
    annonceScene(R.annonce(numero), coul);
    croupier.dire(R.annonce(numero), { duree: 2600 });
    fx.flash(coul === 'rouge' ? 'rgba(179,36,58,.3)' : coul === 'vert' ? 'rgba(31,138,90,.3)' : 'rgba(255,255,255,.15)', 400);
    await fx.attendre(1900);
    cadre.style.transform = '';
    await fx.attendre(500);
    scene.hidden = true;
    place.appendChild(cadre);

    // le résultat sur le tapis
    histo.unshift(numero);
    histo = histo.slice(0, 40);
    if (!enLigne) { try { localStorage.setItem(CLE_HISTO, JSON.stringify(histo)); } catch { /* ignore */ } }
    majHisto();
    const caseG = zonesEl[`p${numero}`];
    const dolly = document.createElement('i');
    dolly.className = 'dolly';
    caseG.appendChild(dolly);
    caseG.classList.add('gagnante');
    sfx.retourne();

    // les mises des autres joueurs : ramassées ou payées, sans toucher à ma caisse
    for (const [s, p] of Object.entries(autres)) {
      for (const [id, v] of Object.entries(p)) {
        const el = zonesEl[id]?.querySelector(`.autre[data-s="${s}"]`);
        if (!el) continue;
        if (R.PAR_ID[id].nums.includes(numero)) { fx.volerJetons(v * (R.paiement(R.PAR_ID[id].nums) + 1), zonesEl[id], $('rl-joueurs'), { max: 3 }); }
        else fx.volerJetons(v, zonesEl[id], croupier.el, { max: 2 });
        el.remove();
      }
    }

    const { retour, gagnants, perdants } = R.regler(paris, numero);
    // Henri applaudit un plein ; il savoure quand la banque ramasse tout
    if (gagnants.some((id) => R.PAR_ID[id].type === 'plein')) RX.montrer('👏', croupier.el, { delai: 1200 });
    else if (total > 0 && !gagnants.length && Math.random() < 0.4) RX.montrer('😎', croupier.el, { delai: 900 });
    await fx.attendre(500);
    if (perdants.length) {
      croupier.ramasse();
      perdants.forEach((id) => { fx.volerJetons(paris[id], zonesEl[id], croupier.el, { max: 3, duree: 500, etalement: 30 }); zonesEl[id].querySelector('.pile')?.remove(); });
      sfx.jetons(Math.min(10, perdants.length * 2), 0.6);
      await fx.attendre(700);
    }
    if (gagnants.length) {
      croupier.paie();
      for (const id of gagnants) {
        zonesEl[id].classList.add('gagnante');
        const gain = paris[id] * R.paiement(R.PAR_ID[id].nums);
        fx.volerJetons(gain, croupier.el, zonesEl[id], { max: 6 });
        fx.texte(`+${fx.nombre(gain)}`, zonesEl[id]);
      }
      sfx.jetons(10, 0.8);
      await fx.attendre(900);
      for (const id of gagnants) { fx.volerJetons(paris[id] * (R.paiement(R.PAR_ID[id].nums) + 1), zonesEl[id], soldeBarre, { max: 5 }); zonesEl[id].querySelector('.pile')?.remove(); }
      await fx.attendre(500);
      app.crediter(retour);
      const net = retour - total;
      if (net > 0) app.gainNet(net);
      const plein = gagnants.some((id) => R.PAR_ID[id].type === 'plein');
      if (plein) { app.succes('velours-plein'); app.stat('pleins'); }
      if (plein || net >= 500) {
        sfx.gain(true);
        fx.pluieDeJetons(plein ? 80 : 50);
        fx.confettis(caseG, 70);
        fx.texte(plein ? 'EN PLEIN !' : `+${fx.nombre(net)}`, tapis, 'gros');
        croupier.sourit(2400);
        croupier.dire(plein ? 'En plein ! Magnifique.' : 'Belle main, félicitations.');
      } else if (net > 0) {
        sfx.gain();
        croupier.sourit();
      } else {
        croupier.dire(net === 0 ? 'Vous retrouvez votre mise.' : 'Un petit gain, pas assez cette fois.', { voix: false });
      }
    } else if (total) {
      sfx.perte();
      if (total >= 200) croupier.desole();
      croupier.dire('Faites vos jeux.', { duree: 1800 });
    }
    paris = {}; actions = [];
    envoye = '{}';
    if (!enLigne) {
      occupe = false;
      majCommandes();
      ralenti(performance.now());
    } else majCommandes();
  }

  $('rl-lancer').addEventListener('click', lancer);
  addEventListener('keydown', (e) => {
    if (!$('s-roulette').classList.contains('is-active') || e.repeat || document.querySelector('.ov:not([hidden])')) return;
    if (e.key === 'Enter') lancer();
    if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) $('rl-annuler').click();
  });

  majHisto();

  /* ---------- en ligne ---------- */
  const COULEURS = ['#e8c35a', '#5ab4e8', '#e85a9b', '#7be85a', '#b38bff', '#ff8a4c', '#4ce8d0', '#f4ead6'];
  let enLigne = false, moi = 0, membres = [], autres = {}, envoye = '{}', envoiT = 0;
  let compteFin = 0, compteT = 0, file = Promise.resolve();

  function envoyerParis() {
    clearTimeout(envoiT);
    envoiT = setTimeout(() => {
      const j = JSON.stringify(paris);
      if (j === envoye || occupe) return;
      envoye = j;
      EL.envoyer({ t: 'paris', paris });
    }, 200);
  }

  function dessinerAutres() {
    tapis.querySelectorAll('.autre').forEach((x) => x.remove());
    for (const [s, p] of Object.entries(autres)) {
      if (Number(s) === moi) continue;
      for (const [id, v] of Object.entries(p)) {
        const z = zonesEl[id];
        if (!z) continue;
        const k = z.querySelectorAll('.autre').length;
        const el = document.createElement('span');
        el.className = 'autre';
        el.dataset.s = s;
        el.style.cssText = `--c:${COULEURS[Number(s) % COULEURS.length]};--k:${k}`;
        el.textContent = v >= 1000 ? `${Math.round(v / 100) / 10}k` : v;
        z.appendChild(el);
      }
    }
  }

  function dessinerJoueurs() {
    const el = $('rl-joueurs');
    el.hidden = !enLigne;
    el.innerHTML = membres.map((m) => {
      const t = Object.values(autres[m.s] || {}).reduce((a, v) => a + v, 0);
      return `<span data-s="${m.s}" class="joueur${m.s === moi ? ' moi' : ''}${m.absent ? ' absent' : ''}" style="--c:${COULEURS[m.s % COULEURS.length]}">${m.avatar} ${m.s === moi ? 'Vous' : m.nom}${t && m.s !== moi ? ` <b>${fx.nombre(t)}</b>` : ''}</span>`;
    }).join('');
  }

  function compte(reste) {
    clearInterval(compteT);
    compteFin = reste > 0 ? Date.now() + reste : 0;
    const el = $('rl-compte');
    const maj = () => {
      const s = Math.max(0, Math.ceil((compteFin - Date.now()) / 1000));
      el.hidden = !compteFin || !enLigne || s === 0;
      el.textContent = s > 3 ? `Rien ne va plus dans ${s} s` : `Dernières mises… ${s}`;
      el.classList.toggle('urgent', s <= 5);
      if (!s) clearInterval(compteT);
    };
    maj();
    if (compteFin) compteT = setInterval(maj, 250);
  }

  function libellerLancer() {
    $('rl-lancer').textContent = enLigne && membres.filter((m) => !m.absent).length > 1 ? 'Je suis prêt' : 'Lancer la bille';
  }

  EL.ecouter((m) => {
    if (m.jeu && m.jeu !== 'roulette') return;
    if (m.t === 'etat' && m.jeu === 'roulette') {
      enLigne = true;
      moi = m.moi; membres = m.membres;
      autres = { ...m.paris };
      paris = { ...(m.paris[moi] || {}) };
      envoye = JSON.stringify(paris);
      Object.keys(zonesEl).forEach(dessinerPile);
      histo = [...m.histo];
      majHisto();
      occupe = m.phase !== 'mises';
      libellerLancer();
      dessinerAutres(); dessinerJoueurs();
      compte(m.compte);
      majCommandes();
      $('rl-code').hidden = false;
      $('rl-code').textContent = `Table ${m.code}`;
      $('rl-code').dataset.code = m.code;
      return;
    }
    if (!enLigne) return;
    switch (m.t) {
      case 'membres':
        membres = m.liste;
        if (!occupe) libellerLancer();
        for (const s of Object.keys(autres)) if (!membres.some((x) => x.s === Number(s))) delete autres[s];
        dessinerAutres(); dessinerJoueurs();
        if (m.arrive && m.arrive !== EL.identite().nom) croupier.dire(`Bienvenue, ${m.arrive}.`, { voix: false });
        break;
      case 'reaction':
        if (m.s !== moi) RX.montrer(m.e, placeDe(m.s));
        break;
      case 'paris':
        if (m.s === moi) break;
        autres[m.s] = m.paris;
        dessinerAutres(); dessinerJoueurs();
        sfx.jeton();
        break;
      case 'compte': compte(m.reste); break;
      case 'lance':
        compte(0);
        clearTimeout(envoiT);
        file = file.then(() => tourner(m.numero));
        break;
      case 'tour':
        file = file.then(() => {
          autres = {};
          occupe = false;
          libellerLancer();
          dessinerAutres(); dessinerJoueurs();
          majCommandes();
          ralenti(performance.now());
        });
        break;
      case 'parti': sortirEnLigne(); break;
      case 'erreur': croupier.dire(m.msg, { voix: false }); break;
    }
  });

  function sortirEnLigne() {
    enLigne = false; moi = 0; membres = []; autres = {};
    occupe = false;
    compte(0);
    $('rl-code').hidden = true;
    try { histo = JSON.parse(localStorage.getItem(CLE_HISTO)) || []; } catch { histo = []; }
    majHisto();
    libellerLancer();
    dessinerAutres(); dessinerJoueurs();
    majCommandes();
  }

  return {
    entrer() {
      dessiner(g, angle, null);
      if (!occupe) ralenti(performance.now());
      libellerLancer();
      majCommandes();
      if (!enLigne) setTimeout(() => croupier.dire(app.solde() < 1 ? 'Bonsoir. Il vous faut des jetons : passez à la boutique.' : 'Bonsoir. Mesdames et messieurs, faites vos jeux.'), 500);
    },
    sortir() {
      croupier?.taire(); cancelAnimationFrame(oisive); oisive = 0;
      if (enLigne) { EL.quitter(); sortirEnLigne(); }
    },
    enLigne: () => enLigne,
  };
}
