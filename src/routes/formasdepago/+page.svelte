<script>
import Container from "./_components/Container.svelte";
import ContactButtons from '$lib/components/ui/ContactButtons.svelte'
import { MetaTags } from "svelte-meta-tags";

</script>

<MetaTags
    title='Sista - Formas de Pago'
    description='Internet de fibra óptica y tv'
></MetaTags>

<section>
    <h1>Medios de pago</h1>
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
