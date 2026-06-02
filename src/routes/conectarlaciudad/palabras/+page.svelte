<script>
    // Sorteo finalizado: juego de palabras no disponible
    // import { goto } from '$app/navigation';
    import { MetaTags } from 'svelte-meta-tags';
    // import { browser } from '$app/environment';
    // import { onMount } from 'svelte';
    // import PocketBase from 'pocketbase';
    // ... handleStart, MAX_PLAYS_PALABRAS comentados
</script>

<MetaTags title="Sista - Conectá la ciudad" description="Sorteo finalizado" />

<main class="explicacion">
    <div class="container">
        <h1>Sorteo finalizado</h1>
        <!-- Contenido del juego Palabras y botón Comenzar comentados -->
    </div>
</main>

<style>
    main.explicacion {
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
        background: white;
        border-radius: 1.5rem;
        padding: 2.5rem;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    }

    h1 {
        margin: 0;
        font-size: 2.5rem;
        font-weight: 800;
        color: var(--violeta1);
        text-align: center;
    }
</style>
