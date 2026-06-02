<script>
    // Sorteo finalizado: acciones no se muestran
    // import { goto } from '$app/navigation';
    import { MetaTags } from 'svelte-meta-tags';
    // import { onMount } from 'svelte';
    // import { browser } from '$app/environment';
    // ... resto comentado
</script>

<MetaTags title="Sista - Conectá la ciudad" description="Sorteo finalizado" />

<main class="acciones">
    <div class="container">
        <h1>Sorteo finalizado</h1>
        <!-- Acciones (YouTube, Instagram, etc.) comentadas -->
    </div>
</main>

<style>
    main.acciones {
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
        max-width: 600px;
        margin: 0 auto;
        background: white;
        border-radius: 1.5rem;
        padding: 2rem;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    }

    h1 {
        margin: 0 0 2rem 0;
        font-size: 1.8rem;
        font-weight: 800;
        color: var(--violeta1);
        text-align: center;
    }
</style>
