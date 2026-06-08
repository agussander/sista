import { readable, writable } from "svelte/store";

export const modal=writable(false);
export const selectedPlan=writable(null);

export const navbarY=writable(1);

export const mobile=writable(true);
export const windowX=writable(0);
export const windowY=writable(0);
export const show=writable([{title:''},{title:''}]);
export const onSelect=writable(false);
export const datosBaja=writable({});


export const priceInfo = readable([{
    plan: 'home',
    mb: '75',
    desc: 'Uso básico',
    items: ['Wi-Fi', 'Navegación sin fronteras'],
},
{
    plan: 'fast',
    mb: '150',
    desc: 'Ideal para streaming y trabajo',
    items: ['Ilimitado', 'Alta velocidad'],
},
{
    plan: 'power',
    mb: '300',
    desc: 'Mayor velocidad, más dispositivos',
    items: ['Ilimitado', 'Mayor velocidad', 'Más dispositivos'],
},
{
    plan: 'gamer',
    mb: '300',
    desc: 'Tráfico simétrico para gaming',
    items: ['Tráfico simétrico', 'Ilimitado', 'Cableado a tu dispositivo'],
},
{
    plan: 'worker',
    mb: '200',
    desc: 'Simétrico para trabajo remoto',
    items: ['Tráfico simétrico', 'Ilimitado', 'Cableado a tu puesto de trabajo'],
},
{
    plan: 'max',
    mb: '1000',
    desc: 'El máximo rendimiento disponible',
    items: ['Tráfico simétrico', 'Ilimitado', 'Máximo rendimiento'],
},
]);

export const noticias = writable([
    {
        id:1,
        title: "Nueva Tienda Sista",
        body: "Comprá productos de tecnología en nuestra nueva tienda online<br><i><strong>Ir a la tienda</strong></i>",
        img:'tienda-sista.png',
        link:'https://tiendasista.mitiendanube.com/'
    }
]);

