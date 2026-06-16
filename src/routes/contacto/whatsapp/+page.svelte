<script>
import ContactPage from "$lib/components/ui/ContactPage.svelte";

const wspDisplay = "221 354 1906";
const wspLink = "https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista";
</script>

<ContactPage data={wspDisplay} title="WhatsApp">
	<a class="btn-1" target="_blank" href={wspLink}> <i class="wsp-icon"></i>Mandar WhatsApp</a>
</ContactPage>

<style>
a {
	width: 100%;
	padding: 0.4em 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5em;
}
i {
	width: 1em;
	height: 1em;
	display: inline-block;
	margin-right: 0.5em;
}
.wsp-icon {
	background: url("/images/icon-whatsapp.svg") no-repeat center center;
	background-size: contain;
}
</style>
