# Mostrar el precio sin impuestos nacionales

**Fecha:** 2026-08-20
**Estado:** aprobado

## Problema

El tarifario (colección `tarifario`, hoja "Tarifas Web" del Excel) ya trae, por
plan, el precio sin impuestos nacionales junto al precio final — hoy solo se
publica en `/tarifas`. El resto del sitio (home, wizard "Elegí tu plan") solo
muestra el precio final, sin ninguna referencia al desglose.

Se pide: un link desde el home hacia `/tarifas`, y un texto chico con el precio
sin impuestos en las tarjetas de plan y en el resumen final del wizard.

## Alcance

Adentro:

- Home ([Price.svelte](../../../src/lib/components/home/Price.svelte)): link
  "Ver precios sin impuestos nacionales" → `/tarifas`, al lado de "Calculá tu
  plan →".
- Home: en cada tarjeta de plan, línea chica "Sin impuestos nacionales: $X"
  debajo del precio.
- Wizard, paso Internet ([Step3Internet.svelte](../../../src/lib/components/elegirplan/steps/Step3Internet.svelte)
  vía [OptionCard.svelte](../../../src/lib/components/elegirplan/OptionCard.svelte)):
  misma línea chica debajo del precio de cada plan.
- Wizard, resumen ([Step6Resumen.svelte](../../../src/lib/components/elegirplan/steps/Step6Resumen.svelte)):
  línea chica con el total mensual sin impuestos, debajo del total con
  impuestos.
- Función pura nueva `sinImpuestosPorCampo(filas)` en
  [mapeoPrecios.js](../../../src/lib/tarifario/mapeoPrecios.js), con su test
  contra el fixture real.

Afuera:

- No se toca la colección `precios` de PocketBase ni su schema.
- No se crea la ruta `/tarifario`: el link apunta a `/tarifas`, que ya existe
  y ya muestra esta columna.
- No se agrega el desglose por ítem en el resumen del wizard, solo el total.
- TV y adicionales (Step4TV, Step5Adicionales) no muestran esta línea — el
  pedido fue específicamente sobre el plan de Internet.
- Sin cambio en el mensaje de WhatsApp (`buildWhatsappUrl`).

## De dónde sale el dato

`tarifasWeb.filas` (poblado por `fetchTarifario()`) trae, por fila, `label`,
`sinImpuestos` y `precioFinal`. Las etiquetas ("HOME F111", "FAST F121", ...)
son las mismas que ya mapea `CAMPOS_POR_ETIQUETA` en `mapeoPrecios.js` para
llevar la pestaña "Precios Mostrador" a los campos de la colección `precios`
(`home`, `fast`, `antina`, `telefono`, ...). Confirmado contra el fixture: la
fila `HOME F111` tiene `sinImpuestos: 20787.0354818`, que es
`precioFinal / 1.21` — la misma alícuota que ya lee (sin usar) `fetchTarifario`.

En vez de recalcular con `21%` fijo, se reutiliza el valor real de la hoja,
igual que hace `/tarifas`: mismo criterio de verdad, un solo lugar que sabe la
alícuota.

**`sinImpuestosPorCampo(filas)`** — nueva función pura en `mapeoPrecios.js`,
hermana de `calcularPrecios()`:

```js
export function sinImpuestosPorCampo(filas) {
	const valores = {};
	const porEtiqueta = new Map();
	for (const fila of Array.isArray(filas) ? filas : []) {
		const clave = normalizar(fila?.label);
		if (clave && !porEtiqueta.has(clave)) porEtiqueta.set(clave, fila);
	}
	for (const [etiqueta, campo] of Object.entries(CAMPOS_POR_ETIQUETA)) {
		const fila = porEtiqueta.get(normalizar(etiqueta));
		if (fila && typeof fila.sinImpuestos === 'number' && Number.isFinite(fila.sinImpuestos) && fila.sinImpuestos > 0) {
			valores[campo] = Math.round(fila.sinImpuestos);
		}
	}
	return valores;
}
```

Sin `avisos` (a diferencia de `calcularPrecios`): esto es un dato decorativo,
no un precio que se publica como oficial. Una etiqueta que falta simplemente
no aparece en el resultado, y el llamador no muestra la línea para ese campo.

## Cómo se consume

Tres puntos de la UI, cada uno con su propio fetch de `fetchTarifario()` — es
data decorativa: si el fetch falla, esa línea chica no se muestra y el resto
de la página sigue funcionando igual que hoy.

**Home (`Price.svelte`):** en el `onMount` que ya trae la colección `precios`,
un fetch adicional de `fetchTarifario()` → `sinImpuestosPorCampo(tarifasWeb.filas)`,
guardado en un `$state` local (`sinImpuestos = $state({})`). Se muestra debajo
de `.figures`, mismo estilo mudo que ya usan `.per` / `.desc`.

**Wizard:** se agrega `sinImpuestos: {}` a `wizard` en
[wizardState.svelte.js](../../../src/lib/components/elegirplan/wizardState.svelte.js).
Se puebla en el `onMount` de
[ElegirPlanWizard.svelte](../../../src/lib/components/elegirplan/ElegirPlanWizard.svelte),
en un fetch separado del que trae `wizard.precios` (no bloquea `wizard.loading`:
si tarda o falla, el wizard funciona igual, solo sin las líneas chicas).

- `Step3Internet.svelte` pasa `wizard.sinImpuestos[plan.key]` a `OptionCard`
  mediante un prop nuevo y genérico, `subPrice` — texto opcional que se
  renderiza chico debajo de `/mes`. Solo se usa desde este paso; TV y
  adicionales no lo pasan.
- `summaryItems(w)` en `data.js` se extiende para que cada ítem lleve también
  `sinImpuestos` (buscado en `w.sinImpuestos`, igual que `value` ya se busca
  en `w.precios`). Nueva función `computeTotalSinImpuestos(w)`, hermana de
  `computeTotal(w)`, que suma los `sinImpuestos` de los ítems no gratuitos.
  `Step6Resumen.svelte` la usa para la línea bajo el total.

## UI

- **Home, links:** junto al link existente "Calculá tu plan →" (clase
  `.calcula-link`), un segundo link "Ver precios sin impuestos nacionales" →
  `/tarifas`, con una variante visual más chica/muted (`.calcula-link--secundario`)
  para no competir con el CTA principal.
- **Home, tarjeta de plan:** `Sin impuestos nacionales: $X` chico (≈0.7rem,
  gris `#9a9a9a`) debajo de `.figures`, junto a `.desc`. Solo si el dato está
  disponible para ese plan.
- **Wizard, `OptionCard`:** el prop `subPrice`, si viene, se renderiza como una
  línea chica adicional dentro del bloque `.price`, debajo de `.per` (mismo
  tamaño/color que `.per`).
- **Wizard, resumen:** un párrafo chico bajo el total (mismo estilo que
  `.consultar-note`, que ya existe en ese componente), con el total mensual
  sin impuestos. Solo se muestra si el total es mayor a 0.

## Casos borde

- Fetch de tarifario falla o no hay registro publicado → las tres ubicaciones
  simplemente no muestran la línea chica (no hay mensaje de error visible;
  ya existe un `console.error` equivalente para el fetch de `precios`, se
  replica el mismo patrón).
- Un plan/campo sin fila mapeada en `tarifasWeb.filas` (etiqueta nueva no
  contemplada en `CAMPOS_POR_ETIQUETA`, o valor `<= 0`) → ese campo no entra
  al resultado de `sinImpuestosPorCampo`, y la línea chica no aparece para ese
  ítem puntual (no bloquea los demás).
- Ítem "gratis" por promo en el resumen (`it.free`) → no suma al total sin
  impuestos, igual que ya no suma a `computeTotal`.
