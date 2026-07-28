<script>
import { onMount } from "svelte";

onMount(() => {
    // Escalonamos TODAS las líneas (incluida .boundary) para que la onda viaje
    // en armonía por el abanico. La línea-borde conserva así su delay natural
    // en la secuencia (no se sale de compás con sus vecinas).
    const root = document.querySelector(".animated-lines");
    const paths = root.querySelectorAll(".line");
    paths.forEach((path, index) => {
        path.style.animationDelay = `${index * 0.2}s`;
    });
    // El relleno blanco se pega al MISMO delay que la línea-borde -> su borde
    // superior queda siempre exactamente sobre esa línea en movimiento.
    const boundary = root.querySelector(".boundary");
    const fill = root.querySelector(".fill-blanco");
    if (boundary && fill) {
        fill.style.animationDelay = getComputedStyle(boundary).animationDelay;
    }
});
</script>

<svg class="animated-lines" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1384.84 388.13" preserveAspectRatio="none">
    <defs>
      <linearGradient id="Deg62v" x1="5800.01" y1="-19911.55" x2="5800.01" y2="-20640.97" gradientTransform="translate(-1162.91 -19880.62) rotate(153.98) scale(1.24 .94)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#ef2672"/>
        <stop offset=".13" stop-color="#e1317a"/>
        <stop offset=".37" stop-color="#bf4f8f"/>
        <stop offset=".52" stop-color="#a6659f"/>
        <stop offset=".7" stop-color="#687cb5"/>
        <stop offset="1" stop-color="#00a4dd"/>
      </linearGradient>
    </defs>

    <!-- Grupo que posiciona/aplana la cinta como en producción (transform
    --      vive en CSS -.wave-group- en vez de como atributo, para poder
    --      pisarlo por media query en mobile, donde el contenedor es mucho
    --      más chico -ver Hero.svelte-). OJO: el punto más bajo de la curva-
    --      borde (cls-1) + la amplitud del floatUpDown NO puede superar el
    --      alto del contenedor o overflow:hidden la corta en línea recta.
    --      Verificado con muestreo denso (requestAnimationFrame) en todo el
    --      ciclo de 14s -el muestreo espaciado cada 1-2s puede saltearse el
    --      punto más profundo real y dar falsos positivos de "está OK". -->
    <g class="wave-group">
        <!-- El violeta de fondo es CSS plano en .hero-section (no un rect acá):
        --      así el contenedor de este SVG puede achicarse en mobile (para
        --      evitar que preserveAspectRatio="none" deforme la curva en un
        --      contenedor angosto y alto) sin afectar el fondo violeta, que
        --      cubre todo el hero de forma independiente. -->

        <!-- 1) Fondo blanco = la línea cls-1 cerrada hacia abajo, DETRÁS de las
        --      líneas. Es un path hermano de las líneas y flota con el mismo
        --      keyframe y delay que la línea .boundary (cls-1) -> el borde
        --      blanco/violeta queda SIEMPRE pegado a esa línea en movimiento.
        --      Al estar detrás, las líneas se superponen sobre blanco y violeta.
        --      La curva original arranca en x=5.59 (no en 0): se antepone un
        --      tramo recto hasta x=0 para que el cierre del polígono sea
        --      vertical y no deje un triángulo violeta sin cubrir en el borde
        --      izquierdo. -->
        <path class="fill-blanco" d="M0,.77 L5.59,.77 c492.86,402.96,717.26,422.82,830.44,358.52,103.02-58.53,171.17-219.35,389.8-294.84,65.93-22.77,123.15-30.04,158.23-32.8 L1384.84 6000 L0 6000 Z"/>

        <!-- 2) Las 30 líneas del abanico, ENCIMA del fondo blanco y del violeta CSS. -->
        <path class="line" d="M.47,274.79c55.65-29.73,136.38-69.23,237.35-106.13C451.88,90.43,742.76-15.88,1030.92,89.54c77.45,28.33,219.09,95.52,353.13,266.3"/>
        <path class="line" d="M.65,265.34c70.73-14.81,156.41-52.27,257.8-90.11C468.68,97.68,751.88-10.51,1037.64,88.67c77.05,26.57,215.78,91.19,346.41,255.98"/>
        <path class="line" d="M.82,255.89c85.81.11,176.3-35.68,278.25-74.09C485.19,104.16,761-5.13,1044.36,87.81c76.66,24.81,212.47,86.86,339.69,245.67"/>
        <path class="line" d="M1,246.44c100.88,15.03,196.26-18.89,298.7-58.06C501.86,111.08,769.87,1.06,1051.08,86.94c76.19,23.27,209.16,82.53,332.97,235.35"/>
        <path class="line" d="M1.18,236.99c115.96,29.95,216.22-2.09,319.16-42.04C518.54,118.03,778.93,6.68,1057.81,86.08c75.78,21.58,205.85,78.2,326.25,225.04"/>
        <path class="line" d="M1.35,227.55c131.03,44.87,236.18,14.72,339.61-26.02,194.26-76.51,447.05-189.24,723.57-116.31,75.37,19.88,202.55,73.87,319.53,214.73"/>
        <path class="line" d="M1.53,218.1c146.11,59.79,256.14,31.53,360.06-10,190.33-76.07,435.51-190.22,709.66-123.75,74.97,18.18,199.24,69.54,312.81,204.41"/>
        <path class="line" d="M1.71,208.65c161.19,74.71,276.11,48.36,380.51,6.03,186.41-75.59,423.99-191.22,695.75-131.19,74.57,16.47,195.93,65.21,306.09,194.1"/>
        <path class="line" d="M1.88,199.2c176.26,89.63,296.08,65.2,400.96,22.05,182.51-75.09,412.48-192.24,681.84-138.63,74.17,14.76,192.62,60.88,299.37,183.79"/>
        <path class="line" d="M2.06,189.75c191.34,104.55,316.05,82.05,421.41,38.07,178.61-74.55,400.98-193.28,667.94-146.07,73.78,13.05,189.31,56.55,292.65,173.47"/>
        <path class="line" d="M2.24,180.3c206.41,119.47,336.02,98.91,441.86,54.09,174.72-73.98,389.5-194.34,654.03-153.51,73.39,11.33,186,52.22,285.93,163.16"/>
        <path class="line" d="M2.41,170.85c221.49,134.39,356,115.78,462.31,70.12,170.84-73.39,378.02-195.42,640.12-160.94,73,9.6,182.7,47.89,279.21,152.84"/>
        <path class="line" d="M2.59,161.4c236.57,149.31,375.99,132.67,482.77,86.14,166.97-72.76,366.55-196.52,626.22-168.38,72.61,7.87,179.39,43.56,272.48,142.53"/>
        <path class="line" d="M2.77,151.95c251.64,164.23,395.98,149.57,503.22,102.16,163.11-72.11,355.09-197.65,612.31-175.82,72.23,6.13,176.08,39.23,265.76,132.22"/>
        <path class="line" d="M2.94,142.51c266.72,179.15,415.97,166.49,523.67,118.18,159.27-71.44,343.64-198.8,598.4-183.26,71.85,4.38,172.77,34.9,259.04,121.9"/>
        <path class="line" d="M3.12,133.06c281.8,194.07,435.97,183.42,544.12,134.21,155.43-70.73,332.19-199.98,584.49-190.7,71.47,2.63,169.46,30.57,252.32,111.59"/>
        <path class="line" d="M3.29,123.61c296.87,208.99,455.98,200.37,564.57,150.23,151.61-70,320.74-201.19,570.59-198.14,71.09.87,166.15,26.24,245.6,101.28"/>
        <path class="line" d="M3.47,114.16c311.95,223.91,476,217.34,585.02,166.25,147.79-69.25,309.3-202.43,556.68-205.58,70.71-.9,162.85,21.91,238.88,90.96"/>
        <path class="line" d="M3.65,104.71c327.02,238.83,496.02,234.32,605.47,182.27,143.99-68.47,297.85-203.69,542.77-213.02,70.33-2.68,159.54,17.58,232.16,80.65"/>
        <path class="line" d="M3.82,95.26c342.1,253.75,516.06,251.33,625.92,198.3,140.2-67.67,286.4-204.98,528.87-220.46,69.95-4.46,156.23,13.25,225.44,70.33"/>
        <path class="line" d="M4,85.81c357.18,268.67,536.1,268.35,646.38,214.32,136.43-66.85,274.94-206.3,514.96-227.89,69.56-6.26,152.92,8.93,218.72,60.02"/>
        <path class="line" d="M4.18,76.36c372.25,283.6,556.16,285.4,666.83,230.34,132.66-66,263.48-207.65,501.05-235.33,69.18-8.06,149.61,4.6,212,49.71"/>
        <path class="line" d="M4.35,66.92c387.33,298.52,576.24,302.47,687.28,246.37,128.91-65.13,252-209.03,487.15-242.77,68.79-9.87,146.31.27,205.28,39.39"/>
        <path class="line" d="M4.53,57.47c402.41,313.44,596.32,319.57,707.73,262.39,125.17-64.25,240.51-210.43,473.24-250.21,68.4-11.69,143-4.06,198.56,29.08"/>
        <path class="line" d="M4.71,48.02c417.48,328.36,616.43,336.7,728.18,278.41,121.44-63.34,229-211.86,459.33-257.65,68-13.52,139.69-8.39,191.84,18.76"/>
        <path class="line" d="M4.88,38.57c432.56,343.28,636.55,353.85,748.63,294.43,117.73-62.41,217.48-213.32,445.42-265.09,67.6-15.35,136.38-12.72,185.12,8.45"/>
        <path class="line" d="M5.06,29.12c447.63,358.2,656.69,371.04,769.08,310.46,114.03-61.47,205.94-214.8,431.52-272.53,67.19-17.2,133.07-17.05,178.4-1.86"/>
        <path class="line" d="M5.24,19.67c462.71,373.12,676.85,388.26,789.53,326.48s194.37-216.29,417.61-279.97c66.78-19.05,129.76-21.38,171.68-12.18"/>
        <path class="line" d="M5.41,10.22c477.79,388.04,697.04,405.52,809.99,342.5,106.68-59.53,182.68-218.15,403.7-287.41,66.32-21,126.46-25.71,164.95-22.49"/>
        <path class="line boundary" d="M5.59.77c492.86,402.96,717.26,422.82,830.44,358.52,103.02-58.53,171.17-219.35,389.8-294.84,65.93-22.77,123.15-30.04,158.23-32.8"/>
    </g>
  </svg>

<style>
@keyframes floatUpDown {
    /* translateY acá es en PÍXELES DE PANTALLA reales (no unidades del
       viewBox). Con relleno sólido detrás de las líneas, si el punto más
       bajo de la curva-borde supera el alto del hero, overflow:hidden lo
       corta en una línea recta en vez de resolver en gris -> por eso la
       amplitud es más chica que el ±150 original (pensado para líneas
       sueltas, donde el recorte no se notaba). */
    0%, 100% { transform: translateY(1); }
    33% { transform: translateY(-50px); }
    66% { transform: translateY(50px); }
}

svg {
  max-width: 100vw;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: block;
}

svg .line {
  fill: none;
  stroke: url(#Deg62v);
  stroke-miterlimit: 10;
  stroke-width: 2px;
  animation: floatUpDown 14s ease-in-out infinite;
}

.wave-group {
  transform: translate(0px, 221px) scale(1, 0.2);
}

/* En mobile el contenedor del SVG es mucho más chico (ver Hero.svelte,
   .lines-wrapper) -> re-ubicamos el grupo para ese alto distinto, verificado
   con medición real (getBoundingClientRect) para que ni en reposo ni en el
   punto más profundo de la animación se pase del borde inferior. */
@media (max-width: 768px) {
  .wave-group {
    transform: translate(0px, 180px) scale(1, 0.2);
  }
}

/* El blanco flota con el MISMO keyframe/espacio que las líneas (es un path
   hermano dentro del grupo) y con el mismo delay que la línea .boundary,
   así su borde superior queda siempre pegado a esa línea en movimiento.
   Usa el gris de fondo de la página (--background), no blanco puro, para que
   no haya corte visible contra la sección siguiente. */
svg .fill-blanco {
  fill: var(--background);
  stroke: none;
  animation: floatUpDown 14s ease-in-out infinite;
}

</style>
