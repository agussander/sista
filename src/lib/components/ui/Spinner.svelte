<script>
    let {
        size = 40,
        color = 'var(--violeta2)',
        trackColor = '#f3f3f3',
        borderWidth = 4,
        label = ''
    } = $props();

    const sizeCss = typeof size === 'number' ? `${size}px` : size;
    const bwCss = typeof borderWidth === 'number' ? `${borderWidth}px` : borderWidth;
</script>

<div class="spinner-wrap">
    <div
        class="spinner"
        style="--size:{sizeCss}; --color:{color}; --track:{trackColor}; --bw:{bwCss};"
        aria-hidden="true"
    ></div>
    {#if label}
        <p class="spinner-label">{label}</p>
    {/if}
</div>

<style>
    .spinner-wrap {
        display: grid;
        place-items: center;
        gap: 0.75em;
    }
    .spinner {
        width: var(--size);
        height: var(--size);
        border: var(--bw) solid var(--track);
        border-top-color: var(--color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    .spinner-label {
        margin: 0;
        text-align: center;
        color: inherit;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
        .spinner { animation-duration: 2s; }
    }
</style>
