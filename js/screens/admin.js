import { auth } from '../services/auth.js';
import { db } from '../services/db.js';
import { SHOP_ITEMS } from '../data/shop-items.js';
import { ROULETTES } from '../data/ruletas.js';
import { SEASON_CONFIG } from '../data/seasons.js';

// El panel vuelve a validar el rol en cada carga; las reglas del backend protegen la consulta real.
const currentUser = await auth.current();
if (!currentUser) location.replace('./index.html');
else if (currentUser.role !== 'admin' && !(currentUser.permissions || []).length) location.replace('./menu.html');
else {
  const body = document.querySelector('#players-body');
  const search = document.querySelector('#player-search');
  const roleFilter = document.querySelector('#role-filter');
  const status = document.querySelector('#admin-status');
  const count = document.querySelector('#player-count');
  let players = [];
  let catalogDraft = [];
  let roleOptions = [];
  let activeSeasonConfig = { ...SEASON_CONFIG };
  const can = (permission) => currentUser.role === 'admin' || (currentUser.permissions || []).includes('*') || (currentUser.permissions || []).includes(permission);
  document.querySelectorAll('[data-permission]').forEach((element) => {
    if (!can(element.dataset.permission)) element.classList.add('d-none');
  });
  if (currentUser.role === 'admin') document.querySelector('#roles-tab').classList.remove('d-none');
  if (!can('roles.assign')) {
    document.querySelectorAll('[data-admin-pane="players"] th:last-child, [data-admin-pane="players"] td:last-child').forEach((element) => element.classList.add('d-none'));
  }
  if (!can('codes.manage')) document.querySelector('#code-form')?.classList.add('d-none');

  const safe = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char],
    );
  const lastSeenLabel = (timestamp) => {
    if (!timestamp) return 'Sin registro';
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return 'Sin registro';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
    return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  };

  function render() {
    const query = search.value.trim().toLocaleLowerCase('es');
    const role = roleFilter.value;
    const filtered = players.filter(
      (player) =>
        (!role || player.role === role) &&
        (!query ||
          player.username.toLocaleLowerCase('es').includes(query) ||
          player.uid.toLowerCase().includes(query)),
    );
    count.textContent = players.length.toLocaleString('es-CO');
    body.innerHTML = filtered.length
      ? filtered
          .map(
            (player) => `
      <tr>
        <td><span class="player-name">${safe(player.username)}</span><span class="player-id">${safe(player.uid)}</span></td>
        <td><span class="role-pill ${player.role === 'admin' ? 'admin' : ''}">${safe(player.role.toUpperCase())}</span></td>
        <td>${player.level}</td><td class="rank-cell">${safe(player.rankName)}</td>
        <td>${player.coins.toLocaleString('es-CO')}</td><td>${player.gems.toLocaleString('es-CO')}</td>
          <td>${lastSeenLabel(player.lastSeenAt)}</td>
        <td>${can('roles.assign') ? `<div class="role-editor"><select class="form-select form-select-sm" data-role-select="${safe(player.uid)}" aria-label="Rol de ${safe(player.username)}">${roleOptions.map((role) => `<option value="${safe(role.id)}" ${player.role === role.id ? 'selected' : ''}>${safe(role.name)}</option>`).join('')}</select><button class="btn btn-outline-light btn-sm" data-role-save="${safe(player.uid)}" ${player.uid === currentUser.uid || (player.role === 'admin' && currentUser.role !== 'admin') ? 'disabled title="No puedes cambiar esta cuenta"' : ''}>Aplicar</button></div>` : '<span class="text-secondary">—</span>'}</td>
      </tr>`,
          )
          .join('')
      : '<tr><td colspan="8" class="text-center py-5 text-secondary">No hay jugadores que coincidan.</td></tr>';
    const giftSelect = document.querySelector('#gift-player');
    giftSelect.innerHTML =
      '<option value="">Selecciona una cuenta</option>' +
      players
        .map(
          (p) =>
            `<option value="${safe(p.uid)}">${safe(p.username)} · ${safe(p.uid.slice(0, 8))}</option>`,
        )
        .join('');
    status.textContent = `${filtered.length} de ${players.length} perfiles`;
  }

  async function loadPlayers() {
    status.classList.remove('error');
    status.textContent = 'Consultando perfiles autorizados…';
    document.querySelector('#refresh-players').disabled = true;
    try {
      players = await db.listPlayers(currentUser);
      render();
    } catch (error) {
      status.classList.add('error');
      status.textContent = error.message || 'No fue posible cargar el directorio.';
    } finally {
      document.querySelector('#refresh-players').disabled = false;
    }
  }
  async function loadRoles() {
    roleOptions = await db.adminListRoles(currentUser);
    const roleFilterValue = roleFilter.value;
    roleFilter.innerHTML = '<option value="">Todos los roles</option>' + roleOptions.map((role) => `<option value="${safe(role.id)}">${safe(role.name)}</option>`).join('');
    roleFilter.value = roleOptions.some((role) => role.id === roleFilterValue) ? roleFilterValue : '';
    if (currentUser.role === 'admin') {
      const tbody = document.querySelector('#roles-body');
      tbody.innerHTML = roleOptions.map((role) => `<tr><td><b>${safe(role.name)}</b><small class="d-block text-secondary">${safe(role.id)}${role.fixed ? ' · del sistema' : ''}</small></td><td>${(role.permissions || []).map(safe).join(', ') || 'Sin permisos administrativos'}</td><td>${role.fixed ? 'Protegido' : `<button class="btn btn-outline-danger btn-sm" data-role-delete="${safe(role.id)}">Eliminar</button>`}</td></tr>`).join('');
    }
  }
  if (can('roles.assign')) {
    try { await loadRoles(); } catch (error) { status.textContent = error.message || 'No se pudieron cargar los roles.'; }
  }
  search.addEventListener('input', render);
  roleFilter.addEventListener('change', render);
  document.querySelector('#refresh-players').addEventListener('click', loadPlayers);
  body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-role-save]');
    if (!button) return;
    const uid = button.dataset.roleSave;
    const role = body.querySelector(`[data-role-select="${CSS.escape(uid)}"]`).value;
    button.disabled = true;
    try {
      await db.adminChangeRole(currentUser, uid, role);
      status.textContent =
        'Permisos actualizados. El jugador debe renovar su sesión para ver el nuevo acceso.';
      await loadPlayers();
    } catch (error) {
      status.textContent = error.message || 'No se pudo cambiar el rol.';
      status.classList.add('error');
    } finally {
      button.disabled = false;
    }
  });
  if (can('players.read')) await loadPlayers();

  // Navegación entre herramientas del panel.
  document.querySelectorAll('[data-admin-tab]').forEach((button) =>
    button.addEventListener('click', async () => {
      document
        .querySelectorAll('[data-admin-tab]')
        .forEach((tab) => tab.classList.toggle('active', tab === button));
      document
        .querySelectorAll('[data-admin-pane]')
        .forEach((pane) =>
          pane.classList.toggle('d-none', pane.dataset.adminPane !== button.dataset.adminTab),
        );
      if (button.dataset.adminTab === 'codes') await loadCodes();
      if (button.dataset.adminTab === 'content') await loadContent();
      if (button.dataset.adminTab === 'season') await loadSeason();
      if (button.dataset.adminTab === 'roles') await loadRoles();
    }),
  );
  const firstTab = [...document.querySelectorAll('[data-admin-tab]')].find((tab) => !tab.classList.contains('d-none'));
  if (firstTab && firstTab.dataset.adminTab !== 'players') firstTab.click();

  document.querySelector('#role-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.querySelector('#role-feedback');
    try {
      const permissions = [...document.querySelectorAll('.role-permissions input:checked')].map((input) => input.value);
      await db.adminSaveRole(currentUser, {
        id: document.querySelector('#role-id').value,
        name: document.querySelector('#role-name').value,
        permissions,
      });
      feedback.textContent = 'Rol guardado. Al asignarlo, la persona debe iniciar sesión de nuevo para renovar sus permisos.';
      event.target.reset();
      await loadRoles();
      await loadPlayers();
    } catch (error) { feedback.textContent = error.message || 'No se pudo guardar el rol.'; }
  });
  document.querySelector('#roles-body')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-role-delete]');
    if (!button || !confirm(`¿Eliminar el rol ${button.dataset.roleDelete}?`)) return;
    try {
      await db.adminDeleteRole(currentUser, button.dataset.roleDelete);
      await loadRoles();
    } catch (error) { document.querySelector('#role-feedback').textContent = error.message || 'No se pudo eliminar el rol.'; }
  });

  const codesBody = document.querySelector('#codes-body');
  const codeFeedback = document.querySelector('#code-feedback');
  function expiryValue(value) {
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function renderCodes(codes) {
    codesBody.innerHTML = codes.length
      ? codes
          .map((code) => {
            const expiry = expiryValue(code.expiresAt);
            const state = code.active && (!expiry || expiry > new Date()) ? 'ACTIVO' : 'INACTIVO';
            const reward = code.reward || {};
            return `<tr><td><b>${safe(code.id)}</b></td><td>${Number(reward.coins || 0)} 🪙 · ${Number(reward.gems || 0)} 💚 · ${(reward.items || []).map(safe).join(', ') || '—'}</td><td>${Number(code.uses || 0)} / ${Number(code.maxUses || 0)}</td><td>${expiry ? expiry.toLocaleString('es-CO') : '—'}</td><td><span class="role-pill">${state}</span></td><td>${can('codes.manage') ? `<div class="code-actions"><button class="btn btn-outline-light btn-sm" data-code-edit="${safe(code.id)}">Editar</button><button class="btn btn-outline-light btn-sm" data-code-toggle="${safe(code.id)}">${code.active ? 'Pausar' : 'Activar'}</button><button class="btn btn-outline-danger btn-sm" data-code-delete="${safe(code.id)}">Borrar</button><button class="btn btn-outline-info btn-sm" data-code-who="${safe(code.id)}">Canjes</button></div>` : '<span class="text-secondary">Solo lectura</span>'}</td></tr>`;
          })
          .join('')
      : '<tr><td colspan="6" class="text-center py-4 text-secondary">Todavía no hay códigos.</td></tr>';
  }
  async function loadCodes() {
    try {
      const codes = await db.adminListCodes(currentUser);
      renderCodes(codes);
    } catch (error) {
      codeFeedback.textContent = error.message || 'No se pudo leer la lista.';
    }
  }
  document.querySelector('#code-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = (id) => document.querySelector(id).value;
    try {
      await db.adminSaveCode(currentUser, {
        id: value('#code-id'),
        maxUses: value('#code-max-uses'),
        expiresAt: value('#code-expires'),
        coins: value('#code-coins'),
        gems: value('#code-gems'),
        items: value('#code-items').split(','),
      });
      codeFeedback.textContent = 'Código guardado y listo para publicarse.';
      event.target.reset();
      await loadCodes();
    } catch (error) {
      codeFeedback.textContent = error.message || 'No se pudo guardar.';
    }
  });
  codesBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const id = Object.entries(button.dataset).find(([key]) => key.startsWith('code'))?.[1];
    if (!id) return;
    try {
      const list = await db.adminListCodes(currentUser);
      const code = list.find((entry) => entry.id === id);
      if (button.hasAttribute('data-code-edit') && code) {
        document.querySelector('#code-id').value = code.id;
        document.querySelector('#code-max-uses').value = code.maxUses;
        const expiry = expiryValue(code.expiresAt);
        document.querySelector('#code-expires').value = expiry
          ? new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)
          : '';
        document.querySelector('#code-coins').value = code.reward?.coins || 0;
        document.querySelector('#code-gems').value = code.reward?.gems || 0;
        document.querySelector('#code-items').value = (code.reward?.items || []).join(', ');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (button.hasAttribute('data-code-toggle')) {
        await db.adminSetCodeActive(currentUser, id, !code?.active);
        await loadCodes();
      } else if (button.hasAttribute('data-code-delete') && confirm(`¿Borrar el código ${id}?`)) {
        await db.adminDeleteCode(currentUser, id);
        await loadCodes();
      } else if (button.hasAttribute('data-code-who')) {
        const redemptions = await db.adminRedeemers(currentUser, id);
        const names = redemptions
          .map((entry) => players.find((p) => p.uid === entry.uid)?.username || entry.uid)
          .join(', ');
        alert(
          redemptions.length
            ? `Canjes de ${id}:\n${names}`
            : `El código ${id} todavía no tiene canjes.`,
        );
      }
    } catch (error) {
      codeFeedback.textContent = error.message || 'No se pudo completar la acción.';
    }
  });

  document.querySelector('#gift-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.querySelector('#gift-feedback');
    try {
      await db.adminGift(currentUser, {
        uid: document.querySelector('#gift-player').value,
        coins: document.querySelector('#gift-coins').value,
        gems: document.querySelector('#gift-gems').value,
        items: document
          .querySelector('#gift-items')
          .value.split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      });
      feedback.textContent = 'Regalo entregado y registrado en la colección.';
      event.target.reset();
      await loadPlayers();
    } catch (error) {
      feedback.textContent = error.message || 'No se pudo entregar el regalo.';
    }
  });

  async function loadContent() {
    const [catalog, roulette, maps] = await Promise.all([
      db.adminGetContent(currentUser, 'shopItems', SHOP_ITEMS),
      db.adminGetContent(currentUser, 'roulettes', ROULETTES),
      db.adminGetContent(currentUser, 'maps', window.CYBER_MAPS || []),
    ]);
    document.querySelector('#content-catalog').value = JSON.stringify(catalog, null, 2);
    document.querySelector('#content-roulette').value = JSON.stringify(roulette, null, 2);
    document.querySelector('#content-maps').value = JSON.stringify(maps, null, 2);
    catalogDraft = catalog;
    renderCatalogItems();
    const itemIds = [...new Set(catalog.flatMap((product) => product.items || []))];
    document.querySelector('#admin-item-ids').innerHTML = itemIds
      .map((id) => `<option value="${safe(id)}"></option>`)
      .join('');
  }
  function renderCatalogItems() {
    const table = document.querySelector('#catalog-items');
    table.innerHTML = catalogDraft.length
      ? catalogDraft
          .map(
            (item) =>
              `<tr><td>${safe(item.id)}</td><td><b>${safe(item.name)}</b><small class="d-block text-secondary">${safe(item.description)}</small></td><td>${safe(item.category)}</td><td>${item.currency === 'gems' ? '💚' : '🪙'} ${Number(item.price).toLocaleString('es-CO')}</td><td><div class="code-actions"><button class="btn btn-outline-light btn-sm" data-catalog-edit="${safe(item.id)}">Editar</button><button class="btn btn-outline-danger btn-sm" data-catalog-delete="${safe(item.id)}">Quitar</button></div></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="5" class="text-center py-4 text-secondary">No hay productos.</td></tr>';
  }
  document.querySelector('#catalog-item-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const item = {
      id: document.querySelector('#item-id').value.trim(),
      name: document.querySelector('#item-name').value.trim(),
      description: document.querySelector('#item-description').value.trim(),
      category: document.querySelector('#item-category').value,
      rarity: document.querySelector('#item-rarity').value,
      currency: document.querySelector('#item-currency').value,
      price: Math.floor(Number(document.querySelector('#item-price').value) || 0),
      color: document.querySelector('#item-color').value,
      items: [
        ...new Set(
          document
            .querySelector('#item-ids')
            .value.split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ],
    };
    if (
      !/^[A-Za-z0-9_-]{2,48}$/.test(item.id) ||
      !item.name ||
      !item.items.length ||
      item.items.length > 5 ||
      item.items.some((id) => !/^(skin|gun)_[A-Za-z0-9_]+$/.test(id))
    ) {
      document.querySelector('#content-feedback').textContent =
        'Revisa el ID del producto y los artículos que entrega.';
      return;
    }
    catalogDraft = [item, ...catalogDraft.filter((entry) => entry.id !== item.id)];
    document.querySelector('#content-catalog').value = JSON.stringify(catalogDraft, null, 2);
    renderCatalogItems();
    document.querySelector('#content-feedback').textContent =
      'Producto preparado; pulsa PUBLICAR CONTENIDO para aplicar el cambio.';
  });
  document.querySelector('#catalog-items').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const item = catalogDraft.find(
      (entry) => entry.id === (button.dataset.catalogEdit || button.dataset.catalogDelete),
    );
    if (!item) return;
    if (button.dataset.catalogDelete) {
      catalogDraft = catalogDraft.filter((entry) => entry.id !== item.id);
      document.querySelector('#content-catalog').value = JSON.stringify(catalogDraft, null, 2);
      renderCatalogItems();
      document.querySelector('#content-feedback').textContent =
        'Producto retirado del borrador. Pulsa PUBLICAR CONTENIDO para aplicar el cambio.';
      return;
    }
    document.querySelector('#item-id').value = item.id;
    document.querySelector('#item-name').value = item.name;
    document.querySelector('#item-description').value = item.description || '';
    document.querySelector('#item-category').value = item.category;
    document.querySelector('#item-rarity').value = item.rarity;
    document.querySelector('#item-currency').value = item.currency;
    document.querySelector('#item-price').value = item.price;
    document.querySelector('#item-color').value = item.color;
    document.querySelector('#item-ids').value = item.items.join(', ');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.querySelector('#save-content').addEventListener('click', async () => {
    const feedback = document.querySelector('#content-feedback');
    try {
      const catalog = JSON.parse(document.querySelector('#content-catalog').value);
      const roulette = JSON.parse(document.querySelector('#content-roulette').value);
      const maps = JSON.parse(document.querySelector('#content-maps').value);
      catalogDraft = catalog;
      renderCatalogItems();
      if (
        !Array.isArray(catalog) ||
        !catalog.length ||
        catalog.some(
          (item) =>
            !/^[A-Za-z0-9_-]{2,48}$/.test(item.id || '') ||
            !item.name ||
            String(item.name).length > 60 ||
            String(item.description || '').length > 240 ||
            !/^#[0-9a-f]{6}$/i.test(item.color || '') ||
            !Array.isArray(item.items) ||
            item.items.length < 1 ||
            item.items.length > 5 ||
            !['skin', 'weapon', 'bundle'].includes(item.category) ||
            !['coins', 'gems'].includes(item.currency) ||
            !Number.isFinite(Number(item.price)) ||
            Number(item.price) < 0 ||
            item.items.some((id) => !/^(skin|gun)_[A-Za-z0-9_]+$/.test(id)),
        )
      ) {
        throw Error('Revisa IDs, categorías, moneda, precios y artículos del catálogo.');
      }
      if (!roulette.coins || !roulette.gems)
        throw Error('Deben estar configuradas las ruletas de monedas y esmeraldas.');
      for (const [wheelId, wheel] of Object.entries(roulette)) {
        if (
          !wheel?.prizes?.length ||
          !['coins', 'gems'].includes(wheel.currency) ||
          !['coins', 'gems'].includes(wheelId) ||
          wheel.currency !== wheelId ||
          String(wheel.name || '').length > 60 ||
          !Number.isFinite(Number(wheel.price)) ||
          Number(wheel.price) < 0 ||
          wheel.prizes.some(
            (prize) =>
              !Number.isFinite(Number(prize.weight)) ||
              Number(prize.weight) <= 0 ||
              !/^#[0-9a-f]{6}$/i.test(prize.color || '') ||
              String(prize.label || '').length > 60 ||
              !['coins', 'item'].includes(prize.type) ||
              !prize.label ||
              (prize.type === 'item' && !/^(skin|gun)_[A-Za-z0-9_]+$/.test(prize.itemId || '')) ||
              (prize.type === 'coins' &&
                (!Number.isFinite(Number(prize.amount)) || Number(prize.amount) < 0)),
          )
        ) {
          throw Error('Cada ruleta necesita premios válidos y pesos positivos.');
        }
      }
      if (
        !Array.isArray(maps) ||
        !maps.length ||
        !maps.some((map) => map?.mode === 'combat') ||
        !maps.some((map) => map?.mode === 'parkour') ||
        new Set(maps.map((map) => map?.id)).size !== maps.length ||
        maps.some(
          (map) =>
            !map ||
            !/^[A-Za-z0-9_-]{2,48}$/.test(map.id || '') ||
            !String(map.name || '').trim() ||
            String(map.name).length > 60 ||
            !String(map.theme || '').trim() ||
            String(map.theme).length > 100 ||
            !['combat', 'parkour'].includes(map.mode) ||
            !Number.isFinite(Number(map.sky)) ||
            !Number.isFinite(Number(map.floor)) ||
            !Number.isFinite(Number(map.neon)) ||
            [map.sky, map.floor, map.neon].some(
              (color) => Number(color) < 0 || Number(color) > 0xffffff,
            ) ||
            !Number.isFinite(Number(map.fog)) ||
            Number(map.fog) < 0 ||
            Number(map.fog) > 0.1 ||
            !Number.isFinite(Number(map.bounds)) ||
            Number(map.bounds) < 4 ||
            Number(map.bounds) > 100,
        )
      ) {
        throw Error('Revisa IDs, modos, colores y límites de cada mapa.');
      }
      await db.adminSaveContent(currentUser, 'shopItems', catalog);
      await db.adminSaveContent(currentUser, 'roulettes', roulette);
      await db.adminSaveContent(currentUser, 'maps', maps);
      feedback.textContent =
        'Tienda, ruletas y mapas publicados. Las partidas nuevas usarán estos datos.';
    } catch (error) {
      feedback.textContent = error.message || 'El JSON no es válido.';
    }
  });

  async function loadSeason() {
    const season = await db.adminGetContent(currentUser, 'season', SEASON_CONFIG);
    activeSeasonConfig = season;
    document.querySelector('#season-start').value = new Date(
      new Date(season.startsAt).getTime() - new Date(season.startsAt).getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
    document.querySelector('#season-type').value = season.type || 'days';
    document.querySelector('#season-days').value = season.days || 15;
    document.querySelector('#season-reset').value = season.rankResetPercent ?? 40;
  }
  document.querySelector('#season-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = document.querySelector('#season-feedback');
    try {
      const season = {
        ...activeSeasonConfig,
        idPrefix: SEASON_CONFIG.idPrefix,
        startsAt: new Date(document.querySelector('#season-start').value).toISOString(),
        type: document.querySelector('#season-type').value,
        days: Math.max(1, Number(document.querySelector('#season-days').value) || 15),
        rankResetPercent: Math.min(
          90,
          Math.max(0, Number(document.querySelector('#season-reset').value) || 0),
        ),
      };
      await db.adminSaveContent(currentUser, 'season', season);
      feedback.textContent =
        'Calendario guardado. Los perfiles aplican el ciclo y guardan medalla al sincronizarse.';
    } catch (error) {
      feedback.textContent = error.message || 'No se pudo guardar la temporada.';
    }
  });
  document.querySelector('#season-type').addEventListener('change', (event) => {
    document.querySelector('#season-days').disabled = event.target.value === 'month';
  });
  document.querySelector('#force-season').addEventListener('click', async () => {
    const feedback = document.querySelector('#season-feedback');
    if (
      !confirm(
        '¿Cerrar ahora la temporada y abrir la siguiente para todos los jugadores? Sus puntos y medallas se procesan al sincronizar su perfil.',
      )
    )
      return;
    try {
      const season = await db.adminForceSeason(currentUser);
      activeSeasonConfig.currentSeason = season;
      feedback.textContent = `Temporada ${season.number} iniciada. Los jugadores guardarán su medalla y reinicio al volver al juego.`;
      await loadSeason();
    } catch (error) {
      feedback.textContent = error.message || 'No se pudo cambiar la temporada.';
    }
  });
}
