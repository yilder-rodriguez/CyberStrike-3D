# Fase 6 — Casillero y colección

## Datos guardados

El perfil guarda `inventory` con los identificadores de artículos, `equipped` con los espacios `skin` y `weapon`, y `collection` con el identificador, origen y fecha de obtención. El esquema local sube a versión 4 mediante migración aditiva: conserva objetos del perfil, prepara el equipo inicial y copia artículos antiguos que no tenían historial con origen `legacy`. No se elimina ningún artículo ni registro.

Los nuevos perfiles reciben dos artículos de inicio registrados en la bitácora. Equipar solo acepta artículos que ya están en el inventario; las reglas de Firestore comprueban además que la pinta sea de tipo `skin_` y el arma de tipo `gun_`.

## Probar

1. Inicia sesión y abre **Inventario** desde el menú. Deben aparecer los artículos disponibles.
2. Equipa y desequipa traje y arma. Recarga la página y confirma que el equipo permanece seleccionado.
3. Compra o gana un artículo y revisa que aparece en **Colección** con origen y fecha.
4. Usa el filtro de origen, y comprueba que el porcentaje cambia según las piezas únicas del catálogo que tienes.
5. Para Firebase, publica las reglas actualizadas en `firebase/firestore.rules` antes de probar el guardado de equipo.

Las pantallas usan rutas relativas, así que se publican en la raíz del mismo repositorio GitHub Pages indicado en `FASE5.md`.
