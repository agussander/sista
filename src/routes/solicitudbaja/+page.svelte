<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import ContactButtons from "$lib/components/ui/ContactButtons.svelte";
    import VoverAtras from "$lib/components/ui/VoverAtras.svelte";
    import Recaptcha from "$lib/components/ui/Recaptcha.svelte";
    import { MetaTags } from "svelte-meta-tags";
    import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';

    let loading = false;
    let mounted = false;
    let isVerified = false;
    let formElement;

    onMount(() => {
        mounted = true;
    });

    let recaptchaComponent;

    function handleRecaptchaReady() {
        isVerified = true;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        
        if (!isVerified || !recaptchaComponent) {
            alert('reCAPTCHA no está listo. Por favor, espera un momento e intenta nuevamente.');
            return;
        }
        
        loading = true;
        
        try {
            const recaptchaToken = await recaptchaComponent.execute('baja_form');
            
            if (!recaptchaToken) {
                alert('Error al verificar reCAPTCHA. Por favor, intenta nuevamente.');
                loading = false;
                return;
            }

            const formData = new FormData();
            formData.append('nombre', formElement.querySelector('[name="nombre"]').value);
            formData.append('mail', formElement.querySelector('[name="mail"]').value);
            formData.append('tel', formElement.querySelector('[name="tel"]').value);
            formData.append('motivo', formElement.querySelector('[name="motivo"]').value);
            formData.append('g-recaptcha-response', recaptchaToken);

            const response = await fetch(FORM_ENDPOINTS.BAJA, {
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

<MetaTags
    title='Sista - Solicitud de baja'
    description='Solicitud de baja del servicio'
></MetaTags>

<section>
    <VoverAtras></VoverAtras>
    <div class="card">
        <div class="title">
            <h1>Solicitud de baja</h1>
        </div>
        <form bind:this={formElement} on:submit={handleSubmit}>
            <div class="inputs">
                <input name="nombre" type="text" placeholder="Nombre completo o Nº de cliente" required>
                <input name="mail" type="email" placeholder="Correo electrónico" required>
                <input name="tel" type="tel" placeholder="Teléfono" required>
                <textarea name="motivo" cols="30" rows="10" placeholder="Motivo de la baja" required></textarea>
            </div>

            {#if mounted}
                <Recaptcha bind:this={recaptchaComponent} on:ready={handleRecaptchaReady} />
            {/if}
            
            <button type="submit" class="btn-secondary" disabled={!isVerified || loading}>{loading ? 'Cargando...' : 'Confirmar'}</button>
        </form>
    </div>
    <p>Para modificar un plan o servicio comunicate con nosotros</p>
    <ContactButtons></ContactButtons>
</section>

<style>
    button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
    }
    section {
        width: 100vw;
        min-height: 100vh;
        padding: 4em 1em 1em;
    }
    .card {
        background: white;
        border-radius: .8rem;
        box-shadow: 0 0 1em gray;
        padding: 0;
        overflow: hidden;
        margin: 0 auto 3em;
        max-width: 27em;
    }
    .title {
        background-color: var(--violeta2);
        width: 100%;
        height: 8em;
        padding: 1em;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    h1 {
        text-transform: uppercase;
        color: white;
        text-align: center;
        font-size: 1.6em;
    }
    form {
        width: 100%;
        padding: 3em 2em;
        position: relative;
    }
    p {
        text-align: center;
    }
    input,
    textarea {
        display: block;
        border: none;
        border-bottom: 2px solid var(--violeta2);
        font-family: sans-serif;
        font-size: 1rem;
        margin-bottom: 2em;
        background: none;
        padding: .5em;
        border-radius: 0;
        width: 100%;
    }
    textarea {
        height: 9em;
        resize: vertical;
    }
    @media (min-width: 768px) {
        section {
            padding-top: 6em;
        }
    }
</style>