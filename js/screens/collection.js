import { auth } from '../services/auth.js';
import { SHOP_ITEMS, RARITY_ORDER } from '../data/shop-items.js';

const account = await auth.current();
if (!account) location.replace('./index.html');
else launchCollection(account);

function launchCollection(user) {
  const items = new Map();
  for (const product of SHOP_ITEMS) {
    for (const itemId of product.items) {
      if (!items.has(itemId)) items.set(itemId, { ...product, id: itemId });
    }
  }
  const allItemIds = new Set(SHOP_ITEMS.flatMap((product) => product.items));
  const owned = Array.isArray(user.inventory) ? user.inventory : [];
  const history = Array.isArray(user.collection)
    ? user.collection.map((record) =>
        typeof record === 'string'
          ? { itemId: record, source: 'legacy', acquiredAt: null }
          : record,
      )
    : [];
  const ownedCatalogCount = [...new Set(owned)].filter((id) => allItemIds.has(id)).length;
  const percentage = allItemIds.size ? Math.floor((ownedCatalogCount / allItemIds.size) * 100) : 0;
  const rarityIndex = (rarity) => Math.max(0, RARITY_ORDER.indexOf(rarity));
  const itemInfo = (id) =>
    items.get(id) || {
      id,
      name: String(id || 'Artículo desconocido').replaceAll('_', ' '),
      category: 'other',
      rarity: 'Sin clasificar',
      color: '#91a098',
    };
  const ranked = history.map((record) => ({ ...record, info: itemInfo(record.itemId) }));
  const rarest = ranked.reduce(
    (best, row) => (rarityIndex(row.info.rarity) > rarityIndex(best?.info.rarity) ? row : best),
    null,
  );
  const last = [...ranked].sort((a, b) => toTime(b.acquiredAt) - toTime(a.acquiredAt))[0];
  document.querySelector('#completion-percent').textContent = `${percentage}%`;
  document.querySelector('#unique-count').textContent = `${ownedCatalogCount} / ${allItemIds.size}`;
  document.querySelector('#record-count').textContent = String(history.length);
  document.querySelector('#best-rarity').textContent = rarest?.info.rarity || '—';
  document.querySelector('#last-acquired').textContent = last ? itemInfo(last.itemId).name : '—';

  const list = document.querySelector('#collection-grid');
  const select = document.querySelector('#source-filter');
  function render() {
    const source = select.value;
    const visible = ranked.filter(
      (record) => source === 'all' || (record.source || 'legacy') === source,
    );
    list.innerHTML = visible.length
      ? visible
          .map((record) => {
            const item = record.info;
            const origin = sourceName(record.source);
            const date = formatDate(record.acquiredAt);
            const extra = record.codeId
              ? ` · ${record.codeId}`
              : record.productId
                ? ` · ${record.productId}`
                : record.level
                  ? ` · NIVEL ${record.level}`
                  : '';
            const icon = item.category === 'weapon' ? '⌁' : item.category === 'skin' ? '◈' : '✦';
            return `<article class="collection-row" style="--item-color:${item.color}"><div class="collection-icon">${icon}</div><div class="collection-info"><h3>${item.name}</h3><p>${item.category === 'weapon' ? 'Arsenal' : item.category === 'skin' ? 'Pinta de operador' : 'Artículo'} · ${item.rarity}</p></div><div class="collection-meta"><strong>${origin}${extra}</strong><span>${date}</span></div></article>`;
          })
          .join('')
      : `<div class="empty-state">${history.length ? 'No hay adquisiciones con ese origen.' : 'Todavía no hay registros. Los artículos que ganes o compres aparecerán aquí.'}</div>`;
  }
  select.addEventListener('change', render);
  render();
}

function toTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const parsed = toTime(value);
  return parsed
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(parsed)
    : 'FECHA SIN REGISTRO';
}

function sourceName(source) {
  return (
    {
      shop: 'MERCADO',
      roulette: 'RULETA',
      level: 'NIVEL',
      code: 'CÓDIGO',
      admin: 'REGALO',
      starter: 'INICIO',
      legacy: 'HISTÓRICO',
    }[source] || 'OTRO'
  );
}
