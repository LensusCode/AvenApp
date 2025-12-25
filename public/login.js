const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const installBtn = document.getElementById('installBtn');

// Variables para los inputs de registro
const regUser = document.getElementById('regUser');
const regPass = document.getElementById('regPass');
const regName = document.getElementById('regName');
const regSurname = document.getElementById('regSurname');
const btnRegister = document.getElementById('btnRegister');

// Estado de validación
let isUserValid = false;
let isPassValid = false;

// Redirección si ya logueado
// Redirección si ya logueado - ELIMINADO PARA EVITAR BUCLE INFINITO
// if (localStorage.getItem('chatUser')) {
//    window.location.href = '/';
// }


function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if (type === 'success') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:20px;height:20px;vertical-align:middle;margin-right:8px" fill="none" stroke="#28a745" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9 12l2 2 4-4"></path></svg>';
    else if (type === 'error') icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:20px;height:20px;vertical-align:middle;margin-right:8px" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M15 9l-6 6M9 9l6 6"></path></svg>';
    else icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:20px;height:20px;vertical-align:middle;margin-right:8px" fill="none" stroke="#17a2b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><circle cx="12" cy="16" r="0.5" fill="#17a2b8"></circle></svg>';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Auto eliminar
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}



function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


regUser.addEventListener('input', debounce(async (e) => {
    const username = e.target.value.trim();

    // Reset visual
    regUser.classList.remove('valid', 'invalid');
    isUserValid = false;
    updateRegisterBtn();

    if (username.length < 3) return;

    try {
        const res = await fetch('/api/auth/check-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (data.available) {
            regUser.classList.add('valid');
            isUserValid = true;
        } else {
            regUser.classList.add('invalid');
            showToast('El nombre de usuario ya está ocupado', 'error');
            isUserValid = false;
        }
    } catch (error) {
        console.error("Error validando usuario");
    }
    updateRegisterBtn();
}, 500)); // Espera 500ms tras teclear


regPass.addEventListener('input', (e) => {
    const pass = e.target.value;
    regPass.classList.remove('valid', 'invalid');

    if (pass.length >= 8) {
        regPass.classList.add('valid');
        isPassValid = true;
    } else {
        if (pass.length > 0) regPass.classList.add('invalid');
        isPassValid = false;
    }
    updateRegisterBtn();
});

function updateRegisterBtn() {
    // Opcional: Deshabilitar botón si no es válido
    // btnRegister.disabled = !(isUserValid && isPassValid && regName.value && regSurname.value);
}


tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active'); tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
});


registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isUserValid) return showToast('Elige un usuario válido y disponible', 'error');
    if (!isPassValid) return showToast('La contraseña debe tener al menos 8 caracteres', 'error');

    const username = regUser.value;
    const password = regPass.value;
    const firstName = regName.value;
    const lastName = regSurname.value;

    try {
        btnRegister.textContent = 'Creando...';
        btnRegister.disabled = true;

        const res = await fetch('/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, firstName, lastName })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('¡Cuenta creada! Iniciando sesión...', 'success');
            // Auto-login o cambiar a tab login
            setTimeout(() => {
                tabLogin.click();
                document.getElementById('loginUser').value = username;
                document.getElementById('loginPass').focus();
            }, 1500);
        } else {
            showToast(data.error || 'Error al registrar', 'error');
        }
    } catch (e) {
        showToast("Error de conexión con el servidor", 'error');
    } finally {
        btnRegister.textContent = 'Crear Cuenta';
        btnRegister.disabled = false;
    }
});


loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

    const btn = loginForm.querySelector('button');
    btn.textContent = 'Verificando...';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('chatUser', JSON.stringify(data.user));
            showToast('Bienvenido de nuevo', 'success');
            setTimeout(() => window.location.href = '/', 1000);
        } else {
            showToast(data.error || 'Credenciales incorrectas', 'error');
            // Efecto shake en los inputs
            document.getElementById('loginPass').classList.add('invalid');
            setTimeout(() => document.getElementById('loginPass').classList.remove('invalid'), 500);
        }
    } catch (e) {
        showToast("Error de conexión", 'error');
    } finally {
        btn.textContent = 'Entrar';
    }
});


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