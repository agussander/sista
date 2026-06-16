<script>
    import { selectedPlan, priceInfo, modal } from "$lib/stores";
    import { goto } from '$app/navigation';

    // Mapeo de nombres de planes a títulos
    const planTitles = {
        home: 'Home',
        fast: 'Fast',
        power: 'Power',
        gamer: 'Gamer',
        worker: 'Worker',
        max: 'Max'
    };

    // Descripciones genéricas para home, fast y max
    const genericDescriptions = {
        home: 'Uso básico. Ideal para redes sociales y pocos dispositivos',
        fast: 'Mayor velocidad para una experiencia más fluida',
        max: 'La máxima velocidad y estabilidad para hogares exigentes. Ideal para múltiples dispositivos, streaming en alta calidad, gaming y trabajo remoto sin interrupciones.'
    };

    // Beneficios detallados para cada item de los planes con beneficios
    const planBenefits = {
        power: {
            'Ilimitado': 'Navegación sin límites de datos: usá Internet todo lo que quieras, sin topes ni reducciones de velocidad.',
            'Mayor velocidad': 'Velocidad superior para descargas rápidas, streaming en alta calidad y videollamadas sin interrupciones.',
            'Más dispositivos': 'Conectá más dispositivos simultáneamente sin perder rendimiento. Ideal para hogares con muchas conexiones.'
        },
        gamer: {
            'Tráfico simétrico': 'Misma velocidad de subida y bajada. Perfecto para gaming competitivo y streaming en vivo.',
            'Ilimitado': 'Navegación sin límites de datos: jugá y descargá todo lo que quieras, sin topes ni reducciones de velocidad.',
            'Cableado a tu dispositivo': 'Instalación directa con cable ethernet a tu consola o PC para la menor latencia posible.'
        },
        worker: {
            'Tráfico simétrico': 'Velocidad simétrica ideal para videollamadas, subida de archivos grandes y trabajo remoto profesional.',
            'Ilimitado': 'Navegación sin límites de datos: trabajá y subí archivos todo lo que quieras, sin topes ni reducciones de velocidad.',
            'Cableado a tu puesto de trabajo': 'Conexión cableada directa a tu escritorio para máxima estabilidad y velocidad garantizada.'
        }
    };

    // Obtener el plan actual desde el store
    let planData = $derived.by(() => {
        if (!$selectedPlan) return null;
        return $priceInfo.find(p => p.plan === $selectedPlan) || null;
    });

    // Generar mensaje de WhatsApp
    let whatsappUrl = $derived.by(() => {
        if (!planData) return '';
        const planName = planTitles[planData.plan] || 'plan';
        const message = encodeURIComponent(`Hola, me interesa el plan ${planName}.`);
        return `https://api.whatsapp.com/send?phone=5492213541906&text=${message}`;
    });

    function handleCoberturaClick() {
        // Cerrar modal y hacer scroll a cobertura
        modal.set(false);
        selectedPlan.set(null);
        setTimeout(() => {
            goto('/#cobertura');
        }, 300);
    }

    function handlePreciosClick() {
        // Cerrar modal y navegar a precios
        modal.set(false);
        selectedPlan.set(null);
        setTimeout(() => {
            goto('/precios');
        }, 300);
    }
</script>

{#if planData}
    <div class="plan-details">
        <div class="plan-header">
            <h2 class="plan-title">{planTitles[planData.plan]}</h2>
            <p class="plan-mb">{planData.mb}mb</p>
        </div>

        <div class="plan-content">
            {#if planData.plan === 'home' || planData.plan === 'fast' || planData.plan === 'max'}
                <!-- Descripción genérica para home, fast y max -->
                <p class="plan-description">{genericDescriptions[planData.plan]}</p>
            {:else}
                <!-- Lista de beneficios detallados para power, gamer, worker -->
                <ul class="benefits-list">
                    {#each planData.items as item}
                        <li class="benefit-item">
                            <strong class="benefit-title">{item}</strong>
                            <span class="benefit-description">{planBenefits[planData.plan][item]}</span>
                        </li>
                    {/each}
                </ul>
            {/if}

            <div class="tv-note">
                <img class="icon-tv" src="/images/SVG/tv-green.svg" alt="icono-tv">
                Podés agregar TV a cualquier plan
            </div>

            <div class="cta-buttons">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" class="btn-whatsapp-modal">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    Consultar disponibilidad en mi hogar
                </a>
                <div class="secondary-buttons">
                    <button class="btn-secondary-modal" onclick={handleCoberturaClick}>
                        Consultar cobertura
                    </button>
                    <button class="btn-secondary-modal" onclick={handlePreciosClick}>
                        Ver precios completos
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .plan-details {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        padding: 2.5rem 2rem;
        border-radius: 1.2rem;
        width: 100%;
        box-sizing: border-box;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .plan-header {
        text-align: center;
        margin-bottom: 2rem;
        padding-bottom: 1.5rem;
        border-bottom: 2px solid #e5e7eb;
        position: relative;
    }


    .plan-title {
        color: var(--violeta1);
        font-size: 2.5rem;
        font-weight: 800;
        margin: 0 0 0.75rem 0;
        text-transform: capitalize;
        letter-spacing: -0.5px;
    }

    .plan-mb {
        display: inline-block;
        background: linear-gradient(135deg, var(--magenta), #e91e63);
        color: white;
        padding: 0.5rem 1.5rem;
        border-radius: 2rem;
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0;
        box-shadow: 0 4px 12px rgba(221, 62, 114, 0.3);
    }

    .plan-content {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .plan-description {
        color: var(--text);
        font-size: 1.05rem;
        line-height: 1.8;
        margin: 0;
        text-align: center;
        opacity: 0.9;
    }

    .benefits-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .benefit-item {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.25rem;
        background: white;
        border-radius: 0.75rem;
        border-left: 3px solid var(--violeta1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .benefit-title {
        color: var(--violeta1);
        font-size: 1.15rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .benefit-title::before {
        content: '•';
        color: var(--violeta1);
        font-size: 1.5rem;
        line-height: 1;
        font-weight: bold;
    }

    .benefit-description {
        color: var(--text);
        font-size: 0.95rem;
        line-height: 1.6;
        opacity: 0.85;
        padding-left: 0;
    }

    .tv-note {
        color: var(--text);
        padding: 0;
        margin: 0;
        text-align: left;
        font-weight: 500;
        font-size: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .tv-note .icon-tv {
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
    }

    .cta-buttons {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .btn-whatsapp-modal {
        background: linear-gradient(135deg, var(--violeta2), var(--violeta1));
        color: white;
        font-weight: 600;
        font-size: 1rem;
        padding: 0.875rem 1.75rem;
        border-radius: 1000px;
        box-shadow: 0 2px 8px rgba(102, 37, 124, 0.2);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: all 0.2s ease;
    }

    .btn-whatsapp-modal:hover {
        opacity: 0.95;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 37, 124, 0.3);
    }

    .btn-whatsapp-modal svg {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        fill: white;
    }

    .secondary-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: center;
    }

    .btn-secondary-modal {
        background: transparent;
        color: var(--violeta1);
        font-weight: 500;
        font-size: 1rem;
        padding: 0.875rem 1.75rem;
        border: 1.5px solid var(--violeta1);
        border-radius: 1000px;
        box-shadow: none;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-secondary-modal:hover {
        opacity: 0.8;
        background: rgba(102, 37, 124, 0.05);
    }

    @media (min-width: 768px) {
        .secondary-buttons {
            flex-direction: row;
            justify-content: center;
            gap: 1.5rem;
        }
    }
</style>

