import { auth } from '../services/auth.js';
import { db } from '../services/db.js';
import { SHOP_ITEMS } from '../data/shop-items.js';
import { purchaseItem, redeemCode } from '../services/economy.js';

const user = await auth.current();
if (!user) location.replace('./index.html');
else await startStore(user);

async function startStore(account) {
  const shopItems = await db.getGameContent('shopItems', SHOP_ITEMS);
  let user = {
    ...account,
    coins: Number(account.coins) || 0,
    gems: Number(account.gems) || 0,
    inventory: Array.isArray(account.inventory) ? [...account.inventory] : [],
    collection: Array.isArray(account.collection) ? [...account.collection] : [],
  };
  const grid = document.querySelector('#shop-grid');
  const modal = new bootstrap.Modal(document.querySelector('#buyConfirmModal'));
  let selected = null;
  let market = 'all';
  let renderer, scene, camera, model, frame;
  const safe = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    );

  function updateWallet() {
    document.querySelector('#shop-coins').textContent = user.coins.toLocaleString('es-CO');
    document.querySelector('#shop-gems').textContent = user.gems.toLocaleString('es-CO');
  }

  function renderItems() {
    const items = shopItems.filter((item) => {
      if (market === 'coins' || market === 'gems') return item.currency === market;
      if (market === 'codes') return false;
      return true;
    });
    grid.innerHTML = items.length
      ? items
          .map((item) => {
            const owned = item.items.every((id) => user.inventory.includes(id));
            const currency = item.currency === 'gems' ? '💚' : '🪙';
            return `<div class="col-6 col-xl-4"><article class="item-card ${selected?.id === item.id ? 'selected' : ''}" data-item="${safe(item.id)}" tabindex="0" role="button" style="--item-color:${safe(item.color)}"><div class="item-swatch"></div><span class="item-category">${item.category === 'skin' ? 'PINTA' : item.category === 'weapon' ? 'ARSENAL' : 'COMBO'}</span><h3>${safe(item.name)}</h3><p>${safe(item.description)}</p><div class="item-buy"><span class="price">${item.price === 0 ? 'GRATIS' : `${currency} ${item.price}`}</span><button class="btn ${owned ? 'btn-outline-light' : 'btn-lime'}" data-buy="${safe(item.id)}" ${owned ? 'disabled' : ''}>${owned ? 'EN TU CASILLERO' : item.price === 0 ? 'RECLAMAR' : 'VER'}</button></div><span class="item-rarity">${safe(item.rarity)}</span></article></div>`;
          })
          .join('')
      : '<div class="col-12"><p class="text-secondary">Los premios se configuran desde el panel de administración.</p></div>';
    grid.querySelectorAll('[data-item]').forEach((card) => {
      card.addEventListener('click', () => selectItem(card.dataset.item));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') selectItem(card.dataset.item);
      });
    });
    grid.querySelectorAll('[data-buy]').forEach((button) =>
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        selectItem(button.dataset.buy);
        openPurchase();
      }),
    );
    document.querySelector('#catalog-count').textContent =
      `${items.length} ARTÍCULOS · INVENTARIO ${user.inventory.length}`;
  }

  function selectItem(id) {
    selected = shopItems.find((item) => item.id === id);
    if (!selected) return;
    document.querySelector('#preview-title').textContent = selected.name;
    document.querySelector('#preview-category').textContent =
      selected.category === 'skin'
        ? 'Pinta del operador'
        : selected.category === 'weapon'
          ? 'Arsenal del parche'
          : 'Paquete del parche';
    document.querySelector('#preview-description').textContent = selected.description;
    document.querySelector('#preview-rarity').textContent = selected.rarity;
    const action = document.querySelector('#btn-equip-selected');
    const owned = selected.items.every((item) => user.inventory.includes(item));
    action.disabled = false;
    action.textContent = owned
      ? 'YA ESTÁ EN TU CASILLERO'
      : selected.price
        ? 'VER PRECIO Y ADQUIRIR'
        : 'RECLAMAR GRATIS';
    action.onclick = openPurchase;
    if (model)
      model.traverse((node) => {
        if (node.material?.color) node.material.color.set(selected.color);
      });
    renderItems();
  }

  function openPurchase() {
    if (!selected) return;
    document.querySelector('#modal-item-name').textContent = selected.name;
    document.querySelector('#modal-item-price').textContent = selected.price
      ? `${selected.currency === 'gems' ? '💚' : '🪙'} ${selected.price}`
      : 'SIN COSTO';
    const confirm = document.querySelector('#btn-confirm-purchase');
    confirm.disabled = false;
    confirm.onclick = async () => {
      confirm.disabled = true;
      try {
        const result = await purchaseItem(user, selected.id);
        user = result.user;
        updateWallet();
        renderItems();
        modal.hide();
        alert(`${selected.name} quedó en tu inventario.`);
      } catch (error) {
        alert(error.message || 'No se pudo completar la compra.');
        confirm.disabled = false;
      }
    };
    modal.show();
  }

  document.querySelectorAll('[data-market]').forEach((button) =>
    button.addEventListener('click', () => {
      market = button.dataset.market;
      document
        .querySelectorAll('[data-market]')
        .forEach((tab) => tab.classList.toggle('active', tab === button));
      const codes = market === 'codes';
      document.querySelector('#code-panel').classList.toggle('d-none', !codes);
      grid.classList.toggle('d-none', codes);
      if (market !== 'codes') renderItems();
    }),
  );

  const redeemButton = document.querySelector('#btn-redeem-code');
  if (db.mode !== 'firebase') {
    redeemButton.disabled = true;
    document.querySelector('#code-note').textContent =
      'Activa Firebase para validar los usos y premios de códigos de forma segura. La tienda local sigue disponible.';
  }
  redeemButton.addEventListener('click', async () => {
    const feedback = document.querySelector('#code-feedback');
    const code = document.querySelector('#promo-code-input').value;
    redeemButton.disabled = true;
    feedback.textContent = 'Validando código…';
    feedback.style.color = 'var(--muted)';
    try {
      const result = await redeemCode(user, code);
      user = result.user;
      updateWallet();
      renderItems();
      feedback.textContent = `Canje listo: +${result.coins} monedas, +${result.gems} esmeraldas y ${result.newItems.length} artículo(s).`;
      feedback.style.color = 'var(--lime)';
    } catch (error) {
      feedback.textContent = error.message || 'No fue posible canjear el código.';
      feedback.style.color = '#ff8d78';
    } finally {
      redeemButton.disabled = db.mode !== 'firebase';
    }
  });

  updateWallet();
  renderItems();
  initPreview();

  function initPreview() {
    if (!window.THREE) return;
    const host = document.querySelector('#shop-3d-preview');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 1.1, 5.5);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: window.innerWidth > 700 });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xcaf9a0, 0x12201a, 2));
    const lamp = new THREE.PointLight(0xc8fa58, 22, 12);
    lamp.position.set(2, 3, 3);
    scene.add(lamp);
    model = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: '#9ae72e',
      roughness: 0.42,
      metalness: 0.5,
      emissive: '#1b3714',
      emissiveIntensity: 0.3,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 1.35, 8), material);
    body.position.y = 0.15;
    model.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), material);
    head.position.y = 1.15;
    model.add(head);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: '#d8ff84' }),
    );
    visor.position.set(0, 1.17, 0.35);
    model.add(visor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.018, 6, 48),
      new THREE.MeshBasicMaterial({ color: '#c8fa58', transparent: true, opacity: 0.65 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.55;
    model.add(ring);
    scene.add(model);
    document.querySelector('#btn-rotate-left').onclick = () => {
      model.rotation.y -= 0.5;
    };
    document.querySelector('#btn-rotate-right').onclick = () => {
      model.rotation.y += 0.5;
    };
    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener('resize', resize);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      model.rotation.y += 0.003;
      model.position.y = Math.sin(performance.now() * 0.0012) * 0.06;
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
  }
}
