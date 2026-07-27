<script>
	// TvAvailability.svelte — bloque de "Disponibilidad" al pie de las páginas de
	// servicio (/gigaredplay, /antinaplay). Muestra en qué tiendas se descarga la
	// app + el aviso de incompatibilidad con Magis / Xuper.
	//
	// `stores`: lista de tiendas, p.ej. ['googleplay'] o ['googleplay', 'roku'].
	// `warnMagisXuper`: muestra el aviso "No podés haber tenido Magis ni Xuper".
	let { stores = ['googleplay'], warnMagisXuper = true } = $props();

	const STORES = {
		googleplay: { label: 'Google Play', logo: '/images/tv/google-play-logo.png' },
		roku: { label: 'Roku', logo: '/images/tv/roku-logo.jpg' }
	};

	// Texto "Solo disponible en X" / "X e Y" según las tiendas.
	let storesText = $derived(
		stores
			.map((s) => STORES[s]?.label ?? s)
			.reduce((acc, label, i, arr) => {
				if (i === 0) return label;
				return i === arr.length - 1 ? `${acc} y ${label}` : `${acc}, ${label}`;
			}, '')
	);
</script>

<div class="disponibilidad">
	<h2>Disponibilidad</h2>
	<p class="lead">Solo disponible en {storesText}.</p>

	<div class="stores">
		{#each stores as store (store)}
			{#if STORES[store]}
				<img class="store-logo" src={STORES[store].logo} alt={STORES[store].label} loading="lazy" />
			{/if}
		{/each}
	</div>

	{#if warnMagisXuper}
		<p class="warn">
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18.5A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			No podés haber tenido Magis ni Xuper.
		</p>
	{/if}
</div>

<style>
	.disponibilidad {
		margin: 4em auto 0;
		padding: 3em 1em;
		max-width: 60em;
		text-align: center;
	}
	.disponibilidad h2 {
		color: var(--violeta1);
		font-size: 2em;
		margin: 0 0 0.5em;
		text-transform: uppercase;
	}
	.lead {
		max-width: 36em;
		margin: 0 auto 1.5em;
		color: var(--violeta1);
		font-size: 1.1em;
	}
	.stores {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1.5em 2.5em;
		margin-bottom: 2em;
	}
	.store-logo {
		height: 2.4em;
		width: auto;
		/* Los logos vienen sobre fondo blanco; multiply lo funde con el fondo
		   gris de la página para que no se vea como una caja/botón. */
		mix-blend-mode: multiply;
	}
	.warn {
		display: inline-flex;
		align-items: center;
		gap: 0.5em;
		margin: 0 auto;
		color: var(--magenta);
		font-weight: 600;
		font-size: 1em;
	}
	.warn svg {
		flex-shrink: 0;
		color: var(--magenta);
	}
</style>
