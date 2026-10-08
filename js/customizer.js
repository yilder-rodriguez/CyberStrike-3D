// --- LÓGICA DE APLICACIÓN DE SKINS Y ROPA EN MODELOS THREE.JS ---

function applyCharacterAppearance(playerGroup) {
  if (!playerGroup) return;

  // Limpiar cuerpo y accesorios anteriores
  while (playerGroup.children.length > 0) {
    playerGroup.remove(playerGroup.children[0]);
  }

  const skin = getActiveCharacterSkin();
  const weapon = getActiveWeaponSkin();

  // 1. CUERPO DE LA ROPA / ARMADURA
  const bodyGeo = new THREE.CylinderGeometry(0.8, 0.6, 1.5, 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: skin.colorBody,
    roughness: skin.roughness,
    metalness: skin.metalness,
    emissive: skin.emissiveColor,
    emissiveIntensity: 0.3,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.75;
  bodyMesh.castShadow = true;
  playerGroup.add(bodyMesh);

  // 2. CASCO Y VISERA TÁCTICA
  const headGeo = new THREE.SphereGeometry(0.5, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: skin.colorHead,
    roughness: 0.2,
    metalness: 0.9,
  });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.y = 1.6;
  headMesh.castShadow = true;
  playerGroup.add(headMesh);

  // Visera Neón
  const visorGeo = new THREE.BoxGeometry(0.6, 0.15, 0.3);
  const visorMat = new THREE.MeshBasicMaterial({ color: skin.colorBody });
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 1.65, 0.35);
  playerGroup.add(visorMesh);

  // 3. ACCESORIOS (Hombreras tácticas si la skin es especial)
  if (skin.hasShoulderPads) {
    const padGeo = new THREE.BoxGeometry(0.4, 0.3, 0.5);
    const padMat = new THREE.MeshStandardMaterial({ color: skin.colorHead, metalness: 0.9 });

    const padLeft = new THREE.Mesh(padGeo, padMat);
    padLeft.position.set(-0.95, 1.2, 0);
    playerGroup.add(padLeft);

    const padRight = new THREE.Mesh(padGeo, padMat);
    padRight.position.set(0.95, 1.2, 0);
    playerGroup.add(padRight);
  }

  // 4. MESH Y TIPO DE ARMA EQUIPADA
  const gunGroup = new THREE.Group();
  const gunBodyGeo = new THREE.BoxGeometry(0.3, 0.3, weapon.length);
  const gunBodyMat = new THREE.MeshStandardMaterial({ color: weapon.colorGun, metalness: 0.8 });
  const gunBody = new THREE.Mesh(gunBodyGeo, gunBodyMat);
  gunGroup.add(gunBody);

  // Detalle Neón del Cañón del Arma
  const laserTipGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
  const laserTipMat = new THREE.MeshBasicMaterial({ color: weapon.colorLaser });
  const laserTip = new THREE.Mesh(laserTipGeo, laserTipMat);
  laserTip.rotation.x = Math.PI / 2;
  laserTip.position.z = weapon.length / 2 + 0.1;
  gunGroup.add(laserTip);

  gunGroup.position.set(0.6, 1.1, 0.5);
  playerGroup.add(gunGroup);
}
