import { ROULETTES } from '../data/ruletas.js';
import { SHOP_ITEMS } from '../data/shop-items.js';
import { spinRoulette } from '../services/economy.js';
import { db } from '../services/db.js';

export async function openRoulette({ user, body, title, modal, onUserChange }) {
  const rouletteConfig = await db.getGameContent('roulettes', ROULETTES);
  const catalog = await db.getGameContent('shopItems', SHOP_ITEMS);
  const safe = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    );
  title.textContent = 'La Ruleta del Parche';
  let selected = 'coins';
  body.innerHTML = `
    <section class="roulette-view">
      <p class="roulette-kicker">SUERTE DE BARRIO · PREMIOS DIRECTO AL INVENTARIO</p>
      <div class="roulette-picker">${Object.values(rouletteConfig)
        .map(
          (wheel) =>
            `<button class="roulette-choice ${wheel.id === selected ? 'active' : ''}" data-wheel="${safe(wheel.id)}"><span>${wheel.currency === 'gems' ? '💚' : '🪙'}</span><strong>${safe(wheel.name)}</strong><small>${Number(wheel.price)} ${wheel.currency === 'gems' ? 'esmeraldas' : 'monedas'} por giro</small></button>`,
        )
        .join('')}</div>
      <div class="roulette-machine"><div class="roulette-pointer"></div><div class="roulette-wheel" id="roulette-wheel"><div class="roulette-wheel-labels" id="roulette-labels"></div><div class="roulette-core">PARCHE<br><b>★</b></div></div></div>
      <p id="roulette-result" class="roulette-result" aria-live="polite">Elige la ruleta y prueba tu suerte.</p>
      <div class="roulette-actions"><span id="roulette-balance"></span><button id="roulette-spin" class="btn btn-neon">GIRAR LA RULETA</button></div>
      <p class="roulette-odds">Probabilidades públicas: ${Object.values(rouletteConfig)
        .map(
          (wheel) =>
            `${safe(wheel.name)}: ${wheel.prizes.map((p) => `${safe(p.label)} ${p.weight}%`).join(' · ')}`,
        )
        .join(' / ')}</p>
    </section>`;
  const wheelEl = body.querySelector('#roulette-wheel');
  const labelEl = body.querySelector('#roulette-labels');
  const result = body.querySelector('#roulette-result');
  const balance = body.querySelector('#roulette-balance');
  const spinButton = body.querySelector('#roulette-spin');
  let rotation = 0;

  function drawWheel() {
    const wheel = rouletteConfig[selected];
    let offset = 0;
    const segments = wheel.prizes.map((prize) => {
      const start = offset;
      offset += prize.weight;
      return `${prize.color} ${start}% ${offset}%`;
    });
    wheelEl.style.background = `conic-gradient(${segments.join(',')})`;
    labelEl.innerHTML = wheel.prizes
      .map(
        (prize, index) =>
          `<span style="--i:${index};--count:${wheel.prizes.length}">${safe(prize.label)}</span>`,
      )
      .join('');
    const amount = Number(user[wheel.currency]) || 0;
    balance.textContent = `SALDO: ${amount.toLocaleString('es-CO')} ${wheel.currency === 'gems' ? '💚' : '🪙'} · COSTO: ${wheel.price}`;
    spinButton.disabled = amount < wheel.price;
    result.textContent =
      amount < wheel.price
        ? `Te faltan ${wheel.currency === 'gems' ? 'esmeraldas' : 'monedas'} para girar.`
        : 'Elige tu momento.';
  }
  body.querySelectorAll('[data-wheel]').forEach((button) =>
    button.addEventListener('click', () => {
      selected = button.dataset.wheel;
      body
        .querySelectorAll('[data-wheel]')
        .forEach((choice) => choice.classList.toggle('active', choice === button));
      drawWheel();
    }),
  );
  spinButton.addEventListener('click', async () => {
    spinButton.disabled = true;
    result.textContent = 'La suerte está rodando…';
    try {
      const outcome = await spinRoulette(user, selected);
      user = outcome.user;
      const prize = outcome.prize;
      const item = catalog.find((entry) => entry.items.includes(prize.itemId));
      const prizeText =
        prize.type === 'coins'
          ? `${prize.amount} monedas`
          : outcome.duplicateCoins
            ? `${outcome.duplicateCoins} monedas por artículo repetido`
            : item?.name || prize.label;
      const segmentIndex = rouletteConfig[selected].prizes.indexOf(prize);
      const segmentMid =
        rouletteConfig[selected].prizes
          .slice(0, segmentIndex)
          .reduce((sum, entry) => sum + entry.weight, 0) +
        prize.weight / 2;
      rotation += 1440 + (360 - segmentMid * 3.6) - (rotation % 360);
      wheelEl.style.transform = `rotate(${rotation}deg)`;
      await new Promise((resolve) => setTimeout(resolve, 2800));
      result.textContent = `¡Ganaste ${prizeText}!${prize.type === 'item' && !outcome.duplicateCoins ? ' Ya está en inventario y colección.' : ''}`;
      onUserChange?.(user);
      drawWheel();
      spinButton.disabled = false;
      spinButton.textContent = 'GIRAR OTRA VEZ';
    } catch (error) {
      result.textContent = error.message || 'No se pudo completar el giro.';
      drawWheel();
    }
  });
  drawWheel();
  modal.show();
}
