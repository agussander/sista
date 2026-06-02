<script>
import Options from '../Options.svelte'
import { pb } from '$lib/pocketbase';

const data={
    "general": "",
    "velocidad": "",
    "interrupciones": "",
    "atencion": "",
    "entera": "",
    "mejora": "",
}

const optionsData = [
    {
        field: 'general',
        question: '¿Qué tan satisfecho está con la calidad general del servicio?',
        options: 'muy insatisfecho, insatisfecho, neutral, satisfecho, muy satisfecho'.split(', '),
    },
    {
        field:'velocidad',
        question:'¿Cómo calificaría la velocidad de conexión de su servicio?',
        options:'muy mala, mala, aceptable, buena, excelente'.split(', '),
    },
    {
        field:'interrupciones',
        question:'¿Con qué frecuencia experimenta interrupciones en su servicio?',
        options:'siempre, frecuentemente, ocasionalmente, nunca'.split(', '),
    },
    {
        field:'atencion',
        question:'¿Qué tan satisfecho está con la atención al cliente que ha recibido?',
        options: 'muy insatisfecho, insatisfecho, neutral, satisfecho, muy satisfecho'.split(', '),
    },
    {
        field:'entera',
        question:'¿Cómo se enteró de nuestro servicio?',
        options:'recomendación, facebook, instagram, web, vía pública'.split(', ')
    },
]
let otros;

let canSend;

$: if(!Object.values(data).some(value => value === "")){
    canSend=true
} else{
    canSend=false
}

let enviado;
let cargando;

const submit = async()=>{
    cargando=true;
    canSend=false;
    try{
        const record = await pb.collection('formulario_calidad').create({...data, otros});
        enviado=true
    }
    catch (error){
        console.error(error.data)
        alert('Tu respuesta no pudo ser enviada. Revisa que todas las casillas estén completas. Si el problema persiste, puedes comunicarte con nosotros')
        canSend=true;
        cargando=false;
    }
}

</script>

<svelte:head>
    <meta name="robots" content="noindex">
</svelte:head>

<main>
{#if enviado}
<section>
    <p><strong>Gracias por copartirnos tu opinión</strong></p>
    <p>Ya puedes cerrar esta página</p>
</section>
{:else}
<section>
    <form>
        {#each optionsData as {question,options,field}}
            <div>
                <Options
                title={question}
                data={options}
                bind:res={data[field]}
                ></Options>
            </div>
        {/each}
        <div>
            <h2>¿Hay algún aspecto específico del servicio que le gustaría mejorar?</h2>
            <textarea bind:value={data.mejora}></textarea>
        </div>
        <div>
            <h2>¿Algún comentario adicional que le gustaría compartir? <small> (opcional)</small></h2>
            <textarea bind:value={otros}></textarea>
        </div>
        <button class='btn-1'
        class:disabled={!canSend}
        on:click|preventDefault={submit}
        >{cargando ? 'Cargando...' : 'Enviar'}</button>
        {#if !canSend && !cargando}
        <p style="font-size: .9rem;">complete todos los datos obligatorios para enviar</p>
        {/if}
    </form>
</section>
{/if}
</main>

<style>
    main{
        display: grid;
        place-items: center;
        width: 100vw;
        font-size: 1.1em;
    }
    section{
        max-width: 30em;
        padding: 4em 1em;
    }
    h1{
        font-size: 1.2em;
        font-weight: 500;
        margin-bottom: 2em;
    }
    form>div{
        margin-bottom:3em
    }
    h2{
        font-size: 1.1rem;
        text-transform: none;
        text-align: left;
        font-weight: 500;
    }
    textarea{
        font-family: sans-serif;
        width: 100%;
        height: 6em;
    }
    .disabled{
        background: gray;
        pointer-events: none;
    }
</style>