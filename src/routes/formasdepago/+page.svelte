<script>
import Container from "./_components/Container.svelte";
import ContactButtons from '$lib/components/ui/ContactButtons.svelte'
import { MetaTags } from "svelte-meta-tags";

</script>

<MetaTags
    title='Formas de pago | Sista'
    description='Conocé todos los medios de pago disponibles para tu servicio de Internet y TV de Sista: débito automático, transferencia, tarjetas y pago en efectivo.'
></MetaTags>

<section>
    <h1>Formas de pago</h1>
    <Container></Container>
    <ContactButtons></ContactButtons>
</section>

<style>
section{
    padding:1em;
}
h1{
    text-align: center;
    color: var(--text);
    text-transform: uppercase;
    margin-top:2em
}
@media (min-width:700px){
    h1{
        margin-top:3em
    }
}
</style>
