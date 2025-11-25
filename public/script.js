// --- ELEMENTOS DOM (Helpers) ---
const getEl = (id) => document.getElementById(id);

// --- ESTADO DE LA APLICACIÓN ---
let myUser = null;
let currentTargetUserId = null;
let currentTargetUserObj = null;
let currentReplyId = null;
let messageIdToDelete = null;

// Cachés y Colecciones
let myNicknames = {};
let allUsersCache = [];
let myFavorites = new Set();
let audioChunks = [];

// Variables de Control
let isRecording = false;
let shouldSendAudio = true;
let recordingInterval = null;
let mediaRecorder = null;
let searchTimeout = null;
let currentStickerTab = 'giphy';
let currentStickerUrlInModal = null;
let cropper = null;

// --- CONFIGURACIÓN SOCKET ---
const socket = io({
    autoConnect: false,
    transports: ['websocket', 'polling']
});

// --- ICONOS SVG (Centralizados) ---
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

/**
 * ==========================================
 * UTILIDADES Y HELPERS
 * ==========================================
 */

// Sanitizar HTML para prevenir XSS
const escapeHtml = (text) => {
    if (!text) return text;
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Validar URLs
const isValidUrl = (string) => {
    if (!string) return false;
    if (string.startsWith('/') || string.startsWith('./')) return true;
    try {
        const url = new URL(string);
        return ['http:', 'https:'].includes(url.protocol);
    } catch (_) {
        return false;
    }
};

// Obtener Badge HTML
const getBadgeHtml = (u) => {
    if (!u) return '';
    if (u.is_admin) return ICONS.purpleBadge;
    if (u.is_verified) return ICONS.blueBadge;
    return '';
};

// Formatear hora
const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// API Helper
async function apiRequest(url, method = 'GET', body = null) {
    try {
        const headers = {};
        const opts = { method, headers };

        if (body) {
            if (!(body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            } else {
                opts.body = body;
            }
        }

        const res = await fetch(url, opts);

        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('chatUser');
            window.location.href = '/login.html';
            return null;
        }

        return res.ok ? await res.json() : null;
    } catch (e) {
        console.error("API Error:", e);
        return null;
    }
}

/**
 * ==========================================
 * INICIALIZACIÓN Y SESIÓN
 * ==========================================
 */

async function checkSession() {
    if (window.location.pathname === '/login.html') return;
    
    const userData = await apiRequest('/api/me');
    if (userData) {
        loginSuccess(userData);
    } else {
        window.location.href = '/login.html';
    }
}

function loginSuccess(user) {
    myUser = user;
    localStorage.setItem('chatUser', JSON.stringify(user));
    
    // UI Updates
    getEl('profileBtn').classList.remove('hidden');
    if (myUser.is_admin) document.body.classList.add('is-admin');
    updateMyAvatarUI(myUser.avatar);
    
    // Connect Logic
    socket.connect();
    updateButtonState();
    refreshFavoritesCache();
}

// Iniciar
checkSession();

/**
 * ==========================================
 * GESTIÓN DE PERFIL Y UI
 * ==========================================
 */

function updateMyAvatarUI(url) {
    const finalUrl = (url && isValidUrl(url)) ? url : '/profile.png';
    const css = `url('${escapeHtml(finalUrl)}')`;
    getEl('myAvatar').style.backgroundImage = css;
    getEl('profilePreviewAvatar').style.backgroundImage = css;
}

// Carga de Avatar
getEl('avatarInput').addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    const fd = new FormData();
    fd.append('avatar', e.target.files[0]);
    await apiRequest('/api/upload-avatar', 'POST', fd);
});

// Editar campos "inline" (DB)
function enableInlineEdit(elementId, dbField, prefix = '') {
    const el = getEl(elementId);
    if (!el) return;

    el.classList.add('editable-field');
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    newEl.addEventListener('click', () => {
        let currentText = newEl.innerText.replace(prefix, '').replace('✎', '').trim();
        const originalContent = newEl.innerHTML;

        const input = document.createElement('input');
        Object.assign(input, {
            type: 'text',
            value: currentText,
            className: 'editing-input',
            placeholder: dbField === 'bio' ? "Escribe algo sobre ti..." : ""
        });

        newEl.innerHTML = '';
        newEl.appendChild(input);
        newEl.classList.remove('editable-field');
        input.focus();

        const save = async () => {
            const newValue = input.value.trim();
            if (newValue === currentText) return renderValue(newValue);
            if (dbField === 'username' && newValue.length < 3) {
                alert("Mínimo 3 caracteres");
                return renderValue(currentText);
            }

            try {
                input.disabled = true;
                const res = await apiRequest('/api/profile/update', 'PUT', { field: dbField, value: newValue });
                
                if (res?.success) {
                    myUser[dbField] = res.value;
                    localStorage.setItem('chatUser', JSON.stringify(myUser));
                    renderValue(res.value);
                } else {
                    alert(res?.error || "Error al actualizar");
                    restoreOriginal();
                }
            } catch (e) {
                restoreOriginal();
            }
        };

        const renderValue = (val) => {
            newEl.innerHTML = '';
            if (dbField === 'bio' && !val) {
                newEl.textContent = "Añadir una biografía...";
                newEl.style.color = "#666";
            } else {
                newEl.textContent = prefix + val;
                newEl.style.color = "";
            }
            if (dbField === 'display_name') newEl.insertAdjacentHTML('beforeend', getBadgeHtml(myUser));
            newEl.classList.add('editable-field');
        };

        const restoreOriginal = () => {
            newEl.innerHTML = originalContent;
            newEl.classList.add('editable-field');
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') restoreOriginal();
        });
    });
}

// Editar Nicknames (Local + Socket)
function enableNicknameEdit(elementId, targetUserId) {
    const el = getEl(elementId);
    if (!el) return;

    el.classList.add('editable-field');
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    newEl.addEventListener('click', () => {
        const currentText = newEl.innerText.replace('✎', '').trim();
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
            socket.emit('set nickname', { targetUserId, nickname: newValue });

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
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') {
                newEl.innerHTML = originalContent;
                newEl.classList.add('editable-field');
            }
        });
    });
}

/**
 * ==========================================
 * LISTA DE USUARIOS Y CHAT
 * ==========================================
 */

// Filtrado de usuarios
getEl('searchUsers').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyUserFilter, 300);
});

function applyUserFilter() {
    const term = getEl('searchUsers').value.toLowerCase().trim();
    if (!term) return renderUserList(allUsersCache);

    const filtered = allUsersCache.filter(u =>
        u.userId !== myUser.id &&
        (u.username.toLowerCase().includes(term) || (myNicknames[u.userId] || '').toLowerCase().includes(term))
    );
    renderUserList(filtered);
}

function renderUserList(users) {
    const usersList = getEl('usersList');
    usersList.innerHTML = '';
    
    // Ordenar: Online primero
    users.sort((a, b) => b.online - a.online).forEach(u => {
        if (u.userId === myUser.id) return;

        const li = document.createElement('li');
        li.className = `user-item ${!u.online ? 'offline' : ''} ${currentTargetUserId === u.userId ? 'active' : ''}`;
        li.dataset.uid = u.userId;

        const name = escapeHtml(myNicknames[u.userId] || u.username);
        const avatarUrl = isValidUrl(u.avatar) ? escapeHtml(u.avatar) : '/profile.png';
        const statusColor = u.online ? '#4ade80' : '#a1a1aa';

        li.innerHTML = `
            <div class="u-avatar" style="background-image: url('${avatarUrl}')">
                <div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:${statusColor};border:2px solid #18181b;"></div>
            </div>
            <div style="overflow:hidden;">
                <div style="font-weight:600;color:${u.online ? '#fff' : '#bbb'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${name}${getBadgeHtml(u)}
                </div>
                <div style="font-size:12px;color:${statusColor}">
                    ${u.online ? 'En línea' : 'Desconectado'}
                </div>
            </div>`;
        
        li.onclick = () => selectUser(u, li);
        usersList.appendChild(li);
    });
}

async function selectUser(target, elem) {
    currentTargetUserId = target.userId;
    currentTargetUserObj = target;
    clearReply();
    updateChatHeaderInfo(target);
    
    // UI Transitions
    document.querySelector('.chat-container').classList.add('mobile-chat-active');
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    (elem || document.querySelector(`.user-item[data-uid="${target.userId}"]`))?.classList.add('active');
    
    const avatarUrl = isValidUrl(target.avatar) ? target.avatar : '/profile.png';
    getEl('currentChatAvatar').style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;
    
    getEl('emptyState').classList.add('hidden');
    document.querySelector('.chat-header').classList.remove('hidden');
    const messagesList = getEl('messages');
    messagesList.classList.remove('hidden');
    getEl('form').classList.remove('hidden');

    // Cargar Mensajes
    messagesList.innerHTML = '<li style="text-align:center;color:#666;font-size:12px">Cargando historial...</li>';
    const history = await apiRequest(`/api/messages/${myUser.id}/${target.userId}`);
    
    messagesList.innerHTML = '';
    if (history) {
        history.forEach(msg => {
            let rd = null;
            if (msg.reply_to_id) {
                rd = resolveReplyData(msg);
            }
            appendMessageUI(msg.content, msg.from_user_id === myUser.id ? 'me' : 'other', msg.timestamp, msg.id, msg.type, rd, msg.is_deleted, msg.caption);
        });
        messagesList.scrollTop = messagesList.scrollHeight;
    } else {
        messagesList.innerHTML = '<li style="text-align:center;color:red">Error cargando mensajes</li>';
    }
}

function updateChatHeaderInfo(u) {
    getEl('chatTitle').innerHTML = escapeHtml(myNicknames[u.userId] || u.username) + getBadgeHtml(u);
}

function resolveReplyData(msg) {
    let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
    let rContent = msg.reply_content;
    
    if (msg.reply_type === 'image') rContent = ICONS.replyImage;
    else if (msg.reply_type === 'audio') rContent = ICONS.replyAudio;
    
    return { username: rName, content: rContent, type: msg.reply_type };
}

/**
 * ==========================================
 * EDITOR DE IMÁGENES
 * ==========================================
 */
const chatImageInput = getEl('chatImageInput');
const imageEditorModal = getEl('imageEditorModal');
const imageToEdit = getEl('imageToEdit');

chatImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        if (cropper) { cropper.destroy(); cropper = null; }
        
        imageToEdit.src = evt.target.result;
        imageEditorModal.classList.remove('hidden');
        getEl('imageCaptionInput').value = '';
        getEl('imageCaptionInput').focus();

        imageToEdit.onload = () => {
            cropper = new Cropper(imageToEdit, {
                viewMode: 1, dragMode: 'move', autoCropArea: 0.9, restore: false, guides: true,
                center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true,
                toggleDragModeOnDblclick: false, background: false, modal: true, 
                minContainerWidth: 300, minContainerHeight: 300
            });
        };
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
});

getEl('sendImageBtn').addEventListener('click', () => {
    if (!cropper) return;
    
    const btn = getEl('sendImageBtn');
    btn.innerHTML = '...';

    cropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'edited-image.jpg');

        const data = await apiRequest('/api/upload-chat-image', 'POST', formData);
        
        if (data) {
            socket.emit('private message', {
                content: data.imageUrl,
                toUserId: currentTargetUserId,
                type: 'image',
                replyToId: currentReplyId,
                caption: getEl('imageCaptionInput').value.trim()
            }, (res) => {
                appendMessageUI(res.content, 'me', res.timestamp, res.id, 'image', null, false, res.caption);
            });
            clearReply();
            imageEditorModal.classList.add('hidden');
        } else {
            alert("Error al enviar imagen");
        }

        btn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>`;
        if(cropper) { cropper.destroy(); cropper = null; }
    }, 'image/jpeg', 0.8);
});

getEl('closeEditorBtn').addEventListener('click', () => {
    imageEditorModal.classList.add('hidden');
    if (cropper) cropper.destroy();
});
getEl('rotateBtn').addEventListener('click', () => cropper?.rotate(90));
getEl('resetCropBtn').addEventListener('click', () => cropper?.reset());

/**
 * ==========================================
 * AUDIO (GRABACIÓN Y REPRODUCCIÓN)
 * ==========================================
 */
const inputMsg = getEl('input');
const mainActionBtn = getEl('mainActionBtn');

function updateButtonState() {
    const hasText = inputMsg.value.trim().length > 0;
    mainActionBtn.innerHTML = isRecording ? ICONS.send : (hasText ? ICONS.send : ICONS.mic);
}

mainActionBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isRecording) return stopRecording();
    
    const text = inputMsg.value.trim();
    if (text.length > 0) {
        sendMessage(text, 'text', currentReplyId);
        inputMsg.value = '';
        inputMsg.style.height = 'auto';
        inputMsg.focus();
        clearReply();
        socket.emit('stop typing', { toUserId: currentTargetUserId });
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
            stream.getTracks().forEach(t => t.stop());
            if (shouldSendAudio) {
                const fd = new FormData();
                fd.append('audio', new Blob(audioChunks, { type: 'audio/webm' }), 'recording.webm');
                const data = await apiRequest('/api/upload-audio', 'POST', fd);
                if (data) {
                    sendMessage(data.audioUrl, 'audio', currentReplyId);
                    clearReply();
                }
            }
        };

        isRecording = true;
        shouldSendAudio = true;
        
        getEl('inputStack').classList.add('recording');
        getEl('recordingUI').classList.remove('hidden');
        updateButtonState();

        let s = 0;
        getEl('recordingTimer').innerText = "0:00";
        recordingInterval = setInterval(() => {
            s++;
            getEl('recordingTimer').innerText = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
        }, 1000);

        mediaRecorder.start();
    } catch (e) {
        alert("Sin acceso al micrófono");
    }
}

function stopRecording() {
    if (mediaRecorder?.state !== 'inactive') {
        mediaRecorder.stop();
        resetRecordingUI();
    }
}

function resetRecordingUI() {
    isRecording = false;
    clearInterval(recordingInterval);
    getEl('inputStack').classList.remove('recording');
    getEl('recordingUI').classList.add('hidden');
    updateButtonState();
}

getEl('cancelRecordingBtn').addEventListener('click', () => {
    shouldSendAudio = false;
    stopRecording();
});

/**
 * ==========================================
 * STICKERS
 * ==========================================
 */
const stickerPanel = getEl('stickerPanel');

const switchStickerTab = (tab) => {
    currentStickerTab = tab;
    getEl('tabGiphy').classList.toggle('active', tab === 'giphy');
    getEl('tabFavs').classList.toggle('active', tab === 'favorites');
    getEl('stickerHeaderSearch').classList.toggle('hidden', tab !== 'giphy');
    
    if (tab === 'giphy') loadStickers(getEl('stickerSearch').value);
    else loadFavoritesFromServer();
};

if (getEl('tabGiphy')) {
    getEl('tabGiphy').addEventListener('click', () => switchStickerTab('giphy'));
    getEl('tabFavs').addEventListener('click', () => switchStickerTab('favorites'));
}

getEl('btnStickers').addEventListener('click', () => {
    stickerPanel.classList.toggle('hidden');
    if (!stickerPanel.classList.contains('hidden')) {
        refreshFavoritesCache().then(() => {
            currentStickerTab === 'giphy' ? loadStickers() : loadFavoritesFromServer();
        });
    }
});

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
    const results = getEl('stickerResults');
    results.innerHTML = '<div class="loading-stickers">Cargando...</div>';
    
    const data = await apiRequest(`/api/stickers-proxy?q=${encodeURIComponent(query)}`);
    if (data?.data) {
        renderStickersGrid(data.data.map(i => ({
            url: i.images.fixed_height.url,
            thumb: i.images.fixed_height_small.url
        })));
    } else {
        results.innerHTML = '<div class="loading-stickers">Error al cargar</div>';
    }
}

async function loadFavoritesFromServer() {
    const results = getEl('stickerResults');
    results.innerHTML = '<div class="loading-stickers">Cargando favoritos...</div>';
    await refreshFavoritesCache();
    
    if (!myFavorites.size) {
        results.innerHTML = '<div class="loading-stickers">Aún no tienes stickers favoritos.</div>';
    } else {
        renderStickersGrid(Array.from(myFavorites).map(url => ({ url, thumb: url })));
    }
}

function renderStickersGrid(items) {
    const results = getEl('stickerResults');
    results.innerHTML = '';
    
    if (!items.length) {
        results.innerHTML = '<div class="loading-stickers">No se encontraron resultados</div>';
        return;
    }

    items.forEach(item => {
        if (!isValidUrl(item.thumb) || !isValidUrl(item.url)) return;
        
        const wrap = document.createElement('div');
        wrap.className = 'sticker-item-wrapper';
        
        const img = document.createElement('img');
        img.src = escapeHtml(item.thumb);
        img.className = 'sticker-thumb';
        img.loading = "lazy";
        img.onclick = () => {
            sendSticker(item.url);
            stickerPanel.classList.add('hidden');
        };

        const btn = document.createElement('button');
        btn.className = `fav-action-btn ${myFavorites.has(item.url) ? 'is-fav' : ''}`;
        btn.innerHTML = '★';
        btn.onclick = (e) => {
            e.stopPropagation();
            toggleFavoriteSticker(item.url, btn, wrap);
        };

        wrap.append(img, btn);
        results.appendChild(wrap);
    });
}

async function toggleFavoriteSticker(url, btn, wrap) {
    if (!isValidUrl(url)) return;
    
    const isFav = myFavorites.has(url);
    const endpoint = isFav ? '/api/favorites/remove' : '/api/favorites/add';
    const res = await apiRequest(endpoint, 'POST', { url });

    if (res) {
        if (isFav) myFavorites.delete(url);
        else myFavorites.add(url);
        
        if (btn) btn.classList.toggle('is-fav', !isFav);
        if (isFav && currentStickerTab === 'favorites' && wrap) wrap.remove();
    }
}

const sendSticker = (url) => {
    if (isValidUrl(url)) {
        sendMessage(url, 'sticker', currentReplyId);
        clearReply();
    }
};

// --- Modal Opciones Sticker ---
function openStickerOptions(url) {
    toggleStickerModal(true, url);
}

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
    } else {
        currentStickerUrlInModal = null;
    }
};

getEl('stickerModalBackdrop')?.addEventListener('click', () => toggleStickerModal(false));
getEl('btnStickerClose')?.addEventListener('click', () => toggleStickerModal(false));
getEl('btnStickerFavAction')?.addEventListener('click', async () => {
    if (currentStickerUrlInModal) {
        await toggleFavoriteSticker(currentStickerUrlInModal, null, null);
        // Refresh visual
        toggleStickerModal(true, currentStickerUrlInModal);
        setTimeout(() => toggleStickerModal(false), 200);
    }
});

/**
 * ==========================================
 * ENVÍO DE MENSAJES Y SOCKETS
 * ==========================================
 */

function sendMessage(content, type, replyId = null) {
    if (!currentTargetUserId) return;
    if ((type === 'image' || type === 'sticker') && !isValidUrl(content)) return alert("Error de seguridad");

    socket.emit('private message', { content, toUserId: currentTargetUserId, type, replyToId: replyId }, (res) => {
        if (res?.id) {
            let rd = null;
            if (replyId) {
                rd = {
                    username: getEl('replyToName').textContent,
                    content: getEl('replyToText').innerHTML,
                    type: type
                };
            }
            appendMessageUI(content, 'me', new Date(), res.id, type, rd, 0, res.caption);
            getEl('messages').scrollTop = getEl('messages').scrollHeight;
        }
    });
}

function appendMessageUI(content, ownerType, dateStr, msgId, msgType = 'text', replyData = null, isDeleted = 0, caption = null) {
    const li = document.createElement('li');
    li.className = `message-row ${ownerType}`;
    if (msgType === 'sticker') li.classList.add('sticker-wrapper');
    li.id = `row-${msgId}`;

    // Construcción de la cita (Reply)
    let quoteHtml = '';
    if (replyData) {
        const safeReplyName = escapeHtml(replyData.username);
        const safeReplyText = (replyData.type === 'text' || !replyData.type) ? escapeHtml(replyData.content) : replyData.content;
        quoteHtml = `<div class="quoted-message"><div class="quoted-name">${safeReplyName}</div><div class="quoted-text">${safeReplyText}</div></div>`;
    }

    // Construcción del cuerpo del mensaje
    let bodyHtml = '';
    const safeContent = isValidUrl(content) ? escapeHtml(content) : '';
    
    switch (msgType) {
        case 'audio':
            if (safeContent) {
                const uid = `audio-${msgId}-${Date.now()}`;
                let avatarUrl = ownerType === 'me' ? (myUser.avatar || '/profile.png') : (currentTargetUserObj.avatar || '/profile.png');
                if (!isValidUrl(avatarUrl)) avatarUrl = '/profile.png';
                
                bodyHtml = `
                <div class="custom-audio-player">
                    <img src="${escapeHtml(avatarUrl)}" class="audio-avatar-img">
                    <audio id="${uid}" src="${safeContent}" preload="metadata"></audio>
                    <button class="audio-control-btn" id="btn-${uid}">${ICONS.play}</button>
                    <div class="audio-right-col">
                        <div class="audio-slider-container">
                            <div class="waveform-bg"></div>
                            <div class="waveform-fill" id="fill-${uid}"></div>
                            <input type="range" class="audio-slider" id="slider-${uid}" value="0" step="0.1">
                        </div>
                        <div class="audio-meta-row">
                            <span class="audio-duration" id="time-${uid}">0:00</span>
                            <span class="audio-msg-time">${formatTime(dateStr)}</span>
                        </div>
                    </div>
                </div>`;
                // Se asume que initAudioPlayer existe o está definido en el código original global
                setTimeout(() => typeof initAudioPlayer === 'function' && initAudioPlayer(uid), 0);
            }
            break;
            
        case 'image':
            if (safeContent) {
                const safeCaption = caption ? escapeHtml(caption) : '';
                const captionHtml = caption ? `<div class="msg-caption">${safeCaption}</div>` : '';
                bodyHtml = `<div class="chat-image-container skeleton-wrapper image-skeleton">
                                <img src="${safeContent}" class="chat-image hidden-media" loading="lazy" 
                                onclick="viewFullImage(this.src)" 
                                onload="this.classList.remove('hidden-media');this.classList.add('visible-media');this.parentElement.classList.remove('image-skeleton','skeleton-wrapper');">
                            </div>${captionHtml}`;
            } else {
                bodyHtml = `<div class="msg-error">[Imagen inválida]</div>`;
            }
            break;
            
        case 'sticker':
            if (safeContent) {
                bodyHtml = `<div class="skeleton-wrapper sticker-skeleton">
                                <img src="${safeContent}" class="sticker-img hidden-media" data-url="${safeContent}"
                                onload="this.classList.remove('hidden-media');this.classList.add('visible-media');this.parentElement.classList.remove('sticker-skeleton','skeleton-wrapper');">
                            </div>`;
            } else {
                bodyHtml = `<div class="msg-error">[Sticker inválido]</div>`;
            }
            break;
            
        default:
            bodyHtml = `<span>${escapeHtml(content)}</span>`;
            break;
    }

    const deletedLabel = isDeleted ? `<div class="deleted-label">🚫 ELIMINADO</div>` : '';
    const meta = msgType !== 'audio' ? `<div class="meta-row"><span class="meta">${formatTime(dateStr)}</span></div>` : '';
    const wrapperStyle = isDeleted ? 'style="border:1px dashed #ef4444;opacity:0.7"' : '';

    li.innerHTML = `
        <div class="swipe-reply-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></div>
        <div class="message-content-wrapper message ${ownerType} ${isDeleted ? 'deleted-msg' : ''} ${msgType === 'image' ? 'msg-image-wrapper' : ''}" id="msg-${msgId}" ${wrapperStyle}>
            ${deletedLabel}${quoteHtml}${bodyHtml}${meta}
        </div>`;

    getEl('messages').appendChild(li);

    // Eventos extra para stickers e imágenes
    if (msgType === 'sticker' && isValidUrl(content)) {
        li.querySelector('.sticker-img').addEventListener('click', (e) => {
            e.stopPropagation();
            if (myFavorites.size) openStickerOptions(content);
            else refreshFavoritesCache().then(() => openStickerOptions(content));
        });
    }

    const wrapper = li.querySelector('.message-content-wrapper');
    if (ownerType === 'me') addLongPressEvent(wrapper, msgId);
    addSwipeEvent(li, wrapper, msgId, content, msgType, ownerType === 'me' ? myUser.id : currentTargetUserId);
}

// Fullscreen Image
window.viewFullImage = (src) => {
    if (!isValidUrl(src)) return;
    const m = document.createElement('div');
    m.className = 'fullscreen-img-modal';
    m.innerHTML = `<img src="${escapeHtml(src)}" class="fullscreen-img">`;
    m.onclick = () => m.remove();
    document.body.appendChild(m);
};

// --- REPLY Y INPUTS ---
function setReply(msgId, content, type, ownerId) {
    currentReplyId = msgId;
    let name = ownerId === myUser.id ? "Tú" : (myNicknames[ownerId] || allUsersCache.find(u => u.userId == ownerId)?.username || "Usuario");
    
    getEl('replyToName').textContent = escapeHtml(name);
    getEl('replyToImagePreview').classList.add('hidden');
    getEl('replyToImagePreview').style.backgroundImage = 'none';

    if (type === 'image') {
        getEl('replyToText').innerHTML = ICONS.replyImage;
        if (isValidUrl(content)) {
            getEl('replyToImagePreview').style.backgroundImage = `url('${escapeHtml(content)}')`;
            getEl('replyToImagePreview').classList.remove('hidden');
        }
    } else if (type === 'sticker') {
        if (isValidUrl(content)) getEl('replyToText').innerHTML = `<img src="${escapeHtml(content)}" class="reply-sticker-preview">`;
        else getEl('replyToText').innerHTML = "Sticker";
    } else if (type === 'audio') {
        getEl('replyToText').innerHTML = ICONS.replyAudio;
    } else {
        getEl('replyToText').textContent = content;
    }

    getEl('replyPreview').classList.remove('hidden');
    getEl('inputStack')?.classList.add('active');
    inputMsg.focus();
}

function clearReply() {
    currentReplyId = null;
    getEl('replyPreview').classList.add('hidden');
    getEl('inputStack')?.classList.remove('active');
}
getEl('closeReplyBtn').addEventListener('click', clearReply);
getEl('btnImage').addEventListener('click', () => chatImageInput.click());

// --- SOCKET LISTENERS ---

socket.on('users', (users) => {
    allUsersCache = users;
    
    if (currentTargetUserId) {
        const updated = users.find(u => u.userId === currentTargetUserId);
        if (updated) {
            currentTargetUserObj = updated;
            updateChatHeaderInfo(updated);
            if (myUser.is_admin) {
                const btn = getEl('toggleVerifyBtn');
                if (btn) btn.textContent = updated.is_verified ? "Quitar Verificado" : "Verificar Usuario";
            }
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

socket.on('private message', (msg) => {
    if (currentTargetUserId === msg.fromUserId) {
        let rd = null;
        if (msg.replyToId) {
            rd = {
                username: msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario"),
                content: msg.reply_type === 'image' ? ICONS.replyImage : (msg.reply_type === 'sticker' ? "✨ Sticker" : (msg.reply_type === 'audio' ? "Mensaje de voz" : msg.reply_content)),
                type: msg.reply_type
            };
        }
        appendMessageUI(msg.content, 'other', msg.timestamp, msg.id, msg.type || 'text', rd, 0, msg.caption);
        getEl('messages').scrollTop = getEl('messages').scrollHeight;
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
            wrap.insertAdjacentHTML('afterbegin', `<div class="deleted-label">🚫 ELIMINADO</div>`);
        }
    } else {
        row.style.cssText = "opacity:0; transition: opacity 0.3s";
        setTimeout(() => row.remove(), 300);
    }
});

socket.on('user_updated_profile', ({ userId, avatar }) => {
    const u = allUsersCache.find(x => x.userId == userId);
    let safeAvatar = (avatar && isValidUrl(avatar)) ? avatar : '/profile.png';
    
    if (u) u.avatar = avatar;
    
    if (myUser.id == userId) {
        myUser.avatar = avatar;
        localStorage.setItem('chatUser', JSON.stringify(myUser));
        updateMyAvatarUI(avatar);
    }
    
    const sbItem = document.querySelector(`.user-item[data-uid="${userId}"] .u-avatar`);
    if (sbItem) sbItem.style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;
    
    if (currentTargetUserId == userId) {
        currentTargetUserObj.avatar = avatar;
        getEl('currentChatAvatar').style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;
    }
    
    // Actualizar avatares en mensajes de audio
    document.querySelectorAll(`.message.${myUser.id == userId ? 'me' : 'other'} .audio-avatar-img`).forEach(img => img.src = safeAvatar);
});

socket.on('nicknames', (map) => {
    myNicknames = map;
    if (allUsersCache.length) renderUserList(allUsersCache);
    if (currentTargetUserObj) updateChatHeaderInfo(currentTargetUserObj);
});

socket.on('typing', ({ fromUserId, username }) => {
    if (fromUserId === currentTargetUserId) {
        getEl('typingText').textContent = `${escapeHtml(myNicknames[fromUserId] || username)} está escribiendo...`;
        getEl('typingIndicator').classList.remove('hidden');
    }
});

socket.on('stop typing', ({ fromUserId }) => {
    if (fromUserId === currentTargetUserId) getEl('typingIndicator').classList.add('hidden');
});

// --- GESTOS Y EVENTOS EXTRA ---
function addSwipeEvent(row, wrap, msgId, content, type, ownerId) {
    const icon = row.querySelector('.swipe-reply-icon');
    let startX = 0, currentX = 0, isSwiping = false;
    
    wrap.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isSwiping = true;
        wrap.style.transition = 'none';
    }, { passive: true });
    
    wrap.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const diff = e.touches[0].clientX - startX;
        if (diff > 0 && diff < 200) {
            currentX = diff;
            wrap.style.transform = `translateX(${diff}px)`;
            const p = Math.min(diff / 70, 1);
            icon.style.opacity = p;
            icon.style.transform = `translateY(-50%) scale(${0.5 + p * 0.5})`;
            icon.style.left = '10px';
        }
    }, { passive: true });
    
    const end = () => {
        if (!isSwiping) return;
        isSwiping = false;
        wrap.style.transition = 'transform 0.2s ease';
        icon.style.transition = 'all 0.2s';
        if (currentX >= 70) {
            if (navigator.vibrate) navigator.vibrate(30);
            setReply(msgId, content, type, ownerId);
        }
        wrap.style.transform = 'translateX(0)';
        icon.style.opacity = '0';
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
        timer = setTimeout(() => openContextMenu(cx, cy, msgId), 600);
    };
    const cancel = () => {
        clearTimeout(timer);
        el.classList.remove('pressing');
    };
    
    el.addEventListener('mousedown', (e) => { if (e.button === 0) start(e); });
    ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach(ev => el.addEventListener(ev, cancel));
    el.addEventListener('touchstart', start, { passive: true });
}

function openContextMenu(x, y, msgId) {
    messageIdToDelete = msgId;
    const menuContent = getEl('msgContextMenu').querySelector('.context-menu-content');
    getEl('msgContextMenu').classList.remove('hidden');
    
    if (window.innerWidth <= 768) {
        menuContent.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)';
    } else {
        const top = Math.min(y, window.innerHeight - 100);
        const left = Math.min(x, window.innerWidth - 200);
        menuContent.style.cssText = `position:absolute;top:${top}px;left:${left}px`;
    }
}

// Eventos Context Menu
const msgContextMenu = getEl('msgContextMenu');
msgContextMenu.addEventListener('click', (e) => {
    if (e.target === msgContextMenu) {
        msgContextMenu.classList.add('hidden');
        messageIdToDelete = null;
    }
});
getEl('ctxDeleteBtn').addEventListener('click', () => {
    msgContextMenu.classList.add('hidden');
    getEl('deleteConfirmModal').classList.remove('hidden');
});
getEl('cancelDelete').addEventListener('click', () => {
    getEl('deleteConfirmModal').classList.add('hidden');
    messageIdToDelete = null;
});
getEl('confirmDelete').addEventListener('click', () => {
    if (messageIdToDelete && currentTargetUserId) {
        socket.emit('delete message', { messageId: messageIdToDelete, toUserId: currentTargetUserId });
    }
    getEl('deleteConfirmModal').classList.add('hidden');
    messageIdToDelete = null;
});

// UI Event Helpers
getEl('backBtn').addEventListener('click', () => document.querySelector('.chat-container').classList.remove('mobile-chat-active'));

inputMsg.addEventListener('input', () => {
    inputMsg.style.height = 'auto';
    inputMsg.style.height = inputMsg.scrollHeight + 'px';
    const isScroll = inputMsg.scrollHeight >= 120;
    inputMsg.classList.toggle('scroll-active', isScroll);
    inputMsg.style.overflowY = isScroll ? 'auto' : 'hidden';
    
    updateButtonState();
    if (currentTargetUserId) socket.emit('typing', { toUserId: currentTargetUserId });
});

inputMsg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (inputMsg.value.trim().length) mainActionBtn.click();
    }
});

/**
 * ==========================================
 * MODALES DE PERFIL Y ADMIN
 * ==========================================
 */

// Perfil Propio
getEl('profileBtn').addEventListener('click', () => {
    const nameEl = getEl('profileRealName');
    const displayName = myUser.display_name || myUser.username;
    
    nameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(myUser);
    getEl('profileHandle').textContent = `@${myUser.username}`;
    
    const bioEl = getEl('profileBio');
    bioEl.textContent = myUser.bio || "Añade una biografía...";
    bioEl.style.color = !myUser.bio ? "#666" : "#e4e4e7";

    getEl('profileModal').classList.remove('hidden');
    getEl('profileOptionsMenu')?.classList.add('hidden');

    enableInlineEdit('profileRealName', 'display_name');
    enableInlineEdit('profileHandle', 'username', '@');
    enableInlineEdit('profileBio', 'bio');
});

// Info Contacto
getEl('headerAvatarBtn').addEventListener('click', () => {
    if (!currentTargetUserObj) return;

    const modal = getEl('contactInfoModal');
    const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;

    getEl('contactInfoName').innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
    getEl('contactRealUsername').textContent = `@${currentTargetUserObj.username}`;
    
    const bioEl = getEl('contactInfoBio');
    bioEl.textContent = currentTargetUserObj.bio || "Sin biografía.";
    bioEl.style.color = currentTargetUserObj.bio ? "#e4e4e7" : "#666";

    let avatarUrl = isValidUrl(currentTargetUserObj.avatar) ? currentTargetUserObj.avatar : '/profile.png';
    getEl('contactInfoAvatar').style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;

    const adminSec = getEl('adminActionsSection');
    if (myUser?.is_admin) {
        adminSec.classList.remove('hidden');
        getEl('toggleVerifyBtn').textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
    } else {
        adminSec.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    enableNicknameEdit('contactInfoName', currentTargetUserObj.userId);
});

getEl('closeContactInfo').addEventListener('click', () => getEl('contactInfoModal').classList.add('hidden'));
getEl('closeProfile').addEventListener('click', () => getEl('profileModal').classList.add('hidden'));
getEl('acceptVerifiedBtn').addEventListener('click', () => getEl('verificationSuccessModal').classList.add('hidden'));

// Menú de opciones de perfil
const profileOptionsBtn = getEl('profileOptionsBtn');
if (profileOptionsBtn) {
    profileOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        getEl('profileOptionsMenu').classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
        const menu = getEl('profileOptionsMenu');
        if (menu && !menu.contains(e.target) && !profileOptionsBtn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
}

// Logout & Confirmación
const logoutBtn = getEl('profileLogout');
if (logoutBtn) {
    logoutBtn.replaceWith(logoutBtn.cloneNode(true)); // Limpiar eventos anteriores
    getEl('profileLogout').addEventListener('click', () => {
        getEl('profileModal').classList.add('hidden');
        getEl('confirmModal').classList.remove('hidden');
    });
}

getEl('confirmYes').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('chatUser');
    window.location.href = '/login.html';
});
getEl('confirmNo').addEventListener('click', () => {
    getEl('confirmModal').classList.add('hidden');
    getEl('profileModal').classList.remove('hidden');
});

// Admin: Verificar Usuario (Optimista + Rollback)
const toggleVerifyBtn = getEl('toggleVerifyBtn');
if (toggleVerifyBtn) {
    toggleVerifyBtn.addEventListener('click', async () => {
        if (!currentTargetUserObj || !currentTargetUserId) return;

        const previousState = currentTargetUserObj.is_verified;
        
        // UI Update Optimista
        currentTargetUserObj.is_verified = !currentTargetUserObj.is_verified;
        toggleVerifyBtn.textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
        
        // Actualizar modales y header
        const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;
        const modalNameEl = getEl('contactInfoName');
        if (modalNameEl) modalNameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        updateChatHeaderInfo(currentTargetUserObj);

        // API Call
        try {
            const res = await apiRequest('/api/admin/toggle-verify', 'POST', { targetUserId: currentTargetUserObj.userId });
            if (!res || !res.success) throw new Error("Server Error");
        } catch (error) {
            // Rollback si falla
            currentTargetUserObj.is_verified = previousState;
            updateChatHeaderInfo(currentTargetUserObj);
            toggleVerifyBtn.textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
            alert("No se pudo actualizar la verificación.");
        }
    });
}