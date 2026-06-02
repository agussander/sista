<script>
    // Sorteo finalizado: ruleta no se muestra
    import { MetaTags } from 'svelte-meta-tags';
    // import { onMount, onDestroy } from 'svelte';
    // import { goto } from '$app/navigation';
    // import PocketBase from 'pocketbase';
    // import { browser } from '$app/environment';
    // ... participanteData, ruletaParticipanteId, etc. comentados
</script>

<MetaTags title="Sista - Conectá la ciudad" description="Sorteo finalizado" />

<main class="ruleta">
    <div class="container">
        <h1>Sorteo finalizado</h1>
        <!-- Número de ruleta, éxito, error comentados -->
    </div>
</main>

<style>
    main.ruleta {
        min-height: 100vh;
        background: url('/assets/conectarlaciudad/fondo-22.jpg') no-repeat center center;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-attachment: fixed;
        padding: 2em 1em;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .container {
        width: 100%;
        max-width: 600px;
        background: white;
        border-radius: 1.5rem;
        padding: 2rem;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    }

    h1 {
        margin: 0;
        font-size: 2rem;
        font-weight: 800;
        color: var(--violeta1);
        text-align: center;
    }
</style>
