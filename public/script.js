// --- REDIRECCIÓN DE SEGURIDAD E INICIALIZACIÓN ---
let myUser = null;

// Helper API Seguro
async function apiRequest(url, method = 'GET', body = null) {
    try {
        const headers = {};
        if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

        const opts = { method, headers };
        if (body) opts.body = body instanceof FormData ? body : JSON.stringify(body);

        const res = await fetch(url, opts);

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('chatUser');
            window.location.href = '/login.html';
            return null;
        }

        return res.ok ? await res.json() : null;
    } catch (e) {
        console.error('API Error', e);
        return null;
    }
}

// Configuración Socket
const socket = io({
    autoConnect: false,
    transports: ['websocket', 'polling']
});

// Verificación de sesión
async function checkSession() {
    if (window.location.pathname === '/login.html') return;
    const userData = await apiRequest('/api/me');
    if (userData) {
        loginSuccess(userData);
    } else {
        window.location.href = '/login.html';
    }
}

// --- CENTRALIZACIÓN DE ICONOS ---
const ICONS = {
    blueBadge: `<span class="verified-badge" title="Verificado" style="display:inline-flex; align-items:center; margin-left:5px; vertical-align:middle;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.2 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" fill="#3b82f6"/><path fill="#fff" transform="translate(12, 12) scale(0.75) translate(-12, -12)" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg></span>`,
    purpleBadge: `<span class="verified-badge" title="Administrador" style="display:inline-flex; align-items:center; margin-left:5px; vertical-align:middle;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.2 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" fill="#7c3aed"/><path fill="#fff" transform="translate(12, 12) scale(0.75) translate(-12, -12)" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg></span>`,
    send: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`,
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    replyImage: `<svg viewBox="0 0 24 24" height="20" width="18" fill="none"><path d="M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM5 19H19V5H5V19ZM7 17H17C17.2 17 17.35 16.9083 17.45 16.725C17.55 16.5417 17.5333 16.3667 17.4 16.2L14.65 12.525C14.55 12.3917 14.4167 12.325 14.25 12.325C14.0833 12.325 13.95 12.3917 13.85 12.525L11.25 16L9.4 13.525C9.3 13.3917 9.16667 13.325 9 13.325C8.83333 13.325 8.7 13.3917 8.6 13.525L6.6 16.2C6.46667 16.3667 6.45 16.5417 6.55 16.725C6.65 16.9083 6.8 17 7 17Z" fill="currentColor"></path></svg> Foto`,
    replyAudio: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> Mensaje de voz`
};

const getBadgeHtml = (u) => !u ? '' : (u.is_admin ? ICONS.purpleBadge : (u.is_verified ? ICONS.blueBadge : ''));

// --- VARIABLES DE ESTADO ---
let currentTargetUserId = null, currentTargetUserObj = null;
let messageIdToDelete = null, myNicknames = {}, allUsersCache = [];
let currentReplyId = null, mediaRecorder = null, audioChunks = [], recordingInterval = null;
let isRecording = false, shouldSendAudio = true;
let currentStickerTab = 'giphy', myFavorites = new Set();
let cropper = null, searchTimeout, currentStickerUrlInModal = null;

// --- ELEMENTOS DOM ---
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

// --- SEGURIDAD: HELPERS ---

// 1. Sanitizar HTML
const escapeHtml = (text) => {
    if (!text) return text;
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// 2. [MEJORA SEGURIDAD] Validar URL
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

// Intentar iniciar sesión
checkSession();

getEl('searchUsers').addEventListener('input', applyUserFilter);

function loginSuccess(user) {
    myUser = user;
    localStorage.setItem('chatUser', JSON.stringify(user)); 
    profileBtn.classList.remove('hidden');
    if (myUser.is_admin) document.body.classList.add('is-admin');
    updateMyAvatarUI(myUser.avatar);
    socket.connect();
    updateButtonState();
    refreshFavoritesCache();
}

function applyUserFilter() {
    const term = getEl('searchUsers').value.toLowerCase().trim();
    if (!term) return renderUserList(allUsersCache);
    const filtered = allUsersCache.filter(u =>
        u.userId !== myUser.id &&
        (u.username.toLowerCase().includes(term) || (myNicknames[u.userId] || '').toLowerCase().includes(term))
    );
    renderUserList(filtered);
}

// --- EDITOR DE IMAGEN ---
chatImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
    if (cropper) { cropper.destroy(); cropper = null; }
    imageToEdit.src = evt.target.result;
    imageEditorModal.classList.remove('hidden');
    imageCaptionInput.value = '';
    imageCaptionInput.focus();
    imageToEdit.onload = () => {
        cropper = new Cropper(imageToEdit, {
            viewMode: 1, dragMode: 'move', aspectRatio: NaN, autoCropArea: 0.9, restore: false, guides: true,
            center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true,
            toggleDragModeOnDblclick: false, background: false, modal: true, minContainerWidth: 300, minContainerHeight: 300
        });
    };
};
    reader.readAsDataURL(file);
    e.target.value = '';
});

getEl('closeEditorBtn').addEventListener('click', () => { imageEditorModal.classList.add('hidden'); if (cropper) cropper.destroy(); });
getEl('rotateBtn').addEventListener('click', () => { if (cropper) cropper.rotate(90); });
getEl('resetCropBtn').addEventListener('click', () => { if (cropper) cropper.reset(); });

getEl('sendImageBtn').addEventListener('click', () => {
    if (!cropper) return;
    cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'edited-image.jpg');
        getEl('sendImageBtn').innerHTML = '...';

        const data = await apiRequest('/api/upload-chat-image', 'POST', formData);
        if (data) {
            socket.emit('private message', {
                content: data.imageUrl, toUserId: currentTargetUserId, type: 'image',
                replyToId: currentReplyId, caption: imageCaptionInput.value.trim()
            }, (res) => appendMessageUI(res.content, 'me', res.timestamp, res.id, 'image', null, false, res.caption));
            clearReply();
            imageEditorModal.classList.add('hidden');
        } else alert("Error al enviar imagen");

        getEl('sendImageBtn').innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>`;
        cropper.destroy(); cropper = null;
    }, 'image/jpeg', 0.8);
});

// --- PERFIL Y EDICIÓN ---

socket.on('nicknames', (map) => {
    myNicknames = map;
    if (allUsersCache.length) renderUserList(allUsersCache);
    if (currentTargetUserObj) updateChatHeaderInfo(currentTargetUserObj);
});

// Función para editar MI PERFIL (Envía a DB)
function enableInlineEdit(elementId, dbField, prefix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.add('editable-field');
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    newEl.addEventListener('click', () => {
        let currentText = newEl.innerText;
        if(prefix) currentText = currentText.replace(prefix, '');
        currentText = currentText.replace('✎', '').trim();
        
        const originalContent = newEl.innerHTML;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'editing-input';
        
        if(dbField === 'bio') input.placeholder = "Escribe algo sobre ti...";
        
        newEl.innerHTML = '';
        newEl.appendChild(input);
        newEl.classList.remove('editable-field');
        input.focus();

        const save = async () => {
            let newValue = input.value.trim();
            if (newValue === currentText) { renderValue(newValue); return; }
            if (dbField === 'username' && newValue.length < 3) { alert("Mínimo 3 caracteres"); renderValue(currentText); return; }

            try {
                input.disabled = true;
                input.style.opacity = "0.5";
                const res = await apiRequest('/api/profile/update', 'PUT', { field: dbField, value: newValue });

                if (res && res.success) {
                    myUser[dbField] = res.value;
                    localStorage.setItem('chatUser', JSON.stringify(myUser));
                    renderValue(res.value);
                } else {
                    alert(res.error || "Error al actualizar");
                    newEl.innerHTML = originalContent;
                    newEl.classList.add('editable-field');
                }
            } catch (e) {
                newEl.innerHTML = originalContent;
                newEl.classList.add('editable-field');
            }
        };

        const renderValue = (val) => {
            newEl.innerHTML = '';
            if(dbField === 'bio' && !val) {
                newEl.textContent = "Añadir una biografía...";
                newEl.style.color = "#666";
            } else {
                newEl.textContent = prefix + val;
                newEl.style.color = ""; 
            }
            // CORRECCIÓN: Badge solo en Nombre
            if (dbField === 'display_name') newEl.insertAdjacentHTML('beforeend', getBadgeHtml(myUser));
            newEl.classList.add('editable-field');
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { newEl.innerHTML = originalContent; newEl.classList.add('editable-field'); } });
    });
}

// Función para editar APODO de CONTACTO (Envía a Socket)
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
            
            if(newValue) myNicknames[targetUserId] = newValue;
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

// Evento: ABRIR MI PERFIL
profileBtn.addEventListener('click', () => {
    const nameEl = document.getElementById('profileRealName');
    const displayName = myUser.display_name || myUser.username; 
    nameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(myUser);
    
    const handleEl = document.getElementById('profileHandle');
    handleEl.textContent = `@${myUser.username}`;

    const bioEl = document.getElementById('profileBio');
    bioEl.textContent = myUser.bio || "Añade una biografía...";
    bioEl.style.color = !myUser.bio ? "#666" : "#e4e4e7";

    profileModal.classList.remove('hidden');
    profileOptionsMenu.classList.add('hidden');
    
    enableInlineEdit('profileRealName', 'display_name'); 
    enableInlineEdit('profileHandle', 'username', '@');
    enableInlineEdit('profileBio', 'bio');
});

// Evento: ABRIR INFO CONTACTO
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

    let avatarUrl = currentTargetUserObj.avatar || '/profile.png';
    if (!isValidUrl(avatarUrl)) avatarUrl = '/profile.png';
    avatarEl.style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;

    if (myUser?.is_admin) {
        adminSec.classList.remove('hidden');
        getEl('toggleVerifyBtn').textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
    } else {
        adminSec.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    enableNicknameEdit('contactInfoName', currentTargetUserObj.userId);
});

// Cerrar modales
getEl('closeContactInfo').addEventListener('click', () => getEl('contactInfoModal').classList.add('hidden'));
closeProfile.addEventListener('click', () => profileModal.classList.add('hidden'));

// Botón de menú Perfil
if(profileOptionsBtn) {
    profileOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileOptionsMenu.classList.toggle('hidden');
    });
}
document.addEventListener('click', (e) => {
    if(profileOptionsMenu && !profileOptionsMenu.contains(e.target) && !profileOptionsBtn.contains(e.target)) {
        profileOptionsMenu.classList.add('hidden');
    }
});

// Logout
const newLogoutBtn = getEl('profileLogout');
if(newLogoutBtn) {
    newLogoutBtn.replaceWith(newLogoutBtn.cloneNode(true));
    getEl('profileLogout').addEventListener('click', () => {
        profileModal.classList.add('hidden');
        getEl('confirmModal').classList.remove('hidden');
    });
}

getEl('confirmYes').addEventListener('click', async () => { 
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('chatUser'); 
    window.location.href = '/login.html'; 
});
getEl('confirmNo').addEventListener('click', () => { getEl('confirmModal').classList.add('hidden'); profileModal.classList.remove('hidden'); });

avatarInput.addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    const fd = new FormData();
    fd.append('avatar', e.target.files[0]);
    await apiRequest('/api/upload-avatar', 'POST', fd); 
});

function updateMyAvatarUI(url) {
    let finalUrl = (url && isValidUrl(url)) ? url : '/profile.png';
    const css = `url('${escapeHtml(finalUrl)}')`;
    myAvatar.style.backgroundImage = profilePreviewAvatar.style.backgroundImage = css;
}

function updateChatHeaderInfo(u) {
    chatTitle.innerHTML = escapeHtml(myNicknames[u.userId] || u.username) + getBadgeHtml(u);
}

// --- STICKERS ---
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

getEl('btnStickers').addEventListener('click', () => {
    stickerPanel.classList.toggle('hidden');
    if (!stickerPanel.classList.contains('hidden')) refreshFavoritesCache().then(() => currentStickerTab === 'giphy' ? loadStickers() : loadFavoritesFromServer());
});
document.addEventListener('click', (e) => { if (!stickerPanel.contains(e.target) && !getEl('btnStickers').contains(e.target)) stickerPanel.classList.add('hidden'); });

getEl('stickerSearch').addEventListener('input', (e) => {
    if (currentStickerTab !== 'giphy') return;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadStickers(e.target.value), 500);
});

async function refreshFavoritesCache() {
    const list = await apiRequest(`/api/favorites/${myUser.id}`);
    if (list) myFavorites = new Set(list);
}

async function loadStickers(query = '') {
    stickerResults.innerHTML = '<div class="loading-stickers">Cargando...</div>';
    const data = await apiRequest(`/api/stickers-proxy?q=${encodeURIComponent(query)}`);
    if (data?.data) {
        renderStickersGrid(data.data.map(i => ({ url: i.images.fixed_height.url, thumb: i.images.fixed_height_small.url })));
    } else stickerResults.innerHTML = '<div class="loading-stickers">Error al cargar</div>';
}

async function loadFavoritesFromServer() {
    stickerResults.innerHTML = '<div class="loading-stickers">Cargando favoritos...</div>';
    await refreshFavoritesCache();
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
    const endpoint = isFav ? '/api/favorites/remove' : '/api/favorites/add';
    const res = await apiRequest(endpoint, 'POST', { url }); 
    if (res) {
        isFav ? myFavorites.delete(url) : myFavorites.add(url);
        if (btn) btn.classList.toggle('is-fav', !isFav);
        if (isFav && currentStickerTab === 'favorites' && wrap) wrap.remove();
    }
}

const sendSticker = (url) => { 
    if(isValidUrl(url)) { sendMessage(url, 'sticker', currentReplyId); clearReply(); }
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

// --- REPLY ---
function setReply(msgId, content, type, ownerId) {
    currentReplyId = msgId;
    let name = ownerId === myUser.id ? "Tú" : (myNicknames[ownerId] || allUsersCache.find(u => u.userId == ownerId)?.username || "Usuario");
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
    replyPreview.classList.remove('hidden');
    getEl('inputStack')?.classList.add('active');
    inputMsg.focus();
}

function clearReply() { currentReplyId = null; replyPreview.classList.add('hidden'); getEl('inputStack')?.classList.remove('active'); }
getEl('closeReplyBtn').addEventListener('click', clearReply);
btnImage.addEventListener('click', () => chatImageInput.click());
getEl('acceptVerifiedBtn').addEventListener('click', () => getEl('verificationSuccessModal').classList.add('hidden'));

// --- LISTA DE USUARIOS Y SOCKETS ---
socket.on('users', (users) => {
    allUsersCache = users;
    if (currentTargetUserId) {
        const updated = users.find(u => u.userId === currentTargetUserId);
        if (updated) {
            currentTargetUserObj = updated;
            updateChatHeaderInfo(updated);
            if (myUser.is_admin) getEl('toggleVerifyBtn').textContent = updated.is_verified ? "Quitar Verificado" : "Verificar Usuario";
        }
    }
    const me = users.find(u => u.userId === myUser.id);
    if (me) {
        if (!myUser.is_verified && me.is_verified) getEl('verificationSuccessModal').classList.remove('hidden');
        myUser.is_verified = me.is_verified;
        myUser.is_admin = me.is_admin;
        localStorage.setItem('chatUser', JSON.stringify(myUser));
    }
    applyUserFilter();
});

function renderUserList(users) {
    usersList.innerHTML = '';
    users.sort((a, b) => b.online - a.online).forEach(u => {
        if (u.userId === myUser.id) return;
        const li = document.createElement('li');
        li.className = `user-item ${!u.online ? 'offline' : ''} ${currentTargetUserId === u.userId ? 'active' : ''}`;
        li.dataset.uid = u.userId;
        const name = myNicknames[u.userId] || u.username;
        const safeName = escapeHtml(name);
        
        let avatarUrl = u.avatar || '/profile.png';
        if (!isValidUrl(avatarUrl)) avatarUrl = '/profile.png';
        const safeAvatar = `background-image: url('${escapeHtml(avatarUrl)}')`;

        li.innerHTML = `
            <div class="u-avatar" style="${safeAvatar}">
                <div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:${u.online ? '#4ade80' : '#a1a1aa'};border:2px solid #18181b;"></div>
            </div>
            <div style="overflow:hidden;">
                <div style="font-weight:600;color:${u.online ? '#fff' : '#bbb'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeName}${getBadgeHtml(u)}</div>
                <div style="font-size:12px;color:${u.online ? '#4ade80' : '#a1a1aa'}">${u.online ? 'En línea' : 'Desconectado'}</div>
            </div>`;
        li.onclick = () => selectUser(u, li);
        usersList.appendChild(li);
    });
}

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
    if(avatar && isValidUrl(avatar)) safeAvatar = avatar;
    const sbItem = document.querySelector(`.user-item[data-uid="${userId}"] .u-avatar`);
    if (sbItem) sbItem.style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;
    if (currentTargetUserId == userId) {
        currentTargetUserObj.avatar = avatar;
        currentChatAvatar.style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;
    }
    document.querySelectorAll(`.message.${myUser.id == userId ? 'me' : 'other'} .audio-avatar-img`).forEach(img => img.src = avatar || '/profile.png');
});

async function selectUser(target, elem) {
    currentTargetUserId = target.userId;
    currentTargetUserObj = target;
    clearReply();
    updateChatHeaderInfo(target);
    chatContainer.classList.add('mobile-chat-active');
    
    let avatarUrl = target.avatar || '/profile.png';
    if (!isValidUrl(avatarUrl)) avatarUrl = '/profile.png';
    currentChatAvatar.style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;
    
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    (elem || document.querySelector(`.user-item[data-uid="${target.userId}"]`))?.classList.add('active');
    emptyState.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    messagesList.classList.remove('hidden');
    chatForm.classList.remove('hidden');
    chatForm.classList.remove('hidden');
    inputMsg.style.height = '45px';
    inputMsg.value = '';
    setTimeout(() => {
        inputMsg.style.height = '45px';
    }, 50);
    messagesList.innerHTML = '<li style="text-align:center;color:#666;font-size:12px">Cargando historial...</li>';

    const history = await apiRequest(`/api/messages/${myUser.id}/${target.userId}`);
    messagesList.innerHTML = '';
    if (history) {
        history.forEach(msg => {
            let rd = null;
            if (msg.reply_to_id) {
                let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
                let rContent = msg.reply_content;
                if (msg.reply_type === 'image') rContent = ICONS.replyImage;
                else if (msg.reply_type === 'audio') rContent = ICONS.replyAudio;
                rd = { username: rName, content: rContent, type: msg.reply_type };
            }
            appendMessageUI(msg.content, msg.from_user_id === myUser.id ? 'me' : 'other', msg.timestamp, msg.id, msg.type, rd, msg.is_deleted, msg.caption);
        });
        messagesList.scrollTop = messagesList.scrollHeight;
    } else messagesList.innerHTML = '<li style="text-align:center;color:red">Error cargando mensajes</li>';
}
backBtn.addEventListener('click', () => chatContainer.classList.remove('mobile-chat-active'));

// --- AUDIO Y CONTROLES ---
function updateButtonState() { mainActionBtn.innerHTML = isRecording ? ICONS.send : (inputMsg.value.trim().length > 0 ? ICONS.send : ICONS.mic); }
inputMsg.addEventListener('input', () => { updateButtonState(); if (currentTargetUserId) socket.emit('typing', { toUserId: currentTargetUserId }); });
mainActionBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isRecording) return stopRecording();
    const text = inputMsg.value.trim();
    if (text.length > 0) {
        sendMessage(text, 'text', currentReplyId);
        inputMsg.value = ''; inputMsg.style.height = 'auto'; inputMsg.focus(); clearReply();
        socket.emit('stop typing', { toUserId: currentTargetUserId });
        updateButtonState();
    } else startRecording();
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
        recordingInterval = setInterval(() => { s++; recordingTimer.innerText = `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }, 1000);
        mediaRecorder.start();
    } catch (e) { alert("Sin acceso al micrófono"); }
}

function stopRecording() { if (mediaRecorder?.state !== 'inactive') { mediaRecorder.stop(); resetRecordingUI(); } }
getEl('cancelRecordingBtn').addEventListener('click', () => { shouldSendAudio = false; stopRecording(); });
function resetRecordingUI() { isRecording = false; clearInterval(recordingInterval); getEl('inputStack').classList.remove('recording'); recordingUI.classList.add('hidden'); updateButtonState(); }

// --- ENVÍO Y RECEPCIÓN ---
function sendMessage(content, type, replyId = null) {
    if (!currentTargetUserId) return;
    if ((type === 'image' || type === 'sticker') && !isValidUrl(content)) { return alert("Error de seguridad"); }
    socket.emit('private message', { content, toUserId: currentTargetUserId, type, replyToId: replyId }, (res) => {
        if (res?.id) {
            let rd = replyId ? { username: replyToName.textContent, content: replyToText.innerHTML, type: type } : null; 
            appendMessageUI(content, 'me', new Date(), res.id, type, rd, 0, res.caption);
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    });
}

socket.on('private message', (msg) => {
    if (currentTargetUserId === msg.fromUserId) {
        let rd = null;
        if (msg.replyToId) {
            let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
            let rText = msg.reply_content;
            if (msg.reply_type === 'image') rText = ICONS.replyImage;
            else if (msg.reply_type === 'sticker') rText = "✨ Sticker";
            else if (msg.type === 'audio') rText = "Mensaje de voz";
            rd = { username: rName, content: rText, type: msg.reply_type };
        }
        appendMessageUI(msg.content, 'other', msg.timestamp, msg.id, msg.type || 'text', rd, 0, msg.caption);
        messagesList.scrollTop = messagesList.scrollHeight;
    }
});

socket.on('message deleted', ({ messageId }) => {
    const el = getEl(`msg-${messageId}`);
    if (!el) return;
    const row = el.closest('.message-row');
    if (myUser?.is_admin) {
        const wrap = row.querySelector('.message-content-wrapper');
        if (wrap && !wrap.classList.contains('deleted-msg')) {
            wrap.classList.add('deleted-msg');
            wrap.style.cssText = 'border:1px dashed #ef4444; opacity:0.7';
            wrap.insertAdjacentHTML('afterbegin', `<div style="color:#ef4444;font-size:10px;font-weight:bold;margin-bottom:4px;">🚫 ELIMINADO</div>`);
        }
    } else {
        row.style.cssText = "opacity:0; transition: opacity 0.3s";
        setTimeout(() => row.remove(), 300);
    }
});

function appendMessageUI(content, ownerType, dateStr, msgId, msgType = 'text', replyData = null, isDeleted = 0, caption = null) {
    const li = document.createElement('li');
    li.className = `message-row ${ownerType}`;
    if (msgType === 'sticker') li.classList.add('sticker-wrapper');
    li.id = `row-${msgId}`;

    const safeReplyName = replyData ? escapeHtml(replyData.username) : '';
    const safeReplyText = replyData ? (replyData.type === 'text' || !replyData.type ? escapeHtml(replyData.content) : replyData.content) : '';
    const quoteHtml = replyData ? `<div class="quoted-message"><div class="quoted-name">${safeReplyName}</div><div class="quoted-text">${safeReplyText}</div></div>` : '';
    let bodyHtml = '';

    if (msgType === 'audio') {
        if (!isValidUrl(content)) return;
        const uid = `audio-${msgId}-${Date.now()}`;
        let avatarUrl = ownerType === 'me' ? (myUser.avatar || '/profile.png') : (currentTargetUserObj.avatar || '/profile.png');
        if (!isValidUrl(avatarUrl)) avatarUrl = '/profile.png';
        const safeAudioSrc = escapeHtml(content);
        const safeAvatarSrc = escapeHtml(avatarUrl);
        bodyHtml = `<div class="custom-audio-player"><img src="${safeAvatarSrc}" class="audio-avatar-img"><audio id="${uid}" src="${safeAudioSrc}" preload="metadata"></audio><button class="audio-control-btn" id="btn-${uid}">${ICONS.play}</button><div class="audio-right-col"><div class="audio-slider-container"><div class="waveform-bg"></div><div class="waveform-fill" id="fill-${uid}"></div><input type="range" class="audio-slider" id="slider-${uid}" value="0" step="0.1"></div><div class="audio-meta-row"><span class="audio-duration" id="time-${uid}">0:00</span><span class="audio-msg-time">${new Date(dateStr).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div></div></div>`;
        setTimeout(() => initAudioPlayer(uid), 0);
    } else if (msgType === 'image') {
        const safeCaption = caption ? escapeHtml(caption) : '';
        const captionHtml = caption ? `<div style="padding: 8px 4px 4px; color: #fff; font-size: 14px; overflow-wrap: anywhere; word-break: break-word; white-space: pre-wrap; line-height: 1.4;">${safeCaption}</div>` : '';
        const safeSrc = isValidUrl(content) ? escapeHtml(content) : '';
        if (safeSrc) bodyHtml = `<div class="chat-image-container skeleton-wrapper image-skeleton"><img src="${safeSrc}" class="chat-image hidden-media" loading="lazy" onclick="viewFullImage(this.src)" onload="this.classList.remove('hidden-media');this.classList.add('visible-media');this.parentElement.classList.remove('image-skeleton','skeleton-wrapper');"></div>${captionHtml}`;
        else bodyHtml = `<div style="color:red; font-size:12px;">[Imagen inválida]</div>`;
    } else if (msgType === 'sticker') {
        const safeSrc = isValidUrl(content) ? escapeHtml(content) : '';
        if (safeSrc) bodyHtml = `<div class="skeleton-wrapper sticker-skeleton"><img src="${safeSrc}" class="sticker-img hidden-media" data-url="${safeSrc}" onload="this.classList.remove('hidden-media');this.classList.add('visible-media');this.parentElement.classList.remove('sticker-skeleton','skeleton-wrapper');"></div>`;
        else bodyHtml = `<div style="color:red; font-size:12px;">[Sticker inválido]</div>`;
    } else {
        bodyHtml = `<span>${escapeHtml(content)}</span>`;
    }

    const deletedLabel = isDeleted ? `<div style="color:#ef4444;font-size:10px;font-weight:bold;margin-bottom:4px;">🚫 ELIMINADO</div>` : '';
    const meta = msgType !== 'audio' ? `<div class="meta-row"><span class="meta">${new Date(dateStr).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>` : '';
    li.innerHTML = `<div class="swipe-reply-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></div><div class="message-content-wrapper message ${ownerType} ${isDeleted?'deleted-msg':''} ${msgType==='image'?'msg-image-wrapper':''}" id="msg-${msgId}" ${isDeleted?'style="border:1px dashed #ef4444;opacity:0.7"':''}>${deletedLabel}${quoteHtml}${bodyHtml}${meta}</div>`;
    messagesList.appendChild(li);
    if (msgType === 'sticker' && isValidUrl(content)) {
        li.querySelector('.sticker-img').addEventListener('click', (e) => { e.stopPropagation(); myFavorites.size ? openStickerOptions(content) : refreshFavoritesCache().then(() => openStickerOptions(content)); });
    }
    const wrapper = li.querySelector('.message-content-wrapper');
    if (ownerType === 'me') addLongPressEvent(wrapper, msgId);
    addSwipeEvent(li, wrapper, msgId, content, msgType, ownerType === 'me' ? myUser.id : currentTargetUserId);
}

window.viewFullImage = (src) => {
    if (!isValidUrl(src)) return;
    const m = document.createElement('div');
    m.className = 'fullscreen-img-modal';
    m.innerHTML = `<img src="${escapeHtml(src)}" class="fullscreen-img">`;
    m.onclick = () => m.remove();
    document.body.appendChild(m);
};

// --- GESTOS ---
function addSwipeEvent(row, wrap, msgId, content, type, ownerId) {
    const icon = row.querySelector('.swipe-reply-icon');
    let startX = 0, currentX = 0, isSwiping = false;
    wrap.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isSwiping = true; wrap.style.transition = 'none'; }, { passive: true });
    wrap.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const diff = e.touches[0].clientX - startX;
        if (diff > 0 && diff < 200) { currentX = diff; wrap.style.transform = `translateX(${diff}px)`; const p = Math.min(diff / 70, 1); icon.style.opacity = p; icon.style.transform = `translateY(-50%) scale(${0.5+p*0.5})`; icon.style.left = '10px'; }
    }, { passive: true });
    const end = () => { if (!isSwiping) return; isSwiping = false; wrap.style.transition = 'transform 0.2s ease'; icon.style.transition = 'all 0.2s'; if (currentX >= 70) { if (navigator.vibrate) navigator.vibrate(30); setReply(msgId, content, type, ownerId); } wrap.style.transform = 'translateX(0)'; icon.style.opacity = '0'; };
    wrap.addEventListener('touchend', end); wrap.addEventListener('touchcancel', end);
}
function addLongPressEvent(el, msgId) {
    let timer; const start = (e) => { if (el.style.transform && el.style.transform !== 'translateX(0px)') return; el.classList.add('pressing'); const cx = e.clientX || e.touches[0].clientX, cy = e.clientY || e.touches[0].clientY; timer = setTimeout(() => openContextMenu(cx, cy, msgId), 600); };
    const cancel = () => { clearTimeout(timer); el.classList.remove('pressing'); };
    el.addEventListener('mousedown', (e) => { if (e.button === 0) start(e); });
    ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach(ev => el.addEventListener(ev, cancel));
    el.addEventListener('touchstart', start, { passive: true });
}
function openContextMenu(x, y, msgId) { messageIdToDelete = msgId; const menu = msgContextMenu.querySelector('.context-menu-content'); msgContextMenu.classList.remove('hidden'); if (window.innerWidth <= 768) menu.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)'; else menu.style.cssText = `position:absolute;top:${Math.min(y, window.innerHeight-100)}px;left:${Math.min(x, window.innerWidth-200)}px`; }
msgContextMenu.addEventListener('click', (e) => { if (e.target === msgContextMenu) { msgContextMenu.classList.add('hidden'); messageIdToDelete = null; } });
getEl('ctxDeleteBtn').addEventListener('click', () => { msgContextMenu.classList.add('hidden'); getEl('deleteConfirmModal').classList.remove('hidden'); });
getEl('cancelDelete').addEventListener('click', () => { getEl('deleteConfirmModal').classList.add('hidden'); messageIdToDelete = null; });
getEl('confirmDelete').addEventListener('click', () => { if (messageIdToDelete && currentTargetUserId) socket.emit('delete message', { messageId: messageIdToDelete, toUserId: currentTargetUserId }); getEl('deleteConfirmModal').classList.add('hidden'); messageIdToDelete = null; });

socket.on('typing', ({ fromUserId, username }) => { if (fromUserId === currentTargetUserId) { typingText.textContent = `${escapeHtml(myNicknames[fromUserId] || username)} está escribiendo...`; typingIndicator.classList.remove('hidden'); } });
socket.on('stop typing', ({ fromUserId }) => { if (fromUserId === currentTargetUserId) typingIndicator.classList.add('hidden'); });
inputMsg.addEventListener('input', () => { inputMsg.style.height = 'auto'; inputMsg.style.height = inputMsg.scrollHeight + 'px'; const isScroll = inputMsg.scrollHeight >= 120; inputMsg.classList.toggle('scroll-active', isScroll); inputMsg.style.overflowY = isScroll ? 'auto' : 'hidden'; });
inputMsg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (inputMsg.value.trim().length) mainActionBtn.click(); } });

// Login/PWA
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authError = document.getElementById('authError');
const installBtn = document.getElementById('installBtn');

if(loginForm) {
    if(localStorage.getItem('chatUser')) {}
    tabLogin.addEventListener('click', () => { tabLogin.classList.add('active'); tabRegister.classList.remove('active'); loginForm.classList.remove('hidden'); registerForm.classList.add('hidden'); authError.textContent = ''; });
    tabRegister.addEventListener('click', () => { tabRegister.classList.add('active'); tabLogin.classList.remove('active'); registerForm.classList.remove('hidden'); loginForm.classList.add('hidden'); authError.textContent = ''; });
    loginForm.addEventListener('submit', async (e) => { e.preventDefault(); const username = document.getElementById('loginUser').value; const password = document.getElementById('loginPass').value; try { const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) }); const data = await res.json(); if(res.ok) { localStorage.setItem('chatUser', JSON.stringify(data.user)); window.location.href = '/'; } else { authError.textContent = data.error; } } catch (e) { authError.textContent = "Error de conexión"; } });
    registerForm.addEventListener('submit', async (e) => { e.preventDefault(); const username = document.getElementById('regUser').value; const password = document.getElementById('regPass').value; try { const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) }); if(res.ok) { alert('Registrado con éxito.'); tabLogin.click(); } else { const data = await res.json(); authError.textContent = data.error; } } catch (e) { authError.textContent = "Error"; } });
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if(installBtn) installBtn.classList.remove('hidden'); });
if(installBtn) { installBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; installBtn.classList.add('hidden'); } }); }
// --- LÓGICA CORREGIDA PARA EL BOTÓN DE VERIFICAR ---
const toggleVerifyBtn = document.getElementById('toggleVerifyBtn');

if (toggleVerifyBtn) {
    toggleVerifyBtn.addEventListener('click', async () => {
        // Validación de seguridad
        if (!currentTargetUserObj || !currentTargetUserId) return;

        // 1. Guardamos el estado anterior por si falla la petición
        const previousState = currentTargetUserObj.is_verified;

        // 2. ACTUALIZACIÓN OPTIMISTA (UI INMEDIATA)
        // Cambiamos el estado localmente antes de esperar al servidor
        currentTargetUserObj.is_verified = !currentTargetUserObj.is_verified; // Toggle true/false (o 1/0)

        // A. Actualizar texto del botón inmediatamente
        toggleVerifyBtn.textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";

        // B. Actualizar el nombre en el Modal (Info Contacto)
        const modalNameEl = document.getElementById('contactInfoName');
        const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;
        if (modalNameEl) {
            modalNameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        }

        // C. [CLAVE] Actualizar el Header del Chat inmediatamente
        updateChatHeaderInfo(currentTargetUserObj);

        // 3. Llamada a la API (Segundo plano)
        try {
            const res = await apiRequest('/api/admin/toggle-verify', 'POST', {
                targetUserId: currentTargetUserObj.userId
            });

            // Si hubo error en el servidor, revertimos los cambios visuales
            if (!res || !res.success) {
                throw new Error("Error en servidor");
            }
        } catch (error) {
            console.error(error);
            // Revertir cambios si falló
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

    // 1. Cargar metadatos (Duración inicial)
    audio.addEventListener('loadedmetadata', () => {
        slider.max = audio.duration;
        timeDisplay.textContent = formatTime(audio.duration);
    });

    // Si los metadatos ya cargaron (cache)
    if (audio.readyState >= 1) {
        slider.max = audio.duration;
        timeDisplay.textContent = formatTime(audio.duration);
    }

    // 2. Botón Play/Pause
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evitar abrir menús o cerrar cosas
        if (audio.paused) {
            // Pausar otros audios sonando
            document.querySelectorAll('audio').forEach(a => {
                if (a !== audio && !a.paused) {
                    a.pause();
                    // Resetear icono del otro botón
                    const otherBtn = document.getElementById(`btn-${a.id}`);
                    if(otherBtn) otherBtn.innerHTML = ICONS.play;
                }
            });
            audio.play();
            btn.innerHTML = ICONS.pause;
        } else {
            audio.pause();
            btn.innerHTML = ICONS.play;
        }
    });

    // 3. Actualizar barra y tiempo mientras reproduce
    audio.addEventListener('timeupdate', () => {
        slider.value = audio.currentTime;
        const percent = (audio.currentTime / audio.duration) * 100;
        fill.style.width = `${percent}%`;
        
        // Muestra tiempo restante o actual. Aquí ponemos duración - actual (estilo WhatsApp)
        // O si prefieres tiempo actual: formatTime(audio.currentTime)
        const remaining = audio.duration - audio.currentTime;
        timeDisplay.textContent = formatTime(remaining); 
    });

    // 4. Mover la barra manualmente (Seeking)
    slider.addEventListener('input', () => {
        audio.currentTime = slider.value;
        const percent = (slider.value / audio.duration) * 100;
        fill.style.width = `${percent}%`;
    });

    // 5. Cuando termina el audio
    audio.addEventListener('ended', () => {
        btn.innerHTML = ICONS.play;
        fill.style.width = '0%';
        slider.value = 0;
        timeDisplay.textContent = formatTime(audio.duration);
    });
    
    // Seguridad por si se pausa externamente
    audio.addEventListener('pause', () => {
        btn.innerHTML = ICONS.play;
    });
    
    audio.addEventListener('play', () => {
        btn.innerHTML = ICONS.pause;
    });
}