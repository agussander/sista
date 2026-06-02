<script lang="ts">
    // Sorteo finalizado: juego de bloques no disponible
    // import { goto } from '$app/navigation';
    // import { browser } from '$app/environment';
    // import { onMount } from 'svelte';
    // import PocketBase from 'pocketbase';
    // ... comenzar(), MAX_PLAYS_BLOQUES, etc. comentados
</script>

<div class="container">
    <div class="content">
        <h1>Sorteo finalizado</h1>
        <!-- Instrucciones y botón Comenzar comentados -->
    </div>
</div>

<style>
.container {
    min-height: 100vh;
    background: url('/assets/conectarlaciudad/fondo-22.jpg') no-repeat center center;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-attachment: fixed;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
}

.content {
    text-align: center;
    background-color: rgba(255, 255, 255, 0.95);
    border-radius: 1.5rem;
    padding: 3rem 2rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    max-width: 500px;
    width: 100%;
}

h1 {
    font-size: 2.5rem;
    margin: 0;
    font-weight: 800;
    color: var(--violeta1, #7028a2);
}
</style>
