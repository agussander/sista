<script>
import { slide } from 'svelte/transition';
import Options from './Options.svelte';
import { pb } from '$lib/pocketbase';
import {
	MOTIVO_OPTIONS,
	PAGO_MEDIO_OPTIONS,
	PROVEEDOR_OFERTA_OPTIONS,
	SI_NO_OPTIONS,
	CONTACTO_NO_MOTIVO_OPTIONS,
	CONFORMIDAD_OPTIONS,
	VOLVERIA_OPTIONS,
	createEmptyData,
	isMotivoPago,
	isMotivoProveedor,
	isProveedorOfertaOtro,
	isMotivoOtro,
	isPagoMedioOtro,
	isContactoNo,
	isContactoNoMotivoOtro,
	isVolveriaCondicionVisible,
	canSubmit,
	buildPayload
} from './encuestaBajaLogic.js';

const SI_NO_ICONS = { 'sí': '✓', no: '✕' };

let data = createEmptyData();

let canSend;
$: canSend = canSubmit(data);

let enviado;
let cargando;

const submit = async () => {
	cargando = true;
	canSend = false;
	try {
		await pb.collection('encuestadebaja').create({ data: buildPayload(data) });
		enviado = true;
	} catch (error) {
		console.error(error.data);
		alert(
			'Tu respuesta no pudo ser enviada. Revisa que todas las casillas obligatorias estén completas. Si el problema persiste, puedes comunicarte con nosotros'
		);
		canSend = true;
		cargando = false;
	}
};
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
{#if enviado}
<section class="gracias">
	<p><strong>Gracias por compartirnos tu opinión</strong></p>
	<p>Ya puedes cerrar esta página</p>
</section>
{:else}
<section>
	<form>
		<div>
			<Options title="¿Cuál fue el motivo principal de la baja?" data={MOTIVO_OPTIONS} bind:res={data.motivo} />
			{#if isMotivoOtro(data.motivo)}
				<textarea in:slide placeholder="Contanos el motivo" bind:value={data.motivoOtro}></textarea>
			{/if}
		</div>

		{#if isMotivoPago(data.motivo)}
			<div in:slide>
				<Options title="¿Qué medio de pago usabas habitualmente?" data={PAGO_MEDIO_OPTIONS} bind:res={data.pagoMedio} />
				{#if isPagoMedioOtro(data.pagoMedio)}
					<textarea in:slide placeholder="¿Qué medio de pago?" bind:value={data.pagoMedioOtro}></textarea>
				{/if}
			</div>
			<div in:slide>
				<Options
					title="¿Tuviste inconvenientes con la forma de pago o el proceso en sí?"
					data={SI_NO_OPTIONS}
					icons={SI_NO_ICONS}
					bind:res={data.pagoInconvenientes}
				/>
				<textarea placeholder="Comentario (opcional)" bind:value={data.pagoInconvenientesComentario}></textarea>
			</div>
		{/if}

		{#if isMotivoProveedor(data.motivo)}
			<div in:slide>
				<Options title="¿Qué ofrecía el nuevo proveedor?" data={PROVEEDOR_OFERTA_OPTIONS} bind:res={data.proveedorOferta} />
				{#if isProveedorOfertaOtro(data.proveedorOferta)}
					<textarea in:slide placeholder="¿Qué ofrecía? (opcional)" bind:value={data.proveedorOfertaOtro}></textarea>
				{/if}
			</div>
		{/if}

		<div>
			<Options
				title="Antes de la baja, ¿te comunicaste con nosotros para buscar una solución?"
				data={SI_NO_OPTIONS}
				icons={SI_NO_ICONS}
				bind:res={data.contactoPrevio}
			/>
		</div>

		{#if isContactoNo(data.contactoPrevio)}
			<div in:slide>
				<Options title="¿Por qué no te comunicaste?" data={CONTACTO_NO_MOTIVO_OPTIONS} bind:res={data.contactoNoMotivo} />
				{#if isContactoNoMotivoOtro(data.contactoNoMotivo)}
					<textarea in:slide placeholder="Contanos por qué" bind:value={data.contactoNoOtro}></textarea>
				{/if}
			</div>
		{/if}

		<div>
			<Options
				title="Del 1 al 10, ¿qué tan conforme estabas con el servicio antes de la baja?"
				data={CONFORMIDAD_OPTIONS}
				variant="scale"
				bind:res={data.conformidad}
			/>
		</div>

		<div>
			<h2>¿Qué podríamos haber hecho diferente para que sigas siendo cliente? <small>(opcional)</small></h2>
			<textarea bind:value={data.queDiferente}></textarea>
		</div>

		<div>
			<Options title="¿Considerarías volver a contratar el servicio en el futuro?" data={VOLVERIA_OPTIONS} bind:res={data.volveria} />
			{#if isVolveriaCondicionVisible(data.volveria)}
				<textarea placeholder="¿Bajo qué condición? (opcional)" in:slide bind:value={data.volveriaCondicion}></textarea>
			{/if}
		</div>

		<div>
			<h2>Comentarios adicionales <small>(opcional)</small></h2>
			<textarea bind:value={data.comentarios}></textarea>
		</div>

		<div>
			<h2>Datos de contacto <small>(opcional)</small></h2>
			<input type="text" placeholder="Nombre" bind:value={data.idNombre} />
			<input type="text" placeholder="Teléfono" bind:value={data.idTelefono} />
		</div>

		<button class="btn-1" class:disabled={!canSend} on:click|preventDefault={submit}>
			{cargando ? 'Cargando...' : 'Enviar'}
		</button>
		{#if !canSend && !cargando}
			<p class="hint">complete todos los datos obligatorios para enviar</p>
		{/if}
	</form>
</section>
{/if}
</main>

<style>
main {
	display: grid;
	place-items: center;
	width: 100vw;
	font-size: 1.1em;
}
section {
	max-width: 30em;
	padding: 6em 1em;
	width: 100%;
}
section.gracias {
	text-align: center;
}
section.gracias p {
	color: #333;
}
form > div {
	margin-bottom: 2.6em;
}
h2 {
	font-size: 1.1rem;
	text-transform: none;
	text-align: left;
	font-weight: 500;
	color: #333;
	margin: 0 0 .8em;
}
textarea,
input[type='text'] {
	display: block;
	width: 100%;
	margin-top: 1em;
	padding: .8em 1em;
	font-family: sans-serif;
	color: #333;
	background: white;
	border: none;
	border-radius: var(--border-radius);
	box-shadow: 0 .15em .6em rgba(0,0,0,.08);
}
textarea {
	height: 5em;
	resize: vertical;
}
textarea::placeholder,
input[type='text']::placeholder {
	color: #999;
}
button.btn-1 {
	width: 100%;
	border: none;
	cursor: pointer;
}
.disabled {
	background: #cfcfcf;
	color: #777;
	pointer-events: none;
}
.hint {
	font-size: .9rem;
	color: #999;
	text-align: center;
	margin-top: .8em;
}
</style>
