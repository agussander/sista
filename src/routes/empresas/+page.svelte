<script>
import { MetaTags } from 'svelte-meta-tags';
import Form2 from '$lib/components/forms/Form2.svelte';


</script>

<MetaTags
title = 'Sista - Empresas'
description = 'Internet de fibra óptica y tv'
></MetaTags>

<section>
    <div class="cont">
        <div class="texto">
            <h1>Contratá Sista para tu empresa</h1>
            <p>Ofrecemos soluciones eficientes y económicas de acuerdo a las necesidades del cliente.</p>
        </div>
        <Form2></Form2>
    </div>
</section>

<style>
h1{
    text-transform: uppercase;
    text-align: left;
    line-height: 1.2em;
    margin: 0;
}
section {
    width: 100%;
    min-height: 100vh;
    background-image:url("/images/internet-para-empresas sista-servicio-wifi integral2.png");
    background-size: cover;
    padding: 1em;
}

.cont {
    display: flex;
    flex-flow: column nowrap;
    justify-content:center;
    margin:0 auto;
    max-width: 25em;
}
@media (min-width:1000px) {
    .cont {
        flex-flow: row-reverse nowrap;
        max-width: 80%;
        transform: translateY(10em);
    }
    .texto{
        margin-left: 3em;
        max-width: 27em;
    }

}
</style>
