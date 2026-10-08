# Firebase para CyberStriker 3D

El frontend usa modo local mientras los campos de `js/core/firebase-config.js` estén vacíos. Los valores de configuración Web identifican tu app y son públicos; jamás pongas claves privadas en ese archivo.

## Preparar autenticación y datos

1. En Firebase Console crea un proyecto y registra una aplicación Web.
2. Ve a **Authentication → Sign-in method** y habilita **Email/Password**.
3. Ve a **Firestore Database → Create database** y crea la base. Despliega las reglas y funciones con el comando de `README.md`. Las reglas protegen perfiles y validan permisos por custom claims.
4. En **Project settings → General → Your apps**, copia `apiKey`, `authDomain`, `projectId` y `appId` en `js/core/firebase-config.js`. No incluyas una clave de cuenta de servicio.
5. Registra una cuenta desde el juego para confirmar que el proveedor quedó activo.

El nombre se asocia internamente con `nombre@players.cyberstriker.invalid`; no hace falta que el jugador tenga correo electrónico. Firebase Authentication administra las contraseñas. El restablecimiento por correo no está disponible porque esa dirección es interna y no recibe mensajes. Para cambiar una contraseña olvidada, el responsable debe usar Admin SDK para actualizarla; no compartas la clave por chat.

## Datos personales antes de abrir el registro

El registro requiere aceptación expresa, sin casilla premarcada, de `tratamiento-datos.html`; el perfil guarda la versión y fecha de aceptación. Revisa esa política antes de publicar y configura un correo real del responsable para solicitudes de consulta, corrección, revocación y supresión. Actualmente ese canal de contacto está pendiente: no abras el registro público hasta añadirlo. Si actualizas sustancialmente la política, cambia `DATA_POLICY_VERSION` en `js/services/privacy.js` y coordina una nueva aceptación.

## Crear el administrador inicial

El script de semilla nunca contiene una contraseña. Descarga una clave de servicio solo a tu computador seguro. No la agregues al repositorio ni la compartas. Desde PowerShell, entra a esta carpeta y ejecuta:

```powershell
npm install
$env:GCLOUD_PROJECT = "ID_DE_TU_PROYECTO"
$env:GOOGLE_APPLICATION_CREDENTIALS = "RUTA_LOCAL\clave-de-servicio.json"
npm run seed-admin
Remove-Item Env:GCLOUD_PROJECT
Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
```

El script solicita la contraseña sin mostrarla en pantalla y exige mínimo 12 caracteres. Firebase Authentication administra la contraseña; no se guarda en Firestore. Si la cuenta ya fue inicializada como admin, la semilla permite rotar la contraseña sin reiniciar progreso. Se niega a convertir una cuenta preexistente de jugador en admin. Para cambiarla después, ejecuta `npm run set-admin-password`; se revocan las sesiones previas. Nunca guardes el JSON de servicio dentro del proyecto.

## Desplegar las herramientas privilegiadas del panel

Los cambios de rol, regalos y cierre de temporada se ejecutan en Cloud Functions con Admin SDK; nunca reciben una clave de servicio en el navegador. Para desplegarlas, instala Firebase CLI en tu entorno y, desde la raíz del repositorio, ejecuta:

```powershell
firebase deploy --config firebase/firebase.json --project ID_DE_TU_PROYECTO --only firestore:rules,functions
```

Functions requiere asociar una cuenta de facturación al proyecto (plan Blaze). Revisa el panel de uso y presupuestos de Google Cloud aunque el uso pequeño pueda entrar en cuotas gratuitas. Si no despliegas las funciones, el directorio y gestión de códigos aún requieren reglas publicadas, pero los cambios de rol, regalos y fin de temporada mostrarán error del servicio faltante.

La colección `gameContent` guarda catálogo, ruletas, mapas y calendario. Las escrituras requieren el permiso `content.manage`. Si activas Realtime Database, crea la instancia y despliega sus reglas con `firebase deploy --config firebase/firebase.json --project ID_DE_TU_PROYECTO --only database`. No guardes credenciales de administrador ni claves de servicio en GitHub Pages.

## GitHub Pages

1. Sube la carpeta completa del juego a la raíz de un repositorio de GitHub. Conserva `index.html`, `css/`, `js/` y `firebase/` en sus rutas actuales.
2. En el repositorio abre **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**.
4. Selecciona tu rama principal (por ejemplo, `main`) y carpeta `/(root)`; pulsa **Save**.
5. Espera a que el despliegue aparezca como exitoso en **Actions**. Abre la URL mostrada en Pages.

Esta app usa rutas relativas, así que funciona tanto en `usuario.github.io` como en `usuario.github.io/nombre-del-repo/`. Los módulos ES necesitan un servidor HTTP: para probar antes de publicar, sirve la carpeta localmente en vez de abrir el HTML como archivo. Bootstrap, fuentes, Three.js y Firebase se cargan por CDN y necesitan internet.

El progreso sin conexión se conserva en una cola local y se reintenta al abrir el juego conectado con la misma cuenta. Las reglas limitan incrementos por actualización, pero el juego aún calcula las recompensas en el cliente; para impedir trampas competitivas hace falta mover el cálculo a Cloud Functions, que puede requerir activar facturación.

## Datos de fase 4

Rangos, XP, regalos y calendario están en `js/data/ranks.js`, `js/data/levels.js` y `js/data/seasons.js`. El ciclo inicial dura 15 días; cambia `type` a `month` para usar meses calendario. Elige la cadencia antes de iniciar el ciclo: cambiarla a mitad de temporada requiere migrar el número de temporada de las cuentas. La migración local de esquema conserva las propiedades actuales y solo añade campos nuevos. Si amplías niveles por encima del 20, actualiza también el límite de `level` en `firestore.rules` antes de publicar.

## Rivales en línea (opcional)

Para que las partidas compartan posición de jugadores, en Firebase Console crea una **Realtime Database** y pega su URL en `databaseURL` de `js/core/firebase-config.js`. Publica `firebase/database.rules.json` (también es la ruta incluida en `firebase/firebase.json`). Solo cuentas autenticadas pueden leer la sala; cada cuenta solo puede escribir su propio jugador. Las salas se separan por modo y mapa, y la presencia se elimina al desconectarse. Sin esta base configurada, el juego usa bots.

La sincronización de disparos es una primera versión controlada por el cliente; no debe usarse para torneos o saldos competitivos hasta añadir validación autoritativa en servidor.
