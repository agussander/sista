<script>
import {show} from '$lib/stores'
import {mediosDePago} from '../index'
$: h=$show[1].title
const go=(x,y)=>{
    $show=[$mediosDePago[x],$mediosDePago[x]['opciones'][y]]
}
</script>

{#if h=='Tarjetas'}
    <p>Pago mediante tarjetas VISA (Credito y Debito) y MasterCard (Credito)</p>
    <ol>
        <li>Por <b class="link" on:click={()=>go(0,0)}>Mercado Pago</b></li>
        <li>En nuestra <b class="link" on:click={()=>go(4,3)}>Oficina Comercial</b></li>
        <li>Adherite al <b class="link" on:click={()=>go(4,0)}>débito automático</b></li>
    </ol>
{:else if h=='Rapipago / Pagofacil'}
<p>Se puede abonar con número de cliente, número de DNI o factura.</p>
<small>
    Este pago ingresa en forma automática con un tiempo de demora mínimo de 24 horas hábiles, 
    por lo cual si tu servicio puede ser cortado por falta de pago o abonaste cerca de los vencimientos, 
    envianos el comprobante por WhatsApp
</small>
<small>
    Las facturas de los meses anteriores no se encuentran en la base, lo que no significa que estén pagas. 
    Ante la duda, recomendamos siempre consultar tu cuenta corriente a través de WhatsApp.
</small>
{:else if h=='Cheques'}
    <p>Se aceptan cheques para el pago de las facturas solo si cumplen con los requisitos que se detallan a continuacion:</p>
    <ul>
        <li>Cheques Propios del cliente</li>
        <li>Fecha de pago maximo dia de vencimiento de la factura.</li>
    </ul>
{:else if h=='Efectivo'}
    <h6>Ubicación</h6>
    <a class="link" target="_blank" href="https://www.google.com/maps/place/Sista/@-34.8228441,-57.9641418,15z/data=!4m5!3m4!1s0x0:0x8bb5e7d89d0ca379!8m2!3d-34.8228441!4d-57.9641418">Alte Brown 3064 e/54 y 56, Punta Lara (pdo Ensenada)</a>
    <h6>Horario:</h6>
    <p><b>Lunes a viernes:</b> 9:00 a 17:00</p>
    <p><b>Sabados:</b> 9:00 a 12:00 hs.</p>

{/if}

<style>
h6{
    color:var(--text);
    font-size: 1em;
    margin-bottom: .1em;
}
small{
    margin-top: 2em;
    color: gray;
    display: block;
}
.link{
    cursor:pointer;
    text-decoration: underline;
}

ol,ul{
    padding-left:1em
}
li{
    margin-bottom: .5em;
}
</style>