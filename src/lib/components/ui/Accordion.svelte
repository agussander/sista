<script>
    import { slide } from 'svelte/transition';
    let { title = 'Desplegable', children } = $props();
    let isOpen = $state(false);

    function toggle() {
        isOpen = !isOpen;
    }
</script>

<div class="accordion">
    <button class="accordion-header" onclick={toggle}>
        <span>{title}</span>
        <svg class="icon" class:rotated={isOpen} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 6 15 12 9 18"></polyline>
        </svg>
    </button>
    {#if isOpen}
        <div class="accordion-content" transition:slide={{ duration: 200 }}>
             {@render children()}
        </div>
    {/if}
</div>

<style>
    .accordion {
        border: 1px solid #eee;
        border-radius: 4px;
        margin-bottom: 1em;
        width: 100%;
        background-color: white;
    }
    .accordion-header {
        background-color: transparent;
        color: var(--text);
        cursor: pointer;
        padding: 1em;
        width: 100%;
        border: none;
        text-align: left;
        outline: none;
        font-size: 1em;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .icon {
        transition: transform 0.2s ease-in-out;
        color: var(--violeta);
        transform: rotate(90deg);
    }
    .icon.rotated {
        transform: rotate(-90deg);
    }
    .accordion-content {
        padding: 0 1em 1em 1em;
        border-top: 1px solid #eee;
        color: var(--text-light);
    }
</style>