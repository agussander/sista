/* ========================================
   WIDGET CHATBOT - API & BACKEND LOGIC
   ======================================== */

// === CONFIGURACIÓN ===
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB máximo por archivo
const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf']
};

// === VARIABLES GLOBALES ===
let socket = null;
let chatAbierto = false;
let esperandoPrimeraRespuesta = false;

// === FUNCIÓN PARA REPRODUCIR SONIDO ===
function reproducirSonidoNotificacion() {
  try {
    const audio = document.getElementById('notification-sound');
    if (audio) {
      // Resetear el audio para permitir reproducción múltiple
      audio.currentTime = 0;
      // Reproducir con manejo de promesa para navegadores modernos
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Auto-play puede estar bloqueado por el navegador
          console.log('No se pudo reproducir el sonido automáticamente:', error);
        });
      }
    }
  } catch (error) {
    console.error('Error al reproducir sonido:', error);
  }
}

// === GESTIÓN DE USER ID ===
function generarUserIdSeguro() {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let resultado = '';
  
  // Usar crypto.getRandomValues si está disponible (más seguro)
  if (window.crypto && window.crypto.getRandomValues) {
    const valores = new Uint32Array(10);
    window.crypto.getRandomValues(valores);
    for (let i = 0; i < 10; i++) {
      resultado += caracteres[valores[i] % caracteres.length];
    }
  } else {
    // Fallback para navegadores muy antiguos
    for (let i = 0; i < 10; i++) {
      resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
  }
  
  return resultado;
}

const user_id = localStorage.getItem("user_id") || generarUserIdSeguro();
localStorage.setItem("user_id", user_id);

// === GESTIÓN DE HISTORIAL ===
function guardarHistorial() {
  const chatBody = document.getElementById("chat-body");
  const historial = {
    content: chatBody.innerHTML,
    timestamp: Date.now(),
  };
  localStorage.setItem("chat_historial", JSON.stringify(historial));
}

function restaurarHistorial() {
  const chatBody = document.getElementById("chat-body");
  try {
    const historialStr = localStorage.getItem("chat_historial");
    if (!historialStr) return;
    
    const historial = JSON.parse(historialStr);
    if (historial && historial.content && historial.timestamp) {
      const now = Date.now();
      const treintaMinutos = 30 * 60 * 1000;
      
      if (now - historial.timestamp < treintaMinutos) {
        chatBody.innerHTML = historial.content;
        chatBody.scrollTop = chatBody.scrollHeight;
        // Agregar eventos click a las imágenes restauradas
        agregarEventosImagenes();
        // Restaurar funcionalidad de botones
        restaurarBotonesHistorial();
      } else {
        localStorage.removeItem("chat_historial");
      }
    }
  } catch (error) {
    console.error('Error al restaurar historial:', error);
    localStorage.removeItem("chat_historial");
  }
}

// === CONEXIÓN SOCKET.IO ===
function iniciarSocket() {
  if (chatAbierto) return;
  
  socket = io("https://sista.immers.ar", {
    path: '/web_webhook/socket.io',
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  // IMPORTANTE: Registrar todos los listeners ANTES del evento 'connect'
  socket.on('receive_message', (data) => {
    // Ocultar indicador de carga cuando llega el primer mensaje
    if (esperandoPrimeraRespuesta) {
      ocultarIndicadorCarga();
      esperandoPrimeraRespuesta = false;
    }
    mostrarMensaje(data.message, "bot");
    // Reproducir sonido de notificación
    reproducirSonidoNotificacion();
  });

  // Manejo de errores enviados desde el backend
  socket.on('error', (data) => {
    mostrarMensaje(data.message, "bot");
  });

  // Manejo de desconexiones
  socket.on('disconnect', (reason) => {
    console.log('Socket desconectado:', reason);
  });

  // Manejo de reconexiones exitosas
  socket.on('reconnect', (attemptNumber) => {
    console.log('Reconectado exitosamente después de', attemptNumber, 'intentos');
    socket.emit('join_chat', { user_id: user_id });
  });

  // Ahora sí, manejar la conexión
  socket.on('connect', () => {
    socket.emit('join_chat', { user_id: user_id });

    // Pequeño delay para asegurar que el servidor esté listo
    setTimeout(() => {
      const historial = localStorage.getItem("chat_historial");
      if (!historial) {
        // Mostrar indicador de carga antes de enviar el mensaje inicial
        esperandoPrimeraRespuesta = true;
        mostrarIndicadorCarga();
        socket.emit('send_message', { user_id: user_id, message: "Hola" });
      }
    }, 100);
  });

  chatAbierto = true;
}

// === ENVÍO DE MENSAJES ===
function enviarMensajeSocket(mensaje) {
  // Verificar que el socket existe y está conectado
  if (!socket || !socket.connected) {
    console.error("Socket no conectado");
    alert("Conexión perdida. Por favor, cierra y vuelve a abrir el chat.");
    return false;
  }
  
  socket.emit('send_message', { user_id: user_id, message: mensaje });
  return true;
}

// === VALIDACIÓN Y ENVÍO DE ARCHIVOS ===
function validarArchivo(file) {
  // Validar tipo de archivo
  const tipoValido = Object.keys(ALLOWED_FILE_TYPES).includes(file.type);
  const extensionValida = Object.values(ALLOWED_FILE_TYPES).flat().some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  if (!tipoValido && !extensionValida) {
    return { valido: false, error: `Tipo de archivo no permitido. Solo se aceptan: PDF, JPG, PNG, GIF` };
  }
  
  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    return { valido: false, error: `El archivo "${file.name}" excede el tamaño máximo de 10MB` };
  }
  
  return { valido: true };
}

function enviarArchivosDirectamente(files) {
  // Validar todos los archivos
  const archivosValidos = [];
  for (let file of files) {
    const validacion = validarArchivo(file);
    if (!validacion.valido) {
      alert(validacion.error);
      return;
    }
    archivosValidos.push(file);
  }
  
  if (archivosValidos.length === 0) return;
  
  // Preparar FormData
  const formData = new FormData();
  formData.append('user_id', user_id);
  
  archivosValidos.forEach((file) => {
    formData.append('files', file);
  });
  
  // Mostrar mensaje en el chat
  const mensajeUsuario = `📎 ${archivosValidos.length} archivo(s) enviado(s): ${archivosValidos.map(f => f.name).join(', ')}`;
  mostrarMensaje(mensajeUsuario, "usuario");
  
  // Enviar por HTTP
  fetch('https://sista.immers.ar/web_webhook/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    console.log('Archivos enviados correctamente', data);
  })
  .catch(error => {
    console.error('Error al enviar archivos:', error);
    mostrarMensaje('Error al enviar los archivos. Por favor, intenta nuevamente.', 'bot');
  });
}

// === GETTERS ===
function getUserId() {
  return user_id;
}

function isSocketConnected() {
  return socket && socket.connected;
}
