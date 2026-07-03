<script>
import Options from './Options.svelte';
import { pb } from '$lib/pocketbase';
import {
	MOTIVO_OPTIONS,
	PAGO_MEDIO_OPTIONS,
	SI_NO_OPTIONS,
	CONTACTO_NO_MOTIVO_OPTIONS,
	CONFORMIDAD_OPTIONS,
	VOLVERIA_OPTIONS,
	createEmptyData,
	isMotivoPago,
	isMotivoOtro,
	isPagoMedioOtro,
	isContactoNo,
	isContactoNoMotivoOtro,
	isVolveriaCondicionVisible,
	canSubmit,
	buildPayload
} from './encuestaBajaLogic.js';

let data = createEmptyData();

let canSend;
$: canSend = canSubmit(data);

let enviado;
let cargando;

const submit = async () => {
	cargando = true;
	canSend = false;
	try {
		await pb.collection('encuesta_baja').create(buildPayload(data));
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
<section>
	<p><strong>Gracias por compartirnos tu opinión</strong></p>
	<p>Ya puedes cerrar esta página</p>
</section>
{:else}
<section>
	<form>
		<div>
			<Options title="¿Cuál fue el motivo principal de la baja?" data={MOTIVO_OPTIONS} bind:res={data.motivo} />
			{#if isMotivoOtro(data.motivo)}
				<textarea placeholder="Contanos el motivo" bind:value={data.motivoOtro}></textarea>
			{/if}
		</div>

		{#if isMotivoPago(data.motivo)}
			<div>
				<Options title="¿Qué medio de pago usabas habitualmente?" data={PAGO_MEDIO_OPTIONS} bind:res={data.pagoMedio} />
				{#if isPagoMedioOtro(data.pagoMedio)}
					<textarea placeholder="¿Qué medio de pago?" bind:value={data.pagoMedioOtro}></textarea>
				{/if}
			</div>
			<div>
				<Options
					title="¿Tuviste inconvenientes con la forma de pago o el proceso en sí?"
					data={SI_NO_OPTIONS}
					bind:res={data.pagoInconvenientes}
				/>
				<textarea placeholder="Comentario (opcional)" bind:value={data.pagoInconvenientesComentario}></textarea>
			</div>
		{/if}

		<div>
			<Options
				title="Antes de la baja, ¿te comunicaste con nosotros para buscar una solución?"
				data={SI_NO_OPTIONS}
				bind:res={data.contactoPrevio}
			/>
		</div>

		{#if isContactoNo(data.contactoPrevio)}
			<div>
				<Options title="¿Por qué no te comunicaste?" data={CONTACTO_NO_MOTIVO_OPTIONS} bind:res={data.contactoNoMotivo} />
				{#if isContactoNoMotivoOtro(data.contactoNoMotivo)}
					<textarea placeholder="Contanos por qué" bind:value={data.contactoNoOtro}></textarea>
				{/if}
			</div>
		{/if}

		<div>
			<Options
				title="Del 1 al 10, ¿qué tan conforme estabas con el servicio antes de la baja?"
				data={CONFORMIDAD_OPTIONS}
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
				<textarea placeholder="¿Bajo qué condición? (opcional)" bind:value={data.volveriaCondicion}></textarea>
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
			<input type="text" placeholder="Número de cliente" bind:value={data.idCliente} />
		</div>

		<button class="btn-1" class:disabled={!canSend} on:click|preventDefault={submit}>
			{cargando ? 'Cargando...' : 'Enviar'}
		</button>
		{#if !canSend && !cargando}
			<p style="font-size: .9rem;">complete todos los datos obligatorios para enviar</p>
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
	padding: 4em 1em;
}
form > div {
	margin-bottom: 3em;
}
h2 {
	font-size: 1.1rem;
	text-transform: none;
	text-align: left;
	font-weight: 500;
}
textarea {
	font-family: sans-serif;
	width: 100%;
	height: 5em;
	margin-top: 1em;
}
input[type='text'] {
	display: block;
	width: 100%;
	margin-top: 1em;
	padding: 0.5em;
	font-family: sans-serif;
}
.disabled {
	background: gray;
	pointer-events: none;
}
</style>
