<script>
import { onMount } from 'svelte';
import { pb } from '$lib/pocketbase';
import EncuestaDeCalidad from '../_components/mantenimiento/Dashboard/encuestas/EncuestaDeCalidad.svelte';
import Login from '../_components/Login.svelte';
import {token, record} from '../_components/adminStore'
import Dashboard from '../_components/mantenimiento/Dashboard.svelte';

let ready = $state(false);

onMount(async () => {
    // El gate de la UI usa el store persistido propio (sista_auth_token), que
    // nunca expira. Pero las llamadas a la API usan pb.authStore, cuyo token sí
    // caduca (~14 días). Si quedan desincronizados, el panel se ve "logueado"
    // pero las requests salen como anónimas y las colecciones con regla de auth
    // devuelven vacío. Sincronizamos según la validez real del token de PocketBase.
    if (pb.authStore.isValid) {
        try {
            // Sesión todavía vigente: la refrescamos para extenderla.
            await pb.collection('users').authRefresh();
        } catch (e) {
            // Un 401 invalida la sesión (la SDK ya limpia authStore); ante un
            // error de red dejamos el token local como está y no deslogueamos.
            console.error(e);
        }
    }

    if (pb.authStore.isValid) {
        $token = pb.authStore.token;
        $record = pb.authStore.record;
    } else {
        // Token expirado o ausente: forzamos re-login aunque el store viejo siga seteado.
        pb.authStore.clear();
        $token = null;
        $record = null;
    }

    ready = true;
});
</script>

<main class="admin-root">
    {#if !ready}
        <!-- Esperamos a validar la sesión real antes de decidir qué mostrar. -->
    {:else if !$token || !$record || !pb.authStore.isValid}
        <Login></Login>
    {:else}
        <Dashboard></Dashboard>
    {/if}
</main>

<style>
    main{
        min-height: 100vh;
    }

    /*
      El sitio público usa 'nexa' (fuente de marca, muy fina en peso 300) que
      queda poco legible en una UI densa de tablas/formularios. El admin usa
      la stack de fuentes nativas del sistema en su lugar, sin tocar la fuente
      del sitio público. `:global(*)` pisa las reglas de global.css (incluido
      el `input,textarea{font-family:'nexa'}` explícito) para todo lo que
      cuelga de acá, incluyendo componentes hijos como Login y Dashboard.
    */
    main.admin-root, main.admin-root :global(*) {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
</style>