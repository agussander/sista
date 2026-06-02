<script>
    // Sorteo finalizado: juego de palabras (anagramas) no se carga
    import { MetaTags } from 'svelte-meta-tags';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';

    onMount(() => {
        if (browser) goto('/conectarlaciudad');
    });
</script>

<MetaTags title="Sista - Conectá la ciudad" description="Sorteo finalizado" />

<main class="sorteo-finalizado">
    <div class="container">
        <h1>Sorteo finalizado</h1>
        <p>Redirigiendo...</p>
    </div>
</main>

<style>
    main.sorteo-finalizado {
        min-height: 100vh;
        background: url('/assets/conectarlaciudad/fondo-22.jpg') no-repeat center center;
        background-size: cover;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2em;
    }

    .container {
        background: white;
        border-radius: 1.5rem;
        padding: 2rem;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        text-align: center;
    }

    h1 {
        margin: 0 0 1rem 0;
        font-size: 2rem;
        font-weight: 800;
        color: var(--violeta1);
    }

    p {
        margin: 0;
        color: var(--gris1);
    }
</style>
