<script>
	import ElegirPlanWizard from '$lib/components/elegirplan/ElegirPlanWizard.svelte';
	import { MetaTags } from 'svelte-meta-tags';
</script>

<MetaTags
	title="Elegí tu plan · Sista"
	description="Armá tu combo de Internet y TV paso a paso y recibí el detalle por WhatsApp."
	robots="noindex, nofollow"
	openGraph={{
		type: 'website',
		title: 'Elegí tu plan · Sista',
		description: 'Armá tu combo de Internet y TV paso a paso y recibí el detalle por WhatsApp.',
		siteName: 'Sista',
		images: [
			{
				url: 'https://sista.com.ar/images/Og-sista.png',
				width: 2500,
				height: 1307,
				alt: 'Sista'
			}
		]
	}}
	twitter={{
		cardType: 'summary_large_image',
		image: 'https://sista.com.ar/images/Og-sista.png',
		imageAlt: 'Sista'
	}}
/>

<ElegirPlanWizard />
