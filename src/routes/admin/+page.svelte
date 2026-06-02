<script>
import EncuestaDeCalidad from './_components/mantenimiento/Dashboard/encuestas/EncuestaDeCalidad.svelte';
import Login from './_components/Login.svelte';
import {token, record} from './_components/adminStore'
import Dashboard from './_components/mantenimiento/Dashboard.svelte';

// $: console.log($token)
</script>

<main>
    {#if !$token || !$record}
        <Login></Login>
    {:else}
        <Dashboard></Dashboard>
    {/if}
</main>

<style>
    main{
        min-height: 100vh;
    }
</style>