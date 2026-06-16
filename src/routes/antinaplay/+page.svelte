<script>
    import { MetaTags } from 'svelte-meta-tags';
</script>

<MetaTags
    title="Antina Play · Sista"
    description="Antina Play: canales en vivo y contenido on demand para sumar a tu Internet de Sista."
    openGraph={{
        type: 'website',
        images: [
            {
                url: 'https://sista.com.ar/images/tv/logo-antina-meta.png',
                width: 1200,
                height: 630,
                alt: 'Antina Play'
            }
        ]
    }}
    twitter={{
        cardType: 'summary_large_image',
        image: 'https://sista.com.ar/images/tv/logo-antina-meta.png',
        imageAlt: 'Antina Play'
    }}
/>

<section>
    <img class="logo" src="/images/tv/logo-antina.png" alt="Logo de Antina Play">
    <p>
        Para más información sobre los canales disponibles y la programación de Antina Play, consultanos por WhatsApp.
    </p>
    
    <div class="grilla-container">
        <img src="/images/tv/grilla antina play.png" alt="Grilla de canales de Antina Play" class="grilla-img">
    </div>
    
    <div class="cta">
        <a href="https://wa.me/5492213541906?text=Hola!%20Quiero%20información%20sobre%20Antina%20Play" target="_blank" class="btn-wsp">
            <span class="wsp-icon"></span>
            Consultar por WhatsApp
        </a>
    </div>

    <div id="dispositivos-compatibles" class="dispositivos-section">
        <h2>Dispositivos compatibles</h2>
        <div class="dispositivos-grid">
            <div class="dispositivo-item">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                    <path d="M7 8l5 5 5-5"></path>
                </svg>
                <h3>Android TV</h3>
                <p>Televisores con sistema operativo Android TV integrado</p>
            </div>
            <div class="dispositivo-item">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <circle cx="8" cy="10" r="1"></circle>
                    <circle cx="16" cy="10" r="1"></circle>
                </svg>
                <h3>TV Box</h3>
                <p>Dispositivos TV Box con Android TV</p>
            </div>
            <div class="dispositivo-item">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12" y2="18.01"></line>
                </svg>
                <h3>Celulares y tablets</h3>
                <p>Android e iOS</p>
            </div>
        </div>
    </div>
</section>

<style>
    section{
        width: 100vw;
        padding: 6em 1em 2em;
        justify-content: center;
    }
    .cta{
        display: flex;
        justify-content: center;
        margin-top: 3em;
    }
    p{
        max-width: 50em;
        margin: 0 auto;
    }
    .logo{
        width: 100%;
        max-width: 20em;
        height: auto;
        margin: 0 auto 2em;
        display: block;
    }
    .btn-wsp {
        display: inline-flex;
        align-items: center;
        gap: 0.8em;
        background: var(--verde);
        color: var(--violeta1);
        text-decoration: none;
        border-radius: 100px;
        padding: 1em 2em;
        font-size: 1em;
        font-weight: 700;
        text-transform: uppercase;
        box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
    }
    .btn-wsp:hover {
        transform: translateY(-0.2em);
        box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.3);
        opacity: 1;
    }
    .wsp-icon {
        background: url("/images/wsp-violet.svg") no-repeat;
        background-size: cover;
        width: 2em;
        height: 2em;
    }
    .grilla-container {
        margin: 3em auto;
        max-width: 60em;
        overflow-x: auto;
    }
    .grilla-img {
        width: 100%;
        height: auto;
        border-radius: var(--border-radius);
        box-shadow: 0 0.5em 2em rgba(0, 0, 0, 0.2);
    }
    .dispositivos-section {
        margin-top: 4em;
        padding: 3em 1em;
        max-width: 60em;
        margin-left: auto;
        margin-right: auto;
    }
    .dispositivos-section h2 {
        text-align: center;
        color: var(--violeta1);
        font-size: 2em;
        margin-bottom: 2em;
        text-transform: uppercase;
    }
    .dispositivos-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2em;
    }
    .dispositivo-item {
        background: white;
        border-radius: var(--border-radius);
        padding: 2em;
        text-align: center;
        box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .dispositivo-item:hover {
        transform: translateY(-0.3em);
        box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.15);
    }
    .dispositivo-item svg {
        color: var(--violeta2);
        margin-bottom: 1em;
    }
    .dispositivo-item h3 {
        color: var(--violeta1);
        font-size: 1.3em;
        margin: 0.5em 0;
        font-weight: 600;
    }
    .dispositivo-item p {
        color: var(--text);
        margin: 0;
        font-size: 1em;
    }
    @media (min-width: 768px) {
        .dispositivos-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>

