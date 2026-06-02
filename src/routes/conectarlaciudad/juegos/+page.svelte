<script>
    // Sorteo finalizado: juegos no se muestran
    // import { goto } from '$app/navigation';
    import { MetaTags } from 'svelte-meta-tags';
    // import { onMount, onDestroy } from 'svelte';
    // import { browser } from '$app/environment';
    // import PocketBase from 'pocketbase';
    // ... games, handleGameSelect, etc. comentados
</script>

<MetaTags title="Sista - Conectá la ciudad" description="Sorteo finalizado" />

<main class="juegos">
    <div class="container">
        <h1>Sorteo finalizado</h1>
        <!-- Lista de juegos comentada -->
    </div>
</main>

<style>
    main.juegos {
        min-height: 100vh;
        background: url('/assets/conectarlaciudad/fondo-22.jpg') no-repeat center center;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-attachment: fixed;
        padding: 2em 1em;
    }

    .container {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
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
