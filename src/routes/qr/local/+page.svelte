<script>
	// Botonera simple para el QR del local: acceso directo a información,
	// contacto por WhatsApp y portal de clientes.
	const WSP_URL =
		'https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista.';
	const CLIENTES_URL = 'https://clientes.sista.com.ar';
</script>

<svelte:head>
	<title>Sista · Bienvenido</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="qr-local">
	<div class="botonera">
		<a href="/" class="btn-qr">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
			Información
		</a>

		<a href={WSP_URL} target="_blank" rel="noopener noreferrer" class="btn-qr">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
			Hablar por WhatsApp
		</a>

		<a href={CLIENTES_URL} target="_blank" rel="noopener noreferrer" class="btn-qr">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
			Clientes
		</a>
	</div>
</main>

<style>
	.qr-local {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: var(--background);
	}
	.botonera {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: 100%;
		max-width: 22rem;
	}
	.btn-qr {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: var(--btn-padding-md);
		font-size: var(--btn-font-md);
		font-weight: 600;
		border: none;
		border-radius: 0.9rem;
		background: #fff;
		color: var(--violeta1);
		box-shadow: 0 0.35em 0.9em rgba(0, 0, 0, 0.12);
	}
	.btn-qr svg {
		flex-shrink: 0;
	}
	.btn-qr:hover {
		opacity: 1;
		transform: translateY(-2px);
		box-shadow: 0 0.5em 1.2em rgba(0, 0, 0, 0.18);
	}
</style>
