/**
 * LE VELOURS NOIR — la table de Texas Hold'em, avec Victor.
 *
 * Le joueur s'assoit avec une « cave » prise dans sa caisse, face à quatre
 * habitués aux caractères différents. Quand l'un d'eux n'a plus de jetons,
 * il quitte la table et un autre prend sa place. Les jetons de table
 * reviennent dans la caisse quand on se lève (et même si l'on ferme la page :
 * ils sont rendus à la prochaine visite).
 */

import * as P from '../../../shared/casino/poker.js';
import { makeRng } from '../../../shared/hasard.js';
import { creerCroupier } from './croupier.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);
const CLE_TABLE = 'velours.poker.assis';

const HABITUES = [
  { nom: 'Lucienne', avatar: '👒', style: 'prudent' },
  { nom: 'Le Baron', avatar: '🎩', style: 'requin' },
  { nom: 'Tony', avatar: '🕶️', style: 'flambeur' },
  { nom: 'Mme Irma', avatar: '🔮', style: 'bluffeur' },
  { nom: 'Kevin', avatar: '🧢', style: 'touriste' },
  { nom: 'Dolores', avatar: '💃', style: 'flambeur' },
  { nom: 'Le Professeur', avatar: '🧐', style: 'prudent' },
  { nom: 'Gaston', avatar: '🥖', style: 'touriste' },
  { nom: 'Vera', avatar: '🦊', style: 'bluffeur' },
  { nom: 'Sergueï', avatar: '🐻', style: 'requin' },
];

const TABLES = [
  { id: 'habitues', nom: 'Table des habitués', petite: 5, caveMin: 200, caveMax: 1000, bots: [400, 1200] },
  { id: 'salon', nom: 'Salon privé', petite: 25, caveMin: 1000, caveMax: 5000, bots: [2000, 6000] },
];

const QUOI = { coucher: 'Se couche', parole: 'Parole', suivre: 'Suit', miser: 'Mise', relancer: 'Relance', tapis: 'Tapis !' };

export function monterPoker(app, aller) {
  const rng = makeRng(Date.now() ^ 0x9e3);
  let croupier = null;
  let t = null, table = TABLES[0], assis = false, boucleEnCours = false;
  let ui = null;                  // { jetons[], mise[], pot }
  let siegesEl = [];
  let humain = null;              // résolution de l'action attendue
  let suivante = null;            // résolution de « main suivante »

  const feutre = $('pk-feutre');
  const soldeBarre = document.querySelector('#s-poker .barre-solde');

  /* des jetons restés à une table quand la page s'est fermée */
  try {
    const reste = JSON.parse(localStorage.getItem(CLE_TABLE));
    if (reste?.jetons > 0) app.crediter(reste.jetons);
    localStorage.removeItem(CLE_TABLE);
  } catch { /* ignore */ }
  const garder = (n) => { try { localStorage.setItem(CLE_TABLE, JSON.stringify({ jetons: n })); } catch { /* ignore */ } };

  /* ---------- la cave ---------- */
  function ouvrirCave() {
    const ov = $('ov-cave');
    const liste = $('pk-tables');
    liste.innerHTML = '';
    for (const tb of TABLES) {
      const b = document.createElement('button');
      b.className = `table-choix${tb === table ? ' is-on' : ''}`;
      b.disabled = app.solde() < tb.caveMin;
      b.innerHTML = `<b>${tb.nom}</b><span>Blindes ${tb.petite} / ${tb.petite * 2} · cave de ${fx.nombre(tb.caveMin)} à ${fx.nombre(tb.caveMax)}</span>`;
      b.addEventListener('click', () => { table = tb; ouvrirCave(); sfx.clic(); });
      liste.appendChild(b);
    }
    if (app.solde() < table.caveMin) table = TABLES.find((x) => app.solde() >= x.caveMin) || table;
    const max = Math.min(table.caveMax, app.solde());
    const r = $('pk-cave');
    r.min = table.caveMin; r.max = Math.max(table.caveMin, max); r.step = table.petite * 2;
    r.value = Math.min(max, Math.max(table.caveMin, Math.round((table.caveMin * 2) / 10) * 10));
    $('pk-cave-val').textContent = fx.nombre(Number(r.value));
    const peut = app.solde() >= table.caveMin;
    $('pk-asseoir').disabled = !peut;
    $('pk-cave-note').textContent = peut ? 'Vos jetons de table reviennent dans votre caisse quand vous quittez la table.' : `Il faut au moins ${fx.nombre(TABLES[0].caveMin)} jetons pour s’asseoir. Passez à la caisse du hall.`;
    ov.hidden = false;
  }
  $('pk-cave').addEventListener('input', (e) => { $('pk-cave-val').textContent = fx.nombre(Number(e.target.value)); });
  $('ov-cave').addEventListener('click', (e) => {
    if ((e.target.closest('[data-ferme]') || e.target === $('ov-cave')) && !assis) setTimeout(() => aller('s-hall'), 50);
  });
  $('pk-asseoir').addEventListener('click', () => {
    const cave = Number($('pk-cave').value);
    if (!app.debiter(cave)) return;
    $('ov-cave').hidden = true;
    if (assis && t) {
      // une recave
      t.joueurs[0].jetons += cave;
      ui.jetons[0] = t.joueurs[0].jetons;
      majSiege(0);
      garder(t.joueurs[0].jetons);
      $('pk-recave').hidden = true;
      const s = suivante; suivante = null; s?.();
      return;
    }
    asseoir(cave);
  });

  function nouveauBot(exclus) {
    const libres = HABITUES.filter((h) => !exclus.includes(h.nom));
    const h = libres[Math.floor(rng() * libres.length)];
    const [a, b] = table.bots;
    const jetons = Math.round((a + rng() * (b - a)) / (table.petite * 2)) * table.petite * 2;
    return { ...h, jetons };
  }

  function asseoir(cave) {
    const bots = [];
    for (let k = 0; k < 4; k++) bots.push(nouveauBot(bots.map((x) => x.nom)));
    t = P.creerTable({ rng, petite: table.petite, sieges: [{ nom: 'Vous', avatar: '🙂', jetons: cave }, ...bots] });
    t.bouton = Math.floor(rng() * 5) - 1;
    assis = true;
    garder(cave);
    $('pk-titre').textContent = `${table.nom} · ${table.petite}/${table.petite * 2}`;
    ui = { jetons: t.joueurs.map((j) => j.jetons), mise: [0, 0, 0, 0, 0], pot: 0 };
    dessinerSieges();
    croupier.dire('Bienvenue. Bonne chance à tous.');
    sfx.jetons(8);
    boucle();
  }

  /* ---------- les sièges ---------- */
  function dessinerSieges() {
    const hote = $('pk-sieges');
    hote.innerHTML = '';
    siegesEl = t.joueurs.map((j, i) => {
      const el = document.createElement('div');
      el.className = `siege s${i}`;
      el.innerHTML = `
        <div class="cartes-siege"></div>
        <div class="plaque">
          <span class="avatar">${j.avatar}</span>
          <span class="infos"><span class="nom">${j.nom}</span><span class="tapis-j"></span>${j.style ? `<span class="style">${P.STYLES[j.style].nom}</span>` : ''}</span>
          <span class="action-j"></span>
        </div>
        <span class="main-nom"></span>
        <div class="mise-j"></div>`;
      hote.appendChild(el);
      return el;
    });
    t.joueurs.forEach((_, i) => majSiege(i));
  }

  function majSiege(i) {
    const el = siegesEl[i];
    const j = t.joueurs[i];
    el.querySelector('.tapis-j').textContent = fx.nombre(ui.jetons[i]);
    el.classList.toggle('absent', ui.jetons[i] <= 0 && j.absent);
  }
  function majMise(i) {
    const m = siegesEl[i].querySelector('.mise-j');
    m.innerHTML = '';
    if (ui.mise[i] > 0) m.appendChild(fx.pile(ui.mise[i], { max: 6 }));
  }
  function majPot() {
    const b = $('pk-pot').querySelector('b');
    fx.compter(b, ui.pot, 400);
  }
  function etiquette(i, texte, classe = '') {
    const a = siegesEl[i].querySelector('.action-j');
    a.textContent = texte;
    a.className = `action-j vue ${classe}`;
    clearTimeout(a._t);
    if (classe !== 'couche') a._t = setTimeout(() => a.classList.remove('vue'), 2200);
  }
  function aSonTour(i) { siegesEl.forEach((el, k) => el.classList.toggle('a-son-tour', k === i)); }
  function penser(i, oui) {
    const n = siegesEl[i].querySelector('.nom');
    n.parentElement.querySelector('.pense')?.remove();
    if (oui) n.insertAdjacentHTML('afterend', '<span class="pense"><i></i><i></i><i></i></span>');
  }

  /* ---------- rejouer les événements ---------- */
  async function jouer(evts) {
    for (const e of evts) {
      if (!assis) return;
      switch (e.type) {
        case 'nouvelle-main': {
          $('pk-board').innerHTML = '';
          $('pk-annonce').textContent = '';
          ui.pot = 0; majPot();
          ui.mise = [0, 0, 0, 0, 0];
          siegesEl.forEach((el, i) => {
            el.classList.remove('couche', 'gagnant', 'a-son-tour');
            el.querySelector('.cartes-siege').innerHTML = '';
            el.querySelector('.main-nom').textContent = '';
            el.querySelector('.action-j').className = 'action-j';
            el.querySelector('.bouton-d')?.remove();
            majMise(i); majSiege(i);
          });
          const d = document.createElement('span');
          d.className = 'bouton-d';
          d.textContent = 'D';
          siegesEl[e.bouton].appendChild(d);
          fx.pop(d, 1.4);
          sfx.melange();
          await fx.attendre(500);
          break;
        }
        case 'blinde':
          ui.jetons[e.i] -= e.montant; ui.mise[e.i] += e.montant;
          majSiege(e.i); majMise(e.i);
          fx.arriver(siegesEl[e.i].querySelector('.mise-j .pile'), siegesEl[e.i].querySelector('.plaque'), { duree: 300, echelle: 1 });
          etiquette(e.i, e.montant === t.petite ? 'Petite blinde' : 'Grosse blinde');
          sfx.jetons(2);
          await fx.attendre(220);
          break;
        case 'donne': {
          const el = fx.elCarte(null);
          siegesEl[e.i].querySelector('.cartes-siege').appendChild(el);
          if (e.i === 0) el.dataset.carte = `${e.carte.r}${e.carte.c}`;
          croupier.donne(siegesEl[e.i].offsetLeft < feutre.clientWidth / 2 ? -1 : 1);
          sfx.carte();
          await fx.arriver(el, croupier.el, { duree: 300, tour: 180, echelle: 0.5 });
          if (e.i === 0) { fx.retourner(el, e.carte); sfx.retourne(); }
          await fx.attendre(40);
          break;
        }
        case 'a-qui':
          aSonTour(e.i);
          break;
        case 'action': {
          const el = siegesEl[e.i];
          const txt = e.quoi === 'relancer' || e.quoi === 'miser' ? `${QUOI[e.quoi]} ${fx.nombre(e.mise)}` : e.quoi === 'suivre' ? `Suit ${fx.nombre(e.mise)}` : QUOI[e.quoi];
          etiquette(e.i, txt, e.quoi === 'tapis' ? 'tapis' : e.quoi === 'coucher' ? 'couche' : '');
          penser(e.i, false);
          if (e.quoi === 'coucher') {
            el.classList.add('couche');
            for (const c of el.querySelectorAll('.cartes-siege .carte')) fx.partir(c, croupier.el, { duree: 380, tour: 90 }).then(() => {});
            sfx.carte();
          } else if (e.quoi === 'parole') {
            sfx.clic(); setTimeout(sfx.clic, 120);
          } else {
            ui.jetons[e.i] -= e.ajout; ui.mise[e.i] += e.ajout;
            majSiege(e.i);
            fx.volerJetons(e.ajout, el.querySelector('.plaque'), el.querySelector('.mise-j'), { max: 5, duree: 380 });
            sfx.jetons(Math.min(8, 2 + Math.round(e.ajout / (t.grosse * 4))));
            await fx.attendre(380);
            majMise(e.i);
            if (e.quoi === 'tapis') { sfx.coup(); fx.secouer(feutre, 4); croupier.dire(e.i === 0 ? 'Tapis !' : `${t.joueurs[e.i].nom} fait tapis !`); }
          }
          await fx.attendre(e.i === 0 ? 150 : 260);
          break;
        }
        case 'ramasser': {
          croupier.ramasse();
          const pot = $('pk-pot');
          for (let i = 0; i < 5; i++) {
            if (ui.mise[i] > 0) {
              const p = siegesEl[i].querySelector('.mise-j .pile');
              if (p) fx.volerJetons(ui.mise[i], p, pot, { max: 4, duree: 420 });
              ui.mise[i] = 0;
              majMise(i);
            }
          }
          sfx.jetons(6);
          await fx.attendre(450);
          ui.pot = e.pot;
          majPot();
          fx.pop(pot, 1.1);
          break;
        }
        case 'board': {
          aSonTour(-1);
          croupier.dire({ flop: 'Le flop.', turn: 'La turn.', river: 'La river.' }[e.phase], { duree: 1200 });
          for (const c of e.cartes) {
            const el = fx.elCarte(null);
            $('pk-board').appendChild(el);
            croupier.donne(0);
            sfx.carte();
            await fx.arriver(el, croupier.el, { duree: 320, tour: -40, echelle: 0.5 });
            sfx.retourne();
            await fx.retourner(el, c);
          }
          await fx.attendre(350);
          break;
        }
        case 'abattage':
          aSonTour(-1);
          croupier.dire('Abattage.', { duree: 1200 });
          for (const m of e.mains) {
            const cartesEl = siegesEl[m.i].querySelectorAll('.cartes-siege .carte');
            for (let k = 0; k < cartesEl.length; k++) {
              if (cartesEl[k].classList.contains('cachee')) { sfx.retourne(); await fx.retourner(cartesEl[k], m.cartes[k]); }
            }
            siegesEl[m.i].querySelector('.main-nom').textContent = m.nom;
            await fx.attendre(250);
          }
          await fx.attendre(500);
          break;
        case 'gain':
          await gain(e);
          break;
        case 'fin-main':
          aSonTour(-1);
          break;
      }
    }
  }

  async function gain(e) {
    const noms = e.gagnants.map((i) => t.joueurs[i].nom);
    const moi = e.gagnants.includes(0);
    siegesEl.forEach((el, i) => el.classList.toggle('gagnant', e.gagnants.includes(i)));
    // les cinq cartes gagnantes ressortent
    if (e.cinq) {
      const ids = new Set(e.cinq.map((c) => `${c.r}${c.c}`));
      for (const el of feutre.querySelectorAll('.board .carte, .siege .carte')) {
        el.classList.toggle('gagnante', ids.has(el.dataset.carte) && (el.closest('.board') || e.gagnants.some((i) => siegesEl[i].contains(el))));
        el.classList.toggle('terne', !el.classList.contains('gagnante'));
      }
    }
    const qui = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)} se partagent` : moi ? 'Vous remportez' : `${noms[0]} remporte`;
    const texte = `${qui} ${e.annexe ? 'le pot annexe' : 'le pot'}${e.nom ? ` avec ${e.nom.charAt(0).toLowerCase()}${e.nom.slice(1)}` : ''}`;
    $('pk-annonce').textContent = texte;
    croupier.dire(e.sansAbattage ? `${moi ? 'Le pot est pour vous' : `Le pot va à ${noms[0]}`}.` : texte, { duree: 2600 });
    croupier.paie();
    const pot = $('pk-pot');
    for (const i of e.gagnants) fx.volerJetons(e.parts[i], pot, siegesEl[i].querySelector('.plaque'), { max: 8 });
    sfx.jetons(10, 0.8);
    await fx.attendre(650);
    for (const i of e.gagnants) { ui.jetons[i] += e.parts[i]; majSiege(i); fx.pop(siegesEl[i].querySelector('.plaque'), 1.08); }
    ui.pot = Math.max(0, ui.pot - e.montant);
    majPot();
    if (moi) {
      const part = e.parts[0];
      fx.texte(`+${fx.nombre(part)}`, siegesEl[0].querySelector('.plaque'));
      app.stat('pots');
      if (part >= 1000) app.succes('velours-poker');
      const grosse = part >= t.grosse * 40;
      sfx.gain(grosse);
      if (grosse) { fx.pluieDeJetons(50); fx.flash(); }
      else fx.eclats(siegesEl[0].querySelector('.plaque'), 20);
      croupier.sourit();
    }
    await fx.attendre(e.sansAbattage ? 900 : 1500);
  }

  /* ---------- le joueur ---------- */
  function rangee(p) {
    for (const r of document.querySelectorAll('#pk-commandes .rangee')) r.hidden = r.dataset.phase !== p;
  }
  function message(m) { $('pk-message').textContent = m; rangee('attente'); }

  function attendreHumain() {
    const o = P.options(t, 0);
    $('pk-suivre').innerHTML = o.parole ? 'Parole<small>Passer</small>' : o.aSuivre >= t.joueurs[0].jetons ? `Suivre<small>Tapis ${fx.nombre(o.aSuivre)}</small>` : `Suivre<small>${fx.nombre(o.aSuivre)}</small>`;
    $('pk-relancer').hidden = !o.peutRelancer;
    $('pk-relancer').innerHTML = `${t.miseCourante === 0 ? 'Miser' : 'Relancer'}<small>${o.minTotal >= o.maxTotal ? 'Tapis' : `${fx.nombre(o.minTotal)} et +`}</small>`;
    const curseur = $('pk-curseur');
    curseur.min = o.minTotal; curseur.max = o.maxTotal; curseur.step = t.petite; curseur.value = o.minTotal;
    $('pk-relance-val').textContent = fx.nombre(o.minTotal);
    rangee('agir');
    sfx.clic();
    return new Promise((r) => { humain = (a) => { humain = null; rangee('attente'); r(a); }; });
  }
  $('pk-coucher').addEventListener('click', () => humain?.({ type: 'coucher' }));
  $('pk-suivre').addEventListener('click', () => humain?.({ type: P.options(t, 0).parole ? 'parole' : 'suivre' }));
  $('pk-relancer').addEventListener('click', () => {
    if (!humain) return;
    const o = P.options(t, 0);
    if (o.minTotal >= o.maxTotal) return humain({ type: 'tapis' });
    rangee('relance');
  });
  $('pk-curseur').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('pk-relance-val').textContent = v >= Number(e.target.max) ? `${fx.nombre(v)} (tapis)` : fx.nombre(v);
  });
  document.querySelectorAll('#pk-commandes [data-part]').forEach((b) => b.addEventListener('click', () => {
    const o = P.options(t, 0);
    const c = $('pk-curseur');
    const v = b.dataset.part === 'tapis' ? o.maxTotal : Math.round((t.miseCourante + (o.pot + o.aSuivre) * Number(b.dataset.part)) / t.petite) * t.petite;
    c.value = Math.max(o.minTotal, Math.min(o.maxTotal, v));
    c.dispatchEvent(new Event('input'));
    sfx.clic();
  }));
  $('pk-relance-annuler').addEventListener('click', () => rangee('agir'));
  $('pk-relance-ok').addEventListener('click', () => {
    const v = Number($('pk-curseur').value);
    humain?.(v >= P.options(t, 0).maxTotal ? { type: 'tapis' } : { type: 'relancer', total: v });
  });

  /* ---------- la partie ---------- */
  async function boucle() {
    if (boucleEnCours) return;
    boucleEnCours = true;
    try {
      while (assis) {
        ui.jetons = t.joueurs.map((j) => j.jetons);
        ui.pot = 0;
        garder(t.joueurs[0].jetons);
        if (t.joueurs[0].jetons <= 0) { await finDeMain(); continue; }
        P.nouvelleMain(t);
        await jouer(P.prendre(t));
        while (assis && t.phase !== 'fin' && t.phase !== 'fin-partie') {
          const i = t.aQui;
          if (i === 0) {
            const a = await attendreHumain();
            if (!assis) return;
            P.agir(t, a);
          } else {
            const vite = t.joueurs[0].couche || t.joueurs[0].tapis;
            message(`${t.joueurs[i].nom} réfléchit…`);
            penser(i, true);
            await fx.attendre(vite ? 250 + rng() * 300 : 600 + rng() * 900);
            if (!assis) return;
            P.agir(t, P.decider(t));
          }
          await jouer(P.prendre(t));
        }
        if (!assis) return;
        app.stat('mains');
        garder(t.joueurs[0].jetons);
        await finDeMain();
      }
    } finally { boucleEnCours = false; }
  }

  async function finDeMain() {
    // les habitués sans jetons s'en vont, d'autres s'assoient
    for (let i = 1; i < 5; i++) {
      if (t.joueurs[i].jetons > 0) continue;
      etiquette(i, 'Quitte la table', 'couche');
      await fx.attendre(700);
      const siege = nouveauBot(t.joueurs.map((j) => j.nom));
      P.asseoir(t, i, siege);
      ui.jetons[i] = siege.jetons;
      dessinerSieges();
      fx.arriver(siegesEl[i], { left: innerWidth / 2, top: -80, width: 0, height: 0 }, { duree: 600, echelle: 0.8 });
      croupier.dire(`Bienvenue, ${siege.nom}.`, { voix: false });
      await fx.attendre(500);
    }
    const ruine = t.joueurs[0].jetons <= 0;
    $('pk-recave').hidden = !ruine;
    $('pk-suivante').hidden = ruine;
    if (ruine) croupier.dire('Plus de jetons ? Vous pouvez vous recaver.', { voix: false });
    rangee('fin');
    await new Promise((r) => {
      suivante = r;
      if (!ruine) setTimeout(() => { if (suivante === r) { suivante = null; r(); } }, 5000);
    });
    message('Nouvelle donne…');
    siegesEl.forEach((el) => el.querySelectorAll('.carte').forEach((c) => c.classList.remove('terne', 'gagnante')));
  }
  $('pk-suivante').addEventListener('click', () => { const s = suivante; suivante = null; s?.(); });
  $('pk-recave').addEventListener('click', () => ouvrirCave());

  function quitter() {
    if (assis && t) {
      const reste = t.joueurs[0].jetons;
      assis = false;
      humain?.({ type: 'coucher' });
      const s = suivante; suivante = null; s?.();
      if (reste > 0) app.crediter(reste);
      try { localStorage.removeItem(CLE_TABLE); } catch { /* ignore */ }
    }
    t = null;
    $('pk-sieges').innerHTML = '';
    $('pk-board').innerHTML = '';
    $('pk-annonce').textContent = '';
    $('pk-titre').textContent = 'Texas Hold\'em';
    aller('s-hall');
  }
  $('pk-quitter').addEventListener('click', quitter);

  addEventListener('keydown', (e) => {
    if (!$('s-poker').classList.contains('is-active') || e.repeat || !humain || document.querySelector('.ov:not([hidden])')) return;
    const k = e.key.toLowerCase();
    if (k === 'f') $('pk-coucher').click();
    if (k === 'c' || k === ' ') { e.preventDefault(); $('pk-suivre').click(); }
    if (k === 'r') $('pk-relancer').click();
  });

  return {
    entrer() {
      if (!croupier) croupier = creerCroupier($('pk-croupier'), 'victor');
      if (!assis) {
        message('Choisissez une table.');
        setTimeout(() => croupier.dire('Bonsoir. Une place vous attend.'), 400);
        ouvrirCave();
      }
    },
    sortir() { croupier?.taire(); },
  };
}
