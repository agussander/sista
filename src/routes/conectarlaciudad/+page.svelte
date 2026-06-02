<script>
    import ganadoresData from './ganadores-sorteo.json';

    const ganadores = ganadoresData.ganadores;
    let busqueda = $state('');

    const ganadoresFiltrados = $derived(
        busqueda.trim() === ''
            ? ganadores
            : ganadores.filter((g) =>
                  g.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
              )
    );
</script>

<main>
    <div class="cont">
        <img src="/assets/conectarlaciudad/1x/conectar-la-ciudad-logo-8.png" alt="conecta-la-ciudad-logo">
        <p class="mensaje-premios">Premios válidos hasta el 18/03</p>
    </div>

    <div class="card card-finalizado">
        <div class="card-content">
            <h2>Sorteo finalizado</h2>
        </div>
    </div>

    <div class="card card-ganadores">
        <div class="card-content ganadores-content">
            <h2 class="titulo-ganadores">Ganadores del sorteo</h2>
            <div class="busqueda-wrap">
                <input
                    type="search"
                    class="busqueda"
                    placeholder="Buscar por nombre..."
                    bind:value={busqueda}
                    aria-label="Buscar por nombre"
                />
            </div>
            <div class="lista-ganadores">
                <div class="ganador-item ganador-header">
                    <span class="puesto">#</span>
                    <span class="nombre">Nombre</span>
                    <span class="telefono">Teléfono</span>
                    <span class="puntos">Puntos</span>
                </div>
                {#each ganadoresFiltrados as g}
                    <div class="ganador-item">
                        <span class="puesto">{g.puesto}</span>
                        <span class="nombre">{g.nombre}</span>
                        <span class="telefono">{g.telefono}</span>
                        <span class="puntos">{g.puntaje_total}</span>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</main>

<style>
main{
    min-height: 100vh;
    background: url('/assets/conectarlaciudad/fondo-22.jpg') no-repeat center center;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-attachment: fixed;
    padding: 2em 1em;
}
.cont{
    margin: 0 auto;
    width: 80%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.mensaje-premios {
    text-align: center;
    font-size: 1rem;
    font-weight: 600;
    color: var(--violeta1, #7028a2);
    margin: 0;
    padding: 0.5rem 0;
}

.card{
    position: relative;
    margin: 0 auto;
    width: 80%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.card-finalizado {
    margin-top: 2rem;
}

.card-ganadores {
    margin-top: 1.5rem;
}

.card-content.ganadores-content {
    position: relative;
    left: 0;
    bottom: auto;
    padding: 1.25em 1em;
    overflow-x: hidden;
}

.titulo-ganadores {
    font-size: 1.1em;
    text-transform: uppercase;
    text-align: center;
    font-weight: 800;
    color: white;
    margin: 0 0 1rem 0;
    display: block;
}

.busqueda-wrap {
    margin-bottom: 0.75rem;
}

.busqueda {
    width: 100%;
    padding: 0.6rem 0.9rem;
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 0.5rem;
    font-size: 0.9rem;
    background: rgba(255,255,255,0.15);
    color: white;
    box-sizing: border-box;
}

.busqueda::placeholder {
    color: rgba(255,255,255,0.6);
}

.busqueda:focus {
    outline: none;
    border-color: rgba(255,255,255,0.8);
    background: rgba(255,255,255,0.2);
}

.lista-ganadores {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 60vh;
    overflow-y: auto;
}

.ganador-item {
    display: flex;
    align-items: center;
    gap: 0.5rem 0.75rem;
    font-size: 0.85rem;
    color: white;
    padding: 0.4rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.2);
}

.ganador-item:last-child {
    border-bottom: none;
}

.ganador-item .puesto {
    flex: 0 0 1.75em;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
}

.ganador-item .nombre {
    flex: 1 1 0;
    min-width: 0;
    font-weight: 600;
    word-break: break-word;
}

.ganador-item .telefono {
    flex: 0 0 5em;
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.85);
    text-align: right;
}

.ganador-item .puntos {
    flex: 0 0 2.75em;
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.9);
    text-align: right;
}

.ganador-item.ganador-header {
    position: sticky;
    top: 0;
    z-index: 1;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(255,255,255,0.5);
    margin-bottom: 0.25rem;
    background: var(--violeta1);
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

.ganador-item.ganador-header .puesto,
.ganador-item.ganador-header .nombre,
.ganador-item.ganador-header .telefono,
.ganador-item.ganador-header .puntos {
    color: rgba(255,255,255,0.95);
}

.ganador-item.ganador-header .telefono,
.ganador-item.ganador-header .puntos {
    text-align: right;
}

@media (max-width: 480px) {
    .ganador-item {
        gap: 0.4rem 0.5rem;
        font-size: 0.8rem;
    }
    .ganador-item .puesto {
        flex: 0 0 1.5em;
    }
    .ganador-item .telefono {
        flex: 0 0 4.5em;
    }
    .ganador-item .puntos {
        flex: 0 0 2.5em;
    }
}

.card-content{
    position: relative;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--violeta1);
    padding: 2em;
    border-radius: 1em;
    gap: 1em;
    z-index: 1;
    h2{
        font-size:1.2em;
        text-transform: uppercase;
        text-align: center;
        font-weight: 800;
        color: white;
        margin-bottom: 0;
        margin-top: 0;
    }
}

/* Comentado: premios-carousel, .cta
.premios-carousel { ... }
.cta { ... }
*/
</style>
