// Configuración centralizada de validaciones y alertas por paso del formulario

export const VALIDATION_TYPES = {
  REQUIRED: 'required',        // Campo obligatorio - no se puede continuar
  WARNING: 'warning',          // Advertencia - se puede continuar o modificar
  INFO: 'info'                 // Información - solo aceptar
};

export const ALERT_TYPES = {
  BLOCKING: 'blocking',        // No permite continuar, solo aceptar
  CONTINUE_OR_MODIFY: 'continue_or_modify', // Permite continuar o modificar
  INFO_ONLY: 'info_only'       // Solo informativo
};

// Configuración de validaciones por paso
export const STEP_VALIDATIONS = {
  1: { // Datos personales
    name: 'datosPersonales',
    validations: [
      {
        field: 'nombre',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'El nombre es obligatorio para continuar',
        alertType: ALERT_TYPES.BLOCKING
      },
      {
        field: 'apellido', 
        type: VALIDATION_TYPES.REQUIRED,
        message: 'El apellido es obligatorio para continuar',
        alertType: ALERT_TYPES.BLOCKING
      },
      {
        field: 'dni',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'El DNI es obligatorio para continuar',
        alertType: ALERT_TYPES.BLOCKING
      },
      {
        field: 'nacimiento',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'La fecha de nacimiento es obligatoria para continuar',
        alertType: ALERT_TYPES.BLOCKING
      }
    ]
  },
  2: { // Aplica a
    name: 'puesto',
    validations: [
      {
        field: 'puesto',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'Debes seleccionar un puesto al que aplicar. No puedes continuar sin seleccionar una opción.',
        alertType: ALERT_TYPES.BLOCKING,
        customValidation: (value) => value && value !== 'seleccionar' && value !== ''
      }
    ]
  },
  3: { // Nivel de estudios secundario
    name: 'secundario',
    validations: [
      {
        field: 'secundario',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'Debes indicar si completaste o no tus estudios secundarios para continuar',
        alertType: ALERT_TYPES.BLOCKING
      }
    ]
  },
  4: { // Formación académica
    name: 'formacion',
    validations: [
      {
        field: 'formacion',
        type: VALIDATION_TYPES.WARNING,
        message: 'No has completado información de formación académica. ¿Deseas continuar sin esta información?',
        alertType: ALERT_TYPES.CONTINUE_OR_MODIFY,
        allowEmpty: true,
        customValidation: (value) => {
          if (!value || !Array.isArray(value) || value.length === 0) return false;
          return value.some(item => 
            Object.values(item).some(val => val && val.toString().trim() !== '')
          );
        }
      }
    ]
  },
  5: { // Experiencia laboral
    name: 'experiencia',
    validations: [
      {
        field: 'experiencia',
        type: VALIDATION_TYPES.WARNING,
        message: 'No has completado información de experiencia laboral. ¿Deseas continuar sin esta información?',
        alertType: ALERT_TYPES.CONTINUE_OR_MODIFY,
        allowEmpty: true,
        customValidation: (value) => {
          if (!value || !Array.isArray(value) || value.length === 0) return false;
          return value.some(item => 
            Object.values(item).some(val => val && val.toString().trim() !== '')
          );
        }
      }
    ]
  },
  6: { // Datos de contacto
    name: 'contacto',
    validations: [
      {
        field: 'telefono',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'El teléfono es obligatorio para continuar',
        alertType: ALERT_TYPES.BLOCKING
      },
      {
        field: 'email',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'El email es obligatorio para continuar',
        alertType: ALERT_TYPES.BLOCKING
      }
    ]
  },
  7: { // Curriculum
    name: 'curriculum',
    validations: [
      {
        field: 'curriculum',
        type: VALIDATION_TYPES.REQUIRED,
        message: 'Debes subir tu curriculum vitae o proporcionar un enlace para continuar',
        alertType: ALERT_TYPES.BLOCKING,
        customValidation: (value) => {
          // Archivo (bind:files) => FileList
          if (typeof FileList !== 'undefined' && value instanceof FileList) {
            return value.length > 0;
          }

          // Archivo (algunas implementaciones guardan array-like / array de File)
          if (Array.isArray(value)) {
            return value.length > 0;
          }
          if (value && typeof value === 'object' && 'length' in value) {
            return Number(value.length) > 0;
          }

          // Enlace (bind:value) => string
          if (typeof value === 'string') {
            return value.trim() !== '';
          }

          return false;
        }
      }
    ]
  }
};

// Función para validar un paso específico
export function validateStep(stepNumber, formData) {
  const stepConfig = STEP_VALIDATIONS[stepNumber];
  if (!stepConfig) return { isValid: true, alerts: [] };

  const alerts = [];
  
  for (const validation of stepConfig.validations) {
    const fieldValue = getFieldValue(formData, validation.field, stepConfig.name);
    
    // Usar validación personalizada si existe, sino usar la validación estándar
    let isValid = false;
    if (validation.customValidation) {
      isValid = validation.customValidation(fieldValue);
    } else {
      isValid = !isFieldEmpty(fieldValue);
    }
    
    if (validation.type === VALIDATION_TYPES.REQUIRED && !isValid) {
      alerts.push({
        type: validation.alertType,
        message: validation.message,
        field: validation.field,
        canContinue: false
      });
    } else if (validation.type === VALIDATION_TYPES.WARNING && !isValid) {
      alerts.push({
        type: validation.alertType,
        message: validation.message,
        field: validation.field,
        canContinue: true
      });
    }
  }

  return {
    isValid: alerts.length === 0,
    alerts: alerts
  };
}

// Función auxiliar para obtener el valor de un campo
function getFieldValue(formData, fieldName, stepName) {
  // Buscar el índice del paso actual
  const stepIndex = Object.keys(STEP_VALIDATIONS).find(key => 
    STEP_VALIDATIONS[key].name === stepName
  );
  
  if (!stepIndex || !formData[stepIndex - 1]) {
    return '';
  }
  
  const stepData = formData[stepIndex - 1];
  
  // Para pasos con múltiples campos (datosPersonales, contacto)
  if (stepName === 'datosPersonales' || stepName === 'contacto') {
    return stepData[fieldName] || '';
  }
  
  // Para otros pasos, devolver el valor del campo
  return stepData[fieldName] || '';
}

// Función auxiliar para verificar si un campo está vacío
function isFieldEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    // Para objetos como formacion/experiencia, verificar si tiene elementos válidos
    return !value || value.length === 0 || value.every(item => 
      Object.values(item).every(val => !val || val.toString().trim() === '')
    );
  }
  return false;
}
