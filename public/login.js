const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authError = document.getElementById('authError');
const installBtn = document.getElementById('installBtn');

// 1. Si ya está logueado, mandar al chat
if(localStorage.getItem('chatUser')) {
    window.location.href = '/';
}

// Tabs
tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
    authError.textContent = '';
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
    authError.textContent = '';
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if(res.ok) {
            localStorage.setItem('chatUser', JSON.stringify(data.user));
            window.location.href = '/';
        } else {
            authError.textContent = data.error;
        }
    } catch (e) { authError.textContent = "Error de conexión"; }
});

// Registro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUser').value;
    const password = document.getElementById('regPass').value;
    try {
        const res = await fetch('/api/register', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ username, password })
        });
        if(res.ok) {
            alert('Registrado. Inicia sesión.');
            tabLogin.click();
        } else {
            const data = await res.json();
            authError.textContent = data.error || 'Error';
        }
    } catch (e) { authError.textContent = "Error de conexión"; }
});

// Lógica Botón Instalar
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
});
installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
        installBtn.classList.add('hidden');
    }
});