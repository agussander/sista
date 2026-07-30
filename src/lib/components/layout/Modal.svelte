<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { modal, selectedPlan } from "$lib/stores";
    import { fly, fade } from 'svelte/transition';
    import Recaptcha from '../ui/Recaptcha.svelte';
    import PlanDetails from '../ui/PlanDetails.svelte';
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
            const recaptchaToken = await recaptchaComponent.execute('modal_form');
            
            if (!recaptchaToken) {
                alert('Error al verificar reCAPTCHA. Por favor, intenta nuevamente.');
                loading = false;
                return;
            }

            const formData = new FormData();
            formData.append('nombre', formElement.querySelector('[name="nombre"]').value);
            formData.append('contacto', formElement.querySelector('[name="contacto"]').value);
            formData.append('g-recaptcha-response', recaptchaToken);

            const response = await fetch(FORM_ENDPOINTS.MODAL, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                $modal = false;
                selectedPlan.set(null);
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

<div class="super-cont">
    <div in:fly={{ y: 200, duration: 500 }} out:fly class="modal">
        <button class="close-btn" on:click={() => { $modal = false; selectedPlan.set(null); }} aria-label="Cerrar modal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
        {#if $selectedPlan}
            <PlanDetails />
        {/if}
        
        <div class="modal-bottom">
            <div class="modal-cont">
                <div class="modal-content-wrapper">
                    <div class="icon-wrapper">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <h2>Atención personalizada</h2>
                    <p class="modal-subtitle">Resolvemos tus dudas y te brindamos toda la información que necesitás</p>
                    <a target="_blank" class="btn-whatsapp-secondary" href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        Iniciar conversación
                    </a>
                </div>
            </div>
            <div class="form-wsp">
                <div class="form-header">
                    <h3>Quiero que me contacten</h3>
                    <p class="form-subtitle">Dejanos tus datos y te contactaremos a la brevedad</p>
                </div>
                <form bind:this={formElement} on:submit={handleSubmit}>
                    <div class="input-group">
                        <input type="text" name="nombre" placeholder="Nombre" required>
                    </div>
                    <div class="input-group">
                        <input type="text" name="contacto" placeholder="WhatsApp / Email / Teléfono" required>
                    </div>
                    
                    {#if mounted}
                        <Recaptcha bind:this={recaptchaComponent} on:ready={handleRecaptchaReady} />
                    {/if}

                    <button type="submit" class="btn-primary" disabled={!isVerified || loading}>
                        {loading ? 'Enviando...' : 'Recibir información'}
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>

<button type="button" class="back" aria-label="Cerrar modal" on:click={() => { $modal = false; selectedPlan.set(null); }} out:fade></button>

<style>
    button[disabled] {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
    }
    
    .super-cont {
        width: 95%;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1200;
        max-width: 900px;
        max-height: 90vh;
        padding: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
    }

    .super-cont::-webkit-scrollbar {
        width: 0.4rem;
    }

    .super-cont::-webkit-scrollbar-track {
        background: transparent;
    }

    .super-cont::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.35);
        border-radius: 1rem;
    }
    
    .back {
        position: fixed;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 1100;
        top: 0;
        left: 0;
        border: none;
        padding: 0;
        cursor: pointer;
    }
    
    .modal {
        background: transparent;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 3rem;
        padding-top: 3.5rem;
    }
    
    .close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.4);
        background: rgba(255, 255, 255, 0.95);
        color: var(--text);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(6px);
    }
    
    .close-btn:hover {
        background: #f3f4f6;
    }
    
    @media (max-width: 767px) {
        .close-btn {
            top: 0.5rem;
            right: 0.5rem;
        }
    }
    
    .modal-bottom {
        display: flex;
        flex-direction: column;
        background: white;
        border-radius: 1.2rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        margin-bottom: calc(0.8rem + env(safe-area-inset-bottom, 0));
    }
    
    .modal-cont {
        background: linear-gradient(135deg, var(--violeta1) 0%, var(--violeta2) 100%);
        padding: 3rem 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        position: relative;
    }
    
    .modal-content-wrapper {
        text-align: center;
        position: relative;
        z-index: 1;
        max-width: 400px;
    }
    
    .icon-wrapper {
        width: 4rem;
        height: 4rem;
        background: transparent;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1.5rem;
        color: white;
    }
    
    .modal-cont h2 {
        color: white;
        font-size: 2rem;
        font-weight: 700;
        margin: 0 0 1rem 0;
        text-align: center;
    }
    
    .modal-subtitle {
        color: rgba(255, 255, 255, 0.95);
        font-size: 1rem;
        line-height: 1.6;
        margin: 0 0 2rem 0;
        text-align: center;
    }
    
    
    .form-wsp {
        background: white;
        padding: 2.5rem 2rem;
    }
    
    .form-header {
        margin-bottom: 2rem;
        text-align: center;
    }
    
    .form-header h3 {
        color: var(--violeta1);
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0 0 0.5rem 0;
    }
    
    .form-subtitle {
        color: var(--text);
        font-size: 0.95rem;
        margin: 0;
        opacity: 0.8;
    }
    
    form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    
    .input-group {
        position: relative;
    }
    
    input {
        width: 100%;
        padding: 1rem 1.25rem;
        border: 2px solid #e5e7eb;
        border-radius: 0.75rem;
        font-size: 1rem;
        transition: all 0.3s ease;
        background: #f9fafb;
        box-sizing: border-box;
    }
    
    input:focus {
        outline: none;
        border-color: var(--violeta1);
        background: white;
        box-shadow: 0 0 0 3px rgba(112, 51, 207, 0.1);
    }
    
    input::placeholder {
        color: #9ca3af;
    }
    
    
    @media (min-width: 768px) {
        .super-cont {
            width: 90%;
        }
        
        .modal {
            flex-direction: column;
        }
        
        .modal-bottom {
            flex-direction: row;
        }
        
        .modal-cont {
            width: 50%;
            border-radius: 0;
            min-height: auto;
        }
        
        .form-wsp {
            width: 50%;
            border-radius: 0;
        }
        
        .modal-content-wrapper {
            max-width: 100%;
        }
    }
    
    @media (max-width: 767px) {
        .super-cont {
            width: 95%;
            top: 3%;
            transform: translateX(-50%);
            max-height: 95vh;
            padding: 0 0.5rem;
        }
        
        .modal-cont {
            border-radius: 0;
        }
        
        .form-wsp {
            border-radius: 0;
        }
    }
</style>