<script>
	import { SITE_ORIGIN } from '$lib/seo.js';
	import { goto } from '$app/navigation';
	import { MetaTags } from 'svelte-meta-tags';
	import StepHeader from '$lib/components/elegirplan/StepHeader.svelte';
	import OptionCard from '$lib/components/elegirplan/OptionCard.svelte';
</script>

<MetaTags
	title="Quiero tener TV · Sista"
	description="Contanos si ya tenés internet de Sista y te llevamos al lugar correcto para sumar TV."
	robots="noindex, nofollow"
	openGraph={{
		type: 'website',
		images: [
			{
				url: `${SITE_ORIGIN}/images/tv/tv-meta-img.png`,
				width: 600,
				height: 600,
				alt: 'TV de Sista'
			}
		]
	}}
	twitter={{
		cardType: 'summary',
		image: `${SITE_ORIGIN}/images/tv/tv-meta-img.png`,
		imageAlt: 'TV de Sista'
	}}
/>

<section class="chooser-section">
	<div class="card">
		<StepHeader
			title="¿Querés sumar TV?"
			subtitle="Contanos tu situación y te llevamos al lugar correcto."
		/>

		<div class="cards">
			<OptionCard
				title="Ya tengo internet de Sista"
				subtitle="Elegí tu servicio de TV"
				showCheck={false}
				onclick={() => goto('/tv/elegirtv')}
			/>
			<OptionCard
				title="No tengo internet de Sista"
				subtitle="Armá tu plan de Internet + TV"
				showCheck={false}
				onclick={() => goto('/elegirplan?tipo=tv&paso=promo')}
			/>
		</div>
	</div>
</section>

<style>
	.chooser-section {
		display: flex;
		justify-content: center;
		/* padding-top alto para no quedar tapado por el nav flotante (position:fixed, top:1em) */
		padding: 6.5rem 1rem 2rem;
		background: linear-gradient(170deg, #faf8fb 0%, var(--background) 60%);
	}
	.card {
		width: 100%;
		max-width: 30rem;
		background: #fff;
		border-radius: 1.4rem;
		padding: 1.5rem 1.4rem 1.75rem;
		box-shadow: 0 10px 40px rgba(102, 37, 124, 0.1);
	}
	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
</style>
