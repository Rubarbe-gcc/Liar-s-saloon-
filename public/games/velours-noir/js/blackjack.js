/**
 * LE VELOURS NOIR — la table de blackjack, avec Margot.
 *
 * Le moteur (shared/casino/blackjack.js) joue la donne d'un coup ; cet
 * écran rejoue ses événements un par un, au rythme d'une vraie table.
 */

import * as BJ from '../../../shared/casino/blackjack.js';
import { makeRng } from '../../../shared/hasard.js';
import { creerCroupier } from './croupier.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);
const MIN = 5, MAX = 500;
const JETONS = [5, 25, 100, 500];
const TEXTES = { blackjack: 'Blackjack !', gagne: 'Gagné', perdu: 'Perdu', egalite: 'Égalité', brule: 'Brûlé' };

export function monterBlackjack(app) {
  let croupier = null;
  const b = BJ.creerBlackjack({ rng: makeRng(Date.now() ^ 0xb1ac), solde: 0 });
  let mise = 0, derniere = 0, occupe = false;
  let mainsUI = [];           // { el, cartes: [], total, pile, mise }
  let croupierUI = { cartes: [], cachee: null };

  const sabot = $('bj-sabot');
  const cercle = $('bj-cercle');
  const zoneMains = $('bj-mains');
  const zoneCroupier = $('bj-cartes-croupier');
  const totalCroupier = $('bj-total-croupier');
  const soldeBarre = document.querySelector('#s-blackjack .barre-solde');

  /* ---------- les jetons à miser ---------- */
  const plateau = $('bj-jetons');
  for (const v of JETONS) {
    const j = fx.elJeton(v);
    j.setAttribute('role', 'button');
    j.setAttribute('aria-label', `Miser ${v}`);
    j.tabIndex = 0;
    j.addEventListener('click', () => ajouter(v, j));
    plateau.appendChild(j);
  }

  function synchro() {
    const d = b.solde - app.solde();
    if (d > 0) app.crediter(d); else if (d < 0) app.debiter(-d);
  }

  function dessinerCercle() {
    cercle.querySelector('.pile')?.remove();
    if (mise > 0) cercle.appendChild(fx.pile(mise));
    for (const j of plateau.children) j.classList.toggle('trop', mise + Number(j.dataset.v) > Math.min(MAX, app.solde()));
    $('bj-distribuer').disabled = mise < MIN;
    $('bj-effacer').disabled = mise === 0;
  }

  function ajouter(v, depuis) {
    if (occupe || phaseUI !== 'mise') return;
    if (mise + v > Math.min(MAX, app.solde())) {
      croupier.dire(app.solde() < mise + v ? 'Vous n’avez pas assez de jetons.' : `La mise est limitée à ${MAX}.`, { voix: false });
      fx.secouer(depuis, 4);
      return;
    }
    nettoyer();
    mise += v;
    sfx.jeton();
    dessinerCercle();
    fx.arriver(cercle.querySelector('.pile'), depuis, { duree: 320, echelle: 1 });
  }

  $('bj-effacer').addEventListener('click', () => {
    if (occupe || !mise) return;
    const p = cercle.querySelector('.pile');
    if (p) fx.volerJetons(mise, p, plateau);
    sfx.jetons(4);
    mise = 0;
    dessinerCercle();
  });

  /* ---------- les phases (les rangées de boutons) ---------- */
  let phaseUI = 'mise';
  function phase(p, message = '') {
    phaseUI = p;
    $('s-blackjack').classList.toggle('en-jeu', p !== 'mise');
    for (const r of document.querySelectorAll('#bj-commandes .rangee')) r.hidden = r.dataset.phase !== p;
    if (p === 'attente') document.querySelector('#bj-commandes .attente').textContent = message || '…';
    if (p === 'jeu') {
      const a = BJ.actions(b);
      $('bj-tirer').disabled = !a.tirer;
      $('bj-rester').disabled = !a.rester;
      $('bj-doubler').disabled = !a.doubler;
      $('bj-separer').disabled = !a.separer;
    }
    if (p === 'mise') dessinerCercle();
    if (p === 'fin') $('bj-rejouer').textContent = derniere <= app.solde() ? `Rejouer ${fx.nombre(derniere)}` : 'Rejouer';
  }

  /* ---------- la table ---------- */
  let sale = false;
  /** Les cartes de la donne précédente partent à la défausse. */
  function nettoyer() {
    if (!sale) return 0;
    sale = false;
    const cartes = [...document.querySelectorAll('#bj-feutre .carte')];
    cartes.forEach((c, k) => fx.partir(c, { left: innerWidth * 0.05, top: innerHeight * 0.1, width: 0, height: 0 }, { duree: 380, delai: k * 25, tour: -40 }));
    const vieux = [...zoneMains.children];
    vieux.forEach((v) => v.querySelectorAll('.badge, .total, .pile').forEach((x) => x.remove()));
    const duree = 420 + cartes.length * 25;
    setTimeout(() => vieux.forEach((v) => v.remove()), duree);
    totalCroupier.hidden = true;
    if (cartes.length) sfx.carte();
    return duree;
  }

  function nouvelleMainUI(montant, apres = null) {
    const el = document.createElement('div');
    el.className = 'main-bj';
    el.innerHTML = '<div class="cartes"></div><span class="total" hidden></span>';
    const pile = fx.pile(montant);
    el.appendChild(pile);
    const m = { el, cartes: [], mise: montant, pile };
    if (apres) apres.el.after(el); else zoneMains.appendChild(el);
    return m;
  }

  function majTotal(el, cartes) {
    if (!cartes.length) { el.hidden = true; return; }
    const v = BJ.valeur(cartes);
    el.hidden = false;
    el.className = 'total';
    if (BJ.estBlackjack(cartes)) { el.textContent = '21'; el.classList.add('bj'); }
    else el.textContent = v.souple && v.total < 21 ? `${v.total - 10} / ${v.total}` : String(v.total);
    if (v.total > 21) el.classList.add('brule');
    fx.pop(el, 1.12);
  }

  function changerPile(m, montant) {
    m.mise = montant;
    const p = fx.pile(montant);
    m.pile.replaceWith(p);
    m.pile = p;
    return p;
  }

  async function poserCarte(zone, carte, { cachee = false, vers = 0 } = {}) {
    const el = fx.elCarte(null);
    zone.appendChild(el);
    croupier.donne(vers);
    sfx.carte();
    await fx.arriver(el, sabot, { duree: 380, tour: -25, echelle: 0.7 });
    if (!cachee) { sfx.retourne(); await fx.retourner(el, carte); }
    return el;
  }

  /** Rejoue les événements du moteur. */
  async function jouer(evts) {
    occupe = true;
    for (const e of evts) {
      switch (e.type) {
        case 'melange':
          croupier.dire('Je mélange le sabot.');
          sfx.melange();
          fx.secouer(sabot, 5, 800);
          await fx.attendre(1000);
          break;
        case 'donne': {
          croupierUI = { cartes: [], cachee: null };
          const m = nouvelleMainUI(e.mise);
          mainsUI = [m];
          const p = cercle.querySelector('.pile');
          if (p) p.remove();
          fx.arriver(m.pile, cercle, { duree: 300, echelle: 1 });
          sale = true;
          break;
        }
        case 'carte':
          if (e.qui === 'croupier') {
            const el = await poserCarte(zoneCroupier, e.carte, { cachee: e.cachee });
            if (e.cachee) croupierUI.cachee = el;
            else { croupierUI.cartes.push(e.carte); majTotal(totalCroupier, croupierUI.cartes); }
          } else {
            const m = mainsUI[e.qui];
            await poserCarte(m.el.querySelector('.cartes'), e.carte, { vers: -0.5 + e.qui * 0.4 });
            m.cartes.push(e.carte);
            majTotal(m.el.querySelector('.total'), m.cartes);
          }
          await fx.attendre(110);
          break;
        case 'assurance':
          croupier.dire('Assurance ?');
          break;
        case 'verifie':
          croupier.dire('Je vérifie…', { voix: false });
          if (croupierUI.cachee) croupierUI.cachee.animate([{ transform: 'none' }, { transform: 'translateY(-8px) rotateX(35deg)' }, { transform: 'none' }], { duration: 700 });
          await fx.attendre(800);
          break;
        case 'revele':
          if (croupierUI.cachee) {
            sfx.retourne();
            await fx.retourner(croupierUI.cachee, e.carte);
            croupierUI.cachee = null;
          }
          croupierUI.cartes.push(e.carte);
          majTotal(totalCroupier, croupierUI.cartes);
          if (BJ.estBlackjack(croupierUI.cartes)) { sfx.coup(); croupier.dire('Blackjack pour la maison.'); fx.secouer($('bj-feutre'), 5); await fx.attendre(700); }
          await fx.attendre(300);
          break;
        case 'assurance-reglee':
          if (e.retour > 0) { fx.texte('Assurance payée', cercle); sfx.gain(); }
          await fx.attendre(300);
          break;
        case 'a-qui':
          mainsUI.forEach((m, k) => m.el.classList.toggle('active', k === e.main && mainsUI.length > 1));
          break;
        case 'brule': {
          const m = mainsUI[e.main];
          badge(m, 'brule');
          sfx.perte();
          fx.secouer(m.el, 4);
          croupier.ramasse();
          fx.volerJetons(m.mise, m.pile, croupier.el);
          m.pile.style.visibility = 'hidden';
          await fx.attendre(500);
          break;
        }
        case 'double': {
          const m = mainsUI[e.main];
          fx.volerJetons(e.mise / 2, soldeBarre, m.pile);
          sfx.jetons(4);
          await fx.attendre(350);
          changerPile(m, e.mise);
          fx.texte('Double !', m.el);
          break;
        }
        case 'separe': {
          const m = mainsUI[e.main];
          const deux = nouvelleMainUI(m.mise, m);
          mainsUI.splice(e.main + 1, 0, deux);
          const carteEl = m.el.querySelector('.cartes .carte:last-child');
          const c = m.cartes.pop();
          deux.el.querySelector('.cartes').appendChild(carteEl);
          deux.cartes.push(c);
          fx.arriver(carteEl, m.el, { duree: 300, echelle: 1 });
          fx.volerJetons(m.mise, soldeBarre, deux.pile);
          sfx.jetons(4);
          majTotal(m.el.querySelector('.total'), m.cartes);
          majTotal(deux.el.querySelector('.total'), deux.cartes);
          await fx.attendre(420);
          break;
        }
        case 'resultat': {
          const m = mainsUI[e.main];
          m.el.classList.remove('active');
          if (e.res === 'brule') break;
          badge(m, e.res);
          if (e.retour > m.mise) {
            croupier.paie();
            fx.volerJetons(e.retour - m.mise, croupier.el, m.pile);
            sfx.jetons(6);
            await fx.attendre(500);
            changerPile(m, e.retour);
            fx.texte(`+${fx.nombre(e.retour - m.mise)}`, m.el);
            await fx.attendre(250);
            fx.volerJetons(e.retour, m.pile, soldeBarre);
            m.pile.style.visibility = 'hidden';
          } else if (e.res === 'egalite') {
            fx.volerJetons(e.retour, m.pile, soldeBarre);
            m.pile.style.visibility = 'hidden';
          } else {
            croupier.ramasse();
            fx.volerJetons(m.mise, m.pile, croupier.el);
            m.pile.style.visibility = 'hidden';
            sfx.jetons(3);
          }
          await fx.attendre(350);
          break;
        }
        case 'fin':
          await fin(e);
          break;
      }
    }
    occupe = false;
  }

  function badge(m, res) {
    m.el.querySelector('.badge')?.remove();
    const s = document.createElement('span');
    s.className = `badge ${res}`;
    s.textContent = TEXTES[res];
    m.el.appendChild(s);
    fx.pop(s, 1.3);
  }

  async function fin(e) {
    synchro();
    const bj = b.mains.some((m) => m.resultat === 'blackjack');
    if (bj) {
      app.succes('velours-blackjack');
      app.stat('blackjacks');
      sfx.gain(true);
      fx.flash();
      fx.confettis(mainsUI[0].el, 90);
      fx.texte('BLACKJACK !', $('bj-feutre'), 'gros');
      croupier.sourit(2200);
      croupier.dire('Blackjack ! Félicitations.');
    } else if (e.net > 0) {
      sfx.gain(e.net >= 400);
      if (e.net >= 400) { fx.pluieDeJetons(50); fx.secouer($('bj-feutre'), 4); }
      croupier.sourit();
      croupier.dire(e.croupier > 21 ? 'Le croupier saute. Bravo !' : 'Bien joué.');
    } else if (e.net < 0) {
      sfx.perte();
      croupier.dire(e.bjCroupier ? 'Pas de chance cette fois.' : 'La maison gagne.', { voix: !e.bjCroupier });
      if (e.net <= -200) croupier.desole();
    } else {
      croupier.dire('Égalité, vous reprenez votre mise.');
    }
    if (e.net > 0) app.gainNet(e.net);
    app.stat('mains');
    await fx.attendre(500);
  }

  /* ---------- les boutons ---------- */
  async function distribuer(montant) {
    if (occupe) return;
    if (montant < MIN || montant > app.solde()) {
      croupier.dire(app.solde() < MIN ? 'Votre caisse est vide. Passez au hall.' : `Mise minimum : ${MIN}.`, { voix: false });
      return;
    }
    await fx.attendre(nettoyer());
    derniere = montant;
    b.solde = app.solde();
    if (!BJ.distribuer(b, montant)) return;
    mise = 0;
    synchro();
    phase('attente', 'Distribution…');
    await jouer(BJ.prendre(b));
    phase(b.phase === 'fin' ? 'fin' : b.phase);
  }

  $('bj-distribuer').addEventListener('click', () => distribuer(mise));
  $('bj-rejouer').addEventListener('click', () => distribuer(Math.min(derniere, app.solde())));
  $('bj-changer').addEventListener('click', () => { nettoyer(); mise = 0; phase('mise'); croupier.dire('Faites vos jeux.', { voix: false }); });

  async function action(f) {
    if (occupe || b.phase !== 'jeu') return;
    b.solde = app.solde();
    f(b);
    synchro();
    phase('attente', '');
    await jouer(BJ.prendre(b));
    phase(b.phase === 'fin' ? 'fin' : b.phase);
  }
  $('bj-tirer').addEventListener('click', () => action(BJ.carte));
  $('bj-rester').addEventListener('click', () => action(BJ.rester));
  $('bj-doubler').addEventListener('click', () => action(BJ.doubler));
  $('bj-separer').addEventListener('click', () => action(BJ.separer));
  const assurer = async (oui) => {
    if (occupe || b.phase !== 'assurance') return;
    b.solde = app.solde();
    BJ.assurer(b, oui);
    synchro();
    if (oui) fx.volerJetons(b.assurance, soldeBarre, cercle);
    phase('attente', '');
    await jouer(BJ.prendre(b));
    phase(b.phase === 'fin' ? 'fin' : b.phase);
  };
  $('bj-assur-oui').addEventListener('click', () => assurer(true));
  $('bj-assur-non').addEventListener('click', () => assurer(false));

  /* le clavier : C carte, R rester, D doubler, S séparer, Entrée distribuer / rejouer */
  addEventListener('keydown', (e) => {
    if (!document.getElementById('s-blackjack').classList.contains('is-active') || e.repeat || document.querySelector('.ov:not([hidden])')) return;
    const k = e.key.toLowerCase();
    if (phaseUI === 'jeu') ({ c: () => action(BJ.carte), r: () => action(BJ.rester), d: () => action(BJ.doubler), s: () => action(BJ.separer) })[k]?.();
    if (k === 'enter') { if (phaseUI === 'mise') distribuer(mise); else if (phaseUI === 'fin') distribuer(Math.min(derniere, app.solde())); }
  });

  return {
    entrer() {
      if (!croupier) croupier = creerCroupier($('bj-croupier'), 'margot');
      if (!occupe && (phaseUI === 'mise' || phaseUI === 'fin')) {
        setTimeout(() => croupier.dire(app.solde() < MIN ? 'Bonsoir. Il vous faut des jetons : passez à la caisse.' : 'Bonsoir, bienvenue à ma table. Faites vos jeux.'), 500);
      }
      dessinerCercle();
    },
    sortir() { croupier?.taire(); },
  };
}
