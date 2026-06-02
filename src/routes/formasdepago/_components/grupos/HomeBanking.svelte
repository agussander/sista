<script>
import {show} from '$lib/stores'
import {bancos,mediosDePago} from '../index'

$: h=$show[1].title;

const go=(x,y)=>{
    $show=[$mediosDePago[x],$mediosDePago[x]['opciones'][y]]
}
</script>

{#if h=="Red Link" || h=="Banelco"}
<p>A traves del Sistema {h} desde el Home Banking de su cuenta, eligiendo la forma de pago:{h=="Red Link"? "" : " Pagomiscuentas o a traves del sitio www.pagomiscuentas.com"}</p>
    {#if h!=='Banelco'}
        <ul>
            <li>Ingresar a proveedores de Internet</li>
            <li>Consignar Numero de cliente</li>
        </ul>
    {/if}
    <small>
        Al efectuar el pago por {h} este se imputará en forma automática. 
        En caso de vencimiento próximo o corte de servicio debe enviar captura del pago a través de WhatsApp (2213541906) 
        o por mail a clientes@sista.com.ar indicando su nombre o razón social
    </small>
{:else}
    <p>Desde el Home Banking de su cuenta o a través de MercadoPago. <span on:click={()=>go(0,0)}>Ir a MercadoPago</span>.</p>
    <p><b>Titular de la cuenta: </b>Sista SA</p>
    <p><b>CUIT:</b> 30-70787653-7</p>
    <div class="line"></div>
    <p class="explain">Realice la transferencia a cualquiera de nuestras cuentas:</p>
    {#each $bancos as b}
        <div>
            <h4>{b.name}</h4>
            <p><b>Alias: </b>{b.alias}</p>
            <p><b>CBU: </b>{b.cbu}</p>
        </div>
    {/each}
{/if}

<style>
p>b{
    font-weight: 600;
}
span{
    text-decoration: underline;
    cursor:pointer;
    font-weight: 500;
}
.line{
    width:100%;
    height:1px;
    background: var(--violeta1);
    margin-bottom: 1em;
    margin-top: 2em;
}
.explain{
    margin: 1.5em auto 2em;
}
h4{
    color: var(--text);
    font-weight: 300;
    margin: 0;
    font-size: .9em;
}
div{
    margin-bottom: 2.5em;
}
li{
    margin-bottom: 1em;
}
small{
    margin-top: 2em;
    color: gray;
    display: block;
}
</style>