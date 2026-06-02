<script>
    import { createEventDispatcher, onMount } from 'svelte';

    const dispatch = createEventDispatcher();
    const sitekey = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '6Lf2xAIsAAAAAMxjYuiVxsOuZSKBPyNeApJU1eo1';
    
    // Estado reactivo con Svelte 5
    let recaptchaReady = $state(false);
    let loadError = $state(null);

    // Función centralizada para cargar reCAPTCHA (solo se carga una vez)
    function loadRecaptcha() {
        // Verificar que estamos en el browser
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return Promise.reject(new Error('reCAPTCHA solo funciona en el browser'));
        }

        // Si ya hay una promesa de carga en curso, retornarla
        if (window.__recaptchaLoadPromise) {
            return window.__recaptchaLoadPromise;
        }

        // Si ya está cargado y listo, retornar promesa resuelta
        if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.ready) {
            return Promise.resolve();
        }

        // Verificar si el script ya existe en el DOM
        const existingScript = document.querySelector('script[src*="recaptcha/api.js?render"]');
        if (existingScript) {
            // Script existe pero grecaptcha puede no estar listo aún
            window.__recaptchaLoadPromise = new Promise((resolve, reject) => {
                const checkReady = () => {
                    if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.ready) {
                        window.grecaptcha.ready(resolve);
                    } else {
                        // Esperar a que el script se cargue
                        const timeout = setTimeout(() => {
                            reject(new Error('Timeout esperando reCAPTCHA'));
                        }, 10000);
                        
                        existingScript.addEventListener('load', () => {
                            clearTimeout(timeout);
                            if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.ready) {
                                window.grecaptcha.ready(resolve);
                            } else {
                                resolve();
                            }
                        }, { once: true });
                    }
                };
                
                if (existingScript.complete || existingScript.readyState === 'complete') {
                    checkReady();
                } else {
                    checkReady();
                }
            });
            return window.__recaptchaLoadPromise;
        }

        // Cargar el script según documentación oficial de Google
        window.__recaptchaLoadPromise = new Promise((resolve, reject) => {
            // Esperar a que el DOM esté listo
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    loadScript();
                });
            } else {
                loadScript();
            }

            function loadScript() {
                const script = document.createElement('script');
                script.src = `https://www.google.com/recaptcha/api.js?render=${sitekey}`;
                script.async = true;
                script.defer = true;
                
                let timeoutId = setTimeout(() => {
                    reject(new Error('Timeout cargando reCAPTCHA'));
                }, 15000);
                
                script.onload = () => {
                    clearTimeout(timeoutId);
                    // Según documentación oficial, usar grecaptcha.ready()
                    if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.ready) {
                        window.grecaptcha.ready(() => {
                            resolve();
                        });
                    } else {
                        // Fallback: esperar un poco más
                        setTimeout(() => {
                            if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.ready) {
                                window.grecaptcha.ready(resolve);
                            } else {
                                // Si después de esperar aún no está disponible, intentar resolver de todas formas
                                console.warn('reCAPTCHA puede no estar completamente listo');
                                resolve();
                            }
                        }, 500);
                    }
                };
                
                script.onerror = (error) => {
                    clearTimeout(timeoutId);
                    // Limpiar la promesa para permitir reintentos
                    window.__recaptchaLoadPromise = null;
                    reject(new Error('Error cargando reCAPTCHA: ' + (error.message || 'Script failed to load')));
                };
                
                try {
                    document.head.appendChild(script);
                } catch (err) {
                    clearTimeout(timeoutId);
                    window.__recaptchaLoadPromise = null;
                    reject(new Error('Error agregando script: ' + err.message));
                }
            }
        });

        return window.__recaptchaLoadPromise;
    }

    // Usar onMount para asegurar que el DOM esté listo
    onMount(() => {
        // Esperar un tick para asegurar que todo esté listo
        setTimeout(() => {
            loadRecaptcha()
                .then(() => {
                    recaptchaReady = true;
                    loadError = null;
                    dispatch('ready');
                })
                .catch((error) => {
                    console.error('Error inicializando reCAPTCHA:', error);
                    loadError = error;
                    recaptchaReady = false;
                    // No rechazar completamente, permitir que el usuario intente de nuevo
                });
        }, 100);
    });

    // Función para ejecutar reCAPTCHA v3 y obtener el token
    // Según documentación oficial: grecaptcha.execute(siteKey, {action})
    export async function execute(action = 'submit') {
        // Verificar que estamos en el browser
        if (typeof window === 'undefined') {
            throw new Error('reCAPTCHA solo funciona en el browser');
        }

        // Esperar a que reCAPTCHA esté listo si aún no lo está
        if (!recaptchaReady) {
            try {
                await loadRecaptcha();
                recaptchaReady = true;
                loadError = null;
            } catch (error) {
                console.error('Error cargando reCAPTCHA antes de ejecutar:', error);
                throw new Error('No se pudo cargar reCAPTCHA. Por favor, recarga la página e intenta nuevamente.');
            }
        }

        if (typeof window.grecaptcha === 'undefined' || !window.grecaptcha.execute) {
            throw new Error('reCAPTCHA no está disponible');
        }

        try {
            // Según documentación oficial de Google
            const token = await window.grecaptcha.execute(sitekey, { action });
            
            if (!token || typeof token !== 'string') {
                throw new Error('Token de reCAPTCHA inválido');
            }

            dispatch('verified', { token });
            return token;
        } catch (error) {
            console.error('Error ejecutando reCAPTCHA:', error);
            throw error;
        }
    }
</script>

<!-- reCAPTCHA v3 es invisible, no necesita contenedor -->