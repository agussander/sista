<script>
	import Hero from "$lib/components/home/Hero.svelte";
	import HeroeSection from "$lib/components/home/HeroeSection.svelte";
	import What from "$lib/components/home/What.svelte";
	import Price from "$lib/components/home/Price.svelte";
	import Form1 from "$lib/components/forms/Form1.svelte";
	// import Cobertura from "$lib/components/home/Cobertura.svelte";
	import Novedades from "$lib/components/home/Novedades.svelte";
	import ContactButtons from "$lib/components/ui/ContactButtons.svelte";
	import { MetaTags } from "svelte-meta-tags";

</script>

<MetaTags
    title = "Sista"
    description = "Innternet por fibra óptica y tv"
    author ="Sista"
    robots= "index, follow"
></MetaTags>


<!-- <HeroeSection></HeroeSection> -->
<div class="section-container hero-section-wrap">
    <Hero></Hero>
</div>
<div class="section-container">
    <What></What>
</div>
<div class="section-container">
    <Price></Price>
</div>
<!-- <div class="section-container">
    <Cobertura></Cobertura>
</div> -->
    <Novedades></Novedades>
<div class="section-container form-cont">
    <h2 id="contacto" class="contactanos">Contactanos</h2>
    <Form1></Form1>
    <ContactButtons></ContactButtons>
</div>

<style>
.section-container {
    margin-bottom: 10em;
}

.section-container:last-child {
    margin-bottom: 0;
}

/* En mobile el form vive al fondo del hero, a 3em de las cards de Fibra/TV.
   Anulamos el margen entre hero y What para que ese gap lo controle el hero
   (padding-bottom: 3em) + el margin-top: 0 de la primera card. */
@media (max-width: 768px) {
    .hero-section-wrap {
        margin-bottom: 0;
    }
}

.form-cont {
    background: var(--violeta1);
    padding: 2em 1em;
}

.contactanos {
    color: white;
}

</style>
