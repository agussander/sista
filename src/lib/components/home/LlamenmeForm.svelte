<script>
    import { onMount } from 'svelte';
    import Recaptcha from '$lib/components/ui/Recaptcha.svelte';

    let loading = false;
    let mounted = false;
    let recaptchaReady = false;
    let submitted = false;
    let errorMsg = '';
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

<div class="llamenme-wrapper">
<div class="llamenme">
    {#if submitted}
        <div class="success">
            <p class="success-title">¡Listo!</p>
            <p class="success-text">Te llamamos a la brevedad.</p>
        </div>
    {:else}
        <form on:submit={handleSubmit}>
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
                {#if !loading}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {/if}
                {loading ? 'Enviando…' : 'Quiero que me llamen'}
            </button>
        </form>
    {/if}
</div>

<div class="extra-actions">
    <a href="https://clientes.sista.com.ar" target="_blank" rel="noopener noreferrer" class="action-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Clientes
    </a>
    <a href="/elegirplan" class="action-btn">
        Ver planes
    </a>
</div>

</div>

<style>
    .llamenme-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1em;
        width: 100%;
        max-width: 22em;
    }
    .llamenme {
        background: #fff;
        padding: 1.5em;
        border-radius: 0.8rem;
        box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.15);
        width: 100%;
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
    button svg {
        flex-shrink: 0;
    }
    .btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5em;
    }
    .extra-actions {
        display: flex;
        gap: 0.75em;
        width: 100%;
    }
    .action-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4em;
        padding: 0.7em 1em;
        border-radius: 1000px;
        border: none;
        background: #fff;
        color: var(--violeta1);
        font-family: 'nexa';
        font-size: 0.9em;
        font-weight: 700;
        text-decoration: none;
        box-shadow: 0 0.25em 0.6em rgba(0, 0, 0, 0.08);
        transition: background 0.15s;
    }
    .action-btn:hover {
        background: #f3f4f6;
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
