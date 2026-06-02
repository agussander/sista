<script lang="ts">
    // Sorteo finalizado: verificación de cliente no se muestra
    import { MetaTags } from 'svelte-meta-tags';
    // import { onMount } from 'svelte';
    // import { browser } from '$app/environment';
    // import { goto } from '$app/navigation';
    // import PocketBase from 'pocketbase';
    // ... resto comentado
</script>

<MetaTags title="Sista - Conectá la ciudad" description="Sorteo finalizado" />

<main class="cliente-page">
    <div class="container">
        <h1>Sorteo finalizado</h1>
        <!-- Verificación de cliente comentada -->
    </div>
</main>

<style>
.cliente-page {
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
    max-width: 500px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 1.5rem;
    padding: 3rem 2rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

h1 {
    font-size: 2rem;
    font-weight: 800;
    color: var(--violeta1, #7028a2);
    margin: 0;
    text-align: center;
}
</style>
