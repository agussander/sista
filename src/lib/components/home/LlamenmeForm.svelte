<script>
    import { onMount } from 'svelte';
    import Recaptcha from '$lib/components/ui/Recaptcha.svelte';

    let loading = false;
    let mounted = false;
    let recaptchaReady = false;
    let submitted = false;
    let errorMsg = '';
    let nombre = '';
    let numero = '';
    let website = ''; // honeypot
    let recaptchaComponent;

    onMount(() => {
        mounted = true;
    });

    function handleRecaptchaReady() {
        recaptchaReady = true;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        errorMsg = '';

        if (!recaptchaReady || !recaptchaComponent) {
            errorMsg = 'Esperá un momento e intentá de nuevo.';
            return;
        }

        loading = true;
        try {
            const token = await recaptchaComponent.execute('llamenme');
            if (!token) {
                errorMsg = 'No se pudo verificar reCAPTCHA. Intentá de nuevo.';
                loading = false;
                return;
            }

            const formData = new FormData();
            formData.append('nombre', nombre);
            formData.append('numero', numero);
            formData.append('website', website);
            formData.append('g-recaptcha-response', token);

            const response = await fetch('/assets/send-llamenme.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                submitted = true;
            } else {
                errorMsg = 'No pudimos enviar tus datos. Intentá de nuevo.';
                loading = false;
            }
        } catch (error) {
            console.error('Error:', error);
            errorMsg = 'Ocurrió un error. Intentá de nuevo.';
            loading = false;
        }
    }
</script>

<div class="llamenme">
    {#if submitted}
        <div class="success">
            <p class="success-title">¡Listo!</p>
            <p class="success-text">Te llamamos a la brevedad.</p>
        </div>
    {:else}
        <form on:submit={handleSubmit}>
            <input name="nombre" type="text" placeholder="Nombre" bind:value={nombre} required>
            <input name="numero" type="tel" placeholder="Número de teléfono" bind:value={numero} required>

            <!-- honeypot: invisible para humanos, los bots lo completan -->
            <input
                class="hp"
                type="text"
                name="website"
                tabindex="-1"
                autocomplete="off"
                bind:value={website}
                aria-hidden="true"
            >

            {#if mounted}
                <Recaptcha bind:this={recaptchaComponent} on:ready={handleRecaptchaReady} />
            {/if}

            {#if errorMsg}
                <p class="error">{errorMsg}</p>
            {/if}

            <button type="submit" class="btn-primary btn-full" disabled={!recaptchaReady || loading}>
                {loading ? 'Enviando…' : 'Quiero que me llamen'}
            </button>
        </form>
    {/if}
</div>

<style>
    .llamenme {
        background: #fff;
        padding: 1.5em;
        border-radius: 0.8rem;
        box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.15);
        width: 100%;
        max-width: 22em;
        box-sizing: border-box;
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    input {
        border: 1.5px solid #ddd;
        border-radius: 0.4em;
        font-size: 1em;
        width: 100%;
        font-family: 'nexa';
        height: 2.6em;
        padding: 0.2em 0.7em;
        box-sizing: border-box;
    }
    input:focus {
        outline: none;
        border-color: var(--violeta1);
    }
    .hp {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }
    .error {
        color: var(--magenta);
        font-size: 0.9em;
        margin: 0;
    }
    button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .success {
        text-align: center;
        padding: 1em 0;
    }
    .success-title {
        font-size: 1.4em;
        font-weight: 900;
        color: var(--violeta1);
        margin: 0 0 0.3em;
    }
    .success-text {
        margin: 0;
        color: #444;
    }
</style>
