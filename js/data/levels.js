// XP acumulada y regalos por nivel (0–20). Las gemas no se entregan jugando.
const thresholds = [
  0, 50, 120, 210, 320, 450, 600, 770, 960, 1170, 1400, 1650, 1920, 2210, 2520, 2850, 3200, 3570,
  3960, 4370, 4800,
];

const gifts = [
  // El traje base skin_emerald ya se entrega al crear la cuenta.
  { coins: 0, item: 'skin_emerald' },
  { coins: 35, item: null },
  { coins: 50, item: null },
  { coins: 65, item: 'skin_crimson' },
  { coins: 80, item: null },
  { coins: 100, item: 'gun_red' },
  { coins: 120, item: null },
  { coins: 145, item: null },
  { coins: 170, item: 'skin_plasma' },
  { coins: 200, item: null },
  { coins: 230, item: 'gun_blue' },
  { coins: 260, item: null },
  { coins: 290, item: null },
  { coins: 330, item: 'skin_gold' },
  { coins: 370, item: null },
  { coins: 410, item: null },
  { coins: 460, item: null },
  { coins: 510, item: null },
  { coins: 570, item: null },
  { coins: 640, item: null },
  { coins: 750, item: 'gun_blue' },
];

export const LEVELS = thresholds.map((xpRequired, level) => ({
  level,
  xpRequired,
  gift: gifts[level],
}));
