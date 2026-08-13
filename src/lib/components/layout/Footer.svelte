<script>
</script>

<footer>
    <div class="flex">
        <img src="/images/Sista-logo-violeta.svg" alt="logo de Sista">
        <div>
            <a href="/empresas">Empresas</a>
            <a href="/acerca-de">Acerca de Sista</a>
            <a href="/trabajos">Trabajá con nosotros</a>
        </div>
        <div>
            <a href="/formasdepago">Formas de pago</a>
            <a href="/solicitudbaja">Solicitud de baja</a>
            <a href="/condiciones">Condiciones</a>
        </div>
    </div>
    <div class="bottom">
        <div class="icons">
            <a class="icon fb" alt="facebook" href="https://www.facebook.com/SISTA.internet/"  target="_blank"></a>
            <a class="icon ig" src="/images/icon-ig.svg" alt="instagram" href="https://www.instagram.com/sista.internet/" target="_blank"></a>
        </div>
        <a class="map" target="_blank" href="https://www.google.com/maps/place/Sista/@-34.8228441,-57.9641418,15z/data=!4m5!3m4!1s0x0:0x8bb5e7d89d0ca379!8m2!3d-34.8228441!4d-57.9641418">Av. Almirante Brown 3064, Punta Lara</a>
    </div>
</footer>

<style>
footer {
    padding: 2em 1em;
    background:white;
}
.icons{
    margin-top: 2em;
    background-repeat: no-repeat;
}
.icon {
    width: 1.8em;
    height: 1.8em;
    display: inline-block;
}
.fb{
    margin-right: 1em;
    background-image: url('/images/icon-facebook.svg');
}
.ig{
    background-image: url('/images/icon-ig.svg');
}
img{
    max-width: 15rem;
}
a{
    display: block;
    margin-bottom: 1em;
    text-decoration: none;
}
.flex{
    display: flex;
    gap:2em;
    flex-flow: row wrap;
    width:100%;
    justify-content: space-evenly;
    align-items: center;
}
.map{
    margin-bottom:0;
}
@media (min-width:768px){
    footer{
        display: flex;
        justify-content: space-between;
    }
    .flex{
        justify-content: flex-start;
        gap:4em;
    }
    .bottom{
        align-self: baseline;
    }
}
</style>
