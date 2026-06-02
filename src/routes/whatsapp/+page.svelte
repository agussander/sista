<script>
import Redirect from "$lib/components/ui/Redirect.svelte";

</script>
<Redirect
    link="https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista"
    gtag={{ campaignName: 'Whatsapp', category: 'whatsapp', source: 'web' }}
></Redirect>