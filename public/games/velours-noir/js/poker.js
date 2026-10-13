/**
 * LE VELOURS NOIR — la table de Texas Hold'em, avec Victor.
 *
 * Seul : le joueur s'assoit avec une « cave » prise dans sa caisse, face à
 * quatre habitués (le moteur tourne ici). En ligne : le serveur tient la
 * table ; les places libres sont tenues par des habitués, qui cèdent la leur
 * quand un vrai joueur arrive. Dans les deux cas, cet écran rejoue les
 * événements de la table, et le joueur est toujours assis en bas.
 *
 * Les jetons de table reviennent dans la caisse quand on se lève — et même
 * si la page se ferme : ils sont notés, et rendus à la prochaine visite
 * (en ligne, seulement si la place n'a pas pu être reprise).
 */

import * as P from '../../../shared/casino/poker.js';
import { makeRng } from '../../../shared/hasard.js';
import { creerCroupier } from './croupier.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';
import * as EL from './enligne.js';

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
  const croupier = creerCroupier($('pk-croupier'), 'victor');
  let t = null, table = TABLES[0], assis = false, boucleEnCours = false;
  let enLigne = false, moi = 0, enAttente = false;
  let ui = null;                  // { jetons[], mise[], pot }
  let siegesEl = [];
  let humain = null;              // résolution de l'action attendue
  let opts = null;                // ce que le joueur peut faire (P.options)
  let suivante = null;            // résolution de « main suivante »
  let file = Promise.resolve();
  let caveMode = { type: 'solo' };
  let tournoi = null;            // la table est celle d'un tournoi (ses infos)

  const feutre = $('pk-feutre');

  /* ---------- les jetons restés à une table ---------- */
  let aRendre = null;
  try {
    const reste = JSON.parse(localStorage.getItem(CLE_TABLE));
    if (reste?.jetons > 0) {
      if (reste.enLigne && EL.placeNotee()?.code === reste.code) aRendre = reste;
      else { app.crediter(reste.jetons); localStorage.removeItem(CLE_TABLE); }
    } else localStorage.removeItem(CLE_TABLE);
  } catch { /* ignore */ }
  const garder = (n) => { try { localStorage.setItem(CLE_TABLE, JSON.stringify({ jetons: n, enLigne, code: EL.placeNotee()?.code || null })); } catch { /* ignore */ } };
  const oublierTable = () => { try { localStorage.removeItem(CLE_TABLE); } catch { /* ignore */ } };

  /* ---------- la cave ---------- */
  function ouvrirCave(mode = caveMode) {
    caveMode = mode;
    const ov = $('ov-cave');
    const liste = $('pk-tables');
    liste.innerHTML = '';
    const choix = mode.petite ? TABLES.filter((x) => x.petite === mode.petite) : TABLES;
    if (!choix.includes(table)) table = choix[0];
    for (const tb of choix) {
      const b = document.createElement('button');
      b.className = `table-choix${tb === table ? ' is-on' : ''}`;
      b.disabled = app.solde() < tb.caveMin;
      b.innerHTML = `<b>${tb.nom}</b><span>Blindes ${tb.petite} / ${tb.petite * 2} · cave de ${fx.nombre(tb.caveMin)} à ${fx.nombre(tb.caveMax)}</span>`;
      b.addEventListener('click', () => { table = tb; ouvrirCave(mode); sfx.clic(); });
      liste.appendChild(b);
    }
    if (app.solde() < table.caveMin) table = choix.find((x) => app.solde() >= x.caveMin) || table;
    const max = Math.min(table.caveMax, app.solde());
    const r = $('pk-cave');
    r.min = table.caveMin; r.max = Math.max(table.caveMin, max); r.step = table.petite * 2;
    r.value = Math.min(max, Math.max(table.caveMin, Math.round((table.caveMin * 2) / 10) * 10));
    $('pk-cave-val').textContent = fx.nombre(Number(r.value));
    const peut = app.solde() >= table.caveMin;
    $('pk-asseoir').disabled = !peut;
    $('ov-cave').querySelector('h3').textContent = { solo: 'Choisissez votre table', creer: 'Votre table en ligne', rejoindre: `Rejoindre la table ${mode.code || ''}`, recave: 'Se recaver' }[mode.type];
    $('pk-cave-note').textContent = peut ? 'Vos jetons de table reviennent dans votre caisse quand vous quittez la table.' : `Il faut au moins ${fx.nombre(table.caveMin)} jetons pour s’asseoir. Passez à la boutique.`;
    ov.hidden = false;
  }
  $('pk-cave').addEventListener('input', (e) => { $('pk-cave-val').textContent = fx.nombre(Number(e.target.value)); });
  $('ov-cave').addEventListener('click', (e) => {
    if ((e.target.closest('[data-ferme]') || e.target === $('ov-cave')) && !assis && !enLigne) setTimeout(() => aller('s-hall'), 50);
  });
  $('pk-asseoir').addEventListener('click', () => {
    const cave = Number($('pk-cave').value);
    if (!app.debiter(cave)) return;
    $('ov-cave').hidden = true;
    const m = caveMode;
    caveMode = { type: 'solo' };
    if (m.type === 'creer') { EL.creer('poker', { publique: m.publique, petite: table.petite, cave }); garderAttente(cave); message('Ouverture de la table…'); return; }
    if (m.type === 'rejoindre') { EL.rejoindre(m.code, { cave }); garderAttente(cave); message('On vous installe…'); return; }
    if (m.type === 'recave' && enLigne) { EL.envoyer({ t: 'recave', montant: cave }); ui.jetons[moi] += cave; garder(ui.jetons[moi]); $('pk-recave').hidden = true; return; }
    if (assis && t) {
      t.joueurs[moi].jetons += cave;
      ui.jetons[moi] = t.joueurs[moi].jetons;
      majSiege(moi);
      garder(t.joueurs[moi].jetons);
      $('pk-recave').hidden = true;
      const s = suivante; suivante = null; s?.();
      return;
    }
    asseoir(cave);
  });
  /** En ligne, la cave est notée tout de suite : si rien n'aboutit, elle revient. */
  function garderAttente(cave) { try { localStorage.setItem(CLE_TABLE, JSON.stringify({ jetons: cave })); } catch { /* ignore */ } }

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
    assis = true; enLigne = false; moi = 0;
    garder(cave);
    $('pk-titre').textContent = `${table.nom} · ${table.petite}/${table.petite * 2}`;
    ui = { jetons: t.joueurs.map((j) => j.jetons), mise: [0, 0, 0, 0, 0], pot: 0 };
    dessinerSieges();
    croupier.dire('Bienvenue. Bonne chance à tous.');
    sfx.jetons(8);
    boucle();
  }

  /* ---------- les sièges ---------- */
  /** La place à l'écran : le joueur toujours en bas, les autres dans l'ordre autour de la table. */
  const pos = (i) => (i - Math.max(0, moi) + 5) % 5;

  function dessinerSieges() {
    const hote = $('pk-sieges');
    hote.innerHTML = '';
    siegesEl = t.joueurs.map((j, i) => {
      const el = document.createElement('div');
      el.className = `siege s${pos(i)}${j.humain && i !== moi ? ' humain' : ''}`;
      el.innerHTML = `
        <div class="cartes-siege"></div>
        <div class="plaque">
          <span class="avatar">${j.avatar}</span>
          <span class="infos"><span class="nom"></span><span class="tapis-j"></span>${j.style ? `<span class="style">${P.STYLES[j.style].nom}</span>` : j.humain && i !== moi ? '<span class="style">Joueur</span>' : ''}</span>
          <span class="action-j"></span>
        </div>
        <span class="main-nom"></span>
        <div class="mise-j"></div>`;
      el.querySelector('.nom').textContent = i === moi ? 'Vous' : j.nom;
      hote.appendChild(el);
      return el;
    });
    t.joueurs.forEach((_, i) => { majSiege(i); majMise(i); });
  }

  function majSiege(i) {
    const el = siegesEl[i];
    if (!el) return;
    el.querySelector('.tapis-j').textContent = fx.nombre(ui.jetons[i]);
    el.classList.toggle('absent', ui.jetons[i] <= 0 && !!t.joueurs[i].absent);
  }
  function majMise(i) {
    const m = siegesEl[i]?.querySelector('.mise-j');
    if (!m) return;
    m.innerHTML = '';
    if (ui.mise[i] > 0) m.appendChild(fx.pile(ui.mise[i], { max: 6 }));
  }
  function majPot() { fx.compter($('pk-pot').querySelector('b'), ui.pot, 400); }
  function etiquette(i, texte, classe = '') {
    const a = siegesEl[i]?.querySelector('.action-j');
    if (!a) return;
    a.textContent = texte;
    a.className = `action-j vue ${classe}`;
    clearTimeout(a._t);
    if (classe !== 'couche') a._t = setTimeout(() => a.classList.remove('vue'), 2200);
  }
  function aSonTour(i) { siegesEl.forEach((el, k) => el.classList.toggle('a-son-tour', k === i)); }
  function penser(i, oui) {
    const n = siegesEl[i]?.querySelector('.nom');
    if (!n) return;
    n.parentElement.querySelector('.pense')?.remove();
    if (oui) n.insertAdjacentHTML('afterend', '<span class="pense"><i></i><i></i><i></i></span>');
  }
  const nom = (i) => (i === moi ? 'Vous' : t.joueurs[i].nom);

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
          siegesEl[e.bouton]?.appendChild(d);
          fx.pop(d, 1.4);
          sfx.melange();
          await fx.attendre(500);
          break;
        }
        case 'blinde':
          ui.jetons[e.i] -= e.montant; ui.mise[e.i] += e.montant;
          majSiege(e.i); majMise(e.i);
          fx.arriver(siegesEl[e.i].querySelector('.mise-j .pile'), siegesEl[e.i].querySelector('.plaque'), { duree: 300, echelle: 1 });
          etiquette(e.i, e.montant === t.petite || e.montant < t.grosse ? 'Petite blinde' : 'Grosse blinde');
          sfx.jetons(2);
          await fx.attendre(220);
          break;
        case 'donne': {
          const el = fx.elCarte(null);
          siegesEl[e.i].querySelector('.cartes-siege').appendChild(el);
          if (e.i === moi && e.carte) el.dataset.carte = `${e.carte.r}${e.carte.c}`;
          croupier.donne(siegesEl[e.i].offsetLeft < feutre.clientWidth / 2 ? -1 : 1);
          sfx.carte();
          await fx.arriver(el, croupier.el, { duree: 300, tour: 180, echelle: 0.5 });
          if (e.i === moi && e.carte) { fx.retourner(el, e.carte); sfx.retourne(); }
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
            for (const c of el.querySelectorAll('.cartes-siege .carte')) fx.partir(c, croupier.el, { duree: 380, tour: 90 });
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
            if (e.quoi === 'tapis') { sfx.coup(); fx.secouer(feutre, 4); croupier.dire(e.i === moi ? 'Tapis !' : `${t.joueurs[e.i].nom} fait tapis !`); }
          }
          await fx.attendre(e.i === moi ? 150 : 260);
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
              if (cartesEl[k].classList.contains('cachee') || !cartesEl[k].dataset.carte) { sfx.retourne(); await fx.retourner(cartesEl[k], m.cartes[k]); }
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
    const noms = e.gagnants.map((i) => nom(i));
    const gagne = e.gagnants.includes(moi);
    siegesEl.forEach((el, i) => el.classList.toggle('gagnant', e.gagnants.includes(i)));
    if (e.cinq) {
      const ids = new Set(e.cinq.map((c) => `${c.r}${c.c}`));
      for (const el of feutre.querySelectorAll('.board .carte, .siege .carte')) {
        el.classList.toggle('gagnante', ids.has(el.dataset.carte) && !!(el.closest('.board') || e.gagnants.some((i) => siegesEl[i].contains(el))));
        el.classList.toggle('terne', !el.classList.contains('gagnante'));
      }
    }
    const qui = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)} se partagent` : gagne ? 'Vous remportez' : `${noms[0]} remporte`;
    const texte = `${qui} ${e.annexe ? 'le pot annexe' : 'le pot'}${e.nom ? ` avec ${e.nom.charAt(0).toLowerCase()}${e.nom.slice(1)}` : ''}`;
    $('pk-annonce').textContent = texte;
    croupier.dire(e.sansAbattage ? `${gagne ? 'Le pot est pour vous' : `Le pot va à ${noms[0]}`}.` : texte, { duree: 2600 });
    croupier.paie();
    const pot = $('pk-pot');
    for (const i of e.gagnants) fx.volerJetons(e.parts[i], pot, siegesEl[i].querySelector('.plaque'), { max: 8 });
    sfx.jetons(10, 0.8);
    await fx.attendre(650);
    for (const i of e.gagnants) { ui.jetons[i] += e.parts[i]; majSiege(i); fx.pop(siegesEl[i].querySelector('.plaque'), 1.08); }
    ui.pot = Math.max(0, ui.pot - e.montant);
    majPot();
    if (gagne) {
      const part = e.parts[moi];
      fx.texte(`+${fx.nombre(part)}`, siegesEl[moi].querySelector('.plaque'));
      app.stat('pots');
      if (part >= 1000) app.succes('velours-poker');
      const grosse = part >= t.grosse * 40;
      sfx.gain(grosse);
      if (grosse) { fx.pluieDeJetons(50); fx.flash(); }
      else fx.eclats(siegesEl[moi].querySelector('.plaque'), 20);
      croupier.sourit();
    }
    await fx.attendre(e.sansAbattage ? 900 : 1500);
  }

  /* ---------- le joueur ---------- */
  function rangee(p) {
    for (const r of document.querySelectorAll('#pk-commandes .rangee')) r.hidden = r.dataset.phase !== p;
  }
  function message(m) { $('pk-message').textContent = m; rangee('attente'); }

  /** Montre les boutons ; la promesse rend l'action choisie. */
  function attendreHumain(o) {
    opts = o;
    const mes = ui.jetons[moi];
    $('pk-suivre').innerHTML = o.parole ? 'Parole<small>Passer</small>' : o.aSuivre >= mes ? `Suivre<small>Tapis ${fx.nombre(o.aSuivre)}</small>` : `Suivre<small>${fx.nombre(o.aSuivre)}</small>`;
    $('pk-relancer').hidden = !o.peutRelancer;
    $('pk-relancer').innerHTML = `${o.miseCourante === 0 ? 'Miser' : 'Relancer'}<small>${o.minTotal >= o.maxTotal ? 'Tapis' : `${fx.nombre(o.minTotal)} et +`}</small>`;
    const curseur = $('pk-curseur');
    curseur.min = o.minTotal; curseur.max = o.maxTotal; curseur.step = t.petite; curseur.value = o.minTotal;
    $('pk-relance-val').textContent = fx.nombre(o.minTotal);
    rangee('agir');
    sfx.clic();
    return new Promise((r) => { humain = (a) => { humain = null; opts = null; rangee('attente'); r(a); }; });
  }
  $('pk-coucher').addEventListener('click', () => humain?.({ type: 'coucher' }));
  $('pk-suivre').addEventListener('click', () => humain?.({ type: opts?.parole ? 'parole' : 'suivre' }));
  $('pk-relancer').addEventListener('click', () => {
    if (!humain) return;
    if (opts.minTotal >= opts.maxTotal) return humain({ type: 'tapis' });
    rangee('relance');
  });
  $('pk-curseur').addEventListener('input', (e) => {
    const v = Number(e.target.value);
    $('pk-relance-val').textContent = v >= Number(e.target.max) ? `${fx.nombre(v)} (tapis)` : fx.nombre(v);
  });
  document.querySelectorAll('#pk-commandes [data-part]').forEach((b) => b.addEventListener('click', () => {
    if (!opts) return;
    const c = $('pk-curseur');
    const v = b.dataset.part === 'tapis' ? opts.maxTotal : Math.round((opts.miseCourante + (opts.pot + opts.aSuivre) * Number(b.dataset.part)) / t.petite) * t.petite;
    c.value = Math.max(opts.minTotal, Math.min(opts.maxTotal, v));
    c.dispatchEvent(new Event('input'));
    sfx.clic();
  }));
  $('pk-relance-annuler').addEventListener('click', () => rangee('agir'));
  $('pk-relance-ok').addEventListener('click', () => {
    const v = Number($('pk-curseur').value);
    humain?.(v >= opts.maxTotal ? { type: 'tapis' } : { type: 'relancer', total: v });
  });

  /* ---------- la partie seul ---------- */
  async function boucle() {
    if (boucleEnCours) return;
    boucleEnCours = true;
    try {
      while (assis && !enLigne) {
        ui.jetons = t.joueurs.map((j) => j.jetons);
        ui.pot = 0;
        garder(t.joueurs[0].jetons);
        if (t.joueurs[0].jetons <= 0) { await finDeMain(); continue; }
        P.nouvelleMain(t);
        await jouer(P.prendre(t));
        while (assis && t.phase !== 'fin' && t.phase !== 'fin-partie') {
          const i = t.aQui;
          if (i === 0) {
            const a = await attendreHumain({ ...P.options(t, 0), miseCourante: t.miseCourante });
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
      // pas de limite de temps : la main suivante attend le joueur
    });
    message('Nouvelle donne…');
    siegesEl.forEach((el) => el.querySelectorAll('.carte').forEach((c) => c.classList.remove('terne', 'gagnante')));
  }
  $('pk-suivante').addEventListener('click', () => { const s = suivante; suivante = null; s?.(); });
  $('pk-recave').addEventListener('click', () => ouvrirCave({ type: 'recave', petite: t?.petite }));

  /* ---------- la partie en ligne ---------- */
  function depuisEtat(m) {
    enLigne = true; assis = true;
    moi = m.moi;
    enAttente = !!m.attente || m.moi < 0;
    aRendre = null;
    file = Promise.resolve();
    humain = null; opts = null;
    t = { petite: m.petite, grosse: m.grosse, joueurs: m.joueurs.map((j) => ({ ...j })) };
    table = TABLES.find((x) => x.petite === m.petite) || TABLES[0];
    ui = { jetons: m.joueurs.map((j) => j.jetons), mise: m.joueurs.map((j) => j.mise || 0), pot: m.pot || 0 };
    $('pk-titre').textContent = `${table.nom} · en ligne`;
    tournoi = m.tournoi || null;
    bandeauTournoi();
    $('pk-code').hidden = false;
    $('pk-code').textContent = `Table ${m.code}`;
    $('pk-code').dataset.code = m.code;
    dessinerSieges();
    // la main en cours, sans animation
    $('pk-board').innerHTML = '';
    for (const c of m.board || []) $('pk-board').appendChild(fx.elCarte(c));
    majPot();
    m.joueurs.forEach((j, i) => {
      const z = siegesEl[i].querySelector('.cartes-siege');
      for (const c of j.cartes || []) { const el = fx.elCarte(c); if (c) el.dataset.carte = `${c.r}${c.c}`; z.appendChild(el); }
      if (j.couche) siegesEl[i].classList.add('couche');
    });
    if (m.bouton >= 0 && siegesEl[m.bouton]) { const d = document.createElement('span'); d.className = 'bouton-d'; d.textContent = 'D'; siegesEl[m.bouton].appendChild(d); }
    if (tournoi) { /* jetons de tournoi : rien à rendre à la caisse */ } else if (!enAttente) garder(ui.jetons[moi]);
    else { try { const r = JSON.parse(localStorage.getItem(CLE_TABLE)); if (r?.jetons) garder(r.jetons); } catch { /* ignore */ } }
    $('pk-recave').hidden = !!tournoi || !(!enAttente && ui.jetons[moi] <= 0 && !['preflop', 'flop', 'turn', 'river'].includes(m.phase));
    $('pk-suivante').hidden = true;
    if (enAttente) message('Vous prendrez place à la prochaine main…');
    else if (ui.jetons[moi] <= 0 && !$('pk-recave').hidden) rangee('fin');
    else message('…');
  }

  EL.ecouter((m) => {
    if (m.jeu && m.jeu !== 'poker') return;
    if (m.t === 'perdu' && aRendre) { app.crediter(aRendre.jetons); aRendre = null; oublierTable(); return; }
    if (m.t === 'etat' && m.jeu === 'poker') { depuisEtat(m); return; }
    if (!enLigne) return;
    switch (m.t) {
      case 'evts':
        file = file.then(() => jouer(m.evts)).catch((err) => console.error(err));
        break;
      case 'reflechit':
        file = file.then(() => {
          if (m.i !== moi) { message(`${t.joueurs[m.i]?.nom || 'Un joueur'} réfléchit…`); penser(m.i, true); }
        });
        break;
      case 'options':
        file = file.then(async () => {
          const a = await attendreHumain(m);
          if (enLigne) EL.envoyer({ t: 'agir', a });
        });
        break;
      case 'piles':
        file = file.then(() => {
          ui.jetons = [...m.jetons];
          t.joueurs.forEach((j, i) => { j.jetons = m.jetons[i]; majSiege(i); });
          if (!tournoi) garder(ui.jetons[moi]);
          app.stat('mains');
          const ruine = ui.jetons[moi] <= 0 && !tournoi;
          $('pk-recave').hidden = !ruine;
          $('pk-suivante').hidden = true;
          if (ruine) { rangee('fin'); croupier.dire('Plus de jetons ? Vous pouvez vous recaver.', { voix: false }); }
          else message('Prochaine main dans un instant…');
          setTimeout(() => siegesEl.forEach((el) => el.querySelectorAll('.carte').forEach((c) => c.classList.remove('terne', 'gagnante'))), 2800);
        });
        break;
      case 'membres':
        if (m.arrive && m.arrive !== EL.identite().nom) croupier.dire(`${m.arrive} arrive. Il prendra place à la prochaine main.`, { voix: false });
        if (m.part) croupier.dire(`${m.part} quitte la table.`, { voix: false });
        if (m.absent) croupier.dire(`${m.absent} a perdu la connexion.`, { voix: false });
        break;
      case 'tournoi-info':
        tournoi = m.tournoi;
        t.petite = m.tournoi.petite; t.grosse = m.tournoi.grosse;
        bandeauTournoi(m.monte);
        if (m.monte) file = file.then(() => croupier.dire(`Les blindes montent : ${m.tournoi.petite} / ${m.tournoi.grosse}.`));
        break;
      case 'tournoi-elimine':
        if (tournoi) tournoi.restants = m.restants;
        bandeauTournoi();
        file = file.then(() => croupier.dire(m.vainqueur ? `${m.nom === EL.identite().nom ? 'Vous remportez' : `${m.nom} remporte`} le tournoi !` : `${m.nom} est éliminé, ${m.place}e. Il reste ${m.restants} joueurs.`, { voix: !!m.vainqueur }));
        break;
      case 'tournoi-finale':
        file = file.then(() => { croupier.dire('Table finale ! Bonne chance à tous.'); fx.flash(); });
        break;
      case 'tournoi-fin':
        file = file.then(() => { humain = null; rangee('attente'); message('Tournoi terminé.'); });
        break;
      case 'parti':
        if (m.jetons > 0 && !m.tournoi) app.crediter(m.jetons);
        oublierTable();
        finEnLigne();
        break;
      case 'erreur':
        croupier.dire(m.msg, { voix: false });
        message(m.msg);
        try { const r = JSON.parse(localStorage.getItem(CLE_TABLE)); if (r?.jetons && !enLigne) { app.crediter(r.jetons); oublierTable(); } } catch { /* ignore */ }
        break;
    }
  });

  /** Le bandeau du tournoi, au-dessus de la table. */
  function bandeauTournoi(monte = false) {
    const b = $('pk-tournoi');
    b.hidden = !tournoi;
    $('pk-quitter').textContent = tournoi ? '‹ Abandonner' : '‹ Quitter la table';
    if (tournoi) $('pk-code').hidden = true;
    if (!tournoi) return;
    $('pk-titre').textContent = tournoi.nom;
    b.textContent = `🏆 ${tournoi.finale ? 'Table finale · ' : ''}Niveau ${tournoi.niveau} · blindes ${fx.nombre(tournoi.petite)}/${fx.nombre(tournoi.grosse)} · ${tournoi.restants} joueur${tournoi.restants > 1 ? 's' : ''} en lice · 1er ${fx.nombre(tournoi.parts[0])}`;
    b.classList.toggle('monte', monte);
  }

  function finEnLigne() {
    tournoi = null;
    bandeauTournoi();
    enLigne = false; assis = false; moi = 0; enAttente = false;
    humain = null; opts = null;
    t = null;
    $('pk-code').hidden = true;
    $('pk-sieges').innerHTML = '';
    $('pk-board').innerHTML = '';
    $('pk-annonce').textContent = '';
    $('pk-titre').textContent = 'Texas Hold\'em';
  }

  function quitter() {
    if (enLigne) {
      // le serveur rend les jetons de table (message « parti ») ; la note locale reste en secours
      EL.quitter();
      humain = null;
      setTimeout(() => { if (enLigne) finEnLigne(); }, 3000);
      aller('s-hall');
      return;
    }
    if (assis && t) {
      const reste = t.joueurs[0].jetons;
      assis = false;
      humain?.({ type: 'coucher' });
      const s = suivante; suivante = null; s?.();
      if (reste > 0) app.crediter(reste);
      oublierTable();
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
    /** Le hall choisit le mode avant d'ouvrir la table : seul, créer, ou rejoindre. */
    preparer(mode) { caveMode = mode; },
    /** La file des événements en cours de lecture (les résultats d'un tournoi attendent la fin de la main). */
    file: () => file,
    entrer() {
      if (enLigne) return;
      if (!assis) {
        message(caveMode.type === 'solo' ? 'Choisissez une table.' : 'Choisissez votre cave.');
        setTimeout(() => croupier.dire('Bonsoir. Une place vous attend.'), 400);
        ouvrirCave(caveMode);
      }
    },
    sortir() { croupier.taire(); },
    enLigne: () => enLigne,
  };
}
