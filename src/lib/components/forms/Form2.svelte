<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import Recaptcha from '$lib/components/ui/Recaptcha.svelte';
    import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';

    let loading = false;
    let mounted = false;
    let recaptchaReady = false;
    let formElement;
    let recaptchaComponent;

    onMount(() => {
        mounted = true;
    });

    function handleRecaptchaReady() {
        recaptchaReady = true;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        
        if (!recaptchaReady || !recaptchaComponent) {
            alert('reCAPTCHA no está listo. Por favor, espera un momento e intenta nuevamente.');
            return;
        }
        
        loading = true;
        
        try {
            const recaptchaToken = await recaptchaComponent.execute('empresas_form');
            
            if (!recaptchaToken) {
                alert('Error al verificar reCAPTCHA. Por favor, intenta nuevamente.');
                loading = false;
                return;
            }

            const formData = new FormData();
            formData.append('nombre', formElement.querySelector('[name="nombre"]').value);
            formData.append('empresa', formElement.querySelector('[name="empresa"]').value || '');
            formData.append('tel', formElement.querySelector('[name="tel"]').value);
            formData.append('mensaje', formElement.querySelector('[name="mensaje"]').value || '');
            formData.append('g-recaptcha-response', recaptchaToken);

            const response = await fetch(FORM_ENDPOINTS.EMPRESAS, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                goto('/gracias');
            } else {
                alert(result.message === 'recaptcha' 
                    ? 'Error en la verificación reCAPTCHA. Por favor, intenta nuevamente.' 
                    : 'Error al enviar el mensaje. Por favor, intenta nuevamente.');
                loading = false;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al enviar el mensaje. Por favor, intenta nuevamente.');
            loading = false;
        }
    }
</script>

<form bind:this={formElement} on:submit={handleSubmit}>
    <input name="nombre" required type="text" placeholder="Tu nombre">
    <input name="empresa" type="text" placeholder="Tu empresa">
    <input name="tel" required type="text" placeholder="Teléfono/Mail">
    <textarea name="mensaje" placeholder="Escribir mensaje"></textarea>
    
    {#if mounted}
        <Recaptcha bind:this={recaptchaComponent} on:ready={handleRecaptchaReady} />
    {/if}

    <button type="submit" class="btn-secondary" disabled={!recaptchaReady || loading}>{loading ? 'Cargando...' : 'Confirmar'}</button>
</form>

<style>
    button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
    }
    form {
        position: relative;
        background: white;
        display: flex;
        flex-flow: column wrap;
        width: 100%;
        max-width: 25em;
        padding: 2em;
        box-sizing: border-box;
        border-radius: .5em;
        box-shadow: var(--shadow);
    }
    input,
    textarea {
        border: none;
        border-bottom: 2px solid var(--violeta2);
        font-family: sans-serif;
        font-size: 1rem;
        margin-bottom: 2em;
        padding: .5em;
        border-radius: 0;
    }
    textarea {
        height: 8em;
    }
</style>