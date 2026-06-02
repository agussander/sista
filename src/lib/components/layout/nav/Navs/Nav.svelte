<script>
import { mobile} from "$lib/stores";
import NavDesktop from "./NavDesktop.svelte";
import NavMobile from "./NavMobile.svelte";

</script>

{#if $mobile}
<NavMobile></NavMobile>
{:else}
<NavDesktop></NavDesktop>
{/if}