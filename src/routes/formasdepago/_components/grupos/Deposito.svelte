<script>
import Advertise from '../Advertise.svelte'
import {bancos} from '../index'
import {show} from '$lib/stores'

</script>

<Advertise text='Al efectuar el pago por transferencia o deposito, debe enviar captura o Nro de Operacion por WhatsApp (2213541906) o por mail a clientes@sista.com.ar indicando su nombre o razon social. De lo contrario, no se registra el pago al sistema.'></Advertise>
<p>Encontrá el cbu y alias para realizar la transferencia en tu boleta</p>
<img src="/images/factura-muestra.png" alt="factura">
<p>También podés consultarlo a nuestro Whatsapp</p>
<a class="shadow"
href="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista">
<span class="wsp" ></span>221-354-1906</a>

<style>
img{
    width:100%;
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
span {
    background-repeat: no-repeat;
    background-position: left center;
    padding-left: 2em;
}
.wsp {
    background-image: url("/images/whatsapp-violet-fill.svg");
}
</style>