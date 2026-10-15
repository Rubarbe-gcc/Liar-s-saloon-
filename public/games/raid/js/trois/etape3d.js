/**
 * RAID — les étapes, en petites scènes sur la table du Conteur.
 *
 * Au-dessus des choix de chaque étape, une vignette : le groupe assis
 * autour d'un feu de bûches, l'échoppe du marchand, un coffre, trois cartes
 * posées face cachée, le butin étalé, les aventuriers qui attendent qu'on
 * les choisisse… Les boutons, eux, ne changent pas.
 */

import { THREE, creerScene, bois, alea } from './scene3d.js';
import { figurineHeros, pieceCarte } from './figurines3d.js';

/**
 * Crée la vignette dans `hote` (un élément positionné). Null sans WebGL.
 * @returns {{ montrer(type, donnees) } | null}
 */
export function creerVignette(hote) {
  const S = creerScene(hote, {
    table: { largeur: 40, profondeur: 30, y: 0, z: -4 },
    bougies: [[-4.4, 0.6, 1.2], [4.6, -0.6, 0.8]],
    conteur: { z: -11, y: -5.6, echelle: 1.15, mains: { ecart: 3.6, y: 0, z: -4.6 } },
    forceBougies: 16,
    expo: 1.45,
  });
  if (!S) return null;
  const { scene, camera } = S;
  camera.position.set(0, 3.3, 6.3);
  camera.lookAt(0, 1.0, -1.4);
  const lampe = new THREE.PointLight('#ffd8a0', 26, 14, 1.5);
  lampe.position.set(0, 4.5, 1.5);
  lampe.castShadow = S.qualite === 'haute';
  lampe.shadow.mapSize.set(1024, 1024); lampe.shadow.bias = -0.002;
  scene.add(lampe);

  let decor = null;
  let cle = '';
  let anime = null;

  /** Le groupe en figurines, en arc de cercle (ou autour d'un point). */
  function poserGroupe(g, groupe, { centre = new THREE.Vector3(0, 0, 0), rayon = 1.6, arc = Math.PI * 0.9, debut = Math.PI * 0.05, regard = true, echelle = 1 } = {}) {
    const figs = [];
    groupe.forEach((h, i) => {
      const f = figurineHeros(h);
      const a = groupe.length === 1 ? Math.PI / 2 : debut + (arc * i) / (groupe.length - 1);
      f.position.set(centre.x + Math.cos(a) * rayon, 0, centre.z + Math.sin(a) * rayon);
      if (regard) f.lookAt(centre.x, 0, centre.z);
      f.scale.setScalar(echelle);
      g.add(f);
      figs.push(f);
    });
    return figs;
  }

  const SCENES = {
    /** Le feu de camp : les bûches qui brûlent, le groupe assis autour. */
    repos(g, d) {
      const feu = pieceCarte('repos'); feu.scale.setScalar(3); g.add(feu);
      const flammes = []; feu.traverse((o) => { if (o.isMesh && o.material.emissiveIntensity > 1) flammes.push(o); });
      const l = new THREE.PointLight('#ff9a40', 18, 8, 1.6); l.position.set(0, 1.2, 0); g.add(l);
      const figs = poserGroupe(g, d.groupe, { rayon: 1.7, arc: Math.PI * 0.85, debut: Math.PI * 0.075 });
      for (const f of figs) f.userData.corps.rotation.x = 0.12;
      return (dt, t) => { l.intensity = 18 * (0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 7)); for (const f of flammes) f.scale.y = 3 * (0.85 + 0.15 * Math.sin(t * 11)); };
    },
    /** Le marchand : sa grande figurine encapuchonnée derrière son échoppe chargée. */
    marchand(g) {
      const etal = pieceCarte('marchand'); etal.scale.setScalar(4.2); etal.position.set(0, 0, -0.6); g.add(etal);
      const m = figurineHeros({ id: 'marchand', peuple: 'gnome', ecole: 'nature', role: 'soigneur', classe: 'Prêtre' });
      m.scale.setScalar(1.25); m.position.set(0, 0, -1.6); g.add(m);
      const R = alea(3);
      for (let i = 0; i < 6; i++) {
        const fiole = new THREE.Group();
        fiole.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), bois(['#c83a3a', '#3a8ad8', '#5ac84a'][i % 3], { lueur: 0.4 })));
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 6), bois('#e8dcc0')); col.position.y = 0.14; fiole.add(col);
        fiole.position.set(-0.9 + i * 0.36, 0.86, -0.25 + (R() - 0.5) * 0.2);
        g.add(fiole);
      }
      return (dt, t) => { m.userData.corps.rotation.z = Math.sin(t * 1.2) * 0.05; };
    },
    /** Le coffre, entrouvert : de l'or luit dedans. */
    tresor(g) {
      const c = pieceCarte('tresor'); c.scale.setScalar(4); g.add(c);
      const lueur = new THREE.PointLight('#ffd45e', 10, 4, 1.6); lueur.position.set(0, 1.2, 0.6); g.add(lueur);
      for (let i = 0; i < 12; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 8), bois('#ffd45e', { metal: 0.6 })); p.position.set((Math.random() - 0.5) * 1.6, 0.013 + (i % 3) * 0.025, 0.9 + Math.random() * 0.4); g.add(p); }
      return (dt, t) => { lueur.intensity = 10 * (0.8 + 0.2 * Math.sin(t * 3)); c.position.y = Math.max(0, Math.sin(t * 2.2)) * 0.04; };
    },
    /** L'inconnu : trois cartes posées face cachée, la bougie entre elles. */
    evenement(g) {
      const dos = new THREE.CanvasTexture((() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96; const x = cv.getContext('2d'); x.fillStyle = '#3a1810'; x.fillRect(0, 0, 64, 96); x.strokeStyle = '#c8a050'; x.lineWidth = 3; x.strokeRect(5, 5, 54, 86); x.beginPath(); x.arc(32, 48, 14, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(32, 26); x.lineTo(32, 70); x.moveTo(14, 48); x.lineTo(50, 48); x.stroke(); return cv; })());
      dos.colorSpace = THREE.SRGBColorSpace; dos.magFilter = THREE.NearestFilter;
      const cartes = [-1, 0, 1].map((k) => {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 1.35), [bois('#e8dcc0'), bois('#e8dcc0'), new THREE.MeshStandardMaterial({ map: dos, roughness: 0.8 }), bois('#e8dcc0'), bois('#e8dcc0'), bois('#e8dcc0')]);
        c.position.set(k * 1.2, 0.012, 0.2); c.rotation.y = k * 0.08; c.castShadow = true;
        g.add(c);
        return c;
      });
      return (dt, t) => { cartes.forEach((c, i) => { c.position.y = 0.012 + Math.max(0, Math.sin(t * 1.6 + i * 2.1)) * 0.08; }); };
    },
    /** Le butin : ce qu'on a gagné, étalé devant le groupe. */
    recompense(g, d) {
      SCENES.tresor(g, d);
      const figs = poserGroupe(g, d.groupe, { centre: new THREE.Vector3(0, 0, 0.4), rayon: 2.2, arc: Math.PI * 0.6, debut: Math.PI * 0.2 });
      return (dt, t) => { figs.forEach((f, i) => { f.userData.corps.position.y = 0.1 + Math.abs(Math.sin(t * 3 + i)) * 0.06; }); };
    },
    /** Les aventuriers qui attendent qu'on les choisisse, en rang. */
    compagnon(g, d) {
      const n = (d.offres || []).length;
      (d.offres || []).forEach((h, i) => {
        const f = figurineHeros(h);
        f.position.set((i - (n - 1) / 2) * 1.9, 0, 0.3);
        f.scale.setScalar(1.25);
        g.add(f);
      });
      return (dt, t) => { g.children.forEach((f, i) => { if (f.userData.corps) f.userData.corps.rotation.y = Math.sin(t * 0.8 + i) * 0.3; }); };
    },
    /** La défaite : les figurines tombées, le Conteur qui se penche. */
    defaite(g, d) {
      const figs = poserGroupe(g, d.groupe, { rayon: 1.2, regard: false });
      figs.forEach((f, i) => { f.rotation.set(-Math.PI / 2, 0, (i - 1) * 0.6); f.position.y = 0.3; });
      return null;
    },
    /** La victoire : tout le groupe, debout, sur un tas d'or. */
    victoire(g, d) {
      for (let i = 0; i < 40; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 8), bois('#ffd45e', { metal: 0.6 })); const a = Math.random() * Math.PI * 2, r = Math.random() * 1.4; p.position.set(Math.cos(a) * r, 0.013 + Math.random() * 0.1, Math.sin(a) * r * 0.6); g.add(p); }
      const figs = poserGroupe(g, d.groupe, { rayon: 0.9, regard: false });
      figs.forEach((f) => f.rotation.set(0, 0, 0));
      return (dt, t) => { figs.forEach((f, i) => { f.position.y = Math.abs(Math.sin(t * 4 + i)) * 0.2; }); };
    },
    /** Par défaut : le groupe, debout sur la table. */
    groupe(g, d) {
      const figs = poserGroupe(g, d.groupe, { rayon: 0.9, regard: false });
      figs.forEach((f, i) => { f.rotation.set(0, (i - (figs.length - 1) / 2) * 0.2, 0); f.position.x = (i - (figs.length - 1) / 2) * 1.3; f.position.z = 0; });
      return (dt, t) => { figs.forEach((f, i) => { f.userData.corps.position.y = 0.1 + Math.sin(t * 2 + i) * 0.015; }); };
    },
  };
  SCENES.resultat = SCENES.recompense;
  SCENES.don = SCENES.recompense;

  S.animer((dt, t) => { anime?.(dt, t); lampe.intensity = 26 * (0.96 + 0.04 * Math.sin(t * 9)); });

  return {
    /** Montre la scène d'une étape. donnees : { groupe: [héros], offres: [héros] }. */
    montrer(type, donnees) {
      const c = `${type}|${(donnees.groupe || []).map((h) => h.id).join(',')}|${(donnees.offres || []).map((h) => h.id).join(',')}`;
      S.dimensionner();
      if (c !== cle) {
        cle = c;
        if (decor) scene.remove(decor);
        decor = new THREE.Group();
        scene.add(decor);
        anime = (SCENES[type] || SCENES.groupe)(decor, donnees);
      }
      S.rendre();
      S.relancer();
    },
  };
}
