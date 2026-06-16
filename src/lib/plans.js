// =============================================================================
// plans.js — Fuente ÚNICA de verdad de los planes de Internet.
//
// De acá se sacan los planes tanto para el inicio (home/Price.svelte vía el
// store `priceInfo` en stores.js) como para el wizard "Elegí tu plan"
// (elegirplan, vía INTERNET_PLANS reexportado en data.js).
//
// Cada plan tiene:
//   key        → coincide con el campo de la colección `precios` en PocketBase
//                (home, fast, power, gamer, worker, max). El precio se resuelve
//                directo con precios[plan.key].
//   label      → nombre visible (wizard).
//   mb         → velocidad de bajada.
//   tag        → null | 'recomendado' | 'simétrico'. Sólo gamer y worker son
//                simétricos. (max NO es simétrico).
//   desc       → bajada corta (inicio).
//   features   → ítems/beneficios del plan. Ninguno dice "Wi-Fi Dual Band":
//                el ítem de conectividad es "Ilimitado".
// =============================================================================

export const INTERNET_PLANS = [
	{ key: 'home',   label: 'Home',   mb: 75,   tag: null,          desc: 'Uso básico para redes sociales y pocos dispositivos',                        features: ['Wi-Fi', 'ilimitado'] },
	{ key: 'fast',   label: 'Fast',   mb: 150,  tag: null,          desc: 'Velocidad intermedia',    features: ['Ilimitado', 'Redes, videos y más'] },
	{ key: 'power',  label: 'Power',  mb: 300,  tag: 'recomendado', desc: 'La mejor relación velocidad/precio', features: ['Ilimitado', 'Mayor velocidad', 'Más dispositivos'] },
	{ key: 'gamer',  label: 'Gamer',  mb: 300,  tag: 'simétrico',   desc: 'Tráfico simétrico para gaming',     features: ['Tráfico simétrico', 'Ilimitado', 'Juga con menos lag', 'Cableado a tu dispositivo'] },
	{ key: 'worker', label: 'Worker', mb: 200,  tag: 'simétrico',   desc: 'Simétrico para trabajo remoto', features: ['Tráfico simétrico', 'Ilimitado', 'Cableado a tu puesto de trabajo'] },
	{ key: 'max',    label: 'MAX',    mb: 1000, tag: null,          desc: 'El máximo rendimiento disponible',  features: ['Ilimitado', 'La mayor velocidad', 'Para hogares exigentes'] }
];

// ¿El plan es simétrico? Sólo gamer y worker.
export const isSymmetricPlan = (plan) => plan.tag === 'simétrico';
