<main>
    <div>
        <h1>¿Qué te ganaste?</h1>
        <p>Te invitamos a compartir  una foto con tu premio y etiquetarnos en nuestras redes</p>
        <div class="buttons">
            <a href="https://www.instagram.com/sista.internet" class="ig">@sista.internet</a>
            <a href="https://www.facebook.com/SISTA.internet" class="fb">SISTA</a>
            <a class="secondary" href="/">Conocer más sobre SISTA</a>
        </div>
    </div>
    <img src="/assets/ruleta/promo-verano.png" alt="">
    <a href="/#planes" class="secondary">Ver planes</a>
</main>

<style>
main{
    min-height: 100vh;
    background: var(--violeta1);
    display: grid  ;
    place-items: center;
    padding: 3em 1em 1em;
}
h1{
    font-weight: 700;
    color: var(--magenta);
}
h1, p{
    text-align: center;
}
p{
    color: white;
}
a{
    background: rgb(227, 227, 227);
    border-radius: 10em;
    padding: 1em 2em;
    padding-left: 3em;
    text-align: center;
}
.ig{
    background: url('/assets/social/ig.svg') white no-repeat;
    background-size: 1.5em;
    background-position: 1em center;
}
.fb{
    background: url('/assets/social/fb.svg') white no-repeat;
    background-size: 1.5em;
    background-position: 1em center;
}
.buttons{
    display: flex;
    flex-flow: column;
    gap: 1em;
    /* width: max-content; */
    max-width: 16em;
    margin: 0 auto;
}
.secondary{
    color: white;
    text-align: center;
    margin-top: 2em;
    font-weight: 500;
    border: 1px solid white;
    border-radius: 10em;
    padding: .5em 1em;
    background: none;
    margin-bottom: 5em;
}
img{
    max-width: 100%;
}
</style>