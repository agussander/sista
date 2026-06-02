<script>
import Advertise from '../Advertise.svelte'
import {show} from '$lib/stores'
import {slide} from 'svelte/transition'
import {bancos} from '../index'
import ContactButtons from '$lib/components/ui/ContactButtons.svelte'

let mercadoPago="Pagar servicios";
let opened=[];

const open=(i,m)=>{
    opened=[];
    opened[i]=m;
}
export const close=()=>opened=[];


</script>
{#if $show[1].title=='Cuenta DNI'}
<img src={$show[1].image} alt="Cuenta DNI">
<p><b>Opción "Pagar servicios"</b></p>
<div>
    <ol>
        <li>En <b>Servicios y pagos</b> elegir la opción Adherir servicio y buscar “SISTA”. Colocar Número de cliente (completar con ceros adelante, 7 dígitos en total)</li>
        <li>En <b>Agenda de pagos</b> elegir la opción “SISTA”, colocar el importe y en "Referencia" completar con 4 dígitos</li>
    </ol>
    <small>
        Ante cualquier duda escribinos por WhatsApp al 2213541906
    </small>

</div>

{:else}
    <p>
        A través de <a href="https://clientes.sista.com.ar" target="_blank" rel="noopener noreferrer" class="clientes-link"><b>clientes</b><svg class="external-link-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>, ingresando con número de cliente de 6 dígitos.
    </p>
    <p>El número de cliente se puede obtener de la factura</p>
    <img src="/images/pago/factura-ejemplo.png" alt="Ejemplo de factura">
    <p>Si necesitás ayuda para saber tu número de cliente, contactate con nosotros.</p>
    <ContactButtons></ContactButtons>
{/if}

<!--
{#each mercadoPago as m,i}
    <div class="group">
        <button on:click={()=>opened[i]!=m ? open(i,m) : close()}>> Opción {m}</button>
        {#if opened[i]==mercadoPago[0] && $show[0].title=='Pagos electrónicos'}
            <div transition:slide>
                <ol>
                    <li>Buscar empresa "SISTA SA"</li>
                    <li>Colocar número de DNI</li>
                    <li>Abonar factura disponible</li>
                </ol>
                <small>
                    Este pago ingresa en forma automática a través de Rapipago,
                    con los mismos tiempos de demora (mín. 24 hs hábiles)
                    por lo cual si tu servicio puede ser cortado por falta de pago o abonaste cerca de los vencimientos,
                    envianos el comprobante por WhatsApp
                </small>
                <small>
                Al igual que Rapipago, las facturas de los meses anteriores no se encuentran en la base,
                lo que no significa que estén pagas. Ante la duda, recomendamos siempre consultar tu cuenta corriente a través de WhatsApp.
                </small>
            </div>
        {:else if opened[i]==mercadoPago[1] && $show[0].title=='Pagos electrónicos'}
            <div transition:slide>
                <p>Escanear el Codigo QR y abonar el monto de la factura</p>
                <img src='/images/pago/{$show[1].image}' alt="">
            </div>
        {:else if opened[i]==mercadoPago[2] && $show[0].title=='Pagos electrónicos'}
            <div transition:slide>
                <p>Solicitar link de pago por WhatsApp</p>
                <a class="shadow"
                href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista">
                <span class="wsp" ></span>221-354-1906</a>
            </div>
        {:else if opened[i]==mercadoPago[3] && $show[0].title=='Pagos electrónicos'}
            <div transition:slide>
                <p>Enviar transferencia a cualquiera de las cuentas de la empresa</p>
                {#each $bancos as b}
                    <div>
                        <h4>{b.name}</h4>
                        <p><b>Alias: </b>{b.alias}</p>
                        <p><b>CBU: </b>{b.cbu}</p>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/each}
-->

<style>
img{
    width:100%;
    border:1px solid rgb(200,200,200);
}
.group{
    width:100%;
    border-bottom: 1px solid var(--violeta1);
    padding: 1em 0;
}
.group:hover{
    background: linear-gradient(white, rgb(250, 250, 250))
}
button{
    color: var(--text);
    font-family: inherit;
    font-weight: 500;
    font-size: inherit;
    width:100%;
    text-align: left;
    background: none;
    border: none;
}
ol{
    padding-left: 1.2em;
}
li{
    margin-bottom: .6em;
}
small{
    color: gray;
    display: block;
}
h4{
    color: var(--text);
    font-weight: 300;
    margin: 0;
    font-size: .9em;
}
a {
    display: inline-block;
    background: white;
    padding: .8em 1em .8em;
    border-radius: 100em;
    border: none;
    box-shadow: 0px 0px 1em rgba(0, 0, 0, .2);
    font-size: 1em;
    margin:1em auto;
}
a:hover{
    transform: scale(102%);
    box-shadow: 0px 0px 1em rgba(0, 0, 0, .3);
    cursor:pointer;
    background:whitesmoke;
    opacity:1;
}

.wsp {
    background-image: url("/images/whatsapp-violet-fill.svg");
    background-repeat: no-repeat;
    background-position: left center;
    padding-left: 2em;
}
.clientes-link {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    color: var(--text);
    text-decoration: underline;
    background: none;
    padding: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
    margin: 0;
    font-size: inherit;
    font-weight: inherit;
}
.clientes-link:hover {
    text-decoration: underline;
    transform: none;
    background: none;
    opacity: 1;
}
.clientes-link b {
    font-weight: 600;
}
.external-link-icon {
    width: 1em;
    height: 1em;
    stroke: var(--text);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}
</style>