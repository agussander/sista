<script>
    import { onMount } from 'svelte';
    import Recaptcha from '$lib/components/ui/Recaptcha.svelte';
    import { computeCallHeading, computeWhatsappSublabel } from '$lib/llamenme/visibility.js';

    // Dentro de la ventana de atención se avisa directo en la tarjeta; fuera,
    // al enviar se abre el modal de preferencia de contacto. Lo decide el Hero
    // (horario real + override del admin).
    export let inCallWindow = true;

    const WHATSAPP_URL =
        'https://api.whatsapp.com/send?phone=5492213541906&text=' +
        encodeURIComponent('Hola! Dejé mi número en la web, ¿me contactan?');

    let loading = false;
    let mounted = false;
    let recaptchaReady = false;
    let submitted = false;
    let showModal = false;
    let modalHeading = '';
    let waSublabel = '';
    let successText = 'Te llamamos a la brevedad.';
    let successNote = 'Puede aparecerte como número privado o spam.';
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

    function messagesFor(extra) {
        if (extra === 'whatsapp') {
            return { text: 'Seguimos la charla por WhatsApp.', note: '' };
        }
        return {
            text: 'Te llamamos a la brevedad.',
            note: 'Puede aparecerte como número privado o spam.'
        };
    }

    // Ejecuta reCAPTCHA y guarda el lead (con la preferencia elegida). Devuelve
    // true si se guardó. Único punto de escritura para todos los caminos.
    async function postLead(extra) {
        if (!recaptchaReady || !recaptchaComponent) {
            errorMsg = 'Esperá un momento e intentá de nuevo.';
            return false;
        }

        loading = true;
        errorMsg = '';
        try {
            const token = await recaptchaComponent.execute('llamenme');
            if (!token) {
                errorMsg = 'No se pudo verificar reCAPTCHA. Intentá de nuevo.';
                loading = false;
                return false;
            }

            const formData = new FormData();
            formData.append('numero', numero);
            formData.append('extra', extra);
            formData.append('website', website);
            formData.append('g-recaptcha-response', token);

            const response = await fetch('/assets/send-llamenme.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                const m = messagesFor(extra);
                successText = m.text;
                successNote = m.note;
                submitted = true;
                showModal = false;
                loading = false;
                return true;
            }

            errorMsg = 'No pudimos enviar tus datos. Intentá de nuevo.';
            loading = false;
            return false;
        } catch (error) {
            console.error('Error:', error);
            errorMsg = 'Ocurrió un error. Intentá de nuevo.';
            loading = false;
            return false;
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        errorMsg = '';

        if (!recaptchaReady || !recaptchaComponent) {
            errorMsg = 'Esperá un momento e intentá de nuevo.';
            return;
        }

        if (inCallWindow) {
            // En horario: se llama al toque, sin modal.
            await postLead('en_horario');
        } else {
            // Fuera de horario: pedimos preferencia de contacto.
            modalHeading = computeCallHeading();
            waSublabel = computeWhatsappSublabel();
            showModal = true;
        }
    }

    const chooseManana = () => postLead('manana');
    const chooseTarde = () => postLead('tarde');

    function chooseWhatsapp() {
        // Abrir el chat dentro del gesto del click (evita el bloqueo de popups);
        // el lead se guarda en segundo plano.
        window.open(WHATSAPP_URL, '_blank', 'noopener');
        postLead('whatsapp');
    }

    // Cerrar el modal sin elegir igual registra el lead (ya dejó su número): no
    // queremos perderlo. Si hay un envío en curso, no interrumpimos.
    function closeModal() {
        if (loading) return;
        postLead('sin_preferencia');
    }
</script>

{#if showModal}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="modal-backdrop" on:click={closeModal}>
        <div class="modal" on:click|stopPropagation>
            <p class="modal-title">{modalHeading}</p>
            <p class="modal-sub">¿Cómo preferís que te contactemos?</p>
            <div class="modal-options">
                <button class="opt" on:click={chooseManana} disabled={loading}>
                    <span class="opt-label">Llamenme en la mañana</span>
                    <span class="opt-hint">de 9 a 13</span>
                </button>
                <button class="opt" on:click={chooseTarde} disabled={loading}>
                    <span class="opt-label">Llamenme en la tarde</span>
                    <span class="opt-hint">de 13 a 17</span>
                </button>
                <button class="opt opt-wa" on:click={chooseWhatsapp} disabled={loading}>
                    <span class="opt-label">Hablar por WhatsApp</span>
                    <span class="opt-hint">{waSublabel}</span>
                </button>
            </div>
            {#if errorMsg}
                <p class="error">{errorMsg}</p>
            {/if}
        </div>
    </div>
{/if}

<div class="llamenme-wrapper">
<div class="llamenme">
    {#if submitted}
        <div class="success">
            <p class="success-title">¡Listo!</p>
            <p class="success-text">{successText}</p>
            {#if successNote}
                <p class="success-note">{successNote}</p>
            {/if}
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
    .success-note {
        margin: 0.4em 0 0;
        font-size: 0.85em;
        color: #888;
    }

    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1.5em;
        box-sizing: border-box;
    }
    .modal {
        background: #fff;
        border-radius: 1rem;
        padding: 2em 1.75em 1.75em;
        max-width: 22em;
        width: 100%;
        box-shadow: 0 1em 3em rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.6em;
        text-align: center;
    }
    .modal-title {
        font-size: 1.15em;
        font-weight: 900;
        color: var(--violeta1);
        margin: 0;
        line-height: 1.3;
    }
    .modal-sub {
        font-size: 0.85em;
        color: #666;
        margin: 0;
    }
    .modal-options {
        display: flex;
        flex-direction: column;
        gap: 0.6em;
        width: 100%;
        margin-top: 0.75em;
    }
    .opt {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.1em;
        width: 100%;
        padding: 0.8em 1em;
        border: 1.5px solid #e0d6f0;
        border-radius: 0.6em;
        background: #fff;
        cursor: pointer;
        font-family: 'nexa';
        text-align: left;
        transition: background 0.15s, border-color 0.15s;
    }
    .opt:hover:not(:disabled) {
        background: #f3eefb;
        border-color: var(--violeta1);
    }
    .opt:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .opt-label {
        font-size: 1em;
        font-weight: 700;
        color: var(--violeta1);
    }
    .opt-hint {
        font-size: 0.8em;
        color: #888;
    }
    .opt-wa .opt-label {
        color: #128c7e;
    }
    .opt-wa {
        border-color: #bfe6dd;
    }
    .opt-wa:hover:not(:disabled) {
        background: #eafaf5;
        border-color: #128c7e;
    }
</style>
