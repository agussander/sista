<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let errorStatus = 404;
  let errorMessage = 'Página no encontrada';

  onMount(() => {
    if ($page.error) {
      errorStatus = $page.error.status || 404;
      errorMessage = $page.error.message || 'Página no encontrada';
    }
  });

  function goHome() {
    goto('/');
  }
</script>

<div class="error-container">
  <span>:(</span>
  <h1>{errorStatus}: {errorMessage}</h1>
  <p>Parece que la página que estás buscando no existe o está en mantenimiento</p>
  <button class="btn-1" onclick={goHome}>
    Volver al Inicio
  </button>
</div>

<style>
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    text-align: center;
    max-width: 90%;
    margin: 0 auto;
    width: 40em;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: var(--magenta, #7028a2);
  }

  p {
    font-size: 1.2rem;
    margin-bottom: 1rem;
    max-width: 400px;
  }

  span {
    font-size: 4rem;
    margin-bottom: 0.5rem;
    color: gray;
  }

</style> 