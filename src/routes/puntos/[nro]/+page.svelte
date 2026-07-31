<script>
	// Pantalla que ve el comercio al escanear el QR de un cliente.
	//
	// El boton NO persiste nada a proposito: esta prueba valida el circuito
	// camara -> API -> nombre, y definir el esquema de la operacion obligaria a
	// decidir antes el modelo de puntos.
	let { data } = $props();

	let sumado = $state(false);
</script>

<svelte:head>
	<title>Sumar puntos · Sista</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="puntos">
	{#if data.estado === 'ok'}
		{#if sumado}
			<p class="puntos__hecho">¡Listo!</p>
			<p class="puntos__sub">Puntos sumados a {data.nombre}</p>
		{:else}
			<p class="puntos__sub">Sumar puntos a</p>
			<h1 class="puntos__nombre">{data.nombre}</h1>
			<button class="puntos__btn" onclick={() => (sumado = true)}>Sumar puntos</button>
		{/if}
	{:else if data.estado === 'no_encontrado'}
		<p class="puntos__error">
			{#if data.nro}
				No encontramos el cliente {data.nro}
			{:else}
				No encontramos ese cliente
			{/if}
		</p>
	{:else}
		<p class="puntos__error">No pudimos consultar el sistema. Probá de nuevo.</p>
	{/if}
</main>

<style>
	.puntos {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1.5rem;
		text-align: center;
		background: var(--background);
		color: var(--text);
	}

	.puntos__sub {
		margin: 0;
		font-size: 1.125rem;
		opacity: 0.75;
	}

	.puntos__nombre {
		margin: 0;
		font-size: 2rem;
		line-height: 1.15;
		font-weight: 700;
		text-wrap: balance;
	}

	.puntos__hecho {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
	}

	.puntos__btn {
		margin-top: 1.5rem;
		padding: 1rem 2.5rem;
		border: none;
		border-radius: 999px;
		background: var(--text);
		color: var(--background);
		font: inherit;
		font-size: 1.125rem;
		font-weight: 600;
		cursor: pointer;
	}

	.puntos__btn:active {
		transform: scale(0.98);
	}

	.puntos__error {
		margin: 0;
		font-size: 1.25rem;
		text-wrap: balance;
	}
</style>
