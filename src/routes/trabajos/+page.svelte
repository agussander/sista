<script>
	import { MetaTags } from 'svelte-meta-tags';
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0; url=/trabajaconnosotros" />
</svelte:head>

<!--
	`/trabajos` es solo un redirect a `/trabajaconnosotros` (el `meta refresh` de
	arriba). Pero los crawlers de Instagram/Facebook/WhatsApp no siguen ese
	redirect: leen esta pagina tal cual. Sin estas etiquetas la compartian sin
	titulo ni descripcion, y la `og:image` la pone el layout (ver `tieneOgPropia`).
-->
<MetaTags
	title="Trabajá con nosotros · Sista"
	description="Llená el formulario y aplicá para alguna de nuestras vacantes de trabajo."
	openGraph={{
		title: 'Trabajá con nosotros · Sista',
		description: 'Llená el formulario y aplicá para alguna de nuestras vacantes de trabajo.'
	}}
/>
