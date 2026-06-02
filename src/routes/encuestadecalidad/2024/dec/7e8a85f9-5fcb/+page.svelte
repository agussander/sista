<script>
	import Options from '../../../_components/Options.svelte';
    import { pb } from '$lib/pocketbase';

    const data={
        "general": "",
        "comunicacion": "",
        "comunicacion_adicional": "",
        "recomendable": "",
    }
    
    const optionsData = [
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
    let general_adicional;
    
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
            const record = await pb.collection('formulario_calidad_2').create({...data, general_adicional, form_type: 'encuesta'});
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
        <p><strong>Gracias por compartirnos tu opinión</strong></p>
        <p>Ya puedes cerrar esta página</p>
    </section>
    {:else}
    <section>
        <form>
            <div>
                <Options
                title={optionsData[0].question}
                data={optionsData[0].options}
                bind:res={data[optionsData[0].field]}
                ></Options>
                <h2>¿Tienes algún comentario sobre la calidad general del servicio? <small>(Opcional)</small></h2>
                <textarea bind:value={general_adicional}></textarea>
            </div>
            <div>
                <Options
                title={optionsData[1].question}
                data={optionsData[1].options}
                bind:res={data[optionsData[1].field]}
                ></Options>
                <h2>¿Qué mejoras te gustaría ver en el servicio o en nuestros medios de contacto?</h2>
                <textarea bind:value={data.comunicacion_adicional}></textarea>
            </div>
            <div>
                <Options
                title={optionsData[2].question}
                data={optionsData[2].options}
                bind:res={data[optionsData[2].field]}
                ></Options>
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
        small{
            font-weight: 300
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