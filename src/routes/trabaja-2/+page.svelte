<script>
import { onDestroy, onMount } from "svelte";

import Sumables from './_components/Sumables.svelte'
import { MetaTags } from "svelte-meta-tags";

let secundario=false;

let response=false;
let selectValue;

let file;
let info={};

const interval1=setInterval(()=>{
        response=grecaptcha.getResponse();
    },4000);
onMount(async()=>{
interval1;
});
onDestroy(()=>clearInterval(interval1));

const sendData=()=>{
    const data= new FormData();


}


let newVal;

const recaptchaSiteKeyBaja = import.meta.env.VITE_RECAPTCHA_SITE_KEY_BAJA ?? '6LdBk_YmAAAAAJAM7B2-HXaobQq3lyQt6u5hNDGa';
</script>
<MetaTags
    title= 'Sista - Trabaja con Nosotros'
    description= 'Llená el formulario y aplicá para alguna de nuestras vacantes de trabajo'
></MetaTags>

<svelte:head>
    <script type="text/javascript">
        var onloadCallback = function() {
          grecaptcha.render('html_element', {
            'sitekey' : '{recaptchaSiteKeyBaja}'
          });
        };
      </script>
</svelte:head>

<section>
    <h1>¿Querés trabajar con nosotros?</h1>
    <p>Completá este formulario para darnos tu información</p>
    <form enctype="multipart/form-data">
        <div class="group">
            <h2>Datos personales</h2>
            <label>Nombre
                <input bind:value={info.nombre} require type="text" name="nombre" >
            </label>
            <label for="dni">Apellido
                <input bind:value={info.apellido} require type="text" name="apellido" >
            </label>
            <label> DNI
                <input bind:value={info.dni} required type="text" name="dni" >
            </label>
                <label>Fecha de Nacimiento
                <input bind:value={info.nacimiento} required type="date" name="nacimiento" >
            </label>
        </div>
        <div class="group">
            <label> Aplica a:
                <select requiered bind:value={selectValue}
                name="puesto"
                style="color: {selectValue=='' ? 'gray' : 'var(--text)'}">
                    <option value="" disabled selected>--seleccionar--</option>
                    <option value="Cajero">Cajero/a</option>
                    <option value="Administrativo">Administrativo/a</option>
                    <option value="Tecnico instalador">Técnico/a instalador</option>
                    <option value="Ventas">Ventas</option>
                    <option value="Soporte">Soporte técnico</option>
                    <option value="Otro">Otro</option>
                </select>
                {#if selectValue=="Otro"}
                    <p style="margin:.5em 0">Especifique:</p>
                    <input bind:value={info} style="display: inline" type="text" placeholder="Otro" name="otro-cual">
                {/if}
            </label>
        </div>
        <div class="group">
            <h2>Nivel de estudios secundario</h2>
            <label>
                <input type="radio" name="secundario" bind:group={info.secundario} value={'completo'}>
                Completo
            </label>
            <label>
                <input type="radio" name="secundario" bind:group={info.secundario} value={'incompleto'}>
                Incompleto
            </label>
            {#if secundario=='incompleto'}
                <label>
                    Último grado que cursó o está cursando <br>
                    <input bind:value={info.ultimoGrado} required type="text" style="margin-left: 0; border-width: 0 0 1.5px; border-radius: 0; width: 100%">
                </label>
            {/if}
        </div>
        <div class="group">
            <h2>Formación académica</h2>
            <label>
                Contanos acerca de tu formación educativa, si estás en una carrera actualmente, ya sea terciaria o universitaria
                <br>
                <Sumables></Sumables>
            </label>
        </div>
        <div class="group">
            <h2>Experiencia Laboral</h2>
            <label>Indicanos tu experiencia en otros trabajos y/o áreas de trabajo
                <textarea requiered id="" cols="30" rows="10" name="experiencia"></textarea>
            </label>
        </div>
        <div class="group">
            <h2>Contacto</h2>
            <label>Teléfono
                <input bind:value={info.tel} required type="phone" name="telefono" >
            </label>
            <label>Mail
                <input bind:value={info.mail} required type="mail" name="mail" >
            </label>
        </div>
        <div class="group">
            <h2>Curriculum</h2>
            <label>
                <input bind:files={file} required type="file" style="border: none; margin-left:0; padding-left:0" name="curriculum">
            </label>
            <small>Asegurate de que no supere los 5mb</small>
        </div>
        <script src="https://www.google.com/recaptcha/enterprise.js?onload=onloadCallback&render=explicit" async defer>
        </script>
        <div id="html_element"></div>
        {#if response}
        <input type="submit" class="submit">
        {/if}
        <p>Verifica el captcha para enviar</p>
    </form>
</section>

<style>
section{
    padding: 4em 1em 3em;
    display: flex;
    align-items: center;
    flex-direction: column;
}
h1{
    margin-bottom: 0;
}
p{
    margin-bottom: 2em;
}
form{
    background: white;
    max-width: 30em;
    padding: 2em;
    border-radius: 1em;
    filter: drop-shadow(0px 0px 4px #BBBBBB);
}
h2{
    font-size: 1.2em;
    font-weight: 600;
    text-transform: none;
    text-align: left;
    margin-bottom: 0.2em;
}
.group{
    margin-bottom: 2em;
}
label{
    display: block;
    margin-bottom: .5em;
    color: var(--text);
}
input{
    border-color: var(--violeta2);
    border-style: solid;
    border-width: 1.5px;
    border-radius: 5px;
    font-family: sans-serif;
    font-weight: 1em;
    padding: .2em .4em;
    margin-left: .5em;
}
textarea{
    width: 100%;
    resize: vertical;
    height: 9em;
    margin-top: .4em;
    border-color: var(--violeta2);
    border-style: solid;
    border-width: .1em;
    border-radius: 5px;
    font-family: sans-serif;
    font-weight: 1em;
}
.submit{
    background: var(--violeta2);
    padding: .5em 1em;
    border-radius: 100px;
    color: white;
    text-transform: uppercase;
    cursor: pointer;
}
.submit:hover{
    background: var(--violeta2-hover);
    box-shadow: 0 0 4px gray;
}
input[type="file"]{
    font-size: .8em;
}
input[type="file"]::file-selector-button{
font-size: 1rem;
background: var(--violeta2);
color: white;
font-family: 'nexa';
border: none;
outline: none;
padding: .5em 1em;
border-radius: 100px;
cursor: pointer;
display: block;
margin-bottom: .4em;
}
input[type="file"]::file-selector-button:hover{
    background: var(--violeta2-hover);
}
select{
font-family: 'nexa';
border-radius: 100px;
font-size: 1rem;
padding: .3em .5em;
border-color: var(--violeta2);
border-width: 2px;
font-weight: 400;
}
select:focus{
border-color: var(--violeta2-hover);
outline: none;
}
</style>