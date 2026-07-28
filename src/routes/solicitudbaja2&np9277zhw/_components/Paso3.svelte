<script>
import { datosBaja } from './bajaStore';
import { getNextWeekDays } from './utils.js';
import StepButtons from './StepButtons.svelte';
import { feriados } from './feriados';

let compromiso = [false, false, false];


const dias='Lunes,Martes,Miércoles,Jueves,Viernes,Sábado'.split(',');

const proxDias= ()=>{
    let res=[];
    for(let i=0; i<6; i++){
        res[i]= [`${getNextWeekDays()[i]}`, feriados.includes(getNextWeekDays()[i])]
    }
    return res;
};

const times = ['9-13', '13-17'];
</script>

<h2>
    ¿Cómo desea devolver su equipo?
</h2>
<p>Se requiere la devolución de los equipos instalados en comodato que son propiedad de SISTA y están en tu domicilio. <strong>En caso de no devolver los mismos, podrán generarse los cargos correspondientes</strong></p>
<p style="margin-top: 1em;">Seleccione una de las opciones para su devolución</p>
<div class="wrap">
    <label class:disabled={$datosBaja.devolucion=='domicilio'}>
        <input type="radio"
        value="sucursal"
        bind:group={$datosBaja.devolucion}
        on:click={() => { compromiso = [false, false, false]; }}>
        Devolución en sucursal
    </label>
    <label class:disabled={$datosBaja.devolucion=='sucursal'}>
        <input type="radio"
        value="domicilio"
        on:click={() => { compromiso = [false, false, false]; }}
        bind:group={$datosBaja.devolucion}>
        Solicitar retiro a domicilio de instalación
    </label>
</div>
<div class="info">

    {#if $datosBaja.devolucion=='sucursal'}
        <p class="info-sucursal">Puede acercar los equipos que posee a nuestra oficina en un plazo máximo de 5 días hábiles. </p>
        <p class="info-sucursal">Av. Almirante Brown 3064, Punta Lara <a target="_blank" href="https://www.google.com/maps/place/SISTA/@-34.8228441,-57.9641418,15z/data=!4m6!3m5!1s0x95a2e0fd1959f825:0x8bb5e7d89d0ca379!8m2!3d-34.8228441!4d-57.9641418!16s%2Fg%2F11bbrkck6c?entry=ttu">Ver en Maps</a></p>
        <p class="info-sucursal">Lunes a Viernes: de 9 a 17hs</p>
        <p class="info-sucursal">Sábados: de 9 a 12hs</p>
        <div class="compromiso">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <label for="ok" on:click={() => { compromiso[2] = !compromiso[2]; }}>
                <input type="checkbox" name="compromiso" checked={compromiso[2]}>
                Leí y acepto que devolveré los equipos en la sucursal en el plazo establecido
            </label>
        </div>



    {:else if $datosBaja.devolucion=='domicilio'}

        <h4>Indique día y horario de preferencia para visita a domicilio</h4>
        <div class="opciones">
            <!-- svelte-ignore a11y-no-onchange -->
            <select name="día" class="dia"
            bind:value={$datosBaja.dia}
            >
                <option value="Día" selected disabled>Día</option>
                {#each proxDias() as d,i}
                    <option
                    value={d[0]}
                    disabled={d[1]}
                    >{dias[i]} {d[0].substring(0,2)}</option>
                {/each}
            </select>
            <!-- svelte-ignore a11y-no-onchange -->
            <select name="hora"
            bind:value={$datosBaja.hora}
            >
                <option value='Horario' selected disabled>Horario</option>
                {#each times as time}
                    <option value={time}>de {time}hs</option>
                {/each}
            </select>
        </div>

        <p>El domicilio de retiro será el indicado en la solicitud de servicio:</p>
        <p style="font-weight: 600; font-size: 1.2em">{$datosBaja.domicilio}</p>



        <div class="compromiso">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <label for="ok" on:click={() => { compromiso[0] = !compromiso[0]; }}>
                <input type="checkbox" name="compromiso" checked={compromiso[0]}>
                Me comprometo a estar presente en mi domicilio el día y horario pautado (puede estar el titular u otra persona).
            </label>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <label for="ok" on:click={() => { compromiso[1] = !compromiso[1]; }}>
                <input type="checkbox" name="compromiso" checked={compromiso[1]}>
                En caso de ser necesario, me comunicaré para recoordinar la visita; caso contrario, acepto que se puedan generar cargos.
            </label>
        </div>
    {/if}
    <StepButtons></StepButtons>
</div>

<style>
a{
    margin-top: 0;
}
p{
    margin: 0 0 1em;
}
h2{
    font-size: 1em;
    text-align: left;
}
.wrap{
    background: white;
    border-radius: 10px;
    margin-bottom: 1.2em;
}
.wrap>label{
    cursor: pointer;
}
label{
    display: block;
    padding: .5em;
    font-weight: 500;
}
.disabled{
    background: var(--background);
    opacity: .7;
    font-weight: 400;
}
.info>p{
    margin:0 0 .2em;
}
.opciones{
    padding-top: 1em;
    margin-bottom: 2em;
}
:global(input[type='check']){
    display: block;
}
h4{
    color: var(--violeta2);
    margin-bottom: .5em;
    margin-top: 2em;
}
select{
    font-family: inherit;
    color: var(--text);
    border-radius: 5px;
    border-color: var(--violeta1);
    font-size: 1em;
}
</style>