// Compra, ruleta y canje pasan por un solo servicio de economía.
import { ROULETTES } from '../data/ruletas.js';
import { SHOP_ITEMS } from '../data/shop-items.js';
import { db } from './db.js';

const balance = (user, currency) => Math.max(0, Number(user[currency]) || 0);
const ownsAll = (user, item) => item.items.every((id) => user.inventory.includes(id));

function addToCollection(user, itemId, source, extra = {}) {
  if (user.inventory.includes(itemId)) return false;
  user.inventory.push(itemId);
  user.collection.push({
    itemId,
    source,
    ...extra,
    acquiredAt: new Date().toISOString(),
  });
  return true;
}

export async function purchaseItem(user, itemId) {
  const catalog = await db.getGameContent('shopItems', SHOP_ITEMS);
  const item = catalog.find((entry) => entry.id === itemId);
  if (!item) throw Error('No encontramos ese artículo en el catálogo.');
  if (ownsAll(user, item)) throw Error('Ya tienes todo este artículo.');
  if (balance(user, item.currency) < item.price) {
    throw Error(item.currency === 'gems' ? 'Te faltan esmeraldas.' : 'Te faltan monedas.');
  }

  const updated = {
    ...user,
    inventory: [...(user.inventory || [])],
    collection: [...(user.collection || [])],
  };
  updated[item.currency] = balance(updated, item.currency) - item.price;
  const addedItems = item.items.filter((id) =>
    addToCollection(updated, id, 'shop', { productId: item.id }),
  );
  await db.saveEconomy(updated);
  return { user: updated, item, addedItems };
}

function secureRoll(totalWeight) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] / 0x100000000) * totalWeight;
}

function drawPrize(prizes) {
  const totalWeight = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  let remaining = secureRoll(totalWeight);
  return prizes.find((prize) => (remaining -= prize.weight) < 0) || prizes.at(-1);
}

export async function spinRoulette(user, rouletteId) {
  const rouletteConfig = await db.getGameContent('roulettes', ROULETTES);
  const catalog = await db.getGameContent('shopItems', SHOP_ITEMS);
  const roulette = rouletteConfig[rouletteId];
  if (!roulette) throw Error('Esta ruleta no está disponible.');
  if (balance(user, roulette.currency) < roulette.price) {
    throw Error(roulette.currency === 'gems' ? 'Te faltan esmeraldas.' : 'Te faltan monedas.');
  }

  const prize = drawPrize(roulette.prizes);
  const updated = {
    ...user,
    [roulette.currency]: balance(user, roulette.currency) - roulette.price,
    coins: balance(user, 'coins'),
    gems: balance(user, 'gems'),
    inventory: [...(user.inventory || [])],
    collection: [...(user.collection || [])],
  };
  const wasAdded =
    prize.type === 'item' && addToCollection(updated, prize.itemId, 'roulette', { rouletteId });
  let duplicateCoins = 0;

  if (prize.type === 'coins') updated.coins += prize.amount;
  if (prize.type === 'item' && !wasAdded) {
    duplicateCoins = rouletteId === 'gems' ? 120 : 60;
    updated.coins += duplicateCoins;
  }

  await db.saveEconomy(updated);
  const item = catalog.find((entry) => entry.items.includes(prize.itemId));
  return { user: updated, roulette, prize, item, duplicateCoins };
}

export async function redeemCode(user, code) {
  const updated = await db.redeemCode(user, code);
  const previousInventory = new Set(user.inventory || []);
  const newItems = updated.inventory.filter((itemId) => !previousInventory.has(itemId));
  return {
    user: updated,
    newItems,
    coins: updated.coins - balance(user, 'coins'),
    gems: updated.gems - balance(user, 'gems'),
  };
}
