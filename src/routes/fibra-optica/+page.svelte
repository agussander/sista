<script>
import { MetaTags } from "svelte-meta-tags";
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
</script>

<MetaTags
    title='Sista - Fibra Óptica'
    description='Conocé qué es la fibra óptica y por qué es una mejor opción para tu conexión a internet'
></MetaTags>

<img src="/images/fibra-optica-cables.png" alt="fibra-optica">

<section>
    <h1>Fibra Óptica</h1>
    
    <div class="content">
        <h2>¿Qué es la fibra óptica?</h2>
        <p>La fibra óptica es una tecnología que permite llevar internet a través de cables especiales por donde viaja la información en forma de luz. Esto ayuda a que la conexión sea más estable y pareja que otras alternativas, como el internet por antena.</p>
    </div>

    <div class="content">
        <h3>Fibra óptica vs. internet por antena</h3>
        <p>El internet por antena funciona mediante señales inalámbricas y puede verse afectado por el clima, los árboles, las construcciones o la distancia.</p>
        <p>La fibra óptica, en cambio, llega por cable directo hasta tu domicilio, lo que suele ofrecer una experiencia más constante para el uso diario.</p>
    </div>

    <div class="content">
        <h3>Llevar fibra no es simple</h3>
        <p>Instalar fibra óptica implica tendido de cables, postes, cajas y equipos, además de permisos y trabajos en la vía pública. Por eso, en muchos barrios o localidades este servicio no estuvo disponible durante años.</p>
        <p>Nuestra misión es llevar la fibra a lugares donde antes no había, acercando esta tecnología a vecinos que solo contaban con opciones más limitadas.</p>
    </div>

    <div class="content">
        <h3>Una mejora pensada para todos los días</h3>
        <p>La fibra óptica no es perfecta y, como cualquier servicio, puede tener interrupciones ocasionales. Pero en general representa una mejora importante frente a tecnologías más antiguas, permitiendo navegar, estudiar, trabajar y comunicarse con mayor comodidad.</p>
        <p>Seguimos ampliando la red, barrio por barrio, para que cada vez más personas puedan acceder a una conexión mejor, incluso en zonas donde antes parecía imposible.</p>
    </div>

    <ContactButtons></ContactButtons>
</section>

<style>
    img{
        width:100vw;
        margin: 0 auto;
        max-height: 20em;
        object-fit: cover;
        object-position: center;
        background-attachment: fixed;
    }
h1 {
    text-align: left;
    text-transform: uppercase;
    color: var(--violeta1);
    font-size: 3em;
}

section {
    padding: 3em 1em 2em;
    max-width: 50em;
    margin: 0 auto;
}

.content {
    margin-bottom: 3em;
}

h2 {
    font-size: 1.5em;
    color: var(--violeta1);
    text-transform: none;
    text-align: left;
    margin-bottom: 1em;
    font-weight: 600;
}
h3{
    text-transform: none;
    font-weight: 500;
    font-size: 1.5em;
}

p {
    line-height: 1.6em;
    margin-bottom: 1em;
}

@media (min-width: 768px) {
    section {
        padding: 4em 2em 3em;
    }
    
    h2 {
        font-size: 1.8em;
    }
}
</style>


