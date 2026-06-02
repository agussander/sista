<script>
import {pasoCompleto, datosBaja, paso} from './bajaStore.js'
import StepButtons from './StepButtons.svelte';
import { onMount } from 'svelte';

// Configuración de reCAPTCHA desde env
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY_BAJA ?? '6LdBk_YmAAAAAJAM7B2-HXaobQq3lyQt6u5hNDGa';
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('tu-dominio.com');

let recaptchaReady = false;
let recaptchaDebugMode = true; // Habilitar debug siempre (cambiar a IS_LOCALHOST para producción)
let recaptchaToken = null;

// Función de debugging
function debugRecaptcha(message, data = null) {
    if (recaptchaDebugMode) {
        console.log(`[reCAPTCHA DEBUG] ${message}`, data || '');
    }
}

// Usar un nombre de callback estático para que el script de Google pueda encontrarlo de forma fiable
const recaptchaCallbackName = 'onRecaptchaLoad';

onMount(() => {
    // Permitir forzar modo debug con parámetro URL
    const urlParams = new URLSearchParams(window.location.search);
    const forceDebug = urlParams.get('debug') === 'recaptcha';
    if (forceDebug) {
        recaptchaDebugMode = true;
        debugRecaptcha('Modo debug forzado via URL');
    }
    
    debugRecaptcha('Componente montado', { isLocalhost: IS_LOCALHOST, debugMode: recaptchaDebugMode });
    
    // Comentado: Bypass de localhost para que funcione igual en dev y prod
    // if (IS_LOCALHOST) {
    //     debugRecaptcha('Modo localhost detectado - simulando reCAPTCHA listo');
    //     recaptchaReady = true;
    //     recaptchaToken = 'localhost-bypass-token';
    //     return;
    // }

    // Callback que se ejecuta cuando reCAPTCHA se carga completamente
    window[recaptchaCallbackName] = () => {
        debugRecaptcha('Callback de reCAPTCHA ejecutado');
        
        // Verificar que grecaptcha esté disponible
        if (typeof window.grecaptcha !== 'undefined') {
            debugRecaptcha('grecaptcha cargado correctamente');
            recaptchaReady = true;
        } else {
            debugRecaptcha('grecaptcha no disponible después del callback');
        }
    };

    // Verificar si reCAPTCHA ya está cargado
    if (typeof window.grecaptcha !== 'undefined') {
        debugRecaptcha('reCAPTCHA ya cargado');
        recaptchaReady = true;
    } else if (!window.isRecaptchaScriptInjected) {
        debugRecaptcha('Cargando script de reCAPTCHA');
        window.isRecaptchaScriptInjected = true;
        
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}&onload=${recaptchaCallbackName}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            debugRecaptcha('Error cargando reCAPTCHA - activando fallback');
            recaptchaReady = true;
        };
        document.head.appendChild(script);
    } else {
        debugRecaptcha('Esperando carga de reCAPTCHA...');
    }
});

// Ya no se necesita onDestroy. Dejar el callback en `window` es seguro y necesario.

let rehacer=[];
let key;
let message;


const check=()=>{
    if(
    /^\d{8,9}$/.test($datosBaja.dni) //&&
    // $datosBaja.servicio!=='seleccionar' &&
    // $datosBaja.motivo!=='seleccionar' &&
    // $datosBaja.cliente.length>1
    
    ){
        $pasoCompleto=1;
    } else{
        $pasoCompleto=0;
    }
}

async function executeRecaptcha() {
    if (typeof window.grecaptcha === 'undefined' || typeof window.grecaptcha.execute !== 'function') {
        debugRecaptcha('grecaptcha.execute no disponible, usando fallback');
        return 'fallback-no-recaptcha';
    }
    try {
        return await new Promise((resolve, reject) => {
            window.grecaptcha.ready(() => {
                window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' })
                    .then(resolve)
                    .catch(reject);
            });
        });
    } catch (error) {
        console.error('Error obteniendo token de reCAPTCHA:', error);
        return 'fallback-no-recaptcha';
    }
}

async function fetchClientByDni() {
    try {
        const captchaToken = await executeRecaptcha();
        const response = await fetch('/assets/client-handler.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dni: $datosBaja.dni,
                token: captchaToken
            })
        });
        const data = await response.json();
        console.log('Respuesta de client-handler:', data);
        return data;
    } catch (error) {
        console.error('Error consultando cliente:', error);
        return { status: 'error', message: 'Error de conexión.' };
    }
}
function maskString(str) {
    // Si la longitud de la cadena es menor o igual a 7, se devuelve tal cual
    if (str.length <= 8) {
        return str;
    }
    
    // Tomar los primeros 7 caracteres y añadir el número de asteriscos según el largo restante
    return str.slice(0, 8) + '*'.repeat(str.length - 8);
}

// Función principal que coordina las otras dos
async function siguiente() {
    const isName = (x)=>{
        return !x.match(/^\d+$/)
    }

    const matchName = (x,y)=>{
        let a = x.toLowerCase().split(' ');
        let b = y.toLowerCase().split(' ')
        let match=0;
        for(let i=0; i<a.length; i++){
            if(b.includes(a[i])){
                match++
            }
        }
        return match>=2
    }

    const validate = async ()=>{
        message=null;

        const result = await fetchClientByDni();

        if (result.status !== 'success' || !result.data) {
            if (result.message === 'DNI not found in the database.') {
                message = 'No pudimos encontrar este dni en nuestra base de datos. Revisa que sea correcto y no uses puntos ni espacios. Si el problema persiste, comunicate con nosotros.';
            } else if (result.message === 'Captcha verification failed.') {
                message = 'No pudimos validar el captcha. Recargá la página e intentá de nuevo.';
            } else {
                message = 'Error de conexión. Por favor, intenta nuevamente.';
            }
            return false;
        }

        const res = result.data;

        $datosBaja.domicilio = maskString(res.address);
        $datosBaja.domicilioOriginal = res.address;
        $datosBaja.code = res.code;

        if (isName($datosBaja.cliente.trim())) {
            return matchName($datosBaja.cliente, res.name);
        }
        return $datosBaja.cliente.trim() == res.code;
    }


    const validationResult = await validate();
    console.log('Resultado de validación:', validationResult);
    debugRecaptcha('Resultado final de validación:', validationResult);
    
    if(validationResult){
        console.log('Validación exitosa, avanzando al siguiente paso');
        debugRecaptcha('✅ Validación exitosa, avanzando al siguiente paso');
        $paso++
    } else{
        console.log('Validación fallida, mostrando mensaje de error');
        debugRecaptcha('❌ Validación fallida, mostrando mensaje de error');
        message = 'Parece que los datos no coinciden. Por favor, ingresa tu nombre completo o tu número de cliente. Si el problema persiste, puede que tengas que comunicarte con nosotros para modificar alguno de estos datos.'
    }
}




let displayAlert;
const validateDni=()=>{
    if(!/^\d{8,9}$/.test($datosBaja.dni)){
        displayAlert=true;
    } else{
        displayAlert=false;
    }
}

</script>

{#key key}

    <!--Dni del titular-->
    <label>
        Dni del Titular
        <input  name="dni"
        class:rehacer={rehacer.includes('dni')}
        bind:value={$datosBaja.dni} type="text" inputmode="numeric"
        onblur={()=>validateDni()}
        onkeyup={()=>check()}
        placeholder="Ej: 111111111"
        >
        {#if displayAlert}
            Por favor, corrobore su dni
        {/if}
        
    </label>

    <label for="cliente">
        Nombre de cliente o Número de cliente
        <input type="text" name='cliente'
        bind:value={$datosBaja.cliente}
        onkeyup={()=>check()}
        >
    </label>
    {#if message}
        {message}
    {/if}

    <!-- Panel de Debug de reCAPTCHA -->
    {#if recaptchaDebugMode}
        <div class="debug-panel">
            <h4>🔧 Debug reCAPTCHA</h4>
            <div class="debug-info">
                <p><strong>Estado:</strong> {recaptchaReady ? '✅ Listo' : '❌ No listo'}</p>
                <p><strong>Modo:</strong> {IS_LOCALHOST ? '🏠 Localhost (Bypass)' : '🌐 Producción'}</p>
                <p><strong>Token:</strong> {recaptchaToken ? '✅ Disponible' : '❌ No disponible'}</p>
                <p><strong>grecaptcha:</strong> {typeof window.grecaptcha !== 'undefined' ? '✅ Cargado' : '❌ No cargado'}</p>
                <p><strong>Site Key:</strong> {RECAPTCHA_SITE_KEY}</p>
                <p><strong>Hostname:</strong> {window.location.hostname}</p>
                <p><strong>Script Inyectado:</strong> {window.isRecaptchaScriptInjected ? '✅ Sí' : '❌ No'}</p>
            </div>
            <div class="debug-actions">
                <button onclick={() => {
                    recaptchaDebugMode = !recaptchaDebugMode;
                    console.log('Debug mode toggled:', recaptchaDebugMode);
                }} class="debug-toggle">
                    Ocultar Debug
                </button>
                <button onclick={() => {
                    debugRecaptcha('Forzando inicialización manual...');
                    if (typeof window.grecaptcha === 'object' && window.grecaptcha !== null) {
                        recaptchaReady = true;
                        debugRecaptcha('Inicialización forzada exitosa');
                    } else {
                        debugRecaptcha('grecaptcha no disponible para forzar inicialización');
                    }
                }} class="debug-toggle">
                    Forzar Inicialización
                </button>
                <button onclick={() => {
                    console.log('=== ESTADO reCAPTCHA ===');
                    console.log('grecaptcha:', typeof window.grecaptcha);
                    console.log('execute:', typeof window.grecaptcha?.execute);
                    console.log('ready:', recaptchaReady);
                }} class="debug-toggle">
                    Ver Estado
                </button>
            </div>
        </div>
    {/if}

    <StepButtons siguiente={siguiente} disabled={!recaptchaReady}></StepButtons>

{/key}


<style>

.rehacer{
    border-color: var(--magenta);
}

label{
    display: block;
    margin-bottom: .5em;
    color: var(--text);
    font-size: 1em;
    font-weight: 500;
    margin-bottom: 2em;

}
input{
    border-color: var(--violeta2);
    border-style: solid;
    border-width: 1.5px;
    border-radius: 5px;
    font-family: sans-serif;
    font-weight: 1em;
    padding: .2em .4em;
    display: block;
    width: 100%;
}


/* Estilos para el panel de debug */
.debug-panel {
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 1em;
    margin: 1em 0;
    font-family: monospace;
    font-size: 0.9em;
}

.debug-panel h4 {
    margin: 0 0 0.5em 0;
    color: #495057;
    font-size: 1em;
}

.debug-info p {
    margin: 0.3em 0;
    color: #6c757d;
}

.debug-toggle {
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5em 1em;
    font-size: 0.8em;
    cursor: pointer;
    margin-top: 0.5em;
}

.debug-toggle:hover {
    background: #0056b3;
}

.debug-actions {
    display: flex;
    gap: 0.5em;
    margin-top: 0.5em;
}

    </style>