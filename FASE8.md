# Fase 8 — Lobby de agente y directorio admin

## Cambios de esta entrega

- El lobby reutiliza la escena Three.js existente y da más presencia al agente, con silueta low-poly, iluminación de borde y animación sutil.
- El menú muestra jugador, rango, nivel y barra de XP. Los botones principales se conservan y se acomodan para pantallas pequeñas.
- El botón de administración aparece para el rol raíz y para roles con permisos delegados. El directorio devuelve solo los campos de juego requeridos (no documentos completos de cuenta).
- `db.listPlayers()` es el contrato de datos de la pantalla. En Firebase consulta una Cloud Function que vuelve a revisar el permiso `players.read` y filtra los campos de salida.
- El directorio no lee correos, hashes ni credenciales.
- El panel incluye roles personalizados con permisos verificables por Cloud Functions y reglas Firestore; el rol raíz es el único que puede crear roles y asignar admin. También incluye regalos, códigos, catálogo y temporadas.
- Los editores de catálogo y ruletas guardan versiones compartidas en Firestore; la tienda y la ruleta leen el contenido publicado. Se valida el JSON para evitar IDs, precios, premios y colores inválidos.
- La temporada puede configurarse y cerrarse manualmente. Una temporada forzada mantiene el número correlativo; los perfiles procesan medalla y descuento al volver a sincronizarse, sin eliminar su historial.

## Activar el administrador en Firebase

GitHub Pages no puede conceder permisos de administrador de forma segura. El rol debe asignarse desde un entorno confiable con Firebase Admin SDK, nunca desde el navegador ni con reglas abiertas.

1. En Firebase Console habilita Authentication con Email/Password y configura Firestore.
2. Desde PowerShell, abre la carpeta `firebase`, instala `firebase-admin` allí y ejecuta el script privado `npm run seed-admin`. La contraseña se escribe oculta en la terminal. La semilla rechaza una cuenta previa de jugador con ese nombre y conserva progreso de una cuenta admin ya inicializada. Sigue [README.md](README.md) para los pasos completos; la contraseña no va al cliente.
3. Despliega funciones seguras y reglas de Firestore desde la raíz del repositorio con `firebase deploy --config firebase/firebase.json --project ID_DE_TU_PROYECTO --only firestore:rules,functions`. Firebase Functions requiere asociar facturación (plan Blaze); el uso pequeño puede quedar dentro de cuotas gratuitas, pero Google exige una cuenta de facturación.
4. Cierra y vuelve a abrir sesión con `yiyo` para actualizar el token. El botón **ADMIN** aparecerá entonces.
5. Comprueba con una cuenta normal que `admin.html` redirige al lobby. Como admin, prueba primero con una cuenta de prueba, un regalo pequeño y un código de un solo uso.

Para cambiar la contraseña, ejecuta `npm run set-admin-password` dentro de `firebase` con las mismas credenciales privadas del Admin SDK. La propia cuenta admin no puede cambiar su rol desde el panel; para retirarlo, actualiza su custom claim desde un entorno privado de Admin SDK.

## Probar

- Entra al juego como jugador. Comprueba el lobby en escritorio y en una ventana móvil angosta; abre Jugar, perfil y las demás opciones para confirmar que siguen disponibles.
- El jugador normal no debe ver el botón ADMIN y no debe poder mantener el acceso a `admin.html`.
- Con `yiyo` u otro usuario con custom claim admin, abre **ADMIN** y prueba directorio, cambio de rol a una cuenta de prueba, un regalo pequeño, un código de uso único, publicación del catálogo y forzar una nueva temporada.
- En modo local, el panel solo lista cuentas del mismo navegador. El modo local no es una autorización segura para administrar un juego publicado.

## Publicar en GitHub Pages

1. Sube los archivos del proyecto, incluidas las carpetas `css/`, `js/` y `firebase/`, al repositorio.
2. En GitHub abre **Settings → Pages**. En **Build and deployment**, elige **Deploy from a branch**, selecciona la rama publicada (normalmente `main`) y la carpeta `/ (root)`; guarda.
3. Espera la URL que GitHub Pages muestra en esa pantalla y abre la ruta del proyecto. Los HTML usan rutas relativas `./`, así que funcionan también cuando el repositorio se publica bajo una subruta.
4. Configura el dominio de Pages en Firebase Authentication → Settings → Authorized domains. Publica también las reglas de Firestore indicadas arriba.
5. Para cada actualización, conserva la misma rama y raíz, sube los archivos nuevos y espera a que Pages termine la publicación. No borres la base de Firebase: el progreso vive allí, no en los archivos publicados.
6. Si usas Realtime Database para presencia y partidas, crea esa base y publica sus reglas con `firebase deploy --config firebase/firebase.json --project ID_DE_TU_PROYECTO --only database`.

## Alcance pendiente

El panel cambia parámetros de mapas existentes (nombre, modo, colores, niebla, límites y meta), mientras las geometrías especiales siguen en el motor. Baneos y silencios quedan pendientes porque necesitan controles de servidor adicionales. Los cambios de rol, regalos y fin de temporada usan funciones seguras en `firebase/functions/`.
