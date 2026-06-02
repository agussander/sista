<script>
import { MetaTags } from "svelte-meta-tags";

</script>

<MetaTags
title = 'Sista - Acerca de'
description = 'Conozca más sobre nuestra empresa'
></MetaTags>
<section>
    <h1>Acerca de Sista</h1>
    <div class="card">
        <img src="/images/sista-local.png" alt="Local de Sista">
        <div class="text">
            <h3>Somos Sista</h3>
            <p> Somos una empresa con sede en Punta Lara - Ensenada, cuyo objetivo es brindar servicios de conectividad (Internet, contenidos, TV, telefonía).
                De este modo potenciamos la comunicación y el desarrollo dentro de una región en constante crecimiento.  </p>
        </div>
    </div>
    <div class="card reverse">
        <div class="text2">
            <h3>Estamos conectados</h3>
            <p> Trabajamos hace más de 20 años en la búsqueda de soluciones tecnológicas y abarcamos zonas donde no existían estos servicios. Nuestro compromiso se refleja en la atención directa con el cliente y las soluciones a medida  </p>
        </div>
        <img class="filter" src="/images/servicios-b11.png" alt="Local de Sista">
    </div>
    <div class="card">
        <img src="/images/servicios-b10.png" alt="Local de Sista">
        <div class="text">
            <h3>Estamos con vos</h3>
            <p> Apoyamos el desarrollo de la región mediante la prestación de servicios a instituciones de la zona y a los emprendimientos locales.    </p>
        </div>
    </div>
    <small>SISTA S.A. integra la Cámara Argentina de Internet (CABASE) con una vicepresidencia, a su vez preside la Cámara Argentina de Internet de las Cosas (CaIoT) y es miembro fundador del Punto de Intercambio de Internet de La Plata.</small>
</section>

<style>
h1{
    text-align: center;
    margin-bottom: 2em;
    text-transform: uppercase;
    color:var(--violeta1);
}
section {
    padding:3em 1em 2em;
}
.card {
    display: flex;
    flex-flow: row wrap;
    margin-bottom: 3em;
}

img {
    width: 100%;
    height: 16em;
    object-fit: cover;
    margin-bottom: 1em;
}
.filter{
    filter:brightness(2)
}
.reverse{
        flex-direction: column-reverse;
    }
small{
    color: var(--text);
    margin:0 auto;
    text-align: center;
    display: block;
    max-width: 50em;
}
@media (min-width:768px) {
    .card {
        flex-flow: row nowrap;
        justify-content: center;
        height: 14em;
        margin-bottom: 8em;
    }

    img {
        width: 23em;
        height: 100%;
        object-fit: cover;
        box-shadow: 0 0 1em gray;
    }

    .text {
        max-width: 25em;
        line-height: 1.5rem;
        margin-left: 2em;
    }
    .text2 {
        max-width: 25em;
        line-height: 1.5rem;
        margin-right: 2em;
    }
    .reverse{
        flex-direction: row;
    }
}
</style>
