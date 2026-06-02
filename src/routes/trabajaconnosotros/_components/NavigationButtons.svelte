<script>
let {labels, next, prev} = $props();
</script>

<div class="buttons">
    <button class='btn-2' onclick={prev}>
        {labels?.prev || '< Volver'}
    </button>
    <button class="btn-1" onclick={next}>
        {labels?.next || 'Siguiente'}
    </button>
</div>

<style>
.buttons{
    display: flex;
    justify-content: space-between;
    gap: 1em;
    margin-top: 3em;
}
button{
    width: max-content;
    padding: .6em 3em;
}
button:hover{
    opacity: .8;
}
.btn-2{
    font-size: .9em;
    border-radius: 100px;
    padding: 0 1.5em
}
</style>