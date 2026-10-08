import { LEVELS } from '../data/levels.js';
import { RANKS, rankForPoints } from '../data/ranks.js';
import { getCurrentSeason, SEASON_CONFIG } from '../data/seasons.js';
import { getLevelProgress } from '../services/progression.js';
import { db } from '../services/db.js';

const escapeHtml = (value) =>
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

export async function openProfile({ user, body, title, modal }) {
  const currentRank = rankForPoints(user.rankPoints);
  const nextRank = RANKS.find((rank) => rank.minPoints > user.rankPoints);
  const seasonConfig = await db.getGameContent('season', SEASON_CONFIG);
  const currentSeason = getCurrentSeason(new Date(), seasonConfig);
  const levelProgress = getLevelProgress(user);
  const nextLevel = LEVELS[user.level + 1];
  const history = [...(user.seasonHistory || [])].reverse();
  const seasonEnd = new Date(currentSeason.endsAt).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const rankWidth = nextRank
    ? Math.min(
        100,
        ((user.rankPoints - currentRank.minPoints) / (nextRank.minPoints - currentRank.minPoints)) *
          100,
      )
    : 100;
  const seasonRows = history.length
    ? history
        .map(
          (entry) => `
            <div class="col-12 col-sm-6">
              <article class="season-medal">
                <span class="medal-mark" aria-hidden="true">${escapeHtml(entry.medal || '◆')}</span>
                <div><strong>${escapeHtml(entry.seasonId)}</strong>
                  <small>${escapeHtml(entry.rankName || 'Tonto')} · ${Number(entry.points) || 0} pts</small>
                </div>
              </article>
            </div>`,
        )
        .join('')
    : '<div class="col-12"><p class="profile-empty">Al cerrar la primera temporada aparecerá aquí tu medalla.</p></div>';

  title.textContent = 'Tu perfil del parche';
  body.innerHTML = `
    <div class="profile-overview row g-3">
      <section class="col-12 col-md-6">
        <div class="profile-card rank-card">
          <span class="profile-kicker">RANGO DE TEMPORADA</span>
          <h3>${escapeHtml(currentRank.name)}</h3>
          <p>${Number(user.rankPoints) || 0} puntos${nextRank ? ` · faltan ${nextRank.minPoints - user.rankPoints} para ${escapeHtml(nextRank.name)}` : ' · rango máximo'}</p>
          <div class="progress cyber-progress" role="progressbar" aria-label="Progreso al siguiente rango" aria-valuenow="${Math.round(rankWidth)}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width:${rankWidth}%"></div>
          </div>
        </div>
      </section>
      <section class="col-12 col-md-6">
        <div class="profile-card level-card">
          <span class="profile-kicker">NIVEL ${user.level} / ${LEVELS.length - 1}</span>
          <h3>${Number(user.xp) || 0} <small>XP</small></h3>
          <p>${nextLevel ? `${levelProgress.currentXp} / ${levelProgress.neededXp} XP para el nivel ${nextLevel.level}` : 'Nivel máximo alcanzado'}</p>
          <div class="progress cyber-progress" role="progressbar" aria-label="Progreso del nivel" aria-valuenow="${Math.round(levelProgress.percent)}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width:${levelProgress.percent}%"></div>
          </div>
        </div>
      </section>
    </div>
    <div class="profile-meta row g-2 mt-2">
      <div class="col-12 col-sm-6"><div class="profile-stat"><span>JUGADOR</span><b>${escapeHtml(user.username)}</b></div></div>
      <div class="col-12 col-sm-6"><div class="profile-stat"><span>MONEDAS</span><b>${Number(user.coins || 0).toLocaleString('es-CO')}</b></div></div>
      <div class="col-12"><div class="season-banner"><span>TEMPORADA ${currentSeason.number}</span><b>cierra el ${seasonEnd}</b><small>Al cierre se guarda tu medalla y se descuentan ${seasonConfig.rankResetPercent}% de puntos.</small></div></div>
    </div>
    <section class="season-history mt-4">
      <div class="history-heading"><h3>MEDALLAS DEL PARCHE</h3><span>${history.length} temporadas cerradas</span></div>
      <div class="row g-2">${seasonRows}</div>
    </section>`;
  modal.show();
}
