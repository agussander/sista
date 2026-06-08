<script>
    import Accordion from '$lib/components/ui/Accordion.svelte';
</script>

<main>
    <div class="background-image"></div>
    
    <section class="hero">
<h1>Sumá TV a tu plan</h1>
        <a href="https://wa.me/5492213541906?text=Hola!%20Quiero%20información%20sobre%20TV" target="_blank" rel="noopener noreferrer" class="btn-whatsapp btn-lg">
            <span class="wsp-icon"></span>
            Quiero tener TV
        </a>
        
    <div class='logos'>
            <a href="/gigaredplay" class="logo-card">
        <img src="/images/tv/logo-gigared.png" alt="logo de Gigared">
            </a>
            <a href="/antinaplay" class="logo-card">
        <img src="/images/tv/logo-antina.png" alt="logo de Antina Play">
            </a>
            <a href="/dgo" class="logo-card">
        <img src="/images/tv/logo-dgo.png" alt="logo de DGO">
            </a>
        </div>
    </section>

    <div class="info-card info-card-como-funciona">
        <h2>¿Cómo funcionan los planes de TV?</h2>
        <p class="description">
            Podés elegir entre cualquiera de nuestros 3 proveedores de TV. 
            Todos funcionan con Internet y podés instalarlos en un smart TV o mediante un TV Box.
        </p>
    </div>
    
    <div class="info-card info-card-precios">
        <h2>Precios y planes</h2>
        <a href="/precios" class="btn-secondary">
            Ver precios vigentes
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
        </a>
    </div>

    <div class="info-card info-card-canales">
        <h2>Canales disponibles</h2>
        <div class="canales-card">
            <h4>Consultá la grilla:</h4>
            <div class="canales-options">
                <a href="/dgo" class="canal-option">
                    <span>
                        <img src="/images/tv/logo-dgo.png" alt="DGO" />
                        Grilla de DGO
                    </span>
                    <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </a>
                <a href="/antinaplay" class="canal-option">
                    <span>
                        <img src="/images/tv/logo-antina.png" alt="Antina Play" />
                        Grilla de Antina Play
                    </span>
                    <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </a>
                <a href="/gigaredplay" class="canal-option">
                    <span>
                        <img src="/images/tv/logo-gigared.png" alt="Gigared Play" />
                        Grilla de Gigared Play
                    </span>
                    <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </a>
            </div>
        </div>
    </div>

    <section class="features-section">
        <img src="/images/tv/caraccteristicas y diferencias.png" alt="Características y diferencias de los servicios de TV" />
        <div class="cta-section">
            <a href="https://wa.me/5492213541906?text=Hola!%20Quiero%20información%20sobre%20TV" class="btn-whatsapp">
                <span class="wsp-icon"></span>
                Quiero tener TV
            </a>
        </div>
    </section>

    <section class="faq-section">
        <h2>Preguntas frecuentes</h2>
        <div class="faq-container">
            <Accordion title="¿Puedo instalarlo directamente en mi TV Smart?">
                <p>Esto depende del modelo de tu TV y del proveedor que elijas. Le major forma de saberlo es buscando la app en la tienda de aplicaciones de tu TV. Si no está disponible, igual podés instalarlo <a href="https://tiendasista.mitiendanube.com/productos/bvs-android-tv-caja-adaptadora/" target="_blank" rel="noopener noreferrer">adquiriendo un TV Box en nuestra tienda online</a>.</p>
                <p>Podés consultar los dispositivos compatibles de cada proveedor:</p>
                <ul>
                    <li><a href="/dgo#dispositivos-compatibles">Dispositivos compatibles con DGO</a></li>
                    <li><a href="/gigaredplay#dispositivos-compatibles">Dispositivos compatibles con Gigared Play</a></li>
                    <li><a href="/antinaplay#dispositivos-compatibles">Dispositivos compatibles con Antina Play</a></li>
                </ul>
            </Accordion>
            <Accordion title="¿Que pasa si no tengo Tv Smart?">
                <p>Podés <a href="https://tiendasista.mitiendanube.com/productos/bvs-android-tv-caja-adaptadora/" target="_blank" rel="noopener noreferrer">adquirir un TV Box en nuestra tienda online</a>. Los mismos son compatibles con todos los proveedores de TV y solo se enchufan a tu Tv por HDMI.</p>
                <p>También podés ver los canales en computadoras, tablets y celulares.</p>
            </Accordion>
            <Accordion title="¿Qué canales tiene?">
                <p>Cada proveedor tiene su propia grilla de canales. Podés consultar las grillas completas en las siguientes páginas:</p>
                <ul>
                    <li><a href="/dgo">Grilla de DGO</a></li>
                    <li><a href="/antinaplay">Grilla de Antina Play</a></li>
                    <li><a href="/gigaredplay">Grilla de Gigared Play</a></li>
                </ul>
                <p>También podés consultarnos por WhatsApp para más información sobre los canales disponibles.</p>
            </Accordion>
            
            <Accordion title="¿En cuántos dispositivos puedo verlo?">
                <p>Podés verlo en el cuadro de arriba en "dispositivos reproduciendo en simultáneo". Podés tener la app en todos los dispositivos que quieras, esto solo se refiere a reproducciones en simultáneo.</p>
            </Accordion>
            
            <Accordion title="¿Incluye fútbol?">
                <p>El pack fútbol (TNT Sports y ESPN) está disponible para cualquiera de los planes de TV. No está incluído en el precio y puede contratarse como adicional. Consultá el precio de este y otros adicionales por WhatsApp. Otros canales deportivos pueden consultarse en las grillas de canales de cada proveedor.</p>
            </Accordion>
        </div>
    </section>
</main>


<style>
    span{
        margin-right: 0em;
    }
@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(3em);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes zoomIn {
    from {
        transform: scale(1.15);
    }
    to {
        transform: scale(1);
    }
}

main{
    position: relative;
    min-height: 100vh;
    overflow: hidden;
}

.background-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 60dvh;
    background-image: url('/images/tv-sista.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: -1;
    animation: zoomIn 1.5s ease-out;
}

.background-image::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--violeta2);
    opacity: .8;
    z-index: 1;
}

.background-image::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--violeta1);
    mix-blend-mode: color;
    z-index: 2;
}

.hero {
    padding: 0 1em;
    text-align: center;
    position: relative;
    min-height: 60dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

h1{
    color: white;
    font-size: 2.5rem;
    font-weight: 800;
    text-align: center;
    margin: 0 0 0.5em 0;
    padding: 0 1em;
}

.btn-whatsapp {
    margin-bottom: 2em;
    z-index: 10;
    position: relative;
}

.btn-whatsapp .wsp-icon {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2366257C'%3E%3Cpath d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'/%3E%3C/svg%3E");
    background-size: cover;
    width: 1.5em;
    height: 1.5em;
    display: inline-block;
}

.info-card {
    max-width: 64em;
    margin: 0 auto;
    padding: 0 1em;
    text-align: center;
}

.info-card:first-of-type {
    padding-top: 8em;
    margin-bottom: 3em;
}

.info-card:not(:first-of-type):not(:last-of-type) {
    margin-bottom: 3em;
}

.info-card:last-of-type {
    margin-bottom: 0;
}

@media (max-width: 767px) {
    h1 {
        font-size: 2rem;
        padding: 0 1.5em;
    }
    
    .info-card:first-of-type,
    .info-card:not(:first-of-type):not(:last-of-type) {
        margin-bottom: 4em;
    }
    
    .info-card:last-of-type {
        margin-bottom: 0;
    }
    
    .canal-option {
        padding: 0.8em 0;
        font-size: 0.9em;
    }
}

.info-card:has(.canales-card) {
    background-image: url('/images/tv/grilla.jpeg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    padding: 3em 0;
    position: relative;
    max-width: none;
    width: 100vw;
    margin-left: calc(50% - 50vw);
    margin-right: calc(50% - 50vw);
}

.info-card:has(.canales-card)::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(245, 245, 245, 0.88);
    backdrop-filter: blur(0.15em);
    z-index: 0;
}

.info-card:has(.canales-card) > * {
    position: relative;
    z-index: 1;
}

h2{
    color: var(--magenta);
    font-size: 1.8em;
    text-align: center;
    margin-top: 0;
    margin-bottom: 1em;
    text-transform: uppercase;
    padding: 0 1em;
}

@media (max-width: 767px) {
    h2 {
        padding: 0 1.5em;
    }
}

.description {
    font-size: 1.1em;
    line-height: 1.6;
    text-align: center;
    margin: 0;
}

.btn-secondary svg {
    transition: transform 0.3s ease;
}

.btn-secondary:hover svg {
    transform: translateX(0.3em);
}

.canales-card {
    max-width: 30em;
    margin: 0 auto;
    background-color: white;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
    padding-bottom: 0.5em;
}

.canales-card h4 {
    font-size: 1em;
    font-weight: 500;
    color: var(--text);
    text-align: left;
    margin: 0;
    padding: 1em 2em;
    border-bottom: 1px solid rgb(206, 206, 206);
}

.canales-options {
    padding: 0 2em;
    display: flex;
    flex-direction: column;
}

.canal-option {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1em;
    border-bottom: 1px solid rgb(231, 231, 231);
    padding: 1em 0;
    cursor: pointer;
    text-decoration: none;
    color: var(--text);
    transition: background-color 0.2s ease;
}

.canal-option:last-child {
    border-bottom: none;
}

.canal-option:hover {
    background-color: #f7f7f7;
}

.canal-option span {
    display: flex;
    align-items: center;
    gap: 1em;
    font-size: 1em;
    font-weight: 500;
}

.canal-option img {
    width: 2em;
    height: 2em;
    object-fit: contain;
}

.arrow-icon {
    flex-shrink: 0;
    stroke: var(--text);
}

.logos{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1em;
    width: 100%;
    max-width: 60em;
    padding: 0 1em;
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 50%);
    z-index: 100;
}

.logo-card {
    background: white;
    border-radius: var(--border-radius);
    padding: 0.3em;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0.5em 2em rgba(0, 0, 0, 0.3);
    animation: slideUp 0.8s ease-out forwards;
    opacity: 0;
    min-height: 4em;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    transition: all 0.3s ease;
}

.logo-card:nth-child(1) {
    animation-delay: 0.2s;
}

.logo-card:nth-child(2) {
    animation-delay: 0.4s;
}

.logo-card:nth-child(3) {
    animation-delay: 0.6s;
}

.logo-card:hover {
    transform: translateY(-0.5em);
    box-shadow: 0 0.7em 2.5em rgba(102, 37, 124, 0.3);
}

.logo-card img{
    width: 100%;
    height: auto;
    object-fit: contain;
}

.cta-section {
    text-align: center;
    padding: 2em 0;
}



.features-section {
    background: var(--violeta2);
    padding: 4em 1em 1em;
    text-align: center;
    overflow-x: auto;
    overflow-y: hidden;
    margin-bottom: 2em;
}

.features-section::-webkit-scrollbar {
    height: 0.5em;
}

.features-section::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 0.25em;
}

.features-section::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.5);
    border-radius: 0.25em;
}

.features-section::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.7);
}

.features-section>img {
    width: 120%;
    height: auto;
}

.info-card-como-funciona {
    padding-top: 6em;
}

@media (min-width: 768px) {
    h1 {
        font-size: 4rem;
    }


    .logos {
    gap: 2em;
}

    .logo-card {
        padding: 1.5em;
    }


    .info-card {
        padding: 3em;
    }

    h2 {
        font-size: 2em;
    }

    .description {
        font-size: 1.3em;
    }


    .features-section {
        padding: 6em 2em;
        overflow-x: hidden;
    }

    .features-section>img {
        width: 100%;
        max-width: 40em;
    }
    .info-card-como-funciona {
        padding-top: 10em;
    }
}

@media (min-width: 1200px) {
    h1 {
        font-size: 5rem;
    }
    
    .hero {
        padding: 0 2em;
    }

    .logos {
        gap: 2.5em;
    }

    .logo-card {
        padding: 2em;
    }

    .features-section {
        padding: 3em 3em;
        overflow-x: hidden;
    }

    .features-section>img {
        max-width: 50em;
    }
}

.faq-section {
    padding: 4em 1em;
    max-width: 50em;
    margin: 0 auto;
}

.faq-section h2 {
    text-align: center;
    margin-bottom: 2em;
    color: var(--text);
    font-size: 2em;
    padding: 0 1em;
}

@media (max-width: 767px) {
    .faq-section h2 {
        padding: 0 1.5em;
        font-size: 1.6em;
    }
}

.faq-container {
    display: flex;
    flex-direction: column;
    gap: 1em;
}

.faq-container ul {
    margin: 1em 0;
    padding-left: 1.5em;
}

.faq-container li {
    margin-bottom: 0.5em;
}

.faq-container a {
    color: var(--violeta2);
    text-decoration: underline;
}

.faq-container a:hover {
    color: var(--violeta1);
}

@media (min-width: 768px) {
    .faq-section {
        padding: 2em;
    }

    .faq-section h2 {
        font-size: 2.5em;
    }
}

@media (min-width: 1200px) {
    .faq-section {
        padding: 2em 3em;
    }
}
</style>