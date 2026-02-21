let myUser = null;

// Inicializar Socket.IO con la URL correcta (móvil o web)
// Socket comienza desconectado y se conectará después del login
const socket = io(typeof SOCKET_URL !== 'undefined' ? SOCKET_URL : window.location.origin, {
    autoConnect: false,  // No conectar automáticamente
    transports: ['websocket', 'polling'],
    withCredentials: true,
    extraHeaders: {
        // Las cookies se agregarán dinámicamente al conectar
    }
});

// Socket comienza desconectado y se conectará después del login

// Event listeners para debugging
socket.on('connect', () => {

});

socket.on('disconnect', (reason) => {

});

socket.on('connect_error', (error) => {

});

socket.on('users', (users) => {

});

// --- REAL-TIME SIDEBAR UPDATES ---

socket.on('typing', ({ fromUserId }) => {
    const user = allUsersCache.find(u => u.userId === fromUserId);
    if (user) {
        user.typing = true;
        // Re-render item if visible
        const li = document.querySelector(`.user-item[data-uid="${fromUserId}"]`);
        if (li) {
            const newLi = createUserItem(user);
            li.replaceWith(newLi);
        }
    }
});

socket.on('stop typing', ({ fromUserId }) => {
    const user = allUsersCache.find(u => u.userId === fromUserId);
    if (user) {
        user.typing = false;
        const li = document.querySelector(`.user-item[data-uid="${fromUserId}"]`);
        if (li) {
            const newLi = createUserItem(user);
            li.replaceWith(newLi);
        }
    }
});

socket.on('private message', (msg) => {
    // Update sender's last message
    const user = allUsersCache.find(u => u.userId === msg.fromUserId);
    if (user) {
        // Store raw content so we can process emojis when rendering
        user.lastMessage = msg.content;
        user.lastMessageType = msg.type || 'text';
        user.lastMessageTime = msg.timestamp;

        // Move to top and re-render
        renderMixedSidebar();
    }
});

socket.on('channel_message', (msg) => {
    const channel = myChannels.find(c => c.id == msg.channelId);
    if (channel) {
        channel.last_message_time = msg.timestamp;
        // Store raw content so emojis can be processed when rendering
        channel.last_message = msg.content;
        channel.last_message_type = msg.type || 'text';

        // Move to top and re-render
        renderMixedSidebar();
    }
});


// Helper to resolve image URLs for mobile
function resolveImageUrl(url) {
    if (!url) return '/assets/profile.png';
    const isNative = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);

    // If native and url starts with https://localhost, replace origin with API_BASE_URL
    if (isNative && url.startsWith('https://localhost')) {
        if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
            return url.replace('https://localhost', API_BASE_URL);
        }
    }

    // If it's a full URL (http, blob, data), return it
    // Note: checking after localhost check
    if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    // If we are native and it's a relative path, prepend API URL
    if (isNative && typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
        return API_BASE_URL + (url.startsWith('/') ? '' : '/') + url;
    }
    return url;
}

// Helper to get initials from name
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        // Single word: First and Last letter
        const word = parts[0];
        if (word.length === 1) return word.toUpperCase();
        return (word[0] + word[word.length - 1]).toUpperCase();
    } else {
        // Multi word: First letter of first two words
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
}

// Helper to get consistent color from string
function getAvatarColor(name) {
    if (!name) return '#6b7280'; // Default gray
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16',
        '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
        '#8b5cf6', '#d946ef', '#f43f5e'
    ];
    return colors[Math.abs(hash) % colors.length];
}

// Performance Helpers
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Helper to render avatar content (Image or Initials)
// Returns just the innerHTML or style string depending on usage context
// Context: define if we want style string for bg or inner HTML structure
// Actually, most existing code uses style="background-image:..."
// To support text, we need to inject a div inside if it's text, or use background-image if it's image.
// But we cannot put text in background-image.
// So we will change the approach:
// 1. If image: return `background-image: url(...)` and empty innerHTML
// 2. If text: return `background: color` and innerHTML `<div class="text-avatar">...</div>`
// Warning: Callsites expect to set style.backgroundImage.
// We might need to refactor callsites to set style.background and innerHTML.

function renderAvatarContent(user, sizeClass = '') {
    const name = (typeof myNicknames !== 'undefined' ? myNicknames[user.userId || user.id] : null) || user.display_name || user.username || 'Usuario';
    let avatarUrl = user.avatar;

    // Check if valid URL and NOT a legacy upload path
    // Legacy uploads returning 404 (e.g. /uploads/avatar-...) should fallback to initials
    const isLegacyUpload = avatarUrl && avatarUrl.includes('/uploads/');
    const hasImage = avatarUrl && isValidUrl(avatarUrl) && !avatarUrl.endsWith('profile.png') && !isLegacyUpload;

    if (hasImage) {
        return {
            style: `background-image: url('${resolveImageUrl(avatarUrl)}'); background-color: #222;`,
            html: ''
        };
    } else {
        const initials = getInitials(name);
        const color = getAvatarColor(name);
        return {
            style: `background: ${color};`,
            html: `<div class="text-avatar ${sizeClass}">${initials}</div>`
        };
    }
}


async function apiRequest(url, method = 'GET', body = null) {
    try {
        const fullUrl = typeof getApiUrl === 'function' ? getApiUrl(url) : url;

        // En móvil, usar CapacitorHttp para evitar CORS
        const isNative = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);

        if (isNative && window.Capacitor?.Plugins?.CapacitorHttp) {

            const options = {
                url: fullUrl,
                method: method,
                headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}
            };

            if (body) {
                if (body instanceof FormData) {
                    // CapacitorHttp no soporta FormData directamente
                    // En este caso usaremos fetch normal
                    const res = await fetch(fullUrl, {
                        method,
                        body,
                        credentials: 'include' // IMPORTANTE: Enviar cookies de sesión
                    });

                    if (res.status === 401 || res.status === 403) {
                        return null; // El manejo de login lo hará el caller o se podría redirigir aquí
                    }
                    // Retornar JSON si es posible, o null si falla
                    try {
                        return res.ok ? await res.json() : null;
                    } catch (err) {
                        return null;
                    }
                } else {
                    options.data = JSON.parse(JSON.stringify(body));
                }
            }



            const response = await window.Capacitor.Plugins.CapacitorHttp.request(options);

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('chatUser');
                if (isNative) {
                    showMobileLogin();
                } else {
                    window.location.href = '/login';
                }
                return null;
            }

            // Guardar response completo para acceder a headers si es necesario
            window.lastApiResponse = response;
            return response.status >= 200 && response.status < 300 ? response.data : null;
        } else {
            // En web, usar fetch normal
            const headers = {};
            if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

            const opts = { method, headers };
            if (body) opts.body = body instanceof FormData ? body : JSON.stringify(body);

            const res = await fetch(fullUrl, opts);

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('chatUser');
                window.location.href = '/login';
                return null;
            }

            return res.ok ? await res.json() : null;
        }
    } catch (e) {
        console.error('API Error', e, url);
        return null;
    }
}


window.messagesCache = { private: {}, channels: {} };

async function checkSession() {
    if (window.location.pathname === '/login' || window.location.pathname === '/login.html') return;

    const userData = await apiRequest('/api/auth/me');

    if (userData) {
        try {
            const syncData = await apiRequest('/api/messages/initial-sync');
            if (syncData) {
                window.messagesCache = syncData;
            }
        } catch (e) { console.error("Error preloading messages", e); }
        loginSuccess(userData);
    } else {
        // En móvil (Capacitor), mostrar login inline en lugar de redirigir
        const isNative = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);


        // Alert para confirmar visualmente
        if (isNative) {

        }

        if (isNative) {
            showMobileLogin();
        } else {
            window.location.href = '/login';
        }
    }
}

// Función para mostrar login en la misma página (para móvil)
function showMobileLogin() {

    // Ocultar sidebar y otros elementos
    const sidebar = document.querySelector('.sidebar');
    const mainColumn = document.querySelector('.main-column');
    const fabBtn = document.getElementById('fabNewChat');

    if (sidebar) sidebar.style.display = 'none';
    if (mainColumn) mainColumn.style.display = 'none';
    if (fabBtn) fabBtn.style.display = 'none';

    // Mostrar una pantalla de login moderna
    let loginScreen = document.getElementById('mobile-login-screen');
    if (!loginScreen) {
        console.log('[DEBUG] Creating modern login screen element');
        loginScreen = document.createElement('div');
        loginScreen.id = 'mobile-login-screen';

        // Estilos inline para el login screen
        loginScreen.innerHTML = `
            <style>
                #mobile-login-screen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    background: 
                        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
                        radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%),
                        #0a0a0a;
                    overflow-y: auto;
                    animation: fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .auth-container {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                }
                
                .auth-card {
                    width: 100%;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    background: transparent;
                    padding: 40px 28px;
                    box-sizing: border-box;
                }
                
                .auth-logo {
                    text-align: center;
                    margin-bottom: 45px;
                    animation: logoAppear 0.2s cubic-bezier(0.16, 1, 0.3, 1) 0.1s backwards;
                }
                
                @keyframes logoAppear {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                .auth-logo img {
                    width: 80px;
                    height: 80px;
                    border-radius: 20px;
                    margin-bottom: 18px;
                    filter: drop-shadow(0 4px 20px rgba(99, 102, 241, 0.4));
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .auth-logo img:active {
                    transform: scale(0.95);
                }
                
                .auth-logo h1 {
                    margin: 0;
                    font-size: 36px;
                    font-weight: 700;
                    color: #fff;
                    letter-spacing: -0.5px;
                    text-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
                }
                
                .auth-logo p {
                    color: #a1a1aa;
                    font-size: 15px;
                    margin: 10px 0 0;
                    transition: color 0.3s ease;
                }
                
                .form-toggle {
                    display: flex;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 5px;
                    border-radius: 14px;
                    margin-bottom: 30px;
                    animation: formAppear 0.2s cubic-bezier(0.16, 1, 0.3, 1) 0.15s backwards;
                }
                
                @keyframes formAppear {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .form-toggle button {
                    flex: 1;
                    background: none;
                    border: none;
                    color: #a1a1aa;
                    padding: 13px;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 15px;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    z-index: 1;
                }
                
                .form-toggle button.active {
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
                    transform: scale(1.02);
                }
                
                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    animation: formAppear 0.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s backwards;
                }
                
                .auth-form.hidden {
                    display: none;
                }
                
                .input-group {
                    position: relative;
                    width: 100%;
                }
                
                .input-row {
                    display: flex;
                    gap: 14px;
                }
                
                .auth-form input {
                    width: 100%;
                    padding: 17px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    color: #fff;
                    font-size: 16px;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                    box-sizing: border-box;
                }
                
                .auth-form input::placeholder {
                    color: #71717a;
                }
                
                .auth-form input:focus {
                    border-color: #6366f1;
                    background: rgba(99, 102, 241, 0.08);
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                    transform: translateY(-1px);
                }
                
                .auth-form input.valid {
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.08);
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
                }
                
                .auth-form input.invalid {
                    border-color: #ef4444;
                    background: rgba(239, 68, 68, 0.08);
                    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
                }
                
                @keyframes shake {
                    10%, 90% { transform: translateX(-2px); }
                    20%, 80% { transform: translateX(4px); }
                    30%, 50%, 70% { transform: translateX(-6px); }
                    40%, 60% { transform: translateX(6px); }
                }
                
                .hint-text {
                    font-size: 12px;
                    color: #a1a1aa;
                    margin: 6px 0 0 4px;
                    display: block;
                    transition: color 0.3s ease;
                }
                
                .submit-btn {
                    width: 100%;
                    padding: 18px;
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    border: none;
                    border-radius: 16px;
                    color: #fff;
                    font-size: 17px;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 12px;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
                    position: relative;
                    overflow: hidden;
                }
                
                .submit-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                    transition: left 0.5s;
                }
                
                .submit-btn:active::before {
                    left: 100%;
                }
                
                .submit-btn:active {
                    transform: scale(0.97);
                    box-shadow: 0 3px 15px rgba(99, 102, 241, 0.3);
                }
                
                .submit-btn:disabled {
                    background: #3f3f46;
                    opacity: 0.6;
                    cursor: not-allowed;
                    box-shadow: none;
                    transform: none;
                }
                
                .error-message {
                    color: #ef4444;
                    text-align: center;
                    margin-top: 14px;
                    font-size: 14px;
                    min-height: 20px;
                    animation: slideDown 0.3s ease-out;
                    font-weight: 500;
                }
                
                .success-message {
                    color: #10b981;
                    text-align: center;
                    margin-top: 14px;
                    font-size: 14px;
                    animation: slideDown 0.3s ease-out;
                    font-weight: 500;
                }
                
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            </style>
            
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-logo">
                        <img src="/assets/logo.png" alt="Logo" onerror="this.style.display='none'">
                        <h1>AvenApp</h1>
                        <p id="auth-subtitle">Inicia sesión para continuar</p>
                    </div>
                    
                    <div class="form-toggle">
                        <button id="tab-login" class="active">Iniciar Sesión</button>
                        <button id="tab-register">Registrarse</button>
                    </div>
                    
                    <!-- LOGIN FORM -->
                    <form id="mobile-login-form" class="auth-form">
                        <div class="input-group">
                            <input type="text" id="mobile-username" placeholder="Usuario" required autocomplete="username">
                        </div>
                        <div class="input-group">
                            <input type="password" id="mobile-password" placeholder="Contraseña" required autocomplete="current-password">
                        </div>
                        <button type="submit" class="submit-btn">Entrar</button>
                        <div id="mobile-login-error" class="error-message"></div>
                    </form>
                    
                    <!-- REGISTER FORM -->
                    <form id="mobile-register-form" class="auth-form hidden">
                        <div class="input-row">
                            <div class="input-group">
                                <input type="text" id="register-name" placeholder="Nombre" required>
                            </div>
                            <div class="input-group">
                                <input type="text" id="register-surname" placeholder="Apellido" required>
                            </div>
                        </div>
                        <div class="input-group">
                            <input type="text" id="register-username" placeholder="Usuario" required autocomplete="off">
                        </div>
                        <div class="input-group">
                            <input type="password" id="register-password" placeholder="Contraseña" required autocomplete="new-password">
                            <p class="hint-text">Mínimo 8 caracteres</p>
                        </div>
                        <button type="submit" class="submit-btn" id="btn-register">Crear Cuenta</button>
                        <div id="mobile-register-error" class="error-message"></div>
                        <div id="mobile-register-success" class="success-message"></div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(loginScreen);

        // Tab toggle functionality
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const loginForm = document.getElementById('mobile-login-form');
        const registerForm = document.getElementById('mobile-register-form');
        const subtitle = document.getElementById('auth-subtitle');

        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            subtitle.textContent = 'Inicia sesión para continuar';
        });

        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            subtitle.textContent = 'Crea tu cuenta';
        });

        // Login form handler
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('mobile-username').value;
            const password = document.getElementById('mobile-password').value;
            const errorEl = document.getElementById('mobile-login-error');
            const btn = loginForm.querySelector('.submit-btn');

            btn.textContent = 'Verificando...';
            btn.disabled = true;
            errorEl.textContent = '';

            try {
                const data = await apiRequest('/api/auth/login', 'POST', { username, password });

                if (data && data.user) {
                    if (window.lastApiResponse?.headers) {
                        const setCookieHeader = window.lastApiResponse.headers['Set-Cookie'] || window.lastApiResponse.headers['set-cookie'];
                        if (setCookieHeader) {
                            const tokenMatch = setCookieHeader.match(/chat_token=([^;]+)/);
                            if (tokenMatch) {
                                localStorage.setItem('chat_token', tokenMatch[1]);
                            }
                        }
                    }

                    localStorage.setItem('chatUser', JSON.stringify(data.user));
                    loginScreen.remove();

                    if (sidebar) sidebar.style.display = '';
                    if (mainColumn) mainColumn.style.display = '';
                    if (fabBtn) fabBtn.style.display = '';

                    loginSuccess(data.user);
                } else {
                    errorEl.textContent = 'Usuario o contraseña incorrectos';
                    document.getElementById('mobile-password').classList.add('invalid');
                    setTimeout(() => {
                        document.getElementById('mobile-password').classList.remove('invalid');
                    }, 400);
                }
            } catch (e) {
                errorEl.textContent = 'Error de conexión';
            } finally {
                btn.textContent = 'Entrar';
                btn.disabled = false;
            }
        });

        // Register form validation
        let isUserValid = false;
        let isPassValid = false;

        const regUsername = document.getElementById('register-username');
        const regPassword = document.getElementById('register-password');
        const btnRegister = document.getElementById('btn-register');

        // Debounce function
        function debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // Username validation
        regUsername.addEventListener('input', debounce(async function (e) {
            const username = e.target.value.trim();
            regUsername.classList.remove('valid', 'invalid');
            isUserValid = false;

            if (username.length < 3) return;

            try {
                const data = await apiRequest('/api/auth/check-username', 'POST', { username });
                if (data && data.available) {
                    regUsername.classList.add('valid');
                    isUserValid = true;
                } else {
                    regUsername.classList.add('invalid');
                    document.getElementById('mobile-register-error').textContent = 'Usuario no disponible';
                }
            } catch (e) {
                console.error('Error validando usuario:', e);
            }
        }, 500));

        // Password validation
        regPassword.addEventListener('input', function (e) {
            const pass = e.target.value;
            regPassword.classList.remove('valid', 'invalid');

            if (pass.length >= 8) {
                regPassword.classList.add('valid');
                isPassValid = true;
            } else {
                if (pass.length > 0) regPassword.classList.add('invalid');
                isPassValid = false;
            }
        });

        // Register form handler
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const errorEl = document.getElementById('mobile-register-error');
            const successEl = document.getElementById('mobile-register-success');
            errorEl.textContent = '';
            successEl.textContent = '';

            if (!isUserValid) {
                errorEl.textContent = 'Elige un usuario válido y disponible';
                return;
            }

            if (!isPassValid) {
                errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres';
                return;
            }

            const username = regUsername.value;
            const password = regPassword.value;
            const firstName = document.getElementById('register-name').value;
            const lastName = document.getElementById('register-surname').value;

            btnRegister.textContent = 'Creando cuenta...';
            btnRegister.disabled = true;

            try {
                const data = await apiRequest('/api/auth/register', 'POST', {
                    username,
                    password,
                    firstName,
                    lastName
                });

                if (data) {
                    successEl.textContent = '¡Cuenta creada! Iniciando sesión...';
                    setTimeout(() => {
                        tabLogin.click();
                        document.getElementById('mobile-username').value = username;
                        document.getElementById('mobile-password').focus();
                    }, 1500);
                } else {
                    errorEl.textContent = 'Error al crear la cuenta';
                }
            } catch (e) {
                errorEl.textContent = 'Error de conexión';
                console.error('Error registrando:', e);
            } finally {
                btnRegister.textContent = 'Crear Cuenta';
                btnRegister.disabled = false;
            }
        });
    }

    loginScreen.style.display = 'block';
    console.log('[DEBUG] Login screen should be visible now');
}


const ICONS = {
    blueBadge: `<span class="verified-badge" title="Verificado" style="display:inline-flex; align-items:center; margin-left:5px; vertical-align:middle;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.2 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" fill="#3b82f6"/><path fill="#fff" transform="translate(12, 12) scale(0.75) translate(-12, -12)" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg></span>`,
    purpleBadge: `<span class="verified-badge" title="Administrador" style="display:inline-flex; align-items:center; margin-left:5px; vertical-align:middle;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.2 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" fill="#7c3aed"/><path fill="#fff" transform="translate(12, 12) scale(0.75) translate(-12, -12)" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg></span>`,
    pinkBadge: `<span class="verified-badge" title="Verificado Amor" style="display:inline-flex; align-items:center; margin-left:5px; vertical-align:middle; filter: drop-shadow(0 2px 3px rgba(236, 72, 153, 0.5));"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg"><!-- Fondo Corazón Rosado con bordes suaves --><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ec4899"/><!-- Paloma blanca centrada --><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#fff" transform="scale(0.8) translate(3, 3)"/></svg></span>`,
    send: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`,
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    replyImage: `<svg viewBox="0 0 24 24" height="20" width="18" fill="none"><path d="M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM5 19H19V5H5V19ZM7 17H17C17.2 17 17.35 16.9083 17.45 16.725C17.55 16.5417 17.5333 16.3667 17.4 16.2L14.65 12.525C14.55 12.3917 14.4167 12.325 14.25 12.325C14.0833 12.325 13.95 12.3917 13.85 12.525L11.25 16L9.4 13.525C9.3 13.3917 9.16667 13.325 9 13.325C8.83333 13.325 8.7 13.3917 8.6 13.525L6.6 16.2C6.46667 16.3667 6.45 16.5417 6.55 16.725C6.65 16.9083 6.8 17 7 17Z" fill="currentColor"></path></svg> Foto`,
    replyAudio: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> Mensaje de voz`
};

const getBadgeHtml = (u) => {
    if (!u) return '';
    if (u.is_admin) return ICONS.purpleBadge;
    if (u.is_premium) return ICONS.pinkBadge;
    if (u.is_verified) return ICONS.blueBadge;
    return '';
};


let currentTargetUserId = null, currentTargetUserObj = null;
let lastDetailedTimestamp = null;
let messageIdToDelete = null;
let deleteActionType = 'single';
let currentContextMessageId = null;
let myNicknames = {}, allUsersCache = [];
let currentReplyId = null, mediaRecorder = null, audioChunks = [], recordingInterval = null;
let isRecording = false, shouldSendAudio = true;
let currentStickerTab = 'giphy', myFavorites = new Set();
let cropper = null, searchTimeout, currentStickerUrlInModal = null;
let currentChatType = 'private';

let isEditing = false;
let currentEditingId = null;
let emojiCache = null;
let currentPanelMode = 'stickers';
let currentEmojiCategory = null;
let replyCloseTimer = null;

const editPreview = document.getElementById('editPreview');
const editPreviewText = document.getElementById('editPreviewText');
const closeEditBtn = document.getElementById('closeEditBtn');


const getEl = (id) => document.getElementById(id);
const profileBtn = getEl('profileBtn'), profileModal = getEl('profileModal'), closeProfile = getEl('closeProfile');
const myAvatar = getEl('myAvatar'), profilePreviewAvatar = getEl('profilePreviewAvatar'), avatarInput = getEl('avatarInput');
const usersList = getEl('usersList'), chatHeader = document.querySelector('.chat-header'), emptyState = getEl('emptyState');
const messagesList = getEl('messages'), chatForm = getEl('form'), inputMsg = getEl('input');
const chatTitle = getEl('chatTitle'), currentChatAvatar = getEl('currentChatAvatar');
const typingIndicator = getEl('typingIndicator'), typingText = getEl('typingText');
const btnImage = getEl('btnImage'), chatImageInput = getEl('chatImageInput');
const chatContainer = document.querySelector('.chat-container'), backBtn = getEl('backBtn');
const msgContextMenu = getEl('msgContextMenu');
const contactInfoModal = getEl('contactInfoModal'), closeContactInfo = getEl('closeContactInfo'), contactInfoName = getEl('contactInfoName'), nicknameInput = getEl('nicknameInput');
const replyPreview = getEl('replyPreview'), replyToName = getEl('replyToName'), replyToText = getEl('replyToText'), replyToImagePreview = getEl('replyToImagePreview');
const stickerPanel = getEl('stickerPanel'), stickerResults = getEl('stickerResults');
const mainActionBtn = getEl('mainActionBtn'), recordingUI = getEl('recordingUI'), recordingTimer = getEl('recordingTimer');
const imageEditorModal = getEl('imageEditorModal'), imageToEdit = getEl('imageToEdit'), imageCaptionInput = getEl('imageCaptionInput');
const profileOptionsBtn = getEl('profileOptionsBtn');
const profileOptionsMenu = getEl('profileOptionsMenu');
const adminLoveNoteSection = document.getElementById('adminLoveNoteSection');
const adminLoveNoteInput = document.getElementById('adminLoveNoteInput');
const sendLoveNoteBtn = document.getElementById('sendLoveNoteBtn');





const escapeHtml = (text) => {
    if (!text) return text;
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};


const isValidUrl = (string) => {
    if (!string) return false;
    if (string.startsWith('/') || string.startsWith('./')) return true;
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
};


// Esperar a que todo cargue antes de verificar sesión
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, checking session...');

    // INSTANT LOAD FROM CACHE
    try {
        const cachedUser = localStorage.getItem('chatUser');
        if (cachedUser) {
            console.log('[CACHE] Found cached user, loading UI instantly...');
            myUser = JSON.parse(cachedUser);

            // Restore Admin/UI state immediately
            if (myUser.is_admin) document.body.classList.add('is-admin');
            updateMyAvatarUI(myUser.avatar); // Assumes this function exists and works

            // Load Users
            const cachedUsers = localStorage.getItem('cachedUsers');
            if (cachedUsers) {
                allUsersCache = JSON.parse(cachedUsers);
            }

            // Load Channels
            const cachedChannels = localStorage.getItem('cachedChannels');
            if (cachedChannels) {
                myChannels = JSON.parse(cachedChannels);
            }

            // Render Sidebar Immediately
            if (allUsersCache.length > 0 || myChannels.length > 0) {
                renderMixedSidebar();
            }
        }
    } catch (err) {
        console.error('[CACHE] Error loading cached data:', err);
    }

    // Pequeño delay para asegurar que config.js se cargó
    setTimeout(async () => {
        // Fetch initial sync if we have a user in cache, for fast opening of chats
        if (myUser) {
            try {
                const syncData = await apiRequest('/api/messages/initial-sync');
                if (syncData) {
                    window.messagesCache = syncData;
                }
            } catch (e) { console.error("Error preloading messages on boot", e); }
        }
        checkSession();
    }, 100);
});

getEl('searchUsers').addEventListener('input', applyUserFilter);

// FIX: Sync reply border with input focus state
// This must run after DOM is loaded, so inputMsg and inputStack exist
if (inputMsg) {
    const inputStack = getEl('inputStack');
    if (inputStack) {
        inputMsg.addEventListener('focus', () => {
            inputStack.classList.add('input-focused');
        });
        inputMsg.addEventListener('blur', () => {
            inputStack.classList.remove('input-focused');
        });
    }
}

function loginSuccess(user) {
    myUser = user;
    localStorage.setItem('chatUser', JSON.stringify(user));
    profileBtn.classList.remove('hidden');
    if (myUser.is_admin) document.body.classList.add('is-admin');
    updateMyAvatarUI(myUser.avatar);

    // FIX: Limpiar input si queda vacío visualmente (para que salga el placeholder CSS)
    const checkInputEmpty = () => {
        const text = inputMsg.innerText.trim();
        const hasImages = inputMsg.querySelector('img');
        if (!text && !hasImages) {
            inputMsg.innerHTML = '';
        }
    };
    inputMsg.addEventListener('input', checkInputEmpty);
    inputMsg.addEventListener('blur', checkInputEmpty);


    console.log('[DEBUG] Calling socket.connect()');

    // En Capacitor, necesitamos pasar el token manualmente a Socket.IO
    const isNative = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);
    if (isNative) {
        // Leer token de localStorage
        const token = localStorage.getItem('chat_token');
        console.log('[DEBUG] Token from localStorage:', token ? token.substring(0, 50) + '...' : 'null');

        if (token) {
            // Usar auth en lugar de extraHeaders - más confiable
            socket.auth = { token };
            socket.io.opts.extraHeaders = {
                'cookie': `chat_token=${token}`
            };
            console.log('[DEBUG] Set Socket.IO auth and headers with token');
        } else {
            console.error('[DEBUG] No token found in localStorage!');
        }
    }

    socket.connect();
    console.log('[DEBUG] socket.connect() called. Connected:', socket.connected);

    updateButtonState();
    refreshFavoritesCache();

    checkPremiumFeatures();
    loadMyChannels();
    setupEditButtons();
}








function getInputContent() {
    function parseNodes(nodes) {
        let text = '';
        nodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'IMG' && node.classList.contains('inline-emoji')) {
                    const originalUrl = node.dataset.original || node.src;
                    text += `[emoji:${originalUrl}]`;
                } else if (node.tagName === 'BR') {
                    text += '\n';
                } else {

                    text += parseNodes(node.childNodes);


                    const style = window.getComputedStyle(node);
                    if (style.display === 'block' || style.display === 'div') {
                        if (!text.endsWith('\n')) text += '\n';
                    }
                }
            }
        });
        return text;
    }

    return parseNodes(inputMsg.childNodes).trim();
}

function clearInput() {
    inputMsg.innerHTML = '';
}


function insertEmojiAtCursor(url) {
    inputMsg.focus();


    const img = document.createElement('img');
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.className = 'inline-emoji';
    img.dataset.original = url;


    freezeImage(img, false);

    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
        let range = sel.getRangeAt(0);


        if (!inputMsg.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(inputMsg);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        range.deleteContents();
        range.insertNode(img);


        range.setStartAfter(img);
        range.setEndAfter(img);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        inputMsg.appendChild(img);
    }


    inputMsg.dispatchEvent(new Event('input', { bubbles: true }));
}


function insertAtCursor(myField, myValue) {

    if (myField.isContentEditable) {
        myField.focus();

        let success = false;
        try {
            success = document.execCommand('insertText', false, myValue);
        } catch (e) {
            console.warn("execCommand failed", e);
        }


        if (!success) {
            const sel = window.getSelection();
            if (sel.getRangeAt && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(myValue);
                range.insertNode(textNode);


                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {

                myField.innerText += myValue;
            }
        }


        myField.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }


    if (document.selection) {
        myField.focus();
        sel = document.selection.createRange();
        sel.text = myValue;
    } else if (myField.selectionStart || myField.selectionStart == '0') {
        var startPos = myField.selectionStart;
        var endPos = myField.selectionEnd;
        myField.value = myField.value.substring(0, startPos)
            + myValue
            + myField.value.substring(endPos, myField.value.length);
        myField.selectionStart = startPos + myValue.length;
        myField.selectionEnd = startPos + myValue.length;
    } else {
        myField.value += myValue;
    }

    myField.dispatchEvent(new Event('input', { bubbles: true }));
}


const freezeImage = (img, saveOriginal = true) => {
    try {
        if (saveOriginal && !img.dataset.original) img.dataset.original = img.src;
        if (img.dataset.frozen === "true") return;


        const doFreeze = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = canvas.toDataURL();
            img.dataset.frozen = "true";
        };

        if (img.complete && img.naturalHeight > 0) doFreeze();
        else img.onload = doFreeze;
    } catch (e) { console.error("Freeze error", e); }
};

const unfreezeImage = (img) => {
    if (img.dataset.original) {
        img.src = img.dataset.original;
        img.dataset.frozen = "false";
    }
};

const playAnimationOnce = (img) => {
    unfreezeImage(img);

    const src = img.src; img.src = ""; img.src = src;


    if (img.dataset.timer) clearTimeout(parseInt(img.dataset.timer));
    const t = setTimeout(() => freezeImage(img, false), 2500);
    img.dataset.timer = t;
};


let currentEditFile = null;
let currentScaleX = 1;


chatImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    currentEditFile = file;
    const reader = new FileReader();

    reader.onload = (evt) => {

        if (cropper) { cropper.destroy(); cropper = null; }
        getEl('imageEditorModal').classList.remove('hidden');


        getEl('mainHeader').classList.remove('hidden');
        getEl('mainFooter').classList.remove('hidden');
        getEl('cropFooter').classList.add('hidden');


        imageToEdit.src = evt.target.result;
        imageCaptionInput.value = '';
        imageCaptionInput.focus();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});


getEl('closeEditorBtn').addEventListener('click', () => {
    getEl('imageEditorModal').classList.add('hidden');
    if (cropper) { cropper.destroy(); cropper = null; }
    currentEditFile = null;
});


getEl('enterCropModeBtn').addEventListener('click', () => {

    getEl('mainHeader').classList.add('hidden');
    getEl('mainFooter').classList.add('hidden');


    getEl('cropFooter').classList.remove('hidden');


    currentScaleX = 1;
    cropper = new Cropper(imageToEdit, {
        viewMode: 1,
        dragMode: 'none',
        autoCropArea: 0.9,
        restore: false,
        guides: true,
        center: false,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        background: false,
        minContainerWidth: 300,
        minContainerHeight: 300
    });
});




getEl('rotateBtn').addEventListener('click', () => {
    if (!cropper) return;

    const container = document.querySelector('.cropper-container');
    container.classList.add('animating-rotation');

    const cropBoxData = cropper.getCropBoxData();
    const containerData = cropper.getContainerData();

    cropper.rotate(90);


    const containerCenterX = containerData.width / 2;
    const containerCenterY = containerData.height / 2;
    const newWidth = cropBoxData.height;
    const newHeight = cropBoxData.width;

    cropper.setCropBoxData({
        width: newWidth,
        height: newHeight,
        left: containerCenterX - (newWidth / 2),
        top: containerCenterY - (newHeight / 2)
    });

    setTimeout(() => container.classList.remove('animating-rotation'), 300);
});


getEl('flipBtn').addEventListener('click', () => {
    if (!cropper) return;
    currentScaleX = -currentScaleX;
    cropper.scaleX(currentScaleX);
});


getEl('cancelCropBtn').addEventListener('click', () => {

    if (cropper) { cropper.destroy(); cropper = null; }


    getEl('cropFooter').classList.add('hidden');
    getEl('mainHeader').classList.remove('hidden');
    getEl('mainFooter').classList.remove('hidden');
});


getEl('okCropBtn').addEventListener('click', () => {
    if (!cropper) return;


    const croppedCanvas = cropper.getCroppedCanvas({ maxWidth: 2048, maxHeight: 2048 });
    const croppedImageBase64 = croppedCanvas.toDataURL('image/jpeg', 0.9);


    cropper.destroy();
    cropper = null;


    imageToEdit.src = croppedImageBase64;


    getEl('cropFooter').classList.add('hidden');
    getEl('mainHeader').classList.remove('hidden');
    getEl('mainFooter').classList.remove('hidden');
});


getEl('sendImageBtn').addEventListener('click', async () => {
    getEl('sendImageBtn').innerHTML = '...';


    const res = await fetch(imageToEdit.src);
    const blob = await res.blob();

    const formData = new FormData();
    formData.append('image', blob, 'image.jpg');

    const data = await apiRequest('/api/upload-chat-image', 'POST', formData);

    if (data) {
        socket.emit('private message', {
            content: data.imageUrl,
            toUserId: currentTargetUserId,
            type: 'image',
            replyToId: currentReplyId,
            caption: imageCaptionInput.value.trim()
        }, (res) => {
            appendMessageUI(res.content, 'me', res.timestamp, res.id, 'image', null, false, res.caption);
        });
        clearReply();
        getEl('imageEditorModal').classList.add('hidden');
    } else {
        alert("Error al subir imagen");
    }

    getEl('sendImageBtn').innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    currentEditFile = null;
});


socket.on('chat history cleared', ({ chatId }) => {
    console.log("Evento recibido para limpiar chat con ID:", chatId);

    if (currentTargetUserId && parseInt(currentTargetUserId) === parseInt(chatId)) {

        const messagesList = document.getElementById('messages');

        messagesList.style.opacity = '0';
        messagesList.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            messagesList.innerHTML = '';

            const li = document.createElement('li');
            li.style.cssText = 'text-align:center; color:#666; margin:20px; font-size:12px; font-weight:500; list-style:none; opacity:0; animation: fadeIn 0.5s forwards;';
            li.textContent = 'El historial del chat ha sido vaciado.';
            messagesList.appendChild(li);

            messagesList.style.opacity = '1';

            const scrollBtn = document.getElementById('scrollToBottomBtn');
            if (scrollBtn) scrollBtn.classList.add('hidden');

        }, 300);
    }
});



socket.on('nicknames', (map) => {
    myNicknames = map;
    // Use the unified sidebar renderer instead of the legacy user list
    renderMixedSidebar();
    if (currentTargetUserObj) updateChatHeaderInfo(currentTargetUserObj);
});


// Función Helper para editar campos
function setupFieldEditing(triggerElement, targetElementId, dbField, prefix = '') {
    const trigger = triggerElement; // El elemento clickeado (puede ser el texto o el botón)
    const targetEl = document.getElementById(targetElementId);

    if (!trigger || !targetEl) return;

    trigger.addEventListener('click', (e) => {
        const editBtn = document.querySelector(`.edit-btn[data-target="${targetElementId}"]`);

        // Evitar re-apertura inmediata si acabamos de guardar clickeando el botón
        if (editBtn && editBtn.dataset.justSaved === "true") {
            delete editBtn.dataset.justSaved;
            return;
        }

        // Evitar doble acción si ya se está editando
        if (targetEl.querySelector('input')) return;

        // Gestión del icono
        let originalIcon = "";
        if (editBtn) {
            originalIcon = editBtn.innerHTML;
            // Icono Check
            editBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            editBtn.style.display = 'flex';
        }

        const currentText = targetEl.innerText.replace(prefix, '').trim();
        const originalContent = targetEl.innerHTML;

        // Crear Input
        const input = document.createElement('input');
        input.type = 'text';

        // Mejorar UX: Si es el placeholder, mostrar input vacío
        let textToEdit = currentText;
        const isPlaceholder = (t) => t === "Añadir una biografía..." || t === "Añade una biografía..." || t === "Sin biografía.";
        if (dbField === 'bio' && isPlaceholder(textToEdit)) {
            textToEdit = "";
        }

        input.value = textToEdit;
        input.className = 'editing-input';
        if (dbField === 'bio') input.placeholder = "Escribe algo sobre ti...";

        // Reemplazar contenido por input
        targetEl.innerHTML = '';
        targetEl.appendChild(input);
        input.focus();

        const restoreUI = (val) => {
            targetEl.innerHTML = '';
            // Chequear si está vacío O es uno de los placeholders antiguos
            if (dbField === 'bio' && (!val || isPlaceholder(val))) {
                targetEl.textContent = "Añade una biografía...";
                targetEl.style.color = "#666";
            } else {
                targetEl.textContent = prefix + val;
                targetEl.style.color = "";
            }

            // Re-add badge if name
            if (dbField === 'display_name') {
                const badge = getBadgeHtml(myUser);
                if (badge) targetEl.insertAdjacentHTML('beforeend', badge);
            }

            // Restaurar icono original
            if (editBtn) {
                editBtn.innerHTML = originalIcon;
                editBtn.style.display = 'flex';
            }
        };

        const save = async () => {
            // Marcar que acabamos de guardar para prevenir el re-click
            if (editBtn) {
                editBtn.dataset.justSaved = "true";
                setTimeout(() => { if (editBtn.dataset.justSaved) delete editBtn.dataset.justSaved; }, 300);
            }

            let newValue = input.value.trim();

            // Si no cambiamos nada (comparando con lo que había en el input, o si revertimos al original)
            // Nota: si currentText era placeholder y newValue es vacío, es un "no cambio" lógico
            if (newValue === textToEdit) {
                restoreUI(currentText); // Restauramos lo que había (aunque sea placeholder)
                return;
            }

            // Validación
            if (dbField === 'username' && newValue.length < 3) {
                alert("Mínimo 3 caracteres");
                restoreUI(currentText);
                return;
            }

            try {
                input.disabled = true;
                input.style.opacity = "0.5";

                const res = await apiRequest('/api/profile/update', 'PUT', { field: dbField, value: newValue });

                if (res && res.success) {
                    myUser[dbField] = res.value;
                    localStorage.setItem('chatUser', JSON.stringify(myUser));
                    restoreUI(res.value);
                } else {
                    alert(res.error || "Error al actualizar");
                    restoreUI(currentText);
                }
            } catch (e) {
                console.error(e);
                restoreUI(currentText);
            }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') {
                if (editBtn) {
                    editBtn.dataset.justSaved = "true";
                    setTimeout(() => delete editBtn.dataset.justSaved, 300);
                }
                restoreUI(currentText);
            }
        });
    });

    // Agregar clase visual al texto si es el trigger
    if (trigger === targetEl) {
        targetEl.classList.add('editable-text');
        targetEl.title = "Haz click para editar";
    }
}

function setupEditButtons() {
    // Configurar edición para Nombre
    const nameEl = document.getElementById('profileRealName');
    const nameBtn = document.getElementById('editNameBtn');
    setupFieldEditing(nameEl, 'profileRealName', 'display_name');
    setupFieldEditing(nameBtn, 'profileRealName', 'display_name');

    // Configurar edición para Usuario
    const userEl = document.getElementById('profileHandle');
    const userBtn = document.getElementById('editUserBtn');
    setupFieldEditing(userEl, 'profileHandle', 'username', '@');
    setupFieldEditing(userBtn, 'profileHandle', 'username', '@');

    // Configurar edición para Bio
    const bioEl = document.getElementById('profileBio');
    const bioBtn = document.getElementById('editBioBtn');
    setupFieldEditing(bioEl, 'profileBio', 'bio');
    setupFieldEditing(bioBtn, 'profileBio', 'bio');
}


function enableNicknameEdit(elementId, targetUserId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.add('editable-field');
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    newEl.addEventListener('click', () => {
        let currentText = newEl.innerText.replace('✎', '').trim();
        const originalContent = newEl.innerHTML;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.placeholder = "Escribe un apodo";
        input.className = 'editing-input';

        newEl.innerHTML = '';
        newEl.appendChild(input);
        newEl.classList.remove('editable-field');
        input.focus();

        const save = () => {
            const newValue = input.value.trim();
            socket.emit('set nickname', { targetUserId: targetUserId, nickname: newValue });

            if (newValue) myNicknames[targetUserId] = newValue;
            else delete myNicknames[targetUserId];

            newEl.innerHTML = '';
            newEl.textContent = newValue || currentTargetUserObj.display_name || currentTargetUserObj.username;
            newEl.insertAdjacentHTML('beforeend', getBadgeHtml(currentTargetUserObj));
            newEl.classList.add('editable-field');

            updateChatHeaderInfo(currentTargetUserObj);
            applyUserFilter();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { newEl.innerHTML = originalContent; newEl.classList.add('editable-field'); } });
    });
}


function renderMyProfileInfo() {
    if (!myUser) return;
    const nameEl = document.getElementById('profileRealName');
    const displayName = myUser.display_name || myUser.username;
    nameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(myUser);

    const handleEl = document.getElementById('profileHandle');
    handleEl.textContent = `@${myUser.username}`;

    const bioEl = document.getElementById('profileBio');
    bioEl.textContent = myUser.bio || "Añade una biografía...";
    bioEl.style.color = !myUser.bio ? "#666" : "#e4e4e7";
}

profileBtn.addEventListener('click', () => {
    if (fabNewChat) fabNewChat.classList.add('hidden');
    if (loveNotesBtn) loveNotesBtn.classList.add('hidden');
    renderMyProfileInfo();
    profileModal.classList.remove('hidden');



});

const togglePremiumBtn = getEl('togglePremiumBtn');

getEl('headerAvatarBtn').addEventListener('click', () => {
    if (!currentTargetUserObj) return;

    const modal = getEl('contactInfoModal');
    const nameEl = getEl('contactInfoName');
    const userEl = getEl('contactRealUsername');
    const bioEl = getEl('contactInfoBio');
    const avatarEl = getEl('contactInfoAvatar');
    const adminSec = getEl('adminActionsSection');

    const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;

    nameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
    userEl.textContent = `@${currentTargetUserObj.username}`;

    if (currentTargetUserObj.bio) {
        bioEl.textContent = currentTargetUserObj.bio;
        bioEl.style.color = "#e4e4e7";
    } else {
        bioEl.textContent = "Sin biografía.";
        bioEl.style.color = "#666";
    }

    const { style, html } = renderAvatarContent(currentTargetUserObj, 'contact-info-avatar');
    avatarEl.style = style;
    avatarEl.innerHTML = html;

    if (myUser?.is_admin) {
        adminSec.classList.remove('hidden');
        getEl('toggleVerifyBtn').textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
        togglePremiumBtn.textContent = currentTargetUserObj.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";
    }
    else {
        adminSec.classList.add('hidden');
    }

    if (myUser?.is_admin && currentTargetUserObj.is_premium) {
        adminLoveNoteSection.classList.remove('hidden');
    } else if (adminLoveNoteSection) {
        adminLoveNoteSection.classList.add('hidden');
    }


    modal.classList.remove('hidden');
    enableNicknameEdit('contactInfoName', currentTargetUserObj.userId);
});

if (sendLoveNoteBtn) {
    sendLoveNoteBtn.addEventListener('click', async () => {
        const content = adminLoveNoteInput.value.trim();
        if (!content) return alert("Escribe algo primero.");
        if (!currentTargetUserId) return;

        sendLoveNoteBtn.disabled = true;
        sendLoveNoteBtn.textContent = "Enviando...";

        const res = await apiRequest('/api/admin/send-love-note', 'POST', {
            targetUserId: currentTargetUserId,
            content: content
        });

        sendLoveNoteBtn.disabled = false;
        sendLoveNoteBtn.textContent = "Enviar Nota";

        if (res && res.success) {
            alert("Nota enviada con éxito 💖");
            adminLoveNoteInput.value = '';
        } else {
            alert("Error al enviar.");
        }
    });
}


if (togglePremiumBtn) {
    togglePremiumBtn.addEventListener('click', async () => {

        if (!currentTargetUserObj || !currentTargetUserId) return;


        const previousState = currentTargetUserObj.is_premium;


        currentTargetUserObj.is_premium = !currentTargetUserObj.is_premium;


        togglePremiumBtn.textContent = currentTargetUserObj.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";


        const modalNameEl = document.getElementById('contactInfoName');
        const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;
        if (modalNameEl) {
            modalNameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        }


        updateChatHeaderInfo(currentTargetUserObj);


        const userListItem = document.querySelector(`.user-item[data-uid="${currentTargetUserObj.userId}"] div[style*="font-weight:600"]`);
        if (userListItem) {
            userListItem.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        }


        try {
            const res = await apiRequest('/api/admin/toggle-premium', 'POST', {
                targetUserId: currentTargetUserObj.userId
            });

            if (!res || !res.success) {
                throw new Error("Error en servidor");
            }
        } catch (error) {
            console.error(error);

            currentTargetUserObj.is_premium = previousState;
            updateChatHeaderInfo(currentTargetUserObj);
            togglePremiumBtn.textContent = currentTargetUserObj.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";
            alert("No se pudo actualizar el verificado de corazón.");
        }
    });
}

getEl('closeContactInfo').addEventListener('click', () => getEl('contactInfoModal').classList.add('hidden'));
closeProfile.addEventListener('click', () => {
    // Animation exit logic
    const card = profileModal.querySelector('.profile-card.modern-profile');
    if (card) {
        card.classList.add('closing');
        setTimeout(() => {
            profileModal.classList.add('hidden');
            card.classList.remove('closing');
            if (fabNewChat) fabNewChat.classList.remove('hidden');
            if (loveNotesBtn && myUser && myUser.is_premium) {
                loveNotesBtn.classList.remove('hidden');
            }
        }, 240); // slightly less than 250ms to prevent flash
    } else {
        // Fallback if no card found
        if (fabNewChat) fabNewChat.classList.remove('hidden');
        profileModal.classList.add('hidden');
        if (loveNotesBtn && myUser && myUser.is_premium) {
            loveNotesBtn.classList.remove('hidden');
        }
    }
});


if (profileOptionsBtn) {
    profileOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileOptionsMenu.classList.toggle('hidden');
    });
}
const sidebarMyProfileBtn = document.getElementById('sidebarMyProfileBtn');

if (sidebarMyProfileBtn) {
    sidebarMyProfileBtn.addEventListener('click', (e) => {
        // Calculate center of the button for animation origin
        const rect = sidebarMyProfileBtn.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;

        const card = profileModal.querySelector('.profile-card.modern-profile');
        if (card) {
            card.style.setProperty('--origin-x', `${originX}px`);
            card.style.setProperty('--origin-y', `${originY}px`);

            // Remove closing class just in case
            card.classList.remove('closing');
        }

        if (fabNewChat) fabNewChat.classList.add('hidden');
        profileModal.classList.remove('hidden');
        if (loveNotesBtn) loveNotesBtn.classList.add('hidden');

        // Re-render info
        if (myUser) {
            renderMyProfileInfo();
        }
    });
}

document.addEventListener('click', (e) => {
    if (profileOptionsMenu && !profileOptionsMenu.contains(e.target) && !profileOptionsBtn.contains(e.target)) {
        profileOptionsMenu.classList.add('hidden');
    }
});


const newLogoutBtn = getEl('profileLogout');
if (newLogoutBtn) {
    newLogoutBtn.replaceWith(newLogoutBtn.cloneNode(true));
    getEl('profileLogout').addEventListener('click', () => {
        profileModal.classList.add('hidden');
        getEl('confirmModal').classList.remove('hidden');
    });
}

getEl('confirmYes').addEventListener('click', async () => {
    // Disable button to prevent double clicks
    const btn = getEl('confirmYes');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saliendo...';
    }

    try {
        // Use apiRequest helper which handles full URL for mobile (Capacitor)
        // and correct endpoint /api/auth/logout
        await apiRequest('/api/auth/logout', 'POST');
    } catch (e) {
        console.error('Logout error (continuing anyway):', e);
    } finally {
        // Always cleanup and redirect
        localStorage.removeItem('chatUser');
        localStorage.removeItem('chat_token'); // Ensure token is also removed if present

        const isNative = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);

        // Hide modal
        getEl('confirmModal').classList.add('hidden');

        if (isNative && typeof showMobileLogin === 'function') {
            showMobileLogin();
        } else {
            window.location.href = '/login';
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Sí, salir';
        }
    }
});
getEl('confirmNo').addEventListener('click', () => { getEl('confirmModal').classList.add('hidden'); profileModal.classList.remove('hidden'); });

avatarInput.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    const fd = new FormData();
    fd.append('avatar', e.target.files[0]);
    await apiRequest('/api/upload-avatar', 'POST', fd);
});

function updateMyAvatarUI(url) {
    // We ignore url arg preference if we have myUser, but to be safe we can rely on myUser.avatar
    // If url is passed, it might be the new one before myUser update? 
    // Usually logic updates myUser first.

    // We need to render for different contexts. 
    // 1. myAvatar (Legacy?)
    // 2. headerProfileAvatar
    // 3. profilePreviewAvatar

    // For simplicity, we can pass a temp object if we strictly want to use 'url' 
    // but better to use myUser if avail.
    const userObj = myUser || { username: 'Yo', avatar: url };
    if (url) userObj.avatar = url;

    // headerProfileAvatar
    const headerAvatar = document.getElementById('headerProfileAvatar');
    if (headerAvatar) {
        const { style, html } = renderAvatarContent(userObj, 'header-avatar');
        headerAvatar.style = style;
        headerAvatar.innerHTML = html;
    }

    // profilePreviewAvatar (Usually larger)
    const preview = document.getElementById('profilePreviewAvatar');
    if (preview) {
        const { style, html } = renderAvatarContent(userObj, 'profile-preview-avatar');
        preview.style = style;
        preview.innerHTML = html;
    }

    // Legacy myAvatar
    if (typeof myAvatar !== 'undefined' && myAvatar) {
        const { style, html } = renderAvatarContent(userObj, 'u-avatar');
        myAvatar.style = style;
        myAvatar.innerHTML = html;
    }
}

// Add listener for new Header Profile Pill
// Add listener for new Header Profile Pill (Sidebar)
const sidebarProfileBtn = document.getElementById('sidebarMyProfileBtn');
if (sidebarProfileBtn) {
    sidebarProfileBtn.addEventListener('click', () => {
        // Reuse existing logic by clicking the hidden profileBtn if possible, 
        // or directly open modal
        if (profileBtn) {
            profileBtn.click();
        } else {
            const pModal = document.getElementById('profileModal');
            if (pModal) {
                pModal.classList.remove('hidden');
                // Also ensure fab is hidden if logic requires it
                if (fabNewChat) fabNewChat.style.display = 'none';
            }
        }
    });
}

function updateChatHeaderInfo(u) {
    chatTitle.innerHTML = escapeHtml(myNicknames[u.userId] || u.username) + getBadgeHtml(u);
    // FIX: Target the chat header avatar (currentChatAvatar), NOT the user's profile button!
    const headerAvatar = document.getElementById('currentChatAvatar');
    if (headerAvatar) {
        const { style, html } = renderAvatarContent(u, 'header-avatar');
        headerAvatar.style = style;
        headerAvatar.innerHTML = html;
    }
}


const switchStickerTab = (tab) => {
    currentStickerTab = tab;
    getEl('tabGiphy').classList.toggle('active', tab === 'giphy');
    getEl('tabFavs').classList.toggle('active', tab === 'favorites');
    getEl('stickerHeaderSearch').classList.toggle('hidden', tab !== 'giphy');
    tab === 'giphy' ? loadStickers(getEl('stickerSearch').value) : loadFavoritesFromServer();
};

if (getEl('tabGiphy')) {
    getEl('tabGiphy').addEventListener('click', () => switchStickerTab('giphy'));
    getEl('tabFavs').addEventListener('click', () => switchStickerTab('favorites'));
}


const btnStickersNav = getEl('btnStickersNav');
const btnEmojiNav = getEl('btnEmojiNav');
const stickerTabsContainer = getEl('stickerTabsContainer');
const emojiCategoryTabs = getEl('emojiCategoryTabs');
const stickerSearchHeader = getEl('stickerHeaderSearch');

async function switchPanelMode(mode) {
    currentPanelMode = mode;


    if (mode === 'emojis') {
        btnEmojiNav.classList.add('active-btn');
        btnEmojiNav.classList.remove('inactive-btn');
        btnStickersNav.classList.remove('active-btn');
        btnStickersNav.classList.add('inactive-btn');


        stickerTabsContainer.classList.add('hidden');
        stickerTabsContainer.style.display = 'none';

        stickerSearchHeader.classList.add('hidden');


        emojiCategoryTabs.classList.remove('hidden');


        emojiCategoryTabs.style.removeProperty('display');


        stickerResults.innerHTML = '';

        await loadEmojis();
    } else {

        btnStickersNav.classList.add('active-btn');
        btnStickersNav.classList.remove('inactive-btn');
        btnEmojiNav.classList.remove('active-btn');
        btnEmojiNav.classList.add('inactive-btn');


        stickerTabsContainer.classList.remove('hidden');
        stickerTabsContainer.style.display = 'flex';

        if (currentStickerTab === 'giphy') stickerSearchHeader.classList.remove('hidden');


        emojiCategoryTabs.classList.add('hidden');

        emojiCategoryTabs.style.setProperty('display', 'none', 'important');


        stickerResults.className = 'sticker-grid';


        stickerResults.innerHTML = '';

        currentStickerTab === 'giphy' ? loadStickers(getEl('stickerSearch').value) : loadFavoritesFromServer();
    }
}

if (btnStickersNav && btnEmojiNav) {
    btnStickersNav.addEventListener('click', () => switchPanelMode('stickers'));
    btnEmojiNav.addEventListener('click', () => switchPanelMode('emojis'));
}


function renderSkeletonLoader(type) {
    stickerResults.innerHTML = '';
    const count = 20;
    const fragment = document.createDocumentFragment();


    if (type === 'emojis') {
        stickerResults.className = 'sticker-grid emoji-grid-mode';
    } else {
        stickerResults.className = 'sticker-grid';
    }

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        if (type === 'emojis') {
            div.className = 'sticker-item-wrapper emoji-item';
            const skel = document.createElement('div');
            skel.className = 'skeleton skeleton-emoji';
            div.appendChild(skel);
        } else {
            div.className = 'sticker-item-wrapper';
            const skel = document.createElement('div');
            skel.className = 'skeleton skeleton-sticker';
            div.appendChild(skel);
        }
        fragment.appendChild(div);
    }
    stickerResults.appendChild(fragment);
}

async function loadEmojis() {
    if (emojiCache) {
        renderEmojiCategories(emojiCache);
        return;
    }

    renderSkeletonLoader('emojis');

    const res = await apiRequest('/api/emojis');

    if (currentPanelMode !== 'emojis') return;

    if (res && res.success) {
        // Fix for mobile/relative paths: Ensure we use GitHub URLs
        const GH_BASE = 'https://raw.githubusercontent.com/LensusCode/animated-emojis/main';
        const fixedData = {};

        for (const [cat, files] of Object.entries(res.data)) {
            fixedData[cat] = files.map(f => {
                if (typeof f === 'string' && f.startsWith('/')) {
                    // Transform local path to GitHub URL
                    // Remove /Animated-Emojis/ or leading slash
                    const cleanPath = f.replace(/^\/Animated-Emojis\//, '').replace(/^\//, '');
                    // Encode components to handle spaces correctly
                    const encodedPath = cleanPath.split('/').map(p => encodeURIComponent(p)).join('/');
                    return `${GH_BASE}/${encodedPath}`;
                }
                return f;
            });
        }

        emojiCache = fixedData;

        const keys = Object.keys(emojiCache);
        if (keys.length > 0) currentEmojiCategory = keys[0];

        renderEmojiCategories(emojiCache);
    } else {
        stickerResults.innerHTML = '<div class="loading-stickers">Error al cargar emojis</div>';
    }
}

function renderEmojiCategories(data) {
    emojiCategoryTabs.innerHTML = '';
    const categories = Object.keys(data);

    if (categories.length === 0) {
        stickerResults.innerHTML = '<div class="loading-stickers">No hay emojis disponibles</div>';
        return;
    }

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `sticker-tab ${currentEmojiCategory === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => {
            currentEmojiCategory = cat;
            renderEmojiGrid(data[cat]);

            Array.from(emojiCategoryTabs.children).forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
        };
        emojiCategoryTabs.appendChild(btn);
    });


    if (currentEmojiCategory && data[currentEmojiCategory]) {
        renderEmojiGrid(data[currentEmojiCategory]);
    }
}

function renderEmojiGrid(urls) {
    stickerResults.innerHTML = '';
    stickerResults.className = 'sticker-grid emoji-grid-mode';

    const BATCH_SIZE = 30; // Render 30 emojis per frame
    let currentIndex = 0;

    function renderBatch() {
        const batchEnd = Math.min(currentIndex + BATCH_SIZE, urls.length);
        const fragment = document.createDocumentFragment();

        for (let i = currentIndex; i < batchEnd; i++) {
            const url = urls[i];
            const wrap = document.createElement('div');
            wrap.className = 'sticker-item-wrapper emoji-item';

            // Create canvas instead of img to freeze animation
            const canvas = document.createElement('canvas');
            canvas.className = 'sticker-thumb emoji-img';
            // Remove inline sizes so CSS can control it:
            // canvas.style.width = "64px"; 
            // canvas.style.height = "64px";

            // Allow CSS to size it

            const tmpImg = new Image();
            tmpImg.crossOrigin = "anonymous"; // In case needed for cors
            tmpImg.src = url;

            tmpImg.onload = () => {
                canvas.width = tmpImg.naturalWidth;
                canvas.height = tmpImg.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tmpImg, 0, 0);
            };

            wrap.onclick = (e) => {
                e.stopPropagation();
                // We still insert the original animated URL
                insertEmojiAtCursor(url);
                stickerPanel.classList.add('hidden');
                updateButtonState();
            };

            wrap.appendChild(canvas);
            fragment.appendChild(wrap);
        }

        stickerResults.appendChild(fragment);
        currentIndex += BATCH_SIZE;

        if (currentIndex < urls.length) {
            // Check if user switched categories mid-render to abort
            if (stickerResults.className.includes('emoji-grid-mode')) {
                requestAnimationFrame(renderBatch);
            }
        }
    }

    renderBatch();
}


getEl('btnStickers').addEventListener('click', () => {
    stickerPanel.classList.toggle('hidden');
    if (!stickerPanel.classList.contains('hidden')) {
        refreshFavoritesCache();

        if (currentPanelMode === 'stickers') {
            currentStickerTab === 'giphy' ? loadStickers() : loadFavoritesFromServer();
        } else {
            loadEmojis();
        }
    }
});
document.addEventListener('click', (e) => { if (!stickerPanel.contains(e.target) && !getEl('btnStickers').contains(e.target)) stickerPanel.classList.add('hidden'); });

getEl('stickerSearch').addEventListener('input', (e) => {
    if (currentStickerTab !== 'giphy') return;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadStickers(e.target.value), 500);
});

async function refreshFavoritesCache() {
    const list = await apiRequest(`/api/messages/favorites/${myUser.id}`);
    if (list) myFavorites = new Set(list);
}

async function loadStickers(query = '') {
    renderSkeletonLoader('stickers');
    const data = await apiRequest(`/api/stickers-proxy?q=${encodeURIComponent(query)}`);


    if (currentPanelMode !== 'stickers' || currentStickerTab !== 'giphy') return;

    if (data?.data) {
        renderStickersGrid(data.data.map(i => ({ url: i.images.fixed_height.url, thumb: i.images.fixed_height_small.url })));
    } else stickerResults.innerHTML = '<div class="loading-stickers">Error al cargar</div>';
}

async function loadFavoritesFromServer() {
    renderSkeletonLoader('stickers');
    await refreshFavoritesCache();


    if (currentPanelMode !== 'stickers' || currentStickerTab !== 'favorites') return;

    if (!myFavorites.size) return stickerResults.innerHTML = '<div class="loading-stickers">Aún no tienes stickers favoritos.</div>';
    renderStickersGrid(Array.from(myFavorites).map(url => ({ url, thumb: url })));
}

function renderStickersGrid(items) {
    stickerResults.innerHTML = '';
    if (!items.length) return stickerResults.innerHTML = '<div class="loading-stickers">No se encontraron resultados</div>';
    items.forEach(item => {
        if (!isValidUrl(item.thumb) || !isValidUrl(item.url)) return;
        const wrap = document.createElement('div');
        wrap.className = 'sticker-item-wrapper';
        const img = document.createElement('img');
        img.src = escapeHtml(item.thumb);
        img.className = 'sticker-thumb';
        img.loading = "lazy";
        img.onclick = () => { sendSticker(item.url); stickerPanel.classList.add('hidden'); };
        const btn = document.createElement('button');
        btn.className = `fav-action-btn ${myFavorites.has(item.url) ? 'is-fav' : ''}`;
        btn.innerHTML = '★';
        btn.onclick = (e) => { e.stopPropagation(); toggleFavoriteSticker(item.url, btn, wrap); };
        wrap.append(img, btn);
        stickerResults.appendChild(wrap);
    });
}

async function toggleFavoriteSticker(url, btn, wrap) {
    if (!isValidUrl(url)) return;
    const isFav = myFavorites.has(url);
    const endpoint = isFav ? '/api/messages/favorites/remove' : '/api/messages/favorites/add';
    const res = await apiRequest(endpoint, 'POST', { url });
    if (res) {
        isFav ? myFavorites.delete(url) : myFavorites.add(url);
        if (btn) btn.classList.toggle('is-fav', !isFav);
        if (isFav && currentStickerTab === 'favorites' && wrap) wrap.remove();
    }
}

const sendSticker = (url) => {
    if (isValidUrl(url)) { sendMessage(url, 'sticker', currentReplyId); clearReply(); }
};

const toggleStickerModal = (show, url = null) => {
    const modal = getEl('stickerOptionsModal');
    modal.classList.toggle('hidden', !show);
    if (show && url && isValidUrl(url)) {
        currentStickerUrlInModal = url;
        getEl('stickerModalPreview').src = escapeHtml(url);
        const isFav = myFavorites.has(url);
        getEl('stickerFavIcon').textContent = isFav ? '★' : '☆';
        getEl('stickerFavText').textContent = isFav ? 'Eliminar de favoritos' : 'Añadir a favoritos';
        getEl('btnStickerFavAction').classList.toggle('is-favorite', isFav);
    } else currentStickerUrlInModal = null;
};
getEl('stickerModalBackdrop')?.addEventListener('click', () => toggleStickerModal(false));
getEl('btnStickerClose')?.addEventListener('click', () => toggleStickerModal(false));
getEl('btnStickerFavAction')?.addEventListener('click', async () => {
    if (currentStickerUrlInModal) {
        await toggleFavoriteSticker(currentStickerUrlInModal, null, null);
        toggleStickerModal(true, currentStickerUrlInModal);
        setTimeout(() => toggleStickerModal(false), 200);
    }
});
function openStickerOptions(url) { toggleStickerModal(true, url); }


// Prevent blur when clicking/touching outside input (keep keyboard open)
function preventInputBlur(e) {
    if (inputMsg && document.activeElement === inputMsg) {
        // Allow scrolling in the messages area and clicking interactive elements
        if (e.target.closest('.chat-main, button, a, input, textarea, [contenteditable], .interactive, .reply-preview')) return;
        e.preventDefault();
    }
}
document.addEventListener('mousedown', preventInputBlur);
document.addEventListener('touchstart', preventInputBlur, { passive: false });

function setReply(msgId, content, type, ownerId, forceName = null) {
    if (isEditing) {
        cancelEditing();
    }
    currentReplyId = msgId;
    let name = forceName;
    if (!name) {
        if (ownerId && myUser && String(ownerId) === String(myUser.id)) {
            name = "Tú";
        } else {
            // Try resolving from nicknames or user cache
            const user = allUsersCache.find(u => u.userId == ownerId);
            name = myNicknames[ownerId] || (user ? (user.display_name || user.username) : null);

            // If not found, check if it's a channel
            if (!name && typeof myChannels !== 'undefined') {
                const channel = myChannels.find(c => c.id == ownerId || 'c_' + c.id == ownerId);
                if (channel) name = channel.name;
            }

            if (!name) name = "Usuario";
        }
    }
    replyToName.textContent = escapeHtml(name);
    replyToImagePreview.classList.add('hidden');
    replyToImagePreview.style.backgroundImage = 'none';

    if (type === 'image') {
        replyToText.innerHTML = ICONS.replyImage;
        if (isValidUrl(content)) {
            replyToImagePreview.style.backgroundImage = `url('${escapeHtml(content)}')`;
            replyToImagePreview.classList.remove('hidden');
        }
    } else if (type === 'sticker') {
        if (isValidUrl(content)) replyToText.innerHTML = `<img src="${escapeHtml(content)}" class="reply-sticker-preview">`;
        else replyToText.innerHTML = "Sticker";
    } else if (type === 'audio') {
        replyToText.innerHTML = ICONS.replyAudio;
    } else {
        replyToText.textContent = content;
    }
    if (replyCloseTimer) clearTimeout(replyCloseTimer);
    replyPreview.classList.remove('hidden');
    replyPreview.classList.remove('reply-closing');
    getEl('inputStack')?.classList.add('active');

    // Focus immediately + force keyboard on mobile
    // On Android, focus() on an already-focused element is a no-op,
    // so blur first to force the keyboard to reappear
    if (inputMsg) {
        if (document.activeElement === inputMsg) {
            inputMsg.blur();
        }
        requestAnimationFrame(() => {
            inputMsg.focus();
        });
    }
}

function clearReply() {
    const preview = document.getElementById('replyPreview');
    if (!preview || preview.classList.contains('hidden')) return;

    currentReplyId = null;
    getEl('inputStack')?.classList.remove('active');

    // Smooth exit using class
    preview.classList.add('reply-closing');

    if (replyCloseTimer) clearTimeout(replyCloseTimer);

    // Wait for animation to finish (300ms matches CSS animation duration)
    replyCloseTimer = setTimeout(() => {
        preview.classList.add('hidden');
        preview.classList.remove('reply-closing');
        replyCloseTimer = null;
    }, 300);
}
const closeReplyBtn = getEl('closeReplyBtn');
if (closeReplyBtn) {
    const handleCloseReply = (e) => {
        // Prevent default behavior to stop focus stealing/blurring on mobile
        if (e.cancelable && e.type !== 'click') e.preventDefault();
        e.stopPropagation();

        clearReply();

        // Force focus back to input
        if (inputMsg) {
            inputMsg.focus();
            // Double check focus after a minimal delay just in case
            setTimeout(() => inputMsg.focus(), 10);
        }
    };

    closeReplyBtn.addEventListener('click', handleCloseReply);
    // Add touchstart listener with passive: false to allow preventDefault
    closeReplyBtn.addEventListener('touchstart', handleCloseReply, { passive: false });
    closeReplyBtn.addEventListener('mousedown', (e) => e.preventDefault());
}
btnImage.addEventListener('click', () => chatImageInput.click());
getEl('acceptVerifiedBtn').addEventListener('click', () => getEl('verificationSuccessModal').classList.add('hidden'));


socket.on('users', (users) => {
    allUsersCache = users;
    localStorage.setItem('cachedUsers', JSON.stringify(users));

    if (currentTargetUserId && !currentTargetUserObj?.isChannel) {
        const updated = users.find(u => u.userId === currentTargetUserId);
        if (updated) {
            currentTargetUserObj = updated;
            updateChatHeaderInfo(updated);
            if (myUser.is_admin) {
                const verifyBtn = document.getElementById('toggleVerifyBtn');
                if (verifyBtn) verifyBtn.textContent = updated.is_verified ? "Quitar Verificado" : "Verificar Usuario";

                const premBtn = document.getElementById('togglePremiumBtn');
                if (premBtn) premBtn.textContent = updated.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";
            }
        }
    }


    const me = users.find(u => u.userId === myUser.id);
    if (me) {
        if (!myUser.is_verified && me.is_verified) {
            document.getElementById('verificationSuccessModal').classList.remove('hidden');
        }
        myUser.is_verified = me.is_verified;
        myUser.is_premium = me.is_premium;
        myUser.is_admin = me.is_admin;
        myUser.avatar = me.avatar;
        localStorage.setItem('chatUser', JSON.stringify(myUser));
    }
    renderMixedSidebar();
});



socket.on('user_updated_profile', ({ userId, avatar }) => {
    const u = allUsersCache.find(x => x.userId == userId);
    if (avatar && !isValidUrl(avatar)) avatar = null;
    if (u) u.avatar = avatar;
    if (myUser.id == userId) {
        myUser.avatar = avatar;
        localStorage.setItem('chatUser', JSON.stringify(myUser));
        updateMyAvatarUI(avatar);
    }
    let safeAvatar = '/profile.png';
    if (avatar && isValidUrl(avatar)) safeAvatar = avatar;
    const sbItem = document.querySelector(`.user-item[data-uid="${userId}"] .u-avatar`);
    if (sbItem) sbItem.style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;
    if (currentTargetUserId == userId) {
        currentTargetUserObj.avatar = avatar;
        const { style: newStyle, html: newHtml } = renderAvatarContent(currentTargetUserObj, 'header-avatar');
        currentChatAvatar.style = newStyle;
        currentChatAvatar.innerHTML = newHtml;
    }
    document.querySelectorAll(`.message.${myUser.id == userId ? 'me' : 'other'} .audio-avatar-img`).forEach(img => img.src = avatar || '/profile.png');
});

async function selectUser(target, elem) {
    if (fabNewChat) fabNewChat.classList.add('hidden');
    if (loveNotesBtn) loveNotesBtn.classList.add('hidden');

    lastDetailedTimestamp = null;
    lastMessageUserId = null;

    typingIndicator.classList.add('hidden');
    typingText.textContent = '';
    if (scrollToBottomBtn) scrollToBottomBtn.classList.add('hidden');

    currentTargetUserId = target.userId;
    currentTargetUserObj = target;

    // Reset unread count
    if (target.unread > 0) {
        target.unread = 0;
        localStorage.setItem('cachedUsers', JSON.stringify(allUsersCache));
        // Force sidebar update to remove badge
        renderMixedSidebar();
    }

    currentChatType = target.chat_type || 'private';

    clearReply();
    updateChatHeaderInfo(target);
    chatContainer.classList.add('mobile-chat-active');

    const { style: chatAvatarStyle, html: chatAvatarHtml } = renderAvatarContent(target, 'header-avatar');
    currentChatAvatar.style = chatAvatarStyle;
    currentChatAvatar.innerHTML = chatAvatarHtml;

    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    (elem || document.querySelector(`.user-item[data-uid="${target.userId}"]`))?.classList.add('active');
    emptyState.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    messagesList.classList.remove('hidden');
    chatForm.classList.remove('hidden');

    const savedDraft = localStorage.getItem(`draft_${target.userId}`) || '';
    inputMsg.value = savedDraft;

    inputMsg.style.height = 'auto';
    inputMsg.style.height = (inputMsg.scrollHeight > 45 ? inputMsg.scrollHeight : 45) + 'px';

    updateButtonState();

    inputMsg.style.height = '45px';

    // Reset Pagination
    oldestMessageId = null;
    allHistoryLoaded = false;
    isLoadingHistory = false;

    let history;
    if (window.messagesCache && window.messagesCache.private && window.messagesCache.private[target.userId]) {
        // Use cached messages
        history = window.messagesCache.private[target.userId];
        // After using, delete from cache so subsequent opens fetch fresh if needed, or keep it?
        // Let's delete it so it only applies on the first open. Fast login experience.
        delete window.messagesCache.private[target.userId];
        messagesList.innerHTML = '';
    } else {
        messagesList.innerHTML = '<li style="text-align:center;color:#666;font-size:12px;margin-top:20px;">Cargando historial...</li>';
        messagesList.classList.add('loading-history');
        // Fetch latest 50
        history = await apiRequest(`/api/messages/messages/${myUser.id}/${target.userId}?limit=50`);
        messagesList.innerHTML = '';
    }

    if (history && history.length > 0) {
        // Set oldest ID for next pagination
        oldestMessageId = history[0].id;
        if (history.length < 50) allHistoryLoaded = true;

        history.forEach(msg => {
            let rd = null;
            if (msg.reply_to_id) {
                let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
                let rContent = msg.reply_content;
                if (msg.reply_type === 'image') rContent = ICONS.replyImage;
                else if (msg.reply_type === 'audio') rContent = ICONS.replyAudio;
                rd = { id: msg.reply_to_id, username: rName, content: rContent, type: msg.reply_type };
            }
            let fixedDate = msg.timestamp;
            if (typeof fixedDate === 'string' && fixedDate.includes(' ')) {
                fixedDate = fixedDate.replace(' ', 'T') + 'Z';
            }

            appendMessageUI(
                msg.content,
                msg.from_user_id === myUser.id ? 'me' : 'other',
                fixedDate,
                msg.id,
                msg.type,
                rd,
                msg.is_deleted,
                msg.caption,
                msg.is_edited,
                msg.from_user_id,
                msg.username
            );
        });

        void messagesList.offsetWidth;
        requestAnimationFrame(() => messagesList.classList.remove('loading-history'));

        scrollToBottom(false, true);
        socket.emit('mark messages read', { senderId: target.userId });
        setTimeout(() => scrollToBottom(false, true), 200);

    } else {
        messagesList.classList.remove('loading-history');
        allHistoryLoaded = true;
        if (!history) {
            messagesList.innerHTML = '<li style="text-align:center;color:#ef4444;margin-top:20px;">Error cargando mensajes</li>';
        } else {
            // No messages history
            // messagesList.innerHTML = '<li style="text-align:center;color:#666;margin-top:20px;">No hay mensajes aún</li>';
        }
    }
    checkAndLoadPinnedMessage(target.userId);

    // Attach scroll listener for lazy loading
    // DELAY to prevent immediate triggering during initial render/scroll
    setTimeout(() => {
        setupScrollListener();
    }, 1000);
}

// Pagination Globals
let oldestMessageId = null;
let isLoadingHistory = false;
let allHistoryLoaded = false;

function setupScrollListener() {
    const scrollContainer = messagesList.parentNode; // .chat-main
    scrollContainer.onscroll = () => {
        if (scrollContainer.scrollTop < 50 && !isLoadingHistory && !allHistoryLoaded) {
            loadMoreMessages();
        }
    };
}

async function loadMoreMessages() {
    if (isLoadingHistory || allHistoryLoaded || !currentTargetUserId) return;
    isLoadingHistory = true;

    // Save scroll reference
    const scrollContainer = messagesList.parentNode;

    // Determine API URL
    let url = '';
    if (currentChatType === 'channel') {
        const channelId = currentTargetUserId.startsWith('c_') ? currentTargetUserId.substring(2) : currentTargetUserId;
        url = `/api/channels/channel-messages/${channelId}?limit=50&beforeId=${oldestMessageId}`;
    } else {
        url = `/api/messages/messages/${myUser.id}/${currentTargetUserId}?limit=50&beforeId=${oldestMessageId}`;
    }

    const prevLoader = document.createElement('div');
    prevLoader.className = 'history-loader';
    prevLoader.innerHTML = '<div class="spinner"></div>'; // You might need CSS for this
    messagesList.prepend(prevLoader);

    try {
        const olderMessages = await apiRequest(url);
        prevLoader.remove();

        if (olderMessages && olderMessages.length > 0) {
            oldestMessageId = olderMessages[0].id; // Update pointer
            if (olderMessages.length < 50) allHistoryLoaded = true;

            // CAPTURE SCROLL HERE (Right before insertion)
            // This ensures we account for any user movement while waiting for API
            const oldScrollHeight = scrollContainer.scrollHeight;
            const oldScrollTop = scrollContainer.scrollTop;

            // Prepend Messages Logic
            prependMessageBatch(olderMessages);

            // Restore scroll position
            const newScrollHeight = scrollContainer.scrollHeight;
            scrollContainer.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;

        } else {
            allHistoryLoaded = true;
        }
    } catch (e) {
        console.error("Error loading more messages", e);
        prevLoader.remove();
    } finally {
        isLoadingHistory = false;
    }
}
backBtn.addEventListener('click', () => {
    chatContainer.classList.remove('mobile-chat-active');

    // Clear active chat variables to stop "read" events
    currentTargetUserId = null;
    currentTargetUserObj = null;
    currentChatType = null;

    document.body.classList.remove('theme-love', 'theme-space');

    if (fabNewChat) fabNewChat.classList.remove('hidden');

    if (loveNotesBtn && myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    }
});
async function checkAndLoadPinnedMessage(targetUserId) {
    hidePinnedBar();

    const localPinData = localStorage.getItem(`pinned_local_${myUser.id}_${targetUserId}`);
    if (localPinData) {
        try {
            const { messageId, content, type } = JSON.parse(localPinData);
            currentPinnedMessageId = messageId;
            showPinnedBar(content, type);
            return;
        } catch (e) {
            localStorage.removeItem(`pinned_local_${myUser.id}_${targetUserId}`);
        }
    }

    try {
        const res = await apiRequest(`/api/messages/pinned-message/${targetUserId}`);
        if (res && res.found) {
            currentPinnedMessageId = res.messageId;
            showPinnedBar(res.content, res.type);
        }
    } catch (e) {
        console.error("Error cargando fijado:", e);
    }
}





inputMsg.addEventListener('input', () => {
    updateButtonState();
    if (currentTargetUserId) socket.emit('typing', { toUserId: currentTargetUserId });
});

inputMsg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {

        e.preventDefault();
        mainActionBtn.click();
    }
});

mainActionBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isEditing) {
        const newText = inputMsg.innerText.trim();
        if (newText.length > 0 && currentEditingId) {
            socket.emit('edit message', {
                messageId: currentEditingId,
                newContent: newText,
                toUserId: currentTargetUserId
            });
            cancelEditing();
        }
        return;
    }
    if (isRecording) return stopRecording();


    const text = getInputContent();
    if (text.length > 0) {
        sendMessage(text, 'text', currentReplyId);


        clearInput();
        inputMsg.style.height = '45px';
        inputMsg.focus();
        clearReply();
        socket.emit('stop typing', { toUserId: currentTargetUserId });

        localStorage.removeItem(`draft_${currentTargetUserId}`);

        updateButtonState();
    } else {
        startRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            if (shouldSendAudio) {
                const fd = new FormData();
                fd.append('audio', new Blob(audioChunks, { type: 'audio/webm' }), 'recording.webm');
                const data = await apiRequest('/api/upload-audio', 'POST', fd);
                if (data) { sendMessage(data.audioUrl, 'audio', currentReplyId); clearReply(); }
            }
            stream.getTracks().forEach(t => t.stop());
        };
        isRecording = true; shouldSendAudio = true;
        getEl('inputStack').classList.add('recording'); recordingUI.classList.remove('hidden'); updateButtonState();
        let s = 0; recordingTimer.innerText = "0:00";
        recordingInterval = setInterval(() => { s++; recordingTimer.innerText = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }, 1000);
        mediaRecorder.start();
    } catch (e) { alert("Sin acceso al micrófono"); }
}

function stopRecording() { if (mediaRecorder?.state !== 'inactive') { mediaRecorder.stop(); resetRecordingUI(); } }
getEl('cancelRecordingBtn').addEventListener('click', () => { shouldSendAudio = false; stopRecording(); });
function resetRecordingUI() { isRecording = false; clearInterval(recordingInterval); getEl('inputStack').classList.remove('recording'); recordingUI.classList.add('hidden'); updateButtonState(); }


function sendMessage(content, type, replyId = null) {
    if (!currentTargetUserId) return;
    if ((type === 'image' || type === 'sticker') && !isValidUrl(content)) { return alert("Error de seguridad"); }
    socket.emit('private message', { content, toUserId: currentTargetUserId, type, replyToId: replyId }, (res) => {
        if (res?.id) {
            // FIX: Add id: replyId to replyData object so click-to-scroll works
            let rd = replyId ? { id: replyId, username: replyToName.textContent, content: replyToText.innerHTML, type: type } : null;

            // Update the temporary message with real ID and status
            const tempRow = document.getElementById(`row-temp-${tempId}`);
            if (tempRow) {
                tempRow.id = `row-${res.id}`;
                const contentWrapper = tempRow.querySelector('.message-content-wrapper');
                contentWrapper.id = `msg-${res.id}`;
                const icon = tempRow.querySelector('.status-icon');
                if (icon) icon.className = 'status-icon status-sent';
            }
        }
    });

    // Optimistic UI Append
    let rd = replyId ? { id: replyId, username: replyToName.textContent, content: replyToText.innerHTML, type: type } : null;
    let tempId = Date.now();
    appendMessageUI(content, 'me', new Date(), `temp-${tempId}`, type, rd, 0, null, 0, myUser.id, "Tú", 'sending');
    messagesList.scrollTop = messagesList.scrollHeight;
    scrollToBottom(true);

    // Optimistic Sidebar Update
    updateSidebarWithNewMessage(
        String(currentTargetUserId).startsWith('c_') ? currentTargetUserId : currentTargetUserId,
        content,
        type,
        new Date()
    );
}

socket.on('private message', (msg) => {
    console.log('[DEBUG] Received private message:', msg);
    // Immediately mark as delivered since we received it via socket
    socket.emit('mark messages delivered', { senderId: msg.fromUserId });

    if (currentTargetUserId === msg.fromUserId) {

        const scrollContainer = messagesList.parentNode;

        const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;

        let rd = null;
        if (msg.replyToId) {
            let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
            let rText = msg.reply_content;
            if (msg.reply_type === 'image') rText = ICONS.replyImage;
            else if (msg.reply_type === 'sticker') rText = "✨ Sticker";
            else if (msg.reply_type === 'audio') rText = ICONS.replyAudio || "Mensaje de voz";
            // FIX: Add id: msg.replyToId
            rd = { id: msg.replyToId, username: rName, content: rText, type: msg.reply_type };
        }


        appendMessageUI(msg.content, 'other', msg.timestamp, msg.id, msg.type || 'text', rd, 0, msg.caption, 0, msg.fromUserId, msg.username, msg.status);
        socket.emit('mark messages read', { senderId: msg.fromUserId });


        if (isAtBottom) {
            scrollToBottom(true);
        }
    }

    // Update sidebar for incoming message
    // If it's a private message, fromUserId is the other person.
    // If it is a channel message (which comes via 'channel_message' event, not this one usually), we handle there.
    // But 'private message' event is also used for DM.

    updateSidebarWithNewMessage(msg.fromUserId, msg.content, msg.type, msg.timestamp);

});

socket.on('messages delivered', ({ toUserId }) => {
    console.log('[DEBUG] messages delivered event for user:', toUserId);
    // I am the sender, my messages to toUserId are now delivered
    // Update UI for all 'sent' messages to 'received'
    if (currentTargetUserId == toUserId) {
        document.querySelectorAll('.message-row.me').forEach(row => {
            const icon = row.querySelector('.status-icon');
            if (icon && icon.classList.contains('status-sent')) {
                icon.className = 'status-icon status-received';
            }
        });
    }
});

socket.on('messages read', ({ toUserId }) => {
    console.log('[DEBUG] messages read event for user:', toUserId);
    // I am the sender, my messages to toUserId are now read
    // Update UI for all unread messages
    if (currentTargetUserId == toUserId) {
        document.querySelectorAll('.message-row.me').forEach(row => {
            const icon = row.querySelector('.status-icon');
            // Update anything that isn't already read
            // Note: A 'received' message should also become 'read'
            if (icon && !icon.classList.contains('status-read')) {
                icon.className = 'status-icon status-read';
            }
        });
    }
});

// Recalculate sequence classes for all visible messages
let isRecalcPending = false;
function recalcSequenceClasses() {
    if (isRecalcPending) return;
    isRecalcPending = true;

    requestAnimationFrame(() => {
        console.log("[RECALC] recalcSequenceClasses called via rAF");
        const rows = messagesList.querySelectorAll('.message-row');
        let prevSenderId = null;
        let prevTimestamp = null;
        let seqGroup = [];

        function flushSeqGroup() {
            if (seqGroup.length === 0) return;
            if (seqGroup.length === 1) {
                const r = seqGroup[0];
                r.classList.remove('seq-top', 'seq-middle', 'seq-bottom');
            } else {
                seqGroup.forEach((row, i) => {
                    row.classList.remove('seq-top', 'seq-middle', 'seq-bottom');
                    if (i === 0) row.classList.add('seq-top');
                    else if (i === seqGroup.length - 1) row.classList.add('seq-bottom');
                    else row.classList.add('seq-middle');
                });
            }
            seqGroup = [];
        }

        rows.forEach(row => {
            if (row.classList.contains('date-divider')) {
                flushSeqGroup();
                prevSenderId = null;
                prevTimestamp = null;
                return;
            }

            // Skip deleted messages
            const wrapper = row.querySelector('.message-content-wrapper');
            if (wrapper && wrapper.classList.contains('deleted-msg')) {
                flushSeqGroup();
                prevSenderId = null;
                prevTimestamp = null;
                return;
            }

            const senderId = row.dataset.senderId;
            const timestamp = parseInt(row.dataset.timestamp) || 0;
            const isSameSender = prevSenderId !== null && String(prevSenderId) === String(senderId);

            // Update new-sender class
            if (isSameSender) {
                row.classList.remove('new-sender');
            } else {
                row.classList.add('new-sender');
            }

            // Update rapid-sequence class
            const wasRapid = row.classList.contains('rapid-sequence');
            const isRapid = isSameSender && prevTimestamp && (timestamp - prevTimestamp) < 60000;

            if (isRapid) {
                row.classList.add('rapid-sequence');
            } else {
                row.classList.remove('rapid-sequence');
            }

            // Optimized animation trigger without forced reflow
            if (wasRapid && !isRapid) {
                const msgEl = row.querySelector('.message');
                if (msgEl) {
                    msgEl.classList.remove('seq-updated');
                    // Use double rAF to trigger animation instead of void offsetWidth
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            msgEl.classList.add('seq-updated');
                        });
                    });
                    msgEl.addEventListener('animationend', () => msgEl.classList.remove('seq-updated'), { once: true });
                }
            }

            // Build sequence groups for seq-top/middle/bottom
            if (isSameSender) {
                if (seqGroup.length === 0 && row.previousElementSibling) {
                    // Add the previous row as seq-top if applicable
                    let prev = row.previousElementSibling;
                    while (prev && prev.classList.contains('date-divider')) prev = prev.previousElementSibling;
                    if (prev && prev.classList.contains('message-row') && String(prev.dataset.senderId) === String(senderId)) {
                        seqGroup.push(prev);
                    }
                }
                seqGroup.push(row);
            } else {
                flushSeqGroup();
            }

            prevSenderId = senderId;
            prevTimestamp = timestamp;
        });

        flushSeqGroup();
        isRecalcPending = false;
    });
}

socket.on('message deleted', ({ messageId }) => {
    console.log(`[SOCKET] DELETE EVENT. ID: ${messageId}, Type: ${typeof messageId}`);

    // Check user status
    const isAdmin = myUser && myUser.is_admin;
    console.log(`[SOCKET] User Admin Status: ${isAdmin}`);

    // Try finding elements
    const rowId = `row-${messageId}`;
    const wrapId = `msg-${messageId}`;
    const row = document.getElementById(rowId);
    const contentWrap = document.getElementById(wrapId);

    console.log(`[SOCKET] Elements found? Row: ${!!row} (#${rowId}), Wrap: ${!!contentWrap} (#${wrapId})`);

    // --- SIDEBAR UPDATE LOGIC ---
    if (row) updateSidebarPreviewAfterDeletion(row, messageId);
    else if (contentWrap) {
        const parentRow = contentWrap.closest('.message-row');
        if (parentRow) updateSidebarPreviewAfterDeletion(parentRow, messageId);
    }

    if (false) { // DISABLE OLD LOGIC
        // If the deleted message is the last one in the current view, update the sidebar preview.
        try {
            if (currentTargetUserId) {
                // Find the actual last message row (ignoring date dividers if any)
                let lastRow = messagesList.lastElementChild;
                // Iterate backwards to find a message row, skipping non-message rows
                while (lastRow && (!lastRow.classList.contains('message-row') || lastRow.classList.contains('date-divider'))) {
                    lastRow = lastRow.previousElementSibling;
                }

                // Check if the found lastRow is the one being deleted
                // The row being deleted might be 'lastRow' if it hasn't been removed yet
                // Or it might be 'contentWrap' inside 'lastRow'
                const isDeletingLast = lastRow && (lastRow.id === rowId || (contentWrap && lastRow.contains(contentWrap)));

                if (isDeletingLast) {
                    console.log("[SOCKET] Deleted message was the last one. Finding new last message...");

                    // Find the NEW last message (the one before the deleted one)
                    let newLastRow = lastRow.previousElementSibling;
                    while (newLastRow && (!newLastRow.classList.contains('message-row') || newLastRow.classList.contains('date-divider'))) {
                        newLastRow = newLastRow.previousElementSibling;
                    }

                    let newPreview = '';
                    let newTime = null;

                    if (newLastRow) {
                        // Extract content from newLastRow
                        if (newLastRow.querySelector('.chat-image')) {
                            newPreview = '📷 Foto';
                        } else if (newLastRow.querySelector('.sticker-img')) {
                            newPreview = '✨ Sticker';
                        } else if (newLastRow.querySelector('.custom-audio-player')) {
                            newPreview = '🎤 Audio';
                        } else {
                            // Text content
                            // Clone to avoid modifying DOM
                            const inner = newLastRow.querySelector('.message-inner');
                            if (inner) {
                                const clone = inner.cloneNode(true);
                                // Remove meta (time, ticks)
                                const meta = clone.querySelector('.meta-row');
                                if (meta) meta.remove();
                                // Remove quoted message if any
                                const quote = clone.querySelector('.quoted-message');
                                if (quote) quote.remove();

                                newPreview = clone.innerText.trim();
                            }
                        }

                        // Try to get timestamp
                        if (newLastRow.dataset.timestamp) {
                            newTime = parseInt(newLastRow.dataset.timestamp);
                        }
                    } else {
                        // No more messages
                        newPreview = '';
                    }

                    console.log(`[SOCKET] New sidebar preview: "${newPreview}"`);

                    if (currentChatType === 'channel') {
                        // Channel Logic
                        const actualId = currentTargetUserId.startsWith('c_') ? currentTargetUserId.substring(2) : currentTargetUserId;
                        const ch = myChannels.find(c => c.id == actualId);
                        if (ch) {
                            ch.last_message = newPreview;
                            if (newTime) ch.last_message_time = newTime;
                            renderMixedSidebar();
                        }
                    } else {
                        // Direct Message Logic
                        const u = allUsersCache.find(x => x.userId == currentTargetUserId);
                        if (u) {
                            u.lastMessage = newPreview;
                            if (newTime) u.lastMessageTime = newTime;
                            renderMixedSidebar();
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[SOCKET] Error updating sidebar:", err);
        }
    } // END DISABLED OLD LOGIC
    // -----------------------------

    if (!messageId) return;

    if (isAdmin) {
        console.log("[SOCKET] Processing as ADMIN (Marking as deleted)");
        if (contentWrap) {
            if (!contentWrap.classList.contains('deleted-msg')) {
                contentWrap.classList.add('deleted-msg');
                contentWrap.style.cssText = 'border:1px dashed #ef4444; opacity:0.7';
                contentWrap.insertAdjacentHTML('afterbegin', `<div style="color:#ef4444;font-size:10px;font-weight:bold;margin-bottom:4px;">🚫 ELIMINADO</div>`);
                console.log("[SOCKET] Marked as deleted successfully");
                recalcSequenceClasses();
            } else {
                console.log("[SOCKET] Already marked as deleted");
            }
        } else {
            console.warn("[SOCKET] Could not find content wrapper to mark as deleted");
        }
    } else {
        console.log("[SOCKET] Processing as USER (Removing)");
        if (row) {
            row.style.cssText = "opacity:0; transition: opacity 0.3s; transform: scale(0.9);";
            setTimeout(() => {
                row.remove();
                recalcSequenceClasses();
                console.log("[SOCKET] Row removed from DOM");
            }, 300);
        } else if (contentWrap) {
            console.log("[SOCKET] Fallback: Removing via wrapper parent");
            const parentRow = contentWrap.closest('.message-row');
            if (parentRow) {
                parentRow.style.cssText = "opacity:0; transition: opacity 0.3s; transform: scale(0.9);";
                setTimeout(() => { parentRow.remove(); recalcSequenceClasses(); }, 300);
            } else {
                console.warn("[SOCKET] Could not find parent row via wrapper");
            }
        } else {
            console.warn("[SOCKET] Element not found for removal");
        }
    }
});


function formatPreviewHTML(content, type) {
    if (type === 'image') return '📷 Foto';
    if (type === 'sticker') return '✨ Sticker';
    if (type === 'audio') return '🎤 Audio';

    if (!content || typeof content !== 'string') return '';

    // Replace emoji placeholders with img tags
    const emojiRegex = /\[emoji:(.*?)\]/g;
    const processedContent = content.replace(emojiRegex, (match, url) => {
        return `<img src="${escapeHtml(url)}" crossorigin="anonymous" class="preview-emoji" style="width: 18px; height: 18px; vertical-align: middle; display: inline-block; margin: 0 1px;">`;
    });

    // Escape any remaining HTML that's not our emoji images
    // We need to be careful here - split by our emoji images, escape the text parts, then rejoin
    return processedContent;
}


function linkify(text) {
    if (!text) return "";


    let safeText = escapeHtml(text);


    const apMeRegex = /(?:https?:\/\/)?(?:www\.)?ap\.me\/(\+[a-f0-9]+|[a-zA-Z0-9_]{3,})/gi;

    safeText = safeText.replace(apMeRegex, (match, identifier) => {

        return `<a href="/${identifier}" class="app-link" data-identifier="${identifier}">${match}</a>`;
    });




    const urlRegex = /(https?:\/\/[^\s<]+)/g;

    safeText = safeText.replace(urlRegex, (match) => {











        return match;
    });



    return safeText;
}



function appendMessageUI(content, ownerType, dateStr, msgId, msgType = 'text', replyData = null, isDeleted = 0, caption = null, isEdited = 0, senderId = null, senderName = null, status = 'sent', container = messagesList, skipDateDivider = false, extraClass = '') {
    if (!skipDateDivider) renderDateDivider(dateStr, container);

    if (currentChatType === 'channel') {
        ownerType = 'other';
    }


    const currentUserId = ownerType === 'me' ? myUser.id : currentTargetUserId;

    // FIX: Ensure senderName is "Tú" if it's me
    if (ownerType === 'me' || (senderId && myUser && String(senderId) === String(myUser.id))) {
        senderName = 'Tú';
    }
    const isSequence = lastMessageUserId !== null && String(lastMessageUserId) === String(currentUserId);

    // START CHANGE: Check time sequence
    let isRapidSequence = false;
    const currentMsgDate = new Date(dateStr);

    if (isSequence && lastDetailedTimestamp) {
        const timeDiff = currentMsgDate - lastDetailedTimestamp;
        // If less than 60 seconds (60000ms)
        if (timeDiff < 60000) {
            isRapidSequence = true;
        }
    }

    const li = document.createElement('li');
    li.className = `message-row ${ownerType} ${extraClass}`;
    if (!isSequence) li.classList.add('new-sender'); // Add spacing for new sender
    if (isRapidSequence) li.classList.add('rapid-sequence');
    if (msgType === 'sticker') li.classList.add('sticker-wrapper');
    li.id = `row-${msgId}`;
    li.dataset.senderId = senderId || (ownerType === 'me' ? myUser.id : currentTargetUserId);
    if (senderName) li.dataset.senderName = senderName;


    let innerLayoutClass = '';

    if (msgType === 'text') {

        const visualContent = content.replace(/\[emoji:(.*?)\]/g, "xx");

        if (visualContent.length < 30 && !content.includes('\n')) {
            innerLayoutClass = 'row-align';
        }
    }

    let bodyHtml = '';


    let isSingleEmoji = false;
    let processedContent = content;

    if (msgType === 'text') {
        const emojiRegex = /\[emoji:(.*?)\]/g;
        const singleMatch = content.trim().match(/^\[emoji:(.*?)\]$/);

        if (singleMatch) {
            isSingleEmoji = true;
            li.classList.add('sticker-wrapper');
            layoutClass = 'layout-col';
            const url = singleMatch[1];
            bodyHtml = `
                <div class="skeleton-wrapper emoji-skeleton-large">
                    <img src="${escapeHtml(url)}" 
                         crossorigin="anonymous"
                         class="animated-emoji-sticker hidden-media" 
                         data-original="${escapeHtml(url)}"
                         loading="lazy" 
                         decoding="async">
                </div>`;
        } else {
            const parts = content.split(emojiRegex);

            let finalHtml = '';
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i % 2 === 0) {

                    if (part) finalHtml += linkify(part);
                } else {
                    finalHtml += `<img src="${escapeHtml(part)}" crossorigin="anonymous" class="inline-emoji" data-original="${escapeHtml(part)}" decoding="async">`;
                }
            }
            bodyHtml = `<span>${finalHtml}</span>`;
        }
    } else if (msgType === 'audio') {
        if (!isValidUrl(content)) return;
        const uid = `audio-${msgId}-${Date.now()}`;
        let avatarUrl = ownerType === 'me' ? (myUser.avatar || '/profile.png') : (currentTargetUserObj.avatar || '/profile.png');
        if (!isValidUrl(avatarUrl)) avatarUrl = '/profile.png';
        const safeAudioSrc = escapeHtml(content);
        const safeAvatarSrc = escapeHtml(avatarUrl);
        bodyHtml = `<div class="custom-audio-player"><img src="${safeAvatarSrc}" class="audio-avatar-img"><audio id="${uid}" src="${safeAudioSrc}" preload="metadata"></audio><button class="audio-control-btn" id="btn-${uid}">${ICONS.play}</button><div class="audio-right-col"><div class="audio-slider-container"><div class="waveform-bg"></div><div class="waveform-fill" id="fill-${uid}"></div><input type="range" class="audio-slider" id="slider-${uid}" value="0" step="0.1"></div><div class="audio-meta-row"><span class="audio-duration" id="time-${uid}">0:00</span><span class="audio-msg-time">${new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div></div>`;
        setTimeout(() => initAudioPlayer(uid), 0);
    } else if (msgType === 'image') {
        const safeCaption = caption ? escapeHtml(caption) : '';
        const captionHtml = caption ? `<div style="padding: 8px 4px 4px; color: #fff; font-size: 14px; overflow-wrap: anywhere; word-break: break-word; white-space: pre-wrap; line-height: 1.4;">${safeCaption}</div>` : '';
        const safeSrc = isValidUrl(content) ? escapeHtml(content) : '';
        if (safeSrc) bodyHtml = `<div class="chat-image-container skeleton-wrapper image-skeleton"><img src="${safeSrc}" class="chat-image hidden-media" loading="lazy"></div>${captionHtml}`;
        else bodyHtml = `<div style="color:red; font-size:12px;">[Imagen inválida]</div>`;
    } else if (msgType === 'sticker') {
        const safeSrc = isValidUrl(content) ? escapeHtml(content) : '';
        if (safeSrc) bodyHtml = `<div class="skeleton-wrapper sticker-skeleton"><img src="${safeSrc}" class="sticker-img hidden-media" data-url="${safeSrc}"></div>`;
        else bodyHtml = `<div style="color:red; font-size:12px;">[Sticker inválido]</div>`;
    } else if (msgType === 'sticker') {
        const safeSrc = isValidUrl(content) ? escapeHtml(content) : '';
        if (safeSrc) bodyHtml = `<div class="skeleton-wrapper sticker-skeleton"><img src="${safeSrc}" class="sticker-img hidden-media" data-url="${safeSrc}"></div>`;
        else bodyHtml = `<div style="color:red; font-size:12px;">[Sticker inválido]</div>`;
    } else {

        if (!bodyHtml) bodyHtml = `<span>${linkify(content)}</span>`;
    }

    li.dataset.timestamp = new Date(dateStr).getTime();
    const editedHtml = isEdited ? '<span class="edited-label">editado</span>' : '';

    let statusClass = 'status-sent';
    if (status === 'sending') statusClass = 'status-sending';
    else if (status === 'received') statusClass = 'status-received';
    else if (status === 'read') statusClass = 'status-read';

    const statusHtml = ownerType === 'me' ? `<span class="status-icon ${statusClass}"></span>` : '';
    const meta = msgType !== 'audio' ?
        `<div class="meta-row">${editedHtml}<span class="meta">${new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${statusHtml}</div>`
        : '';

    const isStickerWithReply = (msgType === 'sticker' && replyData !== null);


    const stickerBubbleClass = isStickerWithReply ? 'sticker-reply-bubble' : '';

    const safeReplyName = replyData ? escapeHtml(replyData.username) : '';
    const safeReplyText = replyData ? (replyData.type === 'text' || !replyData.type ? escapeHtml(replyData.content) : replyData.content) : '';

    // START CHANGE: Add data-reply-id and styling class
    const quoteHtml = replyData ? `<div class="quoted-message" data-reply-id="${replyData.id || ''}"><div class="quoted-name">${safeReplyName}</div><div class="quoted-text">${safeReplyText}</div></div>` : '';
    const deletedLabel = isDeleted ? `<div style="color:#ef4444;font-size:10px;font-weight:bold;margin-bottom:4px;">🚫 ELIMINADO</div>` : '';

    li.innerHTML = `
        <div class="swipe-reply-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></div>
        
        <div class="message-content-wrapper message ${ownerType} ${isDeleted ? 'deleted-msg' : ''} ${msgType === 'image' ? 'msg-image-wrapper' : ''} ${stickerBubbleClass} layout-col" id="msg-${msgId}" ${isDeleted ? 'style="border:1px dashed #ef4444;opacity:0.7"' : ''}>
            ${deletedLabel}${quoteHtml}
            <div class="message-inner ${innerLayoutClass}">
                ${bodyHtml}${meta}
            </div>
        </div>`;

    container.appendChild(li);

    // Click handler for reply scrolling
    if (replyData && replyData.id) {
        const quoteEl = li.querySelector('.quoted-message');
        if (quoteEl) {
            quoteEl.style.cursor = "pointer";
            quoteEl.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const targetMsg = document.getElementById(`msg-${replyData.id}`);
                if (targetMsg) {
                    targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add highlight animation
                    targetMsg.classList.add('highlight-reply-target');
                    setTimeout(() => targetMsg.classList.remove('highlight-reply-target'), 2000);
                } else {
                    if (window.showToast) window.showToast("El mensaje original no está cargado");
                }
            });
        }
    }



    if (isSequence) {
        const prevLi = li.previousElementSibling;

        if (prevLi && prevLi.classList.contains('message-row') && !prevLi.classList.contains('date-divider')) {
            prevLi.classList.remove('seq-bottom');
            if (prevLi.classList.contains('seq-top')) {
                prevLi.classList.add('seq-middle');
                prevLi.classList.remove('seq-top');
            } else {
                prevLi.classList.add('seq-top');
            }

            li.classList.add('seq-bottom');
        }
    }



    lastMessageUserId = currentUserId;
    lastDetailedTimestamp = currentMsgDate;


    if (msgType === 'sticker' && isValidUrl(content)) {
        li.querySelector('.sticker-img').addEventListener('click', (e) => { e.stopPropagation(); myFavorites.size ? openStickerOptions(content) : refreshFavoritesCache().then(() => openStickerOptions(content)); });
    }


    const mediaImg = li.querySelector('.chat-image, .sticker-img');
    if (mediaImg) {
        mediaImg.addEventListener('load', function () {
            this.classList.remove('hidden-media');
            this.classList.add('visible-media');
            this.parentElement.classList.remove('image-skeleton', 'skeleton-wrapper', 'sticker-skeleton');
        });
        if (msgType === 'image') {
            mediaImg.addEventListener('click', () => viewFullImage(mediaImg.src));
        }
    }
    const wrapper = li.querySelector('.message-content-wrapper');

    const isPreview = extraClass.includes('preview-msg') || (container && container.id === 'chatProfilePreviewMessages');

    if (!isPreview) {
        addLongPressEvent(wrapper, msgId);
        // Use the senderId stored in dataset (or calculated above) to ensure groups work correctly
        addSwipeEvent(li, wrapper, msgId, content, msgType, li.dataset.senderId);
    }


    if (msgType === 'text') {

        const inlineEmojis = li.querySelectorAll('.inline-emoji');
        inlineEmojis.forEach(img => {

            if (img.complete) freezeImage(img);
            else img.onload = () => freezeImage(img);
        });


        const stickerEmoji = li.querySelector('.animated-emoji-sticker');
        if (stickerEmoji) {

            playAnimationOnce(stickerEmoji);


            stickerEmoji.addEventListener('click', (e) => {
                e.stopPropagation();
                playAnimationOnce(stickerEmoji);
            });
        }
    }
}

window.viewFullImage = (src) => {
    if (!src) return;

    // Create modal container
    const m = document.createElement('div');
    m.className = 'fullscreen-img-modal';

    // Create image element
    const img = document.createElement('img');
    img.src = escapeHtml(src);
    img.className = 'fullscreen-img';

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullscreen-close-btn';
    closeBtn.innerHTML = '&times;'; // Standard X character or use an icon if preferred

    // Close on click outside (backdrop)
    m.onclick = (e) => {
        if (e.target === m) m.remove();
    };

    // Close on button click
    closeBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent triggering backdrop click
        m.remove();
    };

    // Close on Escape key
    const escListener = (e) => {
        if (e.key === 'Escape') {
            m.remove();
            document.removeEventListener('keydown', escListener);
        }
    };
    document.addEventListener('keydown', escListener);

    // Assemble
    m.appendChild(img);
    m.appendChild(closeBtn);
    document.body.appendChild(m);
};


function addSwipeEvent(row, wrap, msgId, content, type, ownerId) {
    const icon = row.querySelector('.swipe-reply-icon');
    let startX = 0, currentX = 0, isSwiping = false;
    let rafId = null;

    wrap.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = 0; // Reset for new gesture
        isSwiping = true;
        wrap.style.transition = 'none';
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const diff = e.touches[0].clientX - startX;

        // Only allow right swipe and limit distance
        if (diff > 0 && diff < 150) {
            currentX = diff;

            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                wrap.style.transform = `translate3d(${diff}px, 0, 0)`;
                const p = Math.min(diff / 70, 1);
                icon.style.opacity = p;
                icon.style.transform = `translate3d(0, -50%, 0) scale(${0.5 + p * 0.5})`;
                icon.style.left = '10px';
            });
        }
    }, { passive: true });

    const end = () => {
        if (!isSwiping) return;
        isSwiping = false;
        if (rafId) cancelAnimationFrame(rafId);

        requestAnimationFrame(() => {
            wrap.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
            icon.style.transition = 'all 0.2s';

            if (currentX >= 70) {
                if (navigator.vibrate) navigator.vibrate(30);
                let currentId = msgId;
                if (wrap.id && wrap.id.startsWith('msg-')) currentId = wrap.id.substring(4);
                setReply(currentId, content, type, ownerId);
                // Focus immediately in gesture context so keyboard opens reliably
                if (inputMsg) inputMsg.focus();
            }

            wrap.style.transform = 'translate3d(0, 0, 0)';
            icon.style.opacity = '0';
        });
    };

    wrap.addEventListener('touchend', end);
    wrap.addEventListener('touchcancel', end);
}
function addLongPressEvent(el, msgId) {
    let timer;

    const start = (e) => {

        if (el.style.transform && el.style.transform !== 'translateX(0px)') return;

        el.classList.add('pressing');
        const cx = e.clientX || e.touches[0].clientX;
        const cy = e.clientY || e.touches[0].clientY;

        // FIX: Get current ID from element to avoid stale temp ID
        let currentId = msgId;
        if (el.id && el.id.startsWith('msg-')) {
            currentId = el.id.substring(4); // Remove 'msg-'
        } else if (el.closest('.message-row')) {
            const row = el.closest('.message-row');
            if (row.id && row.id.startsWith('row-')) {
                currentId = row.id.substring(4);
            }
        }

        timer = setTimeout(() => openContextMenu(cx, cy, currentId), 600);
    };

    const cancel = () => {
        clearTimeout(timer);
        el.classList.remove('pressing');
    };

    el.addEventListener('mousedown', (e) => { if (e.button === 0) start(e); });


    ['mouseup', 'mouseleave', 'touchend'].forEach(ev => el.addEventListener(ev, cancel));


    el.addEventListener('touchmove', cancel, { passive: true });

    el.addEventListener('touchstart', start, { passive: true });
}




window.closeContextMenu = () => {
    msgContextMenu.classList.add('hidden');
    currentContextMessageId = null;
    messageIdToDelete = null;
};
getEl('contextMenuBackdrop')?.addEventListener('click', closeContextMenu);


function openContextMenu(x, y, msgId) {
    currentContextMessageId = msgId;
    messageIdToDelete = msgId;

    const menu = msgContextMenu.querySelector('.context-menu-content');
    msgContextMenu.classList.remove('hidden');

    const msgEl = document.getElementById(`row-${msgId}`);
    const msgDiv = document.getElementById(`msg-${msgId}`);

    const isMyMessage = msgDiv ? msgDiv.classList.contains('me') : false;

    const isDeleted = msgDiv ? (msgDiv.classList.contains('deleted-msg') || msgDiv.querySelector('.deleted-label') !== null) : false;

    const isAdmin = myUser && myUser.is_admin;

    const btnEdit = document.getElementById('ctxEditBtn');
    if (btnEdit) {
        if (msgEl && isMyMessage && !isDeleted) {
            const msgTime = parseInt(msgEl.dataset.timestamp || 0);
            const now = Date.now();

            const hoursDiff = (now - msgTime) / (1000 * 60 * 60);

            if (hoursDiff < 24) {
                btnEdit.style.display = 'flex';
            } else {
                btnEdit.style.display = 'none';
            }
        } else {
            btnEdit.style.display = 'none';
        }
    }


    const btnEveryone = document.getElementById('btnDeleteEveryone');
    if (btnEveryone) {
        if (isMyMessage || isAdmin) {
            btnEveryone.style.display = 'flex';
        } else {
            btnEveryone.style.display = 'none';
        }
    }


    let top = y;
    let left = x;

    if (y > window.innerHeight - 250) top = y - 200;
    if (x > window.innerWidth - 220) left = window.innerWidth - 230;

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}




getEl('ctxReplyBtn').addEventListener('click', () => {
    const msgEl = document.getElementById(`msg-${currentContextMessageId}`);
    if (msgEl) {

        const clone = msgEl.cloneNode(true);
        const garbage = clone.querySelectorAll('.meta, .meta-row, .quoted-message, .deleted-label, .audio-meta-row, .swipe-reply-icon');
        garbage.forEach(el => el.remove());

        let content = clone.innerText.trim();
        let type = 'text';


        if (msgEl.querySelector('.chat-image')) {
            content = msgEl.querySelector('.chat-image').src;
            type = 'image';
        } else if (msgEl.querySelector('.sticker-img')) {
            content = msgEl.querySelector('.sticker-img').src;
            type = 'sticker';
        }

        // CORRECTION: The dataset attributes are on the row (li), not the wrapper (div)
        const rowEl = document.getElementById(`row-${currentContextMessageId}`);
        const senderId = rowEl ? (rowEl.dataset.senderId || 'unknown') : 'unknown';
        const senderName = rowEl ? (rowEl.dataset.senderName || null) : null;

        setReply(currentContextMessageId, content, type, senderId, senderName);
    }
    closeContextMenu();
});



getEl('ctxCopyBtn').addEventListener('click', async () => {
    if (!currentContextMessageId) return;

    const msgEl = document.getElementById(`msg-${currentContextMessageId}`);
    if (msgEl) {
        let textToCopy = "";

        const clone = msgEl.cloneNode(true);

        const unwanted = clone.querySelectorAll('.meta-row, .quoted-message, .deleted-label, .audio-meta-row');
        unwanted.forEach(el => el.remove());

        textToCopy = clone.innerText.trim();

        try {
            await navigator.clipboard.writeText(textToCopy);

            showToast("Mensaje copiado");

        } catch (err) {
            console.error('Error al copiar:', err);
            showToast("Error al copiar");
        }
    }
    closeContextMenu();
});

getEl('ctxDeleteBtn').addEventListener('click', () => {
    const idToSave = currentContextMessageId;
    closeContextMenu();

    messageIdToDelete = idToSave;
    deleteActionType = 'single';

    document.querySelector('#deleteConfirmModal h3').textContent = "¿Eliminar mensaje?";
    document.querySelector('#deleteConfirmModal p').textContent = "Elige cómo quieres borrar este mensaje.";

    getEl('deleteConfirmModal').classList.remove('hidden');
});



window.closeDeleteModal = () => {
    getEl('deleteConfirmModal').classList.add('hidden');
};
getEl('deleteModalBackdrop')?.addEventListener('click', closeDeleteModal);
getEl('btnCancelDelete')?.addEventListener('click', closeDeleteModal);


function removeMessageFromUI(msgId) {
    // Intenta encontrar por fila completa primero
    let row = document.getElementById(`row-${msgId}`);

    // SIDEBAR UPDATE: Call before removing
    if (row) {
        updateSidebarPreviewAfterDeletion(row, msgId);
    } else {
        // Try to find via wrapper if row not found directly (though unlikely for valid rows)
        const contentWrap = document.getElementById(`msg-${msgId}`);
        if (contentWrap) {
            const parentRow = contentWrap.closest('.message-row');
            if (parentRow) updateSidebarPreviewAfterDeletion(parentRow, msgId);
        }
    }

    // Fallback: intentar encontrar por wrapper de contenido
    if (!row) {
        const contentWrap = document.getElementById(`msg-${msgId}`);
        if (contentWrap) {
            row = contentWrap.closest('.message-row');
        }
    }

    if (row) {
        row.classList.add('removing');
        row.addEventListener('transitionend', () => row.remove(), { once: true });
        // Backup timeout in case transitionend fails
        setTimeout(() => { if (row.parentNode) row.remove(); }, 350);
    } else {
        console.warn("[UI] No se pudo encontrar el elemento para eliminar:", msgId);
    }
}


getEl('btnDeleteEveryone').addEventListener('click', () => {
    if (!currentTargetUserId) return closeDeleteModal();

    if (deleteActionType === 'single' && messageIdToDelete) {
        socket.emit('delete message', {
            messageId: messageIdToDelete,
            toUserId: currentTargetUserId,
            deleteType: 'everyone'
        });
        removeMessageFromUI(messageIdToDelete);

    } else if (deleteActionType === 'clear' || deleteActionType === 'delete_chat') {
        socket.emit('clear chat history', {
            toUserId: currentTargetUserId,
            deleteType: 'everyone'
        });




        if (deleteActionType === 'delete_chat') {
            performExitChat();
        }
    }
    closeDeleteModal();
});


getEl('btnDeleteMe').addEventListener('click', () => {
    if (!currentTargetUserId) return closeDeleteModal();

    if (deleteActionType === 'single' && messageIdToDelete) {

        socket.emit('delete message', {
            messageId: messageIdToDelete,
            toUserId: currentTargetUserId,
            deleteType: 'me'
        });
        removeMessageFromUI(messageIdToDelete);

    } else if (deleteActionType === 'clear' || deleteActionType === 'delete_chat') {

        socket.emit('clear chat history', {
            toUserId: currentTargetUserId,
            deleteType: 'me'
        });


        document.getElementById('messages').innerHTML = '';


        if (deleteActionType === 'delete_chat') {
            performExitChat();
        }
    }
    closeDeleteModal();
});


function performExitChat() {

    const userItem = document.querySelector(`.user-item[data-uid="${currentTargetUserId}"]`);
    if (userItem) userItem.remove();


    document.querySelector('.chat-container').classList.remove('mobile-chat-active');
    document.querySelector('.chat-header').classList.add('hidden');
    document.querySelector('.messages').classList.add('hidden');
    document.querySelector('.composer').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');

    if (fabNewChat) fabNewChat.classList.remove('hidden');


    if (loveNotesBtn && myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    }


    currentTargetUserId = null;
    currentTargetUserObj = null;
}

// FIX: Ensure back button clears currentTargetUserId to prevent premature read receipts
if (backBtn) {
    backBtn.addEventListener('click', (e) => {
        performExitChat();
    });
}


socket.on('typing', ({ fromUserId, username }) => {

    if (fromUserId === currentTargetUserId) {


        if (currentChatType === 'private') {

            typingText.textContent = "Escribiendo...";
        } else if (currentChatType === 'group') {

            const name = escapeHtml(myNicknames[fromUserId] || username);
            typingText.textContent = `${name} está escribiendo...`;
        } else if (currentChatType === 'channel') {

            typingText.textContent = "Escribiendo...";
        } else {

            typingText.textContent = "Escribiendo...";
        }

        typingIndicator.classList.remove('hidden');
    }
});
socket.on('stop typing', ({ fromUserId }) => { if (fromUserId === currentTargetUserId) typingIndicator.classList.add('hidden'); });
inputMsg.addEventListener('input', () => {

    inputMsg.style.height = 'auto';
    inputMsg.style.height = inputMsg.scrollHeight + 'px';
    const isScroll = inputMsg.scrollHeight >= 120;
    inputMsg.classList.toggle('scroll-active', isScroll);
    inputMsg.style.overflowY = isScroll ? 'auto' : 'hidden';


    updateButtonState();


    if (currentTargetUserId) {
        emitTypingThrottled(currentTargetUserId);
        localStorage.setItem(`draft_${currentTargetUserId}`, inputMsg.value);
    }
});

const emitTypingThrottled = throttle((userId) => {
    socket.emit('typing', { toUserId: userId });
}, 2000);
inputMsg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (inputMsg.value.trim().length) mainActionBtn.click(); } });


const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authError = document.getElementById('authError');
const installBtn = document.getElementById('installBtn');

if (loginForm) {
    if (localStorage.getItem('chatUser')) { }
    tabLogin.addEventListener('click', () => { tabLogin.classList.add('active'); tabRegister.classList.remove('active'); loginForm.classList.remove('hidden'); registerForm.classList.add('hidden'); authError.textContent = ''; });
    tabRegister.addEventListener('click', () => { tabRegister.classList.add('active'); tabLogin.classList.remove('active'); registerForm.classList.remove('hidden'); loginForm.classList.add('hidden'); authError.textContent = ''; });
    loginForm.addEventListener('submit', async (e) => { e.preventDefault(); const username = document.getElementById('loginUser').value; const password = document.getElementById('loginPass').value; try { const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const data = await res.json(); if (res.ok) { localStorage.setItem('chatUser', JSON.stringify(data.user)); window.location.href = '/'; } else { authError.textContent = data.error; } } catch (e) { authError.textContent = "Error de conexión"; } });
    registerForm.addEventListener('submit', async (e) => { e.preventDefault(); const username = document.getElementById('regUser').value; const password = document.getElementById('regPass').value; try { const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); if (res.ok) { alert('Registrado con éxito.'); tabLogin.click(); } else { const data = await res.json(); authError.textContent = data.error; } } catch (e) { authError.textContent = "Error"; } });
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (installBtn) installBtn.classList.remove('hidden'); });
if (installBtn) { installBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; installBtn.classList.add('hidden'); } }); }

const toggleVerifyBtn = document.getElementById('toggleVerifyBtn');

if (toggleVerifyBtn) {
    toggleVerifyBtn.addEventListener('click', async () => {

        if (!currentTargetUserObj || !currentTargetUserId) return;


        const previousState = currentTargetUserObj.is_verified;



        currentTargetUserObj.is_verified = !currentTargetUserObj.is_verified;


        toggleVerifyBtn.textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";


        const modalNameEl = document.getElementById('contactInfoName');
        const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;
        if (modalNameEl) {
            modalNameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        }


        updateChatHeaderInfo(currentTargetUserObj);


        try {
            const res = await apiRequest('/api/admin/toggle-verify', 'POST', {
                targetUserId: currentTargetUserObj.userId
            });


            if (!res || !res.success) {
                throw new Error("Error en servidor");
            }
        } catch (error) {
            console.error(error);

            currentTargetUserObj.is_verified = previousState;
            updateChatHeaderInfo(currentTargetUserObj);
            toggleVerifyBtn.textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
            alert("No se pudo actualizar la verificación. Revisa tu conexión.");
        }
    });
}
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function initAudioPlayer(uid) {
    const audio = document.getElementById(uid);
    const btn = document.getElementById(`btn-${uid}`);
    const slider = document.getElementById(`slider-${uid}`);
    const fill = document.getElementById(`fill-${uid}`);
    const timeDisplay = document.getElementById(`time-${uid}`);

    if (!audio || !btn || !slider) return;


    audio.addEventListener('loadedmetadata', () => {
        slider.max = audio.duration;
        timeDisplay.textContent = formatTime(audio.duration);
    });


    if (audio.readyState >= 1) {
        slider.max = audio.duration;
        timeDisplay.textContent = formatTime(audio.duration);
    }


    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audio.paused) {

            document.querySelectorAll('audio').forEach(a => {
                if (a !== audio && !a.paused) {
                    a.pause();

                    const otherBtn = document.getElementById(`btn-${a.id}`);
                    if (otherBtn) otherBtn.innerHTML = ICONS.play;
                }
            });
            audio.play();
            btn.innerHTML = ICONS.pause;
        } else {
            audio.pause();
            btn.innerHTML = ICONS.play;
        }
    });


    audio.addEventListener('timeupdate', () => {
        slider.value = audio.currentTime;
        const percent = (audio.currentTime / audio.duration) * 100;
        fill.style.width = `${percent}%`;



        const remaining = audio.duration - audio.currentTime;
        timeDisplay.textContent = formatTime(remaining);
    });


    slider.addEventListener('input', () => {
        audio.currentTime = slider.value;
        const percent = (slider.value / audio.duration) * 100;
        fill.style.width = `${percent}%`;
    });


    audio.addEventListener('ended', () => {
        btn.innerHTML = ICONS.play;
        fill.style.width = '0%';
        slider.value = 0;
        timeDisplay.textContent = formatTime(audio.duration);
    });


    audio.addEventListener('pause', () => {
        btn.innerHTML = ICONS.play;
    });

    audio.addEventListener('play', () => {
        btn.innerHTML = ICONS.pause;
    });
}

let lastMessageDate = null;
let lastMessageUserId = null;

const chatScrollPositions = {};

function scrollToBottom(smooth = true, initialLoad = false) {
    const scrollContainer = messagesList.parentNode;
    const isNative = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);

    requestAnimationFrame(() => {
        if (initialLoad && typeof currentTargetUserId !== 'undefined' && currentTargetUserId && typeof chatScrollPositions[currentTargetUserId] !== 'undefined') {
            const distanceToBottom = chatScrollPositions[currentTargetUserId];

            if (distanceToBottom < 50) {
                if (isNative) {
                    const lastMessage = messagesList.lastElementChild;
                    if (lastMessage) {
                        lastMessage.scrollIntoView({ behavior: 'auto', block: 'end' });
                        return;
                    }
                }
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            } else {
                let newScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight - distanceToBottom;
                if (newScrollTop < 0) newScrollTop = 0;
                scrollContainer.scrollTop = newScrollTop;
            }
            return;
        }

        if (isNative) {
            const lastMessage = messagesList.lastElementChild;
            if (lastMessage) {
                lastMessage.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
            } else {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        } else {
            if (smooth) {
                scrollContainer.scrollTo({
                    top: scrollContainer.scrollHeight,
                    behavior: 'smooth'
                });
            } else {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    });
}




function renderDateDivider(dateStr, container = messagesList) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label = date.toLocaleDateString();


    if (date.toDateString() === today.toDateString()) label = "Hoy";
    else if (date.toDateString() === yesterday.toDateString()) label = "Ayer";


    if (lastMessageDate !== label) {
        const li = document.createElement('li');
        li.className = 'date-divider';
        li.innerHTML = `<span>${label}</span>`;
        container.appendChild(li);

        if (container === messagesList) {
            lastMessageDate = label;
            lastMessageUserId = null;
        }
    }
}



const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');

const chatScrollContainer = document.querySelector('.chat-main');

if (scrollToBottomBtn && chatScrollContainer) {


    let isScrolling = false;
    chatScrollContainer.addEventListener('scroll', () => {
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                const distanceToBottom = chatScrollContainer.scrollHeight - chatScrollContainer.scrollTop - chatScrollContainer.clientHeight;

                if (typeof currentTargetUserId !== 'undefined' && currentTargetUserId) {
                    chatScrollPositions[currentTargetUserId] = distanceToBottom;
                }

                if (distanceToBottom > 300) {
                    scrollToBottomBtn.classList.remove('hidden');
                } else {
                    scrollToBottomBtn.classList.add('hidden');
                }

                isScrolling = false;
            });
            isScrolling = true;
        }
    }, { passive: true });


    scrollToBottomBtn.addEventListener('click', () => {
        chatScrollContainer.scrollTo({
            top: chatScrollContainer.scrollHeight,
            behavior: 'smooth'
        });
    });
}

function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;


    const toast = document.createElement('div');
    toast.className = 'toast';


    toast.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${message}</span>
    `;


    container.appendChild(toast);


    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}


const chatMenuBtn = document.getElementById('chatMenuBtn');
const chatOptionsMenu = document.getElementById('chatOptionsMenu');
const chatSearchBar = document.getElementById('chatSearchBar');
const chatSearchInput = document.getElementById('chatSearchInput');
const closeChatSearch = document.getElementById('closeChatSearch');
const searchCount = document.getElementById('searchCount');
const wallpaperInput = document.getElementById('wallpaperInput');


if (chatMenuBtn) {
    chatMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chatOptionsMenu.classList.toggle('hidden');
    });
}


document.addEventListener('click', (e) => {
    if (chatOptionsMenu && !chatOptionsMenu.classList.contains('hidden')) {
        if (!chatOptionsMenu.contains(e.target) && !chatMenuBtn.contains(e.target)) {
            chatOptionsMenu.classList.add('hidden');
        }
    }
});


document.getElementById('optSearch').addEventListener('click', () => {
    chatOptionsMenu.classList.add('hidden');
    chatSearchBar.classList.remove('hidden');
    chatSearchInput.value = '';
    chatSearchInput.focus();
});

closeChatSearch.addEventListener('click', () => {
    chatSearchBar.classList.add('hidden');
    clearSearchHighlights();
});



let searchMatches = [];
let searchCurrentIndex = -1;


const searchUpBtn = document.getElementById('searchUpBtn');
const searchDownBtn = document.getElementById('searchDownBtn');


chatSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();


    clearSearchHighlights();
    searchMatches = [];
    searchCurrentIndex = -1;

    if (term.length < 2) {
        searchCount.textContent = "";
        toggleSearchNav(false);
        return;
    }


    const messages = document.querySelectorAll('.message-content-wrapper span');

    messages.forEach(span => {

        if (span.closest('.meta-row') || span.classList.contains('meta')) return;

        const text = span.textContent;
        if (text.toLowerCase().includes(term)) {

            const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');


            span.innerHTML = text.replace(regex, '<span class="highlight-text">$1</span>');
        }
    });


    searchMatches = Array.from(document.querySelectorAll('.highlight-text'));

    if (searchMatches.length > 0) {
        toggleSearchNav(true);


        searchCurrentIndex = searchMatches.length - 1;
        updateSearchUI();
    } else {
        searchCount.textContent = "0 res.";
        toggleSearchNav(false);
    }
});


searchUpBtn.addEventListener('click', () => navigateSearch(-1));
searchDownBtn.addEventListener('click', () => navigateSearch(1));

function navigateSearch(direction) {
    if (searchMatches.length === 0) return;

    searchCurrentIndex += direction;


    if (searchCurrentIndex < 0) searchCurrentIndex = searchMatches.length - 1;
    if (searchCurrentIndex >= searchMatches.length) searchCurrentIndex = 0;

    updateSearchUI();
}

function updateSearchUI() {


    searchCount.textContent = `${searchCurrentIndex + 1} de ${searchMatches.length}`;


    searchMatches.forEach(m => m.classList.remove('active-match'));
    document.querySelectorAll('.message-flash').forEach(m => m.classList.remove('message-flash'));


    const currentEl = searchMatches[searchCurrentIndex];
    if (currentEl) {
        currentEl.classList.add('active-match');


        const messageBubble = currentEl.closest('.message-content-wrapper');
        if (messageBubble) {

            messageBubble.classList.remove('message-flash');
            void messageBubble.offsetWidth;
            messageBubble.classList.add('message-flash');


            messageBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function toggleSearchNav(show) {

    searchUpBtn.disabled = !show;
    searchDownBtn.disabled = !show;
    searchUpBtn.style.opacity = show ? 1 : 0.5;
    searchDownBtn.style.opacity = show ? 1 : 0.5;
}


function clearSearchHighlights() {
    document.querySelectorAll('.highlight-text').forEach(mark => {
        const parent = mark.parentNode;


        if (parent) {
            parent.textContent = parent.textContent;
            parent.normalize();
        }
    });


    document.querySelectorAll('.message-flash').forEach(m => m.classList.remove('message-flash'));
}


closeChatSearch.addEventListener('click', () => {
    chatSearchBar.classList.add('hidden');
    chatSearchInput.value = '';
    clearSearchHighlights();
});




const themeModal = document.getElementById('themeModal');



document.getElementById('optWallpaper').addEventListener('click', () => {
    chatOptionsMenu.classList.add('hidden');
    themeModal.classList.remove('hidden');
});


document.getElementById('closeThemeBtn').addEventListener('click', () => {
    themeModal.classList.add('hidden');
});

themeModal.addEventListener('click', (e) => {
    if (e.target === themeModal) themeModal.classList.add('hidden');
});


window.selectTheme = function (themeName) {
    if (!currentTargetUserId) return;


    const config = { type: 'preset', value: themeName };
    localStorage.setItem(`theme_config_${currentTargetUserId}`, JSON.stringify(config));


    applyThemeConfig(config);


    updateActiveThemeUI(themeName);



};


document.getElementById('btnGalleryTheme').addEventListener('click', () => {
    wallpaperInput.click();
});

wallpaperInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        if (currentTargetUserId) {
            const base64 = evt.target.result;

            const config = { type: 'image', value: base64 };
            localStorage.setItem(`theme_config_${currentTargetUserId}`, JSON.stringify(config));

            applyThemeConfig(config);
            themeModal.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});


function applyThemeConfig(config) {
    const mainColumn = document.querySelector('.main-column');
    const chatMain = document.querySelector('.chat-main');
    const body = document.body;


    mainColumn.classList.remove('theme-love', 'theme-space');
    body.classList.remove('theme-love', 'theme-space');


    chatMain.style.backgroundImage = '';

    if (!config) return;

    if (config.type === 'image') {

        chatMain.style.backgroundImage = `url('${config.value}')`;
        chatMain.style.backgroundSize = 'cover';
        chatMain.style.backgroundPosition = 'center';
    }
    else if (config.type === 'preset') {
        if (config.value === 'love') {
            mainColumn.classList.add('theme-love');
            body.classList.add('theme-love');
        } else if (config.value === 'space') {
            mainColumn.classList.add('theme-space');
            body.classList.add('theme-space');
        }
    }
}


function updateActiveThemeUI(activeTheme) {
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));

    if (activeTheme === 'love') document.querySelector('.theme-option:nth-child(2)').classList.add('active');
    else if (activeTheme === 'space') document.querySelector('.theme-option:nth-child(3)').classList.add('active');
    else document.querySelector('.theme-option:nth-child(1)').classList.add('active');
}




const originalSelectUserFn = selectUser;
selectUser = async function (target, elem) {

    await originalSelectUserFn(target, elem);


    const savedConfig = localStorage.getItem(`theme_config_${target.userId}`);
    if (savedConfig) {
        try {
            applyThemeConfig(JSON.parse(savedConfig));
        } catch (e) {
            applyThemeConfig(null);
        }
    } else {

        const oldBg = localStorage.getItem(`bg_${target.userId}`);
        if (oldBg) {
            applyThemeConfig({ type: 'image', value: oldBg });
        } else {
            applyThemeConfig(null);
        }
    }
};


document.getElementById('optClearChat').addEventListener('click', () => {
    chatOptionsMenu.classList.add('hidden');


    deleteActionType = 'clear';
    messageIdToDelete = null;


    document.querySelector('#deleteConfirmModal h3').textContent = "¿Vaciar chat?";
    document.querySelector('#deleteConfirmModal p').textContent = "Los mensajes se borrarán permanentemente.";


    document.getElementById('deleteConfirmModal').classList.remove('hidden');
});


document.getElementById('optDeleteChat').addEventListener('click', () => {
    chatOptionsMenu.classList.add('hidden');


    deleteActionType = 'delete_chat';
    messageIdToDelete = null;


    document.querySelector('#deleteConfirmModal h3').textContent = "¿Eliminar chat?";
    document.querySelector('#deleteConfirmModal p').textContent = "¿Borrar chat y salir? Esta acción no se puede deshacer.";


    document.getElementById('deleteConfirmModal').classList.remove('hidden');
});
let messageIdToPin = null;
let currentPinnedMessageId = null;



const ctxPinBtn = document.getElementById('ctxPinBtn');
if (ctxPinBtn) {
    ctxPinBtn.addEventListener('click', () => {

        messageIdToPin = currentContextMessageId;
        closeContextMenu();


        document.getElementById('pinConfirmModal').classList.remove('hidden');
    });
}


window.closePinModal = () => {
    document.getElementById('pinConfirmModal').classList.add('hidden');
    messageIdToPin = null;
};

document.getElementById('btnPinEveryone').addEventListener('click', () => {
    if (!messageIdToPin || !currentTargetUserId) return;

    socket.emit('pin message', {
        messageId: messageIdToPin,
        toUserId: currentTargetUserId,
        type: 'everyone'
    });

    closePinModal();
});


document.getElementById('btnPinMe').addEventListener('click', () => {
    if (!messageIdToPin || !currentTargetUserId) return;

    const msgEl = document.getElementById(`msg-${messageIdToPin}`);
    if (msgEl) {
        const clone = msgEl.cloneNode(true);
        const garbage = clone.querySelectorAll('.meta, .meta-row, .quoted-message, .deleted-label, .audio-meta-row, .swipe-reply-icon');
        garbage.forEach(el => el.remove());

        let type = 'text';
        if (clone.querySelector('.chat-image')) type = 'image';
        else if (clone.querySelector('.sticker-img')) type = 'sticker';
        else if (clone.querySelector('audio')) type = 'audio';

        let text = clone.innerText.trim();
        if (!text && type !== 'text') text = "";

        const pinData = { messageId: messageIdToPin, content: text, type: type };
        localStorage.setItem(`pinned_local_${myUser.id}_${currentTargetUserId}`, JSON.stringify(pinData));

        currentPinnedMessageId = messageIdToPin;
        showPinnedBar(text, type);
    }
    closePinModal();
});

document.getElementById('unpinBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentTargetUserId) return;

    localStorage.removeItem(`pinned_local_${myUser.id}_${currentTargetUserId}`);

    socket.emit('pin message', {
        messageId: null,
        toUserId: currentTargetUserId,
        type: 'everyone'
    });

    hidePinnedBar();
});

document.getElementById('pinnedBarContent').addEventListener('click', () => {
    if (!currentPinnedMessageId) return;

    const msgEl = document.getElementById(`msg-${currentPinnedMessageId}`);
    if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgEl.classList.remove('message-flash');
        void msgEl.offsetWidth;
        msgEl.classList.add('message-flash');
        setTimeout(() => msgEl.classList.remove('message-flash'), 2000);
    } else {
        showToast("El mensaje fijado es antiguo y no está cargado.");
    }
});

socket.on('chat pinned update', ({ messageId, content, type }) => {
    if (!messageId) {
        hidePinnedBar();
    } else {
        currentPinnedMessageId = messageId;
        showPinnedBar(content, type);
    }
});

function showPinnedBar(content, type) {
    const bar = document.getElementById('pinnedMessageBar');
    const textEl = document.getElementById('pinnedMessageText');
    const container = document.querySelector('.chat-container');

    let previewText = content;
    if (type === 'image') previewText = '📷 Foto';
    else if (type === 'sticker') previewText = '✨ Sticker';
    else if (type === 'audio') previewText = '🎤 Mensaje de voz';

    if (previewText.startsWith('{"iv":')) previewText = "🔒 Mensaje encriptado";

    textEl.textContent = previewText;

    bar.classList.remove('hidden');
    container.classList.add('has-pinned-message');
}

function hidePinnedBar() {
    const bar = document.getElementById('pinnedMessageBar');
    const container = document.querySelector('.chat-container');

    bar.classList.add('hidden');
    container.classList.remove('has-pinned-message');
    currentPinnedMessageId = null;
}

function updatePinnedBarUI(msgId) {
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (msgEl) {
        const clone = msgEl.cloneNode(true);

        const garbage = clone.querySelectorAll('.meta, .meta-row, .quoted-message, .deleted-label, .audio-meta-row, .swipe-reply-icon');
        garbage.forEach(el => el.remove());

        let type = 'text';
        if (clone.querySelector('.chat-image')) type = 'image';
        else if (clone.querySelector('.sticker-img')) type = 'sticker';
        else if (clone.querySelector('audio')) type = 'audio';

        let cleanText = clone.innerText.trim();

        if (!cleanText && type === 'image') cleanText = "";

        currentPinnedMessageId = msgId;
        showPinnedBar(cleanText, type);
    }
}
document.getElementById('ctxEditBtn').addEventListener('click', () => {
    const msgEl = document.getElementById(`msg-${currentContextMessageId}`);
    if (!msgEl) return closeContextMenu();

    const clone = msgEl.cloneNode(true);
    const garbage = clone.querySelectorAll('.meta-row, .quoted-message, .deleted-label, .audio-meta-row, .pin-icon');
    garbage.forEach(el => el.remove());

    const textToEdit = clone.innerText.trim();

    startEditing(currentContextMessageId, textToEdit);
    closeContextMenu();
});

function startEditing(msgId, currentText) {
    isEditing = true;
    currentEditingId = msgId;

    clearReply();
    editPreview.classList.remove('hidden');
    editPreviewText.textContent = currentText;
    document.getElementById('inputStack').classList.add('active');
    inputMsg.innerText = currentText;
    inputMsg.focus();

    updateButtonState();
}

function cancelEditing() {
    isEditing = false;
    currentEditingId = null;
    editPreview.classList.add('hidden');
    document.getElementById('inputStack').classList.remove('active');
    inputMsg.innerHTML = '';
    updateButtonState();
}

closeEditBtn.addEventListener('click', cancelEditing);

function updateButtonState() {
    if (isEditing) {
        mainActionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        mainActionBtn.style.backgroundColor = "#3b82f6";
    } else {
        mainActionBtn.style.backgroundColor = "";
        const hasContent = inputMsg.innerText.trim().length > 0 || inputMsg.querySelector('img');
        mainActionBtn.innerHTML = isRecording ? ICONS.send : (hasContent ? ICONS.send : ICONS.mic);
    }
}
socket.on('message updated', ({ messageId, newContent, isEdited }) => {
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (msgEl) {
        const metaRow = msgEl.querySelector('.meta-row');
        const quote = msgEl.querySelector('.quoted-message');
        const pin = msgEl.querySelector('.pin-icon');

        msgEl.innerHTML = '';

        if (pin) msgEl.appendChild(pin);
        if (quote) msgEl.appendChild(quote);

        const textSpan = document.createElement('span');
        textSpan.textContent = newContent;
        msgEl.appendChild(textSpan);

        if (isEdited && metaRow) {
            if (!metaRow.querySelector('.edited-label')) {
                const editLabel = document.createElement('span');
                editLabel.className = 'edited-label';
                editLabel.textContent = 'editado';
                editLabel.style.marginRight = '4px';
                metaRow.prepend(editLabel);
            }
        }

        if (metaRow) msgEl.appendChild(metaRow);

        msgEl.style.animation = "highlightEdit 0.5s ease";
        setTimeout(() => msgEl.style.animation = "", 500);
    }
});
document.querySelectorAll('.sticker-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (btn.classList.contains('inactive-btn')) {
            if (navigator.vibrate) navigator.vibrate(20);
            console.log("Función no disponible aún");
        }
    });
});

const btnStickers = document.getElementById('btnStickers');

btnStickers.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isOpen = stickerPanel.classList.contains('open');

    if (isOpen) {
        closeStickerPanel();
        inputMsg.focus();
    } else {
        stickerPanel.classList.remove('hidden');
        inputMsg.blur();

        requestAnimationFrame(() => {
            stickerPanel.classList.add('open');

            setTimeout(() => {
                scrollToBottom(true);
            }, 100);
        });

        if (currentStickerTab === 'giphy') loadStickers();
        else loadFavoritesFromServer();
    }
});

inputMsg.addEventListener('focus', () => {
    if (stickerPanel.classList.contains('open')) {
        closeStickerPanel();
    }
});

function closeStickerPanel() {
    stickerPanel.classList.remove('open');
    setTimeout(() => {
        stickerPanel.classList.add('hidden');
    }, 300);
}

document.addEventListener('click', (e) => {
    if (!stickerPanel.contains(e.target) && !btnStickers.contains(e.target) && stickerPanel.classList.contains('open')) {
        if (e.target !== inputMsg) {
            closeStickerPanel();
        }
    }
});

document.querySelectorAll('.sticker-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (btn.classList.contains('inactive-btn')) {
            if (navigator.vibrate) navigator.vibrate(20);
        }
    });
});
const loveNotesBtn = document.getElementById('loveNotesBtn');
const loveNotesModal = document.getElementById('loveNotesModal');
const closeLoveNotes = document.getElementById('closeLoveNotes');
const loveNotesList = document.getElementById('loveNotesList');
const loveNoteDot = document.getElementById('loveNoteDot');

if (loveNotesBtn) {
    loveNotesBtn.addEventListener('click', async () => {
        loveNotesModal.classList.remove('hidden');
        loveNoteDot.classList.add('hidden');

        loveNotesList.innerHTML = '<div style="text-align:center; padding:20px; color:#ec4899;">Cargando mensajes...</div>';

        const notes = await apiRequest('/api/my-love-notes');

        loveNotesList.innerHTML = '';
        if (notes && notes.length > 0) {
            notes.forEach(note => {
                const div = document.createElement('div');
                div.className = 'love-note-item';
                div.innerHTML = `
                    <div class="love-note-content">${escapeHtml(note.content)}</div>
                    <span class="love-note-date">${new Date(note.timestamp).toLocaleString()}</span>
                `;
                loveNotesList.appendChild(div);
            });
        } else {
            loveNotesList.innerHTML = '<div class="love-empty">No tienes mensajes nuevos.<br>Espera a que llegue la magia ✨</div>';
        }
    });
}

if (closeLoveNotes) {
    closeLoveNotes.addEventListener('click', () => loveNotesModal.classList.add('hidden'));
}

socket.on('new_love_note', () => {
    if (myUser && myUser.is_premium) {
        loveNoteDot.classList.remove('hidden');
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        showToast("¡Tienes una nueva nota especial! 💖");
    }
});
function checkPremiumFeatures() {
    if (loveNotesBtn && myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    } else if (loveNotesBtn) {
        loveNotesBtn.classList.add('hidden');
    }
}

let creationStep = 0;
let selectedMembers = new Set();
let myChannels = [];

const fabNewChat = document.getElementById('fabNewChat');
const creationModal = document.getElementById('creationModal');
const closeCreation = document.getElementById('closeCreation');
const creationTitle = document.getElementById('creationTitle');
const creationNextBtn = document.getElementById('creationNextBtn');

const viewStart = document.getElementById('viewStart');
const viewSelectMembers = document.getElementById('viewSelectMembers');
const viewChannelInfo = document.getElementById('viewChannelInfo');

window.isAlphabeticalSort = false;
const sortContactsBtn = document.getElementById('sortContactsBtn');
const sortLabel = document.getElementById('sortLabel');

if (sortContactsBtn) {
    sortContactsBtn.addEventListener('click', () => {
        window.isAlphabeticalSort = !window.isAlphabeticalSort;
        sortContactsBtn.style.color = window.isAlphabeticalSort ? '#8b5cf6' : '#fff';

        if (sortLabel) {
            const nextText = window.isAlphabeticalSort ? 'Ordenado alfabéticamente' : 'Ordenado por última vez';
            if (sortLabel.textContent !== nextText) {
                sortLabel.classList.add('sort-label-transition', 'sort-label-hidden');

                setTimeout(() => {
                    sortLabel.textContent = nextText;
                    requestAnimationFrame(() => {
                        sortLabel.classList.remove('sort-label-hidden');
                    });
                }, 150);
            }
        }

        setTimeout(() => {
            renderStartContacts();
        }, 150);
    });
}

fabNewChat.addEventListener('click', () => {
    creationModal.classList.remove('hidden');
    resetCreationFlow();
    renderStartContacts();
});

closeCreation.addEventListener('click', () => {
    if (creationStep > 0) {
        if (creationStep === 2) goToStep(1);
        else goToStep(0);
    } else {
        creationModal.classList.add('hidden');
    }
});

function resetCreationFlow() {
    creationStep = 0;
    selectedMembers.clear();
    goToStep(0);
    document.getElementById('channelNameInput').value = '';
    document.getElementById('channelBioInput').value = '';
    document.getElementById('channelAvatarPreview').style.backgroundImage = '';
}

function goToStep(step) {
    creationStep = step;
    viewStart.classList.add('hidden');
    viewSelectMembers.classList.add('hidden');
    viewChannelInfo.classList.add('hidden');
    creationNextBtn.classList.add('hidden');

    const icon = step === 0
        ? '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        : '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
    closeCreation.innerHTML = icon;

    if (step === 0) {
        creationTitle.textContent = "Nuevo Chat";
        viewStart.classList.remove('hidden');
    } else if (step === 1) {
        creationTitle.textContent = "Añadir Miembros";
        viewSelectMembers.classList.remove('hidden');
        renderMemberSelection();
        updateNextButton();
    } else if (step === 2) {
        creationTitle.textContent = "Nuevo Canal";
        viewChannelInfo.classList.remove('hidden');
    }
}

document.getElementById('btnCreateChannel').addEventListener('click', () => {
    goToStep(1);
});

function renderStartContacts() {
    const list = document.getElementById('creationContactList');
    list.innerHTML = '';

    let contacts = [...allUsersCache].filter(u => u.userId !== myUser.id);

    if (window.isAlphabeticalSort) {
        contacts.sort((a, b) => {
            const nameA = (myNicknames[a.userId] || a.username || '').toLowerCase();
            const nameB = (myNicknames[b.userId] || b.username || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    contacts.forEach((u, index) => {
        const li = document.createElement('li');
        li.className = `chat-card user-item contact-item-animated ${!u.online ? 'offline' : ''}`;

        // Stagger animation for up to 30 items
        li.style.animationDelay = `${Math.min(index * 0.04, 1.2)}s`;

        const name = myNicknames[u.userId] || u.username;
        const { style, html } = renderAvatarContent(u, 'text-avatar');

        let subText = u.online ? 'En línea' : 'Desconectado';
        let subStyle = u.online ? 'color: var(--success); font-weight:600;' : 'color: var(--text-dim);';
        const onlineDotHtml = u.online ? '<div class="online-dot"></div>' : '';

        li.innerHTML = `
            <div class="card-avatar" style="${style}">
                ${html}
                ${onlineDotHtml}
                <div class="selection-check">✓</div>
            </div>
            <div class="card-content">
                <div class="card-top">
                    <span class="card-name">
                        ${escapeHtml(name)}${getBadgeHtml(u)}
                    </span>
                </div>
                <div class="card-msg" style="${subStyle}">
                    ${escapeHtml(subText)}
                </div>
            </div>
        `;

        li.onclick = () => { selectUser(u); creationModal.classList.add('hidden'); };
        list.appendChild(li);
    });
}

function renderMemberSelection() {
    const list = document.getElementById('memberSelectionList');
    list.innerHTML = '';

    allUsersCache.forEach(u => {
        if (u.userId === myUser.id) return;
        const li = document.createElement('li');
        li.className = `user-select-item ${selectedMembers.has(u.userId) ? 'selected' : ''}`;
        const { style, html } = renderAvatarContent(u, 'text-avatar');
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="u-avatar" style="${style}">${html}</div>
                <span>${u.display_name || u.username}</span>
            </div>
            <div class="select-circle"></div>
        `;
        li.onclick = () => {
            if (selectedMembers.has(u.userId)) selectedMembers.delete(u.userId);
            else selectedMembers.add(u.userId);
            li.classList.toggle('selected');
            updateNextButton();
        };
        list.appendChild(li);
    });
}

function updateNextButton() {
    if (selectedMembers.size > 0) {
        creationNextBtn.classList.remove('hidden');
        creationNextBtn.textContent = `Sig. (${selectedMembers.size})`;
    } else {
        creationNextBtn.classList.add('hidden');
    }
}

creationNextBtn.addEventListener('click', () => {
    if (creationStep === 1) goToStep(2);
});

async function loadMyChannels() {
    const channels = await apiRequest('/api/channels/my-channels');
    if (channels) {
        myChannels = channels;
        localStorage.setItem('cachedChannels', JSON.stringify(channels));
        renderMixedSidebar();
        checkUrlIntent();
    }
}

async function checkUrlIntent() {
    const path = window.location.pathname;
    if (path.length > 2 && (path.startsWith('/+') || /^\/[a-zA-Z0-9_]+$/.test(path))) {
        const identifier = path.substring(1);

        if (identifier === 'login' || identifier === 'admin') return;

        openChannelPreview(identifier);
    }
}

async function openChannelPreview(identifier) {
    if (!identifier) return;

    const cleanId = identifier.startsWith('/') ? identifier.substring(1) : identifier;

    const localMatch = myChannels.find(c =>
        (cleanId.startsWith('+') && c.private_hash === cleanId.substring(1)) ||
        (c.handle && c.handle.toLowerCase() === cleanId.toLowerCase())
    );

    if (localMatch) {
        openChannel(localMatch.id);
        return;
    }

    try {
        document.body.style.cursor = 'wait';
        const res = await apiRequest(`/api/channels/preview/${encodeURIComponent(cleanId)}`);
        document.body.style.cursor = 'default';

        if (res && res.success) {
            if (res.isMember) {
                await loadMyChannels();
                openChannel(res.id);
            } else {
                renderJoinModal(res);
            }
        } else {
            console.log("No encontrado o privado", cleanId);
        }
    } catch (e) {
        console.error(e);
    }
}

function openChannel(channelId) {
    const channel = myChannels.find(c => c.id == channelId);
    if (channel) {
        selectChannel(channel);
    } else {
        console.error("No se pudo abrir el canal: no encontrado en mis canales", channelId);
    }
}

window.openChannelPreview = openChannelPreview;


function renderJoinModal(channel) {
    let modal = document.getElementById('joinChannelModal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="joinChannelModal" class="modal hidden">
                <div class="modal-content join-modal-card">
                    <button id="closeJoinModal" class="close-icon-btn">&times;</button>
                    <div class="join-header">
                        <div id="joinChannelAvatar" class="join-avatar"></div>
                        <h2 id="joinChannelName" class="join-title"></h2>
                    </div>
                    <div class="join-body">
                        <p id="joinChannelCount" class="join-meta"></p>
                        <p id="joinChannelDesc" class="join-desc"></p>
                    </div>
                    <div class="join-footer">
                        <button id="btnJoinChannel" class="btn primary-btn join-btn">Unirme al canal</button>
                        <p id="joinPrivateLabel" class="join-private-label">🔒 Enlace de invitación privado</p>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('joinChannelModal');
        const closeModal = () => {
            modal.classList.add('hidden');
            window.history.pushState({}, '', '/');
        };
        document.getElementById('closeJoinModal').onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }

    const nameEl = document.getElementById('joinChannelName');
    const descEl = document.getElementById('joinChannelDesc');
    const avatarEl = document.getElementById('joinChannelAvatar');
    const countEl = document.getElementById('joinChannelCount');
    const btn = document.getElementById('btnJoinChannel');
    const privLabel = document.getElementById('joinPrivateLabel');

    btn.disabled = false;
    btn.textContent = "Unirme al canal";

    nameEl.textContent = channel.name;
    descEl.textContent = channel.description || "Sin descripción";
    countEl.textContent = `${channel.memberCount} miembros`;

    if (channel.is_public === 0) privLabel.style.display = 'block';
    else privLabel.style.display = 'none';

    const avatarUrl = resolveImageUrl(channel.avatar);
    avatarEl.style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;

    modal.classList.remove('hidden');

    btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = "Uniéndome...";

        const body = { secret: channel.private_hash || (channel.is_public ? null : '') };

        if (!body.secret && window.location.pathname.includes('/+')) {
            body.secret = window.location.pathname.split('/+')[1];
        }

        const res = await apiRequest(`/api/channels/${channel.id}/join`, 'POST', body);

        if (res && res.success) {
            modal.classList.add('hidden');
            window.history.pushState({}, '', '/');
            await loadMyChannels();
            openChannel(channel.id);
            showToast("Te has unido al canal");
        } else {
            btn.disabled = false;
            btn.textContent = "Unirme al canal";
            alert(res?.error || "Error al unirse");
        }
    };
}

document.addEventListener('click', (e) => {
    const link = e.target.closest('.app-link');
    if (link) {
        e.preventDefault();
        const identifier = link.dataset.identifier;
        if (identifier) {
            openChannelPreview(identifier);
        }
    }
});


function createChannelListItem(c) {
    const li = document.createElement('li');
    const isSelected = selectedChats.has('c_' + c.id);
    li.className = `chat-card user-item ${currentTargetUserId === 'c_' + c.id ? 'active' : ''} ${isSelected ? 'selected' : ''}`;

    const avatarUrl = resolveImageUrl(c.avatar);
    const safeAvatar = `background-image: url('${escapeHtml(avatarUrl)}')`;

    // Placeholder logic for channel last message (simulated for now)
    const timeDisplay = c.last_message_time ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Canal';

    let lastMsg = c.is_public ? ' Canal Público' : 'Canal Privado';
    let isHtmlContent = false;

    // If there's a last message, format it with emoji support
    if (c.last_message) {
        const msgType = c.last_message_type || 'text';
        lastMsg = formatPreviewHTML(c.last_message, msgType);
        isHtmlContent = true;
    }

    li.innerHTML = `
        <div class="card-avatar" style="${safeAvatar}">
             <div class="selection-check">✓</div>
        </div>
        <div class="card-content">
            <div class="card-top">
                <span class="card-name">${escapeHtml(c.name)}</span>
                <span class="card-time">${escapeHtml(timeDisplay)}</span>
            </div>
            <div class="card-msg" style="color:var(--text-dim);">
               ${isHtmlContent ? lastMsg : escapeHtml(lastMsg)}
            </div>
        </div>`;

    li.dataset.uid = 'c_' + c.id;

    // Selection & Long Press Logic
    let pressTimer;
    li.addEventListener('touchstart', (e) => {
        if (isSelectionMode) return;
        pressTimer = setTimeout(() => {
            enterSelectionMode('c_' + c.id);
        }, 500);
    }, { passive: true });

    const cancelPress = () => clearTimeout(pressTimer);
    li.addEventListener('touchend', cancelPress);
    li.addEventListener('touchmove', cancelPress);
    li.addEventListener('touchcancel', cancelPress);

    li.onclick = (e) => {
        if (isSelectionMode) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelection('c_' + c.id);
        } else {
            selectChannel(c, li);
        }
    };
    return li;
}

function renderMixedSidebar() {
    renderMixedSidebarDebounced();
}

const renderMixedSidebarDebounced = debounce(() => {
    console.log('[DEBUG] renderMixedSidebar called');
    const ul = document.getElementById('usersList');
    if (!ul) {
        console.error('[DEBUG] usersList element NOT found!');
        return;
    }
    ul.innerHTML = '';

    // Render based on the current active tab
    if (window.currentSidebarTab === 'channels') {
        // Render Channels Only
        if (myChannels && myChannels.length > 0) {
            myChannels.forEach(c => {
                ul.appendChild(createChannelListItem(c));
            });
        } else {
            ul.innerHTML = '<li style="text-align:center;color:#666;margin-top:20px;">No estás en ningún canal.</li>';
        }
    } else {
        // Render Users Only (Chats)
        if (allUsersCache && allUsersCache.length > 0) {
            const pinnedChats = getPinnedChats();

            allUsersCache.sort((a, b) => {
                const hasStoryA = storiesCache.some(g => g.userId === a.userId && g.stories.length > 0);
                const hasStoryB = storiesCache.some(g => g.userId === b.userId && g.stories.length > 0);

                const isPinnedA = pinnedChats.includes(a.userId) ? 1 : 0;
                const isPinnedB = pinnedChats.includes(b.userId) ? 1 : 0;

                if (isPinnedA !== isPinnedB) return isPinnedB - isPinnedA; // Pinned first
                if (hasStoryA && !hasStoryB) return -1;
                if (!hasStoryA && hasStoryB) return 1;
                return b.online - a.online;
            }).forEach(u => {
                if (myUser && u.userId === myUser.id) return;
                ul.appendChild(createUserItem(u));
            });
        }

        // Freeze animations in preview
        const previewEmojis = ul.querySelectorAll('.preview-emoji');
        previewEmojis.forEach(img => {
            if (img.complete) freezeImage(img, false);
            else img.onload = () => freezeImage(img, false);
        });
    } // Close the else branch for "Render Users Only (Chats)"

    console.log('[DEBUG] renderMixedSidebar finished. Items:', ul.children.length);
}, 100);

async function selectChannel(channel, elem) {
    currentTargetUserId = 'c_' + channel.id;
    currentTargetUserObj = { ...channel, isChannel: true };
    currentChatType = 'channel';

    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    if (elem) elem.classList.add('active');

    emptyState.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    messagesList.classList.remove('hidden');

    document.querySelector('.chat-container').classList.add('mobile-chat-active');

    if (fabNewChat) fabNewChat.classList.add('hidden');
    hidePinnedBar();
    document.querySelector('.chat-container')?.classList.remove('has-pinned-message');
    currentPinnedMessageId = null;

    document.body.classList.remove('theme-love', 'theme-space');
    const mainCol = document.querySelector('.main-column');
    if (mainCol) mainCol.classList.remove('theme-love', 'theme-space');

    const chatMain = document.querySelector('.chat-main');
    if (chatMain) {
        chatMain.style.backgroundImage = '';
        chatMain.style.backgroundSize = '';
    }
    inputMsg.value = '';

    if (channel.owner_id === myUser.id) {
        chatForm.classList.remove('hidden');
    } else {
        chatForm.classList.add('hidden');
    }

    chatTitle.textContent = channel.name;
    currentChatAvatar.style.backgroundImage = `url('${channel.avatar}')`;
    currentChatAvatar.style.borderRadius = "12px";

    // Reset Pagination
    oldestMessageId = null;
    allHistoryLoaded = false;
    isLoadingHistory = false;

    let msgs;
    if (window.messagesCache && window.messagesCache.channels && window.messagesCache.channels[channel.id]) {
        msgs = window.messagesCache.channels[channel.id];
        delete window.messagesCache.channels[channel.id];
        messagesList.innerHTML = '';
    } else {
        messagesList.innerHTML = '<li style="text-align:center;color:#666;margin-top:20px;">Cargando canal...</li>';
        messagesList.classList.add('loading-history');
        msgs = await apiRequest(`/api/channels/channel-messages/${channel.id}?limit=50`);
        messagesList.innerHTML = '';
    }

    if (msgs && msgs.length > 0) {
        // Set oldest ID
        oldestMessageId = msgs[0].id;
        if (msgs.length < 50) allHistoryLoaded = true;

        msgs.forEach(msg => {
            let rd = null;
            if (msg.reply_to_id) {
                let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
                let rContent = msg.reply_content;
                if (msg.reply_type === 'image') rContent = ICONS.replyImage;
                else if (msg.reply_type === 'audio') rContent = ICONS.replyAudio;
                rd = { id: msg.reply_to_id, username: rName, content: rContent, type: msg.reply_type };
            }

            const isMe = msg.from_user_id === myUser.id;
            appendMessageUI(msg.content, isMe ? 'me' : 'other', msg.timestamp, msg.id, msg.type, rd, msg.is_deleted, msg.caption, msg.is_edited, msg.from_user_id, msg.username);
        });

        void messagesList.offsetWidth;
        requestAnimationFrame(() => messagesList.classList.remove('loading-history'));
        scrollToBottom(false, true);
    } else {
        messagesList.classList.remove('loading-history');
        allHistoryLoaded = true;
    }
    setupScrollListener();
}

function prependMessageBatch(messages) {
    const fragment = document.createDocumentFragment();
    let batchPreviousDate = null;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    messages.forEach(msg => {
        let fixedDate = msg.timestamp;
        if (typeof fixedDate === 'string' && fixedDate.includes(' ')) {
            fixedDate = fixedDate.replace(' ', 'T') + 'Z';
        }

        // Date Divider Logic for Batch
        const dateObj = new Date(fixedDate);
        let label = dateObj.toLocaleDateString();
        if (dateObj.toDateString() === today.toDateString()) label = "Hoy";
        else if (dateObj.toDateString() === yesterday.toDateString()) label = "Ayer";

        if (label !== batchPreviousDate) {
            const li = document.createElement('li');
            li.className = 'date-divider history-message';
            li.innerHTML = `<span>${label}</span>`;
            fragment.appendChild(li);
            batchPreviousDate = label;
        }

        let rd = null;
        if (msg.reply_to_id) {
            // ... resolve reply data (simplify for brevity, logic exists) ...
            let rName = "Usuario"; // Fallback
            if (msg.reply_from_id === myUser.id) rName = "Tú";
            else if (myNicknames[msg.reply_from_id]) rName = myNicknames[msg.reply_from_id];
            else if (allUsersCache) { const u = allUsersCache.find(x => x.userId == msg.reply_from_id); if (u) rName = u.username; }

            let rContent = msg.reply_content;
            if (msg.reply_type === 'image') rContent = ICONS.replyImage;
            else if (msg.reply_type === 'audio') rContent = ICONS.replyAudio;
            rd = { id: msg.reply_to_id, username: rName, content: rContent, type: msg.reply_type };
        }

        const isMe = msg.from_user_id === myUser.id;
        // Pass 'fragment' as container and skipDateDivider=true (handled above)
        appendMessageUI(
            msg.content,
            isMe ? 'me' : 'other',
            fixedDate,
            msg.id,
            msg.type,
            rd,
            msg.is_deleted,
            msg.caption,
            msg.is_edited,
            msg.from_user_id,
            msg.username,
            'sent', // status
            fragment, // container
            true, // skipDateDivider
            'history-message fade-in-history' // extraClass
        );
    });

    // Check DOM connection
    const firstChild = messagesList.firstElementChild;
    if (firstChild && firstChild.classList.contains('date-divider')) {
        const firstDateLabel = firstChild.innerText;
        // The last message of the batch should match this label if it's the same day
        // We know batchPreviousDate holds the date label of the LAST message we processed
        if (firstDateLabel === batchPreviousDate) {
            firstChild.remove(); // Remove duplicate divider
        }
    }

    messagesList.prepend(fragment);
}

const originalSendMessage = sendMessage;
sendMessage = function (content, type, replyId = null) {
    if (currentChatType === 'channel') {
        const channelId = currentTargetUserObj.id;
        socket.emit('private message', {
            content,
            toChannelId: channelId,
            type,
            replyToId: replyId
        });

        // Optimistic sidebar update for channels
        updateSidebarWithNewMessage(channelId, content, type, new Date());

        // Optimistic UI append for channels? 
        // The original logic didn't seem to have it, relying on socket 'channel_message' 
        // or maybe it assumed 'private message' callback would handle it?
        // Actually, the original sendMessage (lines 2618) DOES optimistic append.
        // But here we are bypassing it. 
        // Let's at least add the sidebar update which is the request.

    } else {
        originalSendMessage(content, type, replyId);
    }
}

socket.on('channel_message', (msg) => {
    if (currentChatType === 'channel' && currentTargetUserObj.id === msg.channelId) {
        const isMe = msg.fromUserId === myUser.id;
        appendMessageUI(msg.content, isMe ? 'me' : 'other', msg.timestamp, msg.id, msg.type, null, 0, msg.caption, 0, msg.fromUserId, msg.username);
        scrollToBottom(true);
    }

    // Update sidebar for channel message
    updateSidebarWithNewMessage(msg.channelId, msg.content, msg.type, msg.timestamp);
});

socket.on('channels_update', () => {
    loadMyChannels();
});

const originalLoginSuccess = loginSuccess;
loginSuccess = function (user) {
    originalLoginSuccess(user);
    loadMyChannels();
    // Preload emojis for instant access
    setTimeout(() => loadEmojis(), 1000);
}

const channelProfileModal = document.getElementById('channelProfileModal');
const channelEditModal = document.getElementById('channelEditModal');

const channelProfileAvatar = document.getElementById('channelProfileAvatar');
const channelProfileName = document.getElementById('channelProfileName');
const channelProfileBio = document.getElementById('channelProfileBio');
const btnEditChannel = document.getElementById('btnEditChannel');
const channelSubCount = document.getElementById('channelSubCount');

const editChannelName = document.getElementById('editChannelName');
const editChannelBio = document.getElementById('editChannelBio');
const editChannelAvatarPreview = document.getElementById('editChannelAvatarPreview');
const editChannelAvatarInput = document.getElementById('editChannelAvatarInput');
let editChannelFile = null;

getEl('headerAvatarBtn').addEventListener('click', () => {
    if (currentChatType === 'channel' && currentTargetUserObj) {
        openChannelProfile();
    }
    else if (currentTargetUserObj) {
        const modal = getEl('contactInfoModal');
        modal.classList.remove('hidden');
    }
});

async function openChannelProfile() {
    const channel = currentTargetUserObj;

    const nameEl = document.getElementById('channelProfileName');
    const statusEl = document.getElementById('channelProfileStatus');
    const bioEl = document.getElementById('channelProfileBio');
    const avatarEl = document.getElementById('channelProfileAvatar');
    const subCountEl = document.getElementById('channelSubCount');
    const editBtn = document.getElementById('btnEditChannel');

    const linkSection = document.getElementById('channelLinkSection');
    const publicLinkEl = document.getElementById('channelPublicLink');
    const subSection = document.getElementById('channelSubSection');

    nameEl.textContent = channel.name;

    if (channel.description) {
        bioEl.textContent = channel.description;
        bioEl.style.color = "#e4e4e7";
    } else {
        bioEl.textContent = "Sin descripción.";
        bioEl.style.color = "#666";
    }

    const { style, html } = renderAvatarContent(channel, 'channel-profile-avatar');
    avatarEl.style = style;
    avatarEl.innerHTML = html;

    if (channel.owner_id === myUser.id) {
        editBtn.classList.remove('hidden');
    } else {
        editBtn.classList.add('hidden');
    }


    let memberCount = 0;
    try {
        const res = await apiRequest(`/api/channels/info/${channel.id}`);
        if (res) memberCount = res.memberCount || 0;
    } catch (e) {
        console.log(e);
    }

    const subText = memberCount === 1 ? 'suscriptor' : 'suscriptores';

    if (channel.is_public) {

        statusEl.textContent = `${memberCount} ${subText}`;
        statusEl.style.color = "#a1a1aa";
        linkSection.classList.remove('hidden');
        const handle = channel.handle || 'enlace';
        publicLinkEl.textContent = `ap.me/${handle}`;

        publicLinkEl.onclick = () => {
            navigator.clipboard.writeText(`ap.me/${handle}`);
            showToast("Enlace copiado al portapapeles");
        };

        subSection.classList.add('hidden');

    } else {
        statusEl.textContent = "canal privado";
        statusEl.style.color = "#666";

        linkSection.classList.add('hidden');

        subSection.classList.remove('hidden');
        subCountEl.textContent = memberCount;
    }

    document.getElementById('channelProfileModal').classList.remove('hidden');
}
const btnCloseChannel = document.getElementById('closeChannelProfile');

if (btnCloseChannel) {
    btnCloseChannel.addEventListener('click', () => {
        document.getElementById('channelProfileModal').classList.add('hidden');
    });
}

btnEditChannel.addEventListener('click', () => {
    channelProfileModal.classList.add('hidden');

    const channel = currentTargetUserObj;
    editChannelName.value = channel.name;
    editChannelBio.value = channel.description || '';
    editChannelAvatarPreview.style.backgroundImage = `url('${resolveImageUrl(channel.avatar)}')`;
    editChannelFile = null;

    channelEditModal.classList.remove('hidden');
});

document.getElementById('closeChannelEdit').addEventListener('click', () => {
    channelEditModal.classList.add('hidden');
    channelProfileModal.classList.remove('hidden');
});
const editAvatarInput = document.getElementById('editChannelAvatarInput');
if (editAvatarInput) {
    editAvatarInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('editChannelAvatarPreview').style.backgroundImage = `url('${ev.target.result}')`;
            }
            reader.readAsDataURL(e.target.files[0]);
        }
    });
}

editChannelAvatarInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        editChannelFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            editChannelAvatarPreview.style.backgroundImage = `url('${ev.target.result}')`;
        }
        reader.readAsDataURL(editChannelFile);
    }
});

const saveInfoBtn = document.getElementById('saveChannelInfoBtn');

if (saveInfoBtn) {
    saveInfoBtn.addEventListener('click', async () => {
        const newName = document.getElementById('editChannelName').value.trim();
        const newBio = document.getElementById('editChannelBio').value.trim();
        const avatarInput = document.getElementById('editChannelAvatarInput');
        const avatarFile = avatarInput && avatarInput.files ? avatarInput.files[0] : null;

        if (!newName) return alert("El nombre no puede estar vacío");
        if (!currentEditChannel) return;

        const originalIcon = saveInfoBtn.innerHTML;
        saveInfoBtn.innerHTML = '...';
        saveInfoBtn.style.pointerEvents = 'none';

        const fd = new FormData();
        fd.append('channelId', currentEditChannel.id);
        fd.append('name', newName);
        fd.append('description', newBio);
        if (avatarFile) fd.append('avatar', avatarFile);

        try {
            const res = await apiRequest('/api/channels/update', 'POST', fd);

            if (res && res.success) {
                currentEditChannel.name = res.name;
                currentEditChannel.description = res.description;
                if (res.avatar) currentEditChannel.avatar = res.avatar;
                if (currentTargetUserObj && currentTargetUserObj.id === currentEditChannel.id) {
                    currentTargetUserObj = { ...currentTargetUserObj, ...currentEditChannel };
                    updateChatHeaderInfo(currentTargetUserObj);
                    const currentAvatarEl = document.getElementById('currentChatAvatar');
                    if (currentAvatarEl) currentAvatarEl.style.backgroundImage = `url('${res.avatar || currentTargetUserObj.avatar}')`;
                }
                loadMyChannels();
                document.getElementById('channelEditModal').classList.add('hidden');
            } else {
                alert(res.error || "Error al actualizar canal");
            }
        } catch (error) {
            console.error(error);
            alert("Error de conexión");
        } finally {
            saveInfoBtn.innerHTML = originalIcon;
            saveInfoBtn.style.pointerEvents = 'auto';
        }
    });
}

const headerBtn = document.getElementById('headerAvatarBtn');

headerBtn.onclick = (e) => {
    e.stopPropagation();

    if (currentChatType === 'channel' && currentTargetUserObj) {
        document.getElementById('contactInfoModal').classList.add('hidden');

        openChannelProfile();
    }

    else if (currentTargetUserObj) {
        document.getElementById('channelProfileModal').classList.add('hidden');

        const modal = document.getElementById('contactInfoModal');
        const nameEl = document.getElementById('contactInfoName');
        const userEl = document.getElementById('contactRealUsername');
        const bioEl = document.getElementById('contactInfoBio');
        const avatarEl = document.getElementById('contactInfoAvatar');
        const adminSec = document.getElementById('adminActionsSection');

        const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;

        nameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        userEl.textContent = `@${currentTargetUserObj.username}`;

        if (currentTargetUserObj.bio) {
            bioEl.textContent = currentTargetUserObj.bio;
            bioEl.style.color = "#e4e4e7";
        } else {
            bioEl.textContent = "Sin biografía.";
            bioEl.style.color = "#666";
        }

        let avatarUrl = resolveImageUrl(currentTargetUserObj.avatar);
        avatarEl.style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;

        if (myUser?.is_admin) {
            if (adminSec) adminSec.classList.remove('hidden');

            const verifyBtn = document.getElementById('toggleVerifyBtn');
            const premiumBtn = document.getElementById('togglePremiumBtn');
            const loveNoteSec = document.getElementById('adminLoveNoteSection');

            if (verifyBtn) verifyBtn.textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
            if (premiumBtn) premiumBtn.textContent = currentTargetUserObj.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";

            if (loveNoteSec) {
                if (currentTargetUserObj.is_premium) loveNoteSec.classList.remove('hidden');
                else loveNoteSec.classList.add('hidden');
            }
        } else {
            if (adminSec) adminSec.classList.add('hidden');
        }

        modal.classList.remove('hidden');

        if (typeof enableNicknameEdit === 'function') {
            enableNicknameEdit('contactInfoName', currentTargetUserObj.userId);
        }
    }
};

let handleCheckTimeout = null;
let isHandleValid = false;
let channelAvatarFile = null;

const viewChannelType = document.getElementById('viewChannelType');

const creationCheckBtn = document.getElementById('creationCheckBtn');
const channelNameInput = document.getElementById('channelNameInput');
const channelLinkInput = document.getElementById('channelLinkInput');
const linkStatusText = document.getElementById('linkStatusText');
const radioInputs = document.querySelectorAll('input[name="channelType"]');
const publicLinkSection = document.getElementById('publicLinkSection');
const privateLinkSection = document.getElementById('privateLinkSection');

fabNewChat.addEventListener('click', () => {
    creationModal.classList.remove('hidden');
    resetCreationFlow();
    renderStartContacts();
});

function resetCreationFlow() {
    creationStep = 0;
    selectedMembers.clear();
    channelAvatarFile = null;
    isHandleValid = false;

    if (channelNameInput) channelNameInput.value = '';
    if (channelLinkInput) channelLinkInput.value = '';
    const bioInput = document.getElementById('channelBioInput');
    if (bioInput) bioInput.value = '';
    const avatarPreview = document.getElementById('channelAvatarPreview');
    if (avatarPreview) avatarPreview.style.backgroundImage = '';

    goToStep(0);
}

function goToStep(step) {
    creationStep = step;

    if (viewStart) viewStart.classList.add('hidden');
    if (viewSelectMembers) viewSelectMembers.classList.add('hidden');
    if (viewChannelInfo) viewChannelInfo.classList.add('hidden');
    if (viewChannelType) viewChannelType.classList.add('hidden');

    if (creationNextBtn) creationNextBtn.classList.add('hidden');
    if (creationCheckBtn) creationCheckBtn.classList.add('hidden');

    const closeIcon = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    const backIcon = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';

    if (closeCreation) closeCreation.innerHTML = (step === 0) ? closeIcon : backIcon;

    if (step === 0) {
        if (creationTitle) creationTitle.textContent = "Nuevo Chat";
        viewStart.classList.remove('hidden');
    }
    else if (step === 1) {
        if (creationTitle) creationTitle.textContent = "Añadir Miembros";
        viewSelectMembers.classList.remove('hidden');
        renderMemberSelection();
        updateNextButton();
    }
    else if (step === 2) {
        if (creationTitle) creationTitle.textContent = "Nuevo Canal";
        viewChannelInfo.classList.remove('hidden');
        channelNameInput.focus();
        if (channelNameInput.value.trim().length > 0) creationCheckBtn.classList.remove('hidden');
    }
    else if (step === 3) {
        if (creationTitle) creationTitle.textContent = "Tipo de canal";
        viewChannelType.classList.remove('hidden');
        validateChannelTypeStep();
    }
}

if (closeCreation) closeCreation.addEventListener('click', () => {
    if (creationStep === 3) goToStep(2);
    else if (creationStep === 2) goToStep(1);
    else if (creationStep === 1) goToStep(0);
    else creationModal.classList.add('hidden');
});

document.getElementById('btnCreateChannel').addEventListener('click', () => goToStep(1));

if (creationNextBtn) creationNextBtn.addEventListener('click', () => {
    if (creationStep === 1) goToStep(2);
});

if (creationCheckBtn) creationCheckBtn.addEventListener('click', () => {
    if (creationStep === 2) {
        if (channelNameInput.value.trim()) goToStep(3);
    }
    else if (creationStep === 3) {
        submitCreateChannel();
    }
});

function updateNextButton() {
    if (selectedMembers.size > 0) {
        creationNextBtn.classList.remove('hidden');
        creationNextBtn.textContent = 'Siguiente';
    } else {
        creationNextBtn.classList.add('hidden');
    }
}

if (channelNameInput) channelNameInput.addEventListener('input', (e) => {
    if (e.target.value.trim().length > 0) creationCheckBtn.classList.remove('hidden');
    else creationCheckBtn.classList.add('hidden');
});

document.getElementById('channelAvatarInput').addEventListener('change', (e) => {
    if (e.target.files[0]) {
        channelAvatarFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => document.getElementById('channelAvatarPreview').style.backgroundImage = `url('${ev.target.result}')`;
        reader.readAsDataURL(channelAvatarFile);
    }
});

radioInputs.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'public') {
            publicLinkSection.classList.remove('hidden');
            privateLinkSection.classList.add('hidden');
            validatePublicHandle();
        } else {
            publicLinkSection.classList.add('hidden');
            privateLinkSection.classList.remove('hidden');
            const rnd = Math.random().toString(36).substring(7);
            document.getElementById('generatedPrivateLink').textContent = `t.me/+${rnd}`;
            creationCheckBtn.classList.remove('hidden');
        }
    });
});

if (channelLinkInput) channelLinkInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearTimeout(handleCheckTimeout);

    if (val.length === 0) {
        setLinkStatus("normal", "Si es público, otros podrán encontrarte.");
        creationCheckBtn.classList.add('hidden');
        return;
    }
    if (val.length < 5) {
        setLinkStatus("error", "Mínimo 5 caracteres.");
        creationCheckBtn.classList.add('hidden');
        return;
    }

    setLinkStatus("normal", "Comprobando...");
    handleCheckTimeout = setTimeout(() => checkHandleAvailability(val), 500);
});

async function checkHandleAvailability(handle) {
    try {
        const res = await apiRequest('/api/channels/check-handle', 'POST', { handle });
        if (res && res.available) {
            setLinkStatus("success", `${handle} está disponible.`);
            isHandleValid = true;
            creationCheckBtn.classList.remove('hidden');
        } else {
            setLinkStatus("error", res.error || "Ocupado.");
            isHandleValid = false;
            creationCheckBtn.classList.add('hidden');
        }
    } catch (e) {
        setLinkStatus("error", "Error conexión");
    }
}

function setLinkStatus(type, msg) {
    linkStatusText.textContent = msg;
    const wrapper = document.querySelector('.link-input-wrapper');
    wrapper.classList.remove('error');
    linkStatusText.style.color = "#666";
    if (type === 'error') { linkStatusText.style.color = "#ef4444"; wrapper.classList.add('error'); }
    else if (type === 'success') { linkStatusText.style.color = "#4ade80"; }
}

function validatePublicHandle() {
    const val = channelLinkInput.value.trim();

    if (val.length >= 5 && isHandleValid) {
        creationCheckBtn.classList.remove('hidden');
    } else {
        creationCheckBtn.classList.add('hidden');
    }
}


function validateChannelTypeStep() {
    const type = document.querySelector('input[name="channelType"]:checked').value;
    if (type === 'private') {
        creationCheckBtn.classList.remove('hidden');
    } else {
        validatePublicHandle();
    }
}

async function submitCreateChannel() {
    const name = channelNameInput.value.trim();
    const bioInput = document.getElementById('channelBioInput');
    const bio = bioInput ? bioInput.value.trim() : '';

    const type = document.querySelector('input[name="channelType"]:checked').value;
    const handle = channelLinkInput.value.trim();

    if (!name) return alert("Nombre requerido");
    if (type === 'public' && !isHandleValid) return alert("Enlace inválido o no disponible");

    creationCheckBtn.style.opacity = "0.5";
    creationCheckBtn.style.pointerEvents = "none";

    const fd = new FormData();
    fd.append('name', name);
    fd.append('bio', bio);
    fd.append('members', JSON.stringify(Array.from(selectedMembers)));
    fd.append('isPublic', type === 'public');

    if (type === 'public') fd.append('handle', handle);
    if (channelAvatarFile) fd.append('avatar', channelAvatarFile);

    try {
        const res = await apiRequest('/api/channels/create', 'POST', fd);

        creationCheckBtn.style.opacity = "1";
        creationCheckBtn.style.pointerEvents = "auto";

        if (res && res.success) {
            creationModal.classList.add('hidden');
            loadMyChannels();
            selectChannel({
                id: res.channelId,
                name: res.name,
                avatar: res.avatar,
                description: bio
            });
        } else {
            alert(res.error || "Error al crear canal");
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión");
        creationCheckBtn.style.opacity = "1";
        creationCheckBtn.style.pointerEvents = "auto";
    }
}

let currentEditChannel = null;

function toggleLinkSections(val) {
    const pubSection = document.getElementById('editPublicLinkSection');
    const privSection = document.getElementById('editPrivateLinkSection');

    if (!pubSection || !privSection) return;

    if (val === 'public') {
        pubSection.classList.remove('hidden');
        privSection.classList.add('hidden');
    } else {
        pubSection.classList.add('hidden');
        privSection.classList.remove('hidden');
    }
}

btnEditChannel.addEventListener('click', () => {
    currentEditChannel = currentTargetUserObj;

    document.getElementById('editChannelName').value = currentEditChannel.name;
    document.getElementById('editChannelBio').value = currentEditChannel.description || '';
    document.getElementById('editChannelAvatarPreview').style.backgroundImage = `url('${currentEditChannel.avatar}')`;

    document.getElementById('lblChannelType').textContent = currentEditChannel.is_public ? "Público" : "Privado";

    refreshChannelCounts(currentEditChannel.id);

    channelProfileModal.classList.add('hidden');
    document.getElementById('channelEditModal').classList.remove('hidden');
});

async function refreshChannelCounts(cid) {

    const mRes = await apiRequest(`/api/channels/info/${cid}`);
    document.getElementById('lblSubCount').textContent = mRes ? mRes.memberCount : 0;

    const bRes = await apiRequest(`/api/channels/${cid}/banned`);
    document.getElementById('lblBannedCount').textContent = bRes ? bRes.length : 0;
}

document.getElementById('btnOpenChannelType').addEventListener('click', () => {
    document.getElementById('channelEditModal').classList.add('hidden');
    document.getElementById('channelTypeModal').classList.remove('hidden');

    const isPublic = !!currentEditChannel.is_public;
    document.querySelector(`input[name="editChannelType"][value="${isPublic ? 'public' : 'private'}"]`).checked = true;

    toggleLinkSections(isPublic ? 'public' : 'private');

    if (isPublic) {
        document.getElementById('editChannelLinkInput').value = currentEditChannel.handle || '';
    }

    if (currentEditChannel.private_hash) {
        document.getElementById('editGeneratedLink').value = `ap.me/+${currentEditChannel.private_hash}`;
    } else if (!isPublic && currentEditChannel.invite_link) {
        document.getElementById('editGeneratedLink').value = currentEditChannel.invite_link;
    } else {
        document.getElementById('editGeneratedLink').value = 'Generando...';
    }
});

document.querySelectorAll('input[name="editChannelType"]').forEach(r => {
    r.addEventListener('change', (e) => {
        const val = e.target.value;
        toggleLinkSections(val);

        if (val === 'private' && currentEditChannel.private_hash) {
            document.getElementById('editGeneratedLink').value = `ap.me/+${currentEditChannel.private_hash}`;
        }
    });
});

document.getElementById('saveChannelTypeBtn').addEventListener('click', async () => {
    const type = document.querySelector('input[name="editChannelType"]:checked').value;
    const isPublic = type === 'public';
    const handle = document.getElementById('editChannelLinkInput').value.trim();

    if (isPublic && handle.length < 5) return alert("El enlace debe tener al menos 5 caracteres");

    const res = await apiRequest(`/api/channels/${currentEditChannel.id}/update-type`, 'POST', { isPublic, handle });

    if (res && res.success) {
        currentEditChannel.is_public = isPublic ? 1 : 0;
        currentEditChannel.handle = isPublic ? handle : null;
        if (res.newLink) currentEditChannel.invite_link = res.newLink;

        document.getElementById('lblChannelType').textContent = isPublic ? "Público" : "Privado";

        document.getElementById('channelTypeModal').classList.add('hidden');
        document.getElementById('channelEditModal').classList.remove('hidden');
    } else {
        alert(res.error || "Error al actualizar (¿Enlace ocupado?)");
    }
});

document.getElementById('btnOpenSubscribers').addEventListener('click', async () => {
    document.getElementById('channelEditModal').classList.add('hidden');
    document.getElementById('channelSubsModal').classList.remove('hidden');
    loadSubscribersList();
});

async function loadSubscribersList() {
    const list = document.getElementById('subsList');
    list.innerHTML = '<li>Cargando...</li>';

    const users = await apiRequest(`/api/channels/${currentEditChannel.id}/members`);
    list.innerHTML = '';

    if (!users || users.length === 0) {
        list.innerHTML = '<li style="padding:15px; color:#666;">Sin suscriptores</li>';
        return;
    }

    users.forEach(u => {
        const li = document.createElement('li');
        li.className = 'simple-user-item';

        const date = new Date(u.joined_at);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        li.innerHTML = `
            <div class="simple-avatar" style="background-image:url('${resolveImageUrl(u.avatar)}')"></div>
            <div class="simple-info">
                <div class="simple-name">${escapeHtml(u.display_name || u.username)}</div>
                <div class="simple-meta">se unió el ${dateStr}</div>
            </div>
            ${u.id !== myUser.id ? `<button class="simple-menu-btn" onclick="kickUser(${u.id})">⋮</button>` : ''}
        `;
        list.appendChild(li);
    });
}

async function kickUser(uid) {
    if (!confirm("¿Expulsar usuario? No podrá volver a unirse.")) return;
    const res = await apiRequest(`/api/channels/${currentEditChannel.id}/kick`, 'POST', { userId: uid });
    if (res && res.success) {
        loadSubscribersList();
        refreshChannelCounts(currentEditChannel.id);
    }
}

document.getElementById('btnOpenBanned').addEventListener('click', () => {
    document.getElementById('channelEditModal').classList.add('hidden');
    document.getElementById('channelBannedModal').classList.remove('hidden');
    loadBannedList();
});

async function loadBannedList() {
    const list = document.getElementById('bannedList');
    list.innerHTML = '<li>Cargando...</li>';
    const users = await apiRequest(`/api/channels/${currentEditChannel.id}/banned`);
    list.innerHTML = '';

    if (!users || users.length === 0) {
        list.innerHTML = '<li style="padding:15px; color:#666;">No hay usuarios expulsados</li>';
        return;
    }

    users.forEach(u => {
        const li = document.createElement('li');
        li.className = 'simple-user-item';
        li.innerHTML = `
            <div class="simple-avatar" style="background-image:url('${resolveImageUrl(u.avatar)}')"></div>
            <div class="simple-info">
                <div class="simple-name">${escapeHtml(u.display_name || u.username)}</div>
                <div class="simple-meta">Expulsado</div>
            </div>
            <button class="simple-menu-btn" onclick="unbanUser(${u.id})">⋮</button>
        `;
        list.appendChild(li);
    });
}

async function unbanUser(uid) {
    if (!confirm("¿Quitar expulsión? El usuario podrá unirse de nuevo.")) return;
    const res = await apiRequest(`/api/channels/${currentEditChannel.id}/unban`, 'POST', { userId: uid });
    if (res && res.success) {
        loadBannedList();
        refreshChannelCounts(currentEditChannel.id);
    }
}

document.getElementById('closeChannelType').addEventListener('click', () => {
    document.getElementById('channelTypeModal').classList.add('hidden');
    document.getElementById('channelEditModal').classList.remove('hidden');
});
document.getElementById('closeChannelSubs').addEventListener('click', () => {
    document.getElementById('channelSubsModal').classList.add('hidden');
    document.getElementById('channelEditModal').classList.remove('hidden');
});
document.getElementById('closeChannelBanned').addEventListener('click', () => {
    document.getElementById('channelBannedModal').classList.add('hidden');
    document.getElementById('channelEditModal').classList.remove('hidden');
});

const channelAddMembersModal = document.getElementById('channelAddMembersModal');
const btnAddSubscribers = document.getElementById('btnAddSubscribers');
const closeAddMembers = document.getElementById('closeAddMembers');
const addMembersList = document.getElementById('addMembersList');
const searchNewMembers = document.getElementById('searchNewMembers');
const confirmAddMembersBtn = document.getElementById('confirmAddMembersBtn');

let usersToAddToChannel = new Set();

if (btnAddSubscribers) {
    btnAddSubscribers.addEventListener('click', async () => {
        document.getElementById('channelSubsModal').classList.add('hidden');

        channelAddMembersModal.classList.remove('hidden');

        usersToAddToChannel.clear();
        searchNewMembers.value = '';
        confirmAddMembersBtn.classList.add('hidden');
        addMembersList.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">Cargando contactos...</li>';

        await renderAvailableContacts();
    });
}

if (closeAddMembers) {
    closeAddMembers.addEventListener('click', () => {
        channelAddMembersModal.classList.add('hidden');
        document.getElementById('channelSubsModal').classList.remove('hidden');
    });
}

async function renderAvailableContacts(filterText = '') {
    if (!currentEditChannel) return;

    let currentMembersIds = [];
    try {
        const membersData = await apiRequest(`/api/channels/${currentEditChannel.id}/members`);
        currentMembersIds = membersData.map(m => m.id);
    } catch (e) {
        console.error("Error obteniendo miembros", e);
    }

    addMembersList.innerHTML = '';

    const candidates = allUsersCache.filter(u => {
        if (u.userId === myUser.id) return false;
        if (currentMembersIds.includes(u.userId)) return false;
        const name = (myNicknames[u.userId] || u.username).toLowerCase();
        return name.includes(filterText.toLowerCase());
    });

    if (candidates.length === 0) {
        addMembersList.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">No hay contactos disponibles.</li>';
        return;
    }

    candidates.forEach(u => {
        const li = document.createElement('li');
        li.className = 'user-item';

        if (usersToAddToChannel.has(u.userId)) {
            li.classList.add('active');
        }

        const name = escapeHtml(myNicknames[u.userId] || u.username);
        const { style, html } = renderAvatarContent(u, 'text-avatar');

        li.innerHTML = `
            <div class="u-avatar" style="${style}">${html}</div>
            <div style="flex:1;">
                <div style="font-weight:600; color:#fff;">${name}</div>
                <div style="font-size:12px; color:#a1a1aa;">${u.online ? 'En línea' : 'Desconectado'}</div>
            </div>
            <!-- Check visual opcional (solo se ve si está activo por CSS o lógica) -->
            <div class="selection-check" style="display:none;">✓</div> 
        `;

        li.onclick = () => {
            if (usersToAddToChannel.has(u.userId)) {
                usersToAddToChannel.delete(u.userId);
                li.classList.remove('active');
            } else {
                usersToAddToChannel.add(u.userId);
                li.classList.add('active');
            }
            toggleConfirmButton();
        };

        addMembersList.appendChild(li);
    });
}

function toggleConfirmButton() {
    if (usersToAddToChannel.size > 0) {
        confirmAddMembersBtn.classList.remove('hidden');
    } else {
        confirmAddMembersBtn.classList.add('hidden');
    }
}

if (searchNewMembers) {
    searchNewMembers.addEventListener('input', (e) => {
        renderAvailableContacts(e.target.value.trim());
    });
}

if (confirmAddMembersBtn) {
    confirmAddMembersBtn.addEventListener('click', async () => {
        if (usersToAddToChannel.size === 0) return;

        const originalIcon = confirmAddMembersBtn.innerHTML;
        confirmAddMembersBtn.innerHTML = '...';
        confirmAddMembersBtn.style.pointerEvents = 'none';

        try {
            const res = await apiRequest(`/api/channels/${currentEditChannel.id}/add-members`, 'POST', {
                userIds: Array.from(usersToAddToChannel)
            });

            if (res && res.success) {
                channelAddMembersModal.classList.add('hidden');

                document.getElementById('channelSubsModal').classList.remove('hidden');
                loadSubscribersList();
                refreshChannelCounts(currentEditChannel.id);

            } else {
                alert("Error al añadir usuarios.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión.");
        } finally {
            confirmAddMembersBtn.innerHTML = originalIcon;
            confirmAddMembersBtn.style.pointerEvents = 'auto';
        }
    });
}

const btnChannelMenu = document.getElementById('btnChannelMenu');
const channelOptionsMenu = document.getElementById('channelOptionsMenu');

const btnActionShare = document.getElementById('btnActionShare');
const btnActionLeave = document.getElementById('btnActionLeave');
const btnActionMute = document.getElementById('btnActionMute');

const optChannelMute = document.getElementById('optChannelMute');
const optChannelLeave = document.getElementById('optChannelLeave');

if (btnChannelMenu) {
    btnChannelMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        channelOptionsMenu.classList.toggle('hidden');
    });
}

document.addEventListener('click', (e) => {
    if (channelOptionsMenu && !channelOptionsMenu.classList.contains('hidden')) {
        if (!channelOptionsMenu.contains(e.target) && !btnChannelMenu.contains(e.target)) {
            channelOptionsMenu.classList.add('hidden');
        }
    }
});

if (btnActionShare) {
    btnActionShare.addEventListener('click', () => {
        shareChannelLink();
    });
}

function shareChannelLink() {
    if (!currentTargetUserObj) return;

    let linkToShare = '';

    if (currentTargetUserObj.is_public && currentTargetUserObj.handle) {
        linkToShare = `ap.me/${currentTargetUserObj.handle}`;
    } else if (currentTargetUserObj.private_hash) {
        linkToShare = `ap.me/+${currentTargetUserObj.private_hash}`;
    } else if (currentTargetUserObj.invite_link) {
        linkToShare = currentTargetUserObj.invite_link;
    } else {
        return showToast("No hay enlace disponible para este canal.");
    }

    navigator.clipboard.writeText(linkToShare).then(() => {
        showToast("Enlace del canal copiado");
    }).catch(() => {
        showToast("Error al copiar enlace");
    });
}

function triggerLeaveChannel() {
    channelOptionsMenu.classList.add('hidden');

    deleteActionType = 'leave_channel';

    const modalTitle = document.querySelector('#deleteConfirmModal h3');
    const modalDesc = document.querySelector('#deleteConfirmModal p');
    const btnAction = document.getElementById('btnDeleteEveryone');
    const btnSecondary = document.getElementById('btnDeleteMe');

    if (modalTitle) modalTitle.textContent = "¿Salir del canal?";
    if (modalDesc) modalDesc.textContent = "¿Estás seguro de que quieres salir de este canal?";

    if (btnSecondary) btnSecondary.classList.add('hidden');

    if (btnAction) {
        btnAction.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Salir del canal
        `;
        btnAction.style.display = 'flex';
    }

    document.getElementById('deleteConfirmModal').classList.remove('hidden');
}

if (btnActionLeave) {
    btnActionLeave.addEventListener('click', triggerLeaveChannel);
}
if (optChannelLeave) {
    optChannelLeave.addEventListener('click', triggerLeaveChannel);
}

const originalDeleteEveryoneBtn = document.getElementById('btnDeleteEveryone');

originalDeleteEveryoneBtn.addEventListener('click', async () => {

    if (deleteActionType === 'leave_channel') {
        if (!currentTargetUserObj || !currentTargetUserObj.isChannel) return;

        try {
            const res = await apiRequest(`/api/channels/${currentTargetUserObj.id}/leave`, 'POST');

            if (res && res.success) {
                showToast("Has salido del canal");
                closeDeleteModal();

                document.getElementById('channelProfileModal').classList.add('hidden');

                loadMyChannels();

                performExitChat();
            } else {
                alert(res.error || "No puedes salir (¿eres el dueño?)");
                closeDeleteModal();
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión");
        }
    }

    const btnSecondary = document.getElementById('btnDeleteMe');
    if (btnSecondary) btnSecondary.classList.remove('hidden');
});

function toggleMuteUI() {
    channelOptionsMenu.classList.add('hidden');
    showToast("Notificaciones silenciadas (Visual)");
}
if (btnActionMute) btnActionMute.addEventListener('click', toggleMuteUI);
if (optChannelMute) optChannelMute.addEventListener('click', toggleMuteUI);

let globalSearchTimeout;

function applyUserFilter() {
    const inputEl = getEl('searchUsers');
    if (!inputEl) return;

    const term = inputEl.value.trim();
    const termLower = term.toLowerCase();

    // Clear any pending global search immediately
    if (globalSearchTimeout) {
        clearTimeout(globalSearchTimeout);
        globalSearchTimeout = null;
    }

    if (!term) {
        console.log('Search cleared, restoring sidebar');
        renderMixedSidebar();
        return;
    }

    const localResults = allUsersCache.filter(u =>
        u.userId !== myUser.id &&
        (u.username.toLowerCase().includes(termLower) || (myNicknames[u.userId] || '').toLowerCase().includes(termLower))
    );
    renderCombinedResults(localResults, [], true);

    // No need to clear timeout again as we did it above

    if (term.length >= 2) {
        globalSearchTimeout = setTimeout(async () => {
            // CAPTURE CURRENT TERM FOR VALIDATION
            const searchForTerm = term;

            try {
                const [globalUsers, channelResults] = await Promise.all([
                    apiRequest(`/api/contacts/search?q=${encodeURIComponent(searchForTerm)}`),
                    apiRequest(`/api/channels/search?q=${encodeURIComponent(searchForTerm)}`)
                ]);

                // RACE CONDITION FIX:
                // If the input has changed (e.g. cleared) while we were waiting, IGNORE these results.
                const currentInputVal = getEl('searchUsers') ? getEl('searchUsers').value.trim() : '';
                if (currentInputVal !== searchForTerm) {
                    console.log(`Ignoring stale search results for "${searchForTerm}" (current: "${currentInputVal}")`);
                    return;
                }

                const filteredGlobal = (globalUsers || []).filter(g =>
                    !allUsersCache.some(local => local.userId === g.id) && g.id !== myUser.id
                );

                // Deduplicate global results by ID
                const uniqueGlobal = [];
                const seenIds = new Set();
                for (const u of filteredGlobal) {
                    if (!seenIds.has(u.id)) {
                        seenIds.add(u.id);
                        uniqueGlobal.push(u);
                    }
                }

                renderCombinedResults(localResults, uniqueGlobal, channelResults || [], false);

            } catch (e) {
                console.error("Error búsqueda global", e);
            }
        }, 300);
    }
}

function renderCombinedResults(localUsers, globalUsers, channels, loadingGlobal) {
    usersList.innerHTML = '';

    if (localUsers.length > 0) {
        usersList.appendChild(createSectionHeader('Contactos'));
        localUsers.forEach(u => usersList.appendChild(createUserItem(u, false)));
    }

    if (channels && channels.length > 0) {
        const sep = document.createElement('li');
        sep.className = 'search-divider';
        sep.textContent = 'Canales';
        usersList.appendChild(sep);

        channels.forEach(ch => {
            usersList.appendChild(createChannelSearchItem(ch));
        });
    }

    if (globalUsers.length > 0) {
        const sep = document.createElement('li');
        sep.className = 'search-divider';
        sep.textContent = 'Personas Globales';
        usersList.appendChild(sep);

        globalUsers.forEach(u => {
            usersList.appendChild(createGlobalUserItem(u));
        });
    }

    if (localUsers.length === 0 && globalUsers.length === 0 && (!channels || channels.length === 0) && !loadingGlobal) {
        usersList.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">No se encontraron resultados</li>';
        return;
    }

    if (loadingGlobal) {
        const loadingLi = document.createElement('li');
        loadingLi.style.cssText = 'text-align:center; padding:15px; color:#888; font-size:13px; font-style:italic;';
        loadingLi.textContent = 'Buscando en directorio...';
        usersList.appendChild(loadingLi);
    }
}

function createSectionHeader(title) {
    const li = document.createElement('li');
    li.className = 'search-divider';
    li.textContent = title;
    return li;
}

function createChannelSearchItem(ch) {
    const li = document.createElement('li');
    li.className = 'chat-card user-item';
    li.onclick = () => {
        handleChannelClickFromSearch(ch);
    };

    const avatarUrl = resolveImageUrl(ch.avatar);
    const isPrivate = ch.is_public === 0;
    const lockIcon = isPrivate ? '🔒' : '';

    li.innerHTML = `
        <div class="card-avatar" style="background-image: url('${escapeHtml(avatarUrl)}');"></div>
        <div class="card-content">
            <div class="card-top">
                <span class="card-name">${escapeHtml(ch.name)} ${lockIcon}</span>
                <span class="card-time">Full</span>
            </div>
            <div class="card-msg">
                ${isPrivate ? 'Canal Privado' : ('@' + ch.handle)}
            </div>
        </div>
    `;
    return li;
}

async function handleChannelClickFromSearch(ch) {
    const iHaveIt = myChannels.some(c => c.id === ch.id);
    if (iHaveIt) {
        openChannel(ch.id);
        if (window.innerWidth <= 768) document.querySelector('.sidebar').classList.remove('active');
    } else {
        openChannelPreview(ch.handle || ch.private_hash || ch.id);
    }
}

// --- MOBILE SELECTION STATE ---
let isSelectionMode = false;
let selectedChats = new Set();

function createUserItem(u) {
    const li = document.createElement('li');
    const isSelected = selectedChats.has(u.userId);
    li.className = `chat-card user-item ${!u.online ? 'offline' : ''} ${currentTargetUserId === u.userId ? 'active' : ''} ${isSelected ? 'selected' : ''}`;
    li.dataset.uid = u.userId;

    const pinnedChats = getPinnedChats();
    const isPinned = pinnedChats.includes(u.userId);

    const name = myNicknames[u.userId] || u.username;

    const { style, html } = renderAvatarContent(u, 'text-avatar');

    // Status / Last Message Logic
    // Priority: Typing > Recording > Last Message > Status

    let subText = u.online ? 'En línea' : 'Desconectado';
    let subStyle = u.online ? 'color: var(--success); font-weight:600;' : 'color: var(--text-dim);';
    let timeText = '';
    let isHtmlContent = false;

    // Override with Last Message if available
    if (u.lastMessage) {
        const msgType = u.lastMessageType || 'text';
        subText = formatPreviewHTML(u.lastMessage, msgType);
        subStyle = 'color: var(--text-dim);';
        isHtmlContent = true; // Mark that this content contains HTML (emoji images)
        if (u.lastMessageTime) {
            const d = new Date(u.lastMessageTime);
            timeText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    // High priority overrides (Typing/Recording)
    if (u.typing) {
        subText = 'Escribiendo...';
        subStyle = 'color: var(--success); font-weight:600;';
        timeText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        isHtmlContent = false;
    } else if (u.recording) {
        subText = 'Grabando audio...';
        subStyle = 'color: var(--success); font-weight:600;';
        timeText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        isHtmlContent = false;
    }

    const onlineDotHtml = u.online ? '<div class="online-dot"></div>' : '';

    const userStories = storiesCache.find(g => g.userId === u.userId);
    const hasStory = userStories && userStories.stories.length > 0;
    const allViewed = hasStory && userStories.stories.every(s => s.isViewed);

    const ringClass = hasStory ? (allViewed ? 'story-ring-wrapper all-viewed' : 'story-ring-wrapper') : '';

    const pinSvg = isPinned ? `<svg style="opacity: 0.8;" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>` : '';

    li.innerHTML = `
        <div class="${ringClass} chat-avatar-wrapper" data-uid="${u.userId}" style="cursor: pointer; position: relative;">
            <div class="card-avatar" style="${style}">
                ${html}
                ${onlineDotHtml}
                <div class="selection-check">✓</div>
            </div>
        </div>
        <div class="card-content" style="position: relative;">
            ${isPinned ? `<div style="position: absolute; right: 0; top: 25px; display: flex; align-items: center; justify-content: center; margin-right: -4px;">${pinSvg}</div>` : ''}
            <div class="card-top">
                <span class="card-name">
                    ${escapeHtml(name)}${getBadgeHtml(u)}
                    ${(u.unread && u.unread >= 2) ? `<span class="unread-badge">${u.unread}</span>` : ''}
                </span>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0;">
                    <span class="card-time ${u.unread > 0 ? 'unread-time' : ''}">${timeText}</span>
                </div>
            </div>
            <div class="card-msg" style="${subStyle}">
                ${isHtmlContent ? subText : escapeHtml(subText)}
            </div>
        </div>
    `;

    if (window.justPinnedUid === u.userId) {
        li.style.animation = 'slideInPinned 0.35s ease-out forwards';
        if (!document.getElementById('pin-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pin-keyframes';
            style.innerHTML = `
                @keyframes slideInPinned {
                    0% { transform: translateY(-15px); opacity: 0; background: rgba(59, 130, 246, 0.2); }
                    50% { transform: translateY(6px); opacity: 1; background: rgba(59, 130, 246, 0.1); }
                    75% { transform: translateY(-3px); opacity: 1; background: transparent; }
                    90% { transform: translateY(1px); opacity: 1; background: transparent; }
                    100% { transform: translateY(0); opacity: 1; background: transparent; }
                }
            `;
            document.head.appendChild(style);
        }
        window.justPinnedUid = null;
    }

    // Long press logic specifically for the Avatar
    const avatarWrapper = li.querySelector('.chat-avatar-wrapper');
    let avatarPressTimer;
    let isAvatarLongPress = false;
    let didAvatarLongPressTrigger = false;

    avatarWrapper.addEventListener('touchstart', (e) => {
        if (isSelectionMode) return;
        isAvatarLongPress = false;
        didAvatarLongPressTrigger = false;
        avatarPressTimer = setTimeout(() => {
            isAvatarLongPress = true;
            didAvatarLongPressTrigger = true;

            // Trigger custom profile context menu
            const touch = e.touches[0];
            openChatProfileContextMenu(u, touch.clientX, touch.clientY);
        }, 500);
    }, { passive: true });

    const cancelAvatarPress = () => clearTimeout(avatarPressTimer);
    avatarWrapper.addEventListener('touchend', (e) => {
        cancelAvatarPress();
        if (isSelectionMode) return;

        // Prevent default click if a long press already triggered
        if (didAvatarLongPressTrigger) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    avatarWrapper.addEventListener('touchmove', cancelAvatarPress);
    avatarWrapper.addEventListener('touchcancel', cancelAvatarPress);

    avatarWrapper.onclick = (e) => {
        if (isSelectionMode) return; // Li's onclick handles selection mode

        if (didAvatarLongPressTrigger) {
            e.preventDefault();
            e.stopPropagation();
            didAvatarLongPressTrigger = false;
            return;
        }

        e.stopPropagation(); // Stop li click
        openStoryFromAvatar(e, u.userId);
    };


    // Selection & Long Press Logic for the main row wrapper
    let pressTimer;
    li.addEventListener('touchstart', (e) => {
        if (isSelectionMode) return;
        // Do not trigger list selection if touching avatar
        if (e.target.closest('.chat-avatar-wrapper')) return;

        pressTimer = setTimeout(() => {
            enterSelectionMode(u.userId);
        }, 500);
    }, { passive: true });

    const cancelPress = () => clearTimeout(pressTimer);
    li.addEventListener('touchend', cancelPress);
    li.addEventListener('touchmove', cancelPress);
    li.addEventListener('touchcancel', cancelPress);

    li.onclick = (e) => {
        if (isSelectionMode) {
            e.preventDefault();
            e.stopPropagation();

            // If the user's intent is to select the row while in selection mode, toggle it
            // This is allowed even if they clicked the avatar in selection mode
            toggleSelection(u.userId);
        } else {
            selectUser(u, li);
        }
    };

    return li;
}

// --- SELECTION HELPERS ---
function enterSelectionMode(initialUserId) {
    if (isSelectionMode) return;
    isSelectionMode = true;
    selectedChats.clear();
    if (initialUserId) selectedChats.add(initialUserId);

    if (navigator.vibrate) navigator.vibrate(50);

    document.body.classList.add('selection-active');
    const header = document.getElementById('mobileSelectionHeader');
    if (header) header.classList.remove('hidden');

    updateSelectionUI();
    renderMixedSidebar();
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedChats.clear();

    document.body.classList.remove('selection-active');
    const header = document.getElementById('mobileSelectionHeader');
    if (header) header.classList.add('hidden');

    renderMixedSidebar();
}

function toggleSelection(userId) {
    if (selectedChats.has(userId)) {
        selectedChats.delete(userId);
    } else {
        selectedChats.add(userId);
    }

    updateSelectionUI();

    const li = document.querySelector(`.user-item[data-uid="${userId}"]`);
    if (li) {
        if (selectedChats.has(userId)) li.classList.add('selected');
        else li.classList.remove('selected');
    }
}

function updateSelectionUI() {
    const countSpan = document.getElementById('selectionCount');
    if (countSpan) countSpan.textContent = selectedChats.size;
}

function deleteSelectedChats() {
    if (selectedChats.size === 0) return;

    if (confirm(`¿Eliminar ${selectedChats.size} chats seleccionados?`)) {
        console.log(`[Selection] Deleting ${selectedChats.size} chats...`);

        selectedChats.forEach(async id => {
            if (id.startsWith('c_')) {
                // It's a channel - LEAVE
                const channelId = id.substring(2);
                try {
                    // We use the API directly to leave
                    // Note: If I am the owner, this might fail or need confirmation, 
                    // but for bulk action we try best effort.
                    await apiRequest(`/api/channels/${channelId}/leave`, 'POST');
                    console.log(`Left channel ${channelId}`);
                } catch (e) {
                    console.error(`Error leaving channel ${channelId}`, e);
                }
            } else {
                // It's a user - CLEAR HISTORY
                socket.emit('clear chat history', {
                    toUserId: id,
                    deleteType: 'me'
                });
            }
        });

        showToast(`${selectedChats.size} chats eliminados`);
        exitSelectionMode();
    }
}

// Listeners
setTimeout(() => {
    const closeSelectionBtn = document.getElementById('closeSelectionBtn');
    if (closeSelectionBtn) closeSelectionBtn.addEventListener('click', exitSelectionMode);

    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelectedChats);
}, 100);

function createGlobalUserItem(user) {
    const li = document.createElement('li');
    li.className = 'user-item';

    const avatarUrl = resolveImageUrl(user.avatar);
    const displayName = user.display_name || user.username;

    const { style, html } = renderAvatarContent(user, 'text-avatar');

    li.innerHTML = `
        <div class="card-avatar" style="${style}">${html}</div>
        <div class="card-content">
             <div class="card-top">
                <span class="card-name">
                    ${escapeHtml(displayName)}${getBadgeHtml(user)}
                </span>
                <span class="card-time">Global</span>
            </div>
            <div class="card-msg">@${escapeHtml(user.username)}</div>
        </div>
        <button class="btn" style="background:#3b82f6; color:#fff; padding:6px 12px; border-radius:6px; font-size:12px; margin-left:8px;">
            Agregar
        </button>
    `;

    const addBtn = li.querySelector('button');
    addBtn.onclick = async (e) => {
        e.stopPropagation();
        addBtn.disabled = true;
        addBtn.textContent = '...';

        const res = await apiRequest('/api/contacts/add', 'POST', { contactUserId: user.id });

        if (res && res.success) {
            showToast(`${displayName} agregado`);
            addBtn.textContent = '✓';
            addBtn.style.background = '#4ade80';
        } else {
            addBtn.disabled = false;
            addBtn.textContent = 'Agregar';
            showToast('Error al agregar');
        }
    };

    return li;
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));
}

getEl('themeDefault')?.addEventListener('click', () => selectTheme('default'));
getEl('themeLove')?.addEventListener('click', () => selectTheme('love'));
getEl('themeSpace')?.addEventListener('click', () => selectTheme('space'));

document.addEventListener('load', (e) => {
    if (e.target.tagName === 'IMG') {
        const img = e.target;
        if (img.classList.contains('hidden-media')) {
            const wrapper = img.closest('.skeleton-wrapper');
            if (wrapper) {
                img.classList.remove('hidden-media');
                img.classList.add('visible-media');
                wrapper.classList.add('loaded');
            }
        }
    }
}, true);

window.closePinModal = () => { getEl('pinConfirmModal').classList.add('hidden'); };
getEl('pinModalBackdrop')?.addEventListener('click', closePinModal);
getEl('btnCancelPin')?.addEventListener('click', closePinModal);




/* --- NEW BOTTOM NAVIGATION LOGIC --- */
const navPlusBtn = document.getElementById('navPlusBtn');
if (navPlusBtn) {
    navPlusBtn.addEventListener('click', (e) => {
        // Calculate center for animation
        const rect = navPlusBtn.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;

        const modal = document.getElementById('creationModal');
        const card = modal.querySelector('.profile-card.creation-card');

        if (card) {
            card.style.setProperty('--origin-x', `${originX}px`);
            card.style.setProperty('--origin-y', `${originY}px`);
            card.classList.remove('closing');
        }

        // Trigger the existing logic by clicking the hidden FAB if preferred, or direct
        if (fabNewChat) {
            // Updated fabNewChat click might need similar logic if used elsewhere, 
            // but here we are overriding the dock button behavior directly.
            // Let's just open the modal directly to control animation.
            modal.classList.remove('hidden');
            // Ensure resetCreation is called if available
            if (typeof resetCreationFlow === 'function') resetCreationFlow();
            if (typeof renderStartContacts === 'function') renderStartContacts();
        } else {
            if (modal) modal.classList.remove('hidden');
        }
    });
}

/* --- DESKTOP NEW CHAT BUTTON LOGIC --- */
const headerNewChatBtn = document.getElementById('headerNewChatBtn');
if (headerNewChatBtn) {
    headerNewChatBtn.addEventListener('click', () => {
        // Simple open for desktop, centered modal
        const modal = document.getElementById('creationModal');
        if (modal) {
            modal.classList.remove('hidden');
            const card = modal.querySelector('.profile-card.creation-card');
            if (card) {
                // Reset animation origin to center or remove it
                card.style.removeProperty('--origin-x');
                card.style.removeProperty('--origin-y');
                card.classList.remove('closing');
            }
            if (typeof resetCreationFlow === 'function') resetCreationFlow();
            if (typeof renderStartContacts === 'function') renderStartContacts();
        }
    });
}

/* --- CREATION MODAL CLOSE LOGIC --- */
const closeCreationBtn = document.getElementById('closeCreation');
const creationModalEl = document.getElementById('creationModal');

if (closeCreationBtn && creationModalEl) {
    closeCreationBtn.addEventListener('click', () => {
        const card = creationModalEl.querySelector('.profile-card.creation-card');
        if (card) {
            card.classList.add('closing');
            setTimeout(() => {
                creationModalEl.classList.add('hidden');
                card.classList.remove('closing');
            }, 240);
        } else {
            creationModalEl.classList.add('hidden');
        }
    });
}

/* --- DOCK NAVIGATION LOGIC --- */
const navChatBtn = document.getElementById('navChatBtn');
const navCallsBtn = document.getElementById('navCallsBtn');
const navContactsBtn = document.getElementById('navContactsBtn');
const navSettingsBtn = document.getElementById('navSettingsBtn');
const comingSoonModal = document.getElementById('comingSoonModal');
// Close button inside the modal
const closeComingSoon = document.getElementById('closeComingSoon');

// Helper to set active class
function setActiveDockIcon(activeBtn) {
    [navChatBtn, navCallsBtn, navContactsBtn, navSettingsBtn].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
}

if (navChatBtn) {
    navChatBtn.addEventListener('click', () => {
        setActiveDockIcon(navChatBtn);
        window.currentSidebarTab = 'chats'; // Set state

        // Restore Views
        if (settingsView) settingsView.classList.add('hidden');
        if (usersListEl) {
            usersListEl.classList.remove('hidden');
            renderMixedSidebar(); // Re-render for chats
        }
        if (brandHeaderEl) brandHeaderEl.style.display = '';
        if (favoritesSectionEl) favoritesSectionEl.style.display = '';
        if (searchTriggerEl) searchTriggerEl.style.display = '';

        // --- MAIN COLUMN RESTORE ---
        const settingsMainPlaceholder = document.getElementById('settingsMainPlaceholder');
        const emptyStateEl = document.getElementById('emptyState');
        const messagesEl = document.getElementById('messages');
        const chatHeaderEl = document.querySelector('.chat-header');
        const composerEl = document.querySelector('.composer');

        if (settingsMainPlaceholder) settingsMainPlaceholder.classList.add('hidden');

        if (currentTargetUserId) {
            // Chat Active
            if (messagesEl) messagesEl.classList.remove('hidden');
            if (chatHeaderEl) chatHeaderEl.classList.remove('hidden');
            if (composerEl) composerEl.classList.remove('hidden');
            if (emptyStateEl) emptyStateEl.classList.add('hidden');
        } else {
            // No Chat Active
            if (emptyStateEl) emptyStateEl.classList.remove('hidden');
            if (messagesEl) messagesEl.classList.add('hidden');
            if (chatHeaderEl) chatHeaderEl.classList.add('hidden');
            if (composerEl) composerEl.classList.add('hidden');
        }

        // Animate out if open
        if (comingSoonModal && !comingSoonModal.classList.contains('hidden')) {
            comingSoonModal.classList.remove('slide-in');
            comingSoonModal.classList.add('slide-out');
            setTimeout(() => {
                comingSoonModal.classList.add('hidden');
                comingSoonModal.classList.remove('slide-out');
            }, 280); // match css duration
        }
    });
}

const settingsView = document.getElementById('settingsView');
const usersListEl = document.getElementById('usersList');
const brandHeaderEl = document.querySelector('.brand-header');
const favoritesSectionEl = document.querySelector('.favorites-section');
const searchTriggerEl = document.querySelector('.search-trigger');

// 2. Settings Button
if (navSettingsBtn) {
    navSettingsBtn.addEventListener('click', () => {
        setActiveDockIcon(navSettingsBtn);
        if (comingSoonModal && !comingSoonModal.classList.contains('hidden')) {
            comingSoonModal.classList.add('hidden');
        }

        // Hide Main Sidebar Elements
        if (usersListEl) usersListEl.classList.add('hidden');
        if (brandHeaderEl) brandHeaderEl.style.display = 'none';
        if (favoritesSectionEl) favoritesSectionEl.style.display = 'none';
        if (searchTriggerEl) searchTriggerEl.style.display = 'none';

        // Show Settings
        if (settingsView) {
            settingsView.classList.remove('hidden');
            renderSettingsView();
        }

        // --- MAIN COLUMN TOGGLE ---
        const settingsMainPlaceholder = document.getElementById('settingsMainPlaceholder');
        const emptyStateEl = document.getElementById('emptyState');
        const messagesEl = document.getElementById('messages');
        const chatHeaderEl = document.querySelector('.chat-header');
        const composerEl = document.querySelector('.composer');

        if (emptyStateEl) emptyStateEl.classList.add('hidden');
        if (messagesEl) messagesEl.classList.add('hidden');
        if (chatHeaderEl) chatHeaderEl.classList.add('hidden');
        if (composerEl) composerEl.classList.add('hidden');

        if (settingsMainPlaceholder) {
            settingsMainPlaceholder.classList.remove('hidden');
            settingsMainPlaceholder.style.display = 'flex';
        }
    });
}

// 3. Other Buttons (Calls, Contacts) -> Close settings if open
if (navCallsBtn) {
    navCallsBtn.addEventListener('click', () => {
        // Desktop: Post Status / Story
        if (window.innerWidth > 768) {
            createNewStory();
            return;
        }

        // Mobile: Calls Logic
        setActiveDockIcon(navCallsBtn);
        if (comingSoonModal && !comingSoonModal.classList.contains('hidden')) {
            comingSoonModal.classList.remove('slide-in');
            comingSoonModal.classList.add('slide-out');
            setTimeout(() => {
                comingSoonModal.classList.add('hidden');
                comingSoonModal.classList.remove('slide-out');
            }, 280);
        }
        // TODO: Show calls view
    });
}

if (navContactsBtn) {
    navContactsBtn.addEventListener('click', () => {
        setActiveDockIcon(navContactsBtn);
        window.currentSidebarTab = 'channels'; // Set state

        if (comingSoonModal && !comingSoonModal.classList.contains('hidden')) {
            comingSoonModal.classList.remove('slide-in');
            comingSoonModal.classList.add('slide-out');
            setTimeout(() => {
                comingSoonModal.classList.add('hidden');
                comingSoonModal.classList.remove('slide-out');
            }, 280);
        }

        // Hide Settings / Show Users List
        if (settingsView) settingsView.classList.add('hidden');
        if (usersListEl) {
            usersListEl.classList.remove('hidden');
            renderMixedSidebar(); // Re-render for channels
        }

        // Keep header and search, but hide stories (favorites)
        if (brandHeaderEl) brandHeaderEl.style.display = '';
        if (searchTriggerEl) searchTriggerEl.style.display = '';
        if (favoritesSectionEl) favoritesSectionEl.style.display = 'none';

        // --- MAIN COLUMN TOGGLE ---
        const settingsMainPlaceholder = document.getElementById('settingsMainPlaceholder');
        const emptyStateEl = document.getElementById('emptyState');
        const messagesEl = document.getElementById('messages');
        const chatHeaderEl = document.querySelector('.chat-header');
        const composerEl = document.querySelector('.composer');

        if (settingsMainPlaceholder) settingsMainPlaceholder.classList.add('hidden');

        // Return to empty state if viewing settings, similar to chat button logic
        if (!currentTargetUserId) {
            if (emptyStateEl) emptyStateEl.classList.remove('hidden');
            if (messagesEl) messagesEl.classList.add('hidden');
            if (chatHeaderEl) chatHeaderEl.classList.add('hidden');
            if (composerEl) composerEl.classList.add('hidden');
        }
    });
}

// Close button inside modal (X) -> Return to Chat
if (closeComingSoon) {
    closeComingSoon.addEventListener('click', () => {
        if (comingSoonModal) {
            comingSoonModal.classList.remove('slide-in');
            comingSoonModal.classList.add('slide-out');
            setTimeout(() => {
                comingSoonModal.classList.add('hidden');
                comingSoonModal.classList.remove('slide-out');
                // Reset active icon to Chat
                setActiveDockIcon(navChatBtn);
            }, 280);
        }
    });
}

/* Close coming soon on backdrop click if needed */
if (comingSoonModal) {
    comingSoonModal.addEventListener('click', (e) => {
        if (e.target === comingSoonModal) {
            comingSoonModal.classList.add('hidden');
            setActiveDockIcon(navChatBtn);
        }
    });
}

/* --- SEARCH INPUT ROBUSTNESS --- */
const searchInputEl = document.getElementById('searchUsers');
const searchBackBtn = document.getElementById('searchIconBack');

function exitMobileSearch() {
    if (searchInputEl) {
        searchInputEl.value = '';
        searchInputEl.blur();
        if (window.applyUserFilter) window.applyUserFilter();
    }
    document.body.classList.remove('mobile-search-active');

    // Reset transform after small delay to avoid jump? No, allow CSS transition back.
}
window.exitMobileSearch = exitMobileSearch;

if (searchInputEl) {
    // Mobile search behavior: Expand on focus
    searchInputEl.addEventListener('focus', () => {
        // Calculate exact height to slide up using Summation (More Stable)
        const header = document.querySelector('.brand-header');
        const favs = document.querySelector('.favorites-section');

        let totalH = 0;
        if (header) totalH += header.offsetHeight;
        if (favs) totalH += favs.offsetHeight;

        // We set this variable for CSS to use in transform calculation
        document.documentElement.style.setProperty('--search-move-up', `${totalH}px`);

        document.body.classList.add('mobile-search-active');
    });

    // Do NOT remove on blur automatically to allow interaction with back button and results
    // searchInputEl.addEventListener('blur', () => { ... }); 

    if (searchBackBtn) {
        searchBackBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            exitMobileSearch();
        });
    }

    // Remove existing if possible (not possible without reference), but adding another safe one is fine
    // Force trigger filter on all possible input events to capture clears
    ['input', 'keyup', 'search', 'paste', 'change'].forEach(evt => {
        searchInputEl.addEventListener(evt, () => {
            // Use a small delay for paste/cut to ensure value is updated
            setTimeout(() => {
                if (window.applyUserFilter) window.applyUserFilter();
            }, 0);
        });
    });
}


/* =========================================
   STORY / STATUS FEATURE IMPLEMENTATION
   ========================================= */

let currentStoryQueue = [];
let currentStoryIndex = 0;
let storiesCache = [];
let isStoryMode = false; // Flag for Image Editor

// Fetch stories from API
async function loadStories() {
    if (!myUser) return;
    try {
        const stories = await apiRequest('/api/stories/list');
        if (stories) {
            storiesCache = stories;
            renderStoriesBar(stories);

            // Re-render sidebar/user list to show story rings
            if (typeof renderMixedSidebar === 'function') renderMixedSidebar();
            if (typeof applyUserFilter === 'function') applyUserFilter();
        }
    } catch (e) {
        console.error("Error loading stories:", e);
    }
}

// Render the top bar (Favorites Section -> Stories Section)
function renderStoriesBar(groupedStories) {
    const container = document.querySelector('.favorites-section');
    if (!container) return;

    container.innerHTML = '';

    // 1. "My Story" / Add New Button
    const myStoriesGroup = groupedStories.find(g => g.userId === myUser.id);
    const hasMyStory = myStoriesGroup && myStoriesGroup.stories.length > 0;
    const allMyStoriesViewed = hasMyStory && myStoriesGroup.stories.every(s => s.isViewed);

    const myItem = document.createElement('div');
    myItem.className = 'fav-item add-new';

    const myData = renderAvatarContent(myUser, 'text-avatar');
    // For stories bar, the container is fav-avatar, so we use style and html directly

    // Note: renderAvatarContent returns style with background-image/background-color.
    // The existing structure uses .fav-avatar with style="background-image:..."
    // We can just swap styles and inject html

    const ringClass = hasMyStory
        ? (allMyStoriesViewed ? 'fav-avatar-wrapper has-story all-viewed' : 'fav-avatar-wrapper has-story')
        : 'fav-avatar-wrapper';

    myItem.innerHTML = `
        <div class="${ringClass}">
            <div class="fav-avatar" style="${myData.style}">
                ${myData.html}
                ${!hasMyStory ? `
                <div class="add-story-icon-overlay">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </div>` : ''}
            </div>
        </div>
        <span class="fav-name">Tu historia</span>
    `;

    myItem.onclick = () => {
        if (hasMyStory) {
            // View my stories
            openStoryViewer(myUser.id);
        } else {
            // Create new
            createNewStory();
        }
    };

    container.appendChild(myItem);


    // 2. Friends Stories
    groupedStories.forEach(group => {
        if (group.userId === myUser.id) return; // Skip me (handled above)
        if (group.stories.length === 0) return;

        const item = document.createElement('div');
        item.className = 'fav-item';

        const allViewed = group.stories.every(s => s.isViewed);
        const ringClass = allViewed ? 'fav-avatar-wrapper has-story all-viewed' : 'fav-avatar-wrapper has-story';

        const groupData = renderAvatarContent(group, 'text-avatar');

        item.innerHTML = `
            <div class="${ringClass}">
                <div class="fav-avatar" style="${groupData.style}">
                    ${groupData.html}
                </div>
            </div>
            <span class="fav-name">${escapeHtml(group.display_name || group.username).split(' ')[0]}</span>
        `;

        item.onclick = () => openStoryViewer(group.userId);
        container.appendChild(item);
    });
}

async function createNewStory() {
    // Check if Capacitor Camera is available
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
        try {
            const image = await window.Capacitor.Plugins.Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: 'uri',
                source: 'PROMPT' // Prompts for Photo or Camera
            });

            const imageUrl = image.webPath;
            // Fetch the blob from webPath to prepare for upload
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // Name it somewhat randomly or use default
            const file = new File([blob], `story_${Date.now()}.jpg`, { type: blob.type });

            openEditorWithFile(file, imageUrl);

        } catch (error) {
            console.error('Camera cancelled or failed:', error);
            // Don't show alert if cancelled, just return
        }
        return;
    }

    // Fallback for Web
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            openEditorWithFile(file, evt.target.result);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function openEditorWithFile(file, srcUrl) {
    // Open Editor in Story Mode
    isStoryMode = true;

    const img = document.getElementById('imageToEdit');
    img.src = srcUrl;

    currentEditFile = file; // Global used by editor

    imageEditorModal.classList.remove('hidden');
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('mainFooter').classList.remove('hidden');
    document.getElementById('cropFooter').classList.add('hidden');

    if (window.cropper) { window.cropper.destroy(); window.cropper = null; }
}

// Override Send Button Logic
const oldBtn = document.getElementById('sendImageBtn');
if (oldBtn) {
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    newBtn.addEventListener('click', async () => {
        const caption = document.getElementById('imageCaptionInput').value.trim();
        let blobToSend = currentEditFile;

        if (isStoryMode) {
            // Upload Story
            if (!blobToSend) return;

            newBtn.disabled = true;
            newBtn.innerHTML = '...';
            showToast("Subiendo estado, por favor espera...");

            const formData = new FormData();
            formData.append('image', blobToSend);
            if (caption) formData.append('caption', caption);

            try {
                const res = await apiRequest('/api/stories/create', 'POST', formData);
                if (res && res.mediaUrl) {
                    showToast("Historia subida correctamente");
                    imageEditorModal.classList.add('hidden');
                    loadStories(); // Refresh
                } else {
                    // Fallback para debug
                    console.error("Upload failed", res);
                    const statusStr = res ? JSON.stringify(res) : "null response";
                    alert("Error al subir historia. Detalles: " + statusStr);
                }
            } catch (e) {
                console.error(e);
                alert("Error de conexión: " + e.message);
            } finally {
                newBtn.disabled = false;
                newBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
                isStoryMode = false;
                document.getElementById('imageToEdit').src = '';
                document.getElementById('imageCaptionInput').value = '';
            }

        } else {
            // ORIGINAL CHAT BEHAVIOR
            if (!currentTargetUserId) return;
            if (!currentEditFile && !document.getElementById('imageToEdit').src) return;

            const reader = new FileReader();
            reader.onload = function (evt) {
                const buffer = evt.target.result;

                socket.emit('chat image', {
                    toUserId: currentTargetUserId,
                    file: buffer,
                    caption: caption,
                    fileName: currentEditFile.name,
                    mimeType: currentEditFile.type
                });

                imageEditorModal.classList.add('hidden');
                document.getElementById('imageToEdit').src = '';
                document.getElementById('imageCaptionInput').value = '';
            };
            reader.readAsArrayBuffer(currentEditFile);
        }
    });
}


/* ==========================
   STORY VIEWER UI
   ========================== */
function openStoryViewer(userId) {
    const group = storiesCache.find(g => g.userId === userId);
    if (!group) return;

    currentStoryQueue = group.stories;
    currentStoryIndex = 0;

    // Find first unseen logic here if we had detailed view tracking per story
    // For now starts at 0

    renderStoryModal();
}



function toggleStoryMenu() {
    const menu = document.getElementById('storyMenuDropdown');
    const isHidden = menu.classList.contains('hidden');

    // Pause story timer while menu is open
    if (isHidden) {
        clearTimeout(storyTimer);
        menu.classList.remove('hidden');
        renderStoryMenuOptions();
    } else {
        menu.classList.add('hidden');
        resumeStoryTimer();
    }
}

// Helper to create valid button elements avoiding inline onclick
function createMenuButton(text, iconSvg, isDanger, onClick) {
    const btn = document.createElement('button');
    btn.className = `story-menu-item ${isDanger ? 'danger' : ''}`;
    btn.innerHTML = `${iconSvg} ${text}`;
    btn.addEventListener('click', onClick);
    return btn;
}

function renderStoryMenuOptions() {
    const menu = document.getElementById('storyMenuDropdown');
    menu.innerHTML = ''; // Clear previous content
    const story = currentStoryQueue[currentStoryIndex];

    // Edit Button
    const editIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    menu.appendChild(createMenuButton('Editar', editIcon, false, () => {
        onEditStoryCaption(story.id, story.caption || '');
    }));

    // Hide/Show Button
    const hideIcon = story.isHidden
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    const hideText = story.isHidden ? 'Mostrar' : 'Ocultar';
    menu.appendChild(createMenuButton(hideText, hideIcon, false, () => {
        onToggleHideStory(story.id);
    }));

    // Delete Button
    const deleteIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    menu.appendChild(createMenuButton('Eliminar', deleteIcon, true, () => {
        onDeleteStory(story.id);
    }));
}

async function onDeleteStory(storyId) {
    if (!confirm("¿Eliminar esta historia?")) return;
    try {
        await apiRequest(`/api/stories/${storyId}`, 'DELETE');
        showToast("Historia eliminada");
        closeStoryViewer(); // Close and let it reload
    } catch (e) { console.error(e); showToast("Error al eliminar"); }
}

async function onToggleHideStory(storyId) {
    try {
        const res = await apiRequest(`/api/stories/${storyId}/hide`, 'PUT');
        if (res && res.success) {
            // Update local model
            const story = currentStoryQueue.find(s => s.id == storyId);
            if (story) story.isHidden = res.isHidden;
            toggleStoryMenu(); // close menu
            showToast(res.isHidden ? "Historia ocultada" : "Historia visible");
        }
    } catch (e) { console.error(e); }
}

async function onEditStoryCaption(storyId, currentCaption) {
    const newCaption = prompt("Editar comentario:", currentCaption);
    if (newCaption === null) return; // Cancel

    try {
        await apiRequest(`/api/stories/${storyId}/edit`, 'PUT', { caption: newCaption });
        // Update local
        const story = currentStoryQueue.find(s => s.id == storyId);
        if (story) story.caption = newCaption;

        toggleStoryMenu();
        const capEl = document.getElementById('storyCaption');
        if (newCaption) {
            capEl.textContent = newCaption;
            capEl.classList.remove('hidden');
        } else {
            capEl.classList.add('hidden');
        }
        showToast("Historia actualizada");
    } catch (e) { console.error(e); }
}

async function openStoryViewers() {
    clearTimeout(storyTimer); // Pause
    const story = currentStoryQueue[currentStoryIndex];
    document.getElementById('storyViewersModal').classList.add('active');

    const list = document.getElementById('viewersList');
    list.innerHTML = '<li style="color:#888; text-align:center; padding:20px;">Cargando...</li>';

    try {
        const viewers = await apiRequest(`/api/stories/${story.id}/viewers`);
        list.innerHTML = '';
        if (!viewers || viewers.length === 0) {
            list.innerHTML = '<li style="color:#888; text-align:center; padding:20px;">Nadie ha visto esto aún.</li>';
            return;
        }

        viewers.forEach(v => {
            const date = new Date(v.viewed_at);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const li = document.createElement('li');
            li.className = 'viewer-item';
            li.innerHTML = `
                <div class="viewer-avatar" style="background-image: url('${escapeHtml(v.avatar || '/profile.png')}')"></div>
                <div class="viewer-info">
                    <div class="viewer-name">${escapeHtml(v.display_name || v.username)}</div>
                    <div class="viewer-time">${timeStr}</div>
                </div>
            `;
            list.appendChild(li);
        });

    } catch (e) {
        list.innerHTML = '<li style="color:red; text-align:center;">Error al cargar</li>';
    }
}

function closeViewersModal() {
    document.getElementById('storyViewersModal').classList.remove('active');
    resumeStoryTimer();
}

function resumeStoryTimer() {
    clearTimeout(storyTimer);
    storyTimer = setTimeout(nextStory, 5000); // Restart timer
}

let storyTimer;

function showStory(index) {
    if (index < 0 || index >= currentStoryQueue.length) {
        closeStoryViewer();
        return;
    }

    currentStoryIndex = index;
    const story = currentStoryQueue[index];
    // Robust find group
    const group = storiesCache.find(g => g.stories.some(s => s.id === story.id));

    const img = document.getElementById('storyImage');
    img.src = story.mediaUrl;

    // Set blurred background
    const bgBlur = document.getElementById('storyBackground');
    if (bgBlur) bgBlur.style.backgroundImage = `url('${story.mediaUrl}')`;

    document.getElementById('storyUserName').textContent = group ? (group.display_name || group.username) : 'Usuario';
    document.getElementById('storyUserAvatar').style.backgroundImage = `url('${group ? (group.avatar || '/profile.png') : '/profile.png'}')`;

    const timeDiff = new Date() - new Date(story.createdAt);
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const mins = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    document.getElementById('storyTime').textContent = hours > 0 ? `Hace ${hours}h` : `Hace ${mins}m`;

    const capEl = document.getElementById('storyCaption');
    if (story.caption) {
        capEl.textContent = story.caption;
        capEl.classList.remove('hidden');
    } else {
        capEl.classList.add('hidden');
    }

    // Toggle Menu and Views
    const isMyStory = story.userId === myUser.id || (group && group.userId === myUser.id);
    const menuBtn = document.getElementById('storyMenuBtn');
    const viewsBtn = document.getElementById('storyViewsBtn');

    if (menuBtn && viewsBtn) {
        if (isMyStory) {
            menuBtn.classList.remove('hidden');
            viewsBtn.classList.remove('hidden');
            document.getElementById('storyViewsCount').textContent = story.viewCount || 0;

            // Visual cue for hidden story
            if (story.isHidden) {
                img.style.filter = "grayscale(100%)";
                document.getElementById('storyTime').textContent += " (Oculta)";
            } else {
                img.style.filter = "none";
            }

        } else {
            menuBtn.classList.add('hidden');
            viewsBtn.classList.add('hidden');
            img.style.filter = "none";
            const dropdown = document.getElementById('storyMenuDropdown');
            if (dropdown) dropdown.classList.add('hidden');
        }
    }

    const barsContainer = document.getElementById('storyProgressBars');
    barsContainer.innerHTML = '';
    currentStoryQueue.forEach((s, i) => {
        const bar = document.createElement('div');
        bar.className = 'story-bar';
        const fill = document.createElement('div');
        fill.className = 'story-bar-fill';

        if (i < index) fill.style.width = '100%';
        else if (i === index) setTimeout(() => fill.classList.add('animating'), 50);
        else fill.style.width = '0%';

        bar.appendChild(fill);
        barsContainer.appendChild(bar);
    });

    if (!isMyStory) {
        apiRequest(`/api/stories/${story.id}/view`, 'POST');
    }

    clearTimeout(storyTimer);
    storyTimer = setTimeout(nextStory, 5000);
}

function nextStory() {
    showStory(currentStoryIndex + 1);
}

function prevStory() {
    if (currentStoryIndex > 0) showStory(currentStoryIndex - 1);
    else showStory(0);
}

function closeStoryViewer() {
    const modal = document.getElementById('storyViewerModal');
    if (modal) modal.classList.add('hidden');
    clearTimeout(storyTimer);
    loadStories(); // Refresh list
    loadStories(); // Refresh list
}

// Custom Context Menu for Chat Profile Picture
let profileCtxTargetUid = null;
const chatProfileContextMenu = getEl('chatProfileContextMenu');
const chatProfileCtxBackdrop = getEl('chatProfileCtxBackdrop');
const ctxProfilePinBtn = getEl('ctxProfilePinBtn');
const ctxProfileMuteBtn = getEl('ctxProfileMuteBtn');

const chatProfileModalWrapper = getEl('chatProfileModalWrapper');
const chatProfilePreview = getEl('chatProfilePreview');
const previewChatAvatar = getEl('previewChatAvatar');
const previewChatName = getEl('previewChatName');
const chatProfilePreviewMessages = getEl('chatProfilePreviewMessages');

// Pagination state for preview
let previewOldestMessageId = null;
let previewIsLoadingHistory = false;
let previewAllHistoryLoaded = false;

async function openChatProfileContextMenu(u, x, y) {
    if (!chatProfileContextMenu) return;
    const uid = u.userId;
    profileCtxTargetUid = uid;

    chatProfileContextMenu.classList.remove('hidden');

    // Check if it's a channel or custom chat type - only show preview for normal users
    const isNormalChat = !u.chat_type || u.chat_type === 'private';

    if (isNormalChat && chatProfilePreview) {
        chatProfilePreview.classList.remove('hidden');

        // Header info
        const name = myNicknames[uid] || u.display_name || u.username || 'Usuario';
        previewChatName.textContent = name;

        // Update Pin Button State
        const pinnedChats = getPinnedChats();
        const isPinned = pinnedChats.includes(uid);
        if (ctxProfilePinBtn) {
            if (isPinned) {
                ctxProfilePinBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none">
                        <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2"></line>
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                    </svg>
                    <span>Desfijar</span>
                `;
            } else {
                ctxProfilePinBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22"></line>
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                    </svg>
                    <span>Fijar</span>
                `;
            }
        }

        let safeAvatar = '/profile.png';
        if (u.avatar && typeof u.avatar === 'string' && u.avatar.trim() !== '' && u.avatar !== 'null') {
            safeAvatar = u.avatar;
            if (!safeAvatar.startsWith('http') && !safeAvatar.startsWith('/')) {
                safeAvatar = '/' + safeAvatar;
            }
        }
        previewChatAvatar.style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;

        // Reset Pagination state
        previewOldestMessageId = null;
        previewIsLoadingHistory = false;
        previewAllHistoryLoaded = false;

        // Show loading state BEFORE the await
        chatProfilePreviewMessages.innerHTML = '<li style="text-align:center;color:#666;font-size:12px;margin:20px;">Cargando mensajes...</li>';
    } else if (chatProfilePreview) {
        // If channel, hide preview completely
        chatProfilePreview.classList.add('hidden');
    }

    // --- INSTANT UI DISPLAY LOGIC ---
    if (chatProfileModalWrapper) {
        // Reset layout for measurements
        chatProfileModalWrapper.style.left = '0px';
        chatProfileModalWrapper.style.top = '0px';
        chatProfileModalWrapper.style.right = 'auto';
        chatProfileModalWrapper.style.bottom = 'auto';
        chatProfileModalWrapper.style.transform = 'scale(0.95)';

        // Quick layout pass to get dimensions
        const rect = chatProfileModalWrapper.getBoundingClientRect();
        const menuW = rect.width || 420;
        const menuH = rect.height || 500;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Center Horizontally
        let finalX = Math.max(10, (winW - menuW) / 2);

        // Center Vertically, slightly offset
        let finalY = Math.max(10, (winH - menuH) / 2);

        chatProfileModalWrapper.style.left = finalX + 'px';
        chatProfileModalWrapper.style.top = finalY + 'px';

        // Add pop animation
        chatProfileModalWrapper.style.opacity = '0';

        requestAnimationFrame(() => {
            chatProfileModalWrapper.style.transform = 'scale(1)';
            chatProfileModalWrapper.style.opacity = '1';
        });
    }

    // --- AWAIT DATA LOAD LOGIC ---
    if (isNormalChat && chatProfilePreview) {
        try {
            // Fetch messages specifically for preview
            const history = await apiRequest(`/api/messages/messages/${myUser.id}/${uid}?limit=20`);
            chatProfilePreviewMessages.innerHTML = '';

            if (history && history.length > 0) {
                previewOldestMessageId = history[0].id;
                previewAllHistoryLoaded = true; // No more loading

                // Reverse to show oldest first at top, newest at bottom, just like the real chat
                let lastDateStr = null;

                history.forEach(msg => {
                    let rd = null;
                    if (msg.reply_to_id) {
                        let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
                        let rContent = msg.reply_content;
                        if (msg.reply_type === 'image') rContent = ICONS.replyImage;
                        else if (msg.reply_type === 'audio') rContent = ICONS.replyAudio;
                        rd = { id: msg.reply_to_id, username: rName, content: rContent, type: msg.reply_type };
                    }
                    let fixedDate = msg.timestamp;
                    if (typeof fixedDate === 'string' && fixedDate.includes(' ')) {
                        fixedDate = fixedDate.replace(' ', 'T') + 'Z';
                    }

                    const isSystemMsg = msg.type === 'system' || msg.type === 'date_divider' || false;

                    appendMessageUI(
                        msg.content,
                        msg.from_user_id === myUser.id ? 'me' : 'other',
                        fixedDate,
                        msg.id,
                        msg.type,
                        rd,
                        msg.is_deleted,
                        msg.caption,
                        msg.is_edited,
                        msg.from_user_id,
                        msg.username,
                        'sent',
                        chatProfilePreviewMessages, // crucial: render in preview container
                        false,
                        'preview-msg' // extraClass to disable reply swipe and long press
                    );
                });

                // Scroll to bottom
                requestAnimationFrame(() => {
                    const scrollArea = chatProfilePreviewMessages.parentElement;
                    if (scrollArea) {
                        // Re-evaluate scroll after appending everything
                        scrollArea.scrollTop = scrollArea.scrollHeight;
                        // Pagination removed as requested
                        scrollArea.onscroll = null;
                    }
                });

            } else {
                chatProfilePreviewMessages.innerHTML = '<li style="text-align:center;color:#666;font-size:12px;margin:20px;">No hay mensajes</li>';
                previewAllHistoryLoaded = true;
            }
        } catch (e) {
            console.error("Error loading preview messages:", e);
            chatProfilePreviewMessages.innerHTML = '<li style="text-align:center;color:#ef4444;font-size:12px;margin:20px;">Error al cargar</li>';
        }
    }
}

async function loadMorePreviewMessages(uid) {
    if (previewIsLoadingHistory || previewAllHistoryLoaded || !uid) return;
    previewIsLoadingHistory = true;

    const scrollArea = chatProfilePreviewMessages.parentElement;
    const oldScrollHeight = scrollArea.scrollHeight;

    const prevLoader = document.createElement('div');
    prevLoader.className = 'history-loader';
    prevLoader.innerHTML = '<div class="spinner"></div>';
    chatProfilePreviewMessages.prepend(prevLoader);

    try {
        const url = `/api/messages/messages/${myUser.id}/${uid}?limit=30&beforeId=${previewOldestMessageId}`;
        const olderMessages = await apiRequest(url);

        prevLoader.remove();

        if (!olderMessages || olderMessages.length === 0) {
            previewAllHistoryLoaded = true;
        } else {
            previewOldestMessageId = olderMessages[0].id;
            if (olderMessages.length < 30) {
                previewAllHistoryLoaded = true;
            }
            prependPreviewMessageBatch(olderMessages);

            requestAnimationFrame(() => {
                const newScrollHeight = scrollArea.scrollHeight;
                scrollArea.scrollTop = newScrollHeight - oldScrollHeight;
            });
        }
    } catch (e) {
        console.error("Error loading more preview messages:", e);
        prevLoader.remove();
    } finally {
        previewIsLoadingHistory = false;
    }
}

function prependPreviewMessageBatch(messages) {
    const fragment = document.createDocumentFragment();
    let batchPreviousDate = null;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    messages.forEach(msg => {
        let fixedDate = msg.timestamp;
        if (typeof fixedDate === 'string' && fixedDate.includes(' ')) {
            fixedDate = fixedDate.replace(' ', 'T') + 'Z';
        }

        // Date Divider Logic
        const dateObj = new Date(fixedDate);
        let label = dateObj.toLocaleDateString();
        if (dateObj.toDateString() === today.toDateString()) label = "Hoy";
        else if (dateObj.toDateString() === yesterday.toDateString()) label = "Ayer";

        if (label !== batchPreviousDate) {
            const li = document.createElement('li');
            li.className = 'date-divider history-message';
            li.innerHTML = `<span>${label}</span>`;
            fragment.appendChild(li);
            batchPreviousDate = label;
        }

        let rd = null;
        if (msg.reply_to_id) {
            let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
            let rContent = msg.reply_content;
            if (msg.reply_type === 'image') rContent = ICONS.replyImage;
            else if (msg.reply_type === 'audio') rContent = ICONS.replyAudio;
            rd = { id: msg.reply_to_id, username: rName, content: rContent, type: msg.reply_type };
        }

        const isMe = msg.from_user_id === myUser.id;
        appendMessageUI(
            msg.content,
            isMe ? 'me' : 'other',
            fixedDate,
            msg.id,
            msg.type,
            rd,
            msg.is_deleted,
            msg.caption,
            msg.is_edited,
            msg.from_user_id,
            msg.username,
            'sent',
            fragment,
            true,
            'history-message fade-in-history preview-msg'
        );
    });

    // Handle duplicate date dividers at intersection
    const firstChild = chatProfilePreviewMessages.firstElementChild;
    if (firstChild && firstChild.classList.contains('date-divider')) {
        const firstDateLabel = firstChild.innerText;
        if (firstDateLabel === batchPreviousDate) {
            firstChild.remove();
        }
    }

    chatProfilePreviewMessages.prepend(fragment);
}

function closeChatProfileContextMenu() {
    if (!chatProfileContextMenu || chatProfileContextMenu.classList.contains('hidden')) return;

    if (chatProfileModalWrapper) {
        chatProfileModalWrapper.style.transform = 'scale(0.95)';
        chatProfileModalWrapper.style.opacity = '0';
        setTimeout(() => {
            chatProfileContextMenu.classList.add('hidden');
            profileCtxTargetUid = null;
            if (chatProfilePreviewMessages) {
                chatProfilePreviewMessages.innerHTML = '';
                if (chatProfilePreviewMessages.parentElement) chatProfilePreviewMessages.parentElement.onscroll = null;
            }
        }, 150); // wait for animation
    } else {
        chatProfileContextMenu.classList.add('hidden');
        profileCtxTargetUid = null;
        if (chatProfilePreviewMessages) {
            chatProfilePreviewMessages.innerHTML = '';
            if (chatProfilePreviewMessages.parentElement) chatProfilePreviewMessages.parentElement.onscroll = null;
        }
    }
}

if (chatProfileCtxBackdrop) {
    chatProfileCtxBackdrop.addEventListener('click', closeChatProfileContextMenu);
    chatProfileCtxBackdrop.addEventListener('touchstart', (e) => {
        e.preventDefault();
        closeChatProfileContextMenu();
    }, { passive: false });
}

function getPinnedChats() {
    if (!myUser || !myUser.id) return [];
    try {
        const stored = localStorage.getItem('pinnedChats_' + myUser.id);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

function setPinnedChats(pins) {
    if (!myUser || !myUser.id) return;
    localStorage.setItem('pinnedChats_' + myUser.id, JSON.stringify(pins));
}

function togglePinChat(uid) {
    let pins = getPinnedChats();
    const isPinning = !pins.includes(uid);

    if (isPinning) {
        pins.unshift(uid); // Add to top of pinned
        showToast("Chat fijado");
        window.justPinnedUid = uid;
    } else {
        pins = pins.filter(id => id !== uid);
        showToast("Chat desfijado");
    }
    setPinnedChats(pins);

    const li = document.querySelector(`.user-item[data-uid="${uid}"]`);
    if (li) {
        li.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        li.style.transform = isPinning ? 'translateY(-20px)' : 'translateY(20px)';
        li.style.opacity = '0';

        setTimeout(() => {
            const searchInput = document.getElementById('searchUsers');
            if (searchInput && searchInput.value.trim()) {
                applyUserFilter();
            } else {
                renderMixedSidebar();
            }
        }, 250);
    } else {
        const searchInput = document.getElementById('searchUsers');
        if (searchInput && searchInput.value.trim()) {
            applyUserFilter();
        } else {
            renderMixedSidebar();
        }
    }
}


if (ctxProfilePinBtn) {
    ctxProfilePinBtn.addEventListener('click', () => {
        if (profileCtxTargetUid) {
            togglePinChat(profileCtxTargetUid);
        }
        closeChatProfileContextMenu();
    });
}

if (ctxProfileMuteBtn) {
    ctxProfileMuteBtn.addEventListener('click', () => {
        // Not functional yet
        closeChatProfileContextMenu();
    });
}

function renderStoryModal() {
    let modal = document.getElementById('storyViewerModal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="storyViewerModal" class="story-viewer hidden">
                <div id="storyBackground" class="story-bg-blur"></div>
                <div class="story-progress-container" id="storyProgressBars"></div>
                
                <div class="story-header">
                    <div class="story-user-info">
                        <div class="story-avatar" id="storyUserAvatar"></div>
                        <span class="story-username" id="storyUserName"></span>
                        <span class="story-time" id="storyTime"></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                         <button class="story-menu-btn hidden" id="storyMenuBtn">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                            </svg>
                        </button>
                        <button class="story-close-btn" id="closeStoryBtn">✕</button>
                    </div>
                </div>

                <!-- MENU DROPDOWN -->
                <div id="storyMenuDropdown" class="story-menu-dropdown hidden"></div>

                <div class="story-content">
                    <img id="storyImage" src="" alt="Story">
                    <div class="story-caption-overlay hidden" id="storyCaption"></div>
                </div>

                <!-- VIEWS BUTTON -->
                <button id="storyViewsBtn" class="story-views-btn hidden">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span id="storyViewsCount">0</span>
                </button>

                <!-- VIEWERS MODAL -->
                <div id="storyViewersModal" class="viewers-modal">
                    <div class="viewers-header">
                        <span>Visto por</span>
                        <button id="closeViewersBtn" style="background:none; border:none; color:#fff; font-size:20px;">✕</button>
                    </div>
                    <ul id="viewersList" class="viewers-list"></ul>
                </div>

                <div class="story-nav-left" id="storyPrevArea"></div>
                <div class="story-nav-right" id="storyNextArea"></div>
            </div>
        `);
        modal = document.getElementById('storyViewerModal');

        document.getElementById('closeStoryBtn').onclick = closeStoryViewer;
        document.getElementById('storyPrevArea').onclick = prevStory;
        document.getElementById('storyNextArea').onclick = nextStory;

        document.getElementById('storyMenuBtn').onclick = (e) => {
            e.stopPropagation();
            toggleStoryMenu();
        };

        document.getElementById('storyViewsBtn').onclick = (e) => {
            e.stopPropagation();
            openStoryViewers();
        };

        document.getElementById('storyViewersModal').onclick = (e) => e.stopPropagation();
        document.getElementById('closeViewersBtn').onclick = closeViewersModal;

        // Close menu on click elsewhere
        modal.onclick = (e) => {
            if (!e.target.closest('#storyMenuDropdown') && !e.target.closest('#storyMenuBtn')) {
                document.getElementById('storyMenuDropdown').classList.add('hidden');
            }
            if (!e.target.closest('.viewers-modal') && !e.target.closest('#storyViewsBtn')) {
                closeViewersModal();
            }
        };
    }

    modal.classList.remove('hidden');
    showStory(currentStoryIndex);
}

const storyStyles = document.createElement('style');
storyStyles.innerHTML = `
:root {
    --bg-dark: #050505;
    --border-dim: rgba(255, 255, 255, 0.05);
    --border-light: rgba(255, 255, 255, 0.08);
    --text-dim: #a1a1aa;
    --hover-bg: rgba(255, 255, 255, 0.08);
}

.story-viewer {
    position: fixed; inset: 0; background: var(--bg-dark); z-index: 9999;
    display: flex; flex-direction: column; overflow: hidden;
    font-family: inherit; /* Inherit main font */
}
.story-bg-blur {
    position: absolute; inset: -50px; background-size: cover; background-position: center;
    filter: blur(50px) brightness(0.4); z-index: 1; opacity: 0.6; pointer-events: none;
}
.story-content {
    flex: 1; display: flex; align-items: center; justify-content: center; position: relative; z-index: 5;
}
.story-content img {
    max-width: 100%; max-height: 100%; object-fit: contain;
    /* Removed heavy shadow for cleaner look matching sidebar */
}
.story-header {
    position: absolute; top: 0; left: 0; right: 0; padding: 20px 24px; /* Match sidebar padding */
    z-index: 20; display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(to bottom, rgba(5,5,5,0.9), transparent);
}
.story-user-info { display: flex; align-items: center; gap: 12px; color: #fff; }
.story-avatar { 
    width: 36px; height: 36px; border-radius: 12px; /* Match sidebar avatar radius roughly */
    background-size: cover; border: 1px solid var(--border-light); 
    background-color: #222; 
}
.story-username { font-weight: 700; font-size: 16px; color: #fff; } /* Match sidebar .brand-title weight/color roughly */
.story-time { font-size: 12px; color: var(--text-dim); font-weight: 500; }
.story-close-btn { 
    background: rgba(255,255,255,0.05); border: 1px solid var(--border-light); 
    color: #fff; width: 32px; height: 32px; border-radius: 50%; 
    display: flex; align-items: center; justify-content: center; 
    cursor: pointer; transition: all 0.2s; font-size: 16px;
}
.story-close-btn:hover { background: var(--hover-bg); }

.story-menu-btn {
    background: rgba(255,255,255,0.05); border: 1px solid var(--border-light); border-radius: 50%; 
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; 
    color: #fff; cursor: pointer; transition: background 0.2s;
}
.story-menu-btn:hover { background: var(--hover-bg); }

.story-menu-dropdown {
    position: absolute; top: 70px; right: 24px; 
    background: var(--bg-dark); /* Match sidebar bg */
    border-radius: 16px; padding: 6px; min-width: 180px;
    z-index: 50; border: 1px solid var(--border-light);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.story-menu-item {
    display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px;
    background: none; border: none; color: #e4e4e7; /* Match pill text */
    text-align: left; font-size: 14px; font-weight: 500;
    border-radius: 10px; cursor: pointer; transition: background 0.2s;
}
.story-menu-item:hover { background: var(--hover-bg); color: #fff; }
.story-menu-item.danger { color: #ef4444; }

/* Views Button Pill - Matches .user-pill style */
.story-views-btn {
    position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-light);
    padding: 8px 20px; border-radius: 30px;
    color: #e4e4e7; cursor: pointer;
    backdrop-filter: blur(10px); z-index: 25; font-size: 14px; font-weight: 600;
    transition: all 0.2s;
}
.story-views-btn:hover { background: var(--hover-bg); border-color: rgba(255,255,255,0.15); }

/* Viewers Modal - Matches Floating Dock / Sidebar style */
.viewers-modal {
    position: absolute; bottom: 0; left: 0; right: 0; 
    background: var(--bg-dark);
    border-top-left-radius: 24px; border-top-right-radius: 24px;
    height: 70%; z-index: 60; transform: translateY(100%); 
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex; flex-direction: column; overflow: hidden;
    border-top: 1px solid var(--border-light);
    box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
}
.viewers-modal.active { transform: translateY(0); }
.viewers-header {
    padding: 20px 24px 10px 24px; /* Match .brand-header padding structure */
    border-bottom: none; /* Sidebar headers don't strictly have borders, cleaner look */
    display: flex; justify-content: space-between; align-items: center; 
    color: #fff; font-size: 18px; font-weight: 800; letter-spacing: -0.5px;
}
.viewers-list { flex: 1; overflow-y: auto; padding: 10px 20px; }
.viewer-item {
    display: flex; align-items: center; gap: 16px; padding: 14px 12px; /* Exact match to .user-item */
    border-radius: 20px;
    transition: background 0.2s;
    cursor: default; /* Viewers aren't clickable chats, but maybe customizable */
}
.viewer-item:hover { background: var(--hover-bg); }
.viewer-avatar { 
    width: 52px; height: 52px; border-radius: 18px; /* Match .card-avatar squircle */
    background-size: cover; background-color: #222;
    border: 3px solid transparent; /* Match structure of card-avatar */
    flex-shrink: 0;
}
.viewer-info { flex: 1; display: flex; flex-direction: column; gap: 3px; justify-content: center; } /* Match .user-info gap */
.viewer-name { color: #fff; font-weight: 700; font-size: 16px; margin: 0; display: flex; align-items: center; } /* Match .card-name */
.viewer-time { color: var(--text-dim); font-size: 13px; font-weight: 600; opacity: 0.8; } /* Match .card-time/status styling */

.story-progress-container {
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    display: flex; gap: 4px; padding: 6px 4px; z-index: 30; 
}
.story-bar { flex: 1; height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden; }
.story-bar-fill { height: 100%; background: #fff; width: 0%; }
.story-bar-fill.animating { width: 100%; transition: width 5s linear; }

.story-nav-left, .story-nav-right {
    position: absolute; top: 60px; bottom: 80px; width: 30%; z-index: 15;
}
.story-nav-left { left: 0; }
.story-nav-right { right: 0; }

.story-caption-overlay {
    position: absolute; bottom: 0; left: 0; right: 0;
    text-align: center; color: #fff; 
    background: linear-gradient(to top, var(--bg-dark) 0%, rgba(5,5,5,0.8) 40%, transparent 100%);
    padding: 120px 24px 50px 24px;
    font-size: 16px; font-weight: 500; z-index: 20;
    pointer-events: none;
}

/* Reusing these from existing code */
.fav-avatar-wrapper .fav-avatar { box-sizing: border-box; }
.add-story-icon-overlay {
    position: absolute; bottom: -5px; right: -5px; background: #3b82f6;
    width: 20px; height: 20px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; border: 2px solid #000;
}
.story-ring-wrapper {
    padding: 2px; background: linear-gradient(135deg, #10b981, #059669);
    border-radius: 20px; display: flex; align-items: center; justify-content: center;
}
`;
document.head.appendChild(storyStyles);

const loginSuccessBeforeStories = loginSuccess;
loginSuccess = function (user) {
    loginSuccessBeforeStories(user);
    loadStories();
    setInterval(loadStories, 60000);
};

function openStoryFromAvatar(e, userId) {
    const hasStory = storiesCache.some(g => g.userId === userId && g.stories.length > 0);
    if (hasStory) {
        e.stopPropagation();
        openStoryViewer(userId);
    }
}

// --- SETTINGS LOGIC ---
function renderSettingsView() {
    if (!settingsView) return;
    settingsView.innerHTML = `
        <div class="settings-header-title">Configuración</div>
        
        <div class="settings-item">
            <div class="settings-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div class="settings-info">
                <div class="settings-label">Mi Cuenta</div>
                <div class="settings-sub">Privacidad, seguridad, cambiar número</div>
            </div>
        </div>

        <div class="settings-item">
            <div class="settings-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <div class="settings-info">
                <div class="settings-label">Notificaciones</div>
                <div class="settings-sub">Mensajes, grupos, llamadas</div>
            </div>
        </div>

        <div class="settings-item">
            <div class="settings-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <div class="settings-info">
                <div class="settings-label">Privacidad</div>
                <div class="settings-sub">Bloqueados, última vez, online</div>
            </div>
        </div>

        <div class="settings-item">
            <div class="settings-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <div class="settings-info">
                <div class="settings-label">Ayuda</div>
                <div class="settings-sub">Centro de ayuda, contáctanos</div>
            </div>
        </div>

        <div class="settings-item" onclick="logout()" style="margin-top:20px; color:#ef4444;">
             <div class="settings-icon" style="background:rgba(239,68,68,0.1); color:#ef4444;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
            <div class="settings-info">
                <div class="settings-label">Cerrar Sesión</div>
            </div>
        </div>
    `;
}

/* --- SEARCH FUNCTIONALITY --- */
function applyUserFilter() {
    const input = document.getElementById('searchUsers');
    const filter = input.value.toUpperCase();
    const list = document.getElementById('usersList');
    const li = list.getElementsByTagName('li');

    // Toggle search mode class on list for black background styling
    if (filter.length > 0) {
        list.classList.add('search-mode');
    } else {
        list.classList.remove('search-mode');
    }

    for (let i = 0; i < li.length; i++) {
        // Skip if it's not a user item (to be safe)
        if (!li[i].classList.contains('user-item') && !li[i].classList.contains('chat-card')) continue;

        // Find the name element. It could be .card-name (channels) or just inside the text for users.
        // Based on existing renderUserList:
        // Users: <div ...>${safeName}...</div> (inside second div)
        // Channels: <span class="card-name">...</span>

        let nameEl = li[i].querySelector('.card-name');
        let txtValue = "";

        if (nameEl) {
            txtValue = nameEl.textContent || nameEl.innerText;
        } else {
            // Fallback for simple user list items (look for text content of the second div)
            const divs = li[i].getElementsByTagName('div');
            if (divs.length >= 2) {
                txtValue = divs[1].textContent || divs[1].innerText;
            } else {
                txtValue = li[i].textContent || li[i].innerText;
            }
        }

        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

// Ensure it's available globally if needed
window.applyUserFilter = applyUserFilter;


// --- SETTINGS VIEW (UI FIRST/LANDING) ---

// Helper: Format Bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Calculate Storage Usage (Async)
// Calculate Storage Usage (Async)
async function calculateStorageUsage() {
    console.log('[Storage] Calculating usage...');
    /*
      Strategy:
      1. Get "App Usage" from navigator.storage (accurate for cache/idb).
      2. Get "Total Device Capacity" & "Free Space" from Capacitor Device API (if native).
      3. If native, replace the confusing browser "quota" with actual device stats.
    */

    let appUsage = 0;
    let totalDeviceHelper = 0; // Total size of device (native) or Quota (web)
    let freeSpaceHelper = 0;
    let isNative = false;

    // 1. Get App Usage (Web Standard)
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
            const estimate = await navigator.storage.estimate();
            appUsage = estimate.usage || 0;
            totalDeviceHelper = estimate.quota || 0; // Fallback for web
            console.log(`[Storage] Browser Estimate: Usage=${appUsage}, Quota=${totalDeviceHelper}`);
        } catch (e) {
            console.error('[Storage] Browser estimate failed:', e);
        }
    }

    // 2. Get Device Stats (Native Override)
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
            isNative = true;
            // Ensure plugin is available
            const Device = window.Capacitor.Plugins.Device;
            if (Device) {
                const info = await Device.getInfo();
                console.log('[Storage] Device Info:', info);

                // Use real disk stats if available
                if (info.realDiskTotal && info.realDiskFree) {
                    totalDeviceHelper = info.realDiskTotal;
                    freeSpaceHelper = info.realDiskFree;
                    console.log(`[Storage] Native: Total=${totalDeviceHelper}, Free=${freeSpaceHelper}`);
                }
            }
        } catch (e) {
            console.warn('[Storage] Native device info failed:', e);
        }
    }

    // 3. Format & Return
    // If native, 'quota' in the UI will represent Total Device Storage, which makes more sense to users than "Browser Quota".
    return {
        usage: appUsage,
        quota: totalDeviceHelper,
        free: freeSpaceHelper, // New field
        usageFormatted: formatBytes(appUsage),
        quotaFormatted: formatBytes(totalDeviceHelper),
        freeFormatted: formatBytes(freeSpaceHelper),
        percent: totalDeviceHelper ? Math.min(100, (appUsage / totalDeviceHelper) * 100) : 0,
        isNative: isNative
    };
}

// Clear App Cache
async function clearAppCache() {
    if (!confirm('¿Estás seguro de borrar la caché de la aplicación? Esto puede hacer que las imágenes carguen más lento la próxima vez.')) return;

    try {
        console.log('[Storage] Clearing cache...');
        // 1. Clear Cache API
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            console.log('[Storage] Cache API cleared.');
        }

        // 2. Clear LocalStorage (Optional: careful not to delete session)
        // We preserve 'chatUser', 'chat_token'
        // We can clear other keys if needed, but for now Cache API is the heavy one.

        alert('Caché borrada correctamente.');

        // Re-render to update numbers
        renderSettingsUI();
    } catch (e) {
        console.error('[Storage] Error clearing cache:', e);
        alert('Error al borrar la caché.');
    }
}

// Render Settings Logic
async function renderSettingsUI() {
    const settingsView = document.getElementById('settingsView');
    if (!settingsView) return;

    const user = JSON.parse(localStorage.getItem('chatUser') || '{}');
    const avatarData = renderAvatarContent(user); // returns {style, html}

    // Show Loading State
    settingsView.innerHTML = `
        <header class="settings-header">
            <button class="nav-icon-btn mobile-only" id="backFromSettingsBtn" style="margin-right: 15px;">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <h1 class="settings-title">Ajustes</h1>
        </header>
        <div style="padding: 40px; text-align: center; color: #a1a1aa;">
            <div style="margin-bottom: 10px;">Calculando almacenamiento...</div>
            <div class="spinner" style="border: 2px solid rgba(255,255,255,0.1); border-left-color: #fff; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;

    // Temporary Back Handler for Loading State
    const tempBackBtn = document.getElementById('backFromSettingsBtn');
    if (tempBackBtn) {
        tempBackBtn.onclick = () => {
            settingsView.classList.add('hidden');
            const usersList = document.getElementById('usersList');
            if (usersList) usersList.classList.remove('hidden');
        };
    }

    // Get Real Storage Data
    const storageData = await calculateStorageUsage();

    settingsView.innerHTML = `
        <!-- Header -->
        <header class="settings-header">
            <button class="nav-icon-btn mobile-only" id="backFromSettingsBtn" style="margin-right: 15px;">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </button>
            <h1 class="settings-title">Ajustes</h1>
        </header>

        <!-- Profile Section (Account) -->
        <section class="settings-section">
            <span class="section-label">Cuenta</span>
            <div class="settings-card">
                <div class="user-mini-card">
                    <div class="mini-avatar" style="${avatarData.style}">
                        ${avatarData.html || ''}
                    </div>
                    <div class="mini-info">
                        <span class="mini-name">${user.display_name || 'Nombre Usuario'}</span>
                        <span class="mini-handle">@${user.username || 'usuario'}</span>
                    </div>
                    <div class="forward-icon">
                         <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>
            </div>
        </section>

        <!-- Storage & Data Section -->
        <main class="settings-content">
            <div class="settings-section">
                <h2 class="settings-section-title">ALMACENAMIENTO Y DATOS</h2>
                
                <div class="settings-card">
                    <div style="display: flex; align-items: flex-start; margin-bottom: 15px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(37, 99, 235, 0.1); display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0;">
                            <svg viewBox="0 0 24 24" width="24" height="24" stroke="#3b82f6" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        </div>
                        <div style="flex: 1;">
                           ${storageDetailsHtml}
                           <div style="display: flex; gap: 10px; font-size: 11px; color: #71717a;">
                               <span style="display: flex; align-items: center;"><span style="width: 6px; height: 6px; background: #eab308; border-radius: 50%; margin-right: 4px;"></span> App y Datos (${storageData.usageFormatted})</span>
                               <span style="display: flex; align-items: center;"><span style="width: 6px; height: 6px; background: #4ade80; border-radius: 50%; margin-right: 4px;"></span> Libre</span>
                           </div>
                        </div>
                    </div>

                    <button class="btn-secondary w-100" id="clearCacheBtn" style="border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #fff;">
                        Borrar Caché y Liberar Espacio
                    </button>

                    <!-- DEBUG ELEMENT -->
                    <div style="margin-top: 15px; padding: 10px; background: #000; border-radius: 8px; font-family: monospace; font-size: 10px; color: #ef4444; word-break: break-all;">
                        <strong>DEBUG INFO:</strong><br>
                        Native: ${storageData.isNative}<br>
                        Capacitor: ${!!window.Capacitor}<br>
                        Plugins: ${!!(window.Capacitor && window.Capacitor.Plugins)}<br>
                        Device Plugin: ${!!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Device)}<br>
                        UA: ${navigator.userAgent.substring(0, 50)}...
                    </div>
                </div>
            </div>
        </main>

        <!-- General Settings -->
        <section class="settings-section">
            <span class="section-label">General</span>
            <div class="settings-card">
                
                <!-- Appearance -->
                <div class="setting-item">
                    <div class="setting-left">
                        <div class="setting-icon-box bg-purple">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                        </div>
                        <div class="setting-text">
                            <span class="setting-name">Apariencia</span>
                            <span class="setting-desc">Tema, fondo de chat</span>
                        </div>
                    </div>
                    <div class="setting-right">
                         <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>

                <!-- Notifications -->
                <div class="setting-item">
                     <div class="setting-left">
                        <div class="setting-icon-box bg-red">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        </div>
                        <div class="setting-text">
                            <span class="setting-name">Notificaciones</span>
                            <span class="setting-desc">Tonos, alertas</span>
                        </div>
                    </div>
                    <div class="setting-right">
                         <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>

                <!-- Security -->
                <div class="setting-item">
                     <div class="setting-left">
                        <div class="setting-icon-box bg-green">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <div class="setting-text">
                            <span class="setting-name">Privacidad</span>
                            <span class="setting-desc">Bloqueos, seguridad</span>
                        </div>
                    </div>
                    <div class="setting-right">
                         <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                </div>

            </div>
        </section>

        <!-- Info / About -->
         <section class="settings-section">
            <div class="settings-card" style="background: transparent; border: none; text-align: center; padding-top: 10px;">
                <span style="color: #52525b; font-size: 13px;">AvenApp v1.2.0 (Beta)</span>
            </div>
         </section>
    `;

    // Bind Event Listeners
    const clearBtn = document.getElementById('clearCacheBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearAppCache);

    // Back Button (Mobile)
    const backBtn = document.getElementById('backFromSettingsBtn');
    const restoreChatView = () => {
        // Also found in setupSettingsNavigation, can extract to helper but inline is fine
        settingsView.classList.add('hidden');
        const usersList = document.getElementById('usersList');
        const favoritesSection = document.querySelector('.favorites-section');
        const searchTrigger = document.querySelector('.search-trigger');
        const btn = document.getElementById('navChatBtn');

        if (usersList) usersList.classList.remove('hidden');
        if (favoritesSection) favoritesSection.style.display = '';
        if (searchTrigger) searchTrigger.style.display = '';
        if (btn) btn.click(); // Simulate click to activate tab
    };
    if (backBtn) backBtn.addEventListener('click', restoreChatView);
}

// Navigation Handler for Settings
function setupSettingsNavigation() {
    const navSettingsBtn = document.getElementById('navSettingsBtn');
    const settingsView = document.getElementById('settingsView');
    const usersList = document.getElementById('usersList');
    const brandHeader = document.querySelector('.brand-header');
    const favoritesSection = document.querySelector('.favorites-section');
    const searchTrigger = document.querySelector('.search-trigger');
    const allDockIcons = document.querySelectorAll('.dock-icon');

    if (navSettingsBtn) {
        navSettingsBtn.addEventListener('click', () => {
            // 1. Activate Icon
            allDockIcons.forEach(btn => btn.classList.remove('active'));
            navSettingsBtn.classList.add('active');

            // 2. Hide Main Sidebar Content
            if (usersList) usersList.classList.add('hidden');
            if (favoritesSection) favoritesSection.style.display = 'none'; // Use display none to collapse space
            if (searchTrigger) searchTrigger.style.display = 'none';

            // 3. Show Settings
            if (settingsView) {
                settingsView.classList.remove('hidden');
                renderSettingsUI();
            }
        });
    }

    // Add listener to other nav buttons to hide settings (Restore default view)
    const restoreChatView = () => {
        if (settingsView) settingsView.classList.add('hidden');
        if (usersList) usersList.classList.remove('hidden');
        if (favoritesSection) favoritesSection.style.display = ''; // Restore default
        if (searchTrigger) searchTrigger.style.display = '';
    };

    const navChatBtn = document.getElementById('navChatBtn');
    if (navChatBtn) navChatBtn.addEventListener('click', restoreChatView);

    // Also bind to other main nav items if necessary (Calls, Contacts, etc.)
    const navCallsBtn = document.getElementById('navCallsBtn');
    if (navCallsBtn) navCallsBtn.addEventListener('click', restoreChatView);

    const navContactsBtn = document.getElementById('navContactsBtn');
    if (navContactsBtn) navContactsBtn.addEventListener('click', restoreChatView);
}

// Initialize logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSettingsNavigation);
} else {
    setupSettingsNavigation();
}


// Helper to update sidebar when a message is deleted
function updateSidebarPreviewAfterDeletion(deletedRow, deletedMsgId) {
    try {
        if (!currentTargetUserId) return;

        // Find the actual last message row in the list
        // We need to check if 'deletedRow' IS the last row.
        let lastRow = messagesList.lastElementChild;
        while (lastRow && (!lastRow.classList.contains('message-row') || lastRow.classList.contains('date-divider'))) {
            lastRow = lastRow.previousElementSibling;
        }

        // Check if the row being deleted is indeed the last one
        // Note: deletedRow might be the same object as lastRow
        // Also check by ID if row references differ
        const isDeletingLast = lastRow && (lastRow === deletedRow || lastRow.id === `row-${deletedMsgId}` || (deletedRow.contains && lastRow.contains(deletedRow)));

        if (isDeletingLast) {
            console.log("[SIDEBAR-UPDATE] Deleting last message. Updating preview...");

            // Find the NEW last message (the one before the deleted one)
            let newLastRow = lastRow.previousElementSibling;
            while (newLastRow && (!newLastRow.classList.contains('message-row') || newLastRow.classList.contains('date-divider'))) {
                newLastRow = newLastRow.previousElementSibling;
            }

            let newPreview = '';
            let newTime = null;

            if (newLastRow) {
                // Extract content from newLastRow
                const isImage = newLastRow.querySelector('.chat-image') || newLastRow.querySelector('.msg-image-wrapper');
                const isSticker = newLastRow.querySelector('.sticker-img') || newLastRow.classList.contains('sticker-wrapper');
                const isAudio = newLastRow.querySelector('.custom-audio-player');

                if (isImage) {
                    newPreview = '📷 Foto';
                } else if (isSticker) {
                    newPreview = '✨ Sticker';
                } else if (isAudio) {
                    newPreview = '🎤 Audio';
                } else {
                    // Text content
                    const inner = newLastRow.querySelector('.message-inner');
                    if (inner) {
                        const clone = inner.cloneNode(true);
                        // Remove meta, quotes, deleted labels
                        const toRemove = clone.querySelectorAll('.meta-row, .quoted-message, .deleted-label, .edited-label');
                        toRemove.forEach(el => el.remove());

                        newPreview = clone.innerText.trim();
                    }
                }

                if (newLastRow.dataset.timestamp) {
                    newTime = parseInt(newLastRow.dataset.timestamp);
                }
            } else {
                // Chat is now empty
                newPreview = '';
            }

            console.log(`[SIDEBAR-UPDATE] New preview text: "${newPreview}"`);

            if (currentChatType === 'channel') {
                const actualId = currentTargetUserId.startsWith('c_') ? currentTargetUserId.substring(2) : currentTargetUserId;
                const ch = myChannels.find(c => c.id == actualId);
                if (ch) {
                    ch.last_message = newPreview;
                    if (newTime) ch.last_message_time = newTime;
                    renderMixedSidebar();
                }
            } else {
                const u = allUsersCache.find(x => x.userId == currentTargetUserId);
                if (u) {
                    u.lastMessage = newPreview;
                    if (newTime) u.lastMessageTime = newTime;
                    renderMixedSidebar();
                }
            }
        }
    } catch (err) {
        console.error("[SIDEBAR-UPDATE] Error:", err);
    }
}


// --- SIDEBAR UPDATE HELPER ---
function updateSidebarWithNewMessage(targetId, content, type, timestamp) {
    try {
        console.log(`[SIDEBAR-UPDATE] Updating for ${targetId}: ${content} (${type})`);

        // Store raw content - formatting will happen when rendering
        let preview = content;

        // Handle encrypted or special messages if needed
        if (preview && typeof preview === 'string' && preview.startsWith('{"iv":')) preview = "🔒 Mensaje encriptado";

        // Check if channel
        // targetId might be 'c_123' or just '123' depending on context. 
        // We need to handle both if possible, but usually pure ID is passed.
        // Let's assume ID is passed without prefix, or handle prefix.

        let isChannel = false;
        let cleanId = targetId;

        if (String(targetId).startsWith('c_')) {
            isChannel = true;
            cleanId = String(targetId).substring(2);
        }

        // Try to find in channels first if we suspect it might be a channel
        // or check currentChatType if targetId matches currentTarget
        if (!isChannel) {
            const ch = myChannels.find(c => c.id == targetId);
            if (ch) {
                isChannel = true;
                cleanId = targetId;
            }
        }

        if (isChannel) {
            const ch = myChannels.find(c => c.id == cleanId);
            if (ch) {
                ch.last_message = preview;
                ch.last_message_type = type;
                ch.last_message_time = new Date(timestamp).getTime();
                // Move to top logic can be complex with channels mixed, 
                // but usually renderMixedSidebar sorts by online/activity? 
                // Currently it sorts users by online. Channels are just listed.
                // If we want to sort channels by recent message, we might need to change renderMixedSidebar.
                // For now, just updating text is enough.
                renderMixedSidebar();
            }
        } else {
            // It's a user
            const u = allUsersCache.find(x => x.userId == targetId);
            if (u) {
                u.lastMessage = preview;
                u.lastMessageType = type;
                u.lastMessageTime = new Date(timestamp).getTime();

                // Increment unread count if not current target
                if (targetId !== currentTargetUserId) {
                    u.unread = (u.unread || 0) + 1;
                    localStorage.setItem('cachedUsers', JSON.stringify(allUsersCache));
                }

                renderMixedSidebar();
            }
        }

    } catch (e) {
        console.error("[SIDEBAR-UPDATE] Error updating sidebar:", e);
    }
}


// --- INPUT FOCUS HANDLER ---
function setupInputFocusHandlers() {
    const input = document.getElementById('input');
    const inputStack = document.getElementById('inputStack');
    if (!input || !inputStack) return;

    input.addEventListener('focus', () => {
        inputStack.classList.add('input-focused');
    });

    input.addEventListener('blur', () => {
        inputStack.classList.remove('input-focused');
    });
}
window.setupInputFocusHandlers = setupInputFocusHandlers;

// Initialize logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupSettingsNavigation();
        setupInputFocusHandlers();
        initSmoothKeyboard(); // Start smooth keyboard sync
        initScrollHandler(); // Start scroll handler
    });
} else {
    setupSettingsNavigation();
    setupInputFocusHandlers();
    initSmoothKeyboard(); // Start smooth keyboard sync
    initScrollHandler(); // Start scroll handler
}

/* --- SMOOTH KEYBOARD SYNC --- */
function initSmoothKeyboard() {
    const isNative = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard);

    if (isNative) {
        // Native Capacitor App - Use official Keyboard Plugin events
        const Keyboard = window.Capacitor.Plugins.Keyboard;

        Keyboard.addListener('keyboardWillShow', (info) => {
            const offset = info.keyboardHeight;
            // Apply precise keyboard height immediately without layout delay
            document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);

            // Scroll to bottom to ensure last message is visible
            const messagesList = document.querySelector('.chat-main');
            if (messagesList) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        });

        Keyboard.addListener('keyboardWillHide', () => {
            // Reset offset
            document.documentElement.style.setProperty('--keyboard-offset', `0px`);
        });

    } else if (window.visualViewport) {
        // Web Browser Fallback - Use visualViewport
        function handleResize() {
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            let offset = windowHeight - viewportHeight;

            // Ignore small UI shifts (like address bar showing/hiding)
            if (offset < 80) {
                offset = 0;
            }

            document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);

            if (offset > 0) {
                // Keyboard is likely open, scroll chat to bottom
                const messagesList = document.querySelector('.chat-main');
                if (messagesList) {
                    messagesList.scrollTop = messagesList.scrollHeight;
                }
            }
        }

        // Listeners on visualViewport
        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);

        // Initial check
        handleResize();
    }
}

/* --- SCROLL HANDLER FOR STORIES --- */
function initScrollHandler() {
    const usersList = document.getElementById('usersList');
    const sidebarPanel = document.querySelector('.sidebar-main-panel');

    if (!usersList || !sidebarPanel) return;

    // Threshold in pixels for full hide (lowered to hide quickly)
    const SCROLL_THRESHOLD = 20;

    let ticking = false;
    usersList.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                // Should we disable animation if selection mode is ON?
                if (typeof isSelectionMode !== 'undefined' && isSelectionMode) {
                    sidebarPanel.style.setProperty('--scroll-progress', 0);
                    ticking = false;
                    return;
                }

                const scrollTop = usersList.scrollTop;
                // Calculate progress from 0 to 1
                let progress = scrollTop / SCROLL_THRESHOLD;
                if (progress > 1) progress = 1;
                if (progress < 0) progress = 0;

                sidebarPanel.style.setProperty('--scroll-progress', progress);
                ticking = false;
            });
            ticking = true;
        }
    });
}
