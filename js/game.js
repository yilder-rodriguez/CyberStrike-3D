// Motor de combate construido sobre el prototipo Three.js existente; Parkour se delega al módulo de modo.
const container = document.getElementById('canvas-container'),
  params = new URLSearchParams(location.search),
  gameMode = params.get('mode') === 'parkour' ? 'parkour' : 'combat';
let allMaps = window.CYBER_MAPS || [],
  modeMaps = allMaps.filter((m) => m.mode === gameMode),
  currentMap = modeMaps.find((m) => m.id === params.get('map')) || modeMaps[0] || allMaps[0],
  tier = { speed: 0.05, health: 1, damage: 5, shotEvery: 100, spread: 0.4, reaction: 45 };
const scene = new THREE.Scene();
scene.background = new THREE.Color(currentMap.sky);
scene.fog = new THREE.FogExp2(currentMap.sky, currentMap.fog);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 25, 18);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
window.CYBER_RENDERER = renderer;
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xaebeb2, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(10, 30, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const neon = new THREE.PointLight(currentMap.neon, 3, 48);
neon.position.set(0, 5, 0);
scene.add(neon);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(gameMode === 'parkour' ? 76 : 100, gameMode === 'parkour' ? 350 : 100),
  new THREE.MeshStandardMaterial({ color: currentMap.floor, roughness: 0.45, metalness: 0.65 }),
);
floor.rotation.x = -Math.PI / 2;
if (gameMode === 'parkour') {
  // El suelo profundo deja visibles los huecos entre plataformas como caídas reales.
  floor.position.set(0, -8, -104);
}
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(gameMode === 'parkour' ? 320 : 100, gameMode === 'parkour' ? 64 : 50, currentMap.neon, 0x26342d);
grid.position.y = 0.02;
grid.visible = gameMode !== 'parkour';
scene.add(grid);
const player = new THREE.Group();
const torso = new THREE.Mesh(
  new THREE.CylinderGeometry(0.75, 0.55, 1.45, 8),
  new THREE.MeshStandardMaterial({
    color: 0x198754,
    metalness: 0.6,
    roughness: 0.3,
    emissive: 0x0b3b25,
  }),
);
torso.position.y = 0.75;
torso.castShadow = true;
player.add(torso);
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.44, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 }),
);
head.position.y = 1.65;
player.add(head);
const visor = new THREE.Mesh(
  new THREE.BoxGeometry(0.55, 0.14, 0.18),
  new THREE.MeshBasicMaterial({ color: currentMap.neon }),
);
visor.position.set(0, 1.7, 0.4);
player.add(visor);
const gun = new THREE.Mesh(
  new THREE.BoxGeometry(0.25, 0.25, 1.15),
  new THREE.MeshStandardMaterial({ color: 0x343e38, metalness: 0.85 }),
);
gun.position.set(0.55, 1.08, 0.5);
player.add(gun);
scene.add(player);
let running = false,
  paused = false,
  score = 0,
  wave = 1,
  health = 100,
  playerName = 'JUGADOR',
  keys = { w: false, a: false, s: false, d: false, run: false },
  mouse = new THREE.Vector2(),
  mouseDown = false,
  raycaster = new THREE.Raycaster(),
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  bullets = [],
  hostileShots = [],
  enemies = [],
  particles = [],
  covers = [],
  mapObjects = [],
  parkourStart = 0,
  frame = 0,
  spawnLeft = 6,
  spawnTimer = 0,
  fireCooldown = 0,
  parkourCleanup = null,
  finished = false,
  liveMatch = null,
  livePlayers = new Map(),
  netFrame = 0;
const el = (id) => document.getElementById(id),
  startScreen = el('start-screen'),
  endScreen = el('game-over-screen'),
  pauseScreen = el('pause-screen'),
  confirmScreen = el('confirm-quit-screen'),
  hud = el('game-hud'),
  startBtn = el('start-btn'),
  endTitle = el('end-title');
function buildArena() {
  mapObjects.forEach((o) => scene.remove(o));
  mapObjects = [];
  covers = [];
  const seed = currentMap.mode === 'combat' ? 7 : 0;
  for (let i = 0; i < seed; i++) {
    let angle = (i / seed) * Math.PI * 2,
      r = 12 + (i % 2) * 7,
      x = Math.cos(angle) * r,
      z = Math.sin(angle) * r;
    if (currentMap.id === 'terminal-2088') {
      x = (i % 2 ? 1 : -1) * (7 + Math.floor(i / 2) * 4);
      z = -17 + (i % 4) * 11;
    }
    let w = 2 + (i % 3),
      h = 1 + (i % 2) * 0.4;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 1.6),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? 0x26332c : 0x18241e,
        metalness: 0.65,
        roughness: 0.45,
        emissive: currentMap.neon,
        emissiveIntensity: 0.04,
      }),
    );
    block.position.set(x, h / 2, z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
    mapObjects.push(block);
    covers.push({ mesh: block, x, z });
  }
  for (let i = 0; i < (gameMode === 'combat' ? 12 : 0); i++) {
    let a = (i / 12) * Math.PI * 2,
      r = 43,
      h = 4 + (i % 4) * 1.7,
      w = 3 + (i % 3);
    let b = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 3),
      new THREE.MeshStandardMaterial({ color: 0x101a16, metalness: 0.5, roughness: 0.6 }),
    );
    b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    b.castShadow = true;
    scene.add(b);
    mapObjects.push(b);
    let stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, 0.08, 3.05),
      new THREE.MeshBasicMaterial({ color: currentMap.neon }),
    );
    stripe.position.set(b.position.x, h * 0.7, b.position.z);
    scene.add(stripe);
    mapObjects.push(stripe);
  }
}
buildArena();
const mapName = el('game-map-name'),
  select = el('map-select'),
  modeTitle = el('mode-title'),
  modeCaption = el('mode-caption');
modeTitle.textContent = gameMode === 'combat' ? 'COMBATE' : 'PARKOUR';
modeCaption.textContent =
  gameMode === 'combat'
    ? 'Resiste la vuelta. Los drones no dan papaya.'
    : 'Salta, esquiva y cruza los techos antes que se acabe el tiempo.';
el('control-hint').textContent =
  gameMode === 'combat'
    ? 'WASD para moverte · Mouse o botón FUEGO para disparar · Esc para pausar'
    : 'WASD para correr · Espacio o SALTAR para brincar · Llega al aro neón';
modeMaps.forEach((m) => {
  let o = document.createElement('option');
  o.value = m.id;
  o.textContent = m.name;
  select.append(o);
});
if (currentMap) select.value = currentMap.id;
function chooseMap() {
  currentMap = modeMaps.find((m) => m.id === select.value) || modeMaps[0];
  mapName.textContent = currentMap.name.toUpperCase() + ' / ' + currentMap.theme.toUpperCase();
  scene.background.setHex(currentMap.sky);
  scene.fog.color.setHex(currentMap.sky);
  scene.fog.density = currentMap.fog;
  floor.material.color.setHex(currentMap.floor);
  neon.color.setHex(currentMap.neon);
  grid.visible = true;
  buildArena();
}
select.addEventListener('change', chooseMap);
chooseMap();
window.CYBER_SET_MAPS = (maps) => {
  const safeMaps = Array.isArray(maps)
    ? maps.filter((map) => map && ['combat', 'parkour'].includes(map.mode))
    : [];
  const available = safeMaps.filter((map) => map.mode === gameMode);
  if (!available.length) return;
  allMaps = safeMaps;
  modeMaps = available;
  const preferred = modeMaps.find((map) => map.id === params.get('map')) || modeMaps[0];
  select.replaceChildren(
    ...modeMaps.map((map) => {
      const option = document.createElement('option');
      option.value = map.id;
      option.textContent = map.name;
      return option;
    }),
  );
  select.value = preferred.id;
  chooseMap();
};
function rankTier() {
  let pts = Number(window.CYBER_RANK_POINTS || 0),
    tiers = window.CYBER_BOT_TIERS || [];
  return [...tiers].reverse().find((t) => pts >= t.min) || tiers[0] || tier;
}
function updateHUD() {
  el('score-val').textContent = score;
  el('wave-val').textContent = wave;
  el('health-value').textContent = Math.max(0, Math.round(health));
  el('health-bar').style.width = Math.max(0, health) + '%';
}
function clearActors() {
  for (const list of [bullets, hostileShots, enemies, particles])
    list.forEach((x) => scene.remove(x.mesh));
  bullets = [];
  hostileShots = [];
  enemies = [];
  particles = [];
}
async function startGame() {
  if (!window.CYBER_GAME_READY) return;
  currentMap = modeMaps.find((m) => m.id === select.value) || currentMap;
  chooseMap();
  clearActors();
  if (parkourCleanup) {
    parkourCleanup();
    parkourCleanup = null;
  }
  score = 0;
  wave = 1;
  window.CYBER_PARKOUR_TIME = 0;
  health = 100;
  paused = false;
  finished = false;
  playerName = window.CYBER_PLAYER_NAME || 'JUGADOR';
  const skinColor =
    { skin_emerald: 0x55d95b, skin_crimson: 0xdc6258, skin_gold: 0xffc857, skin_plasma: 0x48def2 }[
      window.CYBER_EQUIPPED_SKIN
    ] || 0x55d95b;
  const weaponColor =
    { gun_green: 0x9ae72e, gun_red: 0xfb7658, gun_blue: 0x4bd8f0 }[window.CYBER_EQUIPPED_WEAPON] ||
    0x9ae72e;
  torso.material.color.setHex(skinColor);
  torso.material.emissive.setHex(skinColor).multiplyScalar(0.16);
  visor.material.color.setHex(skinColor);
  gun.material.color.setHex(weaponColor);
  tier = rankTier();
  if (liveMatch) {
    await liveMatch.close();
    liveMatch = null;
  }
  livePlayers.forEach((r) => scene.remove(r.group));
  livePlayers.clear();
  const status = el('network-status'),
    hudStatus = el('network-hud');
  const matchType = el('match-type').value;
  startScreen.classList.remove('d-none');
  endScreen.classList.add('d-none');
  if (matchType === 'online') {
    if (!window.CYBER_ONLINE_READY) {
      if (status) status.textContent = 'ONLINE NO CONFIGURADO · ELIGE BOTS';
      return;
    }
    startBtn.disabled = true;
    startBtn.querySelector('span').textContent = '…';
    if (status) status.textContent = 'CONECTANDO A LA SALA ONLINE…';
    if (hudStatus) hudStatus.textContent = 'CONECTANDO…';
    try {
      liveMatch = await window.CYBER_MATCHING.join(gameMode, currentMap.id, syncLivePlayers);
      if (status) status.textContent = 'ONLINE · JUGADORES Y BOTS DE REFUERZO';
      if (hudStatus) hudStatus.textContent = 'ONLINE';
    } catch (error) {
      if (status) status.textContent = error.message || 'NO SE PUDO CONECTAR · INTENTA O ELIGE BOTS';
      if (hudStatus) hudStatus.textContent = 'SIN CONEXIÓN';
      startBtn.disabled = false;
      startBtn.innerHTML = 'INTENTAR DE NUEVO <span>↗</span>';
      return;
    }
    startBtn.disabled = false;
    startBtn.innerHTML = 'EMPEZAR LA VUELTA <span>↗</span>';
  } else {
    if (status) status.textContent = 'MODO LOCAL · BOTS ACTIVOS';
    if (hudStatus) hudStatus.textContent = 'BOTS ACTIVOS';
  }
  player.position.set(0, 0, gameMode === 'parkour' ? 24 : 0);
  camera.position.set(0, 25, 18);
  player.rotation.y = 0;
  el('player-hud-name').textContent = playerName.toUpperCase();
  updateHUD();
  if (gameMode === 'parkour') {
    parkourStart = performance.now();
    parkourCleanup = CyberParkour.build(scene, currentMap);
    CyberParkour.reset(player, currentMap);
    el('wave-val').textContent = '—';
  } else {
    spawnLeft = Math.max(0, 6 - livePlayers.size - 1);
    frame = 0;
    spawnTimer = 0;
  }
  startScreen.classList.add('d-none');
  endScreen.classList.add('d-none');
  pauseScreen.classList.add('d-none');
  confirmScreen.classList.add('d-none');
  hud.classList.remove('d-none');
  running = true;
}
function showEnd(title, copy, record = '—', won = title === '¡META!' || title === 'VICTORIA') {
  if (finished) return;
  finished = true;
  running = false;
  hud.classList.add('d-none');
  endTitle.textContent = title;
  el('end-copy').textContent = copy;
  el('final-score').textContent = score;
  el('final-wave').textContent = wave;
  el('final-record').textContent = record;
  el('final-rank-change').textContent = 'CALCULANDO…';
  endScreen.classList.remove('d-none');
  window
    .CYBER_HANDLE_RESULT?.({
      mode: gameMode,
      score: gameMode === 'combat' ? score : 0,
      wave,
      won,
      seconds: window.CYBER_PARKOUR_TIME || 0,
    })
    ?.catch((error) => {
      el('end-copy').textContent += ` · No se pudo guardar el progreso: ${error.message}`;
    });
}
function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseScreen.classList.toggle('d-none', !paused);
  if (paused) pauseScreen.classList.remove('d-flex');
}
el('start-btn').addEventListener('click', startGame);
el('restart-btn').addEventListener('click', startGame);
el('pause-btn').addEventListener('click', togglePause);
el('resume-btn').addEventListener('click', togglePause);
el('quit-trigger-btn').onclick = () => {
  pauseScreen.classList.add('d-none');
  el('quit-penalty').textContent = Math.min(30, Number(window.CYBER_RANK_POINTS || 0));
  confirmScreen.classList.remove('d-none');
};
el('confirm-no-btn').onclick = () => {
  confirmScreen.classList.add('d-none');
  pauseScreen.classList.remove('d-none');
};
el('confirm-yes-btn').onclick = async () => {
  running = false;
  await window.CYBER_HANDLE_QUIT?.();
  location.href = './menu.html';
};
window.addEventListener('keydown', (e) => {
  let k = e.key.toLowerCase();
  if ((k === 'escape' || k === 'p') && running) {
    togglePause();
    return;
  }
  if (!running || paused) return;
  if (k === 'w' || k === 'arrowup') keys.w = true;
  if (k === 'a' || k === 'arrowleft') keys.a = true;
  if (k === 's' || k === 'arrowdown') keys.s = true;
  if (k === 'd' || k === 'arrowright') keys.d = true;
  if (k === 'shift' && gameMode === 'parkour') keys.run = true;
  if (k === ' ' && gameMode === 'parkour') {
    e.preventDefault();
    CyberParkour.jump();
  }
});
window.addEventListener('keyup', (e) => {
  let k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.w = false;
  if (k === 'a' || k === 'arrowleft') keys.a = false;
  if (k === 's' || k === 'arrowdown') keys.s = false;
  if (k === 'd' || k === 'arrowright') keys.d = false;
  if (k === 'shift') keys.run = false;
});
window.addEventListener('mousemove', (e) => {
  let s = Number(window.CYBER_SENSITIVITY || 1);
  mouse.set(((e.clientX / innerWidth) * 2 - 1) * s, -((e.clientY / innerHeight) * 2 - 1) * s);
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseDown = true;
});
window.addEventListener('mouseup', () => (mouseDown = false));
window.addEventListener('blur', () => {
  mouseDown = false;
  keys = { w: false, a: false, s: false, d: false, run: false };
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});
function spawnEnemy() {
  if (enemies.length >= 8 || spawnLeft <= 0) return;
  let a = Math.random() * Math.PI * 2,
    r = 27,
    pos = new THREE.Vector3(Math.cos(a) * r, 0.8, Math.sin(a) * r),
    fast = Math.random() < 0.28,
    mesh = new THREE.Mesh(
      fast ? new THREE.ConeGeometry(0.8, 1.8, 6) : new THREE.BoxGeometry(1.3, 1.4, 1.2),
      new THREE.MeshStandardMaterial({
        color: fast ? 0xffc857 : 0xf05c4d,
        metalness: 0.65,
        roughness: 0.3,
        emissive: fast ? 0x523500 : 0x4c1511,
      }),
    );
  mesh.position.copy(pos);
  mesh.castShadow = true;
  scene.add(mesh);
  enemies.push({
    mesh,
    health: tier.health + (fast ? 0 : 0),
    maxHealth: tier.health,
    color: fast ? 0xffc857 : 0xf05c4d,
    speed: tier.speed * (fast ? 1.35 : 1),
    reaction: tier.reaction,
    fire: Math.floor(Math.random() * tier.shotEvery),
    phase: Math.random() * 6,
    cover: null,
  });
  spawnLeft--;
}
function shoot(origin, direction, hostile = false) {
  let m = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 8, 8),
    new THREE.MeshBasicMaterial({ color: hostile ? 0xff745c : currentMap.neon }),
  );
  m.position.copy(origin);
  scene.add(m);
  (hostile ? hostileShots : bullets).push({
    mesh: m,
    dir: direction.clone().normalize(),
    speed: hostile ? 0.48 : 0.8,
    distance: 0,
    damage: hostile ? tier.damage : 0,
  });
}
function burst(x, y, z, color) {
  for (let i = 0; i < (window.CYBER_REDUCED_EFFECTS ? 4 : 8); i++) {
    let m = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    m.position.set(x, y, z);
    scene.add(m);
    particles.push({
      mesh: m,
      v: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.7,
        Math.random() - 0.5,
      ).multiplyScalar(0.25),
      life: 25,
    });
  }
}
function moveCombat() {
  let speed = 0.22,
    dx = (keys.d ? speed : 0) - (keys.a ? speed : 0),
    dz = (keys.s ? speed : 0) - (keys.w ? speed : 0);
  if (dx && dz) {
    dx *= 0.707;
    dz *= 0.707;
  }
  let bound = currentMap.bounds;
  player.position.x = THREE.MathUtils.clamp(player.position.x + dx, -bound, bound);
  player.position.z = THREE.MathUtils.clamp(player.position.z + dz, -bound, bound);
  camera.position.x += (player.position.x - camera.position.x) * 0.1;
  camera.position.z += (player.position.z + 18 - camera.position.z) * 0.1;
  raycaster.setFromCamera(mouse, camera);
  let target = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, target))
    player.rotation.y = Math.atan2(target.x - player.position.x, target.z - player.position.z);
  if (mouseDown && fireCooldown <= 0) {
    shoot(
      new THREE.Vector3(player.position.x, 1.1, player.position.z),
      new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y)),
    );
    if (liveMatch)
      liveMatch.fire({ x: player.position.x, z: player.position.z, rotation: player.rotation.y });
    fireCooldown = 12;
  }
  fireCooldown = Math.max(0, fireCooldown - 1);
  if (++spawnTimer > 45 && spawnLeft > 0) {
    spawnEnemy();
    spawnTimer = 0;
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed);
    b.distance += b.speed;
    if (b.distance > 45) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }
    let hit = enemies.findIndex((e) => b.mesh.position.distanceTo(e.mesh.position) < 1.2);
    if (hit >= 0) {
      let e = enemies[hit];
      e.health--;
      burst(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, e.color);
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      if (e.health <= 0) {
        scene.remove(e.mesh);
        enemies.splice(hit, 1);
        score += 10;
        updateHUD();
        if (score >= 100) {
          showEnd('VICTORIA', 'Dominaste la ronda y sacaste diez drones.', 'RONDA COMPLETADA', true);
          return;
        }
        if (spawnLeft === 0 && enemies.length === 0) {
          wave++;
          spawnLeft = wave * Math.max(0, 5 - livePlayers.size);
          spawnTimer = 0;
        }
      }
    }
  }
  for (const e of enemies) {
    let ex = player.position.x - e.mesh.position.x,
      ez = player.position.z - e.mesh.position.z,
      dist = Math.hypot(ex, ez) || 1;
    e.phase += 0.035;
    e.reaction--;
    if (e.health < e.maxHealth && covers.length && Math.random() < 0.002)
      e.cover = covers.reduce(
        (a, b) =>
          Math.hypot(b.x - e.mesh.position.x, b.z - e.mesh.position.z) <
          Math.hypot(a.x - e.mesh.position.x, a.z - e.mesh.position.z)
            ? b
            : a,
        covers[0],
      );
    let gx = e.cover && e.health < e.maxHealth ? e.cover.x : player.position.x,
      gz = e.cover && e.health < e.maxHealth ? e.cover.z : player.position.z;
    let vx = gx - e.mesh.position.x,
      vz = gz - e.mesh.position.z,
      vd = Math.hypot(vx, vz) || 1;
    if (vd > 3 || !e.cover) {
      e.mesh.position.x += (vx / vd) * e.speed + Math.cos(e.phase) * 0.012;
      e.mesh.position.z += (vz / vd) * e.speed + Math.sin(e.phase) * 0.012;
    }
    e.mesh.lookAt(player.position.x, e.mesh.position.y, player.position.z);
    if (dist < 1.5) {
      health -= 0.22;
      updateHUD();
    }
    if (e.reaction <= 0 && dist < 23) {
      let aim = new THREE.Vector3(ex, 0, ez).normalize(),
        err = (Math.random() - 0.5) * tier.spread;
      let dir = new THREE.Vector3(
        aim.x * Math.cos(err) - aim.z * Math.sin(err),
        0,
        aim.x * Math.sin(err) + aim.z * Math.cos(err),
      );
      shoot(new THREE.Vector3(e.mesh.position.x, 0.9, e.mesh.position.z), dir, true);
      e.reaction = tier.shotEvery + Math.floor(Math.random() * tier.reaction);
    }
  }
  for (let i = hostileShots.length - 1; i >= 0; i--) {
    let b = hostileShots[i];
    b.mesh.position.addScaledVector(b.dir, b.speed);
    b.distance += b.speed;
    if (b.distance > 32) {
      scene.remove(b.mesh);
      hostileShots.splice(i, 1);
      continue;
    }
    if (
      b.mesh.position.distanceTo(new THREE.Vector3(player.position.x, 1, player.position.z)) < 0.85
    ) {
      health -= b.damage;
      scene.remove(b.mesh);
      hostileShots.splice(i, 1);
      updateHUD();
      if (health <= 0) {
        showEnd('RONDA CERRADA', 'Los drones te ganaron la vuelta. Puntos: ' + score);
        return;
      }
    }
  }
  if (health <= 0) {
    showEnd('RONDA CERRADA', 'Los drones te ganaron la vuelta. Puntos: ' + score);
    return;
  }
}
function makeRemote(record) {
  const group = new THREE.Group(),
    mat = new THREE.MeshStandardMaterial({
      color: 0x2dd9ef,
      metalness: 0.55,
      roughness: 0.3,
      emissive: 0x062a35,
    }),
    body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 1.35, 7), mat),
    head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 10, 9),
      new THREE.MeshStandardMaterial({ color: 0x18252c, metalness: 0.8 }),
    );
  body.position.y = 0.72;
  head.position.y = 1.55;
  group.add(body, head);
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.12, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xc9ff38 }),
  );
  visor.position.set(0, 1.58, 0.32);
  group.add(visor);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07100dcc';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#c9ff38';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(record.username || 'RIVAL').slice(0, 18), 128, 42);
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }),
  );
  label.position.y = 2.35;
  label.scale.set(2.2, 0.55, 1);
  group.add(label);
  scene.add(group);
  return { group, lastShotId: null };
}
function syncLivePlayers(roster) {
  roster = roster || {};
  for (const [id, record] of Object.entries(roster)) {
    let remote = livePlayers.get(id);
    if (!remote) {
      remote = makeRemote(record);
      livePlayers.set(id, remote);
    }
    remote.group.position.set(Number(record.x) || 0, Number(record.y) || 0, Number(record.z) || 0);
    remote.group.rotation.y = Number(record.rotation) || 0;
    if (record.lastShot && record.lastShot.id !== remote.lastShotId) {
      remote.lastShotId = record.lastShot.id;
      if (gameMode === 'combat' && running) {
        const shot = record.lastShot,
          dx = player.position.x - shot.x,
          dz = player.position.z - shot.z,
          ux = Math.sin(shot.rotation),
          uz = Math.cos(shot.rotation),
          along = dx * ux + dz * uz,
          side = Math.abs(dx * uz - dz * ux);
        if (along > 0 && along < 38 && side < 1.15) {
          health -= 10;
          updateHUD();
          if (health <= 0) showEnd('RONDA CERRADA', 'Un rival te sacó de la vuelta.');
        }
      }
    }
  }
  for (const [id, remote] of livePlayers) {
    if (!Object.hasOwn(roster, id)) {
      scene.remove(remote.group);
      livePlayers.delete(id);
    }
  }
  if (gameMode === 'combat' && wave === 1 && frame < 300)
    spawnLeft = Math.max(0, 6 - (Object.keys(roster).length + 1));
  const status = el('network-status'),
    hudStatus = el('network-hud'),
    message = Object.keys(roster).length
      ? 'RIVALES EN RED: ' + Object.keys(roster).length
      : 'SALA ABIERTA · BUSCANDO RIVALES';
  if (status) status.textContent = message;
  if (hudStatus) hudStatus.textContent = message;
}
function update() {
  if (!running) {
    player.rotation.y += 0.006;
    return;
  }
  if (paused || finished) return;
  frame++;
  if (liveMatch && ++netFrame % 8 === 0)
    liveMatch.publish({
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotation: player.rotation.y,
      health,
      mode: gameMode,
      map: currentMap.id,
      username: playerName,
    });
  if (gameMode === 'parkour') {
    let done = CyberParkour.update(
      player,
      keys,
      camera,
      () => {
        score = Math.max(0, score - 25);
        el('score-val').textContent = score;
      },
      (time, best, crystals) => {
        score = time.toFixed(2) + ' s';
        window.CYBER_PARKOUR_TIME = time;
        window.CYBER_PARKOUR_CRYSTALS = crystals;
        showEnd('¡META!', `Llegaste en ${time.toFixed(2)} s · ${crystals} cristales recogidos.`, best.toFixed(2) + ' s');
      },
      (progress) => {
        el('parkour-percent').textContent = `${progress.percent}%`;
        el('parkour-checkpoint').textContent = progress.checkpoint;
        el('parkour-crystals').textContent = `${progress.crystals} / ${progress.totalCrystals}`;
      },
    );
    let elapsed = (performance.now() - parkourStart) / 1000;
    el('score-val').textContent = elapsed.toFixed(1) + ' s';
    return;
  }
  moveCombat();
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.mesh.position.add(p.v);
    p.life--;
    p.mesh.scale.multiplyScalar(0.92);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}
function loop() {
  requestAnimationFrame(loop);
  update();
  renderer.render(scene, camera);
}
loop();
// Controles táctiles: joystick analógico, disparo mantenido y salto.
if (matchMedia('(pointer: coarse)').matches) {
  el('touch-controls').classList.remove('d-none');
  const pad = el('move-stick'),
    knob = pad.querySelector('i');
  let pointer = null;
  pad.addEventListener('pointerdown', (e) => {
    pointer = e.pointerId;
    pad.setPointerCapture(pointer);
    moveStick(e);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) moveStick(e);
  });
  const release = () => {
    pointer = null;
    keys.w = keys.a = keys.s = keys.d = false;
    knob.style.transform = 'translate(0,0)';
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  function moveStick(e) {
    const r = pad.getBoundingClientRect(),
      x = e.clientX - (r.left + r.width / 2),
      y = e.clientY - (r.top + r.height / 2),
      len = Math.max(1, Math.hypot(x, y)),
      k = Math.min(34, len),
      nx = (x / len) * k,
      ny = (y / len) * k;
    knob.style.transform = 'translate(' + nx + 'px,' + ny + 'px)';
    keys.a = x < -12;
    keys.d = x > 12;
    keys.w = y < -12;
    keys.s = y > 12;
  }
  const fire = el('touch-fire');
  fire.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    mouseDown = true;
    if (gameMode === 'combat' && enemies.length) {
      let target = enemies.reduce((a, b) =>
        a.mesh.position.distanceTo(player.position) < b.mesh.position.distanceTo(player.position)
          ? a
          : b,
      );
      player.rotation.y = Math.atan2(
        target.mesh.position.x - player.position.x,
        target.mesh.position.z - player.position.z,
      );
    }
  });
  fire.addEventListener('pointerup', () => (mouseDown = false));
  fire.addEventListener('pointercancel', () => (mouseDown = false));
  el('touch-jump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    CyberParkour.jump();
  });
  const dash = el('touch-dash');
  dash.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keys.run = true;
  });
  dash.addEventListener('pointerup', () => (keys.run = false));
  dash.addEventListener('pointercancel', () => (keys.run = false));
}
