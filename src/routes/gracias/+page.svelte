<script>
import { onMount } from "svelte";
import VoverAtras from "$lib/components/ui/VoverAtras.svelte";
import { MetaTags } from "svelte-meta-tags";


</script>

<svelte:head>
    <meta http-equiv="refresh" content="5; url=/">
</svelte:head>

<MetaTags
    title='Sista - Gracias'
    description='Usted se ha contactado con Sista'
></MetaTags>

<section>
<div>
    <h1>Gracias por contactarte</h1>
    <p>Tu caso será atendido a la brevedad</p>
    <VoverAtras></VoverAtras>
</div>

</section>


<style>
h1{
    text-transform: uppercase;
    margin-bottom: 0;
    font-size: 3em;
    text-align: center;
}
p{
    text-align: center;
    font-size: 1.2em;
}
section{
    min-height: 100vh;
    display: flex;
    justify-content: center;
}
div{
    margin-top:10%;
}
</style>