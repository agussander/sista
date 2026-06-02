<script>
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { show, onSelect } from "$lib/stores";
import HomeBanking from './grupos/HomeBanking.svelte'
import PagosElectronicos from  './grupos/PagosElectronicos.svelte'
import Otros from './grupos/Otros.svelte'
import Deposito from './grupos/Deposito.svelte'
import Debito from './grupos/Debito.svelte'

$: g=$show[0].title;
$: h=$show[1].title;

function volverAlMenu() {
    goto($page.url.pathname, { replaceState: true, noScroll: true, keepFocus: true });
}

</script>
<div class="head">
    <button type="button" class="back" on:click={volverAlMenu} aria-label="Volver al listado de medios de pago"></button>
    <div class="titles">
        <h3>{g}</h3>
        <h4>{h}</h4>
    </div>
</div>
<div>
    {#if g=='Pagos electrónicos'}
        <PagosElectronicos></PagosElectronicos>
    {:else if g=='Home Banking'}
        <HomeBanking></HomeBanking>
    {:else if g=='Transferencia / Depósito bancario'}
        <Deposito></Deposito>
    {:else if g=='Cajeros Automáticos'}
        <p>Ingresar a "proveedores de Internet" y consignar su Nro de cliente{h=='Banelco'? ' completando siete digitos con 0 (ceros).' : '.'}</p>
    {:else if g=='Otros'}
        <Otros></Otros>
    {:else if g=='Adhesión al Débito Automático'}
        <Debito></Debito>
    {/if}
</div>


<style>

p{
    margin-top:0
}

.back{
    background: url('/images/back.svg') center no-repeat;
    background-size: contain;
    width: 1.5em;
    height:1.5em;
    border:none;
}
.head{
    display:flex;
    align-items: center;
    margin-bottom: 1.2em;
}
.titles{
    margin-left: .8em
}

h3{
    font-size: 1em;
    margin-bottom: 0;
    color:gray;
    font-weight: 600;
}
h4{
    margin:.1em;
    font-weight: 400;
    color:gray;
}

</style>