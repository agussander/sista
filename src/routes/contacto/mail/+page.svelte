<script>
import ContactPage from "$lib/components/ui/ContactPage.svelte";

const mail = 'info@sista.ar';


</script>

<ContactPage
data = {mail}
title = "Mail"
>
<a class="btn-1" href="mailto:{mail}"> <i class="mail-icon"></i>Enviar Mail</a>
</ContactPage>

<style>
a{
    width: 100%;
    padding: .4em 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .5em;
}
i{
    width: 1em;
    height: 1em;
    display: inline-block;
    margin-right: .5em;
}
.mail-icon{
    background: url('/images/icon-mail-white.svg') no-repeat center center;
    background-size: contain;
}
</style>

