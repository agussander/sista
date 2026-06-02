<script>
import { onDestroy } from "svelte";
import { fade } from 'svelte/transition'
import { navbarY } from "$lib/stores"
import {scrollTo} from 'svelte-scrolling'

const carouselPhotos = [
    '/images/Internet-wifi-punta-lara-ensenada-sista-fibra-optica1.png',
    '/images/Internet-wifi-punta-lara-ensenada-sista-fibra-optica2.jpeg',
    '/images/Internet-wifi-punta-lara-ensenada-sista-fibra-optica3.jpg'
]

let y;
let x;

let index = 0;

let trans;
let count = 0;
const carr = () => setInterval(() => {
    index = (index + 1) % carouselPhotos.length;
    count++;
    if (count == 0) {
        trans = 0;
    }
    if (count == 1) {
        trans = h1h[0]

    }
    if (count == 2) {
        trans = h1h[0] * 2
    }
    if (count > 2) {
        trans = 0;
        count = 0;
    }
}, 3000);

onDestroy(async () => {
    carr.clearInterval;
})

carr();
let h1h = [];
</script>

<svelte:window bind:innerWidth={x} bind:innerHeight={y}></svelte:window>

<section>
    <img class="lines"src="./images/lines.svg" alt="decorative-lines">
    <div class="cont">
        <div class="heroe-image">
            <div class="color-img">  </div>
            {#each [carouselPhotos[index]] as src (index)}
            <img class="carousel"transition:fade {src} alt="" />
            {/each}
        </div>
        <div class="heroe-cont">
            <div class="move">
                <div class="h1h-supercont" style="height:{h1h[0]}px">
                    <h1 class="h1cont" style="height:{h1h[0]}px;">
                        <div style="transform: translateY(-{trans}px)">
                            <div style="height:{h1h[0]}px"class="flex">
                                <strong bind:clientHeight={h1h[0]}>Internet de fibra óptica</strong>
                            </div>
                            <div style="height:{h1h[0]}px" class="flex">
                                <strong bind:clientHeight={h1h[1]}>Planes a tu medida</strong>
                            </div>
                            <div style="height:{h1h[0]}px" class="flex">
                                <strong bind:clientHeight={h1h[2]}>Internet+TV</strong>
                            </div>
                        </div>
                    </h1>
                </div>
                <button class="btn-primary"
                use:scrollTo={{ref: 'planes', offset:-100}}
                >Ver Planes</button>
            </div>
        </div>
    </div>
</section>

<style>
.color-img {
    width: 100%;
    height: 100%;
    position: absolute;
    background-image: linear-gradient(82deg, rgb(112, 51, 207), rgba(36, 166, 141));
    z-index: 10;
    opacity: .6;
}

.flex {
    display: flex;
    align-items: center;
    justify-items: right;
}

.h1h-supercont {
    margin-bottom: 1em;
}

.h1cont {
    overflow: hidden;
}

.carousel {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

strong {
    display: block;
    color: white;
    font-size: 2.3rem;
    font-weight: 800;
    text-transform: uppercase;
    margin: 0 auto;
    text-align: left;
}

.lines {
    position: absolute;
    width: 100%;
    z-index: 20;
    pointer-events: none;
    display: none;
}

.heroe-cont {
    background-image: linear-gradient(var(--violeta1), var(--violeta2));
    padding: 1em 2em;
    height: 45vh;
}

.heroe-image {
    position: relative;
    height: 45vh;
}

.btn-primary {
    text-transform: uppercase;
    border: none;
    background-color: aquamarine;
    border-radius: 100px;
    color: var(--violeta1);
    font-family: 'nexa',sans-serif;
    font-weight: 700;
    font-size: 1.2em;
    padding: .5em 1.3em;
    width: 100%;
    box-shadow: 0px 0px 1em rgba(0, 0, 0, 0.4);
    display: block;
    margin: 0 auto;
    cursor:pointer;
}

@media (min-width: 750px) {
    strong {
        width: 70%;
    }

    .cont {
        display: flex;
        flex-flow: row-reverse;
    }

    .heroe-cont {
        width: 58vw;
        height: 65vh;
    }

    .move {
        transform: translateY(15vh);
    }

    .heroe-image {
        width: 42vw;
        height: 65vh;
    }

    .btn-primary {
        width: 70%;
        max-width: 20em;
        margin-left: 15%;
    }

    .lines {
        display: block;
        min-height: 130vh;
        object-fit: cover;
        object-position: center;
    }
}

@media (min-width: 1200px) {
    .heroe-cont {
        height: 100vh;
    }

    .heroe-image {
        height: 100vh;
    }

    .lines {
        min-height: 170vh;
    }

    .move {
        transform: translateY(30vh);
    }
}
</style>
