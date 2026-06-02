<script>
import EditPrices from './EditPrices.svelte';
</script>

<div class="precios-container">
    <h2>Editar Precios</h2>
    <EditPrices />
</div>

<style>
.precios-container {
    padding: 2em;
    max-width: 1200px;
    margin: 0 auto;
}

h2 {
    color: var(--violeta2);
    margin-bottom: 1.5em;
    font-size: 1.8em;
}
</style>