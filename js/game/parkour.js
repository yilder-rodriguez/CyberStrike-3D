// Circuito de parkour modular: la geometría se comparte por pista y se libera al salir.
window.CyberParkour = (() => {
  const TRACK_WIDTH = 17;
  const CHECKPOINTS = [0.24, 0.49, 0.74];
  let sceneRef,
    mapRef,
    startZ = 26,
    finishZ = -238,
    startedAt = 0,
    penalty = 0,
    velocityY = 0,
    activeCheckpoint = { z: 26, name: 'SALIDA' },
    activeMap = 'medellin-azoteas',
    hitLockUntil = 0,
    progressFrame = 0,
    collected = 0,
    renderables = [],
    hazards = [],
    crystals = [],
    markers = [],
    animated = [],
    materials = {},
    geometries = {},
    extraMaterials = [];

  function routeCenter(z) {
    const distance = startZ - z;
    return Math.sin(distance * 0.018) * 2.8 + Math.sin(distance * 0.043) * 0.7;
  }

  function add(mesh, x, y, z, target = renderables, castShadow = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    sceneRef.add(mesh);
    target.push(mesh);
    return mesh;
  }

  function material(name, color, emissive = 0x000000, intensity = 0) {
    if (!materials[name]) {
      materials[name] = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: intensity,
        roughness: 0.68,
        metalness: 0.24,
        flatShading: true,
      });
    }
    return materials[name];
  }

  function geometry(name, create) {
    if (!geometries[name]) geometries[name] = create();
    return geometries[name];
  }

  // Los tramos tienen esquinas biseladas y perfil facetado, sin bloques cúbicos planos.
  function deckShape(length, width) {
    const cut = 0.72;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + cut, -length / 2);
    shape.lineTo(width / 2 - cut, -length / 2);
    shape.lineTo(width / 2, -length / 2 + cut);
    shape.lineTo(width / 2, length / 2 - cut);
    shape.lineTo(width / 2 - cut, length / 2);
    shape.lineTo(-width / 2 + cut, length / 2);
    shape.lineTo(-width / 2, length / 2 - cut);
    shape.lineTo(-width / 2, -length / 2 + cut);
    shape.closePath();
    const meshGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.14,
      bevelThickness: 0.1,
    });
    meshGeometry.rotateX(Math.PI / 2);
    return meshGeometry;
  }

  function addDeckRange(fromZ, toZ, palette) {
    let cursor = fromZ;
    while (cursor > toZ) {
      const length = Math.min(13.5, cursor - toZ);
      const mid = cursor - length / 2;
      const cx = routeCenter(mid);
      const deck = new THREE.Mesh(
        geometry(`deck-${Math.ceil(length)}`, () => deckShape(length + 0.45, TRACK_WIDTH)),
        material('deck', palette.deck, palette.deckGlow, 0.11),
      );
      add(deck, cx, 0.7, mid);

      // Luminarias laterales pequeñas que dibujan el camino sin saturar el celular.
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          geometry('rail', () => new THREE.CylinderGeometry(0.075, 0.11, length, 6)),
          material('rail', palette.neon, palette.neon, 0.75),
        );
        rail.rotation.x = Math.PI / 2;
      add(rail, cx + side * (TRACK_WIDTH / 2 - 0.4), 1.0, mid, renderables, false);
      }
      cursor -= length;
    }
  }

  function addMountain(x, z, scale, palette, seed) {
    const peak = new THREE.Mesh(
      geometry('mountain', () => new THREE.IcosahedronGeometry(1, 1)),
      material(`mountain-${seed % 3}`, palette.mountains[seed % palette.mountains.length]),
    );
    peak.scale.set(scale * 1.3, scale * 1.65, scale);
    peak.rotation.set(seed * 0.2, seed * 0.73, seed * 0.14);
    add(peak, x, scale * 0.95 - 1, z, renderables, false);
  }

  function addScenery(palette) {
    let seed = 1;
    for (let z = startZ - 14; z > finishZ - 4; z -= 22) {
      const center = routeCenter(z);
      for (const side of [-1, 1]) {
        const offset = 15 + ((seed * 7) % 9);
        const x = center + side * offset;
        const height = 8 + ((seed * 13) % 17);
        if (mapRef.id === 'transmi-neon') {
          const tower = new THREE.Mesh(
            geometry('tunnel-pillar', () => new THREE.CylinderGeometry(1.4, 2.1, 1, 7)),
            material('city', palette.city),
          );
          tower.scale.y = height;
          add(tower, x, height / 2 - 0.5, z, renderables, false);
          const light = new THREE.Mesh(
            geometry('city-light', () => new THREE.CylinderGeometry(0.08, 0.08, 1, 6)),
            material('city-neon', palette.neon, palette.neon, 1.1),
          );
          light.scale.y = height * 0.8;
          add(light, x - side * 1.2, height / 2, z, renderables, false);
        } else {
          addMountain(x, z, 7 + ((seed * 5) % 7), palette, seed);
          const roof = new THREE.Mesh(
            geometry('roof', () => new THREE.CylinderGeometry(2.1, 2.8, 1, 7)),
            material('city', palette.city),
          );
          roof.scale.y = height * 0.7;
          add(roof, x + side * 3.5, height * 0.35 - 0.2, z - 8, renderables, false);
          const signal = new THREE.Mesh(
            geometry('signal', () => new THREE.SphereGeometry(0.32, 8, 6)),
            material('city-neon', palette.neon, palette.neon, 1.5),
          );
          add(signal, x + side * 3.5, height * 0.7, z - 8, renderables, false);
        }
        seed += 1;
      }
    }

    // Siluetas grandes y lejanas dan profundidad al valle del recorrido.
    for (let i = 0; i < 15; i += 1) {
      const z = startZ - i * 19;
      addMountain((i % 2 ? -1 : 1) * (34 + (i % 4) * 5), z, 18 + (i % 3) * 6, palette, i + 4);
    }
  }

  function addGate(z, name, palette, isFinish = false) {
    const ringMaterial = new THREE.MeshBasicMaterial({ color: isFinish ? 0xc9ff38 : palette.neon });
    extraMaterials.push(ringMaterial);
    const ring = new THREE.Mesh(
      geometry(isFinish ? 'finish-ring' : 'checkpoint-ring', () => new THREE.TorusGeometry(isFinish ? 5 : 3.25, isFinish ? 0.24 : 0.17, 8, 24)),
      ringMaterial,
    );
    ring.position.set(routeCenter(z), isFinish ? 3.2 : 2.75, z);
    sceneRef.add(ring);
    renderables.push(ring);
    animated.push({ type: 'gate', mesh: ring, phase: z * 0.03 });

    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        geometry('gate-post', () => new THREE.CylinderGeometry(0.28, 0.46, 4.8, 7)),
        material(isFinish ? 'goal-post' : 'checkpoint-post', isFinish ? 0xc9ff38 : palette.post, palette.neon, 0.22),
      );
      add(post, routeCenter(z) + side * 4.6, 2.4, z);
    }
    markers.push({ z, name, active: false });
  }

  function addObstacle(spec, index, palette) {
    const z = spec.z;
    const x = routeCenter(z) + spec.offset;
    const isMover = spec.kind === 'mover';
    const hazardGeometry = geometry(`obstacle-${spec.kind}`, () =>
      isMover
        ? new THREE.CylinderGeometry(0.26, 0.3, 7.2, 8)
        : new THREE.IcosahedronGeometry(1, 1),
    );
    const mesh = new THREE.Mesh(
      hazardGeometry,
      material(`hazard-${index % 2}`, index % 2 ? palette.hazard : palette.hazardLight, palette.hazardGlow, 0.24),
    );
    if (isMover) {
      mesh.rotation.z = Math.PI / 2;
      mesh.position.y = 1.45;
    } else {
      mesh.scale.set(spec.radius * 1.35, spec.height, spec.radius);
      mesh.position.y = spec.height;
    }
    add(mesh, x, mesh.position.y, z, renderables);
    hazards.push({
      mesh,
      z,
      x,
      offset: spec.offset,
      width: isMover ? 1.2 : spec.radius + 0.7,
      height: isMover ? 2.2 : spec.height,
      kind: spec.kind,
      phase: index * 0.8,
      baseY: mesh.position.y,
    });

    if (spec.kind === 'mover') animated.push({ type: 'mover', hazard: hazards[hazards.length - 1] });
  }

  function addCrystal(z, offset, palette) {
    const crystal = new THREE.Mesh(
      geometry('crystal', () => new THREE.OctahedronGeometry(0.62, 0)),
      new THREE.MeshStandardMaterial({
        color: palette.crystal,
        emissive: palette.crystal,
        emissiveIntensity: 1.25,
        metalness: 0.3,
        roughness: 0.22,
        flatShading: true,
      }),
    );
    const x = routeCenter(z) + offset;
    add(crystal, x, 1.35, z, renderables, false);
    crystals.push({ mesh: crystal, x, z, active: true, phase: z * 0.1 });
  }

  function paletteFor(map) {
    return map.id === 'transmi-neon'
      ? {
          deck: 0x26383a, deckGlow: 0x10282a, neon: 0x48e8ff, post: 0x778c8b,
          city: 0x18282c, hazard: 0xf18447, hazardLight: 0xffc857, hazardGlow: 0x51200b,
          crystal: 0x73f2ff, mountains: [0x18282b, 0x203a3d, 0x30454a],
        }
      : {
          deck: 0x3c3430, deckGlow: 0x241a17, neon: 0xffc857, post: 0x9b6e45,
          city: 0x293329, hazard: 0xf27645, hazardLight: 0xf6bd58, hazardGlow: 0x55200c,
          crystal: 0xc5ff69, mountains: [0x263a2c, 0x344b37, 0x4a5940],
        };
  }

  function build(scene, map) {
    sceneRef = scene;
    mapRef = map;
    activeMap = map.id;
    startZ = Number.isFinite(Number(map.startZ)) ? Number(map.startZ) : 26;
    finishZ = Number.isFinite(Number(map.finishZ)) ? Number(map.finishZ) : -238;
    if (finishZ >= startZ - 80) finishZ = startZ - 264;
    materials = {};
    geometries = {};
    extraMaterials = [];
    renderables = [];
    hazards = [];
    crystals = [];
    markers = [];
    animated = [];
    collected = 0;
    const palette = paletteFor(map);

    // Los huecos son saltos visibles; el código también los detecta bajo los pies.
    const gapFractions = [0.2, 0.47, 0.72, 0.88];
    const gaps = gapFractions.map((fraction, index) => ({
      z: startZ + (finishZ - startZ) * fraction,
      half: index === 1 ? 3.1 : 2.45,
    }));
    let cursor = startZ;
    for (const gap of gaps) {
      const nearEdge = gap.z + gap.half;
      const farEdge = gap.z - gap.half;
      if (cursor > nearEdge) addDeckRange(cursor, nearEdge, palette);
      cursor = farEdge;
    }
    addDeckRange(cursor, finishZ - 4, palette);

    addScenery(palette);
    addGate(startZ - 5, 'SALIDA', palette);
    CHECKPOINTS.forEach((fraction, index) => {
      const z = startZ + (finishZ - startZ) * fraction;
      addGate(z, `CHECKPOINT ${index + 1}`, palette);
    });
    addGate(finishZ, 'META', palette, true);

    // Cada zona alterna obstáculos para brincar, cambiar de carril y calcular el impulso.
    const obstacleFractions = [0.08, 0.14, 0.27, 0.32, 0.39, 0.53, 0.58, 0.65, 0.78, 0.83, 0.93];
    obstacleFractions.forEach((fraction, index) => {
      const z = startZ + (finishZ - startZ) * fraction;
      const kind = index % 4 === 2 ? 'mover' : 'boulder';
      const offset = [-4.4, 0, 4.4][index % 3];
      addObstacle(
        {
          z,
          offset,
          kind,
          radius: index % 2 ? 1.18 : 1.55,
          height: index % 3 === 0 ? 0.78 : 1.12,
        },
        index,
        palette,
      );
    });

    const crystalFractions = [0.11, 0.17, 0.24, 0.35, 0.43, 0.5, 0.62, 0.69, 0.76, 0.86, 0.91];
    crystalFractions.forEach((fraction, index) => {
      const z = startZ + (finishZ - startZ) * fraction;
      addCrystal(z, [-4.1, 0, 4.1][index % 3], palette);
    });

    // Devuelve una limpieza completa para que reiniciar no acumule mallas ni materiales.
    return () => {
      for (const mesh of renderables) scene.remove(mesh);
      for (const geometry of Object.values(geometries)) geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
      for (const material of extraMaterials) material.dispose();
      for (const crystal of crystals) crystal.mesh.material.dispose();
      renderables = [];
      hazards = [];
      crystals = [];
      markers = [];
      animated = [];
      extraMaterials = [];
    };
  }

  function reset(player) {
    startedAt = performance.now();
    penalty = 0;
    velocityY = 0;
    hitLockUntil = 0;
    collected = 0;
    progressFrame = 0;
    activeCheckpoint = { z: startZ, name: 'SALIDA' };
    player.position.set(routeCenter(startZ), 0, startZ);
    window.__cyberOnGround = true;
  }

  function jump() {
    if (!window.__cyberOnGround) return;
    velocityY = 0.255;
    window.__cyberOnGround = false;
  }

  function resetAtCheckpoint(player, now, onHit) {
    if (now < hitLockUntil) return;
    hitLockUntil = now + 850;
    penalty += 1800;
    player.position.set(routeCenter(activeCheckpoint.z), 0, activeCheckpoint.z + 1.4);
    velocityY = 0;
    window.__cyberOnGround = true;
    onHit?.(activeCheckpoint.name);
  }

  function readRecords() {
    try {
      return JSON.parse(localStorage.getItem('cyber_parkour_records_v1') || '{}') || {};
    } catch {
      return {};
    }
  }

  function update(player, keys, camera, onHit, onWin, onProgress) {
    const step = keys.run ? 0.27 : 0.19;
    const dx = (keys.d ? step : 0) - (keys.a ? step : 0);
    const dz = (keys.s ? step : 0) - (keys.w ? step : 0);
    player.position.x = THREE.MathUtils.clamp(player.position.x + dx, -12, 12);
    player.position.z = THREE.MathUtils.clamp(player.position.z + dz, finishZ, startZ + 2);

    velocityY -= 0.0115;
    player.position.y = Math.max(0, player.position.y + velocityY);
    if (player.position.y === 0) {
      velocityY = 0;
      window.__cyberOnGround = true;
    }
    player.rotation.y = Math.PI;

    const now = performance.now();
    const courseX = routeCenter(player.position.z);
    const overGap = [0.2, 0.47, 0.72, 0.88].some((fraction, index) => {
      const center = startZ + (finishZ - startZ) * fraction;
      return Math.abs(player.position.z - center) < (index === 1 ? 3.1 : 2.45);
    });
    if ((Math.abs(player.position.x - courseX) > TRACK_WIDTH / 2 - 0.7 || overGap) && player.position.y < 0.55) {
      resetAtCheckpoint(player, now, onHit);
    }

    for (const marker of markers) {
      if (!marker.active && player.position.z <= marker.z && marker.name !== 'META') {
        marker.active = true;
        activeCheckpoint = { z: marker.z, name: marker.name };
      }
    }

    for (const animation of animated) {
      if (animation.type === 'gate') {
        animation.mesh.rotation.x = Math.sin(now * 0.0017 + animation.phase) * 0.07;
      } else if (animation.type === 'mover') {
        const hazard = animation.hazard;
        hazard.mesh.position.x = routeCenter(hazard.z) + hazard.offset + Math.sin(now * 0.002 + hazard.phase) * 3.1;
      }
    }

    for (const hazard of hazards) {
      hazard.mesh.rotation.y += hazard.kind === 'mover' ? 0.04 : 0.012;
      const collides =
        Math.abs(player.position.z - hazard.z) < 1.25 &&
        Math.abs(player.position.x - hazard.mesh.position.x) < hazard.width &&
        player.position.y < hazard.height + 0.35;
      if (collides) {
        resetAtCheckpoint(player, now, onHit);
        break;
      }
    }

    for (const crystal of crystals) {
      if (!crystal.active) continue;
      crystal.mesh.rotation.y += 0.035;
      crystal.mesh.position.y = 1.35 + Math.sin(now * 0.003 + crystal.phase) * 0.18;
      if (
        Math.abs(player.position.z - crystal.z) < 1.35 &&
        Math.abs(player.position.x - crystal.x) < 1.35 &&
        player.position.y < 2.4
      ) {
        crystal.active = false;
        crystal.mesh.visible = false;
        collected += 1;
      }
    }

    camera.position.x += (player.position.x - camera.position.x) * 0.1;
    camera.position.y += (player.position.y + 11 - camera.position.y) * 0.08;
    camera.position.z += (player.position.z + 15 - camera.position.z) * 0.1;

    const progress = THREE.MathUtils.clamp((startZ - player.position.z) / (startZ - finishZ), 0, 1);
    if (++progressFrame % 6 === 0) {
      onProgress?.({
        percent: Math.floor(progress * 100),
        checkpoint: activeCheckpoint.name,
        crystals: collected,
        totalCrystals: crystals.length,
      });
    }

    if (player.position.z <= finishZ) {
      const time = (now - startedAt + penalty) / 1000;
      const records = readRecords();
      const best = Math.min(Number(records[activeMap]) || Infinity, time);
      records[activeMap] = best;
      try {
        localStorage.setItem('cyber_parkour_records_v1', JSON.stringify(records));
      } catch {
        // El recorrido termina aunque el navegador tenga bloqueado el almacenamiento local.
      }
      onWin?.(time, best, collected);
      return true;
    }
    return false;
  }

  return { build, reset, jump, update };
})();
