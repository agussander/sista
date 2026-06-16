<script>
import { goto } from '$app/navigation';
let {text = 'Comunicate por:'} = $props();

const options = [
    {
        name: 'WhatsApp',
        icon: '/images/wsp-violet.svg',
        link: '/contacto/whatsapp'
    },
    {
        name: 'Email',
        icon: '/images/icon-mail.svg',
        link: '/contacto/mail'
    },
    {
        name: 'Teléfono',
        icon: '/images/icon-tel.svg',
        link: '/contacto/telefono'
    }
]

const onSelect = (option) => {
    goto(option.link);
}

</script>

<div class="cont">
    <h4>{text}</h4>
    <div class="options">
        {#each options as option}
            <div class="option" onclick={() => onSelect(option)}>
                <span href={option.link}>
                    <img src={option.icon} alt={option.name} />
                    {option.name}
                </span>
            </div>
        {/each}
    </div>
</div>

<style>
.cont{
    margin: 0 auto;
    max-width: 18em;
    background-color:  white;
    border-radius: .6rem;
    box-shadow: none;
    padding-bottom: .5em;
    margin-bottom: 2em;
}
h4{
    font-size: 1rem;
    font-weight: 500;
    color: var(--text);
    text-align: center;
    margin: 0;
    padding: 0;
    width: 100%;
    text-align: left;
    border-bottom: 1px solid rgb(206, 206, 206);
    padding: 1em 2em
}
.options{
    padding: 1em 0;
    display: flex;
    flex-flow: column ;
    justify-content: center;
    align-items: center;
    padding: 0 2em;
}
.option{
    width: 100%;
    display: flex;
    flex-flow: row;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid rgb(231, 231, 231);
    padding: 1em 0;
    cursor: pointer;
}
.option:last-child{
    border-bottom: none;
}
.option:hover{
    background-color: #f7f7f7;
}
img{
    width: 1rem;
    height: 1rem;
}
span{
    color: var(--text);
    font-size: 1rem;

    font-weight: 500;
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    align-items: center;
    gap: 1rem;
}
</style>
