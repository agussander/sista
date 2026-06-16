import { readable, writable } from "svelte/store";
import { INTERNET_PLANS, isSymmetricPlan } from "$lib/plans.js";

export const modal=writable(false);
export const selectedPlan=writable(null);

export const navbarY=writable(1);

export const mobile=writable(true);
export const windowX=writable(0);
export const windowY=writable(0);
export const show=writable([{title:''},{title:''}]);
export const onSelect=writable(false);
export const datosBaja=writable({});


// priceInfo se deriva de la fuente única de planes ($lib/plans.js). La forma
// { plan, mb, desc, symmetric, items } es la que esperan home/Price.svelte y
// home/PlanDetails.svelte.
export const priceInfo = readable(
    INTERNET_PLANS.map((p) => ({
        plan: p.key,
        mb: String(p.mb),
        desc: p.desc,
        symmetric: isSymmetricPlan(p),
        items: p.features,
    }))
);

export const noticias = writable([
    {
        id:1,
        title: "Nueva Tienda Sista",
        body: "Comprá productos de tecnología en nuestra nueva tienda online<br><i><strong>Ir a la tienda</strong></i>",
        img:'tienda-sista.png',
        link:'https://tiendasista.mitiendanube.com/'
    }
]);

