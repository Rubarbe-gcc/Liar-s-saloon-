/**
 * RAID — le combat sur la table du Conteur.
 *
 * Les héros sont posés de notre côté, les monstres en face ; derrière eux,
 * le Conteur (masqué, si c'est un maître de chapitre). Chaque unité de
 * l'écran de combat a sa figurine, posée pile sous sa carte : la carte garde
 * son nom, sa vie, ses effets ; la figurine joue ce qui se passe.
 *
 * Rien n'est décidé ici : on regarde seulement l'écran de combat (les cartes
 * `.unite` et leurs classes : frappe, touche, ko, actif, ciblable, enrage) et
 * on l'anime. Une figurine qui frappe glisse vers l'autre camp et bascule ;
 * touchée, elle tremble et lâche des copeaux ; vaincue, elle tombe — et la
 * main du Conteur vient retirer les monstres.
 */

import { THREE, creerScene, bois } from './scene3d.js';
import { figurineHeros, figurineMonstre } from './figurines3d.js';

/**
 * Crée la table de combat dans `hote` (l'arène, positionnée). Null sans WebGL.
 * @returns {{ relancer() } | null}
 */
export function creerTableCombat(hote) {
  const S = creerScene(hote, {
    table: { largeur: 60, profondeur: 50, y: 0, z: -6 },
    bougies: [[-7, 4, 1.4], [7.2, 2, 1]],
    conteur: { z: -15, y: -8.2, echelle: 1.6, mains: { ecart: 5.5, y: 0, z: -10 } },
    forceBougies: 34,
    expo: 1.45,
  });
  if (!S) return null;
  const { scene, camera } = S;
  // On est assis à la table : la caméra se règle sur la mise en page (voir cadrer).
  camera.position.set(0, 6.8, 11.5);
  camera.lookAt(0, 0.6, -3.5);
  // Un tapis de feutre sombre, sous les figurines ; une lampe au-dessus.
  const tapis = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 13), new THREE.MeshStandardMaterial({ color: '#1e2a22', roughness: 1 }));
  tapis.position.set(0, 0.03, -2.5); tapis.receiveShadow = true;
  scene.add(tapis);
  const lampe = new THREE.PointLight('#ffd8a0', 75, 26, 1.5);
  lampe.position.set(0, 7, -2.5);
  const appoint = new THREE.PointLight('#c8a0ff', 18, 16, 1.6);
  appoint.position.set(0, 4, -9);
  scene.add(appoint);
  lampe.castShadow = S.qualite === 'haute';
  lampe.shadow.mapSize.set(1024, 1024); lampe.shadow.bias = -0.002;
  const rouge = new THREE.PointLight('#ff3a2a', 0, 6, 1.6);
  scene.add(lampe, rouge);

  /** Les figurines, par unité (« h0 », « e2 »…). */
  const pieces = new Map();
  let cleCombat = '';

  /** Les copeaux de bois qui volent quand on frappe. */
  const copeaux = [];
  const geoCopeau = new THREE.BoxGeometry(0.06, 0.02, 0.1);
  function eclater(p, couleur) {
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Mesh(geoCopeau, bois(i % 3 ? '#c89a6a' : couleur));
      c.position.copy(p);
      c.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 3), vie: 0.9, rot: Math.random() * 10 };
      scene.add(c);
      copeaux.push(c);
    }
  }

  /** Une figurine pour une carte de l'écran. */
  function creerPiece(el) {
    const d = el.dataset;
    const ennemi = d.u[0] === 'e';
    const f = ennemi
      ? figurineMonstre({ modeleId: d.modele, silhouette: d.silhouette, rang: d.rang, ecole: d.ecole })
      : figurineHeros({ id: d.id, peuple: d.peuple, role: d.role, classe: d.classe, ecole: d.ecole });
    // Les monstres nous font face ; nos héros leur font face, de trois quarts.
    f.rotation.y = ennemi ? 0 : Math.PI - 0.55;
    // L'anneau sous le socle : qui joue, qui on peut viser.
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(f.userData.rayon * 1.25, 0.04, 6, 28), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0 }));
    anneau.rotation.x = -Math.PI / 2; anneau.position.y = 0.04;
    f.add(anneau);
    scene.add(f);
    return { f, el, ennemi, anneau, base: new THREE.Vector3(), echelle: 1, classes: new Set(), frappe: 1, touche: 1, chute: 0, retire: false, partie: false, rang: d.rang };
  }

  /**
   * La caméra se règle sur la mise en page : la rangée des héros tombe sur la table à z = 3,
   * celle des monstres à z = -5 ; le Conteur se place derrière eux, les yeux en haut de l'image.
   */
  const FOV = 40 * (Math.PI / 180);
  function cadrer() {
    const h = hote.getBoundingClientRect();
    if (!h.height) return;
    const bas = (sel) => { const e = [...hote.querySelectorAll(sel)].map((x) => (x.querySelector('.pied, .cadre-portrait') || x).getBoundingClientRect()); return e.length ? e.reduce((a, r) => a + (r.top + r.height * 0.97 - h.top), 0) / e.length : null; };
    // La toile déborde un peu de l'arène (voir le CSS) : on compte en fraction de la toile.
    const toile = S.toile.getBoundingClientRect();
    const fr = (y) => (y + h.top - toile.top) / toile.height;
    const ye = bas('.ennemis .unite'), yh = bas('.heros .unite');
    if (ye === null || yh === null) return;
    const fe = fr(ye), fh = fr(yh);
    const t2 = Math.tan(FOV / 2);
    let mieux = null;
    for (let H = 3; H <= 14; H += 0.25) for (let Z = 6; Z <= 26; Z += 0.5) {
      const angle = (zz) => Math.atan(H / (Z - zz));
      const pitch = angle(3) - Math.atan((fh - 0.5) * 2 * t2);
      const f = (zz) => 0.5 + 0.5 * Math.tan(angle(zz) - pitch) / t2;
      const err = (f(-5) - fe) ** 2;
      if (!mieux || err < mieux.err) mieux = { err, H, Z, pitch };
    }
    const { H, Z, pitch } = mieux;
    camera.position.set(0, H, Z);
    camera.rotation.set(-pitch, 0, 0);
    camera.updateMatrixWorld();
    // Le Conteur, à z = -14 : ses yeux un peu sous le haut de l'image.
    const zC = -14;
    const visee = pitch - Math.atan((0.5 - 0.09) * 2 * t2);
    const yYeux = H - (Z - (zC + 1.95 * 1.6)) * Math.tan(visee);
    S.conteur?.deplacer(Math.max(-12, yYeux - 8 * 1.6), zC, { ecart: 5.5, y: 0, z: -9.5 });
  }

  /** Où poser la figurine : sous la carte (au bas de son image), et à quelle taille. */
  function placer(p) {
    const boite = p.el.querySelector('.pied, .cadre-portrait') || p.el;
    const r = boite.getBoundingClientRect();
    const h = hote.getBoundingClientRect();
    if (!r.width || !h.width) return;
    const bx = r.left - h.left + r.width / 2, by = r.top - h.top + r.height * 0.97;
    p.base.copy(S.versTable(bx, by, 0));
    // La taille : la figurine doit à peu près remplir l'image de la carte.
    const haut = S.versEcran(p.base.clone().add(new THREE.Vector3(0, p.f.userData.hauteur, 0)));
    const bas = S.versEcran(p.base);
    const hPix = Math.max(1, bas.y - haut.y);
    p.echelle = Math.min(2.2, Math.max(0.35, (r.height * 0.95) / hPix));
  }

  /** Relit l'écran : les cartes présentes, leurs classes ; crée ou retire les figurines. */
  function relire() {
    const els = [...hote.querySelectorAll('.unite[data-u]')];
    const cle = els.map((e) => `${e.dataset.u}:${e.dataset.modele || e.dataset.id}`).join('|');
    if (cle !== cleCombat) {
      for (const p of pieces.values()) scene.remove(p.f);
      pieces.clear();
      cleCombat = cle;
      for (const el of els) pieces.set(el.dataset.u, creerPiece(el));
      // Un maître de chapitre : le Conteur met son masque.
      const boss = els.find((e) => e.dataset.rang === 'boss');
      S.conteur?.masque(boss ? boss.dataset.modele : null);
      cadrer();
      for (const p of pieces.values()) { placer(p); p.f.position.copy(p.base); p.f.scale.setScalar(p.echelle); }
    }
    for (const el of els) { const p = pieces.get(el.dataset.u); if (p) p.el = el; }
  }

  let dernierePlace = 0;
  S.animer((dt, t) => {
    relire();
    // On replace de temps en temps (la mise en page bouge : barres, effets, rotation de l'écran…).
    if (t - dernierePlace > 0.5) { dernierePlace = t; cadrer(); for (const p of pieces.values()) placer(p); }
    let enrage = false;
    for (const p of pieces.values()) {
      const cl = p.el.classList;
      const ko = cl.contains('ko');
      // Les débuts d'animation : une classe qui vient d'apparaître.
      if (cl.contains('frappe') && !p.classes.has('frappe')) p.frappe = 0;
      if (cl.contains('touche') && !p.classes.has('touche')) { p.touche = 0; eclater(p.f.position.clone().add(new THREE.Vector3(0, p.f.userData.hauteur * p.echelle * 0.6, 0)), p.ennemi ? '#8a3a2a' : '#4a6a9a'); }
      if (ko && !p.classes.has('ko')) { p.chute = 0.0001; p.retire = false; }
      if (!ko && p.classes.has('ko')) { p.chute = 0; p.retire = false; p.partie = false; p.f.visible = true; }
      p.classes = new Set(cl);
      if (cl.contains('enrage') && !ko) enrage = true;

      // La frappe : un élan vers l'autre camp, une bascule vers l'avant, le retour.
      p.frappe = Math.min(1, p.frappe + dt / 0.42);
      const elan = Math.sin(p.frappe * Math.PI);
      const sens = p.ennemi ? 1 : -1;
      // Touchée : elle tremble, recule un peu.
      p.touche = Math.min(1, p.touche + dt / 0.35);
      const tremble = p.touche < 1 ? Math.sin(p.touche * 40) * 0.08 * (1 - p.touche) : 0;
      const pos = p.base.clone();
      pos.z += sens * elan * 0.9;
      pos.x += tremble;
      if (!p.partie) p.f.position.lerp(pos, Math.min(1, dt * 18));
      p.f.scale.setScalar(p.echelle);
      const corps = p.f.userData.corps;
      corps.rotation.x = sens * elan * 0.45 + (p.touche < 1 ? -sens * 0.25 * (1 - p.touche) : 0);
      // Au repos, elle respire.
      corps.position.y = 0.1 + Math.sin(t * 2 + p.base.x) * 0.012;
      // Vaincue : elle bascule en arrière, puis la main du Conteur retire les monstres.
      if (p.chute > 0) {
        p.chute = Math.min(1, p.chute + dt / 0.45);
        p.f.rotation.x = -sens * (Math.PI / 2) * (p.chute * p.chute);
        if (p.chute >= 1 && p.ennemi && !p.retire && S.conteur) {
          p.retire = true;
          S.conteur.geste(p.base.x >= 0 ? 1 : -1, p.f.position.clone(), () => { p.partie = true; });
        }
      } else p.f.rotation.x = 0;
      if (p.partie) { p.f.position.y += dt * 6; if (p.f.position.y > 6) p.f.visible = false; }
      // L'anneau : doré pour qui joue, clair pour une cible possible.
      const actif = cl.contains('actif'), cible = cl.contains('ciblable');
      p.anneau.material.opacity = ko ? 0 : actif ? 0.9 : cible ? 0.45 + 0.4 * Math.sin(t * 6) : 0;
      p.anneau.material.color.set(actif ? '#ffd27a' : '#ffe9a8');
    }
    // Un monstre enragé : une lueur rouge qui bat sur la table.
    rouge.intensity = enrage ? 10 + 6 * Math.sin(t * 7) : 0;
    rouge.position.set(0, 2, -5);
    // Les copeaux retombent.
    for (let i = copeaux.length - 1; i >= 0; i--) {
      const c = copeaux[i];
      c.userData.vie -= dt;
      c.userData.v.y -= 9 * dt;
      c.position.addScaledVector(c.userData.v, dt);
      if (c.position.y < 0.03) { c.position.y = 0.03; c.userData.v.set(0, 0, 0); }
      c.rotation.set(c.userData.rot * c.userData.vie, c.userData.rot, 0);
      if (c.userData.vie <= 0) { scene.remove(c); copeaux.splice(i, 1); }
    }
    lampe.intensity = 75 * (0.96 + 0.04 * Math.sin(t * 8));
  });

  S.surDimension(() => { cadrer(); for (const p of pieces.values()) placer(p); });
  return {
    /** À l'ouverture de l'écran de combat : on relit les cartes, on relance l'animation. */
    relancer() { S.dimensionner(); relire(); cadrer(); for (const p of pieces.values()) placer(p); S.relancer(); },
  };
}
