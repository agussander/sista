<script>
import { pb } from '$lib/pocketbase';
import { token } from '../../../adminStore';
import Chart from '../../Chart.svelte';
import { onMount } from 'svelte';
import List from '../../List.svelte';

let {selected} = $props();

let data=$state();
let total = $state();

const groupKeys = {
    "formulario_calidad": ['general', 'entera', 'interrupciones', 'atencion'],
    "formulario_calidad_2": ['general','comunicacion','recomendable']
}
const optionsData = {
    'formulario_calidad':[
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
        }
    ],
    'formulario_calidad_2':[
        {
            field: 'general',
            question: '¿Qué tan satisfecho/a estás con la calidad general del servicio?',
            options: 'Muy insatisfecho, Insatisfecho, Neutral, Satisfecho, Muy satisfecho'.split(', '),
        },
        {
            field:'comunicacion',
            question:'¿Qué tan efectivos te resultan los medios de contacto que ofrecemos para tus consultas?',
            options:'No los utilizo, Poco efectivos, Efectivos, Muy efectivos'.split(', '),
        },
        {
            field:'recomendable',
            question:'¿Recomendarías el servicio de SISTA a familiares/amigos/etc.?',
            options:'Definitivamente no, Probablemente no, Probablemente si, Definitivamente si'.split(', '),
        }
    ]
}

const crearGrupos = (arr) => {
    const keys = groupKeys[selected];
    const schema = optionsData[selected];

    return schema.reduce((result, { field, question, options }) => {
        if (keys.includes(field)) {
            result[question] = options.reduce((optionCounts, option) => {
                optionCounts[option] = 0; // Inicializar todos los valores en 0
                return optionCounts;
            }, {});

            arr.forEach(obj => {
                if (obj[field] && options.includes(obj[field])) {
                    result[question][obj[field]] += 1; // Incrementar el contador si el valor está presente
                }
            });
        }
        return result;
    }, {});
};

const getRecords=async()=>{
    const records = await pb.collection(selected).getFullList({
        sort: '-created',
    });
    if(records){
        data = records;
        total = records.length
        console.log('op',data,records)
    }
}

$effect(()=>{
    getRecords();
});


</script>

{#if data}
<main>
    <section class="charts-section">
        <p>Total de respuestas: <strong>{total}</strong></p>
        <div class="charts">
            {#if data}
                {#each Object.entries(crearGrupos(data)) as info}
                    <Chart {info} {total}></Chart>
                {/each}
            {/if}
        </div>
    </section>
    <section>
        <div class="list-cont">
            <List {selected} {data}></List>
        </div>
    </section>
</main>
{/if}

<style>
    main{
        padding-top: 4em;
        margin: 0 auto;
    }
    p{
        margin: 0 auto;
        text-align: center;
        margin-bottom: 2em;
    }
    .charts{
        display: grid;
        grid-template-columns: repeat(2,1fr);
        width: 100%;
        max-width: 50em;
        flex-wrap: wrap;
        gap: 1em;
        align-items: center;
        margin: 0 auto;
        margin-bottom: 3em;
    }
    .list-cont{
        max-width: 50em ;
        margin: 0 auto;
    }
</style>