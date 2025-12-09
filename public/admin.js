// --- VERIFICACIÓN DE SESIÓN ---
async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) throw new Error();
        const user = await res.json();
        if (!user.is_admin) window.location.href = '/';

        document.getElementById('adminNameDisplay').textContent = user.display_name || user.username;
        const avatarUrl = (user.avatar && user.avatar.startsWith('http')) ? user.avatar : '/profile.png';
        document.getElementById('adminAvatarDisplay').style.backgroundImage = `url('${avatarUrl}')`;

    } catch (e) {
        window.location.href = '/login.html';
    }
}
checkAuth();

// --- VARIABLES ---
const listBody = document.getElementById('adminUserList');
const reportsBody = document.getElementById('reportsListBody');
const searchInput = document.getElementById('adminSearch');
const statsTimeRange = document.getElementById('statsTimeRange');

// Vistas
const views = {
    users: document.getElementById('viewUsers'),
    stats: document.getElementById('viewStats'),
    reports: document.getElementById('viewReports')
};
const btns = {
    users: document.getElementById('btnViewUsers'),
    stats: document.getElementById('btnViewStats'),
    reports: document.getElementById('btnViewReports')
};

const stats = {
    total: document.getElementById('statTotal'),
    active: document.getElementById('statActive'),
    verified: document.getElementById('statVerified'),
    premium: document.getElementById('statPremium'),
    // Stats View
    channelsTotal: document.getElementById('statChannelsTotal'),
    channelMembers: document.getElementById('statChannelMembers')
};

let currentUsers = [];
let targetNoteUserId = null;
let growthChart = null;

// --- API ---
async function apiRequest(url, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    return res.json();
}

// --- NAVEGACIÓN ---
function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    Object.values(btns).forEach(el => el.classList.remove('active'));

    views[viewName].classList.remove('hidden');
    btns[viewName].classList.add('active');

    if (viewName === 'users') loadUsers();
    if (viewName === 'stats') loadStats();
    if (viewName === 'reports') loadReports();
}

btns.users.addEventListener('click', () => switchView('users'));
btns.stats.addEventListener('click', () => switchView('stats'));
btns.reports.addEventListener('click', () => switchView('reports'));

// --- LOGICA USUARIOS ---
async function loadUsers() {
    // Usamos el nuevo endpoint admin
    const users = await apiRequest('/api/admin/all-users');
    if (!users || !Array.isArray(users)) {
        console.error("Error loading users:", users);
        return; // Or show error UI
    }
    currentUsers = users;
    renderTable(users);
    updateQuickStats(users);
}

function renderTable(users) {
    listBody.innerHTML = '';

    users.forEach(u => {
        const tr = document.createElement('tr');
        const avatarUrl = (u.avatar && u.avatar.startsWith('http')) ? u.avatar : '/profile.png';
        const isOnline = u.online || false;

        // Super Admin Badge
        const adminBadge = u.is_admin ?
            `<span style="background:#6366f1; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px; vertical-align:middle;">AvenApp</span>`
            : '';

        // Disable actions for Admin
        const disabledAttr = u.is_admin ? 'disabled' : '';
        const opacityStyle = u.is_admin ? 'opacity:0.3; pointer-events:none;' : '';
        const verifySwitch = u.is_admin ? `<span style="color:var(--text-muted); font-size:12px;">Pernamente</span>` :
            `<label class="toggle-switch">
                <input type="checkbox" ${u.is_verified ? 'checked' : ''} onchange="toggleVerify(${u.id}, this)">
                <span class="slider blue"></span>
            </label>`;

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="u-avatar-sm" style="background-image: url('${avatarUrl}')">
                        <div class="online-dot ${isOnline ? 'active' : ''}"></div>
                    </div>
                    <div class="u-info-col">
                        <span class="u-display">${u.display_name || u.username} ${adminBadge}</span>
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
                ${verifySwitch}
            </td>
            <td class="text-center" style="${opacityStyle}">
                <label class="toggle-switch">
                    <input type="checkbox" ${u.is_premium ? 'checked' : ''} onchange="togglePremium(${u.id}, this)" ${disabledAttr}>
                    <span class="slider pink"></span>
                </label>
            </td>
            <td class="text-center" style="${opacityStyle}">
                <button class="btn-note" onclick="openNoteModal(${u.id}, '${u.username}')" ${disabledAttr}>
                    Enviar
                </button>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

function updateQuickStats(users) {
    stats.total.innerText = users.length;
    // stats.active, stats.verified... existing logic
    stats.verified.innerText = users.filter(u => u.is_verified).length;
    stats.premium.innerText = users.filter(u => u.is_premium).length;
}

// --- LOGICA ESTADÍSTICAS (CHART) ---
async function loadStats() {
    const range = statsTimeRange.value;
    const data = await apiRequest(`/api/admin/stats?range=${range}`);
    if (!data || !data.graph) {
        console.error("Stats error:", data);
        return;
    }

    // Update simple counters
    if (stats.channelsTotal) stats.channelsTotal.innerText = data.totalChannels || 0;
    if (stats.channelMembers) stats.channelMembers.innerText = data.totalChannelMembers || 0;

    renderChart(data.graph);
}

statsTimeRange.addEventListener('change', loadStats);

function renderChart(graphData) {
    const ctx = document.getElementById('growthChart').getContext('2d');

    // Prepare Data
    const labels = graphData.map(d => d.date);
    const values = graphData.map(d => d.count); // Daily joins

    if (growthChart) growthChart.destroy();

    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Usuarios Nuevos',
                data: values,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#a1a1aa' } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a1a1aa', precision: 0 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a1a1aa' }
                }
            }
        }
    });
}

// --- LOGICA REPORTES ---
async function loadReports() {
    const reports = await apiRequest('/api/admin/reports');
    if (!reports || !Array.isArray(reports)) return;
    renderReports(reports);
}

function renderReports(reports) {
    reportsBody.innerHTML = '';
    if (!reports || reports.length === 0) {
        document.getElementById('noReportsMsg').classList.remove('hidden');
        return;
    }
    document.getElementById('noReportsMsg').classList.add('hidden');

    reports.forEach(r => {
        const tr = document.createElement('tr');
        const date = new Date(r.created_at).toLocaleDateString();
        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <div class="u-avatar-sm" style="background-image: url('${r.reporter_avatar || '/profile.png'}')"></div>
                    <span>${r.reporter_username || 'Anon'}</span>
                </div>
            </td>
            <td>${r.target_id}</td>
            <td>${r.reason || 'Sin razón'}</td>
            <td><span class="status-badge">${r.type}</span></td>
            <td>${date}</td>
        `;
        reportsBody.appendChild(tr);
    });
}


// --- EXISTING ACTIONS (Verify, Premium, Notes) ---
// (Copied functionality but simplified for brevity if logic is same)
window.toggleVerify = async (id, el) => {
    try {
        await apiRequest('/api/admin/toggle-verify', 'POST', { targetUserId: id });
    } catch (e) { el.checked = !el.checked; alert('Error'); }
};

window.togglePremium = async (id, el) => {
    try {
        await apiRequest('/api/admin/toggle-premium', 'POST', { targetUserId: id });
    } catch (e) { el.checked = !el.checked; alert('Error'); }
};

// Notes Modal Logic
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
    if (!content) return;
    try {
        await apiRequest('/api/admin/send-love-note', 'POST', { targetUserId: targetNoteUserId, content });
        alert('Enviado'); noteModal.classList.add('hidden');
    } catch (e) { alert('Error'); }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
});

// Search Filter (Users View)
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = currentUsers.filter(u => u.username.toLowerCase().includes(term) || (u.display_name || '').toLowerCase().includes(term));
    renderTable(filtered);
});

// Mobile Menu
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => { sidebar.classList.add('active'); sidebarOverlay.classList.add('active'); });
}
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('active'); sidebarOverlay.classList.remove('active'); });
}

// Init
loadUsers();