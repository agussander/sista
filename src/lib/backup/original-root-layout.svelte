<script>
import Footer from "$lib/components/layout/Footer.svelte";
import Nav from "$lib/components/layout/nav/Navs/Nav.svelte";
import Modal from "$lib/components/layout/Modal.svelte";
import {
    windowX,
    modal,
    mobile
} from '$lib/stores';
import { onMount } from "svelte";
import { page } from '$app/stores';
import { browser } from '$app/environment';

let {children} = $props();


const setMobile=()=>$mobile=$windowX<750;
let hideChrome = $derived(
    $page.url.pathname.startsWith('/conectarlaciudad') ||
        $page.url.pathname.startsWith('/tolosano') ||
        $page.url.pathname.startsWith('/mail-banner')
);

// window.addEventListener("resize",setMobile);

onMount(async()=>setMobile());

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

// Google Analytics 4 - Tracking de cambios de página
async function trackPageView(path) {
    if (browser) {
        await waitForGtag();
        if (typeof window.gtag !== 'undefined') {
            window.gtag('config', 'G-KP96BL9H2Q', {
                page_path: path
            });
        }
    }
}

// Trackear cambios de página con $effect (solo se ejecuta en el cliente)
$effect(() => {
    if ($page.url.pathname && browser) {
        trackPageView($page.url.pathname);
    }
});

</script>
<svelte:head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-W3WFBRF7');</script>
    <!-- End Google Tag Manager -->

    <!-- Google Analytics 4 -->
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-KP96BL9H2Q', {
            'send_page_view': true
        });
    </script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-KP96BL9H2Q"></script>
    <!-- End Google Analytics 4 -->

    <!-- Meta Pixel Code -->
    <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1122989162488805');
    fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none" alt=""
    src="https://www.facebook.com/tr?id=1122989162488805&ev=PageView&noscript=1"
    /></noscript>
    <!-- End Meta Pixel Code -->
</svelte:head>

<svelte:window bind:innerWidth={$windowX}></svelte:window>

{#if !hideChrome}
    <Nav></Nav>
{/if}

{#if $modal && !hideChrome}
    <Modal></Modal>
{/if}


{@render children()}



{#if !hideChrome}
    <Footer></Footer>
{/if}

<style>
@import '$lib/global.css';

</style>
