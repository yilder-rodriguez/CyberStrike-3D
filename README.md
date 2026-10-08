# 🌆 CyberStriker 3D

> Shooter 3D y parkour cyberpunk con sabor callejero colombiano, creado por **YILDER RODRIGUEZ**.

![Three.js](https://img.shields.io/badge/Three.js-3D-black?logo=three.js)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript)
![Hosting](https://img.shields.io/badge/Hosting-GitHub%20Pages-222222?logo=github)

## Modos y sistemas

- **Combate:** partida contra bots y opción online cuando Firebase Realtime Database está conectada.
- **Parkour:** recorrido de saltos, checkpoints, obstáculos y cristales coleccionables.
- **Progreso:** perfil, inventario, colección, rangos, temporadas, tienda y ruletas.
- **Social:** solicitudes de amistad, presencia e invitaciones si Firebase está configurado.
- **Administración:** roles con permisos, directorio, códigos, regalos y gestión de contenido.

El sitio se publica como contenido estático en GitHub Pages. Authentication, progreso compartido y operaciones administrativas requieren el proyecto Firebase que configures.

## Publicar en GitHub Pages

GitHub Pages sirve los HTML, CSS y JavaScript del juego. La autenticación, el progreso compartido y las funciones de administración usan Firebase; Pages por sí solo no ofrece base de datos ni multijugador.

1. Crea un repositorio en GitHub y sube el contenido de esta carpeta a la raíz de la rama que vas a publicar (por ejemplo, `main`). Mantén `index.html`, `css/`, `js/` y `firebase/` en ese nivel.
2. En Firebase Console crea el proyecto, registra una app Web, activa Authentication con Email/Password y crea Firestore. Realtime Database es opcional para presencia, invitaciones y partidas compartidas.
3. Copia los valores de la app Web (`apiKey`, `authDomain`, `databaseURL` si aplica, `projectId`, `appId`) en `js/core/firebase-config.js`. Esos valores Web son públicos; nunca pongas una clave privada de Admin SDK allí.
4. En el repositorio abre **Settings → Pages**. En **Build and deployment** selecciona **Deploy from a branch**, elige `main` (o la rama publicada) y la carpeta `/(root)`, luego pulsa **Save**. Espera la URL y el resultado exitoso en **Actions**.
5. En Firebase Authentication → **Settings → Authorized domains**, agrega el dominio que Pages asignó. Para un repositorio de proyecto suele ser `usuario.github.io`; la URL del juego incluye `/nombre-del-repositorio/`.
6. Abre esa URL y comprueba registro, aceptación de datos y acceso. Las rutas usan `./` para funcionar tanto en el dominio raíz como bajo el subdirectorio del repositorio.

Para probar localmente, ejecuta `python -m http.server 8000` desde la raíz del proyecto y abre `http://localhost:8000`. No abras `index.html` con `file://`, porque los módulos ES necesitan HTTP.

## Firebase: reglas, funciones y administrador

1. Instala Firebase CLI en tu computador, inicia sesión con `firebase login` y desde la raíz ejecuta:

   ```powershell
   firebase deploy --config firebase/firebase.json --project ID_DE_TU_PROYECTO --only firestore:rules,database,functions
   ```

2. Las Cloud Functions usan Admin SDK y requieren asociar facturación al proyecto Firebase (plan Blaze). Revisa las cuotas y presupuestos de Google Cloud antes de desplegarlas.
3. Para crear el usuario `yiyo`, usa el script privado descrito en [firebase/README.md](firebase/README.md). Necesitas el ID de tu proyecto y una clave Admin SDK guardada fuera del repositorio. La semilla pide la contraseña sin mostrarla, asigna el rol raíz y conserva el progreso si se repite sobre esa cuenta.
4. No subas la clave de servicio, `.env` ni contraseñas a GitHub. `.gitignore` excluye esos archivos. Si la contraseña se compartió en un chat, usa una nueva al ejecutar la semilla.

Este espacio de trabajo no tiene configurado un proyecto Firebase ni su credencial privada; por eso la cuenta no se ha creado y no se ha publicado el juego. La contraseña no se guarda en el cliente ni en el repositorio.

## Roles y permisos

El rol raíz crea roles personalizados, selecciona permisos y los asigna. Los claims de Firebase Authentication y las reglas Firestore/Cloud Functions revisan las operaciones privilegiadas. Solo el rol raíz puede crear roles o asignar el rol `admin`. Después de cambiar un rol, la persona debe iniciar sesión de nuevo para renovar sus permisos.

Hay permisos para ver jugadores, asignar roles no raíz, consultar/administrar códigos, enviar regalos, editar el catálogo y gestionar temporadas. Algunas herramientas dependen de permisos de lectura explícitos: regalos y asignación de roles requieren «Ver jugadores»; administración de códigos requiere «Ver códigos».

## Alcance y límites que siguen pendientes

- GitHub Pages solo publica archivos; Firebase debe estar configurado para que cuentas, progreso y juego compartido funcionen entre dispositivos.
- La posición y los disparos online se sincronizan por Firebase Realtime Database, pero todavía no existe un servidor de partida autoritativo ni protección antitrampas competitiva. Los premios de partida se calculan en el cliente.
- El restablecimiento de contraseña por correo no funciona con los correos internos del juego; el responsable puede cambiarla con Admin SDK.
- Antes de abrir el registro al público, completa en la política de datos un canal de contacto real y revisa el tratamiento de datos y menores de edad.
- Baneos y silencios aún no están implementados.

## Actualizar sin perder el progreso

Publica las actualizaciones de archivos en la misma rama y carpeta raíz. No borres el proyecto de Firebase: el progreso compartido vive en Firestore y Authentication. Antes de cambios de esquema, guarda un respaldo/exportación de Firestore. Despliega de nuevo las reglas y funciones cuando cambien. Las migraciones locales son aditivas y no reemplazan los datos existentes.
