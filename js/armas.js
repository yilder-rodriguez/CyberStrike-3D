import { auth } from './services/auth.js';
import { db } from './services/db.js';
import { SHOP_ITEMS } from './data/shop-items.js';

const user = await auth.current();
if (!user) location.replace('./index.html');
else await renderArsenal(user);

async function renderArsenal(account) {
  const catalog = await db.getGameContent('shopItems', SHOP_ITEMS);
  const products = (Array.isArray(catalog) ? catalog : SHOP_ITEMS).filter(
    (item) => item.category === 'weapon',
  );
  const inventory = Array.isArray(account.inventory) ? account.inventory : [];
  const equipped = account.equipped?.weapon || null;
  const grid = document.querySelector('#arsenal-grid');
  const status = document.querySelector('#arsenal-status');
  document.querySelector('#arsenal-player').textContent = account.username;
  document.querySelector('#arsenal-equipped').textContent = `ARMA EQUIPADA: ${equipped || 'NINGUNA'}`;

  const safe = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);

  grid.innerHTML = products.length
    ? products
        .map((product) => {
          const itemIds = Array.isArray(product.items) ? product.items : [];
          const owned = itemIds.find((id) => inventory.includes(id));
          const isEquipped = owned && owned === equipped;
          const label = isEquipped ? 'EN MANO' : owned ? 'EQUIPAR' : 'VER EN MERCADO';
          const action = owned
            ? `<button class="arsenal-action" data-equip="${safe(owned)}" ${isEquipped ? 'disabled' : ''}>${label}</button>`
            : `<a class="arsenal-action" href="./tienda.html">${label}</a>`;
          return `<div class="col-12 col-sm-6 col-xl-4"><article class="weapon-card" style="--weapon-color:${safe(product.color)}"><div class="weapon-visual" aria-hidden="true"><span>CS</span></div><p class="weapon-type">ARSENAL // ${safe(product.rarity)}</p><h2>${safe(product.name)}</h2><p class="weapon-description">${safe(product.description)}</p><div class="weapon-foot"><span>${owned ? 'EN TU CASILLERO' : `🪙 ${Number(product.price) || 0} · ${safe(product.currency || 'coins').toUpperCase()}`}</span>${action}</div></article></div>`;
        })
        .join('')
    : '<div class="col-12"><p>No hay armas configuradas todavía.</p></div>';

  grid.querySelectorAll('[data-equip]').forEach((button) =>
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const next = { skin: account.equipped?.skin || null, weapon: button.dataset.equip };
        await db.saveEconomy({ ...account, equipped: next });
        document.querySelector('#arsenal-equipped').textContent = `ARMA EQUIPADA: ${button.dataset.equip}`;
        status.textContent = 'Arma equipada y guardada en tu perfil.';
        button.textContent = 'EN MANO';
      } catch (error) {
        status.textContent = error.message || 'No se pudo guardar el equipo.';
        button.disabled = false;
      }
    }),
  );
}
