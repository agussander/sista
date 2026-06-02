<script>
import { onDestroy, onMount } from "svelte";
import { fade } from 'svelte/transition';


let {next} = $props();

let count = $state(1);
const interval = setInterval(() => {
        count== 3 ? count = 1 : count++;
}, 4000);  



onDestroy(()=>{
    clearInterval(interval);
})  

</script>

<div class="image-carousel-container">
  {#key count}
  <img src="/images/trabajaconnosotros/{count}.png" alt="" transition:fade={{ duration: 900 }}>
  {/key}
</div>
<h1>¿Querés trabajar con nosotros?</h1>
<p>Completá este formulario para darnos tu información</p>
<button class="btn-1" onclick={next}>Comenzar</button>

<style>
.image-carousel-container {
    width: 100%;
    height: 30vh; /* Same as image height */
    position: relative;
    margin-bottom: 1rem; /* Add some space below the carousel */
}

img{
    width: 100%;
    height: 100%; /* Fill the container */
    object-fit: cover;
    object-position: center;
    border-radius: var(--border-radius);
    position: absolute;
    top: 0;
    left: 0;
}
</style>