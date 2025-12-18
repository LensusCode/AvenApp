// Configuración de API base URL para AvenApp
// Detectar si estamos en Capacitor (app móvil)
// Capacitor siempre define window.Capacitor
const IS_NATIVE = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);
const API_BASE_URL = IS_NATIVE ? 'https://avenapp.onrender.com' : '';

// Función auxiliar para construir URLs completas de API
function getApiUrl(path) {
    return API_BASE_URL + path;
}

// Socket.io también necesita la URL base
const SOCKET_URL = API_BASE_URL || window.location.origin;

// Mostrar un alert visible para debugging (se verá en la app)
if (IS_NATIVE) {
    console.log('🚀 Modo MÓVIL - Conectando a:', API_BASE_URL);
    // Alert temporal para confirmar que config.js se carga
    setTimeout(() => {
        alert('Config cargado: Modo MÓVIL\nURL: ' + API_BASE_URL);
    }, 500);
} else {
    console.log('🌐 Modo WEB - Rutas relativas');
}
