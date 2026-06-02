import { readable } from "svelte/store";

export const mediosDePago= readable([
    {
        id:0,
        title:'Pagos electrónicos',
        opciones:
        [
        {title:'Mercado Pago', image:'QR-MercadoPago.jpg',pic:'mercadopago.jpeg'},
        {title: 'Cuenta DNI',image:'/images/pago/cdni.png', pic:'cuenta-dni.png'}
        ],
    },
    {
        id:1,
        title:'Transferencia / Depósito bancario',
        opciones:
        [
        {title:'CBU único por cliente',pic:'transferencia.png'},
        ]
    },
    {
        id:2,
        title:'Cajeros Automáticos',
        opciones:
        [
        {title:"Banelco",pic:'banelco.png'},
        {title:"Red Link",pic:'link.jpeg'},
        ]
    },
    {
        id:3,
        title: 'Otros',
        opciones:
        [
        {title: 'Rapipago', pic: 'rapipago.webp'},
        {title: 'Tarjeta de Crédito',pic:'credito.png'},
        {title: 'Cheques',pic:'cheque.png'},
        {title: 'Pago en nuestra oficina',pic:'oficina.png'}
        ]
    },
    {
        id:4,
        title:'Adhesión al Débito Automático',
        opciones:[{title:'Ver información'}]
    }
]);
export const bancos=readable([
    {name:'Banco Credicoop', alias:'SISTABCOOP', cbu:'1910434855043401395982',cuenta:'191-434-013959/8'},
    {name:'Banco Ciudad de Buenos Aires' ,alias:'SISTABC', cbu: '0290062900000000116082', cuenta:'62-1160/8'},
    {name:'Banco Nación', alias:'SISTABNA', cbu: '0110717520071700105997', cuenta:'3505-071700105/99'},
    {name:'Banco Galicia', alias: 'SISTABG', cbu: '0070221020000003097315', cuenta:'3097-3221-1'}
])