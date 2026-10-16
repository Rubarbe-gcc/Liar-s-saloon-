/**
 * PLEIN STADE — fabrique les répliques du commentateur avec une voix ElevenLabs.
 *
 * Les répliques sont dans public/games/plein-stade/commun/voix/lignes.json
 * (l'identifiant de la voix aussi). Chaque réplique devient un MP3 dans le même
 * dossier, et liste.json dit au jeu lesquelles existent. On ne le lance qu'une
 * fois (et quand on ajoute des répliques : celles déjà faites sont gardées).
 *
 * La clé API reste chez toi : elle n'est lue que dans la variable
 * d'environnement ELEVENLABS_API_KEY, jamais écrite nulle part.
 *
 *   PowerShell : $env:ELEVENLABS_API_KEY="ta-clé"; node scripts/generer-voix.mjs
 *   Bash       : ELEVENLABS_API_KEY="ta-clé" node scripts/generer-voix.mjs
 *   Option --tout  : refaire aussi les répliques déjà faites.
 *   Option --liste : sans clé, seulement remettre à jour liste.json (si tu as fait
 *                    les MP3 toi-même sur le site d'ElevenLabs, nommés comme les id).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const dossier = path.join(ici, '..', 'public', 'games', 'plein-stade', 'commun', 'voix');
const { voix, lignes } = JSON.parse(fs.readFileSync(path.join(dossier, 'lignes.json'), 'utf8'));
const cle = process.env.ELEVENLABS_API_KEY;
const tout = process.argv.includes('--tout');
const seulementListe = process.argv.includes('--liste');

if (!cle && !seulementListe) {
  console.error('Il manque la clé : ELEVENLABS_API_KEY (voir le haut de ce fichier).');
  process.exit(1);
}

/** Le ton selon l'énergie de la réplique : calme (1) → explosif (4). */
const REGLAGES = {
  1: { stability: 0.6, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
  2: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
  3: { stability: 0.35, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true },
  4: { stability: 0.25, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true },
};

let faites = 0, gardees = 0, ratees = 0;
for (const l of seulementListe ? [] : lignes) {
  const fichier = path.join(dossier, `${l.id}.mp3`);
  if (!tout && fs.existsSync(fichier)) { gardees += 1; continue; }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voix}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': cle, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: l.texte, model_id: 'eleven_multilingual_v2', voice_settings: REGLAGES[l.energie] || REGLAGES[2] }),
  });
  if (!r.ok) {
    ratees += 1;
    console.error(`✗ ${l.id} : ${r.status} ${(await r.text()).slice(0, 200)}`);
    if (r.status === 401) break;
    continue;
  }
  fs.writeFileSync(fichier, Buffer.from(await r.arrayBuffer()));
  faites += 1;
  console.log(`✓ ${l.id} — ${l.texte}`);
}

// La liste de ce qui existe : le jeu ne cherche que ces fichiers.
const presentes = lignes.map((l) => l.id).filter((id) => fs.existsSync(path.join(dossier, `${id}.mp3`)));
fs.writeFileSync(path.join(dossier, 'liste.json'), JSON.stringify(presentes, null, 2) + '\n');
console.log(`\n${faites} faites, ${gardees} déjà là, ${ratees} ratées. ${presentes.length} répliques prêtes pour le jeu.`);
