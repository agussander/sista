<script>
import { MetaTags } from 'svelte-meta-tags';
import ContactButtons from '$lib/components/ui/ContactButtons.svelte';
import Spinner from '$lib/components/ui/Spinner.svelte';
import { pb } from '$lib/pocketbase';
import { onMount } from 'svelte';

let imageUrl = $state(null);
let loading = $state(true);

onMount(async () => {
    try {
        const record = await pb.collection('precios').getFirstListItem('');
        if (record && record.precios_completos) {
            imageUrl = pb.files.getURL(record, record.precios_completos);
        }
    } catch (error) {
        console.error('Error loading image:', error);
    } finally {
        loading = false;
    }
});
</script>

<s-head>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta name="robots" content="noindex, nofollow">
</s-head>

<MetaTags
title='Sista - Precios'
description = 'Internet de fibra óptica y tv'
></MetaTags>

{#if loading}
<div class="loading-container">
    <Spinner size={50} />
</div>
{:else if imageUrl}
<div>
    <img src={imageUrl} alt="precios" fetchpriority="high" decoding="async">
</div>
<p>Consultá tu cobertura</p>
<ContactButtons></ContactButtons>
{:else}
<div class="error-container">
    <p>No se pudo cargar la imagen de precios. Por favor, intente nuevamente más tarde.</p>
</div>
<p>Consultá tu cobertura</p>
<ContactButtons></ContactButtons>
{/if}

<style>
img{
    max-width: 100%;
    max-height:90vh;
    margin-top: 3.5em;
}
div{
    display: grid;
    place-items: center;
}
p{
    text-align: center;
    font-weight: 800;
}

.loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1em;
    margin-top: 5em;
}

.error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 2em;
    margin-top: 5em;
}

.error-container p {
    color: #c62828;
    font-size: 1.1em;
    text-align: center;
    background: #ffebee;
    padding: 2em;
    border-radius: 0.5em;
}
</style>