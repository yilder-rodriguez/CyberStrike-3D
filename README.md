# 🌆 CyberStriker 3D

> **El shooter 3D & parkour cyberpunk con sabor callejero colombiano directamente en tu navegador.**

![Three.js](https://img.shields.io/badge/Three.js-r128+-black?style=for-the-badge&logo=three.js)
![Bootstrap 5](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap)
![JavaScript ES6+](https://img.shields.io/badge/JavaScript-ES6+%20Modules-F7DF1E?style=for-the-badge&logo=javascript)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase)
![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-222222?style=for-the-badge&logo=github)

---

## 👨‍💻 Creador & Desarrollador Principal
**YILDER RODRIGUEZ**  
*Creador, Desarrollador y Diseñador de CyberStriker 3D*

---

## 🎮 Modos de Juego

| Modo | Descripción |
| :--- | :--- |
| 💥 **Modo Combate** | Tiroteos 3D llenos de acción contra otros jugadores en tiempo real o bots adaptativos según tu rango. |
| 🏃 **Modo Parkour** | Carreras de velocidad, saltos y esquive de obstáculos en mapas futuristas con fantasmas/rivales. |

---

## 🔥 Características Destacadas

* **Estética Cyberpunk Neón:** Luces neón, bloom post-procesado, sombras dinámicas y partículas estilizadas con **Three.js**.
* **Economía Dual:**
  * 🪙 **Monedas:** Se ganan jugando, consiguiendo bajas y completando niveles de parkour.
  * 💎 **Esmeraldas (Premium):** Ítems exclusivos y ruleta top mediante eventos y códigos especiales de creador.
* **Sistema de Rangos & Temporadas:**
  * Rangos: *Tonto* ➔ *Medio Tonto* ➔ *Semi Tonto* ➔ *Un Poco Tonto*.
  * Historial por temporada con medallas y recompensas dinámicas en tu perfil.
* **Inventario & Colección 3D:** Equipamiento de skins y ropa (*Parce Galáctico*, *Chaqueta Rolo*, etc.) con previsualización en tiempo real.
* **Ruletas Interactivas:** Ruleta de Monedas y Ruleta de Esmeraldas con efectos de sonido, luces y partículas.
* **Sistema Social:** Lista de amigos en tiempo real, presencia online/offline e invitaciones a partidas.
* **Soporte Multiplataforma (PC / Móvil):** Controles táctiles adaptados con joystick virtual y pantalla completa.
* **Panel de Administración:** Control total sobre usuarios, creación de códigos promocionales, regalos y temporadas.

---

## 🛠️ Arquitectura del Proyecto

```text
CyberStriker-3D/
├── assets/         # Modelos 3D low-poly, texturas, audios y efectos
├── css/            # Estilos neón cyberpunk personalizados
├── js/
│   ├── core/       # Engine Three.js, game loop, input y audio
│   ├── data/       # Configuración (armas, skins, rangos, ruletas)
│   ├── game/       # Modos de juego, mapas, IA de bots y HUD
│   ├── screens/    # Lógica de formularios y pantallas
│   └── services/   # Abstracción de base de datos (Firebase/DB local)
└── index.html      # Entrada principal
