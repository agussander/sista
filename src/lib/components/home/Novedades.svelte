<script>
import { onDestroy } from 'svelte';
import { noticias } from "$lib/stores";

let count = 0;
let tam;

const interval = setInterval(() => count < $noticias.length - 1 ? count++ : count = 0, 8000);

onDestroy(() => clearInterval(interval));
</script>

<section>
        <div class="background2"></div>
        <div class="cont">
            <h4>Novedades</h4>
            <div class="inner">
                <div class="carousel" style="transform: translateX(-{tam*count}px)">
                    {#each $noticias as {title,body,img,link}}
                    <div bind:clientWidth={tam} class="noticia" onclick={()=>{window.open(link)}}>
                        <div class="img"
                        style="background-image: url(/images/noticias/{img});"
                        ></div>
                        <div class="ncard">
                            <h5>{title}</h5>
                            <p>{@html body}</p>
                        </div>
                    </div>
                    {/each}
                </div>
            </div>
        </div>
</section>

<style>
h4{
    position: absolute;
    top:0;
    left:50%;
    background:var(--magenta);
    z-index:10;
    color:white;
    border-radius: .3em;
    font-size: .8em;
    transform: translate(-50%,-50%);
    margin:0;
    font-weight: 600;
    padding: .2em 1em;
}
.cont {
    max-width: 30em;
    width: 80%;
    margin: 0 auto;
    box-shadow: 0px 0px .5em rgba(133, 133, 133, .6);
    position: relative;
}

.noticia {
    display: flex;
    flex-flow: column;
    min-width: 100%;
    cursor: pointer;
}

.carousel {
    display: flex;
    flex-flow: row nowrap;
    width: 100%;
    transition: all ease-in-out 600ms;
}
.inner{
    max-width: 100%;
    overflow-x: hidden;
}

.img {
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    height: 8em;
    width: 100%;
}
.ncard {
    background: white;
    padding: 1.5em 1em;
    height: 9em;
    width: 100%;
}
h5 {
    font-weight: 500;
    font-size: 1.3em;
    color: var(--magenta);
    margin: 0;
}
p {
    margin-bottom: 0;
    font-size: .9em;
}
section {
    height: 17em;
    position:relative;
}
.background2 {
    height: 50%;
    width: 100%;
    position:absolute;
    bottom:0;
    background:var(--violeta1);
    border-radius: 1em 1em 0 0;
}

@media (min-width: 700px) {
    section {
        height: 9em;
    }

    .noticia {
        display: flex;
        flex-flow: row nowrap;
        min-width: 30em;
    }

    .img {
        width: 60%;
        height: 9em;
    }
}
</style>
