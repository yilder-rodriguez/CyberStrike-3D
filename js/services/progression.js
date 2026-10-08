// Progreso y premios centralizados para perfil, menú y partidas.
import { LEVELS } from '../data/levels.js';
import { RANKS, rankForPoints } from '../data/ranks.js';
import { getCurrentSeason, getSeasonByNumber, SEASON_CONFIG } from '../data/seasons.js';
import { db } from './db.js';

export function migrateProgress(user) {
  const migrated = { ...user };
  migrated.progressionVersion = Math.max(4, Number(user.progressionVersion) || 0);
  migrated.level = Math.max(0, Number(user.level) || 0);
  migrated.xp = Math.max(0, Number(user.xp) || 0);
  migrated.rankPoints = Math.max(0, Number(user.rankPoints) || 0);
  migrated.matchesLost = Math.max(0, Number(user.matchesLost) || 0);
  migrated.quitCount = Math.max(0, Number(user.quitCount) || 0);
  migrated.seasonHistory = Array.isArray(user.seasonHistory)
    ? user.seasonHistory
    : Array.isArray(user.rankHistory)
      ? user.rankHistory
      : [];
  migrated.seasonId = user.seasonId || null;
  migrated.seasonNumber = Math.max(0, Number(user.seasonNumber) || 0);
  migrated.seasonHighestRank = user.seasonHighestRank || rankForPoints(migrated.rankPoints).id;
  migrated.coins = Math.max(0, Number(user.coins) || 0);
  migrated.inventory = Array.isArray(user.inventory) ? [...user.inventory] : [];
  migrated.collection = Array.isArray(user.collection) ? [...user.collection] : [];
  return migrated;
}

function getSeasonProgress(user, now = new Date(), seasonConfig = SEASON_CONFIG) {
  const current = getCurrentSeason(now, seasonConfig);
  let changed = false;

  if (user.seasonId !== current.id) {
    if (user.seasonId && user.seasonNumber) {
      for (let number = user.seasonNumber; number < current.number; number += 1) {
        const closingSeason = getSeasonByNumber(number, seasonConfig);
        const oldRank =
          RANKS.find((rank) => rank.id === user.seasonHighestRank) ||
          rankForPoints(user.rankPoints);
        user.seasonHistory.push({
          seasonId: closingSeason.id,
          rankId: oldRank.id,
          rankName: oldRank.name,
          medal: oldRank.medal,
          points: user.rankPoints,
          closedAt: closingSeason.endsAt,
        });
        user.rankPoints = Math.floor(user.rankPoints * (1 - seasonConfig.rankResetPercent / 100));
        user.seasonHighestRank = rankForPoints(user.rankPoints).id;
      }
    }
    user.seasonId = current.id;
    user.seasonNumber = current.number;
    user.seasonHighestRank = rankForPoints(user.rankPoints).id;
    changed = true;
  }

  return { current, changed };
}

export async function ensureProgress(user) {
  const migrated = migrateProgress(user);
  const seasonConfig = await db.getGameContent('season', SEASON_CONFIG);
  const { changed: seasonChanged } = getSeasonProgress(migrated, new Date(), seasonConfig);
  const changed = seasonChanged || migrated.progressionVersion !== user.progressionVersion;
  migrated.progressionVersion = 4;

  if (changed) {
    await db.saveProgression(migrated);
    await db.syncPublicProfile(migrated).catch(() => {});
  }
  return migrated;
}

function awardLevelGift(user, level) {
  const gift = LEVELS[level]?.gift;
  if (!gift) return null;
  user.coins += gift.coins || 0;
  if (gift.item) {
    if (user.inventory.includes(gift.item)) {
      user.coins += 25;
    } else {
      user.inventory.push(gift.item);
      user.collection = Array.isArray(user.collection) ? user.collection : [];
      user.collection.push({
        itemId: gift.item,
        source: 'level',
        level,
        acquiredAt: new Date().toISOString(),
      });
    }
  }
  return gift;
}

export async function awardMatch(user, result) {
  const progressed = await ensureProgress(user);
  const won = Boolean(result.won);
  const completed = result.mode === 'parkour' && won;
  const xpEarned = Math.min(
    600,
    result.mode === 'parkour'
      ? completed
        ? Math.max(40, 180 - Math.floor(Number(result.seconds || 0) * 3))
        : 5
      : Math.max(10, Math.floor(Number(result.score || 0) * 2) + Number(result.wave || 1) * 5),
  );
  const coinsEarned =
    result.mode === 'parkour'
      ? completed
        ? Math.max(20, 80 - Math.floor(Number(result.seconds || 0) / 4))
        : 2
      : Math.max(3, Math.floor(Number(result.score || 0) / 5) + Number(result.wave || 1));
  const rankReward = Math.min(
    150,
    result.mode === 'parkour'
      ? completed
        ? 25
        : 0
      : Math.max(2, Math.floor(Number(result.score || 0) / 10)),
  );

  const pointsBefore = progressed.rankPoints;
  const rankDelta = won ? rankReward : -10;
  progressed.rankPoints = Math.max(0, progressed.rankPoints + rankDelta);
  if (!won) progressed.matchesLost += 1;
  progressed.xp += xpEarned;
  progressed.coins += coinsEarned;
  const coinsBeforeLevelGifts = progressed.coins;
  const gifts = [];

  while (
    progressed.level < LEVELS.length - 1 &&
    progressed.xp >= LEVELS[progressed.level + 1].xpRequired
  ) {
    progressed.level += 1;
    const gift = awardLevelGift(progressed, progressed.level);
    if (gift) gifts.push({ level: progressed.level, ...gift });
  }

  const rank = rankForPoints(progressed.rankPoints);
  const highest = RANKS.find((item) => item.id === progressed.seasonHighestRank);
  if (!highest || rank.minPoints > highest.minPoints) {
    progressed.seasonHighestRank = rank.id;
  }

  await db.saveProgression(progressed);
  await db.syncPublicProfile(progressed).catch(() => {});
  return {
    user: progressed,
    xpEarned,
    coinsEarned,
    bonusCoins: progressed.coins - coinsBeforeLevelGifts,
    rankEarned: rankReward,
    rankChange: progressed.rankPoints - pointsBefore,
    won,
    gifts,
  };
}

export async function penalizeQuit(user) {
  const progressed = await ensureProgress(user);
  progressed.rankPoints = Math.max(0, progressed.rankPoints - 30);
  progressed.quitCount += 1;
  await db.saveProgression(progressed);
  await db.syncPublicProfile(progressed).catch(() => {});
  return progressed;
}

export function getLevelProgress(user) {
  const current = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, user.level || 0))];
  const next = LEVELS[current.level + 1];
  if (!next) return { currentXp: current.xpRequired, neededXp: current.xpRequired, percent: 100 };
  const currentXp = Math.max(0, user.xp - current.xpRequired);
  const neededXp = next.xpRequired - current.xpRequired;
  return { currentXp, neededXp, percent: Math.min(100, (currentXp / neededXp) * 100) };
}
