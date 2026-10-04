/**
 * SKULL KING — la feuille de score, pour compter les points d'une vraie partie.
 *
 * Manche par manche : on touche une case, on choisit le nombre. Les points se
 * calculent tout seuls, le classement suit. Tout reste dans le navigateur.
 */

import { points } from '../../../shared/skullking/moteur.js';

const $ = (id) => document.getElementById(id);
const txt = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CLE = 'skullking.feuille';
const MANCHES = 10;
const MAX = 8;
const NOMS = ['Ruben', 'Thomas', 'Sacha', 'Mathis', 'Amine'];

const vide = () => ({ b: null, t: null, o: 0 });
function neuve(noms = NOMS) {
  return { noms: noms.slice(), m: Array.from({ length: MANCHES }, () => noms.map(vide)), courante: 1, bonusToujours: true };
}

let F = (() => {
  try {
    const x = JSON.parse(localStorage.getItem(CLE));
    if (x && Array.isArray(x.noms) && Array.isArray(x.m) && x.m.length === MANCHES) return x;
  } catch { /* première fois */ }
  return neuve();
})();
const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(F)); } catch { /* ignore */ } };

let o = null; // { toast, sfx, ouvrir, fermer }
let vue = 'manche';

/* ------------------------------------------------------------------ */
/* Le calcul                                                          */
/* ------------------------------------------------------------------ */

const ptsDe = (r, v) => (v.b == null || v.t == null ? null : points(r, v.b, v.t, v.o || 0, { bonusToujours: F.bonusToujours }));
const totalJusqua = (p, r) => {
  let s = 0;
  for (let i = 1; i <= r; i++) { const x = ptsDe(i, F.m[i - 1][p]); if (x != null) s += x; }
  return s;
};
const totaux = () => F.noms.map((_, p) => totalJusqua(p, MANCHES));
const mancheFaite = (r) => F.m[r - 1].every((v) => v.b != null && v.t != null);

/* ------------------------------------------------------------------ */
/* Le rendu                                                           */
/* ------------------------------------------------------------------ */

export function afficherScore() {
  const t = totaux();
  const cl = F.noms.map((n, p) => ({ n, s: t[p] })).sort((a, b) => b.s - a.s);
  $('sc-classement').innerHTML = cl.map((x, i) =>
    `<div class="${i === 0 && x.s > 0 ? 'premier' : ''}">${i === 0 ? '👑' : `${i + 1}.`} ${txt(x.n)} <b>${x.s}</b></div>`).join('');

  document.querySelectorAll('.onglet').forEach((b) => b.classList.toggle('is-on', b.dataset.vue === vue));
  $('sc-vue-manche').hidden = vue !== 'manche';
  $('sc-vue-tableau').hidden = vue !== 'tableau';
  if (vue === 'manche') rendreManche(); else rendreTableau();
}

function rendreManche() {
  const r = F.courante;
  $('sc-pastilles').innerHTML = Array.from({ length: MANCHES }, (_, i) =>
    `<button class="${i + 1 === r ? 'is-on' : ''}${mancheFaite(i + 1) ? ' faite' : ''}" data-manche="${i + 1}" aria-label="Manche ${i + 1}">${i + 1}</button>`).join('');

  const lignes = F.m[r - 1];
  const paris = lignes.filter((v) => v.b != null);
  const plis = lignes.filter((v) => v.t != null);
  const sp = paris.reduce((s, v) => s + v.b, 0);
  const st = plis.reduce((s, v) => s + v.t, 0);
  let info = `${r} carte${r > 1 ? 's' : ''} chacun`;
  let cls = '';
  if (paris.length === lignes.length) info = `Annoncés : ${sp} pour ${r}`;
  if (plis.length === lignes.length) {
    if (st > r) { info = `⚠ ${st} plis notés pour ${r} cartes`; cls = 'alerte'; }
    else if (st === r) { info = `✓ ${st} pli${st > 1 ? 's' : ''} sur ${r}`; cls = 'juste'; }
    else info = `${st} pli${st > 1 ? 's' : ''} sur ${r} (Kraken ?)`;
  }
  $('sc-entete').innerHTML = `<h3>Manche ${r}</h3><span class="${cls}">${info}</span>`;

  $('sc-joueurs').innerHTML = F.noms.map((n, p) => {
    const v = lignes[p];
    const x = ptsDe(r, v);
    const etat = x == null ? '' : v.b === v.t ? 'ok' : 'ko';
    const pts = x == null ? '<span class="sc-points vide">à remplir</span>'
      : `<span class="sc-points ${x >= 0 ? 'plus' : 'moins'}">${x >= 0 ? '+' : ''}${x}</span>`;
    const c = (k, label, val, cl = '') => `<button class="sc-case ${cl}" data-case="${k}" data-p="${p}"><span>${label}</span><b class="${val == null ? 'vide' : ''}">${val == null ? '?' : val}</b></button>`;
    return `<div class="sc-joueur ${etat}">
      <div class="sc-qui"><b>${txt(n)}</b><i>${pts} · total ${totalJusqua(p, r)}</i></div>
      ${c('b', 'Pari', v.b)}${c('t', 'Plis', v.t)}${c('o', 'Bonus', v.o ? `+${v.o}` : 0, 'bonus')}</div>`;
  }).join('');
  $('sc-prec').disabled = r <= 1;
  $('sc-suiv').disabled = r >= MANCHES;
}

function rendreTableau() {
  let h = `<thead><tr><th>#</th>${F.noms.map((n) => `<th>${txt(n)}</th>`).join('')}</tr></thead><tbody>`;
  for (let r = 1; r <= MANCHES; r++) {
    h += `<tr class="cliquable${r === F.courante ? ' courante' : ''}" data-manche="${r}"><td>${r}</td>`;
    F.m[r - 1].forEach((v, p) => {
      const x = ptsDe(r, v);
      h += x == null ? `<td><span class="cum">${v.b != null ? `pari ${v.b}` : '·'}</span></td>`
        : `<td><span class="pts ${x >= 0 ? 'plus' : 'moins'}">${x >= 0 ? '+' : ''}${x}</span><span class="cum">${v.b}/${v.t}${v.o ? ` +${v.o}` : ''} · ${totalJusqua(p, r)}</span></td>`;
    });
    h += '</tr>';
  }
  h += `<tr class="total"><td>Σ</td>${totaux().map((s) => `<td>${s}</td>`).join('')}</tr></tbody>`;
  $('sc-tableau').innerHTML = h;
}

/* ------------------------------------------------------------------ */
/* Saisie                                                             */
/* ------------------------------------------------------------------ */

let saisie = null; // { p, k }

function ouvrirNombre(p, k) {
  const r = F.courante;
  saisie = { p, k };
  const v = F.m[r - 1][p][k];
  $('nombre-titre').textContent = `${F.noms[p]} — ${k === 'b' ? 'pari' : 'plis remportés'}`;
  $('nombre-sous').textContent = k === 'b' ? `Manche ${r} : de 0 à ${r}` : `Plis ramassés par ${F.noms[p]} pendant la manche`;
  $('nombre-grille').innerHTML = Array.from({ length: r + 1 }, (_, i) => `<button class="${v === i ? 'is-on' : ''}" data-n="${i}">${i}</button>`).join('');
  o.ouvrir('ov-nombre');
}

$('nombre-grille').addEventListener('click', (e) => {
  const b = e.target.closest('[data-n]');
  if (!b || !saisie) return;
  F.m[F.courante - 1][saisie.p][saisie.k] = +b.dataset.n;
  sauver();
  o.sfx.clic();
  const { p, k } = saisie;
  o.fermer('ov-nombre');
  afficherScore();
  // On enchaîne sur le joueur suivant tant que sa case est vide : saisir les paris de tous va vite.
  const suivant = F.m[F.courante - 1].findIndex((v, i) => i > p && v[k] == null);
  if (suivant >= 0) ouvrirNombre(suivant, k);
});
$('nombre-effacer').addEventListener('click', () => {
  if (!saisie) return;
  F.m[F.courante - 1][saisie.p][saisie.k] = null;
  sauver();
  o.fermer('ov-nombre');
  afficherScore();
});

const BONUS = [
  { v: 10, t: '14 de couleur', d: 'jaune, vert ou violet' },
  { v: 20, t: '14 noir', d: 'le 14 du pavillon' },
  { v: 30, t: 'Skull King', d: 'prend un pirate' },
  { v: 20, t: 'Pirate', d: 'prend une sirène' },
  { v: 40, t: 'Sirène', d: 'prend le Skull King' },
  { v: -10, t: 'Corriger', d: 'retirer 10' },
];

function ouvrirBonus(p) {
  saisie = { p, k: 'o' };
  $('bonus-titre').textContent = `Bonus de ${F.noms[p]}`;
  $('bonus-grille').innerHTML = BONUS.map((b, i) => `<button data-bonus="${i}"><b>${b.v > 0 ? '+' : '−'}${Math.abs(b.v)} · ${b.t}</b><i>${b.d}</i></button>`).join('');
  majBonus();
  o.ouvrir('ov-bonus');
}
function majBonus() { $('bonus-total').textContent = `+${F.m[F.courante - 1][saisie.p].o || 0}`; }

$('bonus-grille').addEventListener('click', (e) => {
  const b = e.target.closest('[data-bonus]');
  if (!b || !saisie) return;
  const v = F.m[F.courante - 1][saisie.p];
  v.o = Math.max(0, (v.o || 0) + BONUS[+b.dataset.bonus].v);
  sauver();
  o.sfx.clic();
  majBonus();
  afficherScore();
});
$('bonus-zero').addEventListener('click', () => {
  F.m[F.courante - 1][saisie.p].o = 0;
  sauver();
  majBonus();
  afficherScore();
});

/* ------------------------------------------------------------------ */
/* Réglages : joueurs, règle des bonus, nouvelle partie               */
/* ------------------------------------------------------------------ */

function rendreNoms() {
  $('sc-noms').innerHTML = F.noms.map((n, p) => `<div class="sc-nom-ligne">
    <input value="${txt(n)}" maxlength="14" data-nom="${p}" aria-label="Nom du joueur ${p + 1}">
    ${F.noms.length > 2 ? `<button data-retire="${p}" aria-label="Retirer ${txt(n)}">✕</button>` : ''}</div>`).join('');
  $('sc-ajouter').disabled = F.noms.length >= MAX;
  $('sc-bonus-toujours').checked = !!F.bonusToujours;
}

$('sc-noms').addEventListener('input', (e) => {
  const i = e.target.dataset.nom;
  if (i == null) return;
  F.noms[+i] = e.target.value.trim() || `Joueur ${+i + 1}`;
  sauver();
  afficherScore();
});
$('sc-noms').addEventListener('click', (e) => {
  const b = e.target.closest('[data-retire]');
  if (!b) return;
  const p = +b.dataset.retire;
  F.noms.splice(p, 1);
  F.m.forEach((l) => l.splice(p, 1));
  sauver();
  rendreNoms();
  afficherScore();
});
$('sc-ajouter').addEventListener('click', () => {
  if (F.noms.length >= MAX) return;
  F.noms.push(`Joueur ${F.noms.length + 1}`);
  F.m.forEach((l) => l.push(vide()));
  sauver();
  rendreNoms();
  afficherScore();
  const champs = $('sc-noms').querySelectorAll('input');
  champs[champs.length - 1].select();
});
$('sc-bonus-toujours').addEventListener('change', (e) => {
  F.bonusToujours = e.target.checked;
  sauver();
  afficherScore();
});

let confirmer = 0;
$('sc-nouvelle').addEventListener('click', () => {
  const b = $('sc-nouvelle');
  if (!confirmer) {
    b.textContent = 'Sûr ? Touchez encore pour tout effacer';
    confirmer = setTimeout(() => { confirmer = 0; b.textContent = 'Nouvelle partie'; }, 3000);
    return;
  }
  clearTimeout(confirmer);
  confirmer = 0;
  b.textContent = 'Nouvelle partie';
  const regle = F.bonusToujours;
  F = neuve(F.noms);
  F.bonusToujours = regle;
  sauver();
  o.fermer('ov-options');
  afficherScore();
  o.toast('Nouvelle partie : les noms sont gardés, les scores effacés.');
});

/* ------------------------------------------------------------------ */
/* Branchements                                                       */
/* ------------------------------------------------------------------ */

export function installerScore(outils) {
  o = outils;
  $('sc-joueurs').addEventListener('click', (e) => {
    const c = e.target.closest('[data-case]');
    if (!c) return;
    if (c.dataset.case === 'o') ouvrirBonus(+c.dataset.p);
    else ouvrirNombre(+c.dataset.p, c.dataset.case);
  });
  const allerA = (r) => { F.courante = Math.min(MANCHES, Math.max(1, r)); sauver(); vue = 'manche'; afficherScore(); };
  $('sc-pastilles').addEventListener('click', (e) => { const b = e.target.closest('[data-manche]'); if (b) allerA(+b.dataset.manche); });
  $('sc-tableau').addEventListener('click', (e) => { const b = e.target.closest('[data-manche]'); if (b) allerA(+b.dataset.manche); });
  $('sc-prec').addEventListener('click', () => allerA(F.courante - 1));
  $('sc-suiv').addEventListener('click', () => allerA(F.courante + 1));
  document.querySelectorAll('.onglet').forEach((b) => b.addEventListener('click', () => { vue = b.dataset.vue; afficherScore(); }));
  $('b-score-options').addEventListener('click', () => { rendreNoms(); o.ouvrir('ov-options'); });
}
