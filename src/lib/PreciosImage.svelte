<script>
import { onMount } from "svelte";


//       let canvasRef;
//       let svgURL = "/precios-template/precios-template.svg"; // Ruta al archivo 

//     const canvasWidth = 1980;
//   const canvasHeight = 1400;

//   function dibujarCanvas() {
//     if (!canvasRef) return;

//     const canvas = canvasRef;
//     const ctx = canvas.getContext("2d");

//     // Ajustar tamaño del canvas
//     canvas.width = canvasWidth;
//     canvas.height = canvasHeight;

//     const img = new Image();
//     img.crossOrigin = "anonymous"; // Evita problemas de CORS si el archivo está en otro servidor
//     img.src = svgURL;

//     img.onload = () => {
//       ctx.clearRect(0, 0, canvas.width, canvas.height);
//       ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
//     };

//     img.onerror = () => {
//       console.error("Error al cargar la imagen SVG. Verifica la ruta.");
//     };
//   }

//   function descargarImagen() {
//     if (!canvasRef) return;
//     const link = document.createElement("a");
//     link.href = canvasRef.toDataURL("image/png", 1.0); // 1.0 = máxima calidad
//     link.download = "imagen_editada.png";
//     link.click();
//   }

//   onMount(() => {
//     dibujarCanvas();
//   });
</script>

<img src='/assets/precios-template/precios-template.svg' alt="Diseño SVG" width="100%" />
<!-- <canvas bind:this={canvasRef}></canvas>

<button on:click={descargarImagen}>Descargar imagen</button> -->