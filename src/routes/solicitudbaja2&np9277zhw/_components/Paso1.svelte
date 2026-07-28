<script>
import { datosBaja, paso } from './bajaStore.js';
import StepButtons from './StepButtons.svelte';

const siguiente = () => {
    $paso++;
};
</script>

<label>
    Dni del Titular
    <input
        name="dni"
        bind:value={$datosBaja.dni}
        type="text"
        inputmode="numeric"
        placeholder="Ej: 111111111"
    >
</label>

<label for="cliente">
    Nombre de cliente o Número de cliente
    <input type="text" name="cliente" bind:value={$datosBaja.cliente}>
</label>

<StepButtons siguiente={siguiente}></StepButtons>

<style>
label {
    display: block;
    margin-bottom: 2em;
    color: var(--text);
    font-size: 1em;
    font-weight: 500;
}

input {
    border-color: var(--violeta2);
    border-style: solid;
    border-width: 1.5px;
    border-radius: 5px;
    font-family: sans-serif;
    font-weight: 1em;
    padding: 0.2em 0.4em;
    display: block;
    width: 100%;
}
</style>
