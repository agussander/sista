<script>
	// Aviso "no es por cable" + modales de compatibilidad ("Mi TV no es smart" /
	// "¿Es compatible mi TV?"). Componente autocontenido y reutilizable entre
	// /tv/elegirtv y el paso de TV del wizard. Maneja su propio estado de modal.
	//
	// `cardsId`: id del contenedor de tarjetas al que scrollea "Ver servicios"
	// (en elegirtv = 'cards', en el wizard = 'tv-cards').
	import InfoModal from './InfoModal.svelte';
	import { WHATSAPP_PHONE } from '$lib/components/elegirplan/data.js';

	let { cardsId = 'cards' } = $props();

	// "Necesito un TV Box" → abre WhatsApp con el mensaje pre-escrito.
	const TV_BOX_WSP = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(
		'Necesito un TV Box'
	)}`;

	let info = $state(null); // 'nosmart' | 'compat' | null

	function goToServices() {
		info = null;
		setTimeout(() => {
			document.getElementById(cardsId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 50);
	}
</script>

<div class="notice">
	<p>
		Estos servicios <strong>no son por cable ni incluyen deco</strong>. Son
		<strong>aplicaciones</strong> que se descargan en tu Smart TV, TV Box, Chromecast, etc.
	</p>
	<div class="notice-actions">
		<button class="btn-secondary btn-sm" onclick={() => (info = 'nosmart')}>Mi TV no es smart</button>
		<button class="btn-secondary btn-sm" onclick={() => (info = 'compat')}>¿Es compatible mi TV?</button>
	</div>
</div>

{#if info === 'nosmart'}
	<InfoModal title="Mi TV no es smart" onclose={() => (info = null)}>
		<p>
			No hay problema. Podés usar un <strong>TV Box</strong>: un aparatito que se enchufa a tu TV por
			HDMI y la convierte en smart, lista para descargar las apps.
		</p>
		<p>Es compatible con los 3 servicios. Escribinos y te ayudamos a conseguir uno.</p>
		<a class="btn-whatsapp btn-full" href={TV_BOX_WSP} target="_blank" rel="noopener noreferrer">
			Necesito un TV Box
		</a>
	</InfoModal>
{:else if info === 'compat'}
	<InfoModal title="¿Es compatible mi TV?" onclose={() => (info = null)}>
		<p>Como cada servicio es una <strong>app</strong>, lo más seguro es probarlo en tu Smart TV:</p>
		<p>
			Buscá la app (<strong>DGO</strong>, <strong>Antina Play</strong> o
			<strong>Gigared Play</strong>) en la tienda de aplicaciones de tu TV, instalala y abrila. Si
			abre bien, es compatible.
		</p>
		<p>Si no aparece en la tienda de tu TV, podés usar un TV Box.</p>
		<button class="btn-secondary btn-full" onclick={goToServices}>Ver servicios</button>
	</InfoModal>
{/if}

<style>
	.notice {
		max-width: 38rem;
		margin: 0 auto 1.5rem;
		background: #f0e7f4;
		border: 1px solid color-mix(in srgb, var(--violeta1) 18%, transparent);
		border-radius: 1rem;
		padding: 1.1rem 1.25rem;
		text-align: center;
	}
	.notice p {
		margin: 0 0 0.85rem;
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--violeta1);
		font-weight: 300;
	}
	.notice strong {
		font-weight: 700;
	}
	.notice-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: center;
	}
</style>
