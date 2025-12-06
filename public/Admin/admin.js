// --- VERIFICACIÓN DE SESIÓN ---
async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) throw new Error();
        const user = await res.json();
        if (!user.is_admin) window.location.href = '/';
        
        // Cargar datos del perfil en la barra superior
        document.getElementById('adminNameDisplay').textContent = user.display_name || user.username;
        const avatarUrl = (user.avatar && user.avatar.startsWith('http')) ? user.avatar : '/profile.png';
        document.getElementById('adminAvatarDisplay').style.backgroundImage = `url('${avatarUrl}')`;

    } catch (e) {
        window.location.href = '/login.html';
    }
}
checkAuth();

// --- VARIABLES GLOBALES ---
const listBody = document.getElementById('adminUserList');
const searchInput = document.getElementById('adminSearch');
const stats = {
    total: document.getElementById('statTotal'),
    active: document.getElementById('statActive'),
    verified: document.getElementById('statVerified'),
    premium: document.getElementById('statPremium'),
    // Sidebar stats
    sbActive: document.getElementById('sidebarActiveCount'),
    sbTotal: document.getElementById('sidebarTotalCount')
};

let currentUsers = [];
let targetNoteUserId = null;

// --- FUNCIONES ---

async function apiRequest(url, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
}

async function loadUsers() {
    // Nota: El endpoint debe devolver también "online: true/false" si es posible.
    // Como tu endpoint actual /api/admin/all-users lo creamos simple, 
    // vamos a suponer que el servidor puede incluir el estado 'online' 
    // O si usas sockets, podríamos recibirlo, pero para simplificar, usaremos los datos de DB.
    // (Idealmente, en server.js añade 'online' comparando con sockets activos, pero si no, mostrará 0).
    
    // TRUCO: Si no tienes el estado 'online' en la API de admin,
    // puedes usar el endpoint de usuarios normal '/api/me' (que devuelve todos los users con estado online)
    // PERO como eso solo lo ve el socket, hagamos esto:
    // Tu endpoint '/api/admin/all-users' (creado antes) solo devuelve DB.
    // Para ver conectados, necesitaríamos lógica extra en el servidor.
    // Por ahora, mostraremos Total y los Flags de DB.
    
    const users = await apiRequest('/api/admin/all-users');
    currentUsers = users;
    
    // Simular estado online (Opcional: Si el servidor no lo envía, todos offline)
    // Si quieres que funcione real, debes modificar server.js para cruzar datos con sockets.
    
    renderTable(users);
    updateStats(users);
}

function renderTable(users) {
    listBody.innerHTML = '';
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        
        // Avatar y Estado
        const avatarUrl = (u.avatar && u.avatar.startsWith('http')) ? u.avatar : '/profile.png';
        // Asumimos que u.online viene del server, si no, false.
        const isOnline = u.online || false; 

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="u-avatar-sm" style="background-image: url('${avatarUrl}')">
                        <div class="online-dot ${isOnline ? 'active' : ''}"></div>
                    </div>
                    <div class="u-info-col">
                        <span class="u-display">${u.display_name || u.username}</span>
                        <span class="u-handle">@${u.username}</span>
                    </div>
                </div>
            </td>
            <td class="text-center">
                <span class="status-badge ${isOnline ? 'online' : ''}">
                    ${isOnline ? 'En línea' : 'Offline'}
                </span>
            </td>
            <td class="text-center">
                <label class="toggle-switch">
                    <input type="checkbox" ${u.is_verified ? 'checked' : ''} onchange="toggleVerify(${u.id}, this)">
                    <span class="slider blue"></span>
                </label>
            </td>
            <td class="text-center">
                <label class="toggle-switch">
                    <input type="checkbox" ${u.is_premium ? 'checked' : ''} onchange="togglePremium(${u.id}, this)">
                    <span class="slider pink"></span>
                </label>
            </td>
            <td class="text-center">
                <button class="btn-note" onclick="openNoteModal(${u.id}, '${u.username}')">
                    💌 Enviar
                </button>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

function updateStats(users) {
    const total = users.length;
    // Si tu API no devuelve 'online', esto será 0, lo cual es correcto hasta que se implemente en backend.
    const active = users.filter(u => u.online).length; 
    const verified = users.filter(u => u.is_verified).length;
    const premium = users.filter(u => u.is_premium).length;

    // Actualizar cards
    stats.total.innerText = total;
    stats.active.innerText = active;
    stats.verified.innerText = verified;
    stats.premium.innerText = premium;

    // Actualizar sidebar
    stats.sbActive.innerText = active;
    stats.sbTotal.innerText = total;
}

// Filtro Buscador
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = currentUsers.filter(u => 
        u.username.toLowerCase().includes(term) || 
        (u.display_name || '').toLowerCase().includes(term)
    );
    renderTable(filtered);
});

// --- ACCIONES (Toggles & Modal) ---

window.toggleVerify = async (id, el) => {
    const prevState = !el.checked;
    try {
        const res = await apiRequest('/api/admin/toggle-verify', 'POST', { targetUserId: id });
        if (!res.success) throw new Error();
        // Actualizar array local para que las stats funcionen sin recargar
        const u = currentUsers.find(x => x.id === id);
        if(u) u.is_verified = el.checked ? 1 : 0;
        updateStats(currentUsers);
    } catch (e) {
        el.checked = prevState;
        alert('Error al conectar con el servidor');
    }
};

window.togglePremium = async (id, el) => {
    const prevState = !el.checked;
    try {
        const res = await apiRequest('/api/admin/toggle-premium', 'POST', { targetUserId: id });
        if (!res.success) throw new Error();
        const u = currentUsers.find(x => x.id === id);
        if(u) u.is_premium = el.checked ? 1 : 0;
        updateStats(currentUsers);
    } catch (e) {
        el.checked = prevState;
        alert('Error al conectar con el servidor');
    }
};

// Modal Notas
const noteModal = document.getElementById('noteModal');
const noteTargetName = document.getElementById('noteTargetName');
const noteText = document.getElementById('noteText');

window.openNoteModal = (id, username) => {
    targetNoteUserId = id;
    noteTargetName.innerText = `@${username}`;
    noteText.value = '';
    noteModal.classList.remove('hidden');
    noteText.focus();
};

document.getElementById('closeNoteModal').addEventListener('click', () => noteModal.classList.add('hidden'));

document.getElementById('sendNoteConfirm').addEventListener('click', async () => {
    const content = noteText.value.trim();
    if (!content) return alert('Escribe un mensaje primero.');
    
    const btn = document.getElementById('sendNoteConfirm');
    const originalText = btn.innerText;
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        const res = await apiRequest('/api/admin/send-love-note', 'POST', {
            targetUserId: targetNoteUserId,
            content: content
        });
        if (res.success) {
            alert('¡Nota enviada con éxito! 💖');
            noteModal.classList.add('hidden');
        } else {
            alert('Error al enviar la nota.');
        }
    } catch (e) {
        alert('Error de conexión.');
    }
    btn.innerText = originalText;
    btn.disabled = false;
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('chatUser');
    window.location.href = '/login.html';
});

// Botón Refrescar
document.getElementById('refreshBtn').addEventListener('click', loadUsers);

/* 
   ===============================================
   LÓGICA DEL MENÚ RESPONSIVE
   ===============================================
*/
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
    });
}

// Cerrar al tocar el fondo oscuro (Overlay)
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });
}

// Inicializar
loadUsers();