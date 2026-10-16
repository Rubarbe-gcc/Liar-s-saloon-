/**
 * PLEIN STADE — découpe un enregistrement du commentateur (toutes les répliques
 * de commun/voix/lignes.json, dans l'ordre, séparées par des pauses) en un MP3
 * par réplique, nommé comme son id. On coupe entre les trames MP3 (pas de
 * réencodage, pas de perte), puis on met à jour liste.json.
 *
 *   node scripts/decouper-voix.mjs <enregistrement.mp3> <moments.json>
 * moments.json : [[début, fin], …] en secondes, une paire par réplique (repérés
 * dans les silences de l'enregistrement).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const dossier = path.join(ici, '..', 'public', 'games', 'plein-stade', 'commun', 'voix');
const [source, fichierMoments] = process.argv.slice(2);
const { lignes } = JSON.parse(fs.readFileSync(path.join(dossier, 'lignes.json'), 'utf8'));
const moments = JSON.parse(fs.readFileSync(fichierMoments, 'utf8'));
if (moments.length !== lignes.length) throw new Error(`${moments.length} moments pour ${lignes.length} répliques : l'enregistrement ne correspond pas à la liste.`);

const b = fs.readFileSync(source);
let o = 0;
// L'étiquette ID3 du début, s'il y en a une.
if (b.toString('latin1', 0, 3) === 'ID3') o = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);

const DEBITS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const FREQS = [44100, 48000, 32000];
const trames = [];
let temps = 0;
while (o + 4 <= b.length) {
  if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) { o += 1; continue; }
  const version = (b[o + 1] >> 3) & 3, couche = (b[o + 1] >> 1) & 3;
  const debit = DEBITS[(b[o + 2] >> 4) & 15] * 1000, freq = FREQS[(b[o + 2] >> 2) & 3], bourrage = (b[o + 2] >> 1) & 1;
  if (version !== 3 || couche !== 1 || !debit || !freq) { o += 1; continue; }
  const long = Math.floor((144 * debit) / freq) + bourrage;
  // La trame d'information (Xing/Info) ne contient pas de son : on ne la compte pas.
  const info = ['Xing', 'Info'].includes(b.toString('latin1', o + 36, o + 40));
  if (!info) { trames.push({ o, long, t: temps }); temps += 1152 / freq; }
  o += long;
}

let n = 0;
moments.forEach(([debut, fin], k) => {
  const avant = k > 0 ? moments[k - 1][1] : 0, apres = k + 1 < moments.length ? moments[k + 1][0] : Infinity;
  const de = Math.max(avant + 0.05, debut - 0.12), a = Math.min(apres - 0.1, fin + 0.35);
  const choisies = trames.filter((t) => t.t >= de && t.t <= a);
  fs.writeFileSync(path.join(dossier, `${lignes[k].id}.mp3`), Buffer.concat(choisies.map((t) => b.subarray(t.o, t.o + t.long))));
  n += 1;
});
const presentes = lignes.map((l) => l.id).filter((id) => fs.existsSync(path.join(dossier, `${id}.mp3`)));
fs.writeFileSync(path.join(dossier, 'liste.json'), JSON.stringify(presentes, null, 2) + '\n');
console.log(`${n} répliques découpées (${trames.length} trames, ${temps.toFixed(1)} s). liste.json : ${presentes.length}.`);
