<script>
    import { onMount } from 'svelte';
    import { pb } from '$lib/pocketbase';
    import Spinner from '$lib/components/ui/Spinner.svelte';
    const TOLOSANO_STORAGE_KEY = 'tolosano_wifi_code';

    let wifiCode = $state(null); // código asignado desde la colección tolosano
    let step = $state('form'); // 'form' | 'loading' | 'code' | 'error'
    let errorMessage = $state('');
    let nombre = $state('');
    let mail = $state('');
    let telefono = $state('');
    let copiado = $state(false);
    let copyError = $state(false);

    onMount(() => {
        const saved = typeof localStorage !== 'undefined' && localStorage.getItem(TOLOSANO_STORAGE_KEY);
        if (saved) {
            wifiCode = saved;
            step = 'code';
        }
    });

    const nombreOk = $derived(nombre.trim().length > 2);
    const mailOk = $derived(/\.\w{2,}/.test(mail.trim()));
    const telefonoOk = $derived(telefono.replace(/\s/g, '').length >= 9);
    const progressCount = $derived([nombreOk, mailOk, telefonoOk].filter(Boolean).length);
    const progressPercent = $derived((progressCount / 3) * 100);
    const canSubmit = $derived(progressCount === 3);

    async function enviar() {
        if (!canSubmit) return;
        step = 'loading';
        errorMessage = '';
        try {
            // 1. Intentar guardar datos del usuario (si falla, igual seguimos y entregamos el código)
            try {
                await pb.collection('tolosano_data').create({
                    nombre: nombre.trim(),
                    mail: mail.trim(),
                    tel: telefono.trim()
                });
            } catch (_) {
                // No bloqueamos: entregamos el código de todas formas
            }

            // 2. Buscar el primer registro con used = false
            const list = await pb.collection('tolosano').getList(1, 1, {
                filter: 'used = false',
                sort: 'created'
            });
            const record = list.items[0];
            if (!record) {
                step = 'error';
                errorMessage = 'No hay códigos disponibles en este momento.';
                return;
            }

            // 3. Guardar el código en una constante (el que le daremos al usuario)
            const code = record.code;

            // 4. Marcar como usado en PocketBase (used = true)
            await pb.collection('tolosano').update(record.id, { used: true });

            // 5. Entregar ese código al usuario
            wifiCode = code;
            try {
                localStorage.setItem(TOLOSANO_STORAGE_KEY, wifiCode);
            } catch (_) {}
            step = 'code';
        } catch (e) {
            step = 'error';
            errorMessage = e?.message || 'No se pudo obtener un código. Intentá de nuevo.';
        }
    }

    async function copyToClipboard() {
        if (!wifiCode) return;
        copiado = false;
        copyError = false;
        const text = wifiCode;

        const doCopy = (el) => {
            el.select();
            el.setSelectionRange(0, 99999);
            try {
                const ok = document.execCommand('copy');
                if (ok) {
                    copiado = true;
                    setTimeout(() => (copiado = false), 2500);
                } else {
                    copyError = true;
                }
            } catch (e) {
                copyError = true;
            }
        };

        const fallback = () => {
            const visibleInput = document.querySelector('.codigo-input');
            if (visibleInput) {
                visibleInput.focus();
                doCopy(visibleInput);
                return;
            }
            const el = document.createElement('textarea');
            el.value = text;
            el.setAttribute('readonly', '');
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            el.style.top = '0';
            el.style.fontSize = '16px';
            document.body.appendChild(el);
            el.focus();
            doCopy(el);
            document.body.removeChild(el);
        };

        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                copiado = true;
                setTimeout(() => (copiado = false), 2500);
            } catch (e) {
                fallback();
            }
        } else {
            fallback();
        }
    }

    function generarNuevoCodigo() {
        try {
            localStorage.removeItem(TOLOSANO_STORAGE_KEY);
        } catch (_) {}
        wifiCode = null;
        nombre = '';
        mail = '';
        telefono = '';
        step = 'form';
        errorMessage = '';
        copiado = false;
        copyError = false;
    }
</script>

<main>
    <div class="upper-half">
        <header class="top-block">
            <h1 class="titulo">Conectate a nuestra red WIFI</h1>
            <div class="logos">
                <img src="/images/Sista-logo-violeta.svg" alt="Sista" class="logo logo-sista" />
                <img src="/images/multifibra.png" alt="Multifibra" class="logo logo-multifibra" />
            </div>
        </header>
    </div>

    <div class="content">
        <div class="wrap">
            {#if step === 'form'}
            <p class="subtitle">Completa los datos para obtener tu acceso.</p>
            <form class="card" onsubmit={(e) => { e.preventDefault(); enviar(); }}>
                <div class="fields">
                    <label for="nombre">Nombre</label>
                    <input id="nombre" type="text" bind:value={nombre} placeholder="Tu nombre" required />
                </div>
                <div class="fields">
                    <label for="mail">Mail</label>
                    <input id="mail" type="email" bind:value={mail} placeholder="tu@mail.com" required />
                </div>
                <div class="fields">
                    <label for="telefono">Teléfono</label>
                    <input id="telefono" type="tel" bind:value={telefono} placeholder="11 1234-5678" required />
                </div>
                <button
                    type="submit"
                    class="btn-submit"
                    disabled={!canSubmit}
                    style="--progress: {progressPercent}%"
                >
                    <span class="btn-progress" aria-hidden="true"></span>
                    <span class="btn-text">Conectarme</span>
                </button>
            </form>
        {:else if step === 'loading'}
            <div class="card card-loading">
                <Spinner size={40} color="#666" trackColor="#e0e0e0" borderWidth={3} label="Generando tu código..." />
            </div>
        {:else if step === 'error'}
            <div class="card card-error">
                <p class="error-text">{errorMessage}</p>
                <button type="button" class="btn-retry" onclick={() => { step = 'form'; errorMessage = ''; }}>
                    Volver a intentar
                </button>
            </div>
        {:else}
            <div class="card card-code">
                <p class="mensaje-codigo">Conectate a nuestra red usando esta contraseña:</p>
                <div class="codigo-block">
                    <input
                        type="text"
                        class="codigo-input"
                        value={wifiCode ?? ''}
                        readonly
                        aria-label="Contraseña WiFi"
                    />
                    <button
                        type="button"
                        class="btn-copy"
                        onclick={copyToClipboard}
                        aria-label="Copiar contraseña"
                    >
                        {#if copiado}
                            <span class="copy-ok">¡Copiado!</span>
                        {:else if copyError}
                            <span class="copy-fail">Seleccioná y copiá</span>
                        {:else}
                            <img src="/images/copy.svg" alt="" class="copy-icon" />
                            <span>Copiar</span>
                        {/if}
                    </button>
                    <button
                        type="button"
                        class="btn-nuevo-codigo"
                        onclick={generarNuevoCodigo}
                    >
                        Generar nuevo código
                    </button>
                </div>
            </div>
        {/if}
        </div>
    </div>
</main>

<style>
    main {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: url('/images/tolosano-fondo.png') no-repeat center center;
        background-size: cover;
        background-attachment: fixed;
        padding: 2rem 1.5rem;
        box-sizing: border-box;
    }

    .upper-half {
        flex-shrink: 0;
        margin-top: 3em;
        margin-bottom: 3em;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .top-block {
        max-width: 420px;
        width: 100%;
        padding: 0 0.5rem;
        text-align: center;
    }

    .content {
        min-height: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .wrap {
        width: 100%;
        max-width: 420px;
        margin: 0 auto;
        padding: 0;
    }


    .titulo {
        color: #153556;
        font-size: 1.35rem;
        font-weight: 700;
        text-align: center;
        margin: 0 0 1rem 0;
        line-height: 1.3;
    }

    .subtitle {
        color: #444;
        font-size: 0.95rem;
        text-align: center;
        margin: 0 0 1rem 0;
    }

    .logos {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.25rem;
        margin-bottom: 1.5rem;
        padding: 0 0.5rem;
    }

    .logo {
        height: 44px;
        width: auto;
        max-width: 45%;
        object-fit: contain;
    }

    .logo-multifibra {
        max-height: 44px;
    }

    .card {
        background: #fff;
        border-radius: 8px;
        padding: 1.5rem 1.25rem;
        border: 1px solid #e0e0e0;
        box-shadow: none;
    }

    .fields {
        margin-bottom: 1rem;
    }

    .fields label {
        display: block;
        font-size: 0.9rem;
        font-weight: 500;
        color: #333;
        margin-bottom: 0.35rem;
    }

    .card input[type='text'],
    .card input[type='email'],
    .card input[type='tel'] {
        width: 100%;
        padding: 0.75rem 1rem;
        font-size: 16px;
        border: 1px solid #ccc;
        border-radius: 6px;
        color: #1a1a1a;
        background: #fff;
        box-sizing: border-box;
    }

    .card input::placeholder {
        color: #888;
    }

    .card input:focus {
        outline: none;
        border-color: #666;
    }

    .btn-submit {
        width: 100%;
        margin-top: 0.5rem;
        background: #888;
        color: #fff;
        font-weight: 600;
        padding: 0.875rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        cursor: pointer;
        position: relative;
        overflow: hidden;
    }

    .btn-submit .btn-progress {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: var(--progress, 0%);
        background: #153556;
        border-radius: 6px;
        transition: width 0.3s ease;
    }

    .btn-submit .btn-text {
        position: relative;
        z-index: 1;
        color: #fff;
    }

    .btn-submit:hover:not(:disabled) .btn-progress {
        filter: brightness(1.1);
    }

    .btn-submit:disabled {
        cursor: not-allowed;
    }

    .card-loading {
        text-align: center;
        padding: 2rem 1.5rem;
        color: #555;
        font-weight: 500;
        font-size: 0.95rem;
    }

    .card-error {
        text-align: center;
        padding: 2rem 1.5rem;
    }

    .error-text {
        color: #c62828;
        font-weight: 500;
        margin: 0 0 1rem 0;
        font-size: 0.95rem;
    }

    .btn-retry {
        background: #153556;
        color: #fff;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
    }

    .btn-retry:hover {
        background: #1e4976;
    }

    .mensaje-codigo {
        text-align: center;
        color: #444;
        font-weight: 500;
        margin: 0 0 0.75rem 0;
        font-size: 0.95rem;
    }

    .codigo-block {
        background: #f2f2f2;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .codigo-input {
        width: 100%;
        padding: 0.875rem 1rem;
        font-size: 1.35rem;
        font-weight: 700;
        letter-spacing: 0.15em;
        text-align: center;
        border: 1px solid #ddd;
        border-radius: 6px;
        color: #1a1a1a;
        background: #fff;
        box-sizing: border-box;
    }

    .btn-copy {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.875rem 1.25rem;
        font-size: 1rem;
        font-weight: 600;
        color: #fff;
        background: #153556;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        min-height: 48px;
        -webkit-tap-highlight-color: transparent;
    }

    .btn-copy:hover {
        background: #1e4976;
    }

    .btn-copy span,
    .btn-copy .copy-ok,
    .btn-copy .copy-fail {
        color: #fff;
    }

    .btn-copy:active {
        transform: scale(0.98);
    }

    .btn-nuevo-codigo {
        display: block;
        width: 100%;
        margin-top: 0.75rem;
        padding: 0.6rem 1rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: #153556;
        background: transparent;
        border: 1px solid #153556;
        border-radius: 6px;
        cursor: pointer;
    }

    .btn-nuevo-codigo:hover {
        background: #f0f4f8;
    }

    .copy-icon {
        width: 18px;
        height: 18px;
        filter: brightness(0) invert(1);
    }

    .copy-ok {
        color: #fff;
    }

    .copy-fail {
        font-size: 0.9rem;
        color: #fff;
        opacity: 0.95;
    }

    @media (max-width: 480px) {
        main {
            padding: 1.5rem 1.25rem;
        }

        .titulo {
            font-size: 1.2rem;
        }

        .logos {
            gap: 1rem;
            padding: 0 0.75rem;
            margin-bottom: 1.25rem;
        }

        .logo {
            height: 40px;
            max-width: 42%;
        }

        .logo-multifibra {
            max-height: 40px;
        }

        .card {
            padding: 1.25rem 1rem;
        }

        .codigo-block {
            padding: 0.875rem;
        }

        .codigo-input {
            font-size: 1.2rem;
            letter-spacing: 0.12em;
        }
    }
</style>
