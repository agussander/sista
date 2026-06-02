<script>
import { onMount } from "svelte";


export let info;
export let total;
let title;
let data=[];

onMount(async()=>{
    data=info[1];
    title=info[0]
});
</script>

<div class="wrap">
    <p class='title'>{title}</p>
    {#each Object.entries(info[1]) as [label, value]}
        <div class="cont">
            <p class='label'>{label}</p>
            <div class="bar-cont">
                <div class='bar' style="width: {(value/total)*100}%"></div>
            </div>
            <p>{value}</p>
        </div>
    {/each}
</div>

<style>
.wrap{
    padding: 1em;
    border: 1px solid lightgray;
    width: max-content;
    height: 24em;
}
.title{
    font-weight: 600;
    max-width: 20em;
}
.cont{
    display: flex;
    align-items: center;
    gap: .5em;
}
.label{
    text-align: right;
    width: 8em;
}
.bar-cont{
    width: 10em;
    display: flex;
    align-items: center;
    gap: .5em;
    background: rgb(198, 215, 220);
}
.bar{
    height: 1.5em;
    background: var(--violeta2);
}
</style>