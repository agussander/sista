<script>
import { onDestroy, onMount } from "svelte";
import { MetaTags } from "svelte-meta-tags";
import { FORM_ENDPOINTS } from '$lib/formEndpoints.js';


let secundario=false;

let response=false;
let selectValue;

const interval1=setInterval(()=>{
        response=grecaptcha.getResponse();
    },4000);
onMount(async()=>{
interval1;
});
onDestroy(()=>clearInterval(interval1));

const recaptchaSiteKeyBaja = import.meta.env.VITE_RECAPTCHA_SITE_KEY_BAJA ?? '6LdBk_YmAAAAAJAM7B2-HXaobQq3lyQt6u5hNDGa';
</script>

<svelte:head>
    <script type="text/javascript">
        var onloadCallback = function() {
          grecaptcha.render('html_element', {
            'sitekey' : '{recaptchaSiteKeyBaja}'
          });
        };
      </script>
</svelte:head>

<MetaTags
    title= 'Sista - Trabaja con Nosotros'
    description= 'Llená el formulario y aplicá para alguna de nuestras vacantes de trabajo'
></MetaTags>

<section>
    <h1>¿Querés trabajar con nosotros?</h1>
    <p>Completá este formulario para darnos tu información</p>
    <form action={FORM_ENDPOINTS.TRABAJO} method="POST" enctype="multipart/form-data">
        <input type="hidden" name="form_type" value="trabajo">
        <div class="group">
            <h2>Datos personales</h2>
            <label>Nombre
                <input require type="text" name="nombre" >
            </label>
            <label for="dni">Apellido
                <input require type="text" name="apellido" >
            </label>
            <label> DNI
                <input required type="text" name="dni" >
            </label>
                <label>Fecha de Nacimiento
                <input required type="date" name="nacimiento" >
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
                    <input style="display: inline" type="text" placeholder="Otro" name="otro-cual">
                {/if}
            </label>
        </div>
        <div class="group">
            <h2>Nivel de estudios secundario</h2>
            <label>
                <input type="radio" name="secundario" bind:group={secundario} value={'completo'}>
                Completo
            </label>
            <label>
                <input type="radio" name="secundario" bind:group={secundario} value={'incompleto'}>
                Incompleto
            </label>
            {#if secundario=='incompleto'}
                <label>
                    Último grado que cursó o está cursando <br>
                    <input required type="text" style="margin-left: 0; border-width: 0 0 1.5px; border-radius: 0; width: 100%">
                </label>
            {/if}
        </div>
        <div class="group">
            <h2>Formación académica</h2>
            <label>
                Contanos acerca de tu formación educativa, si estás en una carrera actualmente, ya sea terciaria o universitaria
                <br>
                <textarea required id="" cols="30" rows="10" name="formacion"></textarea>
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
                <input required type="phone" name="telefono" >
            </label>
            <label>Mail
                <input required type="mail" name="mail" >
            </label>
        </div>
        <div class="group">
            <h2>Curriculum</h2>
            <label>
                <input required type="file" style="border: none; margin-left:0; padding-left:0" name="curriculum">
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

<style lang="scss">
@import './styles.scss';
</style>