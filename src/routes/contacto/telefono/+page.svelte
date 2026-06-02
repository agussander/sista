<script>
import ContactPage from "$lib/components/ui/ContactPage.svelte";

const telDisplay = "0221 644 2600";
const telHref = "+542216442600";
</script>

<ContactPage data={telDisplay} title="Teléfono">
	<a class="btn-1" href="tel:{telHref}"> <i class="tel-icon"></i>Llamar</a>
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
.tel-icon {
	background: url("/images/icon-tel-white.svg") no-repeat center center;
	background-size: contain;
}
</style>
