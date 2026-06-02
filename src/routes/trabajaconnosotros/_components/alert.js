import { writable } from "svelte/store";

// Store principal para controlar la visibilidad de la alerta
export const displayAlert = writable(false);

// Store para la configuración de la alerta actual
export const alertConfig = writable({
  message: 'Error inesperado',
  type: 'blocking', // 'blocking', 'continue_or_modify', 'info_only'
  canContinue: false,
  field: null,
  onAccept: null,
  onCancel: null
});

// Función helper para mostrar una alerta
export function showAlert(config) {
  alertConfig.set({
    message: config.message || 'Error inesperado',
    type: config.type || 'blocking',
    canContinue: config.canContinue || false,
    field: config.field || null,
    onAccept: config.onAccept || null,
    onCancel: config.onCancel || null
  });
  displayAlert.set(true);
}

// Función helper para ocultar la alerta
export function hideAlert() {
  displayAlert.set(false);
  // Resetear configuración después de un pequeño delay
  setTimeout(() => {
    alertConfig.set({
      message: 'Error inesperado',
      type: 'blocking',
      canContinue: false,
      field: null,
      onAccept: null,
      onCancel: null
    });
  }, 300);
} 