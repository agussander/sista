<script>
	import { MetaTags } from 'svelte-meta-tags';
	import { onMount } from 'svelte';

	const WHATSAPP_URL = 'https://wa.me/5492213541906?text=Hola%2C%20quiero%20evaluar%20mi%20hogar%20con%20Experto%20WiFi';

	const problemas = [
		'Se corta el internet siempre que estoy en el dormitorio',
		'El piso de arriba no agarra ni para WhatsApp',
		'Cuando se conectan todos en casa, no anda nada',
		'Probé con repetidores y no se notó la diferencia'
	];

	const causas = [
		{
			titulo: 'La ubicación del módem',
			texto: 'Donde lo deja la empresa de internet es donde le conviene a ellos para la instalación, no donde mejor cubre tu casa.'
		},
		{
			titulo: 'Los materiales de las paredes',
			texto: 'El hormigón armado, las losas y algunas placas con metal bloquean la señal mucho más de lo que parece.'
		},
		{
			titulo: 'La interferencia con redes vecinas',
			texto: 'En edificios y zonas densas, decenas de redes compiten por los mismos canales. Tu router muchas veces no elige bien.'
		},
		{
			titulo: 'Demasiados dispositivos al mismo tiempo',
			texto: 'Un router doméstico estándar empieza a fallar cuando hay muchos dispositivos conectados simultáneamente, aunque la velocidad contratada sea alta.'
		}
	];

	/* const casos = [
		{
			titulo: 'Casa de dos plantas',
			problema: 'El piso de arriba se quedaba sin señal. Había que bajar para hablar por videollamada.',
			resultado: 'Identificamos dónde se perdía la señal y ajustamos la cobertura. Hoy hay señal pareja en toda la casa, incluido el patio.',
			cita: 'Pensé que tenía que cambiar de proveedor. Resultó que el problema era otro.',
			img: 'Casa de dos plantas en corte estilo casa de muñecas, ondas WiFi'
		},
		{
			titulo: 'Departamento con home office',
			problema: 'Las reuniones se cortaban siempre en el dormitorio convertido en oficina.',
			resultado: 'Diseñamos una solución específica para esa zona. Cero cortes desde la primera semana.',
			cita: 'No sabía que era tan distinto trabajar con buen WiFi.',
			img: 'Departamento en planta, oficina marcada con cobertura'
		},
		{
			titulo: 'Casa con oficina al fondo',
			problema: 'El WiFi llegaba a la cocina pero ni cerca del quincho. La oficina del fondo no funcionaba.',
			resultado: 'Llevamos la cobertura desde la casa hasta la oficina externa, sin perder velocidad.',
			cita: 'Ahora trabajo desde el fondo como si estuviera al lado del módem.',
			img: 'Casa con quincho/oficina externa al fondo, cobertura extendida'
		}
	]; */

	const faqs = [
		{
			q: '¿Cuánto cuesta la evaluación?',
			a: 'La evaluación tiene un costo de $40.000. Si decidís continuar, ese valor se descuenta del total de productos y servicios que coticemos.'
		},
		{
			q: '¿Cuánto tarda el diagnóstico?',
			a: 'Entre 45 minutos y una hora, dependiendo del tamaño de la casa.'
		},
		{
			q: '¿Qué medimos exactamente?',
			a: 'Cobertura real ambiente por ambiente, velocidad efectiva, interferencias con redes vecinas, calidad de señal y comportamiento bajo uso simultáneo de varios dispositivos.'
		},
		{
			q: '¿Sirve para departamentos?',
			a: 'Sí. Trabajamos en casas, departamentos, oficinas y locales. Cada caso tiene su propio diseño.'
		},
		{
			q: '¿Y si después no quiero seguir adelante?',
			a: 'Te quedás con el diagnóstico y el presupuesto, sin compromiso. La información que levantamos es tuya.'
		},
		{
			q: '¿En qué zonas trabajan?',
			a: 'Ensenada, Punta Lara, Tolosa y alrededores. Consultanos por tu zona específica.'
		}
	];

	let openFaq = $state(0);
	let sliderPos = $state(50);
	let sliderEl = $state();
	let dragging = false;
	let activePointerId = null;
	let cachedRect = null;
	let rafId = 0;
	let pendingClientX = 0;

	function toggleFaq(i) {
		openFaq = openFaq === i ? -1 : i;
	}

	function flushSliderUpdate() {
		rafId = 0;
		if (!cachedRect) return;
		const x = pendingClientX - cachedRect.left;
		sliderPos = Math.max(0, Math.min(100, (x / cachedRect.width) * 100));
	}

	function handleSliderDown(e) {
		if (!sliderEl) return;
		dragging = true;
		activePointerId = e.pointerId;
		cachedRect = sliderEl.getBoundingClientRect();
		try { sliderEl.setPointerCapture(e.pointerId); } catch {}
		pendingClientX = e.clientX;
		flushSliderUpdate();
	}
	function handleSliderMove(e) {
		if (!dragging || e.pointerId !== activePointerId) return;
		pendingClientX = e.clientX;
		if (!rafId) rafId = requestAnimationFrame(flushSliderUpdate);
	}
	function handleSliderUp(e) {
		if (e.pointerId !== activePointerId) return;
		dragging = false;
		cachedRect = null;
		if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
		try { sliderEl.releasePointerCapture(activePointerId); } catch {}
		activePointerId = null;
	}
	function handleSliderKey(e) {
		if (e.key === 'ArrowLeft') sliderPos = Math.max(0, sliderPos - 5);
		if (e.key === 'ArrowRight') sliderPos = Math.min(100, sliderPos + 5);
	}

	function reveal(node, options = {}) {
		const delay = options.delay ?? 0;
		node.classList.add('reveal--js');
		if (delay) node.style.transitionDelay = `${delay}ms`;

		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						node.classList.add('is-visible');
						io.unobserve(node);
					}
				});
			},
			{ threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}

	onMount(() => {
		return () => {
			if (rafId) cancelAnimationFrame(rafId);
		};
	});
</script>

<MetaTags
	title="Experto WiFi · Diagnóstico técnico de WiFi a domicilio"
	description="Evaluamos la cobertura WiFi de tu casa u oficina. Diagnóstico técnico personalizado y plan a medida. Una unidad de Sista."
/>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="ew">
	<!-- HEADER STICKY -->
	<header class="ew-header">
		<div class="ew-header__inner">
			<a href="/experto-wifi" class="ew-header__logo">
				<img src="/images/experto-wifi/logo-2.png" alt="Experto WiFi" />
			</a>
			<nav class="ew-header__nav" aria-label="Navegación principal">
				<a href="#como-trabajamos">Cómo trabajamos</a>
				<!-- <a href="#casos">Casos</a> -->
				<a href="#arquitectos">Para arquitectos</a>
				<a href="#preguntas">Preguntas</a>
			</nav>
			<a class="ew-btn ew-btn--primary ew-btn--sm" href={WHATSAPP_URL} target="_blank" rel="noopener">
				Evaluar mi hogar
			</a>
		</div>
	</header>

	<!-- HERO -->
	<section class="ew-hero">
		<div class="ew-waves ew-waves--hero" aria-hidden="true">
			<svg viewBox="0 0 400 400" fill="none">
				<circle cx="320" cy="80" r="40" stroke="currentColor" stroke-width="1.5" />
				<circle cx="320" cy="80" r="80" stroke="currentColor" stroke-width="1.5" />
				<circle cx="320" cy="80" r="120" stroke="currentColor" stroke-width="1.5" />
				<circle cx="320" cy="80" r="160" stroke="currentColor" stroke-width="1.5" />
				<circle cx="320" cy="80" r="200" stroke="currentColor" stroke-width="1.5" />
			</svg>
		</div>
		<div class="ew-container ew-hero__inner">
			<div class="ew-hero__head" use:reveal>
				<img
					class="ew-hero__sista-logo"
					src="/images/Sista-logo-violeta.svg"
					alt="Sista"
				/>
				<h1 class="ew-h1">¿En tu casa el WiFi no llega a todos lados?</h1>
				<p class="ew-lead">
					El problema casi nunca son los megas. Es la cobertura. La evaluamos en tu hogar,
					sin compromiso.
				</p>
			</div>
				<div class="ew-hero__actions" use:reveal={{ delay: 200 }}>
					<div class="ew-cta-row">
					<a class="ew-btn ew-btn--primary ew-btn--lg" href={WHATSAPP_URL} target="_blank" rel="noopener">
						Quiero evaluar mi hogar
					</a>
				</div>
				<p class="ew-microcopy">
					Visita técnica a domicilio · Respuesta en 24 hs · Sin compromiso
				</p>
			</div>
			<div class="ew-hero__art" use:reveal={{ delay: 120 }}>
				<img
					class="ew-hero__img"
					src="/images/experto-wifi/hero.png"
					alt="Casa con cobertura WiFi visualizada ambiente por ambiente"
				/>
			</div>
		</div>
	</section>

	<!-- 2. IDENTIFICACIÓN DEL PROBLEMA -->
	<section class="ew-section ew-section--white">
		<div class="ew-container">
			<header class="ew-section__head" use:reveal>
				<h2 class="ew-h2">¿Te suena alguna de estas?</h2>
				<p class="ew-sub">Si te identificás con dos o más, vale la pena que lo veamos juntos.</p>
			</header>
			<ul class="ew-problemas">
				{#each problemas as p, i}
					<li class="ew-problema" use:reveal={{ delay: i * 60 }}>
						<div class="ew-problema__ico" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none">
								<path d="M12 18.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								<path d="M5.5 12.5a9 9 0 0 1 13 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								<path d="M2 9a13 13 0 0 1 20 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								<path d="M8.5 15.5a5 5 0 0 1 7 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
							</svg>
						</div>
						<p>{p}</p>
					</li>
				{/each}
			</ul>
			<div class="ew-section__cta" use:reveal>
				<a class="ew-link ew-link--big" href={WHATSAPP_URL} target="_blank" rel="noopener">
					Lo evaluamos en tu casa →
				</a>
			</div>
		</div>
	</section>

	<!-- 3. POR QUÉ TE FALLA -->
	<section class="ew-section ew-section--lavender">
		<div class="ew-container ew-grid-2">
			<div use:reveal>
				<span class="ew-eyebrow">LA VERDAD TÉCNICA</span>
				<h2 class="ew-h2 ew-h2--left">Más megas no resuelven el problema</h2>
				<p class="ew-body">
					Casi todos los problemas de WiFi en casa no tienen que ver con la velocidad que contratás,
					sino con cómo se distribuye la señal. Estas son las cuatro causas más comunes:
				</p>
				<ol class="ew-causas">
					{#each causas as c, i}
						<li class="ew-causa" use:reveal={{ delay: i * 80 }}>
							<span class="ew-causa__num">{i + 1}</span>
							<div>
								<h3>{c.titulo}</h3>
								<p>{c.texto}</p>
							</div>
						</li>
					{/each}
				</ol>
				<p class="ew-body ew-body--strong">
					Por eso cambiar de plan rara vez funciona. Lo que tu casa necesita es un diagnóstico
					técnico real.
				</p>
			</div>
			<div use:reveal={{ delay: 120 }}>
				<img
					class="ew-section-img"
					src="/images/experto-wifi/mas-megas-no-resuelven.jpg"
					alt="Más megas no resuelven el problema de cobertura WiFi"
				/>
			</div>
		</div>
	</section>

	<!-- 4. CÓMO TRABAJAMOS -->
	<section id="como-trabajamos" class="ew-section ew-section--white">
		<div class="ew-container">
			<header class="ew-section__head" use:reveal>
				<span class="ew-eyebrow">EL SERVICIO</span>
				<h2 class="ew-h2">Cómo trabajamos</h2>
				<p class="ew-sub">
					Un proceso simple, sin sorpresas. Empezamos por la evaluación.
				</p>
			</header>
			<div class="ew-pasos">
				<div class="ew-pasos__line" aria-hidden="true"></div>
				<article class="ew-paso" use:reveal>
					<div class="ew-paso__num">01</div>
					<h3 class="ew-paso__titulo">
						DIAGNOSTICAMOS <span class="ew-badge">Bonificado</span>
					</h3>
					<p>
						Un técnico va a tu casa en el horario que te quede cómodo. Recorre cada ambiente, mide
						la cobertura real con instrumental específico y entiende cómo usás internet en tu día a
						día. Sale de ahí con el mapa completo de tu WiFi.
					</p>
					<img
						class="ew-paso__img"
						src="/images/experto-wifi/medir-wifi.png"
						alt="Técnico midiendo la cobertura WiFi en tu hogar"
					/>
				</article>
				<article class="ew-paso" use:reveal={{ delay: 120 }}>
					<div class="ew-paso__num">02</div>
					<h3 class="ew-paso__titulo">DISEÑAMOS</h3>
					<p>
						Con esa información armamos un plan a medida para tu casa: qué hace falta, dónde, y por
						qué. Te lo presentamos con el presupuesto detallado para que decidas con toda la
						información sobre la mesa.
					</p>
					<img
						class="ew-paso__img"
						src="/images/experto-wifi/disenamos.jpg"
						alt="Diseño personalizado del plan WiFi para tu casa"
					/>
				</article>
				<article class="ew-paso" use:reveal={{ delay: 240 }}>
					<div class="ew-paso__num">03</div>
					<h3 class="ew-paso__titulo">DEJAMOS TODO FUNCIONANDO</h3>
					<p>
						Si seguís adelante, implementamos la solución en una sola visita. Antes de irnos,
						verificamos ambiente por ambiente que la señal sea la que tiene que ser. No nos vamos
						hasta que funcione bien.
					</p>
					<img
						class="ew-paso__img"
						src="/images/experto-wifi/despues.png"
						alt="Casa con cobertura WiFi pareja después de la instalación"
					/>
				</article>
			</div>
			<div class="ew-section__cta" use:reveal>
				<a class="ew-link ew-link--big" href={WHATSAPP_URL} target="_blank" rel="noopener">
					Empezá por la evaluación →
				</a>
			</div>
		</div>
	</section>

	<!-- 5. ANTES / DESPUÉS -->
	<section class="ew-section ew-section--white ew-section--mapa">
		<div class="ew-waves ew-waves--mapa" aria-hidden="true">
			<svg viewBox="0 0 600 600" fill="none">
				<circle cx="100" cy="500" r="60" stroke="currentColor" stroke-width="1.5" />
				<circle cx="100" cy="500" r="120" stroke="currentColor" stroke-width="1.5" />
				<circle cx="100" cy="500" r="180" stroke="currentColor" stroke-width="1.5" />
				<circle cx="500" cy="100" r="60" stroke="currentColor" stroke-width="1.5" />
				<circle cx="500" cy="100" r="120" stroke="currentColor" stroke-width="1.5" />
			</svg>
		</div>
		<div class="ew-container">
			<header class="ew-section__head" use:reveal>
				<span class="ew-eyebrow">LA DEMOSTRACIÓN</span>
				<h2 class="ew-h2">Así cambia el WiFi de tu casa</h2>
				<p class="ew-sub">Antes y después de una evaluación de Experto WiFi.</p>
			</header>

			<div
				class="ew-slider"
				use:reveal
				bind:this={sliderEl}
				onpointerdown={handleSliderDown}
				onpointermove={handleSliderMove}
				onpointerup={handleSliderUp}
				onpointercancel={handleSliderUp}
				role="slider"
				tabindex="0"
				aria-label="Comparativa antes y después"
				aria-valuenow={Math.round(sliderPos)}
				aria-valuemin="0"
				aria-valuemax="100"
				onkeydown={handleSliderKey}
			>
				<div class="ew-slider__after">
					<img
						class="ew-slider__img"
						src="/images/experto-wifi/casa-despues.png"
						alt="Cobertura WiFi pareja en toda la casa después de la evaluación"
						draggable="false"
					/>
					<span class="ew-slider__tag ew-slider__tag--after">DESPUÉS</span>
				</div>
				<div class="ew-slider__before" style="clip-path: inset(0 {100 - sliderPos}% 0 0);">
					<img
						class="ew-slider__img"
						src="/images/experto-wifi/casa-antes.png"
						alt="Cobertura WiFi desigual en la casa antes de la evaluación"
						draggable="false"
					/>
					<span class="ew-slider__tag ew-slider__tag--before">ANTES</span>
				</div>
				<div class="ew-slider__handle" style="left: {sliderPos}%" aria-hidden="true">
					<div class="ew-slider__bar"></div>
					<div class="ew-slider__knob">
						<svg viewBox="0 0 24 24" fill="none">
							<path d="M9 6l-4 6 4 6M15 6l4 6-4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</div>
				</div>
			</div>

			<p class="ew-body ew-mapa__caption" use:reveal>
				Esto es lo que ves después de un diagnóstico: el mapa real de cobertura de tu hogar,
				ambiente por ambiente. Y el resultado después de la implementación.
			</p>
		</div>
	</section>

	<!-- 6. CASOS REALES (oculto por ahora)
	<section id="casos" class="ew-section ew-section--lavender">
		<div class="ew-container">
			<header class="ew-section__head" use:reveal>
				<h2 class="ew-h2">Casos reales</h2>
				<p class="ew-sub">Tres ejemplos de lo que solemos encontrarnos.</p>
			</header>
			<div class="ew-casos">
				{#each casos as c, i}
					<article class="ew-caso" use:reveal={{ delay: i * 100 }}>
						<div class="ew-placeholder ew-placeholder--caso">
							<span>[IMG]</span>
							<p>{c.img}. ~360×240.</p>
						</div>
						<h3>{c.titulo}</h3>
						<div class="ew-caso__bloque">
							<span class="ew-caso__label">Problema</span>
							<p>{c.problema}</p>
						</div>
						<div class="ew-caso__bloque">
							<span class="ew-caso__label">Resultado</span>
							<p>{c.resultado}</p>
						</div>
						<blockquote>"{c.cita}"</blockquote>
					</article>
				{/each}
			</div>
		</div>
	</section>
	-->

	<!-- 7. ARQUITECTOS -->
	<section id="arquitectos" class="ew-section ew-section--navy">
		<div class="ew-container ew-grid-2">
			<div use:reveal>
				<span class="ew-eyebrow ew-eyebrow--cyan">PARA PROFESIONALES</span>
				<h2 class="ew-h2 ew-h2--white ew-h2--left">
					Pensá el WiFi desde el plano, no después de la mudanza
				</h2>
				<p class="ew-body ew-body--white">
					Trabajamos con arquitectos, estudios y desarrolladoras para que cada proyecto se entregue
					con cobertura garantizada. Planificación de cobertura sobre los planos, pre-cableado en
					obra, y hogares listos desde el primer día. Tus clientes se mudan a una casa que ya
					funciona.
				</p>
				<ul class="ew-checks">
					<li>Planificación de cobertura sobre el plano</li>
					<li>Pre-cableado en etapa de obra</li>
					<li>Entrega con cobertura verificada</li>
					<li>Diferencial visible para tus clientes</li>
				</ul>
				<a class="ew-link ew-link--white" href={WHATSAPP_URL} target="_blank" rel="noopener">
					Coordinemos una reunión →
				</a>
			</div>
			<div use:reveal={{ delay: 120 }}>
				<div class="ew-blueprint-art">
					<img
						class="ew-blueprint-photo"
						src="/images/experto-wifi/planos-construccion.jpg"
						alt="Planos de construcción con planificación WiFi"
						draggable="false"
					/>
					<div class="ew-blueprint-blend" aria-hidden="true"></div>
					<div class="ew-blueprint-tint" aria-hidden="true"></div>
				</div>
			</div>
		</div>
	</section>

	<!-- 8. CIERRE -->
	<section class="ew-section ew-section--cierre">
		<div class="ew-waves ew-waves--cierre" aria-hidden="true">
			<svg viewBox="0 0 800 400" fill="none">
				<circle cx="400" cy="200" r="300" stroke="currentColor" stroke-width="1.5" />
				<circle cx="400" cy="200" r="300" stroke="currentColor" stroke-width="1.5" />
				<circle cx="400" cy="200" r="300" stroke="currentColor" stroke-width="1.5" />
				<circle cx="400" cy="200" r="300" stroke="currentColor" stroke-width="1.5" />
				<circle cx="400" cy="200" r="300" stroke="currentColor" stroke-width="1.5" />
			</svg>
		</div>
		<div class="ew-container ew-cierre" use:reveal>
			<span class="ew-eyebrow">EL PRIMER PASO</span>
			<h2 class="ew-h1 ew-h1--center">Tu evaluación a domicilio</h2>
			<p class="ew-lead ew-lead--center">
				Coordinamos una visita técnica, medimos la cobertura real de tu casa y te entregamos un
				diagnóstico con plan a medida y presupuesto. Sin obligación de seguir adelante.
			</p>
			<div class="ew-cta-row ew-cta-row--center">
				<a class="ew-btn ew-btn--primary ew-btn--lg" href={WHATSAPP_URL} target="_blank" rel="noopener">
					Quiero evaluar mi hogar
				</a>
			</div>
			<p class="ew-microcopy ew-microcopy--center">Respondemos en menos de 24 hs hábiles.</p>
		</div>
	</section>

	<!-- 9. FAQ -->
	<section id="preguntas" class="ew-section ew-section--white">
		<div class="ew-container ew-container--narrow">
			<header class="ew-section__head" use:reveal>
				<h2 class="ew-h2">Preguntas frecuentes</h2>
			</header>
			<div class="ew-faq">
				{#each faqs as f, i}
					<div class="ew-faq__item" class:is-open={openFaq === i} use:reveal>
						<button
							class="ew-faq__q"
							onclick={() => toggleFaq(i)}
							aria-expanded={openFaq === i}
						>
							<span>{f.q}</span>
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</button>
						{#if openFaq === i}
							<div class="ew-faq__a">
								<p>{f.a}</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- 10. FOOTER -->
	<footer class="ew-footer">
		<div class="ew-container ew-footer__inner">
			<div class="ew-footer__brand">
				<img src="/images/experto-wifi/logo-1.png" alt="Experto WiFi" />
				<p class="ew-footer__contact">
					<a class="ew-footer__wsp" href={WHATSAPP_URL} target="_blank" rel="noopener">
						<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18.858 18.858" fill="currentColor">
							<path d="M16.033,4.99A9.348,9.348,0,0,0,1.326,16.267L0,21.108l4.954-1.3A9.316,9.316,0,0,0,9.42,20.943h0A9.435,9.435,0,0,0,18.858,11.6,9.381,9.381,0,0,0,16.033,4.99ZM9.425,19.369a7.753,7.753,0,0,1-3.957-1.082l-.282-.168-2.938.77.783-2.867-.185-.295A7.782,7.782,0,1,1,17.279,11.6,7.854,7.854,0,0,1,9.425,19.369Zm4.26-5.817c-.232-.118-1.381-.682-1.6-.758s-.37-.118-.526.118-.6.758-.741.918-.274.177-.505.059a6.356,6.356,0,0,1-3.178-2.778c-.24-.413.24-.383.686-1.275A.433.433,0,0,0,7.8,9.427c-.059-.118-.526-1.267-.72-1.734s-.383-.391-.526-.4-.29-.008-.446-.008a.865.865,0,0,0-.623.29,2.624,2.624,0,0,0-.817,1.949,4.574,4.574,0,0,0,.951,2.416,10.434,10.434,0,0,0,3.99,3.527,4.569,4.569,0,0,0,2.8.585,2.392,2.392,0,0,0,1.574-1.111,1.953,1.953,0,0,0,.135-1.111C14.072,13.725,13.916,13.666,13.684,13.552Z" transform="translate(0 -2.25)"/>
						</svg>
						221 354-1906
					</a>
					·
					<a href="mailto:info@sista.ar">info@sista.ar</a>
				</p>
			</div>
			<div class="ew-footer__sista">
				<span>Una unidad de</span>
				<img src="/images/Sista-logo-violeta.svg" alt="Sista" />
			</div>
		</div>
		</footer>
</div>

<style>
	.ew {
		--ew-navy: #1e1f7a;
		--ew-navy-deep: #161654;
		--ew-cyan: #2bd4d4;
		--ew-cyan-soft: #b4f0f0;
		--ew-lavender: #f3f0fb;
		--ew-lavender-soft: #faf8ff;
		--ew-white: #ffffff;
		--ew-text: #1f2138;
		--ew-text-soft: #5a5d75;
		--ew-border: #e7e4f1;
		--ew-radius: 18px;
		--ew-radius-sm: 12px;
		--ew-shadow-sm: 0 4px 18px -8px rgba(30, 31, 122, 0.15);
		--ew-shadow-md: 0 18px 60px -28px rgba(30, 31, 122, 0.32);
		font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
		color: var(--ew-text);
		background: var(--ew-white);
		line-height: 1.55;
		font-weight: 500;
		-webkit-font-smoothing: antialiased;
	}

	.ew :global(*) {
		box-sizing: border-box;
	}

	.ew-container {
		width: 100%;
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 1.5rem;
	}
	.ew-container--narrow {
		max-width: 760px;
	}

	/* ==================== HEADER ==================== */
	.ew-header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: saturate(180%) blur(14px);
		border-bottom: 1px solid var(--ew-border);
	}
	.ew-header__inner {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0.85rem 1.5rem;
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}
	.ew-header__logo {
		flex: 0 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
	}
	.ew-header__logo img {
		display: block;
		height: auto;
		width: auto;
		max-width: 190px;
		max-height: 32px;
	}
	.ew-header__nav { flex-shrink: 1; }
	.ew-header .ew-btn { flex-shrink: 0; }
	.ew-header__nav {
		display: flex;
		gap: 1.75rem;
		margin-left: auto;
	}
	.ew-header__nav a {
		color: var(--ew-text);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.95rem;
		transition: color 0.2s;
	}
	.ew-header__nav a:hover {
		color: var(--ew-navy);
	}

	/* ==================== TIPOGRAFÍA ==================== */
	.ew-h1 {
		font-family: inherit;
		font-size: clamp(2.1rem, 4.5vw, 3.4rem);
		line-height: 1.08;
		font-weight: 800;
		color: var(--ew-navy);
		margin: 0 0 1.1rem;
		letter-spacing: -0.02em;
	}
	.ew-h1--center {
		text-align: center;
	}
	.ew-h2 {
		font-size: clamp(1.7rem, 3.4vw, 2.4rem);
		font-weight: 800;
		color: var(--ew-navy);
		line-height: 1.15;
		margin: 0 0 0.9rem;
		letter-spacing: -0.018em;
	}
	.ew-h2--white {
		color: var(--ew-white);
	}
	.ew-h2--left {
		text-align: left;
	}
	.ew-lead {
		font-size: clamp(1.05rem, 1.4vw, 1.2rem);
		color: var(--ew-text-soft);
		margin: 0 0 1.8rem;
		max-width: 32em;
	}
	.ew-lead--center {
		margin-left: auto;
		margin-right: auto;
		text-align: center;
	}
	.ew-body {
		color: var(--ew-text-soft);
		font-size: 1.02rem;
		margin: 0 0 1.1rem;
	}
	.ew-body--white {
		color: rgba(255, 255, 255, 0.82);
	}
	.ew-body--strong {
		color: var(--ew-navy);
		font-weight: 600;
		font-size: 1.08rem;
	}
	.ew-sub {
		color: var(--ew-text-soft);
		font-size: 1.08rem;
		margin: 0;
		max-width: 38em;
	}
	.ew-microcopy {
		font-size: 0.88rem;
		color: var(--ew-text-soft);
		margin: 1rem 0 0;
	}
	.ew-microcopy--center {
		text-align: center;
	}
	.ew-eyebrow {
		display: inline-block;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--ew-cyan);
		text-transform: uppercase;
		margin-bottom: 0.8rem;
	}
	.ew-eyebrow--cyan {
		color: var(--ew-cyan);
	}

	/* ==================== BOTONES ==================== */
	.ew-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.85rem 1.4rem;
		border-radius: 999px;
		border: 2px solid transparent;
		font-weight: 700;
		font-size: 0.98rem;
		text-decoration: none;
		cursor: pointer;
		transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
		white-space: nowrap;
	}
	.ew-btn--sm {
		padding: 0.6rem 1rem;
		font-size: 0.9rem;
	}
	.ew-btn--lg {
		padding: 1.05rem 1.8rem;
		font-size: 1.05rem;
	}
	.ew-btn--primary {
		background: var(--ew-navy);
		color: var(--ew-white);
		box-shadow: 0 14px 32px -16px rgba(30, 31, 122, 0.6);
	}
	.ew-btn--primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 18px 36px -16px rgba(30, 31, 122, 0.65);
		background: var(--ew-navy-deep);
	}
	.ew-btn--secondary {
		background: var(--ew-cyan);
		color: var(--ew-navy);
	}
	.ew-btn--secondary:hover {
		transform: translateY(-2px);
		filter: brightness(1.05);
	}
	.ew-link {
		color: var(--ew-cyan);
		font-weight: 700;
		text-decoration: none;
		transition: color 0.2s;
	}
	.ew-link:hover {
		color: var(--ew-navy);
	}
	.ew-link--big {
		font-size: 1.1rem;
	}
	.ew-link--white {
		color: var(--ew-cyan);
	}
	.ew-link--white:hover {
		color: var(--ew-white);
	}

	.ew-cta-row {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.ew-cta-row--center {
		justify-content: center;
	}

	/* ==================== SECCIONES base ==================== */
	.ew-section {
		position: relative;
		padding: clamp(4rem, 9vw, 7rem) 0;
		overflow: hidden;
	}
	.ew-section--white {
		background: var(--ew-white);
	}
	.ew-section--lavender {
		background: linear-gradient(180deg, var(--ew-lavender-soft), var(--ew-lavender));
	}
	.ew-section--navy {
		background: linear-gradient(135deg, var(--ew-navy) 0%, var(--ew-navy-deep) 100%);
		color: var(--ew-white);
	}
	.ew-section__head {
		text-align: center;
		max-width: 38em;
		margin: 0 auto 3rem;
	}
	.ew-section__head .ew-h2 {
		margin-bottom: 0.6rem;
	}
	.ew-section__cta {
		margin-top: 2.5rem;
		text-align: center;
	}
	.ew-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: clamp(2rem, 5vw, 4.5rem);
		align-items: center;
	}

	/* ==================== ONDAS WIFI ==================== */
	.ew-waves {
		position: absolute;
		pointer-events: none;
		color: var(--ew-cyan);
		opacity: 0.18;
		animation: ew-pulse 6s ease-in-out infinite;
	}
	.ew-waves svg {
		width: 100%;
		height: 100%;
	}
	.ew-waves--hero {
		top: -120px;
		right: -120px;
		width: 600px;
		height: 600px;
		color: var(--ew-cyan);
		opacity: 0.22;
	}
	.ew-waves--mapa {
		inset: 0;
		opacity: 0.14;
	}
	.ew-waves--cierre {
		inset: 0;
		opacity: 1;
		color: var(--ew-cyan);
		animation: none;
	}
	.ew-waves--cierre circle {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: ew-ripple 9s ease-out infinite;
	}
	.ew-waves--cierre circle:nth-child(1) { animation-delay: 0s; }
	.ew-waves--cierre circle:nth-child(2) { animation-delay: 1.8s; }
	.ew-waves--cierre circle:nth-child(3) { animation-delay: 3.6s; }
	.ew-waves--cierre circle:nth-child(4) { animation-delay: 5.4s; }
	.ew-waves--cierre circle:nth-child(5) { animation-delay: 7.2s; }
	@keyframes ew-pulse {
		0%, 100% { opacity: 0.18; transform: scale(1); }
		50% { opacity: 0.28; transform: scale(1.03); }
	}
	@keyframes ew-ripple {
		0%   { transform: scale(0); opacity: 0; }
		12%  { opacity: 0.4; }
		100% { transform: scale(1.7); opacity: 0.4; }
	}

	/* ==================== HERO ==================== */
	.ew-hero {
		position: relative;
		padding: clamp(3rem, 8vw, 6rem) 0 clamp(3rem, 8vw, 6rem);
		background: linear-gradient(160deg, var(--ew-white) 0%, var(--ew-lavender-soft) 60%, var(--ew-lavender) 100%);
		overflow: hidden;
	}
	.ew-hero__inner {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-areas:
			"head art"
			"actions art";
		column-gap: clamp(2rem, 6vw, 5rem);
		row-gap: 1.8rem;
		align-items: center;
		position: relative;
		z-index: 1;
	}
	.ew-hero__head { grid-area: head; align-self: end; }
	.ew-hero__actions { grid-area: actions; align-self: start; }
	.ew-hero__head .ew-lead { margin-bottom: 0; }
	.ew-hero__art {
		grid-area: art;
		display: flex;
		justify-content: center;
		align-self: center;
	}
	.ew-hero__sista-logo {
		display: block;
		height: 1.4rem;
		width: auto;
		margin-bottom: 0.8rem;
	}

	/* ==================== PLACEHOLDERS ==================== */
	.ew-placeholder {
		background: var(--ew-lavender);
		border: 1.5px dashed color-mix(in srgb, var(--ew-navy) 18%, transparent);
		border-radius: var(--ew-radius);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 1.5rem;
		color: var(--ew-navy);
		gap: 0.6rem;
		transition: transform 0.3s ease, box-shadow 0.3s ease;
	}
	.ew-placeholder:hover {
		transform: translateY(-3px);
		box-shadow: var(--ew-shadow-sm);
	}
	.ew-placeholder span {
		font-weight: 800;
		font-size: 0.92rem;
		letter-spacing: 0.16em;
		color: var(--ew-navy);
		background: rgba(255, 255, 255, 0.7);
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
	}
	.ew-placeholder p {
		font-size: 0.85rem;
		color: var(--ew-text-soft);
		max-width: 32ch;
		margin: 0;
		line-height: 1.4;
	}
	.ew-placeholder--hero {
		aspect-ratio: 9 / 8;
		width: 100%;
		max-width: 560px;
	}
	.ew-placeholder--square {
		aspect-ratio: 1 / 1;
		width: 100%;
	}
	.ew-placeholder--paso {
		aspect-ratio: 10 / 7;
		width: 100%;
		margin-top: 1.4rem;
	}
	.ew-placeholder--caso {
		aspect-ratio: 3 / 2;
		width: 100%;
		margin-bottom: 1.2rem;
	}
	.ew-placeholder--blueprint {
		aspect-ratio: 7 / 6;
		width: 100%;
		background: rgba(43, 212, 212, 0.08);
		border-color: rgba(43, 212, 212, 0.45);
		color: var(--ew-cyan-soft);
	}
	.ew-placeholder--blueprint span {
		background: rgba(43, 212, 212, 0.15);
		color: var(--ew-cyan);
	}
	.ew-placeholder--blueprint p {
		color: rgba(255, 255, 255, 0.7);
	}

	/* ==================== PROBLEMAS ==================== */
	.ew-problemas {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}
	.ew-problema {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: var(--ew-white);
		border: 1px solid var(--ew-border);
		border-radius: var(--ew-radius);
		padding: 1.2rem 1.4rem;
		transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
	}
	.ew-problema:hover {
		transform: translateY(-4px);
		box-shadow: var(--ew-shadow-sm);
		border-color: var(--ew-cyan);
	}
	.ew-problema p {
		margin: 0;
		font-weight: 600;
		font-size: 1rem;
		color: var(--ew-text);
		line-height: 1.4;
	}
	.ew-problema__ico {
		flex-shrink: 0;
		width: 42px;
		height: 42px;
		border-radius: 12px;
		background: var(--ew-lavender);
		color: var(--ew-cyan);
		display: grid;
		place-items: center;
	}
	.ew-problema__ico svg {
		width: 24px;
		height: 24px;
	}

	/* ==================== CAUSAS ==================== */
	.ew-causas {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0 1.8rem;
		display: grid;
		gap: 1.1rem;
	}
	.ew-causa {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.ew-causa__num {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--ew-cyan);
		color: var(--ew-navy);
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 0.95rem;
	}
	.ew-causa h3 {
		margin: 0 0 0.25rem;
		font-size: 1.05rem;
		color: var(--ew-navy);
		font-weight: 700;
	}
	.ew-causa p {
		margin: 0;
		color: var(--ew-text-soft);
		font-size: 0.96rem;
	}

	/* ==================== PASOS ==================== */
	.ew-pasos {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2rem;
	}
	.ew-pasos__line {
		position: absolute;
		top: 28px;
		left: 12%;
		right: 12%;
		height: 2px;
		background: linear-gradient(90deg, transparent, var(--ew-cyan) 20%, var(--ew-cyan) 80%, transparent);
		opacity: 0.35;
		z-index: 0;
	}
	.ew-paso {
		position: relative;
		z-index: 1;
		background: var(--ew-white);
		border-radius: var(--ew-radius);
		padding: 1.6rem 1.6rem 1.8rem;
		border: 1px solid var(--ew-border);
		transition: transform 0.3s, box-shadow 0.3s;
	}
	.ew-paso:hover {
		transform: translateY(-6px);
		box-shadow: var(--ew-shadow-md);
	}
	.ew-paso__num {
		display: inline-grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--ew-navy);
		color: var(--ew-white);
		font-weight: 800;
		font-size: 1.1rem;
		margin-bottom: 1rem;
		box-shadow: 0 10px 24px -10px rgba(30, 31, 122, 0.5);
	}
	.ew-paso__titulo {
		margin: 0 0 0.7rem;
		font-size: 1.08rem;
		font-weight: 800;
		color: var(--ew-navy);
		letter-spacing: 0.04em;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.ew-badge {
		background: var(--ew-cyan);
		color: var(--ew-navy);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		text-transform: uppercase;
	}
	.ew-paso p {
		color: var(--ew-text-soft);
		font-size: 0.98rem;
		margin: 0;
	}

	/* ==================== SLIDER ANTES/DESPUÉS ==================== */
	.ew-section--mapa {
		background: var(--ew-white);
	}
	.ew-slider {
		position: relative;
		width: 100%;
		max-width: 980px;
		margin: 0 auto;
		aspect-ratio: 16 / 10;
		border-radius: var(--ew-radius);
		overflow: hidden;
		box-shadow: var(--ew-shadow-md);
		border: 1px solid rgba(0, 0, 0, 0.08);
		cursor: ew-resize;
		user-select: none;
		touch-action: none;
		background: var(--ew-lavender);
	}
	.ew-slider:focus {
		outline: 3px solid var(--ew-cyan);
		outline-offset: 4px;
	}
	.ew-slider__after,
	.ew-slider__before {
		position: absolute;
		inset: 0;
	}
	.ew-slider__before {
		z-index: 2;
		will-change: clip-path;
	}
	.ew-slider__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		pointer-events: none;
		user-select: none;
	}
	.ew-slider__tag {
		position: absolute;
		top: 1rem;
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--ew-white);
		z-index: 1;
		pointer-events: none;
	}
	.ew-slider__tag--before {
		left: 1rem;
		background: rgba(214, 92, 56, 0.92);
	}
	.ew-slider__tag--after {
		right: 1rem;
		background: rgba(34, 150, 102, 0.92);
	}
	.ew-slider__handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--ew-white);
		transform: translateX(-50%);
		z-index: 3;
		box-shadow: 0 0 16px rgba(0, 0, 0, 0.25);
		will-change: left;
	}
	.ew-slider__bar {
		position: absolute;
		inset: 0;
		background: var(--ew-white);
	}
	.ew-slider__knob {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--ew-white);
		color: var(--ew-navy);
		display: grid;
		place-items: center;
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
	}
	.ew-slider__knob svg {
		width: 22px;
		height: 22px;
	}
	.ew-mapa__caption {
		max-width: 40em;
		margin: 2rem auto 0;
		text-align: center;
	}

	/* ==================== CASOS ==================== */
	.ew-casos {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.6rem;
	}
	.ew-caso {
		background: var(--ew-white);
		border-radius: var(--ew-radius);
		padding: 1.4rem;
		border: 1px solid var(--ew-border);
		transition: transform 0.3s, box-shadow 0.3s;
	}
	.ew-caso:hover {
		transform: translateY(-6px);
		box-shadow: var(--ew-shadow-md);
	}
	.ew-caso h3 {
		margin: 0 0 1rem;
		color: var(--ew-navy);
		font-weight: 800;
		font-size: 1.15rem;
	}
	.ew-caso__bloque {
		margin-bottom: 0.85rem;
	}
	.ew-caso__label {
		display: block;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ew-cyan);
		margin-bottom: 0.25rem;
	}
	.ew-caso__bloque p {
		margin: 0;
		font-size: 0.95rem;
		color: var(--ew-text-soft);
	}
	.ew-caso blockquote {
		margin: 1rem 0 0;
		padding: 1rem 1.1rem;
		background: var(--ew-lavender);
		border-radius: var(--ew-radius-sm);
		border-left: 3px solid var(--ew-cyan);
		font-style: italic;
		color: var(--ew-navy);
		font-size: 0.95rem;
		line-height: 1.45;
	}

	/* ==================== ARQUITECTOS ==================== */
	.ew-section--navy .ew-body {
		font-size: 1.05rem;
	}
	.ew-checks {
		list-style: none;
		padding: 0;
		margin: 1.4rem 0 1.8rem;
		display: grid;
		gap: 0.7rem;
	}
	.ew-checks li {
		position: relative;
		padding-left: 2rem;
		color: rgba(255, 255, 255, 0.92);
		font-weight: 600;
	}
	.ew-checks li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.4em;
		width: 1.2rem;
		height: 1.2rem;
		background: var(--ew-cyan);
		border-radius: 50%;
	}
	.ew-checks li::after {
		content: '';
		position: absolute;
		left: 0.35rem;
		top: 0.65em;
		width: 0.5rem;
		height: 0.3rem;
		border-left: 2px solid var(--ew-navy);
		border-bottom: 2px solid var(--ew-navy);
		transform: rotate(-45deg);
	}

	/* ==================== CIERRE ==================== */
	.ew-section--cierre {
		background: linear-gradient(180deg, var(--ew-white), var(--ew-lavender-soft));
	}
	.ew-cierre {
		text-align: center;
		max-width: 42em;
		position: relative;
		z-index: 1;
	}
	.ew-cierre .ew-eyebrow {
		display: block;
	}

	/* ==================== FAQ ==================== */
	.ew-faq {
		display: grid;
		gap: 0.7rem;
	}
	.ew-faq__item {
		border: 1px solid var(--ew-border);
		border-radius: var(--ew-radius-sm);
		background: var(--ew-white);
		overflow: hidden;
		transition: border-color 0.25s, box-shadow 0.25s;
	}
	.ew-faq__item.is-open {
		border-color: var(--ew-cyan);
		box-shadow: var(--ew-shadow-sm);
	}
	.ew-faq__q {
		all: unset;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 1.1rem 1.4rem;
		cursor: pointer;
		font-weight: 700;
		color: var(--ew-text);
		font-size: 1rem;
		box-sizing: border-box;
	}
	.ew-faq__q svg {
		width: 22px;
		height: 22px;
		color: var(--ew-cyan);
		transition: transform 0.25s ease;
		flex-shrink: 0;
	}
	.ew-faq__item.is-open .ew-faq__q svg {
		transform: rotate(180deg);
	}
	.ew-faq__a {
		padding: 0 1.4rem 1.2rem;
		color: var(--ew-text-soft);
		animation: ew-fade 0.25s ease;
	}
	.ew-faq__a p {
		margin: 0;
	}
	@keyframes ew-fade {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ==================== FOOTER ==================== */
	.ew-footer {
		background: var(--ew-navy-deep);
		color: rgba(255, 255, 255, 0.85);
		padding: 3rem 0 1.5rem;
	}
	.ew-footer__inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		flex-wrap: wrap;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.ew-footer__brand img {
		height: 56px;
		width: auto;
		display: block;
		margin-bottom: 0.7rem;
		filter: brightness(0) invert(1);
	}
	.ew-footer__contact a {
		color: var(--ew-cyan);
		text-decoration: none;
		font-weight: 600;
		margin-right: 0.25rem;
	}
	.ew-footer__contact a:hover {
		text-decoration: underline;
	}
	.ew-footer__wsp {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		line-height: 1;
	}
	.ew-footer__wsp svg {
		flex-shrink: 0;
		position: relative;
		top: -0.5px;
	}
	.ew-footer__sista {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.ew-footer__sista img {
		height: 22px;
		width: auto;
		filter: brightness(0) invert(1);
		opacity: 0.85;
	}
	.ew-footer__copy {
		max-width: 1180px;
		margin: 0 auto;
		padding: 1.2rem 1.5rem 0;
		font-size: 0.8rem;
		opacity: 0.55;
	}

	/* ==================== REVEAL ==================== */
	.reveal--js {
		opacity: 0;
		transform: translateY(24px);
		transition: opacity 0.7s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.reveal--js.is-visible {
		opacity: 1;
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.reveal--js { opacity: 1; transform: none; transition: none; }
		.ew-waves { animation: none; }
		.ew-waves--cierre circle { animation: none; opacity: 0.1; }
	}

	/* ==================== RESPONSIVE ==================== */
	@media (max-width: 900px) {
		.ew-header__nav { display: none; }
		.ew-header .ew-btn { margin-left: auto; padding: 0.45rem 0.8rem; font-size: 0.82rem; }
		.ew-hero__inner {
			grid-template-columns: 1fr;
			grid-template-areas:
				"head"
				"art"
				"actions";
		}
		.ew-hero__head,
		.ew-hero__actions { align-self: stretch; }
		.ew-grid-2 { grid-template-columns: 1fr; }
		.ew-problemas { grid-template-columns: 1fr; }
		.ew-pasos {
			grid-template-columns: 1fr;
			gap: 1.4rem;
		}
		.ew-pasos__line { display: none; }
		.ew-casos { grid-template-columns: 1fr; }
		.ew-footer__inner { justify-content: flex-start; }
	}

	@media (max-width: 520px) {
		.ew-header__inner { gap: 0.5rem; padding: 0.7rem 1rem; }
		.ew-header__logo img { max-width: 140px; max-height: 26px; }
		.ew-header .ew-btn--sm { padding: 0.5rem 0.85rem; font-size: 0.85rem; }
		.ew-cta-row { gap: 1rem; }
		.ew-btn--lg { width: 100%; }
		.ew-cta-row--center .ew-btn--lg { width: 100%; }
	}

	/* ==================== IMÁGENES REALES ==================== */

	/* Hero */
	.ew-hero__img {
		display: block;
		width: 100%;
		max-width: 560px;
		height: auto;
		border-radius: var(--ew-radius);
		box-shadow: var(--ew-shadow-md);
	}

	/* Sección "más megas" */
	.ew-section-img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: var(--ew-radius);
		box-shadow: var(--ew-shadow-sm);
	}
	.ew-section-img--square {
		aspect-ratio: 1 / 1;
		object-fit: cover;
	}

	/* Imágenes de pasos */
	.ew-paso__img {
		display: block;
		width: 100%;
		margin-top: 1.4rem;
		border-radius: var(--ew-radius-sm);
		aspect-ratio: 10 / 7;
		object-fit: cover;
		box-shadow: var(--ew-shadow-sm);
	}

	/* Sección arquitectos — plano con tono azul */
	.ew-blueprint-art {
		position: relative;
		aspect-ratio: 7 / 6;
		border-radius: var(--ew-radius);
		overflow: hidden;
	}
	.ew-blueprint-photo {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* Capa 1: azul con blend "color" — tiñe la foto de navy sin aplanarla */
	.ew-blueprint-blend {
		position: absolute;
		inset: 0;
		background: var(--ew-navy);
		mix-blend-mode: color;
	}
	/* Capa 2: gradiente navy con baja opacidad — profundidad extra */
	.ew-blueprint-tint {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			160deg,
			rgba(30, 31, 122, 0.62) 0%,
			rgba(22, 22, 84, 0.38) 60%,
			rgba(43, 212, 212, 0.06) 100%
		);
	}
</style>
