<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import Recaptcha from '$lib/components/ui/Recaptcha.svelte';

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
            // Ejecutar reCAPTCHA v3 y obtener el token
            const recaptchaToken = await recaptchaComponent.execute('contact_form');
            
            if (!recaptchaToken) {
                alert('Error al verificar reCAPTCHA. Por favor, intenta nuevamente.');
                loading = false;
                return;
            }

            const formData = new FormData();
            formData.append('nombre', formElement.querySelector('[name="nombre"]').value);
            formData.append('tel', formElement.querySelector('[name="tel"]').value);
            formData.append('mensaje', formElement.querySelector('[name="mensaje"]').value);
            formData.append('g-recaptcha-response', recaptchaToken);

            const response = await fetch('/assets/send-form-contacto.php', {
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
    <input name="nombre" type="text" placeholder="Nombre" required>
    <input name="tel" type="text" placeholder="Teléfono/Correo electrónico" required>
    <textarea name="mensaje" required placeholder="Su mensaje aquí"></textarea>
    
    {#if mounted}
        <Recaptcha bind:this={recaptchaComponent} on:ready={handleRecaptchaReady} />
    {/if}

    <button type="submit" class="btn-primary btn-full" disabled={!recaptchaReady || loading}>{loading ? 'Cargando...' : 'Enviar'}</button>
</form>

<style>
    button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
    }
    form {
        position: relative;
        background: var(--verde);
        padding: 2em 1em;
        border-radius: .5rem;
        box-shadow: 0px .5em 1em rgba(0, 0, 0, 0.3);
        max-width: 30em;
        margin: 0 auto 2em;
    }
    input,
    textarea {
        border: none;
        border-radius: 0;
        display: block;
        font-size: 1em;
        margin-bottom: 2em;
        width: 100%;
        font-family: 'nexa';
        height: 2.5em;
        padding: .2em .5em;
        border-radius: .3em;
    }
    textarea {
        height: 10em;
    }
    @media (min-width: 768px) {
        form {
            padding: 2em;
        }
    }
</style>