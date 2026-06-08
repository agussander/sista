<script>
import {modal} from '$lib/stores'
import { goto } from '$app/navigation'

const whatInfo = [
    {
        title: 'Fibra Óptica',
        text: 'Con SISTA accedés a Internet sin límites, mayor velocidad y estabilidad con el servicio de Fibra Óptica ',
        img: '/images/fibra-optica.png',
    },
    {
        title: 'TV',
        text: 'Sumá <b><strong>TV</strong></b> a tu plan y disfrutá de la mejor experiencia de entretenimiento',
        img:'/images/streaming-tv.jpg'
    }
];

function handleClick(title) {
    if (title === 'TV y Streaming') {
        goto('/tv');
    } else if (title === 'Fibra Óptica') {
        goto('/fibra-optica');
    } else {
        $modal = true;
    }
}
</script>

<section>
{#each whatInfo as {title,text,img}}
<div class="card" >
    <img src={img} alt="persona utilizando {title}" style="object-position: {title=="Fibra Óptica"? 'right' : 'left'};">
    <div class="text-cont">
        <h3>{title}</h3>
        <p>{@html text}</p>
        <button class="btn-text" on:click={()=>handleClick(title)}>
            Más Información
            <svg class="arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </button>
    </div>
</div>
{/each}
</section>

<style>
.card {
    position: relative;
    box-sizing: border-box;
    width: 75%;
    margin: 5em auto;
    z-index: 30;
    display: flex;
    max-width: 40em;
    flex-flow:column;
}

img {
    object-fit: cover;
    max-height: 16em;
    border-radius: 1em;
}

.text-cont {
    padding: 2em;
}
p{
    margin-bottom: 2em;
}

.btn-text {
    text-transform: uppercase;
    font-size: 0.875rem;
}

.btn-text .arrow-icon {
    transition: transform ease-in-out 100ms;
}

.btn-text:hover .arrow-icon {
    transform: translateX(0.25em);
}

@media (min-width: 768px){
    .text-cont{
        width:100%;
    }
    .card{
        flex-flow:row;
    }
    img{
        max-width:40%;
    }
}

@media (max-width: 768px){
    /* El gap hacia el hero lo da el padding-bottom del hero (3em). */
    .card:first-child{
        margin-top: 0;
    }
}
</style>
