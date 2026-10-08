// Rangos competitivos y umbrales en puntos. Se pueden ajustar sin tocar el motor.
export const RANKS = [
  { id: 'tonto', name: 'Tonto', minPoints: 0, medal: '◆' },
  { id: 'medio-tonto', name: 'Medio Tonto', minPoints: 900, medal: '◇' },
  { id: 'semi-tonto', name: 'Semi Tonto', minPoints: 2200, medal: '⬡' },
  { id: 'un-poco-tonto', name: 'Un Poco Tonto', minPoints: 4500, medal: '✦' },
];

export function rankForPoints(points = 0) {
  return [...RANKS].reverse().find((rank) => points >= rank.minPoints) || RANKS[0];
}
