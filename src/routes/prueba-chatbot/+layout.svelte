<script>
	import { onMount } from "svelte";

	let { children } = $props();

	const STORAGE_KEY = "chatbot_cartel_visto";
	const DELAY_MOSTRAR_MS = 2500;
	const DURACION_CIERRE_MS = 300;

	let showCartel = $state(false);
	let closing = $state(false);
	let cartelReady = $state(false);

	function enviarMensajeChat() {
		if (typeof window !== "undefined" && typeof window.enviarMensaje === "function") {
			window.enviarMensaje();
		}
	}

	function cerrarCartel() {
		if (!showCartel || closing) return;
		closing = true;
		setTimeout(() => {
			showCartel = false;
			closing = false;
			cartelReady = false;
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(STORAGE_KEY, "1");
			}
		}, DURACION_CIERRE_MS);
	}

	onMount(() => {
		if (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) {
			return;
		}
		const t = setTimeout(() => {
			showCartel = true;
			// Dos frames para que el navegador pinte scaleX(0) antes de animar a scaleX(1)
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					cartelReady = true;
				});
			});
		}, DELAY_MOSTRAR_MS);

		const chatBtn = document.getElementById("chat-button");
		if (chatBtn) {
			chatBtn.addEventListener("click", cerrarCartel);
		}

		return () => {
			clearTimeout(t);
			chatBtn?.removeEventListener("click", cerrarCartel);
		};
	});
</script>

<svelte:head>
	<!-- Estilos del widget chatbot -->
	<link rel="stylesheet" href="/assets/chatbot/widget_chatbot.css" />
	<!-- Socket.io -->
	<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.5.4/socket.io.js"></script>
	<!-- Lógica del chatbot (orden: api antes que ui) -->
	<script src="/assets/chatbot/widget_chatbot_api.js"></script>
	<script src="/assets/chatbot/widget_chatbot_ui.js"></script>
</svelte:head>

<!-- Contenido de la página (réplica del home, etc.) -->
{@render children()}

<!-- Widget del chatbot: solo visible en rutas bajo /prueba-chatbot -->
<audio id="notification-sound" preload="auto">
	<source src="/assets/chatbot/notification.mp3" type="audio/mpeg" />
</audio>

<div id="chat-widget">
	{#if showCartel || closing}
		<div
			class="chatbot-cartel"
			class:visible={showCartel && !closing && cartelReady}
			class:closing
			role="status"
			aria-live="polite"
		>
			<p class="chatbot-cartel-texto">
				<strong>NUEVO</strong> ahora podés hablar con nuestro chatbot. Solicita tu factura, realiza reclamos técnicos y otras consultas.
			</p>
			<button type="button" class="chatbot-cartel-ok" onclick={cerrarCartel}>OK</button>
		</div>
	{/if}
	<button id="chat-button" type="button" aria-label="Abrir chat"></button>
	<div id="chat-window">
		<div id="chat-header">Chat</div>
		<div id="chat-body"></div>
		<div id="chat-footer">
			<input type="text" id="mensaje" placeholder="Escribe un mensaje..." />
			<button type="button" onclick={enviarMensajeChat}>Enviar</button>
		</div>
		<div class="drag-indicator">Suelta los archivos aquí</div>
	</div>
</div>

<!-- Modal para ampliar imágenes -->
<div id="image-modal">
	<img src="" alt="Imagen ampliada" />
</div>

<style>
	/* Icono del botón flotante del chatbot: pon tu imagen en static (ej. /assets/chatbot/icono-chat.png) */
	#chat-widget {
		--icono-boton: url("/assets/chatbot/icono-chat.png");
	}
	/* La imagen ocupa todo el círculo, sin círculo de fondo */
	#chat-widget #chat-button {
		background-color: transparent;
		background-size: cover;
		background-position: center;
		/* Tamaño del círculo (original en plugin: 60px). Cambiá acá para probar: */
		width: 6em;
		height: 6em;
		transition: transform 0.2s ease;
	}
	#chat-widget #chat-button:hover {
		transform: scale(1.1);
	}

	/* Cartel a la izquierda del botón del chatbot */
	.chatbot-cartel {
		position: absolute;
		right: 76px;
		bottom: 0;
		margin: 0;
		width: 20em;
		padding: 12px 20px 14px 16px;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		font-size: 0.9rem;
		line-height: 1.4;
		color: #333;
		border: 1px solid rgba(0, 123, 255, 0.2);
		opacity: 0;
		transform: scaleX(0);
		transform-origin: right center;
		transition: opacity 0.4s ease-out, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.chatbot-cartel.visible {
		opacity: 1;
		transform: scaleX(1);
	}
	.chatbot-cartel.closing {
		opacity: 0;
		transform: scaleX(0);
		transform-origin: right center;
		pointer-events: none;
	}
	/* Cola del bocadillo hacia el botón */
	.chatbot-cartel::after {
		content: "";
		position: absolute;
		right: -10px;
		bottom: 28px;
		width: 0;
		height: 0;
		border-top: 8px solid transparent;
		border-bottom: 8px solid transparent;
		border-left: 10px solid #fff;
		filter: drop-shadow(2px 0 1px rgba(0, 0, 0, 0.08));
	}
	.chatbot-cartel-texto {
		margin: 0 0 10px 0;
	}
	.chatbot-cartel strong {
		color: var(--color-principal, #007bff);
	}
	.chatbot-cartel-ok {
		display: block;
		width: 100%;
		text-align: right;
		padding: 4px 0 0 0;
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-principal, #007bff);
		background: none;
		border: none;
		cursor: pointer;
		transition: color 0.2s, opacity 0.2s;
	}
	.chatbot-cartel-ok:hover {
		color: #0056b3;
		opacity: 0.85;
	}

	@media (max-width: 480px) {
		.chatbot-cartel {
			max-width: 200px;
			font-size: 0.8rem;
			right: 70px;
			padding: 10px 14px 12px 12px;
		}
		.chatbot-cartel::after {
			bottom: 24px;
		}
	}
</style>
