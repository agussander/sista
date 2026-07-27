<script>
	// ChannelSearch.svelte — Input de búsqueda de canales + disponibilidad por
	// servicio. Presentación pura: la búsqueda la resuelve `tvRecomendador.js` y
	// los resultados llegan por props.
	//
	// `onGrilla(key)` abre la grilla completa de un servicio (la usa el aviso de
	// "no encontramos ese canal", por si está con otro nombre).
	import { TV_SERVICES } from './tvData.js';

	let { value = $bindable(''), resultados = [], sinCoincidencias = false, onGrilla } = $props();

	// Cuántos canales se listan por servicio antes de resumir en "y N más".
	const TOPE_VISIBLE = 3;

	let activo = $derived(value.trim().length >= 2);

	const logoDe = (key) => TV_SERVICES.find((s) => s.key === key)?.logo;
</script>

<fieldset>
	<legend>¿Te interesa algún canal en especial?</legend>

	<input
		type="search"
		class="input"
		bind:value
		placeholder="Ej: ESPN, Disney, HBO…"
		aria-label="Buscar un canal"
	/>

	{#if activo && sinCoincidencias}
		<div class="vacio">
			<p>No encontramos <strong>{value.trim()}</strong> en ninguna de las 3 grillas. Puede estar con otro nombre:</p>
			<div class="vacio-links">
				{#each TV_SERVICES as s (s.key)}
					<button type="button" class="link" onclick={() => onGrilla?.(s.key)}>
						Ver grilla de {s.label}
					</button>
				{/each}
			</div>
		</div>
	{:else if activo}
		<ul class="resultados">
			{#each resultados as r (r.key)}
				<li class:no={!r.disponible}>
					<img class="serv-logo" src={logoDe(r.key)} alt="" />
					<span class="serv-body">
						<span class="serv-top">
							<span class="serv-name">{r.label}</span>
							<span class="mark" aria-hidden="true">{r.disponible ? '✓' : '✗'}</span>
							<span class="sr-only">{r.disponible ? 'disponible' : 'no disponible'}</span>
						</span>
						{#if r.disponible}
							<span class="canales">
								{r.matches.slice(0, TOPE_VISIBLE).map((m) => m.nombre).join(' · ')}
								{#if r.matches.length > TOPE_VISIBLE}
									<span class="mas">y {r.matches.length - TOPE_VISIBLE} más</span>
								{/if}
							</span>
							{#if r.soloAdicional}
								<span class="chip-addon">con adicional {r.matches[0].addonLabel}</span>
							{/if}
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</fieldset>

<style>
	fieldset {
		border: none;
		padding: 0;
		margin: 0 0 1.1rem;
	}
	legend {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--violeta1);
		padding: 0;
		margin-bottom: 0.55rem;
	}
	.input {
		width: 100%;
		background: #fff;
		border: 2px solid #ececec;
		border-radius: 0.7rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.9rem;
		font-family: inherit;
		color: var(--violeta1);
	}
	.input:focus {
		outline: none;
		border-color: var(--violeta1);
	}
	.input::placeholder {
		color: #b9b9b9;
		font-weight: 300;
	}

	.resultados {
		list-style: none;
		margin: 0.7rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.resultados li {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: #fff;
		border: 1px solid #ececec;
		border-radius: 0.7rem;
		padding: 0.55rem 0.7rem;
	}
	.resultados li.no {
		opacity: 0.6;
	}
	.serv-logo {
		flex-shrink: 0;
		width: 1.7rem;
		height: 1.7rem;
		object-fit: contain;
	}
	.serv-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.serv-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.serv-name {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--violeta1);
	}
	.mark {
		font-weight: 700;
		font-size: 0.85rem;
		color: #1ba37a;
	}
	.no .mark {
		color: #b9b9b9;
	}
	.canales {
		font-size: 0.76rem;
		line-height: 1.3;
		color: #6b6b6b;
		font-weight: 300;
	}
	.mas {
		color: #9a9a9a;
		font-style: italic;
	}
	.chip-addon {
		align-self: flex-start;
		margin-top: 0.15rem;
		background: #f0e7f4;
		color: var(--violeta1);
		font-size: 0.66rem;
		font-weight: 700;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
	}

	.vacio {
		margin-top: 0.7rem;
		background: #fff;
		border: 1px solid #ececec;
		border-radius: 0.7rem;
		padding: 0.7rem 0.8rem;
	}
	.vacio p {
		margin: 0 0 0.4rem;
		font-size: 0.8rem;
		line-height: 1.35;
		color: #6b6b6b;
		font-weight: 300;
	}
	.vacio-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.link {
		background: none;
		border: none;
		padding: 0;
		width: auto;
		font-size: 0.78rem;
		font-weight: 600;
		color: #9a6cb0;
		text-decoration: underline;
		cursor: pointer;
	}
	.link:hover {
		color: var(--violeta1);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}
</style>
