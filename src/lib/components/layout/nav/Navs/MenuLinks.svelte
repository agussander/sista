<script>
import {scrollElement, setGlobalOptions } from 'svelte-scrolling'
import {page} from '$app/stores'
import { goto } from '$app/navigation';

setGlobalOptions({offset:-200})

const clickHandler = (ref)=>{
    if($page.url.pathname == '/'){
        scrollElement(ref)
    } else{
        goto(`/#${ref}`)
    }
}
</script>

<span on:click={()=>clickHandler('planes')}>Planes</span>
<!-- <span on:click={()=>clickHandler('cobertura')}>Cobertura</span> -->
<!-- Novedades es una ruta propia, no un ancla del home: no pasa por
     `clickHandler`. -->
<a href="/novedades/">Novedades</a>
<span on:click={()=>clickHandler('contacto')}>Contacto</span>

<style>
span, a {
    color: var(--nav-link-color, var(--violeta1));
    font-size: 1rem;
    margin-left: 1.5em;
    cursor:pointer;
    transition: color ease 400ms;
    font-weight: 500;
    text-decoration: none;
}

@media (max-width: 48em){
    span, a {
        margin-bottom: 1em;
        margin-left: 0;
        color: var(--nav-link-color, var(--violeta1));
    }
}
</style>