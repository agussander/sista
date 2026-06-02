<script>
import { pb } from '$lib/pocketbase';
import { token, record } from './adminStore';

let user = $state('');
let password = $state('');
let loading = $state(false);
let error = $state('');

const login = async()=>{
    if (!user || !password) {
        error = 'Por favor complete todos los campos';
        return;
    }
    
    loading = true;
    error = '';
    
    try{
        const authData = await pb.collection('users').authWithPassword(user, password);
        $token = pb.authStore.token;
        $record = pb.authStore.record;
    }
    catch (err){
        console.error(err.data)
        error = 'Usuario o contraseña incorrectos. Por favor, intente nuevamente.';
    } finally {
        loading = false;
    }
}

</script>

<div class="login-container">
    <div class="login-card">

        <form onsubmit={(e) => { e.preventDefault(); login(); }}>
            <div class="input-group">
                <label for="user">Usuario</label>
                <input 
                    type="email" 
                    id="user"
                    name="user" 
                    bind:value={user}
                    placeholder="correo@ejemplo.com"
                    disabled={loading}
                    autocomplete="email"
                >
            </div>

            <div class="input-group">
                <label for="password">Contraseña</label>
                <input 
                    type="password" 
                    id="password"
                    name="password" 
                    bind:value={password}
                    placeholder="••••••••"
                    disabled={loading}
                    autocomplete="current-password"
                >
            </div>

            {#if error}
                <div class="error-message">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                </div>
            {/if}

            <button class="login-button" type="submit" disabled={loading}>
                {#if loading}
                    <span class="spinner"></span>
                    Ingresando...
                {:else}
                    Iniciar Sesión
                {/if}
            </button>
        </form>
    </div>
</div>

<style>
.login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2em;
}

.login-card {
    background: white;
    border-radius: 1.5em;
    padding: 3em 2.5em;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 28em;
    animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-2em);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.login-header {
    text-align: center;
    margin-bottom: 2.5em;
}

.login-icon {
    color: var(--violeta2);
    margin-bottom: 1em;
}

h1 {
    font-size: 2em;
    font-weight: 700;
    color: var(--violeta2);
    margin: 0 0 0.5em 0;
}

.login-header p {
    color: #6b7280;
    font-size: 1em;
    margin: 0;
}

.input-group {
    margin-bottom: 1.8em;
}

label {
    display: block;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.6em;
    font-size: 1em;
}

input {
    width: 100%;
    padding: 0.9em 1.2em;
    border: 2px solid #e5e7eb;
    border-radius: 0.8em;
    font-size: 1.05em;
    transition: all 0.2s ease;
    box-sizing: border-box;
    font-family: inherit;
}

input:focus {
    outline: none;
    border-color: var(--violeta2);
    box-shadow: 0 0 0 3px rgba(112, 40, 162, 0.1);
}

input:disabled {
    background-color: #f3f4f6;
    cursor: not-allowed;
}

input::placeholder {
    color: #9ca3af;
}

.error-message {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 0.9em 1.2em;
    border-radius: 0.8em;
    margin-bottom: 1.5em;
    font-size: 0.95em;
    display: flex;
    align-items: center;
    gap: 0.7em;
    animation: shake 0.4s ease;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-0.5em); }
    75% { transform: translateX(0.5em); }
}

.error-message svg {
    flex-shrink: 0;
}

.login-button {
    width: 100%;
    padding: 1em 2em;
    background: linear-gradient(135deg, var(--violeta2) 0%, #5a1e7a 100%);
    color: white;
    border: none;
    border-radius: 0.8em;
    font-size: 1.1em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.7em;
    box-shadow: 0 4px 14px rgba(112, 40, 162, 0.3);
}

.login-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(112, 40, 162, 0.4);
}

.login-button:active:not(:disabled) {
    transform: translateY(0);
}

.login-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.spinner {
    width: 1.2em;
    height: 1.2em;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 500px) {
    .login-card {
        padding: 2em 1.5em;
    }
    
    h1 {
        font-size: 1.6em;
    }
}
</style>