<script>
import ContactButtons from "./ContactButtons.svelte";

let {data, title, children} = $props();
let copied = $state(false);
const copyToClipboard = async (textToCopy) => {
    try {
        await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback: No se pudo copiar', err);
        }

        document.body.removeChild(textArea);
    }

    copied = true;
    setTimeout(() => {
        copied = false;
    }, 2000);
}
// const downloadVCF = () => {
//     const link = document.createElement('a');
//     link.href = '/sista-vcf.vcf';
//     link.download = 'sista-vcf.vcf';
//     link.click();
// }
</script>

<main>
    <div class="title">
        <div class="title-content">
            <p>{title}:</p>
            <h1>{data}</h1>
        </div>
    </div>

    <div class="buttons">
        {@render children()}
        <button class="btn-2" class:copied={copied}
            onclick={() => copyToClipboard(data.toString())}
            ><i class="copy-icon"></i>{copied ? 'Copiado' : 'Copiar'}
        </button>
    </div>
    <section>
        <ContactButtons
        text = "Contactanos por:"
        ></ContactButtons>
    </section>
</main>

<style>

section{
    margin-top: 3em;  
    
}
main{
    margin-bottom: 3em;
    padding-top: 5em;
}
p{
    text-align: left;
    font-weight: 500;
}
.title{
    margin: 0;
    padding: 0;
    margin-bottom: 1em;
    display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center;
}
h1{
    color: var(--violeta1);
    font-size: 3rem;
    font-weight: 600;
    margin: 0;

}
.buttons{
    display: flex;
    flex-flow: column;
    justify-content: center;
    align-items: center;
    gap: 1em;
    max-width: 16em;
    margin: 0 auto;
}
button, a{
    width: 100%;
    font-size: 1rem;
    padding: .4rem 2em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .5em;
}
.copied{
    background-color: var(--violeta1);
    color: white;
}
i{
    width: 1em;
    height: 1em;
    display: inline-block;
    margin-right: .5em;
}
.copy-icon{
    background: url('/images/copy.svg') no-repeat center center;
}
.add-contact-icon{
    background: url('/images/icon-addcontact.svg') no-repeat center center;
}
</style>