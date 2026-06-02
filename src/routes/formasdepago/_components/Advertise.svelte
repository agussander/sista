<script>
    export let text;
</script>

<div class="advertise">
    <span class="alert"></span>
    <p class="advertise-text">{text}</p>
</div>

<style>
.advertise{
    background: #FFF9C9;
    padding:.5em 1em;
    display: flex;
    gap:1em;
    align-items:center;
    margin-bottom: 2em;
}
.advertise-text{
    color:black;
    font-size: .9rem;
    line-height:1.3rem;
}
span{
    min-width:2rem;
    min-height:2rem;
    display: inline-block;
    background: url("/images/alert-icon.svg") no-repeat;
}
</style>