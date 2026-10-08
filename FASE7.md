# Fase 7 — Amigos, presencia e invitaciones

## Configuración de Firebase

1. Conserva Firebase Authentication (correo/contraseña) y Firestore configurados en `FASE5.md`.
2. En Firebase Console crea Realtime Database y selecciona una región. Copia su URL (`https://<proyecto>-default-rtdb.firebaseio.com` o la URL regional) en `databaseURL` de `js/core/firebase-config.js`.
3. Publica `firebase/firestore.rules` en Firestore → Rules. Estas reglas permiten leer perfiles públicos mínimos (nombre, nivel y rango), solicitudes y amistades; cada jugador solo administra su propia relación.
4. En Realtime Database → Rules, publica el contenido de `firebase/database.rules.json`. Las reglas limitan la presencia a conexiones del propio UID, las invitaciones a identidad autenticada y el movimiento de cada jugador a su propio nodo. Los jugadores autenticados pueden leer la sala para ver rivales.
5. Recarga el juego e inicia sesión. Al autenticarse se crea/actualiza un perfil público mínimo y se activa presencia. No se publica correo, saldo, inventario ni ajustes.

## Uso y límites

- En **Amigos**, busca el nombre exacto. La otra cuenta debe aceptar la solicitud.
- La presencia usa conexiones por pestaña, `onDisconnect` y un latido cada 25 segundos; una presencia sin latido reciente se muestra fuera de línea.
- **Invitar y jugar** envía un llamado que vence a los 3 minutos y abre la sala de combate o parkour. La persona invitada acepta y entra; ambos deben iniciar la partida. Se usa un mapa predeterminado por modo para que coincida la sala.
- Sin Firebase, solicitudes y amistades se guardan localmente en el mismo dispositivo; no se comparten entre amigos. Para amigos en distintos equipos se necesitan Authentication, Firestore y Realtime Database.
- Las invitaciones se envían a UIDs conocidos por la lista de amigos desde el cliente. RTDB autentica quién las envía y quién responde, pero no puede consultar la relación de amistad guardada en Firestore. Para bloquear también el spam malicioso de invitaciones, el envío debe trasladarse a una Cloud Function que verifique esa relación.
- Este emparejamiento muestra jugadores en la misma sala como rivales/fantasmas; no sincroniza autoridad de daño ni protege contra clientes modificados.

## Probar

Crea dos cuentas Firebase en navegadores o dispositivos distintos. Agrega un amigo, acepta la solicitud en la segunda cuenta y confirma que ambas tarjetas muestran rango/nivel y actualizan el estado en línea. Envía invitación a Combate, acepta y entra a la sala desde el segundo dispositivo. Repite con Parkour. Para modo local crea dos cuentas en el mismo navegador y valida el envío/aceptación; la presencia no representa usuarios de otros dispositivos.

Publica el sitio con las rutas relativas de GitHub Pages descritas en `FASE5.md` y no olvides publicar las dos reglas de Firebase.
