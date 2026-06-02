<script>
import { onDestroy, onMount } from "svelte";

let {onclick} = $props();

const handleClick = ()=>{
    onclick();
}

</script>


<div class="background"></div>
<div class="white"></div>
<main>
    <h1>Jugá<br>y ganá</h1>
    <div class="img">
        <img
        src="/images/ruleta/ruleta.svg" alt="">
    </div>
    <button class="btn-1" onclick={handleClick}>Participar</button>
</main>


<style>
main{
    padding-top: 2em;
    min-height: 100vh;
    z-index: 3;
}
.background{
    background: var(--violeta1);
    height: 50vh;
    width: 100%;
    position: absolute;
    top: 0;
    z-index: -2;
}
.white{
    z-index: -5;
    background: white;
    position: absolute;
    height: 100vh;
    width: 100vw;
}
h1{
    color: white;
    text-transform: uppercase;
    font-size: 3em;
    text-align: center;
    line-height: 1em;
}
.img{
    display: flex;
    margin-bottom: 2em;
}
img{
    width: 70%;
    margin: 0 auto;
    animation: spin 10s linear infinite; /* Animación continua */
}
button{
    width: 80%;
    font-size: 1.5em;
    margin: 0 auto;
    display: block;
}
@keyframes spin {
    from {
        transform: rotate(0deg); /* Comienza sin rotación */
    }
    to {
        transform: rotate(360deg); /* Rota completamente */
    }
}
</style>