<script>
    import { pb } from '$lib/pocketbase';

    let rawCodes = $state('');
    let loading = $state(false);
    let result = $state(null); // { created: number, errors: string[] }
    let progress = $state({ current: 0, total: 0 }); // para la barra

    function parseCodes(text) {
        return text
            .split(/[\s\n\r]+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }

    async function cargar() {
        const codes = parseCodes(rawCodes);
        if (codes.length === 0) {
            result = { created: 0, errors: ['No hay códigos para cargar. Separá por espacios o enter.'] };
            return;
        }
        loading = true;
        result = null;
        progress = { current: 0, total: codes.length };
        const errors = [];
        let created = 0;
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i];
            try {
                await pb.collection('tolosano').create({ code, used: false });
                created++;
            } catch (e) {
                errors.push(`${code}: ${e?.message || String(e)}`);
            }
            progress = { current: i + 1, total: codes.length };
        }
        result = { created, errors };
        loading = false;
    }
</script>

<div class="tolosano-codigos">
    <h2>Cargar códigos Tolosano</h2>
    <p class="hint">Pegá el listado de códigos (uno por línea o separados por espacios). Cada código se guarda en la colección "tolosano" con <code>used: false</code>.</p>
    <textarea
        bind:value={rawCodes}
        placeholder="97023-72355&#10;28507-25143&#10;30702-35221&#10;..."
        rows="14"
        disabled={loading}
    ></textarea>
    <div class="actions">
        <button type="button" class="btn-submit" onclick={cargar} disabled={loading}>
            {loading ? 'Cargando...' : 'Cargar códigos'}
        </button>
        <button type="button" class="btn-clear" onclick={() => (rawCodes = '')} disabled={loading}>
            Limpiar
        </button>
    </div>
    {#if loading && progress.total > 0}
        <div class="progress-wrap">
            <div class="progress-bar" style="width: {(progress.current / progress.total) * 100}%"></div>
            <span class="progress-text">{progress.current} / {progress.total}</span>
        </div>
    {/if}
    {#if result}
        <div class="result" class:error={result.errors.length > 0}>
            <p><strong>Cargados:</strong> {result.created}</p>
            {#if result.errors.length > 0}
                <p class="err-label"><strong>Errores ({result.errors.length}):</strong></p>
                <ul>
                    {#each result.errors.slice(0, 10) as err}
                        <li>{err}</li>
                    {/each}
                </ul>
                {#if result.errors.length > 10}
                    <p>… y {result.errors.length - 10} más.</p>
                {/if}
            {/if}
        </div>
    {/if}
</div>

<style>
    .tolosano-codigos {
        max-width: 36em;
    }
    .tolosano-codigos h2 {
        margin: 0 0 0.5em 0;
        color: var(--violeta2);
    }
    .hint {
        color: #555;
        font-size: 0.95em;
        margin: 0 0 1em 0;
    }
    .hint code {
        background: #eee;
        padding: 0.1em 0.4em;
        border-radius: 4px;
    }
    textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 0.75em 1em;
        font-family: ui-monospace, monospace;
        font-size: 0.95rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        resize: vertical;
    }
    textarea:focus {
        outline: none;
        border-color: var(--violeta2);
    }
    .actions {
        margin-top: 1em;
        display: flex;
        gap: 0.75em;
        flex-wrap: wrap;
    }
    .btn-submit {
        background: var(--violeta2);
        color: white;
        border: none;
        padding: 0.7em 1.5em;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
    }
    .btn-submit:hover:not(:disabled) {
        background: #5a1e7a;
    }
    .btn-submit:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    .btn-clear {
        background: #fff;
        color: var(--violeta2);
        border: 1.5px solid #ddd;
        padding: 0.7em 1.5em;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
    }
    .btn-clear:hover:not(:disabled) {
        background: #f5f5f5;
        border-color: var(--violeta2);
    }
    .btn-clear:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .progress-wrap {
        margin-top: 1em;
        height: 1.5em;
        background: #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
    }
    .progress-bar {
        height: 100%;
        background: var(--violeta2);
        border-radius: 8px;
        transition: width 0.15s ease;
    }
    .progress-text {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--violeta2);
    }
    .result {
        margin-top: 1.5em;
        padding: 1em;
        background: #e8f5e9;
        border-radius: 8px;
    }
    .result.error {
        background: #ffebee;
    }
    .result p {
        margin: 0.25em 0;
    }
    .err-label {
        margin-top: 0.5em !important;
    }
    .result ul {
        margin: 0.25em 0 0 1.25em;
        padding: 0;
    }
</style>
