<script>
import { onMount } from 'svelte';
import {datosBaja, pasoCompleto, paso} from './bajaStore'
import StepButtons from './StepButtons.svelte';

const data=Object.keys($datosBaja).filter(objKey =>
    objKey !== 'consentimientoEntrega').reduce((newObj, key) =>
    {
        newObj[key] = $datosBaja[key];
        return newObj;
    }, {}
);

const submitBaja=async()=>{
    const options = {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': true
        },
        body: JSON.stringify({
            "nro_cliente": $datosBaja.code,
            "dni_cliente": $datosBaja.dni,
            "form_type": "baja2",
            "mensaje_ticket": `
                <strong>SOLICITUD DE BAJA DE SERVICIO</strong><br><br>
                <strong>Cliente:</strong> ${$datosBaja.cliente}<br>
                <strong>DNI:</strong> ${$datosBaja.dni}<br>
                <strong>Número de Cliente:</strong> ${$datosBaja.code}<br>
                <strong>Servicio:</strong> ${$datosBaja.servicio}<br>
                <strong>Motivo de Baja:</strong> ${$datosBaja.motivo}<br>
                <strong>Domicilio:</strong> ${$datosBaja.domicilioOriginal}<br><br>
                <strong>DEVOLUCIÓN DE EQUIPOS:</strong><br>
                <strong>Tipo de Devolución:</strong> ${$datosBaja.devolucion === 'sucursal' ? 'Devolución en sucursal' : 'Retiro a domicilio'}<br>
                ${$datosBaja.devolucion === 'domicilio' ? `<strong>Fecha de Retiro:</strong> ${$datosBaja.dia} de ${$datosBaja.hora}hs<br>` : ''}
            `
        })
    }
    
    let ticketSuccess = false;
    let emailSuccess = false;
    let ticketError = '';
    let emailError = '';

    // 1. Crear el ticket en IspCube
    try {
        console.log('Enviando solicitud a:', '/assets/send-ticket-ispcube.php');
        const res = await fetch('/assets/send-ticket-ispcube.php',options);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data= await res.json();
        console.log('Respuesta del ticket:', data);
        
        if (data.status === 'success') {
            ticketSuccess = true;
            // Guardar el número de trámite si la API lo devuelve
            if (data.ticket_number) {
                $datosBaja.numeroTramite = data.ticket_number;
            }
            console.log('✅ Ticket creado exitosamente');
        } else {
            ticketError = data.message || 'Error desconocido del ticket';
            console.error('❌ Error del ticket:', ticketError);
        }
        
    } catch (error) {
        ticketError = error.message;
        console.error('❌ Error al crear el ticket:', ticketError);
    }

    // 2. Enviar email con todos los datos (siempre intentar, independientemente del ticket)
    try {
        const emailOptions = {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                'Access-Control-Allow-Origin': true
            },
            body: JSON.stringify({
                "nro_cliente": $datosBaja.code,
                "dni_cliente": $datosBaja.dni,
                "form_type": "baja2",
                "mensaje_ticket": `
                    <strong>SOLICITUD DE BAJA DE SERVICIO</strong><br><br>
                    <strong>Cliente:</strong> ${$datosBaja.cliente}<br>
                    <strong>DNI:</strong> ${$datosBaja.dni}<br>
                    <strong>Número de Cliente:</strong> ${$datosBaja.code}<br>
                    <strong>Servicio:</strong> ${$datosBaja.servicio}<br>
                    <strong>Motivo de Baja:</strong> ${$datosBaja.motivo}<br>
                    <strong>Domicilio:</strong> ${$datosBaja.domicilioOriginal}<br><br>
                    <strong>DEVOLUCIÓN DE EQUIPOS:</strong><br>
                    <strong>Tipo de Devolución:</strong> ${$datosBaja.devolucion === 'sucursal' ? 'Devolución en sucursal' : 'Retiro a domicilio'}<br>
                    ${$datosBaja.devolucion === 'domicilio' ? `<strong>Fecha de Retiro:</strong> ${$datosBaja.dia} de ${$datosBaja.hora}hs<br>` : ''}
                    <strong>Equipos a Devolver:</strong> ONU (modem) y Set Top Box (adaptador de TV) si corresponde
                `,
                "numero_tramite": $datosBaja.numeroTramite || null
            })
        };
        
        console.log('Enviando email a:', '/assets/send-email-baja.php');
        const emailRes = await fetch('/assets/send-email-baja.php', emailOptions);
        
        if (!emailRes.ok) {
            throw new Error(`HTTP ${emailRes.status}: ${emailRes.statusText}`);
        }
        
        const emailData = await emailRes.json();
        console.log('Respuesta del email:', emailData);
        
        if (emailData.status === 'success') {
            emailSuccess = true;
            console.log('✅ Email enviado exitosamente');
        } else {
            emailError = emailData.message || 'Error desconocido del email';
            console.error('❌ Error del email:', emailError);
        }
        
    } catch (error) {
        emailError = error.message;
        console.error('❌ Error al enviar email:', emailError);
    }

    // 3. Mostrar resumen de resultados
    if (ticketSuccess && emailSuccess) {
        console.log('🎉 Todo exitoso: Ticket creado y email enviado');
    } else if (ticketSuccess && !emailSuccess) {
        console.log('⚠️ Ticket creado pero email falló:', emailError);
    } else if (!ticketSuccess && emailSuccess) {
        console.log('⚠️ Email enviado pero ticket falló:', ticketError);
    } else {
        console.log('❌ Ambos fallaron - Ticket:', ticketError, 'Email:', emailError);
    }

    // Siempre avanzar al siguiente paso
    $paso++;
}

onMount(async()=>{
    $pasoCompleto=4
})
</script>

<h4>
    Por favor, controle los datos
</h4>


<p><b>DNI: </b>{data.dni}</p>
<p><b>Serivicio: </b>{data.servicio}</p>
<p><b>Motivo: </b>{data.motivo}</p>
<p><b>Retiro: </b>
    {data.devolucion=='sucursal' ? 'Llevar a sucursal' : `Retirar en domicilio, el día  ${$datosBaja.dia} de ${$datosBaja.hora}hs`}
</p>
<br>
<br>
<p>Los equipos que debe retornar son el ONU (modem), y el Set Top Box (adaptador de tv) en caso de poseerlo</p>
<div class="images">
    <img src="/images/solicitudbaja/onu-modem.jpg" alt="">
    <img src="/images/solicitudbaja/stick.jpg" alt="">
</div>

<StepButtons
siguiente={submitBaja}
></StepButtons>




<style>
h4{
    color: var(--violeta1);
}
p{
    margin-bottom: .1em;
}
.images{
    display: flex;
    gap: 1em;
    width: 100%;
    max-width: 24em;
}
img{
    max-width: 48%;
    width: 12em;
    border: .5px solid lightgray;
    border-radius: 5px;
}

</style>
