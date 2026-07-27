// =============================================================================
// tvRecomendador.js — Lógica pura del recomendador de TV ("Ayudame a elegir").
//
// Sin dependencias de Svelte ni de UI: <AyudameElegirTv> sólo recolecta las
// respuestas y renderiza lo que estas funciones deciden.
// =============================================================================

import { TV_SERVICES } from './tvData.js';

// Normaliza para buscar sin acentos ni mayúsculas (mismo criterio que ChannelGrid).
export const normalizar = (texto) =>
	(texto ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

// Con menos de 2 caracteres la búsqueda no filtra: un solo carácter matchearía
// media grilla y la recomendación quedaría a merced de un tipeo a medias.
const MIN_TERMINO = 2;

// ¿Este canal pertenece a un adicional pago? tvData ya lo expresa sin dato
// nuevo: `grilla.categoryPrices` mapea categoría → campo de precio, y ese campo
// es el mismo `field` del addon. Devuelve el label del addon, o null si el
// canal entra en el precio base.
function addonLabelDe(service, categoria) {
	const field = service.grilla?.categoryPrices?.[categoria];
	if (!field) return null;
	return service.addons?.find((a) => a.field === field)?.label ?? null;
}

// Busca un término en las grillas de los 3 servicios, por coincidencia parcial.
// Devuelve un resultado por servicio, en el orden de TV_SERVICES (del más
// barato al premium).
export function buscarCanales(termino) {
	const t = normalizar((termino ?? '').trim());
	const filtra = t.length >= MIN_TERMINO;

	// Relevancia en 3 escalones: coincidencia exacta, después los que arrancan
	// con el término, después el resto. Quien busca "tn" quiere TN primero, TNT
	// después, y CGTN al final. Partición explícita en vez de sort para no
	// depender de la estabilidad: dentro de cada escalón manda el orden de la grilla.
	const porRelevancia = (canales) => {
		const escalon = (canal) => {
			const nombre = normalizar(canal.nombre);
			if (nombre === t) return 0;
			return nombre.startsWith(t) ? 1 : 2;
		};
		return [0, 1, 2].flatMap((n) => canales.filter((c) => escalon(c) === n));
	};

	return TV_SERVICES.map((service) => {
		const matches = filtra
			? porRelevancia(
					(service.grilla?.channels ?? []).filter((canal) =>
						normalizar(canal.nombre).includes(t)
					)
				)
					.map((canal) => ({
						nombre: canal.nombre,
						categoria: canal.categoria,
						// Se copian tal cual las banderas de render de la grilla
						// (logo blanco a invertir, fondo blanco) para que el logo
						// se vea igual acá que en <ChannelGrid>.
						url_logo: canal.url_logo,
						logoBlanco: canal.logoBlanco,
						fondoBlanco: canal.fondoBlanco,
						addonLabel: addonLabelDe(service, canal.categoria)
					}))
			: [];

		return {
			key: service.key,
			label: service.label,
			matches,
			disponible: matches.length > 0,
			// Todas las coincidencias se pagan aparte → hay que avisarlo.
			soloAdicional: matches.length > 0 && matches.every((m) => m.addonLabel !== null)
		};
	});
}

// Distingue "el término no existe en ninguna grilla" (typo, o canal que nadie
// tiene) de "existe, pero choca con las otras respuestas".
export function hayAlgunaCoincidencia(resultados) {
	return resultados.some((s) => s.disponible);
}

// Capacidades que no se pueden derivar de las features: son la traducción de
// esas features a condiciones booleanas. El tope de TV sí sale de tvData
// (`devices.maxTv`), para no tener el número escrito en dos lados.
const CAPS = {
	gigared: { tn13: false, fullHd: false },
	antina: { tn13: true, fullHd: false },
	dgo: { tn13: true, fullHd: true }
};

// Motivo de la recomendación. Si el canal pedido fue lo que definió la elección
// lo dice; si no, cae en los motivos genéricos de cada servicio.
function motivoDe(service, { tv, fullhd, termino, resultado, decidioElCanal }) {
	if (resultado?.soloAdicional) {
		return `Tiene «${termino}» con el adicional ${resultado.matches[0].addonLabel}.`;
	}
	if (decidioElCanal) {
		return `Es el más económico que tiene «${termino}».`;
	}
	if (service.key === 'dgo') {
		const drivers = [];
		if (tv > maxTvDe('gigared')) drivers.push('hasta 4 dispositivos');
		if (fullhd === true) drivers.push('Full HD');
		return drivers.length
			? `Es el único con ${joinEs(drivers)}.`
			: 'Es el servicio más completo para lo que buscás.';
	}
	if (service.key === 'antina') {
		return 'Incluye el 13 y TN y te alcanza para lo que buscás, sin pagar de más.';
	}
	return 'La opción más económica que cumple con todo lo que buscás.';
}

const maxTvDe = (key) => TV_SERVICES.find((s) => s.key === key)?.devices.maxTv ?? 0;

function joinEs(arr) {
	if (arr.length <= 1) return arr[0] ?? '';
	return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
}

// Resuelve la recomendación a partir de las respuestas del formulario.
//
// Devuelve `recoKey: null` cuando ningún servicio cumple con todo; en ese caso
// `alternativas` trae hasta 2 opciones parciales para que decida el usuario, en
// lugar de recomendar algo que no cumple lo que pidió.
export function elegirServicio({ tv, tn13, fullhd, canal }) {
	const termino = (canal ?? '').trim();
	const resultados = buscarCanales(termino);
	// Un término que no existe en ninguna grilla no filtra: bloquear todo el
	// recomendador por un error de tipeo sería peor que ignorarlo.
	const filtraPorCanal = hayAlgunaCoincidencia(resultados);
	const canalIgnorado = normalizar(termino).length >= MIN_TERMINO && !filtraPorCanal;

	const resultadoDe = (key) => resultados.find((r) => r.key === key);

	// Condiciones que el servicio NO cumple, con el texto para mostrarlas.
	const fallasDe = (service) => {
		const fallas = [];
		if (tv && service.devices.maxTv < tv) {
			fallas.push(`llega a ${service.devices.maxTv} TV`);
		}
		if (tn13 === true && !CAPS[service.key].tn13) {
			fallas.push('no tiene el 13 y TN');
		}
		if (fullhd === true && !CAPS[service.key].fullHd) {
			fallas.push('no es Full HD');
		}
		if (filtraPorCanal && !resultadoDe(service.key).disponible) {
			fallas.push(`no tiene «${termino}»`);
		}
		return fallas;
	};

	const ganador = TV_SERVICES.find((s) => fallasDe(s).length === 0) ?? null;

	if (ganador) {
		// El canal definió la elección si dejó afuera a algún servicio más barato.
		const decidioElCanal =
			filtraPorCanal &&
			TV_SERVICES.slice(0, TV_SERVICES.indexOf(ganador)).some(
				(s) => !resultadoDe(s.key).disponible
			);
		return {
			recoKey: ganador.key,
			motivo: motivoDe(ganador, {
				tv,
				fullhd,
				termino,
				resultado: filtraPorCanal ? resultadoDe(ganador.key) : null,
				decidioElCanal
			}),
			canalIgnorado,
			alternativas: []
		};
	}

	// Nadie cumple: se ofrecen los que quedan a una sola condición de distancia.
	// Si ni eso, los que al menos tienen el canal pedido.
	const aUnaCondicion = TV_SERVICES.filter((s) => fallasDe(s).length === 1);
	const candidatos = aUnaCondicion.length
		? aUnaCondicion
		: TV_SERVICES.filter((s) => filtraPorCanal && resultadoDe(s.key).disponible);

	return {
		recoKey: null,
		motivo: '',
		canalIgnorado,
		alternativas: candidatos.slice(0, 2).map((service) => ({
			key: service.key,
			label: service.label,
			cumple:
				filtraPorCanal && resultadoDe(service.key).disponible
					? `tiene «${termino}»`
					: service.devices.label.toLowerCase(),
			falla: fallasDe(service)[0]
		}))
	};
}
