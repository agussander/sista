<script>
import { slide } from 'svelte/transition';
import NavigationButtons from './NavigationButtons.svelte';

let {selected='archivo', field, value=$bindable(), next, prev} = $props();

const button = {
    archivo: 'mediante enlace',
    enlace: 'como archivo',  
}

const handleSwitch = (e) => {
    e.preventDefault();
    selected = selected === 'archivo' ? 'enlace' : 'archivo';
}

</script>
<h4>{field.label}</h4>
<p>{field.detail}</p>
{#if selected=='archivo'}
    <div transition:slide>
        <label> <strong>Archivo</strong> <br>
            <small>Sube aquí tu archivo. El mismo no puede pesar más de 5mb. En caso contrario, por favor comprimelo o utiliza la opción de enviar mediante un enlace</small>
            <input type="file" name={field.name} bind:files={value}>
        </label>
        <br>
    </div>
{/if}
<button class='btn-3' onclick={handleSwitch}>
    Enviar {button[selected]}
</button>
{#if selected=='enlace'}
    <div transition:slide>
        <label>
            <strong>Enlace</strong> <br>
            <small>En caso de que el archivo pese más de 5mb, por favor subelo a un servicio de almacenamiento y envíanos el enlace. No envíes enlaces con caducidad o tiempo limitado.</small>
            <input type="url" name={field.name} placeholder="https://..." bind:value={value}>
        </label>
    </div>
{/if}
<NavigationButtons {next} {prev}></NavigationButtons>


<style>
@import '../styles.scss';

</style>