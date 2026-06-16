# Diseño — Grilla de canales Gigared Play Full

Fecha: 2026-06-16

## Objetivo

Reemplazar la imagen estática (`/images/tv/grilla-gigaplay.png`) en la página
`/gigaredplay` por una grilla de canales real e interactiva del grupo
**GIGARED PLAY FULL**, replicando el patrón de la grilla de DGO
(`ChannelGrid` + tabs por categoría + logos).

## Alcance

- **Solo** el grupo "GIGARED PLAY FULL" (no Básico, Premium, Pack Plus ni Pack Fútbol).
- Lista de canales basada en la grilla de **CABA / Buenos Aires** (77 canales).
- Reutilizar el componente `ChannelGrid` existente (enfoque A).
- Tema oscuro (como DGO) con acento de marca **#b74d8d**.

Fuera de alcance: cambios en la grilla de DGO, otros grupos de Gigared, selección
de ciudad dinámica.

## Fuente de datos

- URL: `https://www.gigared.com.ar/grilla` con cookie `ubicacion=buenosaires`.
- La grilla se renderiza en el servidor según la cookie `ubicacion`.
- Grupo objetivo: `<div id="gigaredplay" class="cuadro_senales">` → título "GIGARED PLAY FULL".
- Markup por canal:
  ```html
  <li class="li20">
    <div title="NOMBRE" style="background:url('https://www.gigared.com.ar/admin/uploads/canales/ARCHIVO.png?v=...')"></div>
    <p>NUMERO</p>   <!-- a veces class="hd" -->
  </li>
  ```
- Se extrae: `title` (nombre/slug), URL del logo y número de canal.

## Componentes y archivos

### 1. `ChannelGrid.svelte` (generalizar tema)

`src/lib/components/features/ChannelGrid.svelte` ya soporta categorías con tabs
**y** lista plana. El único cambio: hacer configurable el color de acento.

- Agregar prop `accent = '#ff6b00'` (default = naranja DGO, retrocompatible).
- Aplicar el acento via variable CSS inline en `.channel-grid`:
  `style="--dgo-accent: {accent}"`.
- La ruta de DGO no pasa `accent` → sigue naranja sin cambios.

### 2. Datos: `src/lib/data/gigaredplay-channels.json`

Mismo shape que `dgo-channels.json`: array de `{ categoria, nombre, url_logo }`.

- `categoria`: derivada del número de canal (ver tabla abajo).
- `nombre`: nombre de display limpio (ver "Nombres de display").
- `url_logo`: `/images/gigaredplay/<archivo>` (logo local).
- Orden: por número de canal (igual que en la fuente). El orden de aparición de
  cada categoría define el orden de los tabs.

### 3. Logos: `static/images/gigaredplay/`

- Descargar los 77 logos desde el CDN de Gigared.
- Nombres ascii-safe: renombrar los que tienen caracteres especiales
  (`cnn-español.png` → `cnn-espanol.png`, `a&e.png` → `a-e.png`, `espn+.png` →
  `espn-plus.png`). El resto conserva su nombre original.

### 4. Página: `src/routes/gigaredplay/+page.svelte`

- Importar `ChannelGrid` y `gigaredplay-channels.json`.
- Reemplazar el bloque `.grilla-container` (la `<img>` estática) por
  `<ChannelGrid channels={gigaredplayChannels} accent="#b74d8d" />`.
- Ajustar el texto intro para mencionar que es la grilla del plan **Gigared Play Full**.
- Mantener intactas las secciones "Dispositivos compatibles" y el CTA de WhatsApp.

## Categorías (derivadas del número de canal)

Los números mapean a géneros de forma consistente:

| Rango      | Categoría               |
|------------|-------------------------|
| < 200      | Aire y Noticias         |
| 200–299    | Deportes                |
| 300–399    | Infantiles              |
| 400–599    | Cine y Series           |
| 600–699    | Documentales y Estilo   |
| 700–799    | Internacionales         |
| 800–899    | Música                  |

## Nombres de display

Muchos `title` vienen como slugs (`america`, `c5n`, `foxsports2`, `tvpublica`,
`fx`, `C M`). Se limpian a nombres prolijos mediante:

1. Un mapa de overrides para los casos que no se resuelven bien con title-case
   (ej.: `c5n` → "C5N", `tvpublica` → "TV Pública", `foxsports2` → "Fox Sports 2",
   `C M` → "CM", `a24` → "A24", `tve` → "TVE", `ln` → "LN+", `e` → "E!",
   `24` → "Canal 24h", `usaNetworks`/`syfy` → "Syfy", `tlc` → "TLC", `axn` → "AXN").
2. Title-case para el resto.

Los nombres ya legibles ("Disney Channel", "Nat Geo", "Discovery Channel", etc.)
se respetan tal cual.

## Generación de datos

Script ad-hoc (Python, en `/tmp` — no se commitea) que:

1. Descarga la grilla con `Cookie: ubicacion=buenosaires`.
2. Parsea el grupo `#gigaredplay`.
3. Para cada canal: calcula `categoria` (por número), `nombre` (limpio) y
   descarga el logo a `static/images/gigaredplay/` con nombre ascii-safe.
4. Escribe `src/lib/data/gigaredplay-channels.json`.

Al repo solo se commitea el resultado (JSON + imágenes), igual que la data de DGO.

## Verificación

- Los 77 logos descargan sin 404 y existen en `static/images/gigaredplay/`.
- `gigaredplay-channels.json` es JSON válido, 77 entradas, todas con categoría
  asignada y `url_logo` apuntando a un archivo existente.
- `npm run build` pasa sin errores.
- (Nota: el preview MCP no funciona en este entorno por TCC sobre `~/Documents`,
  así que la verificación visual final la confirma el usuario en `npm run dev`.)
