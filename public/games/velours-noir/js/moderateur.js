/**
 * LE VELOURS NOIR — le modérateur : son entrée cachée et le Marché secret.
 *
 * L'entrée : cinq clics sur l'enseigne du hall ouvrent une petite porte où
 * l'on donne le code. Le code n'est vérifié que par le serveur (variable
 * d'environnement MODERATEUR_CODE) ; en échange, le serveur remet un jeton
 * signé que l'on garde ici et qu'il revérifie à chaque connexion. Sans
 * jeton valable, ni le Marché ni le mode croupier n'apparaissent.
 *
 * À savoir : la caisse et le compte sont gardés dans le navigateur ; ce
 * marché est un outil pour le modérateur, pas une protection contre un
 * tricheur.
 */

import * as EL from './enligne.js';
import * as C from '../../../shared/casino/compte.js';
import * as succes from '../../../shared/succes.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const $ = (id) => document.getElementById(id);
const CLE = 'velours.moderateur';
const CLE_JOURNAL = 'velours.moderateur.journal';

export function monterModerateur(app, { ouvrirCroupier } = {}) {
  let actif = false;
  const lire = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const ecrire = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

  /**
   * La porte du croupier et le bouton du Marché n'existent pas dans la page :
   * on les ajoute seulement quand le serveur a reconnu le modérateur (son code
   * et son compte), et on les retire sinon.
   */
  function activer(oui) {
    actif = oui;
    document.body.classList.toggle('moderateur', oui);
    document.querySelectorAll('.reserve-moderateur').forEach((el) => el.remove());
    if (!oui) return;
    const porte = document.createElement('button');
    porte.className = 'porte porte-croupier reserve-moderateur';
    porte.style.setProperty('--i', 3);
    porte.innerHTML = '<span class="porte-art art-croupier" aria-hidden="true"><i class="mini-carte">V<em>♠</em></i><i class="mini-roue"></i></span><b>Croupier d’un soir</b><span>Passez de l’autre côté de la table. Réservé à la direction.</span><em>Modérateur</em>';
    porte.addEventListener('click', () => { sfx.clic(); if (actif) ouvrirCroupier?.(); });
    document.querySelector('.portes').appendChild(porte);
    const marche = document.createElement('button');
    marche.className = 'btn petit reserve-moderateur';
    marche.textContent = '🗝️ Marché secret';
    marche.addEventListener('click', ouvrirMarche);
    document.querySelector('.hall-bas').appendChild(marche);
  }

  /* l'entrée cachée : cinq clics rapides sur l'enseigne */
  let clics = [];
  document.querySelector('.enseigne h1').addEventListener('click', () => {
    const t = Date.now();
    clics = clics.filter((x) => t - x < 3000);
    clics.push(t);
    if (clics.length < 5) return;
    clics = [];
    if (actif) return ouvrirMarche();
    $('mod-code').value = '';
    $('mod-msg').textContent = '';
    $('ov-mod-entree').hidden = false;
    setTimeout(() => $('mod-code').focus(), 50);
  });
  const valider = () => {
    const code = $('mod-code').value;
    if (!code) return;
    $('mod-msg').textContent = 'Vérification…';
    EL.envoyer({ t: 'moderateur', code, profil: succes.codeProfil() });
  };
  $('mod-valider').addEventListener('click', valider);
  $('mod-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });

  EL.ecouter((m) => {
    if (m.t === 'ouverte') {
      const jeton = lire(CLE, null);
      if (jeton) EL.envoyer({ t: 'moderateur', jeton, profil: succes.codeProfil() });
      return;
    }
    if (m.t !== 'moderateur') return;
    if (m.verif) {
      if (!m.ok) ecrire(CLE, null);
      return activer(m.ok);
    }
    if (!m.ok) { $('mod-msg').textContent = m.msg || 'Refusé.'; fx.secouer($('ov-mod-entree').querySelector('.panneau'), 6); return; }
    ecrire(CLE, m.jeton);
    $('mod-code').value = '';
    $('ov-mod-entree').hidden = true;
    activer(true);
    sfx.gain(true);
    noter('Connexion modérateur');
    ouvrirMarche();
  });

  /* ---------- le Marché secret ---------- */
  function noter(action, montant = '') {
    const j = lire(CLE_JOURNAL, []);
    j.unshift({ t: Date.now(), action, montant });
    ecrire(CLE_JOURNAL, j.slice(0, 40));
    dessinerJournal();
  }
  function dessinerJournal() {
    const f = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    $('mod-journal').innerHTML = lire(CLE_JOURNAL, []).slice(0, 12).map((x) => `<li><time>${f.format(x.t)}</time> ${x.action}${x.montant ? ` <b>${x.montant}</b>` : ''}</li>`).join('') || '<li>Rien pour l’instant.</li>';
  }
  function ouvrirMarche() {
    if (!actif) return;
    dessinerJournal();
    $('ov-marche').hidden = false;
  }

  const montantLibre = (id) => Math.max(0, Math.min(10 ** 9, Math.floor(Number($(id).value) || 0)));
  $('ov-marche').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !actif) return;
    if (b.dataset.jetons) {
      const n = b.dataset.jetons === 'libre' ? montantLibre('mod-jetons') : Number(b.dataset.jetons);
      if (!n) return;
      app.crediter(n);
      sfx.jetons(10);
      fx.texte(`+${fx.nombre(n)}`, b);
      noter('Jetons', `+${fx.nombre(n)}`);
    }
    if (b.dataset.euros) {
      const n = b.dataset.euros === 'libre' ? montantLibre('mod-euros') : Number(b.dataset.euros);
      if (!n) return;
      C.encaisser(app.compte(), n * 100, 'Virement de la direction');
      app.sauverCompte();
      sfx.gain();
      fx.texte(`+${n} €`, b);
      noter('Euros', `+${fx.nombre(n)} €`);
    }
    if (b.dataset.tournoi) {
      EL.envoyer({ t: 'tournoi-demo', type: b.dataset.tournoi });
      noter('Tournoi lancé', b.textContent.trim());
      $('ov-marche').hidden = true;
    }
    if (b.id === 'mod-succes') {
      for (const s of succes.SUCCES) if (s.jeu === 'velours') succes.debloquer(s.id);
      fx.texte('Succès débloqués', b);
      noter('Succès du casino débloqués');
    }
    if (b.id === 'mod-sortir') {
      ecrire(CLE, null);
      activer(false);
      $('ov-marche').hidden = true;
    }
  });

  activer(false);
  return { actif: () => actif };
}
