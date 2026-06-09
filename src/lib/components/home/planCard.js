// Helpers puros para las tarjetas de planes (testeables sin DOM).

const WHATSAPP_PHONE = '5492213541906';

// Los nombres de plan vienen en minúscula desde el store; los mostramos
// capitalizados en el mensaje de WhatsApp.
export function capitalizePlan(name) {
	if (!name) return '';
	return name.charAt(0).toUpperCase() + name.slice(1);
}

// Link de WhatsApp con mensaje prellenado para contratar un plan puntual.
export function planWhatsappUrl(planName, mb) {
	const text = `Hola! Quiero contratar el plan ${capitalizePlan(planName)} (${mb}mb)`;
	return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}`;
}
