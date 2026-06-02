<script>
import { onDestroy, onMount } from "svelte";
import FormBaja from "./_components/FormBaja.svelte";
import { MetaTags } from "svelte-meta-tags";


</script>

<MetaTags
    title='Sista - Solicitud de baja'
    description= 'Solicitud de baja del servicio'
></MetaTags>

<main>
    <div>
        <h1>Solicitud de baja</h1>
        <FormBaja></FormBaja>
    </div>
</main>

<style>
main{
    padding: 1em;
}
h1{
    color: var(--text);
}

@media (min-width: 968px){
    main{
        display: flex;
        justify-content: center;
        width: 100%;
        min-height: 100vh;
    }
    div{
        max-width: 30em;
    }

    h1{
        margin-top: 2em;
    }
}
</style>