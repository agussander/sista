<!--
  MODO MANTENIMIENTO ACTIVO

  Layout anterior (Nav, Footer, GTM/GA, Meta, etc.):
  src/lib/backup/original-root-layout.svelte

  Restaurar: copia el contenido de ese archivo sobre este +layout.svelte
  (no uses nombre +layout.backup en routes: SvelteKit lo reserva).
-->

<script>
	import Footer from '$lib/components/layout/Footer.svelte';
	import Modal from '$lib/components/layout/Modal.svelte';
	import Nav from '$lib/components/layout/nav/Navs/Nav.svelte';
	import { mobile, modal, windowX } from '$lib/stores';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children: _children } = $props();

	const allowedPrefixes = [
		'/',
		'/tv',
		'/precios',
		'/formasdepago',
		'/acerca-de',
		'/dgo',
		'/antinaplay',
		'/gigaredplay',
		'/whatsapp',
		'/experto-wifi',
		'/elegirplan'
	];

	const setMobile = () => ($mobile = $windowX < 750);
	let hideChrome = $derived(
		$page.url.pathname.startsWith('/conectarlaciudad') ||
			$page.url.pathname.startsWith('/tolosano') ||
			$page.url.pathname.startsWith('/mail-banner') ||
			$page.url.pathname.startsWith('/experto-wifi')
	);

	let isAllowedPath = $derived(() => {
		const path = $page.url?.pathname ?? '/';
		if (path === '/') return true;
		return allowedPrefixes.some((p) => p !== '/' && (path === p || path.startsWith(`${p}/`)));
	});

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
		if ($page.url.pathname && browser && isAllowedPath) {
			trackPageView($page.url.pathname);
		}
	});
</script>

<svelte:head>
	{#if isAllowedPath}
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
		<title>Sista · Sitio en mantenimiento</title>
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<svelte:window bind:innerWidth={$windowX}></svelte:window>

{#if isAllowedPath}
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
{:else}
	<div class="mantenimiento">
		<div class="mantenimiento__inner">
			<img
				class="mantenimiento__logo"
				src="/images/Sista-logo-violeta.svg"
				alt="Sista"
				width="200"
				height="auto"
			/>
			<h1 class="mantenimiento__titulo">Sitio en mantenimiento</h1>
			<p class="mantenimiento__texto">
				Estamos trabajando para mejorar el sitio. Mientras tanto, podés ver la info comercial y
				comunicarte por WhatsApp.
			</p>

			<div class="mantenimiento__cta">
				<a class="mantenimiento__btn mantenimiento__btn--primary" href="/whatsapp">Hablar por WhatsApp</a>
				<div class="mantenimiento__links">
					<a href="/tv">TV</a>
					<a href="/precios">Precios</a>
					<a href="/formasdepago">Formas de pago</a>
					<a href="/acerca-de">Sobre nosotros</a>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@import '$lib/global.css';

	.mantenimiento {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		background: linear-gradient(
			160deg,
			var(--background) 0%,
			rgb(245, 240, 250) 45%,
			rgb(255, 248, 252) 100%
		);
	}

	.mantenimiento__inner {
		max-width: 28rem;
		text-align: center;
	}

	.mantenimiento__logo {
		display: block;
		margin: 0 auto 2rem;
		max-width: min(220px, 70vw);
		height: auto;
	}

	.mantenimiento__titulo {
		margin: 0 0 1rem;
		font-size: clamp(1.5rem, 4vw, 2rem);
		line-height: 1.2;
	}

	.mantenimiento__texto {
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.5;
		color: var(--violeta1);
		opacity: 0.92;
	}

	.mantenimiento__cta {
		margin-top: 1.5rem;
		display: grid;
		gap: 1rem;
		justify-items: center;
	}

	.mantenimiento__btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.85rem 1.1rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--violeta1) 25%, transparent);
		text-decoration: none;
		font-weight: 700;
	}

	.mantenimiento__btn--primary {
		background: var(--magenta);
		color: white;
		border-color: transparent;
	}

	.mantenimiento__btn--primary:hover {
		opacity: 0.9;
	}

	.mantenimiento__links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem 1.1rem;
		justify-content: center;
	}

	.mantenimiento__links a {
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
