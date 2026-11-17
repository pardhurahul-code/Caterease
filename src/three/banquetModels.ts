import * as THREE from 'three';

export type MetalFinishType = 'gold' | 'copper' | 'silver';

export function getMetalParams(finish: MetalFinishType): { color: number; roughness: number; metalness: number } {
  if (finish === 'copper') {
    return { color: 0xc86d42, roughness: 0.28, metalness: 0.88 };
  }
  if (finish === 'silver') {
    return { color: 0xd6dbe0, roughness: 0.22, metalness: 0.92 };
  }
  return { color: 0xd9a441, roughness: 0.24, metalness: 0.9 };
}

function tagExplodable(obj: THREE.Object3D, offset: number) {
  obj.userData.baseY = obj.position.y;
  obj.userData.explodeOffset = offset;
}

export function applyExplodeOffset(root: THREE.Object3D, explodeAmount: number) {
  root.traverse((child) => {
    if (typeof child.userData.explodeOffset === 'number' && typeof child.userData.baseY === 'number') {
      child.position.y = child.userData.baseY + child.userData.explodeOffset * explodeAmount;
    }
  });
}

export function createBanquetTableGroup(opts: {
  clothMap: THREE.Texture;
  woodMap: THREE.Texture;
  shadowMap: THREE.Texture;
  metalMat: THREE.MeshStandardMaterial;
}): THREE.Group {
  const group = new THREE.Group();

  // Contact shadow disc
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({ map: opts.shadowMap, transparent: true, depthWrite: false, opacity: 0.85 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.008;
  group.add(shadowPlane);

  const clothMat = new THREE.MeshStandardMaterial({
    map: opts.clothMap,
    color: 0xfbf8f2,
    roughness: 0.78,
    metalness: 0.02,
  });

  // 1. Pleated tablecloth skirt via LatheGeometry
  const skirtPoints: THREE.Vector2[] = [
    new THREE.Vector2(1.42, 0.03),
    new THREE.Vector2(1.38, 0.22),
    new THREE.Vector2(1.32, 0.55),
    new THREE.Vector2(1.36, 0.74),
    new THREE.Vector2(0.05, 0.75),
  ];
  const skirtGeo = new THREE.LatheGeometry(skirtPoints, 48);
  const skirt = new THREE.Mesh(skirtGeo, clothMat);
  skirt.castShadow = true;
  skirt.receiveShadow = true;
  tagExplodable(skirt, 0.15);
  group.add(skirt);

  // 2. Walnut rimmed tabletop bezel
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.42, 1.44, 0.06, 48),
    new THREE.MeshStandardMaterial({ map: opts.woodMap, roughness: 0.45, metalness: 0.08 })
  );
  rim.position.y = 0.76;
  rim.castShadow = true;
  rim.receiveShadow = true;
  tagExplodable(rim, 0.55);
  group.add(rim);

  // 3. Brass perimeter trim band
  const trimRing = new THREE.Mesh(new THREE.TorusGeometry(1.43, 0.018, 12, 48), opts.metalMat);
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.76;
  tagExplodable(trimRing, 0.68);
  group.add(trimRing);

  // 4. Instanced Charger Plates & Goblets (6 place settings)
  const plateGroup = new THREE.Group();
  plateGroup.position.y = 0.805;
  tagExplodable(plateGroup, 1.05);

  const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1 });
  const plateGeo = new THREE.CylinderGeometry(0.19, 0.14, 0.022, 24);
  const plates = new THREE.InstancedMesh(plateGeo, plateMat, 6);
  plates.castShadow = true;

  const gobletPoints = [
    new THREE.Vector2(0.045, 0),
    new THREE.Vector2(0.01, 0.015),
    new THREE.Vector2(0.01, 0.09),
    new THREE.Vector2(0.055, 0.14),
    new THREE.Vector2(0.048, 0.2),
  ];
  const gobletGeo = new THREE.LatheGeometry(gobletPoints, 20);
  const goblets = new THREE.InstancedMesh(gobletGeo, opts.metalMat, 6);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05);
    dummy.rotation.set(0, -a, 0);
    dummy.updateMatrix();
    plates.setMatrixAt(i, dummy.matrix);

    const gAngle = a + 0.22;
    dummy.position.set(Math.cos(gAngle) * 0.88, 0.01, Math.sin(gAngle) * 0.88);
    dummy.updateMatrix();
    goblets.setMatrixAt(i, dummy.matrix);
  }
  plates.computeBoundingSphere();
  goblets.computeBoundingSphere();
  plateGroup.add(plates, goblets);
  group.add(plateGroup);

  // 5. Centerpiece Candelabra (6 parts)
  const candelabra = new THREE.Group();
  candelabra.position.y = 0.8;
  tagExplodable(candelabra, 1.45);

  const basePts = [
    new THREE.Vector2(0.22, 0),
    new THREE.Vector2(0.15, 0.05),
    new THREE.Vector2(0.04, 0.16),
    new THREE.Vector2(0.035, 0.42),
    new THREE.Vector2(0.09, 0.48),
  ];
  const stand = new THREE.Mesh(new THREE.LatheGeometry(basePts, 24), opts.metalMat);
  stand.castShadow = true;
  candelabra.add(stand);

  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffd27d,
    emissive: 0xff9f2e,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });

  for (let c = 0; c < 3; c++) {
    const ca = (c / 3) * Math.PI * 2;
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.34, 0),
      new THREE.Vector3(Math.cos(ca) * 0.14, 0.4, Math.sin(ca) * 0.14),
      new THREE.Vector3(Math.cos(ca) * 0.21, 0.5, Math.sin(ca) * 0.21),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 12, 0.014, 8, false), opts.metalMat);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), glowMat);
    orb.position.set(Math.cos(ca) * 0.21, 0.54, Math.sin(ca) * 0.21);
    candelabra.add(arm, orb);
  }
  group.add(candelabra);

  // 6. 6 Composite Curved-Back Banquet Chairs
  const chairBackShape = new THREE.Shape();
  chairBackShape.moveTo(-0.2, 0);
  chairBackShape.lineTo(0.2, 0);
  chairBackShape.quadraticCurveTo(0.22, 0.42, 0, 0.48);
  chairBackShape.quadraticCurveTo(-0.22, 0.42, -0.2, 0);

  const chairBackGeo = new THREE.ExtrudeGeometry(chairBackShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
  });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.65, metalness: 0.05 });

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const chair = new THREE.Group();
    chair.position.set(Math.cos(a) * 1.82, 0, Math.sin(a) * 1.82);
    chair.rotation.y = -a + Math.PI / 2;

    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 20), cushionMat);
    seat.position.y = 0.46;
    seat.castShadow = true;
    chair.add(seat);

    const frameRing = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.016, 8, 24), opts.metalMat);
    frameRing.rotation.x = Math.PI / 2;
    frameRing.position.y = 0.45;
    chair.add(frameRing);

    const back = new THREE.Mesh(chairBackGeo, cushionMat);
    back.position.set(0, 0.48, -0.2);
    back.castShadow = true;
    chair.add(back);

    const legGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.46, 8);
    const legOffsets = [
      [-0.15, -0.15],
      [0.15, -0.15],
      [-0.15, 0.15],
      [0.15, 0.15],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, opts.metalMat);
      leg.position.set(lx, 0.23, lz);
      leg.castShadow = true;
      chair.add(leg);
    }

    tagExplodable(chair, 0.35);
    group.add(chair);
  }

  return group;
}

export function createChafingStationGroup(opts: {
  woodMap: THREE.Texture;
  shadowMap: THREE.Texture;
  metalMat: THREE.MeshStandardMaterial;
}): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.1),
    new THREE.MeshBasicMaterial({ map: opts.shadowMap, transparent: true, depthWrite: false, opacity: 0.8 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  group.add(shadow);

  // Buffet Counter Plinth
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.84, 1.1),
    new THREE.MeshStandardMaterial({ map: opts.woodMap, roughness: 0.42, metalness: 0.08 })
  );
  counter.position.y = 0.42;
  counter.castShadow = true;
  counter.receiveShadow = true;
  tagExplodable(counter, 0.08);
  group.add(counter);

  // Granite / Stone Slab Top
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.06, 1.18),
    new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.18, metalness: 0.06 })
  );
  slab.position.y = 0.87;
  slab.castShadow = true;
  slab.receiveShadow = true;
  tagExplodable(slab, 0.35);
  group.add(slab);

  // Twin Chafing Vessels
  for (const offsetX of [-0.66, 0.66]) {
    const vessel = new THREE.Group();
    vessel.position.set(offsetX, 0.91, 0);

    // Wire Stand Legs + Burner Cups
    const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.62), opts.metalMat);
    baseFrame.position.y = 0.06;
    tagExplodable(baseFrame, 0.42);
    vessel.add(baseFrame);

    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffb74d,
      emissive: 0xff6d00,
      emissiveIntensity: 1.5,
      roughness: 0.3,
    });
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 16), flameMat);
    burner.position.y = 0.04;
    vessel.add(burner);

    // Water Bath & Food Pan
    const pan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.32, 0.14, 28),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.85 })
    );
    pan.position.y = 0.2;
    pan.castShadow = true;
    tagExplodable(pan, 0.8);
    vessel.add(pan);

    // Roll-top Dome Lid
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      opts.metalMat
    );
    lid.position.y = 0.27;
    lid.castShadow = true;
    tagExplodable(lid, 1.32);
    vessel.add(lid);

    // Brass Arch Handle
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 0.6, 0),
      new THREE.Vector3(0, 0.68, 0),
      new THREE.Vector3(0.12, 0.6, 0),
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 12, 0.015, 8, false), opts.metalMat);
    tagExplodable(handle, 1.65);
    vessel.add(handle);

    group.add(vessel);
  }

  return group;
}

export function createServiceCartGroup(metalMat: THREE.MeshStandardMaterial, woodMap: THREE.Texture): THREE.Group {
  const cart = new THREE.Group();

  // Chassis base
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.08, 1.24),
    new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.42, metalness: 0.1 })
  );
  chassis.position.y = 0.24;
  chassis.castShadow = true;
  cart.add(chassis);

  // Brass upper tray
  const topTray = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 1.18), metalMat);
  topTray.position.y = 0.68;
  topTray.castShadow = true;
  cart.add(topTray);

  // Corner struts (4)
  const strutGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.44, 10);
  for (const sx of [-0.36, 0.36]) {
    for (const sz of [-0.52, 0.52]) {
      const strut = new THREE.Mesh(strutGeo, metalMat);
      strut.position.set(sx, 0.46, sz);
      cart.add(strut);
    }
  }

  // Push handlebar
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.36, 0.7, -0.56),
    new THREE.Vector3(-0.36, 0.94, -0.68),
    new THREE.Vector3(0.36, 0.94, -0.68),
    new THREE.Vector3(0.36, 0.7, -0.56),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 16, 0.025, 8, false), metalMat);
  cart.add(handle);

  // 4 Caster Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.75 });
  const wheels: THREE.Mesh[] = [];
  for (const wx of [-0.42, 0.42]) {
    for (const wz of [-0.46, 0.46]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.11, wz);
      w.castShadow = true;
      wheels.push(w);
      cart.add(w);
    }
  }
  cart.userData.wheels = wheels;

  // Thermal Serving Dome (turns visible/tinted depending on carried dish)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.85, emissive: 0x000000 })
  );
  dome.position.set(0, 0.71, 0.06);
  dome.visible = false;
  cart.userData.carriedDome = dome;
  cart.add(dome);

  return cart;
}

export function createWaiterGroup(shadowMap: THREE.Texture): THREE.Group {
  const waiter = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, opacity: 0.7 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  waiter.add(shadow);

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.55 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 });
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 0.9 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.95, 16), suitMat);
  torso.position.y = 0.65;
  torso.castShadow = true;
  waiter.add(torso);

  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.55, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9), apronMat);
  apron.position.y = 0.45;
  waiter.add(apron);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.65 })
  );
  head.position.y = 1.32;
  head.castShadow = true;
  waiter.add(head);

  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.03, 20), trayMat);
  tray.position.set(0.22, 1.05, 0.26);
  tray.castShadow = true;
  waiter.add(tray);

  // Telegraph ring on floor
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.54, 24),
    new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  waiter.add(ring);

  return waiter;
}
