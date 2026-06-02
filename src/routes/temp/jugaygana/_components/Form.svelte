<script>
import { recordId, number } from './stores.svelte'
import { pb } from '$lib/pocketbase';

let { sent } = $props();

let data = $state(
    {
        "nombre":'',
        "telefono":'',
        "ciudad":'',
    }
);

let loading  = $state(false);


const handleClick = async(e)=>{
    e.preventDefault();
    if(!Object.values(data).includes('')){
        loading=true;
        let resultList;
        try{
            resultList = await pb.collection('participantes_ruleta').getList(1, 1, {
                sort: '-created',
                fields: 'number'
            });
        }
        catch (error){
            alert("que pasaaa")
        }
        $number = resultList.items[0]['number']+1;
        let record;

        //validar teléfono
        if(data.telefono.length < 7){
            alert('Comprueba tu número de teléfono');
            loading=false;
            return;
        }
        try{
            const numberToString = `"${data.telefono.toString()}"`;
            const usedNumber = await pb.collection('participantes_ruleta').getFirstListItem(`telefono=${numberToString}`, {});
            alert('Parece que ya jugaste!');
            loading=false;
        }
        //si el telefono es valido, continua la operacion
        catch(e){
            try{
                // Crear un nuevo registro en la colección 'participantes_ruleta'
                record = await pb.collection('participantes_ruleta').create({...data, number: $number});
                if(record){
                    $recordId = record.id;
                    sent();
                }
            }
            catch(e){
                alert('Parece que hubo un problema. Intentalo de nuevo o avísanos en el stand')
                loading=false;
            }
        }
    }
}

</script>
<main>
    <p>Llena el formulario para participar del juego</p>
    <div class="form">
        <form>
            <label for="">
                Nombre
                <input type="text" bind:value={data.nombre}>
            </label>
            <label for="">
                Celular / teléfono
                <input type="tel" bind:value={data.telefono}>
            </label>
            <label for="">
                Ciudad
                <select name="ciudad" bind:value={data.ciudad}
                style="color:black"
                >
                    <option value="" selected disabled>Seleccionar</option>
                    <option value="Ensenada">Ensenada</option>
                    <option value="Punta Lara">Punta Lara</option>
                    <option value="El dique">El dique</option>
                    <option value="La Plata">La Plata</option>
                </select>
            </label>
            <button class="btn-1"
            class:loading
            onclick={handleClick}
            class:disabled={Object.values(data).includes('')}
            >{loading && 'Espere...' || 'Participar'}</button>
        </form>
    </div>
</main>

<style>
.disabled{
    background: gray;
    pointer-events: none;
}
main{
    padding: 3em 1em;
}
.form{
    display: flex;
    flex-direction: column;
    align-items: center;
}
form{
    width: 16em;
}
label,input{
    display: block;
}
label{
    font-weight: 600;
    font-size: 1.2em;
}
input,select{
    width: 100%;
    font-size: 1rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    margin-bottom: 1.5em;
    background: white;
    border-radius: .4em;
    border: 1px solid rgb(81, 81, 81);
}
.loading{
    background: gray;
}
p{
    text-align: center;
}
</style>