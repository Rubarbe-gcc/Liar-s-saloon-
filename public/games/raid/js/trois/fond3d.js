/**
 * RAID — la table du Conteur derrière le menu et le choix du héros.
 *
 * Une grande toile fixe, derrière l'écran : la table vue d'en haut, deux
 * bougies, et tout en haut, dans le noir, les yeux du Conteur qui suivent ce
 * qu'on survole. Sur la table, sous chaque bouton, son objet : les boîtes des
 * sauvegardes, le livre des chapitres, la lettre, le parchemin, la clochette,
 * la bougie ; les figurines des héros ; les pions de difficulté. Survolé, un
 * objet se soulève ; choisi, il s'allume et tourne doucement.
 *
 * Les boutons restent les boutons (clavier, lecteurs d'écran) : on dessine
 * seulement leur objet dessous, posé là où est leur icône.
 */

import { THREE, creerScene } from './scene3d.js';

/**
 * Crée la table dans `hote` (un élément fixe, plein écran, derrière les écrans).
 * @returns {{ poser(objets), vider(), lancer() } | null}
 */
export function creerFond(hote) {
  const S = creerScene(hote, {
    table: { largeur: 90, profondeur: 90, y: 0, z: 0 },
    bougies: [[-9, 4, 1.6], [9, 2, 1.2]],
    conteur: false,
    forceBougies: 46,
    expo: 1.35,
  });
  if (!S) return null;
  const { scene, camera } = S;
  camera.position.set(0, 17, 8.5);
  camera.lookAt(0, 0, 0);
  const lampe = new THREE.PointLight('#ffd8a0', 62, 30, 1.4);
  lampe.position.set(0, 9, 2);
  lampe.castShadow = S.qualite === 'haute';
  lampe.shadow.mapSize.set(1024, 1024); lampe.shadow.bias = -0.002;
  scene.add(lampe);

  // Les yeux du Conteur, dans le noir, au bout de la table.
  const yeux = new THREE.Group();
  for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#f0e8c0' })); o.position.x = s * 0.7; o.scale.set(1.3, 0.7, 0.4); yeux.add(o); }
  scene.add(yeux);

  let suivis = [];
  let survole = null;

  /** Le point de la table sous un point de l'écran, et combien de pixels y fait une unité. */
  function surTable(x, y) {
    const p = S.versTable(x, y, 0);
    const a = S.versEcran(p), b = S.versEcran(p.clone().add(new THREE.Vector3(1, 0, 0)));
    return { p, pix: Math.max(1, Math.abs(b.x - a.x)) };
  }

  /** Les bougies aux coins du bas de l'écran, les yeux tout en haut. */
  function placerDecor() {
    const l = hote.clientWidth, h = hote.clientHeight;
    if (!l || !h) return;
    const [b1, b2] = S.bougies;
    b1.g.position.copy(S.versTable(l * 0.06, h * 0.9, 0));
    b2.g.position.copy(S.versTable(l * 0.95, h * 0.82, 0));
    const ou = S.versTable(l / 2, h * 0.05, 1.8);
    yeux.position.copy(ou);
  }
  S.surDimension(placerDecor);

  S.animer((dt, t) => {
    const hote2 = hote.getBoundingClientRect();
    for (const s of suivis) {
      const r = s.ancre.getBoundingClientRect();
      if (!r.width || r.bottom < -80 || r.top > hote2.height + 80) { s.objet.visible = false; continue; }
      s.objet.visible = true;
      const { p, pix } = surTable(r.left + r.width / 2, r.top + r.height * (s.o.bas ?? 0.6));
      const echelle = (Math.max(r.width, r.height) * (s.o.taille ?? 1)) / (s.taille * pix);
      const choisi = s.o.choisi?.() ?? false;
      const leve = (survole === s ? 0.5 : 0) + (choisi ? 0.25 : 0);
      s.leve += (leve - s.leve) * Math.min(1, dt * 10);
      s.objet.position.set(p.x, s.leve * echelle, p.z);
      s.objet.scale.setScalar(echelle);
      s.objet.rotation.y = s.o.angle ?? 0;
      if (choisi && s.o.tourne) s.angle = (s.angle || 0) + dt * 0.8; else s.angle = (s.angle || 0) * (1 - Math.min(1, dt * 4));
      s.objet.rotation.y += s.angle + (survole === s ? Math.sin(t * 6) * 0.08 : 0);
      s.anneau.material.opacity = choisi ? 0.55 + 0.35 * Math.sin(t * 3) : survole === s ? 0.35 : 0;
      if (s.o.fin && s.fin > 0) { s.fin += dt; s.objet.position.y += s.fin * s.fin * 30; }
    }
    // Les yeux suivent ce qu'on survole, et clignent de temps en temps.
    const vise = survole ? survole.objet.position.x * 0.12 : 0;
    yeux.children.forEach((o) => { o.position.x = Math.sign(o.position.x) * 0.7 + vise; o.scale.y = (t % 4.7) < 0.12 ? 0.08 : 0.7; });
    lampe.intensity = 62 * (0.95 + 0.05 * Math.sin(t * 8.3));
  });

  return {
    /**
     * Pose des objets sous des éléments de la page. objets : [{ ancre: élément (l'icône du
     * bouton), bouton: élément survolé, fabrique: () => Object3D, taille, bas, angle,
     * choisi: () => bool, tourne }].
     */
    poser(objets) {
      for (const s of suivis) { scene.remove(s.objet); }
      suivis = objets.filter((o) => o.ancre).map((o) => {
        const objet = new THREE.Group();
        const corps = o.fabrique();
        objet.add(corps);
        const b = new THREE.Box3().setFromObject(corps);
        const t = b.getSize(new THREE.Vector3());
        const anneau = new THREE.Mesh(new THREE.TorusGeometry(Math.max(t.x, t.z) * 0.62, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0 }));
        anneau.rotation.x = -Math.PI / 2; anneau.position.y = 0.03;
        objet.add(anneau);
        scene.add(objet);
        const s = { o, objet, anneau, taille: Math.max(t.x, t.z, t.y * 0.8), leve: 0, ancre: o.ancre, fin: 0 };
        const b2 = o.bouton || o.ancre;
        b2.addEventListener('pointerenter', () => { survole = s; S.relancer(); });
        b2.addEventListener('focus', () => { survole = s; });
        b2.addEventListener('pointerleave', () => { if (survole === s) survole = null; });
        b2.addEventListener('blur', () => { if (survole === s) survole = null; });
        return s;
      });
      survole = null;
      S.dimensionner();
      placerDecor();
      S.relancer();
    },
    /** L'objet choisi s'envole (le Conteur le prend) : pour le départ à l'aventure. */
    envoler(predicat) { for (const s of suivis) if (predicat(s.o)) { s.fin = 0.0001; s.o.fin = true; } },
    lancer() { S.dimensionner(); placerDecor(); S.relancer(); },
  };
}
