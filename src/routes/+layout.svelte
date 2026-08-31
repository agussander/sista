<!--
  Layout raíz. Copia de referencia del layout previo a este:
  src/lib/backup/original-root-layout.svelte

  Este archivo nació como layout de "modo mantenimiento": tenía un
  `allowedPrefixes` y todo lo que no estuviera en la lista se reemplazaba por una
  pantalla de "Sitio en mantenimiento". Ese modo nunca llegó a funcionar (ver
  `$lib/tracking.js`) y para cuando se detectó ya habría tapado 52 de las 68
  páginas del sitio, así que se quitó. Hoy todas las páginas se renderizan
  siempre; lo único condicional es la medición.
-->

<script>
	import Footer from '$lib/components/layout/Footer.svelte';
	import Modal from '$lib/components/layout/Modal.svelte';
	import Nav from '$lib/components/layout/nav/Navs/Nav.svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import { mobile, modal, windowX } from '$lib/stores';
	import { SITE_ORIGIN, canonicalUrl, tieneOgPropia, OG_IMAGE_DEFAULT } from '$lib/seo.js';
	import { shouldTrack } from '$lib/tracking.js';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children: _children } = $props();

	// Datos estructurados (JSON-LD) para que Google entienda la marca, la zona de
	// cobertura y los datos de contacto. Ayuda al SEO local y a que se muestre
	// info de la empresa en los resultados de búsqueda.
	const orgSchema = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization',
				'@id': `${SITE_ORIGIN}/#organization`,
				name: 'Sista',
				url: `${SITE_ORIGIN}/`,
				logo: `${SITE_ORIGIN}/images/Sista-logo-violeta.svg`,
				description:
					'Internet por fibra óptica y TV en Ensenada, Punta Lara y Tolosa. Alta velocidad, instalación rápida y soporte local.',
				telephone: '+5492213541906',
				address: {
					'@type': 'PostalAddress',
					streetAddress: 'Av. Almirante Brown 3064',
					addressLocality: 'Punta Lara',
					addressRegion: 'Buenos Aires',
					addressCountry: 'AR'
				},
				areaServed: [
					{ '@type': 'City', name: 'Ensenada' },
					{ '@type': 'City', name: 'Punta Lara' },
					{ '@type': 'City', name: 'Tolosa' }
				],
				sameAs: [
					'https://www.facebook.com/SISTA.internet/',
					'https://www.instagram.com/sista.internet/'
				]
			},
			{
				'@type': 'WebSite',
				'@id': `${SITE_ORIGIN}/#website`,
				url: `${SITE_ORIGIN}/`,
				name: 'Sista',
				publisher: { '@id': `${SITE_ORIGIN}/#organization` }
			}
		]
	};

	const setMobile = () => ($mobile = $windowX < 750);
	// `/puntos` es la pantalla que ve el comercio al escanear el QR de un
	// cliente: un kiosco de un solo boton. El nav y el footer ahi son ruido y
	// obligan a scrollear para llegar al unico control que importa. `/admin`
	// es otro caso de pagina de proposito unico: tiene su propio layout
	// (sidebar + contenido) y el nav/footer publicos no pintan nada ahi.
	// `/lineavip` es el cuadro tarifario de Linea VIP tal cual sale del Excel:
	// reemplaza a la hoja suelta que se publicaba desde Word y se sirve igual,
	// sin nada del sitio alrededor.
	let hideChrome = $derived(
		$page.url.pathname.startsWith('/lineavip') ||
			$page.url.pathname.startsWith('/conectarlaciudad') ||
			$page.url.pathname.startsWith('/tolosano') ||
			$page.url.pathname.startsWith('/mail-banner') ||
			$page.url.pathname.startsWith('/experto-wifi') ||
			$page.url.pathname.startsWith('/puntos') ||
			$page.url.pathname.startsWith('/admin')
	);

	// OJO: `$derived(expr)` evalua la expresion. Si se le pasa una arrow function
	// el valor derivado ES la funcion -siempre truthy- y el `{#if}` nunca es
	// falso. Para envolver un bloque va `$derived.by(() => {...})`. Aca alcanza
	// con la expresion porque `shouldTrack` ya es una funcion pura.
	let trackea = $derived(shouldTrack($page.url?.pathname));

	// URL canonica de la pagina actual. Hace falta porque `sista.ar` y
	// `www.sista.ar` sirven las dos el mismo contenido con 200: sin declarar
	// cual vale, Google elige por su cuenta y puede partir el ranking entre las
	// dos. `canonicalUrl` normaliza a la forma que el sitio realmente sirve
	// (barra final), que es condicion para que Google no lo ignore.
	let canonical = $derived(canonicalUrl($page.url?.pathname));

	// `og:image` de marca por defecto: se emite en toda pagina que no traiga la
	// suya, para que compartir el link por WhatsApp/Instagram/Facebook muestre
	// una tarjeta con la imagen de Sista y no un recorte cualquiera. Las rutas
	// que ya declaran su `og:image` quedan afuera (ver `tieneOgPropia`).
	let ogFallback = $derived(!tieneOgPropia($page.url?.pathname));

	onMount(async () => setMobile());

	// Google Analytics 4 - Función para esperar a que gtag esté disponible
	function waitForGtag() {
		return new Promise((resolve) => {
			if (typeof window.gtag !== 'undefined') {
				resolve();
				return;
			}

			let attempts = 0;
			const maxAttempts = 50; // 5 segundos máximo

			const checkGtag = setInterval(() => {
				attempts++;
				if (typeof window.gtag !== 'undefined') {
					clearInterval(checkGtag);
					resolve();
				} else if (attempts >= maxAttempts) {
					clearInterval(checkGtag);
					resolve(); // Resolver de todas formas para no bloquear
				}
			}, 100);
		});
	}

	// Google Analytics 4 - Tracking de cambios de página
	async function trackPageView(path) {
		if (browser) {
			await waitForGtag();
			if (typeof window.gtag !== 'undefined') {
				window.gtag('config', 'G-KP96BL9H2Q', {
					page_path: path
				});
			}
		}
	}

	// Trackear cambios de página con $effect (solo se ejecuta en el cliente)
	$effect(() => {
		if ($page.url.pathname && browser && trackea) {
			trackPageView($page.url.pathname);
		}
	});
</script>

<svelte:head>
	{#if trackea}
		<!-- URL canónica: sista.ar es el host que vale, no www.sista.ar -->
		<link rel="canonical" href={canonical} />

		<!-- Datos estructurados (Organización + WebSite) -->
		{@html `<script type="application/ld+json">${JSON.stringify(orgSchema)}</script>`}

		<!-- Google Tag Manager -->
		<script>
			(function (w, d, s, l, i) {
				w[l] = w[l] || [];
				w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
				var f = d.getElementsByTagName(s)[0],
					j = d.createElement(s),
					dl = l != 'dataLayer' ? '&l=' + l : '';
				j.async = true;
				j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
				f.parentNode.insertBefore(j, f);
			})(window, document, 'script', 'dataLayer', 'GTM-W3WFBRF7');
		</script>
		<!-- End Google Tag Manager -->

		<!-- Google Analytics 4 -->
		<script>
			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			gtag('js', new Date());
			gtag('config', 'G-KP96BL9H2Q', {
				send_page_view: true
			});
		</script>
		<script async src="https://www.googletagmanager.com/gtag/js?id=G-KP96BL9H2Q"></script>
		<!-- End Google Analytics 4 -->

		<!-- Meta Pixel Code -->
		<script>
			!(function (f, b, e, v, n, t, s) {
				if (f.fbq) return;
				n = f.fbq = function () {
					n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
				};
				if (!f._fbq) f._fbq = n;
				n.push = n;
				n.loaded = !0;
				n.version = '2.0';
				n.queue = [];
				t = b.createElement(e);
				t.async = !0;
				t.src = v;
				s = b.getElementsByTagName(e)[0];
				s.parentNode.insertBefore(t, s);
			})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
			if (!window.__fbqInited) {
				window.__fbqInited = true;
				fbq('init', '1122989162488805');
				fbq('track', 'PageView');
			}
		</script>
		<noscript
			><img
				height="1"
				width="1"
				style="display:none"
				alt=""
				src="https://www.facebook.com/tr?id=1122989162488805&ev=PageView&noscript=1"
		/></noscript>
		<!-- End Meta Pixel Code -->
	{:else}
		<!--
			Rutas internas (ver `$lib/tracking.js`): la página se renderiza normal,
			pero no se mide ni se ofrece a Google. El `noindex` es lo único que se
			conserva de la vieja rama de "modo mantenimiento": /admin es una pantalla
			de login y no tiene por qué aparecer en los resultados de búsqueda.
		-->
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

{#if ogFallback}
	<!--
		`robots={false}`: sin esto `svelte-meta-tags` siempre emite un
		`<meta name="robots" content="index,follow">` que chocaria con el que ya
		pone cada pagina y con el `noindex` de las rutas internas. Este bloque solo
		aporta la imagen: `og:image` + `twitter:card`.
	-->
	<MetaTags
		robots={false}
		openGraph={{
			type: 'website',
			siteName: 'Sista',
			images: [{ url: OG_IMAGE_DEFAULT, width: 2500, height: 1307, alt: 'Sista' }]
		}}
		twitter={{ cardType: 'summary_large_image', image: OG_IMAGE_DEFAULT, imageAlt: 'Sista' }}
	/>
{/if}

<svelte:window bind:innerWidth={$windowX}></svelte:window>

{#if !hideChrome}
	<Nav />
{/if}

{#if $modal && !hideChrome}
	<Modal />
{/if}

{@render _children()}

{#if !hideChrome}
	<Footer />
{/if}

<style>
	@import '$lib/global.css';
</style>
