<script>
import { displayAlert, alertConfig, hideAlert } from "./alert";

// Función para manejar el botón de aceptar
const handleAccept = () => {
    const config = $alertConfig;
    if (config.onAccept) {
        config.onAccept();
    }
    hideAlert();
};

// Función para manejar el botón de cancelar
const handleCancel = () => {
    const config = $alertConfig;
    if (config.onCancel) {
        config.onCancel();
    }
    hideAlert();
};

// Función para manejar continuar (solo disponible en ciertos tipos de alerta)
const handleContinue = () => {
    const config = $alertConfig;
    if (config.onAccept) {
        config.onAccept();
    }
    hideAlert();
};

// Función para manejar modificar (solo disponible en ciertos tipos de alerta)
const handleModify = () => {
    hideAlert();
};
</script>

{#if $displayAlert}
    <div class="wrap">
        <div class="cont">
            <p class="alert-message">{$alertConfig.message}</p>
            
            <div class="buttons">
                {#if $alertConfig.type === 'blocking'}
                    <!-- Solo aceptar para alertas bloqueantes -->
                    <button class="btn-primary" onclick={handleAccept}>
                        Entendido
                    </button>
                {:else if $alertConfig.type === 'continue_or_modify'}
                    <!-- Continuar o modificar para alertas de advertencia -->
                    <button class="btn-secondary" onclick={handleModify}>
                        Modificar
                    </button>
                    <button class="btn-primary" onclick={handleContinue}>
                        Continuar
                    </button>
                {:else if $alertConfig.type === 'info_only'}
                    <!-- Solo aceptar para alertas informativas -->
                    <button class="btn-primary" onclick={handleAccept}>
                        Aceptar
                    </button>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style lang="scss">
@import '../styles.scss';

.wrap{
    position: fixed;
    background: rgba(0, 0, 0, 0.5);
    width: 100dvw;
    height: 100dvh;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    top: 0;
}

.cont{
    background: white;
    padding: 2em;
    border-radius: 1em;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    max-width: 25em;
    width: 90%;
    text-align: center;
}


.alert-message {
    font-weight: 400;
    margin-bottom: 2em;
    line-height: 1.5;
    color: #333;
    text-align: left;
}

.buttons {
    display: flex;
    gap: 1em;
    justify-content: center;
}

.btn-primary {
    background: var(--violeta2);
    color: white;
    border: none;
    padding: 0.8em 2em;
    border-radius: 0.5em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-primary:hover {
    background: var(--violeta2-hover);
    transform: translateY(-1px);
}

.btn-secondary {
    background: transparent;
    color: var(--violeta2);
    border: 2px solid var(--violeta2);
    padding: 0.8em 2em;
    border-radius: 0.5em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: none;
    font-size: 1em;
}

.btn-secondary:hover {
    background: var(--violeta2);
    color: white;
    transform: translateY(-1px);
}

/* Transiciones */
.wrap {
    transition: opacity 0.3s ease;
}

.cont {
    transition: transform 0.3s ease;
}

</style>