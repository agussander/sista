<script>
import { onMount } from 'svelte';
import Home from './Home.svelte';
import FormCustom from './FormCustom.svelte';
import {send} from './send.js'
import {step} from './states'
import { validateStep } from './validationConfig.js';
import { showAlert } from './alert.js';

let { alert} = $props();

const STORAGE_KEY = 'trabajaconnosotros_form_data';
const STEP_KEY = 'trabajaconnosotros_current_step';

// Inicializar datos directamente desde localStorage
let res = $state([]);

// Función para cargar datos del localStorage
function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length === 7) {
                res = parsed;
                console.log('Datos cargados desde localStorage:', res);
                return;
            }
        }
    } catch (error) {
        console.warn('Error al cargar datos:', error);
    }
    // Si no hay datos válidos, inicializar con estructura por defecto
    res = [
        {}, // Datos personales
        {}, // Aplica a
        {}, // Nivel de estudios secundario
        [], // Formación académica
        [], // Experiencia laboral
        {}, // Datos de contacto
        null // Curriculum
    ];
    console.log('Datos inicializados por defecto:', res);
}

// Función para cargar el paso actual
function loadCurrentStep() {
    try {
        const storedStep = localStorage.getItem(STEP_KEY);
        if (storedStep !== null) {
            const stepNumber = parseInt(storedStep);
            if (stepNumber >= 0 && stepNumber <= 7) {
                $step = stepNumber;
                console.log('Paso cargado desde localStorage:', $step);
            }
        }
    } catch (error) {
        console.warn('Error al cargar paso:', error);
    }
}

// Función para guardar datos en localStorage
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
        console.log('Datos guardados en localStorage:', res);
    } catch (error) {
        console.warn('Error al guardar datos:', error);
    }
}

// Función para guardar el paso actual
function saveCurrentStep() {
    try {
        localStorage.setItem(STEP_KEY, $step.toString());
        console.log('Paso guardado en localStorage:', $step);
    } catch (error) {
        console.warn('Error al guardar paso:', error);
    }
}

// Función para limpiar datos
function clearData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STEP_KEY);
        res = [
            {}, {}, {}, [], [], {}, null
        ];
        $step = 0;
        console.log('Datos limpiados del localStorage');
    } catch (error) {
        console.warn('Error al limpiar datos:', error);
    }
}

// Cargar datos al montar el componente
onMount(() => {
    loadData();
    loadCurrentStep();
});

const next = ()=>{
    // Debug: mostrar datos actuales
    console.log('=== NEXT CLICKED ===');
    console.log('Paso actual:', $step);
    console.log('Datos del formulario:', res);
    console.log('LocalStorage data:', localStorage.getItem(STORAGE_KEY));
    
    // Si estamos en el paso 0 (Home), avanzar directamente
    if ($step === 0) {
        proceedToNextStep();
        return;
    }
    
    // Validar el paso actual antes de continuar (solo para pasos > 0)
    const validation = validateStep($step, res);
    console.log('Resultado de validación:', validation);
    
    if (!validation.isValid) {
        // Mostrar la primera alerta de validación
        const firstAlert = validation.alerts[0];
        showAlert({
            message: firstAlert.message,
            type: firstAlert.type,
            canContinue: firstAlert.canContinue,
            field: firstAlert.field,
            onAccept: () => {
                if (firstAlert.canContinue) {
                    // Si se puede continuar, avanzar al siguiente paso
                    proceedToNextStep();
                }
                // Si no se puede continuar, la alerta se cierra y el usuario debe corregir
            }
        });
        return;
    }
    
    // Si no hay errores de validación, proceder normalmente
    proceedToNextStep();
}

const proceedToNextStep = () => {
    if($step<7){
        $step++;
        // Asegurar que el siguiente paso tenga la estructura correcta
        if (!res[$step - 1]) {
            if ($step === 4 || $step === 5) {
                // Formación académica y experiencia laboral son arrays
                res[$step - 1] = [];
            } else {
                // Otros pasos son objetos
                res[$step - 1] = {};
            }
        }
        // Guardar datos y paso automáticamente al avanzar
        saveData();
        saveCurrentStep();
    } else{
        if(send(res)){
            // Limpiar datos del localStorage cuando se envía exitosamente
            clearData();
            $step='final'
        } else{
            showAlert({
                message: 'Error al enviar el formulario. Por favor, inténtalo de nuevo.',
                type: 'blocking',
                canContinue: false
            });
        }
    }
}

const prev = (e) => {
    e.preventDefault();
    console.log('=== PREV CLICKED ===');
    console.log('Paso actual:', $step);
    console.log('Datos antes de retroceder:', res);
    
    if($step>1){
        $step--;
        // Guardar datos y paso al retroceder también
        saveData();
        saveCurrentStep();
        console.log('Datos después de retroceder:', res);
    } else{
        $step=0;
        saveCurrentStep();
    }
}   

const fields = [
    {label: 'Datos personales', name: 'datosPersonales', fields: [
        {label: 'Nombre', name: 'nombre', placeholder: 'Nombre', type: 'text'},
        {label: 'Apellido', name: 'apellido', placeholder: 'Apellido', type: 'text'},
        {label: 'DNI', name: 'dni', placeholder: 'DNI', type: 'number', accept: 'number'},
        {label: 'Fecha de Nacimiento', name: 'nacimiento', type: 'date', placeholder: 'Fecha de Nacimiento', min: '1900-01-01', max: '2023-12-31'},
        ]
    },
    {label: 'Aplica a', name: 'puesto', type: 'select', placeholder: 'Seleccionar', options: [
        {value: 'cajero', label: 'Cajero/a'},
        {value: 'administrativo', label: 'Administrativo/a'},
        {value: 'tecnico', label: 'Téctnico/a instalador'},
        {value: 'ventas', label: 'Ventas'},
        {value: 'soporte', label: 'Soporte técnico'},
        {value: 'otro', label: 'Otro'},
    ]},
    {label: 'Nivel de estudios secundario', name: 'secundario',
    type:'optionsCustom', options: [
        {value: 'completo', label: 'Completo', selected: false},
        {value: 'incompleto', label: 'Incompleto', selected: false},
        ]
    },
    {label: 'Formación académica', name: 'formacion', type: 'multipleCustom',
    detail: 'Contanos acerca de tu formación educativa, ingresando el nombre de la institución, el título obtenido y el año de inicio y finalización (o indicar "en curso").',
    options:[
        {name: 'institucion',
        label: 'Institución'},
        {name: 'titulo',
        label: 'Título'},
        {name: 'incio',
        label: 'Año de inicio'},
        {name: 'fin',
        label: 'Año de finalización'}
        ],
    },
    {label: 'Experiencia laboral', name: 'experiencia', type: 'multipleCustom',
    detail: 'Contanos acerca de tu experiencia laboral, ingresando el nombre de la empresa, el puesto que ocupaste y el año de inicio y finalización (o indicar "en curso").',
    options:[
        {label: 'Organización/empresa', name: 'organizacion'},
        {label: 'Puesto', name: 'puesto'},
        {label: 'Desde', name: 'inicio'},
        {label: 'Hasta', name: 'fin', enCurso: false},
        ]
    },
    {label: 'Datos de contacto', name: 'contacto', fields:[
        {label: 'Teléfono', name: 'telefono', type: 'tel', placeholder: '1111111111'},
        {label: 'Email', name: 'email', type: 'email', placeholder: 'tumail@...'},
        ],
    },
    {label: 'Curriculum', name: 'curriculum', type: 'file', placeholder: 'Curriculum'},
];

</script>


{#if $step == 0}
    <Home {next}></Home>
{:else if $step>0}
    <FormCustom
        {next} {prev}
        field={fields[$step-1]}
        bind:value={res[$step-1]}
        onDataChange={saveData}
    ></FormCustom>
{/if}


<style>
    @import '../styles.scss';
</style>
