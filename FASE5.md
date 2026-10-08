# CyberStrike 3D — Fase 5

## Economía y tienda

El catálogo y las probabilidades editables están en `js/data/shop-items.js` y `js/data/ruletas.js`. Compras y giros locales se guardan en el perfil de este dispositivo. La tienda no contiene saldos ni códigos gratuitos de demostración. Las esmeraldas no se agregan como recompensa de partidas.

La ruleta usa pesos configurados en el catálogo. Como GitHub Pages ejecuta JavaScript en el navegador, la selección de ruleta y los precios de artículos todavía no son autoridad de servidor; una persona técnica puede alterar el cliente. Para economía competitiva hace falta trasladar compras y giros a Cloud Functions/servidor, lo cual se deja como límite explícito de esta fase. Firestore sí valida el canje de códigos y el contador de usos.

## Preparar Firebase para códigos

1. Abre Firebase Console y crea/selecciona el proyecto. Habilita Authentication con correo/contraseña y crea una base Firestore en producción.
2. Copia los valores de la app web a `js/core/firebase-config.js`. Publicar la configuración web en GitHub está previsto por Firebase; nunca publiques una clave privada de Admin SDK.
3. Publica las reglas de `firebase/firestore.rules` desde Firebase Console (Firestore → Rules) o Firebase CLI.
4. Una cuenta con custom claim `role: "admin"` crea documentos `codes/{CODIGO}` con `active` (boolean), `uses` (0), `maxUses` (entero), `expiresAt` (Timestamp futuro) y `reward` (`coins` entero, `gems` entero, `items` arreglo de IDs del catálogo; máximo 3).
5. El jugador canjea el código desde Mercado → Códigos. La transacción incrementa usos y otorga el premio una sola vez por jugador. La regla limita monedas otorgadas por una actualización de perfil a 3.500; crea premios de monedas dentro de ese límite. Las gemas solo se elevan dentro de una transacción válida de código.
6. No asignes custom claims editando el perfil desde el navegador. Una función administrativa confiable/Admin SDK debe otorgar el claim. El panel para administrar códigos llega en la Fase 8.

## Probar esta fase

Abre `tienda.html` desde Live Server. Regístrate o inicia sesión: las cuentas nuevas reciben dos artículos iniciales. Entra a una partida para ganar monedas y compra un artículo del catálogo. En el menú abre Ruleta, elige el giro de monedas y confirma que el saldo se actualiza. El giro con gemas debe estar deshabilitado sin saldo. Con Firebase, configura un código de prueba y canjéalo una vez; vuelve a intentarlo y verifica el rechazo. Comprueba el inventario/colección desde su pantalla cuando esté implementada en la Fase 6.

Para publicar en GitHub Pages: sube los archivos a la rama `main`, ve a Settings → Pages, elige `Deploy from a branch`, `main` y `/ (root)`, y guarda. Usa enlaces relativos (`./...`) para que funcione en un repositorio de proyecto, por ejemplo `https://usuario.github.io/nombre-repo/`. Espera a que Pages indique el despliegue y abre la ruta pública. Tras actualizar, publica los mismos archivos; el versionado y las migraciones aditivas de perfiles están en `js/services/db.js`.
