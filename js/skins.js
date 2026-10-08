// --- CONFIGURACIÓN Y CATÁLOGO GLOBAL DE SKINS Y ARMAS 3D ---

const CYBER_SKINS_CATALOG = {
  // SKINS DE ROPA / OPERADOR
  characters: {
    skin_emerald: {
      name: 'Traje Esmeralda Base',
      colorBody: 0x198754,
      colorHead: 0x111827,
      emissiveColor: 0x0a3622,
      roughness: 0.4,
      metalness: 0.6,
      hasShoulderPads: false,
    },
    skin_crimson: {
      name: 'CiberSoldado Carmesí',
      colorBody: 0xdc3545,
      colorHead: 0x212529,
      emissiveColor: 0x842029,
      roughness: 0.2,
      metalness: 0.8,
      hasShoulderPads: true,
    },
    skin_gold: {
      name: 'Vértice Dorado Premium',
      colorBody: 0xffc107,
      colorHead: 0x000000,
      emissiveColor: 0x664d03,
      roughness: 0.1,
      metalness: 0.95,
      hasShoulderPads: true,
    },
    skin_plasma: {
      name: 'Espectro de Plasma Cero',
      colorBody: 0x0dcaf0,
      colorHead: 0x055160,
      emissiveColor: 0x0aa2c0,
      roughness: 0.1,
      metalness: 0.9,
      hasShoulderPads: true,
    },
  },

  // SKINS DE ARMAS
  weapons: {
    gun_green: {
      name: 'Láser Táctico Verde',
      colorGun: 0x374151,
      colorLaser: 0x198754,
      barrelType: 'single', // Cañón sencillo
      length: 1.2,
    },
    gun_red: {
      name: 'Blaster Fuego Carmesí',
      colorGun: 0x111827,
      colorLaser: 0xdc3545,
      barrelType: 'double', // Cañón doble
      length: 1.4,
    },
    gun_blue: {
      name: 'Rifle Cero Absoluto',
      colorGun: 0x055160,
      colorLaser: 0x0dcaf0,
      barrelType: 'heavy', // Rifle pesado de plasma
      length: 1.7,
    },
  },
};

// Obtener Skin de Ropa Activa
function getActiveCharacterSkin() {
  const skinId = localStorage.getItem('equipped_character_skin_id') || 'skin_emerald';
  return CYBER_SKINS_CATALOG.characters[skinId] || CYBER_SKINS_CATALOG.characters['skin_emerald'];
}

// Obtener Skin de Arma Activa
function getActiveWeaponSkin() {
  const weaponId = localStorage.getItem('equipped_weapon_skin_id') || 'gun_green';
  return CYBER_SKINS_CATALOG.weapons[weaponId] || CYBER_SKINS_CATALOG.weapons['gun_green'];
}
