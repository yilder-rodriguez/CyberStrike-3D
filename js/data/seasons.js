// Temporada actual: cambia type a 'month' para ciclos de mes calendario.
export const SEASON_CONFIG = {
  idPrefix: 'parche',
  startsAt: '2026-10-07T00:00:00-05:00',
  type: 'days', // 'days' o 'month'
  days: 15,
  rankResetPercent: 40,
};

function addMonths(date, amount) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + amount);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function getSeasonByNumber(number, config = SEASON_CONFIG) {
  const requestedNumber = Math.max(1, Math.floor(Number(number) || 1));
  const override = [
    ...(Array.isArray(config.seasonOverrides) ? config.seasonOverrides : []),
    config.currentSeason,
  ].find((entry) => Number(entry?.number) === requestedNumber);
  if (override) return override;
  if (config.currentSeason && requestedNumber >= Number(config.currentSeason.number)) {
    const elapsedSeasons = requestedNumber - Number(config.currentSeason.number);
    const forcedStart = new Date(config.currentSeason.startsAt);
    const start =
      config.type === 'month'
        ? addMonths(forcedStart, elapsedSeasons)
        : new Date(
            forcedStart.getTime() +
              elapsedSeasons * Math.max(1, Number(config.days) || 15) * 86400000,
          );
    const end =
      config.type === 'month'
        ? addMonths(start, 1)
        : new Date(start.getTime() + Math.max(1, Number(config.days) || 15) * 86400000);
    return {
      id: `${config.idPrefix || SEASON_CONFIG.idPrefix}-${start.toISOString().slice(0, 10).replaceAll('-', '')}`,
      number: requestedNumber,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    };
  }
  const anchor = new Date(config.startsAt);
  const index = requestedNumber - 1;
  let start;
  let end;

  if (config.type === 'month') {
    start = addMonths(anchor, index);
    end = addMonths(anchor, index + 1);
  } else {
    const cycle = Math.max(1, Number(config.days) || 15);
    start = new Date(anchor.getTime() + index * cycle * 86400000);
    end = new Date(start.getTime() + cycle * 86400000);
  }

  const dateId = start.toISOString().slice(0, 10).replaceAll('-', '');
  return {
    id: `${config.idPrefix || SEASON_CONFIG.idPrefix}-${dateId}`,
    number: index + 1,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

export function getCurrentSeason(now = new Date(), config = SEASON_CONFIG) {
  const forced = config.currentSeason;
  if (forced && now >= new Date(forced.startsAt)) {
    const forcedStart = new Date(forced.startsAt);
    const forcedEnd = new Date(forced.endsAt);
    if (now < forcedEnd) return forced;
    let nextStart, nextNumber;
    if (config.type === 'month') {
      nextNumber = forced.number;
      nextStart = forcedStart;
      while (now >= addMonths(nextStart, 1) && nextNumber - forced.number < 1200) {
        nextNumber += 1;
        nextStart = addMonths(nextStart, 1);
      }
    } else {
      const duration = Math.max(1, Number(config.days) || 15) * 86400000;
      const elapsed = Math.floor((now - forcedStart) / duration);
      nextNumber = forced.number + elapsed;
      nextStart = new Date(forcedStart.getTime() + elapsed * duration);
    }
    return getSeasonByNumber(nextNumber, {
      ...config,
      currentSeason: {
        id: `${config.idPrefix || SEASON_CONFIG.idPrefix}-${nextStart.toISOString().slice(0, 10).replaceAll('-', '')}`,
        number: nextNumber,
        startsAt: nextStart.toISOString(),
        endsAt:
          config.type === 'month'
            ? addMonths(nextStart, 1).toISOString()
            : new Date(
                nextStart.getTime() + Math.max(1, Number(config.days) || 15) * 86400000,
              ).toISOString(),
      },
    });
  }
  const anchor = new Date(config.startsAt);
  let index;

  if (config.type === 'month') {
    index = Math.max(
      0,
      (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
        now.getUTCMonth() -
        anchor.getUTCMonth(),
    );
    if (getSeasonByNumber(index + 1, config).startsAt > now.toISOString() && index > 0) index -= 1;
  } else {
    const cycle = Math.max(1, Number(config.days) || 15);
    index = Math.max(0, Math.floor((now - anchor) / (cycle * 86400000)));
  }

  return getSeasonByNumber(index + 1, config);
}
