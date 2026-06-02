<script>
import { MetaTags } from "svelte-meta-tags";
import { page } from '$app/stores';
import { browser } from '$app/environment';
import { onMount } from 'svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';

export let link;
/**
 * Datos explícitos para Google Analytics 4 (gtag).
 * Usar en cada página para tracking preciso:
 *
 * @param {string} campaignName - Nombre de la campaña/QR (ej: "Stand", "Revista Impacto")
 * @param {string} category - Categoría para segmentar en GA4 (ej: "qr", "whatsapp", "volante", "stand")
 * @param {string} [source] - Fuente/origen del tráfico (ej: "qr_code", "printed_material")
 */
export let gtag = { campaignName: '', category: '', source: '' };

// Google Analytics 4 - Función para esperar a que gtag esté disponible
function waitForGtag() {
    return new Promise((resolve) => {
        if (typeof window.gtag !== 'undefined') {
            resolve();
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos máximo
        
        const checkGtag = setInterval(() => {
            attempts++;
            if (typeof window.gtag !== 'undefined') {
                clearInterval(checkGtag);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkGtag);
                resolve(); // Resolver de todas formas para no bloquear
            }
        }, 100);
    });
}

// Tracking en Google Analytics 4 usando datos explícitos
onMount(async () => {
    if (browser) {
        await waitForGtag();
        
        if (typeof window.gtag !== 'undefined') {
            const currentPath = $page.url.pathname;
            const campaignName = (gtag.campaignName || 'unknown').replace(/[^a-zA-Z0-9\s]/g, '_');
            const category = gtag.category || 'other';
            const source = gtag.source || 'redirect';
            
            // Evento personalizado con datos completos
            window.gtag('event', 'qr_scan', {
                'campaign_name': campaignName,
                'campaign_category': category,
                'campaign_source': source,
                'page_path': currentPath,
                'page_title': 'Internet SISTA',
                'redirect_to': link
            });
            
            // page_view para esta página antes del redirect
            window.gtag('config', 'G-KP96BL9H2Q', {
                page_path: currentPath,
                page_title: 'Internet SISTA'
            });
        }
    }
});

</script>

<svelte:head>
    <meta http-equiv="refresh" content="2; url={link}">
</svelte:head>

<MetaTags title="Internet SISTA"></MetaTags>

<main>
    <img src="/images/logo-sista.svg" alt="">
    <div class="loader">
        <Spinner
            size={28}
            color="#ffffff"
            trackColor="rgba(255, 255, 255, 0.3)"
            borderWidth={3}
            label="Espere un momento..."
        />
    </div>
</main>


<style>
h1{
    color:white;
    margin: 0;
    font-weight: 700;
}
img{
    width: 80%
}
main{
    min-height: 100vh;
    padding:5em 1.5em;
    background: var(--violeta1);
    display: grid;
    place-content: center;
    place-items: center;
    gap:2em;
}
p{
    color:white;
    margin:0
}
a{
    color:white;
}
.loader{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75em;
    opacity: 0.85;
    color: white;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
}
</style>