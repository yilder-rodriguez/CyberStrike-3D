import { auth } from '../services/auth.js';
import { db } from '../services/db.js';
import { SHOP_ITEMS } from '../data/shop-items.js';

const account = await auth.current();
if (!account) location.replace('./index.html');
else launchInventory(account);

function launchInventory(profile) {
  const items = new Map();
  for (const product of SHOP_ITEMS) {
    for (const itemId of product.items) {
      if (!items.has(itemId)) items.set(itemId, { ...product, id: itemId });
    }
  }
  let user = {
    ...profile,
    inventory: Array.isArray(profile.inventory) ? [...profile.inventory] : [],
    equipped: normalizeEquipped(profile.equipped, profile.inventory || []),
  };
  let filter = 'all';
  let selectedId = null;
  let previewMaterial = null;
  const grid = document.querySelector('#inventory-grid');
  const status = document.querySelector('#equip-status');

  function itemInfo(id) {
    return (
      items.get(id) || {
        id,
        name: id.replaceAll('_', ' '),
        category: id.startsWith('skin_') ? 'skin' : id.startsWith('gun_') ? 'weapon' : 'other',
        rarity: 'Sin clasificar',
        color: '#c8fa58',
      }
    );
  }

  function renderLoadout() {
    const skin = user.equipped.skin && itemInfo(user.equipped.skin);
    const weapon = user.equipped.weapon && itemInfo(user.equipped.weapon);
    document.querySelector('#equipped-skin').textContent = skin?.name || 'Sin equipar';
    document.querySelector('#equipped-weapon').textContent = weapon?.name || 'Sin equipar';
    document.querySelector('[data-unequip="skin"]').disabled = !skin;
    document.querySelector('[data-unequip="weapon"]').disabled = !weapon;
    if (previewMaterial) {
      const color = skin?.color || '#9ae72e';
      previewMaterial.color.set(color);
      previewMaterial.emissive.set(color);
    }
  }

  function renderItems() {
    const owned = user.inventory.map(itemInfo);
    const shown = owned.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'other') return !['skin', 'weapon'].includes(item.category);
      return item.category === filter;
    });
    document.querySelector('#item-count').textContent =
      `${owned.length} ARTÍCULO${owned.length === 1 ? '' : 'S'}`;
    grid.innerHTML = shown.length
      ? shown
          .map((item) => {
            const slot =
              item.category === 'skin' ? 'skin' : item.category === 'weapon' ? 'weapon' : null;
            const isEquipped = slot && user.equipped[slot] === item.id;
            const isSelected = selectedId === item.id;
            return `<div class="col-6 col-lg-4"><article class="gear-card ${isEquipped ? 'equipped' : ''} ${isSelected ? 'selected' : ''}" style="--gear-color:${item.color}" data-gear="${item.id}"><div class="gear-art"></div><span class="gear-kind">${slot === 'skin' ? 'TRAJE' : slot === 'weapon' ? 'ARMA' : 'ARTÍCULO'}</span><h3>${item.name}</h3><span class="gear-rarity">${item.rarity}</span><button class="btn ${isEquipped ? 'btn-outline-light' : 'btn-lime'}" data-toggle-equip="${item.id}" ${slot ? '' : 'disabled'}>${isEquipped ? 'DESEQUIPAR' : slot ? `EQUIPAR ${slot === 'skin' ? 'TRAJE' : 'ARMA'}` : 'PRÓXIMAMENTE'}</button></article></div>`;
          })
          .join('')
      : '<div class="empty-state"><span class="eyebrow">CASILLERO VACÍO</span><p class="mt-2 mb-0">Pásate por el mercado o gana una partida para conseguir tu primer equipo.</p><a class="btn btn-lime mt-3" href="./tienda.html">IR AL MERCADO ↗</a></div>';

    grid.querySelectorAll('[data-gear]').forEach((card) =>
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-toggle-equip]')) return;
        selectedId = card.dataset.gear;
        renderItems();
      }),
    );
    grid.querySelectorAll('[data-toggle-equip]').forEach((button) =>
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const item = itemInfo(button.dataset.toggleEquip);
        const slot =
          item.category === 'skin' ? 'skin' : item.category === 'weapon' ? 'weapon' : null;
        if (!slot) return;
        const next = { ...user.equipped, [slot]: user.equipped[slot] === item.id ? null : item.id };
        button.disabled = true;
        try {
          const updated = { ...user, equipped: next };
          await db.saveEconomy(updated);
          user = updated;
          selectedId = item.id;
          status.textContent = user.equipped[slot]
            ? `${item.name} equipado.`
            : `${item.name} guardado.`;
          renderLoadout();
          renderItems();
        } catch (error) {
          status.textContent = error.message || 'No se pudo guardar el equipo.';
          button.disabled = false;
        }
      }),
    );
  }

  document.querySelectorAll('[data-filter]').forEach((button) =>
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      document
        .querySelectorAll('[data-filter]')
        .forEach((entry) => entry.classList.toggle('active', entry === button));
      renderItems();
    }),
  );
  document.querySelectorAll('[data-unequip]').forEach((button) =>
    button.addEventListener('click', async () => {
      const slot = button.dataset.unequip;
      const next = { ...user.equipped, [slot]: null };
      try {
        await db.saveEconomy({ ...user, equipped: next });
        user = { ...user, equipped: next };
        status.textContent = `${slot === 'skin' ? 'Traje' : 'Arma'} desequipado.`;
        renderLoadout();
        renderItems();
      } catch (error) {
        status.textContent = error.message || 'No se pudo guardar el cambio.';
      }
    }),
  );

  document.querySelector('#operator-name').textContent = user.username;
  renderLoadout();
  renderItems();
  initPreview();

  function initPreview() {
    if (!window.THREE) return;
    const host = document.querySelector('#inventory-preview');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 1.1, 5.5);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: window.innerWidth > 700 });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd8ffc0, 0x152019, 2));
    const light = new THREE.PointLight(0xc8fa58, 22, 12);
    light.position.set(2, 3, 3);
    scene.add(light);
    const material = new THREE.MeshStandardMaterial({
      color: '#9ae72e',
      roughness: 0.4,
      metalness: 0.5,
      emissive: '#1b3714',
      emissiveIntensity: 0.32,
    });
    const model = new THREE.Group();
    previewMaterial = material;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 1.35, 8), material);
    torso.position.y = 0.15;
    model.add(torso);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), material);
    head.position.y = 1.15;
    model.add(head);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: '#d8ff84' }),
    );
    visor.position.set(0, 1.17, 0.35);
    model.add(visor);
    const floorRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.018, 6, 48),
      new THREE.MeshBasicMaterial({ color: '#c8fa58', transparent: true, opacity: 0.65 }),
    );
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = -0.55;
    model.add(floorRing);
    scene.add(model);
    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', resize);
    let frame;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      model.rotation.y += 0.004;
      model.position.y = Math.sin(performance.now() * 0.0012) * 0.05;
      renderer.render(scene, camera);
    };
    draw();
    window.addEventListener(
      'pagehide',
      () => {
        cancelAnimationFrame(frame);
        renderer.dispose();
        window.removeEventListener('resize', resize);
      },
      { once: true },
    );
    function paintPreview(skin) {
      const color = skin?.color || '#9ae72e';
      material.color.set(color);
      material.emissive.set(color);
    }
    paintPreview(user.equipped.skin && itemInfo(user.equipped.skin));
  }
}

function normalizeEquipped(equipped = {}, inventory = []) {
  return {
    skin: Object.hasOwn(equipped, 'skin')
      ? equipped.skin
      : inventory.find((id) => id.startsWith('skin_')) || null,
    weapon: Object.hasOwn(equipped, 'weapon')
      ? equipped.weapon
      : inventory.find((id) => id.startsWith('gun_')) || null,
  };
}
