/**
 * STREET COMBAT — le Codex : les fiches des personnages et l'histoire de la
 * Fracture, qui se remplissent au fil des rencontres et des chapitres.
 *
 * On note qui on a vu dans une cinématique (`voir`) et jusqu'où on est allé
 * dans l'histoire (`atteindre`) ; tout reste sur l'appareil.
 */

import { PERSOS, FIGURANTS, PERSO } from '../../../shared/street/persos.js';
import { dessinerPortrait } from './dessin.js';

const CLE_VUS = 'street.codex';
const CLE_SCENES = 'street.codex.scenes';
const lire = (cle) => { try { return new Set(JSON.parse(localStorage.getItem(cle)) || []); } catch { return new Set(); } };
const ecrire = (cle, ens) => { try { localStorage.setItem(cle, JSON.stringify([...ens])); } catch { /* plein */ } };

/** Ce personnage apparaît : sa fiche s'ouvre. */
export function voir(id) {
  if (!PERSO[id] || id === 'heros') return;
  const v = lire(CLE_VUS);
  if (v.has(id)) return;
  v.add(id);
  ecrire(CLE_VUS, v);
}
/** On arrive à cette scène : l'histoire se dévoile. */
export function atteindre(scene) {
  const v = lire(CLE_SCENES);
  if (v.has(scene)) return;
  v.add(scene);
  ecrire(CLE_SCENES, v);
}

export const BIOS = {
  ryuken: 'Élève de Maître Gen, ami de toujours du héros. Il se bat avec le cœur… et l’estomac : il doit encore des ramen.',
  blazero: 'Maître du feu au tempérament explosif. Le premier corrompu par un éclat, le premier à revenir.',
  frostbyte: 'Cryomancien de la toundra. Corrompu, il croyait que le temps était une maladie, et voulait tout geler.',
  shadowkira: 'Assassin de l’ombre, prête à tout — même à trahir — pour retrouver sa sœur disparue il y a dix ans.',
  thunderox: 'Berserker du tonnerre. Corrompu, il a fait tomber la cité céleste ; libéré, il l’a retenue de ses bras.',
  ironclad: 'Cyborg de la station Zéro-G. Il lui manque 2 % de mémoire, et il donnerait tout le reste pour ses amis.',
  serpenta: 'Danseuse venimeuse de la jungle. La première à avoir vu l’homme à l’horloge.',
  gravox: 'Seigneur des forces cosmiques. La gravité lui obéit — sauf quand un éclat lui parle à l’oreille.',
  lunara: 'Prêtresse de la nuit éternelle. Elle a vu le reflet du héros dans la lune avant tout le monde.',
  pyroclaw: 'La bête dragon du volcan. Ses chaînes ont cédé le soir de la Fracture.',
  wraithblade: 'Samouraï spectral, gardien de la porte de la forêt. Un seul échange. Un seul round.',
  celestia: 'Une étoile arrachée au ciel par la Fracture. Elle n’a qu’un rêve : rentrer chez elle.',
  stoneback: 'Le golem des ruines. Il ne dort jamais vraiment : il se souvient de chacune des boucles de Kaïros.',
  stormwing: 'L’aigle des tempêtes. Du haut du ciel, il a vu Kaïros compter les secondes et prendre des notes.',
  voidreaper: 'Le messager de la fin, gardien des portes de l’enfer.',
  aquathorn: 'Chevalier des profondeurs. Kaïros lui avait promis que l’océan recouvrirait le monde.',
  solarius: 'Gardien de la lumière, le premier à avoir mis le héros en garde. « Pas avant. »',
  malvortex: 'Seigneur des abysses. Il a ouvert l’enfer au Chaos… et pris la vie de Maître Gen.',
  lechaos: 'Dieu de la destruction, simple aiguille de l’horloge de Kaïros. Là où il passe, l’existence s’efface.',
  kairos: 'Le Seigneur du Temps. Mille ans à remonter les jours pour sauver sa fille Héméra. Mille échecs.',
  onyx: 'Champion invaincu du ring clandestin. Cent combats, cent K.O. — jusqu’au cent-unième.',
  nemesis: 'Le reflet du héros. Le héros de la 999ᵉ boucle, celle qui a échoué, refait par Kaïros à ton image.',
  vorn: 'Général de l’Armée de l’Horloge. Kaïros lui a sauvé la vie il y a cent ans ; il a payé sa dette en se retournant contre lui.',
  sablia: 'Gardienne du sablier. Chaque grain était une seconde volée au monde. Elle les a toutes rendues.',
  eclipse: 'La sœur de Shadow Kira, façonnée par Kaïros avec du temps volé. Elle avait peur du noir.',
  hemera: 'La fille de Kaïros. Une fièvre l’a emportée il y a mille ans ; la Fracture refermée l’a rendue à son père.',
  premier: 'Le héros de la toute première boucle, prisonnier du cœur de l’horloge. Il a été toi, il y a mille essais.',
  maitre: 'Maître Gen, le vieux maître du dojo. Sa dernière leçon : un combattant se mesure au nombre de fois où il se relève.',
  vornjeune: 'Vorn, il y a cent ans : un jeune soldat qui refusait de laisser ses hommes derrière lui.',
  soldat: 'Une seconde gelée, devenue soldat. Quand l’armée tombe, elle rentre chez elle : dans la vie de quelqu’un.',
  sentinelle: 'Les gardes lourds de l’Armée de l’Horloge. Un mur qui marche.',
  chasseur: 'Les éclaireurs de l’Armée de l’Horloge. Ils arrivent toujours une seconde avant toi.',
  pillard: 'Mercenaire d’une guerre oubliée, il y a cent ans.',
  habitant: 'Les habitants de Néon City. Ils ont tout perdu dans l’attaque de l’armée.',
};

/** L'histoire de la Fracture, page par page (chacune s'ouvre à une scène). */
export const LORE = [
  { titre: 'La Fracture', apres: 'prologue', texte: 'Une nuit, au-dessus de Néon City, le ciel s’est fendu. De cette blessure tombent des éclats violets, et derrière elle, quelque chose attend.' },
  { titre: 'Les éclats', apres: 'dojo', texte: 'Qui touche un éclat devient plus fort, et perd son âme : il entend une voix, un tic-tac, qui lui dit « encore ». Battu, il rend l’éclat.' },
  { titre: 'L’Armée de l’Horloge', apres: 'ruelle', texte: 'Des soldats faits de secondes volées au monde. Une seule volonté les tient : celle de leur Général.' },
  { titre: 'Maître Gen', apres: 'deuil', texte: 'Le vieux maître du dojo est mort en protégeant ses élèves. Ryu-Ken a juré de le venger. C’est là que tout a commencé à mal tourner pour lui.' },
  { titre: 'Les mille boucles', apres: 'gardien', texte: 'Kaïros a rejoué cette histoire mille fois. Le golem des ruines s’en souvient. Tu es le millième essai.' },
  { titre: 'La Citadelle', apres: 'traversee', texte: 'La forteresse de l’armée, au cœur du désert maudit, couronnée d’une horloge qui tourne à l’envers.' },
  { titre: 'Kaïros', apres: 'zero', texte: 'Le Seigneur du Temps. Il a ouvert la Fracture, semé les éclats, levé l’armée. Pour voir naître le plus grand des guerriers.' },
  { titre: 'Le reflet', apres: 'zero', texte: 'Némésis n’est pas un simple miroir : c’est le héros de la 999ᵉ boucle. Il a échoué. Kaïros l’a gardé.' },
  { titre: 'Héméra', apres: 'horloge', texte: 'Il y a mille ans, Kaïros avait une fille. Une fièvre l’a emportée un matin d’hiver. Tout est parti de là.' },
  { titre: 'Le Premier Héros', apres: 'coeur', texte: 'Le héros de la toute première boucle n’est jamais reparti : prisonnier du cœur de l’horloge, il a vu passer tous les autres.' },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let onglet = 'persos';

/** Ouvre le Codex. */
export function ouvrir() {
  const vus = lire(CLE_VUS);
  const scenes = lire(CLE_SCENES);
  let debloques = new Set();
  try { debloques = new Set(JSON.parse(localStorage.getItem('street.debloques')) || []); } catch { /* rien */ }
  const tous = [...PERSOS, ...FIGURANTS];
  const connu = (p) => vus.has(p.id) || debloques.has(p.id);
  const nbConnus = tous.filter(connu).length;
  const pages = LORE.filter((l) => scenes.has(l.apres));
  $('codex-onglets').innerHTML = `<button class="btn petit${onglet === 'persos' ? ' rouge' : ''}" data-onglet="persos">Personnages (${nbConnus}/${tous.length})</button>
    <button class="btn petit${onglet === 'lore' ? ' rouge' : ''}" data-onglet="lore">La Fracture (${pages.length}/${LORE.length})</button>`;
  $('codex').innerHTML = onglet === 'persos'
    ? tous.map((p) => (connu(p)
      ? `<div class="codex-perso"><canvas data-codex="${p.id}" width="72" height="72"></canvas><div><b style="color:${p.c.c1}">${esc(p.nom)}</b><small>${esc(p.style)}</small><p>${esc(BIOS[p.id] || p.desc)}</p></div></div>`
      : `<div class="codex-perso inconnu"><canvas data-codex="${p.id}" data-ombre="1" width="72" height="72"></canvas><div><b>???</b><small>Pas encore rencontré</small></div></div>`)).join('')
    : (pages.length ? pages.map((l) => `<div class="codex-lore"><b>${esc(l.titre)}</b><p>${esc(l.texte)}</p></div>`).join('') : '<p class="sous">Avancez dans le mode Histoire pour découvrir l’histoire de la Fracture.</p>')
      + (pages.length < LORE.length ? `<p class="sous" style="font-size:.8rem">${LORE.length - pages.length} page(s) encore cachée(s)…</p>` : '');
  $('codex').querySelectorAll('[data-codex]').forEach((cv) => dessinerPortrait(cv.getContext('2d'), PERSO[cv.dataset.codex], 72, { t: 8, ombre: !!cv.dataset.ombre }));
  $('codex-onglets').onclick = (e) => { const b = e.target.closest('[data-onglet]'); if (b) { onglet = b.dataset.onglet; ouvrir(); } };
  $('ov-codex').hidden = false;
}
