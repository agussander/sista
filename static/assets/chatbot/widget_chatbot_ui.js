/* ========================================
   WIDGET CHATBOT - UI & FRONTEND LOGIC
   ======================================== */

// === CONFIGURACIÓN UI ===
const MAX_LONGITUD_MENSAJE = 2000; // Máximo de caracteres por mensaje (validación UX)

// === FUNCIONES PARA INDICADOR DE CARGA ===
function mostrarIndicadorCarga() {
  const chatBody = document.getElementById("chat-body");
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "loading-indicator";
  loadingDiv.id = "loading-indicator";
  
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  
  const loadingText = document.createElement("div");
  loadingText.className = "loading-text loading-dots";
  loadingText.textContent = "Iniciando conversación";
  
  loadingDiv.appendChild(spinner);
  loadingDiv.appendChild(loadingText);
  chatBody.appendChild(loadingDiv);
  
  chatBody.scrollTop = chatBody.scrollHeight;
}

function ocultarIndicadorCarga() {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) {
    loadingIndicator.remove();
  }
}

// === FUNCIONES DE VALIDACIÓN (Solo UX - La seguridad real está en el backend) ===
function validarMensaje(mensaje) {
  return mensaje && 
         mensaje.trim().length > 0 && 
         mensaje.length <= MAX_LONGITUD_MENSAJE;
}

// === FUNCIONES DE GESTIÓN DE BOTONES ===
function deshabilitarBotonesAnteriores() {
  const chatBody = document.getElementById("chat-body");
  const botonesAnteriores = chatBody.querySelectorAll(".opcion-boton");
  
  botonesAnteriores.forEach(boton => {
    boton.disabled = true;
    boton.style.opacity = "0.5";
    boton.style.cursor = "not-allowed";
    boton.onclick = null; // Eliminar el evento onclick
  });
}

function hayMensajeUsuarioReciente() {
  const chatBody = document.getElementById("chat-body");
  const mensajes = chatBody.querySelectorAll(".usuario, .bot");
  
  if (mensajes.length === 0) return false;
  
  // Verificar si el último mensaje es del usuario
  const ultimoMensaje = mensajes[mensajes.length - 1];
  return ultimoMensaje.classList.contains("usuario");
}

function restaurarBotonesHistorial() {
  const chatBody = document.getElementById("chat-body");
  const todosLosElementos = Array.from(chatBody.children);
  const todosLosBotones = chatBody.querySelectorAll(".opcion-boton");
  
  if (todosLosBotones.length === 0) return;
  
  // Encontrar el índice del último mensaje del usuario
  let indiceUltimoMensajeUsuario = -1;
  for (let i = todosLosElementos.length - 1; i >= 0; i--) {
    const elemento = todosLosElementos[i];
    if (elemento.classList && elemento.classList.contains("usuario")) {
      indiceUltimoMensajeUsuario = i;
      break;
    }
  }
  
  // Si no hay mensaje del usuario, todos los botones deben estar habilitados
  if (indiceUltimoMensajeUsuario === -1) {
    todosLosBotones.forEach(boton => {
      const textoBoton = boton.textContent;
      boton.disabled = false;
      boton.style.opacity = "1";
      boton.style.cursor = "pointer";
      boton.onclick = () => {
        if (!isSocketConnected()) {
          console.error("Socket no conectado, reintentando...");
          alert("Conexión perdida. Por favor, intenta nuevamente en un momento.");
          return;
        }
        if (validarMensaje(textoBoton)) {
          enviarMensajeSocket(textoBoton);
          mostrarMensaje(textoBoton, "usuario");
          setTimeout(() => {
            document.getElementById("mensaje").focus();
          }, 100);
        }
      };
    });
    return;
  }
  
  // Deshabilitar solo los botones que están ANTES del último mensaje del usuario
  todosLosBotones.forEach(boton => {
    const contenedorBoton = boton.parentElement;
    const indiceBoton = todosLosElementos.indexOf(contenedorBoton);
    
    if (indiceBoton !== -1 && indiceBoton < indiceUltimoMensajeUsuario) {
      // Botón antes del último mensaje del usuario - deshabilitar
      boton.disabled = true;
      boton.style.opacity = "0.5";
      boton.style.cursor = "not-allowed";
      boton.onclick = null;
    } else {
      // Botón después del último mensaje del usuario - habilitar
      const textoBoton = boton.textContent;
      boton.disabled = false;
      boton.style.opacity = "1";
      boton.style.cursor = "pointer";
      boton.onclick = () => {
        if (!isSocketConnected()) {
          console.error("Socket no conectado, reintentando...");
          alert("Conexión perdida. Por favor, intenta nuevamente en un momento.");
          return;
        }
        if (validarMensaje(textoBoton)) {
          enviarMensajeSocket(textoBoton);
          mostrarMensaje(textoBoton, "usuario");
          setTimeout(() => {
            document.getElementById("mensaje").focus();
          }, 100);
        }
      };
    }
  });
}

// === RENDERIZADO DE MENSAJES ===
function mostrarMensaje(mensaje, tipo) {
  const chatBody = document.getElementById("chat-body");
  const lineas = mensaje.split("\n");
  
  // Si es un mensaje del bot con nuevos botones Y hay un mensaje del usuario previo,
  // entonces deshabilitar los botones anteriores
  if (tipo === "bot") {
    const tieneNuevosBotones = lineas.some(linea => linea.trim().startsWith("- "));
    if (tieneNuevosBotones && hayMensajeUsuarioReciente()) {
      deshabilitarBotonesAnteriores();
    }
  }

  for (let linea of lineas) {
    linea = linea.trim();

    // === Mostrar PDF si es un enlace ===
    if (linea.match(/\.pdf$/i) || linea.includes("/print_bill/")) {
      const linkContainer = document.createElement("div");
      linkContainer.style.textAlign = "center";
      linkContainer.style.margin = "10px 0";

      const mensaje = document.createElement("div");
      mensaje.className = tipo;
      mensaje.textContent = "Haz clic abajo para abrir el archivo PDF:";

      const botonPDF = document.createElement("a");
      botonPDF.href = linea;
      botonPDF.target = "_blank";
      botonPDF.rel = "noopener noreferrer";
      botonPDF.textContent = "Abrir PDF";
      botonPDF.style.display = "inline-block";
      botonPDF.style.backgroundColor = "var(--color-principal)";
      botonPDF.style.color = "white";
      botonPDF.style.padding = "10px 16px";
      botonPDF.style.borderRadius = "6px";
      botonPDF.style.textDecoration = "none";
      botonPDF.style.marginTop = "6px";
      botonPDF.style.fontWeight = "bold";

      linkContainer.appendChild(mensaje);
      linkContainer.appendChild(botonPDF);
      chatBody.appendChild(linkContainer);
      continue;
    }

    // === Mostrar imagen si termina en jpg/png/etc ===
    if (linea.match(/\.(jpg|jpeg|png|gif)$/i)) {
      const img = document.createElement("img");
      img.src = linea;
      img.alt = "Imagen del chat";
      chatBody.appendChild(img);
      continue;
    }

    // === Mostrar botones si comienza con "- " ===
    if (tipo === "bot" && linea.startsWith("- ")) {
      const textoBoton = linea.slice(2);
      const boton = document.createElement("button");
      boton.textContent = textoBoton;
      boton.className = "opcion-boton";
      boton.onclick = () => {
        if (!isSocketConnected()) {
          console.error("Socket no conectado, reintentando...");
          alert("Conexión perdida. Por favor, intenta nuevamente en un momento.");
          return;
        }
        
        if (validarMensaje(textoBoton)) {
          enviarMensajeSocket(textoBoton);
          mostrarMensaje(textoBoton, "usuario");
          setTimeout(() => {
            document.getElementById("mensaje").focus();
          }, 100);
        }
      };

      const contenedor = document.createElement("div");
      contenedor.style.textAlign = "center";
      contenedor.appendChild(boton);
      chatBody.appendChild(contenedor);
      continue;
    }

    // === Mostrar texto con negrita y enlaces ===
    const msgDiv = document.createElement("div");
    msgDiv.className = tipo;
    
    // Procesar negritas y enlaces de forma segura (prevención XSS)
    const fragmentos = [];
    const regexURL = /(https?:\/\/[^\s]+)/g;
    let ultimoIndice = 0;
    let match;
    
    while ((match = regexURL.exec(linea)) !== null) {
      // Texto antes de la URL
      if (match.index > ultimoIndice) {
        const textoAntes = linea.substring(ultimoIndice, match.index);
        fragmentos.push(procesarNegritas(textoAntes));
      }
      
      // Crear enlace seguro
      const url = match[0];
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      enlace.textContent = url;
      fragmentos.push(enlace);
      
      ultimoIndice = regexURL.lastIndex;
    }
    
    // Texto restante
    if (ultimoIndice < linea.length) {
      const textoRestante = linea.substring(ultimoIndice);
      fragmentos.push(procesarNegritas(textoRestante));
    }
    
    // Si no hay URLs, solo procesar negritas
    if (fragmentos.length === 0) {
      msgDiv.appendChild(procesarNegritas(linea));
    } else {
      fragmentos.forEach(fragmento => {
        msgDiv.appendChild(fragmento);
      });
    }
    
    chatBody.appendChild(msgDiv);
  }

  chatBody.scrollTop = chatBody.scrollHeight;
  agregarEventosImagenes();
  guardarHistorial();
}

// Procesar negritas de forma segura
function procesarNegritas(texto) {
  const span = document.createElement('span');
  const regexNegrita = /\*([^*]+)\*/g;
  let ultimoIndice = 0;
  let match;
  
  while ((match = regexNegrita.exec(texto)) !== null) {
    // Texto antes de la negrita
    if (match.index > ultimoIndice) {
      span.appendChild(document.createTextNode(texto.substring(ultimoIndice, match.index)));
    }
    
    // Crear negrita
    const strong = document.createElement('strong');
    strong.textContent = match[1].toUpperCase();
    span.appendChild(strong);
    
    ultimoIndice = regexNegrita.lastIndex;
  }
  
  // Texto restante
  if (ultimoIndice < texto.length) {
    span.appendChild(document.createTextNode(texto.substring(ultimoIndice)));
  }
  
  // Si no hay negritas, devolver solo el texto
  return span.childNodes.length > 0 ? span : document.createTextNode(texto);
}

// === MODAL DE IMÁGENES ===
function openImageModal(imageSrc) {
  console.log("Abriendo modal con imagen:", imageSrc);
  const modal = document.getElementById("image-modal");
  const modalImg = modal.querySelector("img");
  if (modal && modalImg) {
    modalImg.src = imageSrc;
    modal.classList.add("show");
    console.log("Modal abierto");
  } else {
    console.error("No se encontró el modal o la imagen");
  }
}

function closeImageModal() {
  console.log("Cerrando modal");
  const modal = document.getElementById("image-modal");
  if (modal) {
    modal.classList.remove("show");
  }
}

function agregarEventosImagenes() {
  const chatBody = document.getElementById("chat-body");
  const imagenes = chatBody.querySelectorAll("img");
  imagenes.forEach(img => {
    img.style.cursor = "pointer";
    img.onclick = function() {
      openImageModal(img.src);
    };
  });
}

// === MANEJO DE INPUT ===
function enviarMensaje() {
  const input = document.getElementById("mensaje");
  const message = input.value.trim();
  
  // Validar mensaje antes de enviar
  if (!validarMensaje(message)) {
    if (message.length > MAX_LONGITUD_MENSAJE) {
      alert(`El mensaje es muy largo. Máximo ${MAX_LONGITUD_MENSAJE} caracteres.`);
    }
    return;
  }
  
  input.value = "";
  
  if (enviarMensajeSocket(message)) {
    mostrarMensaje(message, "usuario");
  }
}

// === INICIALIZACIÓN DEL WIDGET ===
function initChatWidget() {
  const chatButton = document.getElementById("chat-button");
  const chatWindow = document.getElementById("chat-window");
  
  // === EVENTOS PARA DRAG & DROP ===
  let dragCounter = 0;

  chatWindow.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    chatWindow.classList.add('dragging');
  });

  chatWindow.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      chatWindow.classList.remove('dragging');
    }
  });

  chatWindow.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  chatWindow.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatWindow.classList.remove('dragging');
    dragCounter = 0;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      enviarArchivosDirectamente(files);
    }
  });

  // === EVENTO BOTÓN CHAT ===
  chatButton.addEventListener("click", (e) => {
    e.stopPropagation();

    if (chatWindow.style.display === "block") {
      chatWindow.style.display = "none";
    } else {
      chatWindow.style.display = "block";
      document.getElementById("mensaje").focus();

      iniciarSocket();
      restaurarHistorial();
      
      // Evento Enter para enviar mensaje
      const mensajeInput = document.getElementById("mensaje");
      if (!mensajeInput.hasAttribute('data-listener-added')) {
        mensajeInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            enviarMensaje();
          }
        });
        mensajeInput.setAttribute('data-listener-added', 'true');
      }
    }
  });

  // === CERRAR CHAT AL HACER CLIC FUERA ===
  document.addEventListener("click", (e) => {
    const imageModal = document.getElementById("image-modal");
    if (!chatWindow.contains(e.target) && e.target !== chatButton && !imageModal.contains(e.target)) {
      chatWindow.style.display = "none";
    }
  });

  // === MODAL DE IMAGEN ===
  document.getElementById("image-modal").addEventListener("click", function(e) {
    if (e.target.id === "image-modal") {
      closeImageModal();
    }
  });

  // Restaurar historial al cargar la página
  restaurarHistorial();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatWidget);
} else {
  initChatWidget();
}
