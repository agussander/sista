<script>
import { goto } from '$app/navigation';
import { browser } from '$app/environment';
let {text = 'Comunicate por:'} = $props();

const options = [
    {
        name: 'WhatsApp',
        icon: '/images/wsp-violet.svg',
        link: 'https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista',
        external: true
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

let selected = $state('');

const onSelect = (option) => {
    if(selected === 'WhatsApp'){
        if (browser && typeof window !== 'undefined') {
            window.open('https://api.whatsapp.com/send?phone=5492213541906&text=Hola!%20Quisiera%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Sista', '_blank');
        }
    }else{
        goto(option.link);
    }
}

</script>

<div class="cont">
    <h4>{text}</h4>
    <div class="options">
        {#each options as option}
            <div class="option" onclick={() => {selected = option.name; onSelect(option)}}>
                <span href={option.link}>
                    <img src={option.icon} alt={option.name} />
                    {option.name}
                </span>
                {#if option.external}
                    <svg class="external-link-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                {/if}
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
.external-link-icon {
    width: 1em;
    height: 1em;
    stroke: var(--text);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
}
</style>
