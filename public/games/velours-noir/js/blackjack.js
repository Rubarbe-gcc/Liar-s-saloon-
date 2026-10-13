/**
 * LE VELOURS NOIR — la table de blackjack, avec Céleste.
 *
 * Seul, le moteur (shared/casino/blackjack.js, une place) tourne ici ; en
 * ligne, le serveur fait tourner la même table à cinq places et envoie ses
 * événements. Dans les deux cas, cet écran les rejoue un par un, au rythme
 * d'une vraie table, et règle la caisse du joueur d'après ce qui concerne
 * sa place (`moi`).
 */

import * as BJ from '../../../shared/casino/blackjack.js';
import { makeRng } from '../../../shared/hasard.js';
import { creerCroupier } from './croupier.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';
import * as EL from './enligne.js';

const $ = (id) => document.getElementById(id);
const MIN = 5, MAX = 500;
const JETONS = [5, 25, 100, 500];
const TEXTES = { blackjack: 'Blackjack !', gagne: 'Gagné', perdu: 'Perdu', egalite: 'Égalité', brule: 'Brûlé' };

export function monterBlackjack(app) {
  let croupier = null;
  const b = BJ.creerBlackjack({ rng: makeRng(Date.now() ^ 0xb1ac), places: 1 });
  BJ.asseoir(b, 0, { nom: 'Vous' });
  let enLigne = false, moi = 0, membres = [];
  let mise = 0, derniere = 0, occupe = false;
  let places = {};                // s → { el, mains: [{ el, cartes, mise, pile }] }
  let croupierUI = { cartes: [], cachee: null };
  let monTour = false, monAssurance = false, fini = false, aJoue = false;
  let file = Promise.resolve();
  let compteFin = 0, compteT = 0;

  const ecran = $('s-blackjack');
  const feutre = $('bj-feutre');
  const sabot = $('bj-sabot');
  const cercle = $('bj-cercle');
  const zoneMains = $('bj-mains');
  const zoneCroupier = $('bj-cartes-croupier');
  const totalCroupier = $('bj-total-croupier');
  const soldeBarre = document.querySelector('#s-blackjack .barre-solde');
  croupier = creerCroupier($('bj-croupier'), 'celeste');

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

  function dessinerCercle() {
    cercle.querySelector('.pile')?.remove();
    if (mise > 0) cercle.appendChild(fx.pile(mise));
    for (const j of plateau.children) j.classList.toggle('trop', mise + Number(j.dataset.v) > Math.min(MAX, app.solde()));
    $('bj-distribuer').disabled = mise < MIN;
    $('bj-effacer').disabled = mise === 0;
  }

  function annoncerMise() { if (enLigne) EL.envoyer({ t: 'miser', mise }); }

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
    annoncerMise();
  }

  $('bj-effacer').addEventListener('click', () => {
    if (occupe || !mise) return;
    const p = cercle.querySelector('.pile');
    if (p) fx.volerJetons(mise, p, plateau);
    sfx.jetons(4);
    mise = 0;
    dessinerCercle();
    annoncerMise();
  });

  /* ---------- les phases (les rangées de boutons) ---------- */
  let phaseUI = 'mise';
  function phase(p, message = '') {
    phaseUI = p;
    ecran.classList.toggle('en-jeu', p !== 'mise');
    for (const r of document.querySelectorAll('#bj-commandes .rangee')) r.hidden = r.dataset.phase !== p;
    if (p === 'attente') document.querySelector('#bj-commandes .attente').textContent = message || '…';
    if (p === 'jeu') {
      const a = mesActions();
      $('bj-tirer').disabled = !a.tirer;
      $('bj-rester').disabled = !a.rester;
      $('bj-doubler').disabled = !a.doubler;
      $('bj-separer').disabled = !a.separer;
    }
    if (p === 'mise') {
      dessinerCercle();
      $('bj-distribuer').textContent = enLigne ? 'Je suis prêt' : 'Distribuer';
    }
    if (p === 'fin') $('bj-rejouer').textContent = derniere <= app.solde() ? `Rejouer ${fx.nombre(derniere)}` : 'Rejouer';
  }

  /** Ce que je peux faire sur ma main en cours (d'après les cartes posées et ma caisse). */
  let maMain = 0;
  function mesActions() {
    const m = places[moi]?.mains[maMain];
    if (!monTour || !m) return { tirer: false, rester: false, doubler: false, separer: false };
    const deux = m.cartes.length === 2;
    const assez = app.solde() >= m.mise;
    return {
      tirer: true, rester: true,
      doubler: deux && assez,
      separer: deux && assez && BJ.valeurCarte(m.cartes[0].r) === BJ.valeurCarte(m.cartes[1].r) && places[moi].mains.length < 4,
    };
  }

  /* ---------- la table ---------- */
  let sale = false;
  /** Les cartes de la donne précédente partent à la défausse. */
  function nettoyer() {
    if (!sale) return 0;
    sale = false;
    const cartes = [...feutre.querySelectorAll('.carte')];
    cartes.forEach((c, k) => fx.partir(c, { left: innerWidth * 0.05, top: innerHeight * 0.1, width: 0, height: 0 }, { duree: 380, delai: k * 25, tour: -40 }));
    for (const p of Object.values(places)) p.el.querySelector('.mains').querySelectorAll('.main-bj').forEach((v) => v.querySelectorAll('.badge, .total, .pile').forEach((x) => x.remove()));
    const vieux = [...zoneMains.querySelectorAll('.main-bj')];
    const duree = 420 + cartes.length * 25;
    setTimeout(() => vieux.forEach((v) => v.remove()), duree);
    for (const p of Object.values(places)) p.mains = [];
    totalCroupier.hidden = true;
    if (cartes.length) sfx.carte();
    return duree;
  }

  /** Les places autour de la table (une seule quand on joue seul). */
  function dessinerPlaces() {
    const vues = enLigne ? membres.map((m) => m.s) : [0];
    for (const s of Object.keys(places).map(Number)) if (!vues.includes(s)) { places[s].el.remove(); delete places[s]; }
    for (const s of [...vues].sort((a, c) => a - c)) {
      if (!places[s]) {
        const el = document.createElement('div');
        el.className = 'place-bj';
        el.dataset.s = s;
        el.innerHTML = '<div class="mains"></div><div class="mise-place"></div><span class="nom-place"></span>';
        places[s] = { el, mains: [] };
      }
      zoneMains.appendChild(places[s].el);
      const m = membres.find((x) => x.s === s);
      places[s].el.classList.toggle('moi', s === moi);
      places[s].el.classList.toggle('absent', !!m?.absent);
      places[s].el.querySelector('.nom-place').textContent = enLigne && m ? `${m.avatar} ${s === moi ? 'Vous' : m.nom}` : '';
    }
    feutre.classList.toggle('multi', vues.length > 1);
  }

  function miseAffichee(s, montant) {
    const p = places[s];
    if (!p || s === moi) return;
    const z = p.el.querySelector('.mise-place');
    z.innerHTML = '';
    if (montant > 0) z.appendChild(fx.pile(montant, { max: 6 }));
  }

  function nouvelleMainUI(s, montant, apres = null) {
    const el = document.createElement('div');
    el.className = 'main-bj';
    el.innerHTML = '<div class="cartes"></div><span class="total" hidden></span>';
    const pile = fx.pile(montant);
    el.appendChild(pile);
    const m = { el, cartes: [], mise: montant, pile };
    if (apres) apres.el.after(el); else places[s].el.querySelector('.mains').appendChild(el);
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

  const nomDe = (s) => (s === moi ? 'vous' : membres.find((m) => m.s === s)?.nom || 'un joueur');

  /** Rejoue des événements de la table (les uns après les autres, même s'ils arrivent pendant qu'on joue les précédents). */
  function jouer(evts) {
    file = file.then(() => jouerTout(evts)).catch((err) => console.error(err));
    return file;
  }

  async function jouerTout(evts) {
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
          await fx.attendre(nettoyer());
          croupierUI = { cartes: [], cachee: null };
          fini = false; aJoue = false;
          for (const [s, montant] of Object.entries(e.mises).map(([k, v]) => [Number(k), v])) {
            if (!places[s]) continue;
            places[s].el.querySelector('.mise-place').innerHTML = '';
            const m = nouvelleMainUI(s, montant);
            places[s].mains = [m];
            if (s === moi) {
              aJoue = true;
              derniere = montant;
              app.debiter(montant);
              cercle.querySelector('.pile')?.remove();
              mise = 0;
              fx.arriver(m.pile, cercle, { duree: 300, echelle: 1 });
            }
          }
          sale = true;
          break;
        }
        case 'carte':
          if (e.s === 'croupier') {
            const el = await poserCarte(zoneCroupier, e.carte, { cachee: e.cachee });
            if (e.cachee) croupierUI.cachee = el;
            else { croupierUI.cartes.push(e.carte); majTotal(totalCroupier, croupierUI.cartes); }
          } else {
            const p = places[e.s];
            const m = p?.mains[e.main];
            if (!m) break;
            const centre = zoneMains.getBoundingClientRect();
            const r = p.el.getBoundingClientRect();
            await poserCarte(m.el.querySelector('.cartes'), e.carte, { vers: ((r.left + r.width / 2) - (centre.left + centre.width / 2)) / (centre.width / 2 || 1) });
            m.cartes.push(e.carte);
            majTotal(m.el.querySelector('.total'), m.cartes);
          }
          await fx.attendre(110);
          break;
        case 'assurance':
          croupier.dire('Assurance ?');
          monAssurance = e.sieges.includes(moi);
          break;
        case 'assurance-prise':
          if (e.s === moi) { app.debiter(e.montant); monAssurance = false; }
          fx.volerJetons(e.montant, e.s === moi ? soldeBarre : places[e.s]?.el, places[e.s]?.el ?? cercle);
          break;
        case 'verifie':
          monAssurance = false;
          croupier.dire('Je vérifie…', { voix: false });
          if (croupierUI.cachee) croupierUI.cachee.animate([{ transform: 'none' }, { transform: 'translateY(-8px) rotateX(35deg)' }, { transform: 'none' }], { duration: 700 });
          await fx.attendre(800);
          break;
        case 'revele':
          monAssurance = false;
          if (croupierUI.cachee) {
            sfx.retourne();
            await fx.retourner(croupierUI.cachee, e.carte);
            croupierUI.cachee = null;
          }
          croupierUI.cartes.push(e.carte);
          majTotal(totalCroupier, croupierUI.cartes);
          if (BJ.estBlackjack(croupierUI.cartes)) { sfx.coup(); croupier.dire('Blackjack pour la maison.'); fx.secouer(feutre, 5); await fx.attendre(700); }
          await fx.attendre(300);
          break;
        case 'assurance-reglee':
          if (e.s === moi && e.retour > 0) { app.crediter(e.retour); fx.texte('Assurance payée', cercle); sfx.gain(); }
          await fx.attendre(300);
          break;
        case 'a-qui': {
          monAssurance = false;
          monTour = e.s === moi;
          maMain = e.main;
          for (const [s, p] of Object.entries(places)) {
            p.el.classList.toggle('a-son-tour', Number(s) === e.s && enLigne);
            p.mains.forEach((m, k) => m.el.classList.toggle('active', Number(s) === e.s && k === e.main && (p.mains.length > 1 || enLigne)));
          }
          break;
        }
        case 'brule': {
          if (e.s === moi) monTour = false;
          const m = places[e.s]?.mains[e.main];
          if (!m) break;
          badge(m, 'brule');
          if (e.s === moi) { sfx.perte(); fx.secouer(m.el, 4); }
          croupier.ramasse();
          fx.volerJetons(m.mise, m.pile, croupier.el);
          m.pile.style.visibility = 'hidden';
          await fx.attendre(500);
          break;
        }
        case 'double': {
          const m = places[e.s]?.mains[e.main];
          if (e.s === moi) { app.debiter(e.ajout); monTour = false; }
          if (!m) break;
          fx.volerJetons(e.ajout, e.s === moi ? soldeBarre : places[e.s].el, m.pile);
          sfx.jetons(4);
          await fx.attendre(350);
          changerPile(m, e.mise);
          fx.texte('Double !', m.el);
          break;
        }
        case 'separe': {
          const p = places[e.s];
          const m = p?.mains[e.main];
          if (e.s === moi) app.debiter(e.ajout);
          if (!m) break;
          const deux = nouvelleMainUI(e.s, m.mise, m);
          p.mains.splice(e.main + 1, 0, deux);
          const carteEl = m.el.querySelector('.cartes .carte:last-child');
          const c = m.cartes.pop();
          deux.el.querySelector('.cartes').appendChild(carteEl);
          deux.cartes.push(c);
          fx.arriver(carteEl, m.el, { duree: 300, echelle: 1 });
          fx.volerJetons(m.mise, e.s === moi ? soldeBarre : p.el, deux.pile);
          sfx.jetons(4);
          majTotal(m.el.querySelector('.total'), m.cartes);
          majTotal(deux.el.querySelector('.total'), deux.cartes);
          await fx.attendre(420);
          break;
        }
        case 'resultat': {
          monTour = false;
          const m = places[e.s]?.mains[e.main];
          if (e.s === moi && e.retour > 0) app.crediter(e.retour);
          if (!m) break;
          m.el.classList.remove('active');
          if (e.res === 'brule') break;
          badge(m, e.res);
          const versJoueur = e.s === moi ? soldeBarre : places[e.s].el;
          if (e.retour > m.mise) {
            croupier.paie();
            fx.volerJetons(e.retour - m.mise, croupier.el, m.pile);
            sfx.jetons(6);
            await fx.attendre(500);
            changerPile(m, e.retour);
            fx.texte(`+${fx.nombre(e.retour - m.mise)}`, m.el);
            await fx.attendre(250);
            fx.volerJetons(e.retour, m.pile, versJoueur);
          } else if (e.res === 'egalite') {
            fx.volerJetons(e.retour, m.pile, versJoueur);
          } else {
            croupier.ramasse();
            fx.volerJetons(m.mise, m.pile, croupier.el);
            sfx.jetons(3);
          }
          m.pile.style.visibility = 'hidden';
          await fx.attendre(350);
          break;
        }
        case 'fin':
          monTour = false; monAssurance = false; fini = true;
          for (const p of Object.values(places)) p.el.classList.remove('a-son-tour');
          await fin(e);
          break;
      }
    }
    occupe = false;
    apresJeu();
  }

  /** Une fois les événements rejoués : ce que le joueur peut faire maintenant. */
  function apresJeu() {
    if (monAssurance) return phase('assurance');
    if (monTour) return phase('jeu');
    if (fini) return enLigne ? phase('attente', 'Prochaine donne dans un instant…') : phase('fin');
    if (enLigne && phaseUI !== 'mise') {
      const s = Object.entries(places).find(([, p]) => p.el.classList.contains('a-son-tour'))?.[0];
      phase('attente', s !== undefined ? `Au tour de ${nomDe(Number(s))}…` : '…');
    }
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
    if (!aJoue || !(moi in e.nets)) {
      croupier.dire(e.croupier > 21 ? 'Le croupier saute !' : 'Faites vos jeux pour la prochaine donne.', { voix: false });
      await fx.attendre(400);
      return;
    }
    const net = e.nets[moi];
    const bj = places[moi]?.mains.some((m) => m.el.querySelector('.badge.blackjack'));
    if (bj) {
      app.succes('velours-blackjack');
      app.stat('blackjacks');
      sfx.gain(true);
      fx.flash();
      fx.confettis(places[moi].mains[0].el, 90);
      fx.texte('BLACKJACK !', feutre, 'gros');
      croupier.sourit(2200);
      croupier.dire('Blackjack ! Félicitations.');
    } else if (net > 0) {
      sfx.gain(net >= 400);
      if (net >= 400) { fx.pluieDeJetons(50); fx.secouer(feutre, 4); }
      croupier.sourit();
      croupier.dire(e.croupier > 21 ? 'Le croupier saute. Bravo !' : 'Bien joué.');
    } else if (net < 0) {
      sfx.perte();
      croupier.dire(e.bjCroupier ? 'Pas de chance cette fois.' : 'La maison gagne.', { voix: !e.bjCroupier });
      if (net <= -200) croupier.desole();
    } else {
      croupier.dire('Égalité, vous reprenez votre mise.');
    }
    if (net > 0) app.gainNet(net);
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
    if (enLigne) {
      mise = montant;
      dessinerCercle();
      EL.envoyer({ t: 'miser', mise });
      EL.envoyer({ t: 'pret' });
      phase('attente', 'Vous êtes prêt. On attend les autres…');
      return;
    }
    BJ.miser(b, 0, montant);
    if (!BJ.distribuer(b)) return;
    phase('attente', 'Distribution…');
    await jouer(BJ.prendre(b));
  }

  $('bj-distribuer').addEventListener('click', () => distribuer(mise));
  $('bj-rejouer').addEventListener('click', () => distribuer(Math.min(derniere, app.solde())));
  $('bj-changer').addEventListener('click', () => { nettoyer(); mise = 0; phase('mise'); croupier.dire('Faites vos jeux.', { voix: false }); });

  async function action(nom) {
    if (occupe || !monTour) return;
    const a = mesActions();
    if (!a[{ carte: 'tirer', rester: 'rester', doubler: 'doubler', separer: 'separer' }[nom]]) return;
    monTour = false;
    phase('attente', '');
    if (enLigne) { EL.envoyer({ t: 'action', a: nom }); return; }
    ({ carte: BJ.carte, rester: BJ.rester, doubler: BJ.doubler, separer: BJ.separer })[nom](b, 0);
    await jouer(BJ.prendre(b));
  }
  $('bj-tirer').addEventListener('click', () => action('carte'));
  $('bj-rester').addEventListener('click', () => action('rester'));
  $('bj-doubler').addEventListener('click', () => action('doubler'));
  $('bj-separer').addEventListener('click', () => action('separer'));
  const assurer = async (oui) => {
    if (occupe || !monAssurance) return;
    if (oui && app.solde() < Math.floor((places[moi]?.mains[0]?.mise || 0) / 2)) oui = false;
    monAssurance = false;
    phase('attente', '');
    if (enLigne) { EL.envoyer({ t: 'assurance', oui }); return; }
    BJ.assurer(b, 0, oui);
    await jouer(BJ.prendre(b));
  };
  $('bj-assur-oui').addEventListener('click', () => assurer(true));
  $('bj-assur-non').addEventListener('click', () => assurer(false));

  /* le clavier : C carte, R rester, D doubler, S séparer, Entrée distribuer / rejouer */
  addEventListener('keydown', (e) => {
    if (!ecran.classList.contains('is-active') || e.repeat || document.querySelector('.ov:not([hidden])')) return;
    const k = e.key.toLowerCase();
    if (phaseUI === 'jeu') ({ c: () => action('carte'), r: () => action('rester'), d: () => action('doubler'), s: () => action('separer') })[k]?.();
    if (k === 'enter') { if (phaseUI === 'mise') distribuer(mise); else if (phaseUI === 'fin') distribuer(Math.min(derniere, app.solde())); }
  });

  /* ---------- en ligne ---------- */
  function compte(reste) {
    clearInterval(compteT);
    compteFin = reste > 0 ? Date.now() + reste : 0;
    const el = $('bj-compte');
    const maj = () => {
      const s = Math.max(0, Math.ceil((compteFin - Date.now()) / 1000));
      el.hidden = !compteFin || !enLigne || s === 0;
      el.textContent = `Distribution dans ${s} s`;
      if (!s) clearInterval(compteT);
    };
    maj();
    if (compteFin) compteT = setInterval(maj, 250);
  }

  /** Redessine toute la table d'après l'état envoyé par le serveur (arrivée, retour). */
  function depuisEtat(m) {
    moi = m.moi;
    membres = m.membres;
    file = Promise.resolve();
    occupe = false;
    zoneMains.innerHTML = ''; zoneCroupier.innerHTML = '';
    places = {};
    dessinerPlaces();
    const tb = m.table;
    croupierUI = { cartes: [], cachee: null };
    for (const c of tb.croupier) {
      const el = fx.elCarte(c);
      zoneCroupier.appendChild(el);
      if (c) croupierUI.cartes.push(c); else croupierUI.cachee = el;
    }
    majTotal(totalCroupier, croupierUI.cartes);
    tb.sieges.forEach((x, s) => {
      if (!x || !places[s]) return;
      if (tb.phase === 'mise' || tb.phase === 'fin') { miseAffichee(s, x.mise); return; }
      places[s].mains = x.mains.map((mm) => {
        const ui = nouvelleMainUI(s, mm.mise);
        for (const c of mm.cartes) ui.el.querySelector('.cartes').appendChild(fx.elCarte(c));
        ui.cartes = [...mm.cartes];
        majTotal(ui.el.querySelector('.total'), ui.cartes);
        if (mm.resultat) badge(ui, mm.resultat);
        return ui;
      });
    });
    sale = tb.croupier.length > 0;
    monTour = tb.phase === 'jeu' && tb.tour?.s === moi;
    maMain = tb.tour?.m || 0;
    monAssurance = false;
    fini = tb.phase === 'fin';
    aJoue = !!tb.sieges[moi]?.enJeu;
    if (tb.phase === 'mise' || tb.phase === 'fin') { mise = tb.sieges[moi]?.mise || 0; phase('mise'); }
    else apresJeu();
    compte(m.compte);
  }

  EL.ecouter((m) => {
    if (!enLigne && m.t !== 'etat') return;
    if (m.jeu && m.jeu !== 'blackjack') return;
    if (m.t === 'etat' && m.jeu === 'blackjack') { enLigne = true; depuisEtat(m); majCode(m.code); return; }
    if (!enLigne) return;
    switch (m.t) {
      case 'membres': {
        membres = m.liste;
        dessinerPlaces();
        if (m.arrive && m.arrive !== EL.identite().nom) croupier?.dire(`Bienvenue, ${m.arrive}.`, { voix: false });
        if (m.part) croupier?.dire(`${m.part} quitte la table.`, { voix: false });
        break;
      }
      case 'mise': miseAffichee(m.s, m.mise); if (m.s !== moi) sfx.jeton(); break;
      case 'compte': compte(m.reste); break;
      case 'evts': compte(0); jouer(m.evts); break;
      case 'tour':
        file = file.then(() => {
          fini = false;
          for (const s of Object.keys(places)) miseAffichee(Number(s), 0);
          phase('mise');
          croupier.dire('Faites vos jeux.', { voix: false });
        });
        break;
      case 'parti': sortirEnLigne(); break;
      case 'erreur': croupier?.dire(m.msg, { voix: false }); break;
    }
  });

  function majCode(code) {
    const b2 = $('bj-code');
    b2.hidden = !enLigne;
    b2.textContent = `Table ${code}`;
    b2.dataset.code = code;
  }

  function sortirEnLigne() {
    enLigne = false; moi = 0; membres = [];
    zoneMains.innerHTML = ''; zoneCroupier.innerHTML = '';
    places = {};
    sale = false; mise = 0;
    compte(0);
    majCode('');
    dessinerPlaces();
    phase('mise');
  }

  return {
    entrer() {
      dessinerPlaces();
      if (!enLigne && !occupe && (phaseUI === 'mise' || phaseUI === 'fin')) {
        setTimeout(() => croupier.dire(app.solde() < MIN ? 'Bonsoir. Il vous faut des jetons : passez à la boutique.' : 'Bonsoir, bienvenue à ma table. Faites vos jeux.'), 500);
      }
      dessinerCercle();
    },
    sortir() {
      croupier?.taire();
      if (enLigne) { EL.quitter(); sortirEnLigne(); }
    },
    enLigne: () => enLigne,
  };
}
