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
    title="Internet por fibra óptica y TV en Ensenada, Punta Lara y Tolosa | Sista"
    description="Internet por fibra óptica y TV en Ensenada, Punta Lara y Tolosa. Alta velocidad, instalación rápida y soporte local. Consultá cobertura y contratá tu plan."
    author="Sista"
    robots="index, follow"
    openGraph={{
        title: "Sista — Internet por fibra óptica y TV en Ensenada, Punta Lara y Tolosa",
        description: "Internet por fibra óptica y TV en Ensenada, Punta Lara y Tolosa. Alta velocidad, instalación rápida y soporte local. Consultá cobertura y contratá tu plan.",
        siteName: "Sista"
    }}
></MetaTags>


<!-- <HeroeSection></HeroeSection> -->
<div class="section-container hero-section-wrap">
    <Hero></Hero>
</div>
<div class="section-container price-section">
    <Price></Price>
</div>
<div class="section-container">
    <What></What>
</div>
<!-- <div class="section-container">
    <Cobertura></Cobertura>
</div> -->
    <Novedades></Novedades>
<div class="section-container form-cont" style="margin-bottom: 0;">
    <h2 id="contacto" class="contactanos">Contactanos</h2>
    <Form1></Form1>
    <ContactButtons></ContactButtons>
</div>

<style>
.section-container {
    margin-bottom: 10em;
}
.hero-section-wrap {
        margin-bottom: 0;

    }

/* Sin margen superior grande: el relleno gris del SVG ya hace la transición
   violeta → gris al final del hero. Un margin-top de 10em dejaba un hueco vacío
   donde solo se veía el fondo de html/body (DevTools lo marca como <html>) y las
   líneas quedaban cortadas en recto al scrollear. */
.price-section {
    padding-top: 1em;
    position: relative;
    z-index: 1;
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
@media (max-width: 768px) {
    .price-section {
    margin-top: -6em;
    }
}
</style>
