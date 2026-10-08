document.addEventListener('DOMContentLoaded', () => {
  // Cargar nombre guardado en localStorage
  const playerName = localStorage.getItem('cyber_player_name') || 'YIYO';

  const displayElement = document.getElementById('player-display-name');
  const modalNameElement = document.getElementById('profile-modal-name');

  if (displayElement && !displayElement.dataset.accountManaged)
    displayElement.textContent = playerName.toUpperCase();
  if (modalNameElement) modalNameElement.textContent = playerName.toUpperCase();
});

// Redirección al juego con el modo seleccionado
const playBtn = document.getElementById('btn-play-game');
const modeSelect = document.getElementById('game-mode-select');

if (playBtn) {
  playBtn.addEventListener('click', () => {
    const selectedMode = modeSelect ? modeSelect.value : 'combat';
    localStorage.setItem('selected_game_mode', selectedMode);
    window.location.href = 'juego.html';
  });
}

// Renderizado del Personaje 3D en el Lobby
const container = document.getElementById('character-canvas-container');

if (container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030508);
  scene.fog = new THREE.FogExp2(0x030508, 0.02);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(1.1, 2.8, 9.5);
  camera.lookAt(0.35, 1.25, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.25 : 1.7));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const spotLight = new THREE.PointLight(0x198754, 4, 30);
  spotLight.position.set(2, 6, 4);
  scene.add(spotLight);
  const rimLight = new THREE.PointLight(0xc9ff38, 9, 12);
  rimLight.position.set(4, 3, -2);
  scene.add(rimLight);
  const fillLight = new THREE.PointLight(0x4aa8ff, 3, 14);
  fillLight.position.set(0, 2, 3);
  scene.add(fillLight);

  const platformGeo = new THREE.CylinderGeometry(3, 3.2, 0.4, 32);
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f19,
    metalness: 0.8,
    roughness: 0.2,
  });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.set(1.8, -0.2, 0);
  scene.add(platform);

  const grid = new THREE.GridHelper(30, 30, 0x198754, 0x1f2937);
  grid.position.y = 0.01;
  grid.position.x = 1.8;
  scene.add(grid);

  const characterGroup = new THREE.Group();

  const bodyGeo = new THREE.CylinderGeometry(0.7, 0.5, 1.8, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x198754, metalness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  characterGroup.add(body);

  const headGeo = new THREE.SphereGeometry(0.45, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.0;
  characterGroup.add(head);

  // Silueta low-poly tipo agente: cuerpo, hombreras, brazos, botas y visor.
  const limbMat = new THREE.MeshStandardMaterial({ color: 0x18221b, metalness: 0.65, roughness: 0.32 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xc9ff38, emissive: 0x263d08, metalness: 0.55 });
  const limb = (geo, mat, x, y, z, rx = 0, rz = 0) => {
    const part = new THREE.Mesh(geo, mat);
    part.position.set(x, y, z); part.rotation.x = rx; part.rotation.z = rz;
    characterGroup.add(part); return part;
  };
  limb(new THREE.CylinderGeometry(0.19, 0.16, 0.95, 8), limbMat, -0.31, -0.28, 0.03, 0, 0.025);
  limb(new THREE.CylinderGeometry(0.19, 0.16, 0.95, 8), limbMat, 0.31, -0.28, 0.03, 0, -0.025);
  limb(new THREE.BoxGeometry(0.36, 0.16, 0.54), accentMat, -0.31, -0.82, 0.14);
  limb(new THREE.BoxGeometry(0.36, 0.16, 0.54), accentMat, 0.31, -0.82, 0.14);
  limb(new THREE.CylinderGeometry(0.17, 0.14, 1.1, 8), limbMat, -0.81, 1.0, 0, 0, -0.13);
  limb(new THREE.CylinderGeometry(0.17, 0.14, 1.1, 8), limbMat, 0.81, 1.0, 0, 0, 0.13);
  limb(new THREE.SphereGeometry(0.25, 8, 6), bodyMat, -0.64, 1.72, 0);
  limb(new THREE.SphereGeometry(0.25, 8, 6), bodyMat, 0.64, 1.72, 0);
  limb(new THREE.BoxGeometry(0.56, 0.18, 0.14), accentMat, 0, 2.08, 0.39);
  limb(new THREE.BoxGeometry(0.4, 0.26, 0.34), limbMat, 0, 2.42, 0);
  characterGroup.position.set(1.8, 0.95, 0);
  scene.add(characterGroup);

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now() * 0.001;
    characterGroup.rotation.y = Math.sin(now * 0.35) * 0.12;
    characterGroup.position.y = 0.95 + Math.sin(now * 1.1) * 0.035;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    if (window.innerWidth < 620) {
      camera.position.set(1.5, 2.8, 12);
      camera.lookAt(1.05, 1.3, 0);
    } else {
      camera.position.set(1.1, 2.8, 9.5);
      camera.lookAt(0.35, 1.25, 0);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.25 : 1.7));
  });
}
