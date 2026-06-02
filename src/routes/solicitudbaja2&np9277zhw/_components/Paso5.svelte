<script>
    import { onDestroy, onMount } from "svelte";
    import Spinner from "$lib/components/ui/Spinner.svelte";
    import Advertise from '../../formasdepago/_components/Advertise.svelte'
    import { datosBaja } from "./bajaStore";


    let cargando=true;

    onMount(async ()=>{
        setTimeout(()=>{
            cargando=false
        },2000);
    });
</script>
    
    {#if cargando}
        <Spinner label="Espere un momento..." />
    {:else}
        <h3>Tu solicitud de baja ha sido procesada correctamente</h3>
        
        {#if $datosBaja.numeroTramite}
            <div class="tramite-success">
                <h4>✅ Número de Trámite Generado</h4>
                <p class="numero-tramite"><strong>{$datosBaja.numeroTramite}</strong></p>
                <p>Guarda este número para futuras consultas sobre tu solicitud de baja.</p>
            </div>
        {:else}
            <Advertise
            text='Actualmente no pudimos generar tu número de trámite por un error temporal. Sin embargo, tu solicitud ha sido procesada correctamente. Puedes solicitar tu número de trámite comunicándote por cualquiera de nuestras vías de contacto'
            ></Advertise>
        {/if}
        
        <div class="resumen-solicitud">
            <h4>Resumen de tu solicitud:</h4>
            <p><strong>Cliente:</strong> {$datosBaja.cliente}</p>
            <p><strong>DNI:</strong> {$datosBaja.dni}</p>
            <p><strong>Servicio:</strong> {$datosBaja.servicio}</p>
            <p><strong>Motivo:</strong> {$datosBaja.motivo}</p>
            <p><strong>Devolución:</strong> {$datosBaja.devolucion === 'sucursal' ? 'En sucursal' : `Retiro a domicilio - ${$datosBaja.dia} de ${$datosBaja.hora}hs`}</p>
        </div>
    {/if}

    
    <style>
    h3{
        color: var(--violeta2);
        text-transform: none;
        margin-bottom: 1em;
    }
    h4{
        color: var(--violeta2);
        text-transform: none;
        margin-bottom: 1em;
    }
    p{
        margin-top: 0;
    }
    img{
        max-width: 10em;
        margin-bottom: 1em;
    }
    .tramite-success {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 1em;
        margin: 1em 0;
        text-align: center;
    }
    .tramite-success h4 {
        color: #155724;
        margin-bottom: 0.5em;
    }
    .numero-tramite {
        font-size: 1.5em;
        color: var(--violeta2);
        margin: 0.5em 0;
        padding: 0.5em;
        background: white;
        border-radius: 4px;
        border: 2px solid var(--violeta2);
    }
    .resumen-solicitud {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 1em;
        margin-top: 1em;
    }
    .resumen-solicitud h4 {
        color: var(--violeta2);
        margin-bottom: 0.5em;
    }
    .resumen-solicitud p {
        margin: 0.3em 0;
        color: #495057;
    }
    </style>
    