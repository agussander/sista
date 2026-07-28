<script>
import Advertise from '../Advertise.svelte'
import {bancos} from '../index'
import {show} from '$lib/stores'

</script>

<Advertise text='Los pagos demoran hasta 48hs en entrar y recibirás un recibo a tu mail cuando haya ingresado. Si no lo recibiste vencido el plazo, comunicate con el área administrativa.'></Advertise>
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