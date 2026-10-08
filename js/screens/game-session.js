// Guarda de sesión, identidad y ajustes persistentes en la partida.
import { auth } from '../services/auth.js';
import { joinMatch } from '../game/multiplayer.js';
import { firebaseConfig, firebaseReady } from '../core/firebase-config.js';
import { awardMatch, ensureProgress, penalizeQuit } from '../services/progression.js';
import { db } from '../services/db.js';
let user = await auth.current();
if (!user) {
  location.replace('./index.html');
} else {
  user = await ensureProgress(user);
  const configuredMaps = await db.getGameContent('maps', window.CYBER_MAPS || []);
  window.CYBER_SET_MAPS?.(configuredMaps);
  window.CYBER_PLAYER_NAME = user.username;
  window.CYBER_EQUIPPED_SKIN = user.equipped?.skin || 'skin_emerald';
  window.CYBER_EQUIPPED_WEAPON = user.equipped?.weapon || 'gun_green';
  window.CYBER_USER_ID = user.uid;
  window.CYBER_RANK_POINTS = Number(user.rankPoints || 0);
  window.CYBER_SENSITIVITY = Number(user.settings?.sensitivity || 1);
  window.CYBER_REDUCED_EFFECTS = Boolean(user.settings?.reducedEffects);
  window.CYBER_ONLINE_READY = Boolean(firebaseReady && firebaseConfig.databaseURL);
  const matchType = document.querySelector('#match-type');
  const onlineOption = matchType.querySelector('option[value="online"]');
  onlineOption.disabled = !window.CYBER_ONLINE_READY;
  onlineOption.textContent = window.CYBER_ONLINE_READY
    ? 'ONLINE / RIVALES REALES'
    : 'ONLINE / CONFIGURA FIREBASE RTDB';
  const matchHint = document.querySelector('#network-status');
  matchHint.textContent = window.CYBER_ONLINE_READY
    ? 'Elige bots o rivales online antes de iniciar.'
    : 'MODO ONLINE DESACTIVADO · BOTS LISTOS';
  matchType.addEventListener('change', () => {
    matchHint.textContent = matchType.value === 'online'
      ? 'Se conectará a la sala del mismo modo y mapa.'
      : 'Partida local contra bots.';
  });
  window.CYBER_GAME_READY = true;
  let start = document.querySelector('#start-btn');
  start.disabled = false;
  start.innerHTML = 'EMPEZAR LA VUELTA <span>↗</span>';
  if (new URLSearchParams(location.search).get('mode') === 'parkour') {
    document.querySelector('#parkour-hud-details').classList.remove('d-none');
    document.querySelector('.hud-readout').style.display = 'none';
    document.querySelector('.hud-stats span:first-child').firstChild.textContent = 'TIEMPO ';
    document.querySelector('.hud-stats span:last-child').style.display = 'none';
    document.querySelector('#touch-fire').style.display = 'none';
    document.querySelector('#touch-dash').style.display = 'inline-grid';
    document.querySelector('#control-hint').textContent =
      'WASD para correr · Espacio para saltar · Mantén Shift para impulso · Cruza checkpoints';
  }
  const quality = user.settings?.quality || 'auto',
    renderer = window.CYBER_RENDERER,
    dpr = Math.min(devicePixelRatio, 1.7),
    factor = quality === 'low' ? 0.8 : quality === 'medium' ? 1 : quality === 'high' ? 1.7 : dpr;
  if (renderer) {
    renderer.setPixelRatio(Math.min(factor, dpr));
    renderer.shadowMap.enabled = quality !== 'low' && !window.CYBER_REDUCED_EFFECTS;
    renderer.setSize(innerWidth, innerHeight);
  }
  document.querySelector('#game-quality').value = quality;
  document.querySelector('#game-effects').checked = window.CYBER_REDUCED_EFFECTS;
  const settingsModal = new bootstrap.Modal(document.querySelector('#game-settings'));
  document.querySelector('#pause-settings').onclick = () => settingsModal.show();
  document.querySelector('#game-settings-save').onclick = async () => {
    user.settings = {
      ...(user.settings || {}),
      quality: document.querySelector('#game-quality').value,
      reducedEffects: document.querySelector('#game-effects').checked,
    };
    await auth.updateProfile(user);
    window.CYBER_REDUCED_EFFECTS = user.settings.reducedEffects;
    let q = user.settings.quality,
      r = window.CYBER_RENDERER,
      d = Math.min(devicePixelRatio, 1.7),
      f = q === 'low' ? 0.8 : q === 'medium' ? 1 : q === 'high' ? 1.7 : d;
    r.setPixelRatio(Math.min(f, d));
    r.shadowMap.enabled = q !== 'low' && !user.settings.reducedEffects;
    r.setSize(innerWidth, innerHeight);
    settingsModal.hide();
  };
  window.CYBER_HANDLE_RESULT = async (result) => {
    const reward = await awardMatch(user, result);
    user = reward.user;
    window.CYBER_RANK_POINTS = user.rankPoints;
    const feedback = document.querySelector('#end-copy');
    document.querySelector('#final-rank-change').textContent = `${reward.rankChange >= 0 ? '+' : ''}${reward.rankChange} · ahora ${user.rankPoints} pts`;
    feedback.textContent += ` ${reward.won ? 'VICTORIA' : 'VUELTA CERRADA'} · ${reward.rankChange >= 0 ? '+' : ''}${reward.rankChange} puntos · +${reward.xpEarned} XP · +${reward.coinsEarned + reward.bonusCoins} monedas`;
    if (reward.gifts.length) {
      feedback.textContent += ` · regalo nivel ${reward.gifts.map((gift) => gift.level).join(', ')}`;
    }
    return reward;
  };
  window.CYBER_HANDLE_QUIT = async () => {
    user = await penalizeQuit(user);
    window.CYBER_RANK_POINTS = user.rankPoints;
    return user;
  };
}
window.CYBER_MATCHING = {
  join: async (mode, mapId, onRoster) => {
    if (!firebaseReady || !firebaseConfig.databaseURL) throw Error('LOCAL / BOTS ACTIVOS');
    return joinMatch({ user, mode, mapId, onRoster });
  },
};
document.querySelector('#orientation-btn')?.addEventListener('click', async () => {
  try {
    await document.documentElement.requestFullscreen();
    await screen.orientation?.lock?.('landscape');
  } catch {
    document.querySelector('#portrait-note small').textContent =
      'Gira el celular manualmente para continuar.';
  }
});
