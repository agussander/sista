<script>
import { MetaTags } from "svelte-meta-tags";
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
</script>

<MetaTags
    title='Sista - Conectar la Ciudad'
    description='Conectar la Ciudad'
></MetaTags>

<section>
    <h1>Conectar la Ciudad</h1>
    
    <div class="content">
        <h2>¡Participá y ganá!</h2>
        <p>Bienvenido a Conectar la Ciudad. Participá en nuestra promoción y ganá increíbles premios.</p>
    </div>

    <ContactButtons></ContactButtons>
</section>

<style>
h1 {
    text-align: left;
    text-transform: uppercase;
    color: var(--violeta1);
    font-size: 3em;
}

section {
    padding: 3em 1em 2em;
    max-width: 50em;
    margin: 0 auto;
}

.content {
    margin-bottom: 3em;
}

h2 {
    font-size: 1.5em;
    color: var(--violeta1);
    text-transform: none;
    text-align: left;
    margin-bottom: 1em;
    font-weight: 600;
}

p {
    line-height: 1.6em;
    margin-bottom: 1em;
}

@media (min-width: 768px) {
    section {
        padding: 4em 2em 3em;
    }
    
    h2 {
        font-size: 1.8em;
    }
}
</style>
