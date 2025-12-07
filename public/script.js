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
            window.location.href = '/login';
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
    if (window.location.pathname === '/login') return;
    const userData = await apiRequest('/api/me');
    if (userData) {
        loginSuccess(userData);
    } else {
        window.location.href = '/login';
    }
}

// --- CENTRALIZACIÓN DE ICONOS ---
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

// --- VARIABLES DE ESTADO ---
let currentTargetUserId = null, currentTargetUserObj = null;
let messageIdToDelete = null;
let deleteActionType = 'single';
let currentContextMessageId = null; // NUEVA VARIABLE PARA EL MENÚ CONTEXTUAL
let myNicknames = {}, allUsersCache = [];
let currentReplyId = null, mediaRecorder = null, audioChunks = [], recordingInterval = null;
let isRecording = false, shouldSendAudio = true;
let currentStickerTab = 'giphy', myFavorites = new Set();
let cropper = null, searchTimeout, currentStickerUrlInModal = null;
let currentChatType = 'private';

let isEditing = false;
let currentEditingId = null;
const editPreview = document.getElementById('editPreview');
const editPreviewText = document.getElementById('editPreviewText');
const closeEditBtn = document.getElementById('closeEditBtn');

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
const adminLoveNoteSection = document.getElementById('adminLoveNoteSection');
const adminLoveNoteInput = document.getElementById('adminLoveNoteInput');
const sendLoveNoteBtn = document.getElementById('sendLoveNoteBtn');


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

    checkPremiumFeatures();
    loadMyChannels();
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
let currentEditFile = null; // El archivo original seleccionado
let currentScaleX = 1;      // Para controlar el Flip

// --- 1. ABRIR EDITOR (Vista Previa) ---
chatImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    currentEditFile = file;
    const reader = new FileReader();

    reader.onload = (evt) => {
        // Resetear UI
        if (cropper) { cropper.destroy(); cropper = null; }
        getEl('imageEditorModal').classList.remove('hidden');

        // Mostrar elementos principales, ocultar recorte
        getEl('mainHeader').classList.remove('hidden');
        getEl('mainFooter').classList.remove('hidden');
        getEl('cropFooter').classList.add('hidden');

        // Cargar imagen
        imageToEdit.src = evt.target.result;
        imageCaptionInput.value = '';
        imageCaptionInput.focus();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

// --- 2. CERRAR EDITOR COMPLETAMENTE ---
getEl('closeEditorBtn').addEventListener('click', () => {
    getEl('imageEditorModal').classList.add('hidden');
    if (cropper) { cropper.destroy(); cropper = null; }
    currentEditFile = null;
});

// --- 3. ENTRAR A MODO RECORTE ---
getEl('enterCropModeBtn').addEventListener('click', () => {
    // Ocultar UI principal
    getEl('mainHeader').classList.add('hidden');
    getEl('mainFooter').classList.add('hidden');

    // Mostrar UI de recorte
    getEl('cropFooter').classList.remove('hidden');

    // Iniciar Cropper
    currentScaleX = 1; // Resetear flip
    cropper = new Cropper(imageToEdit, {
        viewMode: 1,
        dragMode: 'none',       // Imagen fija
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

// --- 4. ACCIONES DEL MODO RECORTE ---

// Botón ROTAR (Con tu lógica de girar todo)
getEl('rotateBtn').addEventListener('click', () => {
    if (!cropper) return;

    const container = document.querySelector('.cropper-container');
    container.classList.add('animating-rotation');

    const cropBoxData = cropper.getCropBoxData();
    const containerData = cropper.getContainerData();

    cropper.rotate(90); // Rotar

    // Invertir dimensiones del recuadro para que acompañe el giro
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

// Botón FLIP (Nuevo)
getEl('flipBtn').addEventListener('click', () => {
    if (!cropper) return;
    currentScaleX = -currentScaleX; // Invertir estado
    cropper.scaleX(currentScaleX);  // Aplicar flip horizontal
});

// Botón CANCELAR (Salir sin guardar cambios de recorte)
getEl('cancelCropBtn').addEventListener('click', () => {
    // Destruir cropper (esto visualmente resetea la imagen a como estaba antes de entrar)
    if (cropper) { cropper.destroy(); cropper = null; }

    // Volver a la UI Principal
    getEl('cropFooter').classList.add('hidden');
    getEl('mainHeader').classList.remove('hidden');
    getEl('mainFooter').classList.remove('hidden');
});

// Botón OK (Aplicar recorte y volver)
getEl('okCropBtn').addEventListener('click', () => {
    if (!cropper) return;

    // 1. Obtener la imagen recortada como DataURL (base64)
    const croppedCanvas = cropper.getCroppedCanvas({ maxWidth: 2048, maxHeight: 2048 });
    const croppedImageBase64 = croppedCanvas.toDataURL('image/jpeg', 0.9);

    // 2. Destruir cropper
    cropper.destroy();
    cropper = null;

    // 3. Reemplazar la imagen visible con la versión recortada
    imageToEdit.src = croppedImageBase64;

    // 4. Volver a la UI Principal
    getEl('cropFooter').classList.add('hidden');
    getEl('mainHeader').classList.remove('hidden');
    getEl('mainFooter').classList.remove('hidden');
});

// --- 5. ENVIAR IMAGEN FINAL ---
getEl('sendImageBtn').addEventListener('click', async () => {
    getEl('sendImageBtn').innerHTML = '...';

    // Convertir el src actual (que puede ser el original o el recortado) a Blob
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

    // 1. Verificamos si tengo abierto un chat
    // 2. Verificamos si el chat abierto es el mismo que se acaba de vaciar
    if (currentTargetUserId && parseInt(currentTargetUserId) === parseInt(chatId)) {

        // --- AQUÍ OCURRE LA MAGIA SIN RECARGAR ---
        const messagesList = document.getElementById('messages');

        // Efecto visual de desvanecimiento antes de borrar (Opcional, se ve pro)
        messagesList.style.opacity = '0';
        messagesList.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            // Borrar todo el HTML de la lista de mensajes
            messagesList.innerHTML = '';

            // Añadir mensaje de sistema
            const li = document.createElement('li');
            li.style.cssText = 'text-align:center; color:#666; margin:20px; font-size:12px; font-weight:500; list-style:none; opacity:0; animation: fadeIn 0.5s forwards;';
            li.textContent = 'El historial del chat ha sido vaciado.';
            messagesList.appendChild(li);

            // Restaurar opacidad
            messagesList.style.opacity = '1';

            // Ocultar botón de scroll si existía
            const scrollBtn = document.getElementById('scrollToBottomBtn');
            if (scrollBtn) scrollBtn.classList.add('hidden');

        }, 300); // Espera 300ms a que termine la transición
    }
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
        if (prefix) currentText = currentText.replace(prefix, '');
        currentText = currentText.replace('✎', '').trim();

        const originalContent = newEl.innerHTML;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'editing-input';

        if (dbField === 'bio') input.placeholder = "Escribe algo sobre ti...";

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
            if (dbField === 'bio' && !val) {
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

// Evento: ABRIR MI PERFIL
profileBtn.addEventListener('click', () => {
    if (fabNewChat) fabNewChat.classList.add('hidden');
    if (loveNotesBtn) loveNotesBtn.classList.add('hidden');
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

const togglePremiumBtn = getEl('togglePremiumBtn');
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
            adminLoveNoteInput.value = ''; // Limpiar
        } else {
            alert("Error al enviar.");
        }
    });
}

// --- LÓGICA PARA EL BOTÓN DE VERIFICADO DE CORAZÓN ---
if (togglePremiumBtn) {
    togglePremiumBtn.addEventListener('click', async () => {
        // Validación de seguridad
        if (!currentTargetUserObj || !currentTargetUserId) return;

        // 1. Guardar estado anterior por si falla
        const previousState = currentTargetUserObj.is_premium;

        // 2. ACTUALIZACIÓN OPTIMISTA (UI INMEDIATA)
        currentTargetUserObj.is_premium = !currentTargetUserObj.is_premium;

        // A. Actualizar texto del botón inmediatamente
        togglePremiumBtn.textContent = currentTargetUserObj.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";

        // B. Actualizar el nombre en el Modal (Info Contacto) para ver el icono nuevo
        const modalNameEl = document.getElementById('contactInfoName');
        const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.display_name || currentTargetUserObj.username;
        if (modalNameEl) {
            modalNameEl.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        }

        // C. Actualizar el Header del Chat
        updateChatHeaderInfo(currentTargetUserObj);

        // D. Actualizar la lista de usuarios (para que salga el icono en la barra lateral)
        const userListItem = document.querySelector(`.user-item[data-uid="${currentTargetUserObj.userId}"] div[style*="font-weight:600"]`);
        if (userListItem) {
            userListItem.innerHTML = escapeHtml(displayName) + getBadgeHtml(currentTargetUserObj);
        }

        // 3. Llamada a la API (Simulada o Real)
        try {
            // Nota: Asegúrate de tener esta ruta en tu servidor o usa la misma lógica que verify
            // Enviaremos una petición para cambiar el estado 'is_premium' en la base de datos
            const res = await apiRequest('/api/admin/toggle-premium', 'POST', {
                targetUserId: currentTargetUserObj.userId
            });

            if (!res || !res.success) {
                throw new Error("Error en servidor");
            }
        } catch (error) {
            console.error(error);
            // Revertir cambios si falló
            currentTargetUserObj.is_premium = previousState;
            updateChatHeaderInfo(currentTargetUserObj);
            togglePremiumBtn.textContent = currentTargetUserObj.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";
            alert("No se pudo actualizar el verificado de corazón.");
        }
    });
}

// Cerrar modales
getEl('closeContactInfo').addEventListener('click', () => getEl('contactInfoModal').classList.add('hidden'));
// Evento: CERRAR PERFIL
closeProfile.addEventListener('click', () => {
    if (fabNewChat) fabNewChat.classList.remove('hidden');
    profileModal.classList.add('hidden');

    // --- AGREGA ESTO ---
    if (loveNotesBtn && myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    }
    // -------------------
});

// Botón de menú Perfil
if (profileOptionsBtn) {
    profileOptionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileOptionsMenu.classList.toggle('hidden');
    });
}
document.addEventListener('click', (e) => {
    if (profileOptionsMenu && !profileOptionsMenu.contains(e.target) && !profileOptionsBtn.contains(e.target)) {
        profileOptionsMenu.classList.add('hidden');
    }
});

// Logout
const newLogoutBtn = getEl('profileLogout');
if (newLogoutBtn) {
    newLogoutBtn.replaceWith(newLogoutBtn.cloneNode(true));
    getEl('profileLogout').addEventListener('click', () => {
        profileModal.classList.add('hidden');
        getEl('confirmModal').classList.remove('hidden');
    });
}

getEl('confirmYes').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    localStorage.removeItem('chatUser');
    window.location.href = '/login';
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

// --- REPLY ---
function setReply(msgId, content, type, ownerId) {
    if (isEditing) {
        cancelEditing();
    }
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

    // 1. Si tengo abierto el chat/perfil de alguien, actualizar sus datos en tiempo real
    if (currentTargetUserId && !currentTargetUserObj?.isChannel) {
        const updated = users.find(u => u.userId === currentTargetUserId);
        if (updated) {
            currentTargetUserObj = updated;
            updateChatHeaderInfo(updated);

            // Actualizar botones de admin si es necesario
            if (myUser.is_admin) {
                const verifyBtn = document.getElementById('toggleVerifyBtn');
                if (verifyBtn) verifyBtn.textContent = updated.is_verified ? "Quitar Verificado" : "Verificar Usuario";

                const premBtn = document.getElementById('togglePremiumBtn');
                if (premBtn) premBtn.textContent = updated.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";
            }
        }
    }

    // 2. Revisar mis propios datos (ME)
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

    // --- CORRECCIÓN AQUÍ ---
    // En lugar de llamar a renderUserList, llamamos a la función mixta
    // para asegurarnos de que los canales no se borren.
    renderMixedSidebar();
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
    if (avatar && isValidUrl(avatar)) safeAvatar = avatar;
    const sbItem = document.querySelector(`.user-item[data-uid="${userId}"] .u-avatar`);
    if (sbItem) sbItem.style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;
    if (currentTargetUserId == userId) {
        currentTargetUserObj.avatar = avatar;
        currentChatAvatar.style.backgroundImage = `url('${escapeHtml(safeAvatar)}')`;
    }
    document.querySelectorAll(`.message.${myUser.id == userId ? 'me' : 'other'} .audio-avatar-img`).forEach(img => img.src = avatar || '/profile.png');
});

async function selectUser(target, elem) {
    if (fabNewChat) fabNewChat.classList.add('hidden');
    if (loveNotesBtn) loveNotesBtn.classList.add('hidden');
    // --- RESET UX ---
    lastMessageDate = null;
    lastMessageUserId = null;

    typingIndicator.classList.add('hidden');
    typingText.textContent = '';
    if (scrollToBottomBtn) scrollToBottomBtn.classList.add('hidden');

    currentTargetUserId = target.userId;
    currentTargetUserObj = target;

    currentChatType = target.chat_type || 'private';

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

    const savedDraft = localStorage.getItem(`draft_${target.userId}`) || '';
    inputMsg.value = savedDraft;

    // Ajustar altura del input automáticamente según el texto cargado
    inputMsg.style.height = 'auto';
    inputMsg.style.height = (inputMsg.scrollHeight > 45 ? inputMsg.scrollHeight : 45) + 'px';

    // Actualizar el botón (para que muestre "Enviar" si hay texto guardado)
    updateButtonState();

    // Reset inputs
    inputMsg.style.height = '45px';

    messagesList.innerHTML = '<li style="text-align:center;color:#666;font-size:12px;margin-top:20px;">Cargando historial...</li>';

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
            let fixedDate = msg.timestamp;
            if (typeof fixedDate === 'string' && fixedDate.includes(' ')) {
                fixedDate = fixedDate.replace(' ', 'T') + 'Z';
            }

            appendMessageUI(
                msg.content,
                msg.from_user_id === myUser.id ? 'me' : 'other',
                fixedDate,  // <--- Usamos la fecha corregida aquí
                msg.id,
                msg.type,
                rd,
                msg.is_deleted,
                msg.caption,
                msg.is_edited
            );
        });
        // Scroll inmediato al cargar
        scrollToBottom(false);

        // "Truco": Hacerlo de nuevo un poco después por si cargaron imágenes
        setTimeout(() => scrollToBottom(false), 200);

    } else {
        messagesList.innerHTML = '<li style="text-align:center;color:#ef4444;margin-top:20px;">Error cargando mensajes</li>';
    }
    checkAndLoadPinnedMessage(target.userId);
}
backBtn.addEventListener('click', () => {
    chatContainer.classList.remove('mobile-chat-active');

    // Quitar temas globales (Código existente)
    document.body.classList.remove('theme-love', 'theme-space');

    if (fabNewChat) fabNewChat.classList.remove('hidden');

    // --- AGREGA ESTO AQUÍ ---
    // Solo lo mostramos si el usuario es Premium
    if (loveNotesBtn && myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    }
});
async function checkAndLoadPinnedMessage(targetUserId) {
    // Primero: Ocultar barra por defecto para limpiar estado anterior
    hidePinnedBar();

    // A. Verificar "Fijado para mí" (LocalStorage)
    const localPinData = localStorage.getItem(`pinned_local_${myUser.id}_${targetUserId}`);
    if (localPinData) {
        try {
            const { messageId, content, type } = JSON.parse(localPinData);
            currentPinnedMessageId = messageId;
            showPinnedBar(content, type);
            return; // Si hay local, tiene prioridad visual (o puedes decidir lo contrario)
        } catch (e) {
            localStorage.removeItem(`pinned_local_${myUser.id}_${targetUserId}`);
        }
    }

    // B. Verificar "Fijado para todos" (Base de Datos)
    try {
        const res = await apiRequest(`/api/pinned-message/${targetUserId}`);
        if (res && res.found) {
            currentPinnedMessageId = res.messageId;
            showPinnedBar(res.content, res.type);
        }
    } catch (e) {
        console.error("Error cargando fijado:", e);
    }
}
// --- AUDIO Y CONTROLES ---
function updateButtonState() { mainActionBtn.innerHTML = isRecording ? ICONS.send : (inputMsg.value.trim().length > 0 ? ICONS.send : ICONS.mic); }
inputMsg.addEventListener('input', () => { updateButtonState(); if (currentTargetUserId) socket.emit('typing', { toUserId: currentTargetUserId }); });
mainActionBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isEditing) {
        const newText = inputMsg.value.trim();
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

    const text = inputMsg.value.trim();
    if (text.length > 0) {
        sendMessage(text, 'text', currentReplyId);

        // Limpiar input y UI
        inputMsg.value = '';
        inputMsg.style.height = '45px'; // Volver a altura original
        inputMsg.focus();
        clearReply();
        socket.emit('stop typing', { toUserId: currentTargetUserId });

        // --- NUEVO: BORRAR EL BORRADOR GUARDADO ---
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

// --- ENVÍO Y RECEPCIÓN ---
function sendMessage(content, type, replyId = null) {
    if (!currentTargetUserId) return;
    if ((type === 'image' || type === 'sticker') && !isValidUrl(content)) { return alert("Error de seguridad"); }
    socket.emit('private message', { content, toUserId: currentTargetUserId, type, replyToId: replyId }, (res) => {
        if (res?.id) {
            let rd = replyId ? { username: replyToName.textContent, content: replyToText.innerHTML, type: type } : null;
            appendMessageUI(content, 'me', new Date(), res.id, type, rd, 0, res.caption, 0);
            messagesList.scrollTop = messagesList.scrollHeight;
            scrollToBottom(true);
        }
    });
}

socket.on('private message', (msg) => {
    if (currentTargetUserId === msg.fromUserId) {

        // 1. DETECCIÓN EN EL CONTENEDOR PADRE
        const scrollContainer = messagesList.parentNode; // <--- CLAVE

        // Calculamos si el usuario está cerca del final (margen de 150px)
        const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;

        // 2. Preparar Reply Data (tu código original)
        let rd = null;
        if (msg.replyToId) {
            let rName = msg.reply_from_id === myUser.id ? "Tú" : (myNicknames[msg.reply_from_id] || allUsersCache.find(x => x.userId == msg.reply_from_id)?.username || "Usuario");
            let rText = msg.reply_content;
            if (msg.reply_type === 'image') rText = ICONS.replyImage;
            else if (msg.reply_type === 'sticker') rText = "✨ Sticker";
            else if (msg.reply_type === 'audio') rText = ICONS.replyAudio || "Mensaje de voz";
            rd = { username: rName, content: rText, type: msg.reply_type };
        }

        // 3. Renderizar
        appendMessageUI(msg.content, 'other', msg.timestamp, msg.id, msg.type || 'text', rd, 0, msg.caption, 0);

        // 4. Scroll condicional
        if (isAtBottom) {
            scrollToBottom(true);
        }
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

function appendMessageUI(content, ownerType, dateStr, msgId, msgType = 'text', replyData = null, isDeleted = 0, caption = null, isEdited = 0) {    // A. Renderizar fecha si es necesario
    renderDateDivider(dateStr);

    if (currentChatType === 'channel') {
        ownerType = 'other';
    }

    // B. Lógica de Agrupación Visual
    const currentUserId = ownerType === 'me' ? myUser.id : currentTargetUserId;
    const isSequence = lastMessageUserId === currentUserId; // ¿Es el mismo del anterior?

    const li = document.createElement('li');
    li.className = `message-row ${ownerType}`;
    if (msgType === 'sticker') li.classList.add('sticker-wrapper');
    li.id = `row-${msgId}`;


    let layoutClass = 'layout-col';

    if (msgType === 'text') {
        // Si el texto es corto, no tiene saltos de línea Y NO es una respuesta (reply)
        // Las respuestas suelen verse mejor en columna por el ancho del bloque citado
        if (content.length < 32 && !content.includes('\n') && !replyData) {
            layoutClass = 'layout-row';
        }
    }

    // Generar contenido del mensaje (Tu lógica original intacta)
    let bodyHtml = '';
    if (msgType === 'audio') {
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
        if (safeSrc) bodyHtml = `<div class="chat-image-container skeleton-wrapper image-skeleton"><img src="${safeSrc}" class="chat-image hidden-media" loading="lazy" onclick="viewFullImage(this.src)" onload="this.classList.remove('hidden-media');this.classList.add('visible-media');this.parentElement.classList.remove('image-skeleton','skeleton-wrapper');"></div>${captionHtml}`;
        else bodyHtml = `<div style="color:red; font-size:12px;">[Imagen inválida]</div>`;
    } else if (msgType === 'sticker') {
        const safeSrc = isValidUrl(content) ? escapeHtml(content) : '';
        if (safeSrc) bodyHtml = `<div class="skeleton-wrapper sticker-skeleton"><img src="${safeSrc}" class="sticker-img hidden-media" data-url="${safeSrc}" onload="this.classList.remove('hidden-media');this.classList.add('visible-media');this.parentElement.classList.remove('sticker-skeleton','skeleton-wrapper');"></div>`;
        else bodyHtml = `<div style="color:red; font-size:12px;">[Sticker inválido]</div>`;
    } else {
        bodyHtml = `<span>${escapeHtml(content)}</span>`;
    }

    li.dataset.timestamp = new Date(dateStr).getTime();
    const editedHtml = isEdited ? '<span class="edited-label">editado</span>' : '';
    const meta = msgType !== 'audio' ? `<div class="meta-row">${editedHtml}<span class="meta">${new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>` : '';

    const isStickerWithReply = (msgType === 'sticker' && replyData !== null);

    // 2. Definir la clase extra
    const stickerBubbleClass = isStickerWithReply ? 'sticker-reply-bubble' : '';

    const safeReplyName = replyData ? escapeHtml(replyData.username) : '';
    const safeReplyText = replyData ? (replyData.type === 'text' || !replyData.type ? escapeHtml(replyData.content) : replyData.content) : '';
    const quoteHtml = replyData ? `<div class="quoted-message"><div class="quoted-name">${safeReplyName}</div><div class="quoted-text">${safeReplyText}</div></div>` : '';
    const deletedLabel = isDeleted ? `<div style="color:#ef4444;font-size:10px;font-weight:bold;margin-bottom:4px;">🚫 ELIMINADO</div>` : '';

    // Meta (Hora



    li.innerHTML = `
        <div class="swipe-reply-icon"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></div>
        
        <div class="message-content-wrapper message ${ownerType} ${isDeleted ? 'deleted-msg' : ''} ${msgType === 'image' ? 'msg-image-wrapper' : ''} ${stickerBubbleClass} ${layoutClass}" id="msg-${msgId}" ${isDeleted ? 'style="border:1px dashed #ef4444;opacity:0.7"' : ''}>
            ${deletedLabel}${quoteHtml}${bodyHtml}${meta}
        </div>`;

    messagesList.appendChild(li);


    // C. Ajuste de Bordes (Grouping)
    if (isSequence) {
        // Obtenemos el mensaje anterior (que ahora es el penúltimo hijo)
        // Nota: date-divider es un LI, así que nos aseguramos de no agrupar a través de una fecha
        const prevLi = li.previousElementSibling;

        if (prevLi && prevLi.classList.contains('message-row') && !prevLi.classList.contains('date-divider')) {
            // Modificamos el anterior (ahora es "top" o "middle")
            prevLi.classList.remove('seq-bottom'); // Por si era bottom
            if (prevLi.classList.contains('seq-top')) {
                prevLi.classList.add('seq-middle');
                prevLi.classList.remove('seq-top');
            } else {
                prevLi.classList.add('seq-top');
            }

            // El actual es "bottom" por defecto al ser el último
            li.classList.add('seq-bottom');
        }
    }

    // Actualizamos el rastreador
    lastMessageUserId = currentUserId;

    // Listeners
    if (msgType === 'sticker' && isValidUrl(content)) {
        li.querySelector('.sticker-img').addEventListener('click', (e) => { e.stopPropagation(); myFavorites.size ? openStickerOptions(content) : refreshFavoritesCache().then(() => openStickerOptions(content)); });
    }
    const wrapper = li.querySelector('.message-content-wrapper');

    // CORRECCIÓN: Agregamos el evento a TODOS los mensajes, no solo a los míos
    addLongPressEvent(wrapper, msgId);

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
        if (diff > 0 && diff < 200) { currentX = diff; wrap.style.transform = `translateX(${diff}px)`; const p = Math.min(diff / 70, 1); icon.style.opacity = p; icon.style.transform = `translateY(-50%) scale(${0.5 + p * 0.5})`; icon.style.left = '10px'; }
    }, { passive: true });
    const end = () => { if (!isSwiping) return; isSwiping = false; wrap.style.transition = 'transform 0.2s ease'; icon.style.transition = 'all 0.2s'; if (currentX >= 70) { if (navigator.vibrate) navigator.vibrate(30); setReply(msgId, content, type, ownerId); } wrap.style.transform = 'translateX(0)'; icon.style.opacity = '0'; };
    wrap.addEventListener('touchend', end); wrap.addEventListener('touchcancel', end);
}
function addLongPressEvent(el, msgId) {
    let timer;

    const start = (e) => {
        // Si el mensaje se está deslizando (swipe), no iniciar long press
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

    // 1. Eventos que NO requieren passive explícito o no son de scroll
    ['mouseup', 'mouseleave', 'touchend'].forEach(ev => el.addEventListener(ev, cancel));

    // 2. SOLUCIÓN: Agregar touchmove explícitamente como 'passive: true'
    el.addEventListener('touchmove', cancel, { passive: true });

    el.addEventListener('touchstart', start, { passive: true });
}

// ==========================================
// MENÚ CONTEXTUAL MEJORADO (COPIAR, EDITAR, BORRAR)
// ==========================================

// Función global para cerrar el menú y limpiar estados
window.closeContextMenu = () => {
    msgContextMenu.classList.add('hidden');
    currentContextMessageId = null;
    messageIdToDelete = null;
};

// Función para abrir el menú
function openContextMenu(x, y, msgId) {
    currentContextMessageId = msgId;
    messageIdToDelete = msgId;

    const menu = msgContextMenu.querySelector('.context-menu-content');
    msgContextMenu.classList.remove('hidden');

    // 1. OBTENER ELEMENTOS
    const msgEl = document.getElementById(`row-${msgId}`);
    const msgDiv = document.getElementById(`msg-${msgId}`);

    // 2. DEFINIR VARIABLES CLAVE
    const isMyMessage = msgDiv ? msgDiv.classList.contains('me') : false;

    // --- NUEVO: Detectar si está eliminado ---
    // Verificamos si tiene la clase visual de eliminado o el texto interno
    const isDeleted = msgDiv ? (msgDiv.classList.contains('deleted-msg') || msgDiv.querySelector('.deleted-label') !== null) : false;
    // ----------------------------------------

    const isAdmin = myUser && myUser.is_admin;

    // --- LÓGICA BOTÓN EDITAR (24 HORAS + NO ELIMINADO) ---
    const btnEdit = document.getElementById('ctxEditBtn');
    if (btnEdit) {
        if (msgEl && isMyMessage && !isDeleted) { // <--- AGREGAMOS !isDeleted AQUÍ
            // Obtener fecha guardada en el dataset
            const msgTime = parseInt(msgEl.dataset.timestamp || 0);
            const now = Date.now();

            // Calcular diferencia en horas
            const hoursDiff = (now - msgTime) / (1000 * 60 * 60);

            // Mostrar SOLO si es mío, tiene menos de 24h Y NO ESTÁ ELIMINADO
            if (hoursDiff < 24) {
                btnEdit.style.display = 'flex';
            } else {
                btnEdit.style.display = 'none';
            }
        } else {
            // Si no es mío o está borrado, ocultar editar
            btnEdit.style.display = 'none';
        }
    }

    // --- LÓGICA BOTÓN ELIMINAR PARA TODOS ---
    const btnEveryone = document.getElementById('btnDeleteEveryone');
    if (btnEveryone) {
        if (isMyMessage || isAdmin) {
            btnEveryone.style.display = 'flex';
        } else {
            btnEveryone.style.display = 'none';
        }
    }

    // --- POSICIONAMIENTO DEL MENÚ ---
    let top = y;
    let left = x;

    if (y > window.innerHeight - 250) top = y - 200;
    if (x > window.innerWidth - 220) left = window.innerWidth - 230;

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
}

// 1. LISTENERS DEL MENÚ CONTEXTUAL

// Responder
getEl('ctxReplyBtn').addEventListener('click', () => {
    const msgEl = document.getElementById(`msg-${currentContextMessageId}`);
    if (msgEl) {
        // Intentar obtener contenido (texto o imagen)
        let content = msgEl.innerText;
        let type = 'text';

        // Si tiene imagen
        if (msgEl.querySelector('.chat-image')) {
            content = msgEl.querySelector('.chat-image').src;
            type = 'image';
        } else if (msgEl.querySelector('.sticker-img')) {
            content = msgEl.querySelector('.sticker-img').src;
            type = 'sticker';
        }

        // Usamos 'unknown' como ID temporal, o currentTargetUserId si es el otro
        // Nota: Idealmente deberíamos guardar el authorId en el elemento HTML
        setReply(currentContextMessageId, content, type, 'unknown');
    }
    closeContextMenu();
});

// Copiar
// 2. Copiar
getEl('ctxCopyBtn').addEventListener('click', async () => {
    if (!currentContextMessageId) return;

    const msgEl = document.getElementById(`msg-${currentContextMessageId}`);
    if (msgEl) {
        let textToCopy = "";

        // Clonamos para limpiar el HTML sin romper la vista
        const clone = msgEl.cloneNode(true);

        // Quitamos elementos que no son el mensaje (hora, respuestas, etc)
        const unwanted = clone.querySelectorAll('.meta-row, .quoted-message, .deleted-label, .audio-meta-row');
        unwanted.forEach(el => el.remove());

        textToCopy = clone.innerText.trim();

        try {
            await navigator.clipboard.writeText(textToCopy);

            // --- AQUÍ LLAMAMOS A LA NOTIFICACIÓN ---
            showToast("Mensaje copiado");
            // ---------------------------------------

        } catch (err) {
            console.error('Error al copiar:', err);
            showToast("Error al copiar");
        }
    }
    closeContextMenu();
});

// Editar (Visual por ahora)
// Eliminar (Abre el Modal)
// Listener del botón ELIMINAR en el menú contextual
getEl('ctxDeleteBtn').addEventListener('click', () => {
    const idToSave = currentContextMessageId;
    closeContextMenu();

    // Configurar contexto mensaje individual
    messageIdToDelete = idToSave;
    deleteActionType = 'single';

    // Restaurar textos originales
    document.querySelector('#deleteConfirmModal h3').textContent = "¿Eliminar mensaje?";
    document.querySelector('#deleteConfirmModal p').textContent = "Elige cómo quieres borrar este mensaje.";

    getEl('deleteConfirmModal').classList.remove('hidden');
});
// ==========================================
// LÓGICA DE BORRADO (MODAL MEJORADO)
// ==========================================

// Función helper para cerrar modal de borrado
window.closeDeleteModal = () => {
    getEl('deleteConfirmModal').classList.add('hidden');
};

// Función visual para quitar mensaje de la UI suavemente
function removeMessageFromUI(msgId) {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
        const row = el.closest('.message-row');
        row.style.transition = "all 0.3s ease";
        row.style.opacity = "0";
        row.style.transform = "scale(0.9)";
        setTimeout(() => row.remove(), 300);
    }
}

// 1. Eliminar PARA TODOS
getEl('btnDeleteEveryone').addEventListener('click', () => {
    if (!currentTargetUserId) return closeDeleteModal();

    if (deleteActionType === 'single' && messageIdToDelete) {
        // CASO 1: Mensaje Individual
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

        // Limpiar UI

        // Si la acción era "Eliminar Chat y Salir"
        if (deleteActionType === 'delete_chat') {
            performExitChat();
        }
    }
    closeDeleteModal();
});

// --- ACCIÓN: ELIMINAR PARA MÍ ---
getEl('btnDeleteMe').addEventListener('click', () => {
    if (!currentTargetUserId) return closeDeleteModal();

    if (deleteActionType === 'single' && messageIdToDelete) {
        // CASO 1: Mensaje Individual
        socket.emit('delete message', {
            messageId: messageIdToDelete,
            toUserId: currentTargetUserId,
            deleteType: 'me'
        });
        removeMessageFromUI(messageIdToDelete);

    } else if (deleteActionType === 'clear' || deleteActionType === 'delete_chat') {
        // CASO 2: Vaciar Chat Completo (Solo para mí)
        socket.emit('clear chat history', {
            toUserId: currentTargetUserId,
            deleteType: 'me'
        });

        // Limpiar UI
        document.getElementById('messages').innerHTML = '';

        // Si la acción era "Eliminar Chat y Salir"
        if (deleteActionType === 'delete_chat') {
            performExitChat();
        }
    }
    closeDeleteModal();
});

// Función auxiliar para salir del chat (UI)
function performExitChat() {
    // Eliminar de la lista lateral visualmente
    const userItem = document.querySelector(`.user-item[data-uid="${currentTargetUserId}"]`);
    if (userItem) userItem.remove();

    // Salir a pantalla vacía
    document.querySelector('.chat-container').classList.remove('mobile-chat-active');
    document.querySelector('.chat-header').classList.add('hidden');
    document.querySelector('.messages').classList.add('hidden');
    document.querySelector('.composer').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');

    if (fabNewChat) fabNewChat.classList.remove('hidden');

    // 4. Restaurar botón Love Notes si corresponde
    if (loveNotesBtn && myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    }

    // Resetear usuario actual
    currentTargetUserId = null;
    currentTargetUserObj = null;
}


socket.on('typing', ({ fromUserId, username }) => {
    // Solo mostrar si el que escribe es el usuario del chat abierto actualmente
    if (fromUserId === currentTargetUserId) {

        // Lógica según el tipo de chat
        if (currentChatType === 'private') {
            // Chat privado: Solo "Escribiendo..." (Sin nombre)
            typingText.textContent = "Escribiendo...";
        } else if (currentChatType === 'group') {
            // Grupo: "Juan está escribiendo..." (Con nombre)
            const name = escapeHtml(myNicknames[fromUserId] || username);
            typingText.textContent = `${name} está escribiendo...`;
        } else if (currentChatType === 'channel') {
            // Canal: Generalmente no se muestra nada, o solo "Escribiendo..."
            typingText.textContent = "Escribiendo...";
        } else {
            // Fallback por defecto
            typingText.textContent = "Escribiendo...";
        }

        typingIndicator.classList.remove('hidden');
    }
});
socket.on('stop typing', ({ fromUserId }) => { if (fromUserId === currentTargetUserId) typingIndicator.classList.add('hidden'); });
inputMsg.addEventListener('input', () => {
    // Ajustar altura del textarea (tu código actual)
    inputMsg.style.height = 'auto';
    inputMsg.style.height = inputMsg.scrollHeight + 'px';
    const isScroll = inputMsg.scrollHeight >= 120;
    inputMsg.classList.toggle('scroll-active', isScroll);
    inputMsg.style.overflowY = isScroll ? 'auto' : 'hidden';

    // Actualizar botón (Micrófono vs Enviar)
    updateButtonState();

    // Socket typing (tu código actual)
    if (currentTargetUserId) {
        socket.emit('typing', { toUserId: currentTargetUserId });

        // --- NUEVO: GUARDAR BORRADOR EN LOCALSTORAGE ---
        // Guardamos usando el ID del usuario como clave
        localStorage.setItem(`draft_${currentTargetUserId}`, inputMsg.value);
    }
});
inputMsg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (inputMsg.value.trim().length) mainActionBtn.click(); } });

// Login/PWA
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
    loginForm.addEventListener('submit', async (e) => { e.preventDefault(); const username = document.getElementById('loginUser').value; const password = document.getElementById('loginPass').value; try { const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const data = await res.json(); if (res.ok) { localStorage.setItem('chatUser', JSON.stringify(data.user)); window.location.href = '/'; } else { authError.textContent = data.error; } } catch (e) { authError.textContent = "Error de conexión"; } });
    registerForm.addEventListener('submit', async (e) => { e.preventDefault(); const username = document.getElementById('regUser').value; const password = document.getElementById('regPass').value; try { const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); if (res.ok) { alert('Registrado con éxito.'); tabLogin.click(); } else { const data = await res.json(); authError.textContent = data.error; } } catch (e) { authError.textContent = "Error"; } });
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (installBtn) installBtn.classList.remove('hidden'); });
if (installBtn) { installBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; installBtn.classList.add('hidden'); } }); }
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

let lastMessageDate = null;   // Para rastrear el cambio de día
let lastMessageUserId = null; // Para agrupar mensajes del mismo usuario

// ==========================================
// 1. FUNCIÓN HELPER: Scroll Inteligente
// ==========================================
function scrollToBottom(smooth = true) {
    // Identificamos el contenedor que realmente tiene el scroll (el padre de la lista)
    const scrollContainer = messagesList.parentNode;

    // Usamos setTimeout para dar tiempo al navegador a pintar el nuevo mensaje
    setTimeout(() => {
        if (smooth) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            // Scroll forzado e instantáneo
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }, 50);
}

// ==========================================
// 2. FUNCIÓN HELPER: Divisor de Fechas
// ==========================================
function renderDateDivider(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label = date.toLocaleDateString();

    // Lógica para "Hoy" y "Ayer"
    if (date.toDateString() === today.toDateString()) label = "Hoy";
    else if (date.toDateString() === yesterday.toDateString()) label = "Ayer";

    // Si la fecha cambió respecto al mensaje anterior, insertar píldora
    if (lastMessageDate !== label) {
        const li = document.createElement('li');
        li.className = 'date-divider';
        li.innerHTML = `<span>${label}</span>`;
        messagesList.appendChild(li);

        lastMessageDate = label;
        lastMessageUserId = null; // Reseteamos la agrupación al cambiar de día
    }
}
// ==========================================
// LÓGICA DEL BOTÓN "IR ABAJO"
// ==========================================
const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
// El contenedor que hace scroll es el padre de la lista de mensajes (chat-main)
const chatScrollContainer = document.querySelector('.chat-main');

if (scrollToBottomBtn && chatScrollContainer) {

    // 1. Detectar scroll
    chatScrollContainer.addEventListener('scroll', () => {
        // Distancia desde el fondo = Altura Total - Scroll Actual - Altura Visible
        const distanceToBottom = chatScrollContainer.scrollHeight - chatScrollContainer.scrollTop - chatScrollContainer.clientHeight;

        // Si el usuario sube más de 300px, mostramos el botón
        if (distanceToBottom > 300) {
            scrollToBottomBtn.classList.remove('hidden');
        } else {
            scrollToBottomBtn.classList.add('hidden');
        }
    });

    // 2. Click para bajar
    scrollToBottomBtn.addEventListener('click', () => {
        chatScrollContainer.scrollTo({
            top: chatScrollContainer.scrollHeight,
            behavior: 'smooth'
        });
    });
}
// --- FUNCIÓN PARA MOSTRAR NOTIFICACIONES ---
function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Crear el elemento
    const toast = document.createElement('div');
    toast.className = 'toast';

    // Icono de check + Texto
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${message}</span>
    `;

    // Agregar al contenedor
    container.appendChild(toast);

    // Eliminar después de 3 segundos
    setTimeout(() => {
        toast.classList.add('hiding'); // Activar animación de salida CSS
        setTimeout(() => {
            toast.remove(); // Eliminar del DOM
        }, 300); // Esperar a que termine la animación
    }, 3000);
}
/* =========================================================
   LÓGICA DEL MENÚ DE CHAT (BÚSQUEDA, FONDO, VACIAR)
   ========================================================= */

const chatMenuBtn = document.getElementById('chatMenuBtn');
const chatOptionsMenu = document.getElementById('chatOptionsMenu');
const chatSearchBar = document.getElementById('chatSearchBar');
const chatSearchInput = document.getElementById('chatSearchInput');
const closeChatSearch = document.getElementById('closeChatSearch');
const searchCount = document.getElementById('searchCount');
const wallpaperInput = document.getElementById('wallpaperInput');

// 1. TOGGLE MENÚ
if (chatMenuBtn) {
    chatMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chatOptionsMenu.classList.toggle('hidden');
    });
}

// Cerrar menú al hacer click fuera
document.addEventListener('click', (e) => {
    if (chatOptionsMenu && !chatOptionsMenu.classList.contains('hidden')) {
        if (!chatOptionsMenu.contains(e.target) && !chatMenuBtn.contains(e.target)) {
            chatOptionsMenu.classList.add('hidden');
        }
    }
});

// 2. OPCIÓN: BUSCAR
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

// Lógica de búsqueda en tiempo real (Cliente)
// --- VARIABLES DE BÚSQUEDA GLOBAL ---
let searchMatches = [];     // Almacena los elementos <span> de las coincidencias
let searchCurrentIndex = -1; // Índice actual (-1 significa ninguno seleccionado)

// Elementos DOM
const searchUpBtn = document.getElementById('searchUpBtn');
const searchDownBtn = document.getElementById('searchDownBtn');

// 1. INPUT DE BÚSQUEDA
chatSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();

    // Limpiar estado anterior
    clearSearchHighlights();
    searchMatches = [];
    searchCurrentIndex = -1;

    if (term.length < 2) {
        searchCount.textContent = "";
        toggleSearchNav(false);
        return;
    }

    // Buscar en todos los mensajes de texto
    const messages = document.querySelectorAll('.message-content-wrapper span'); // Asegúrate que apunta al texto

    messages.forEach(span => {
        // Obviamos metadatos, horas, etc.
        if (span.closest('.meta-row') || span.classList.contains('meta')) return;

        const text = span.textContent;
        if (text.toLowerCase().includes(term)) {
            // Regex para preservar mayúsculas/minúsculas visuales
            const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

            // Reemplazar texto por HTML con spans
            span.innerHTML = text.replace(regex, '<span class="highlight-text">$1</span>');
        }
    });

    // Recolectar todos los spans creados
    searchMatches = Array.from(document.querySelectorAll('.highlight-text'));

    if (searchMatches.length > 0) {
        toggleSearchNav(true);
        // Seleccionar el último mensaje por defecto (el más reciente suele estar abajo)
        // O el primero si prefieres buscar desde arriba. Vamos al último para ver lo reciente:
        searchCurrentIndex = searchMatches.length - 1;
        updateSearchUI();
    } else {
        searchCount.textContent = "0 res.";
        toggleSearchNav(false);
    }
});

// 2. FUNCIONES DE NAVEGACIÓN
searchUpBtn.addEventListener('click', () => navigateSearch(-1));   // Ir hacia atrás (arriba)
searchDownBtn.addEventListener('click', () => navigateSearch(1));  // Ir hacia adelante (abajo)

function navigateSearch(direction) {
    if (searchMatches.length === 0) return;

    searchCurrentIndex += direction;

    // Loop infinito (Carrusel)
    if (searchCurrentIndex < 0) searchCurrentIndex = searchMatches.length - 1;
    if (searchCurrentIndex >= searchMatches.length) searchCurrentIndex = 0;

    updateSearchUI();
}

function updateSearchUI() {
    // 1. Actualizar contador "1 de 5"
    // Sumamos 1 al índice porque los humanos cuentan desde 1
    searchCount.textContent = `${searchCurrentIndex + 1} de ${searchMatches.length}`;

    // 2. Quitar clase activa de todos
    searchMatches.forEach(m => m.classList.remove('active-match'));
    document.querySelectorAll('.message-flash').forEach(m => m.classList.remove('message-flash'));

    // 3. Resaltar el actual
    const currentEl = searchMatches[searchCurrentIndex];
    if (currentEl) {
        currentEl.classList.add('active-match');

        // 4. Obtener la burbuja del mensaje padre para hacer el efecto FLASH
        const messageBubble = currentEl.closest('.message-content-wrapper'); // O '.message' según tu HTML
        if (messageBubble) {
            // Removemos y agregamos la clase para reiniciar la animación si ya estaba
            messageBubble.classList.remove('message-flash');
            void messageBubble.offsetWidth; // Trigger reflow
            messageBubble.classList.add('message-flash');

            // 5. Scroll suave hacia el mensaje
            messageBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function toggleSearchNav(show) {
    // Habilitar/Deshabilitar botones si hay resultados
    searchUpBtn.disabled = !show;
    searchDownBtn.disabled = !show;
    searchUpBtn.style.opacity = show ? 1 : 0.5;
    searchDownBtn.style.opacity = show ? 1 : 0.5;
}

// 3. LIMPIEZA
function clearSearchHighlights() {
    document.querySelectorAll('.highlight-text').forEach(mark => {
        const parent = mark.parentNode;

        // --- ✅ AGREGA ESTA VERIFICACIÓN ---
        if (parent) {
            parent.textContent = parent.textContent; // Eliminar HTML tags (spans) y dejar texto plano
            parent.normalize(); // Unir nodos de texto fragmentados
        }
    });

    // Limpiar clases de flash
    document.querySelectorAll('.message-flash').forEach(m => m.classList.remove('message-flash'));
}

// Actualizar el botón de cerrar búsqueda existente para limpiar también
closeChatSearch.addEventListener('click', () => {
    chatSearchBar.classList.add('hidden');
    chatSearchInput.value = '';
    clearSearchHighlights();
});

// 3. OPCIÓN: CAMBIAR FONDO
/* ==========================================
   LÓGICA DE TEMAS Y FONDOS
   ========================================== */

const themeModal = document.getElementById('themeModal');
// 'wallpaperInput' is declared earlier in the file; do not redeclare it here to avoid a duplicate const error.

// 1. ABRIR EL MODAL AL DAR CLICK EN "CAMBIAR FONDO"
document.getElementById('optWallpaper').addEventListener('click', () => {
    chatOptionsMenu.classList.add('hidden'); // Cerrar menú de 3 puntos
    themeModal.classList.remove('hidden');   // Abrir modal de temas
});

// 2. CERRAR MODAL
document.getElementById('closeThemeBtn').addEventListener('click', () => {
    themeModal.classList.add('hidden');
});
// Cerrar si tocas fuera
themeModal.addEventListener('click', (e) => {
    if (e.target === themeModal) themeModal.classList.add('hidden');
});

// 3. SELECCIONAR UN TEMA PREDEFINIDO
window.selectTheme = function (themeName) {
    if (!currentTargetUserId) return;

    // Guardar preferencia: { type: 'preset', value: 'love' }
    const config = { type: 'preset', value: themeName };
    localStorage.setItem(`theme_config_${currentTargetUserId}`, JSON.stringify(config));

    // Aplicar inmediatamente
    applyThemeConfig(config);

    // Feedback visual en el modal
    updateActiveThemeUI(themeName);

    // (Opcional) Cerrar modal automáticamente
    // themeModal.classList.add('hidden');
};

// 4. ELEGIR DESDE GALERÍA
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
            // Guardar preferencia: { type: 'image', value: BASE64_STRING }
            const config = { type: 'image', value: base64 };
            localStorage.setItem(`theme_config_${currentTargetUserId}`, JSON.stringify(config));

            applyThemeConfig(config);
            themeModal.classList.add('hidden'); // Cerrar modal tras elegir foto
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

// 5. FUNCIÓN CENTRAL PARA APLICAR EL TEMA
function applyThemeConfig(config) {
    const mainColumn = document.querySelector('.main-column');
    const chatMain = document.querySelector('.chat-main');
    const body = document.body; // <--- Referencia al body

    // 1. LIMPIEZA: Quitar clases de temas anteriores del Body y MainColumn
    mainColumn.classList.remove('theme-love', 'theme-space');
    body.classList.remove('theme-love', 'theme-space'); // <--- Limpiar body

    // Resetear imagen de fondo inline
    chatMain.style.backgroundImage = '';

    if (!config) return;

    if (config.type === 'image') {
        // Fondo de imagen (Solo afecta al área de chat, no al body completo usualmente)
        chatMain.style.backgroundImage = `url('${config.value}')`;
        chatMain.style.backgroundSize = 'cover';
        chatMain.style.backgroundPosition = 'center';
    }
    else if (config.type === 'preset') {
        if (config.value === 'love') {
            mainColumn.classList.add('theme-love');
            body.classList.add('theme-love'); // <--- Aplicar al body
        } else if (config.value === 'space') {
            mainColumn.classList.add('theme-space');
            body.classList.add('theme-space'); // <--- Aplicar al body
        }
    }
}

// Helper para resaltar la opción seleccionada en el modal
function updateActiveThemeUI(activeTheme) {
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
    // Lógica simple para encontrar cuál activar (puedes mejorarla con IDs)
    if (activeTheme === 'love') document.querySelector('.theme-option:nth-child(2)').classList.add('active');
    else if (activeTheme === 'space') document.querySelector('.theme-option:nth-child(3)').classList.add('active');
    else document.querySelector('.theme-option:nth-child(1)').classList.add('active');
}

// 6. MODIFICAR selectUser PARA CARGAR EL TEMA AL ENTRAR AL CHAT
// (Reemplaza o busca tu función selectUser existente y añade esto al final)

const originalSelectUserFn = selectUser; // Guardamos la referencia anterior si la hubiera
selectUser = async function (target, elem) {
    // Llamar a la lógica original de carga de mensajes
    await originalSelectUserFn(target, elem);

    // --- NUEVO: Cargar Tema ---
    const savedConfig = localStorage.getItem(`theme_config_${target.userId}`);
    if (savedConfig) {
        try {
            applyThemeConfig(JSON.parse(savedConfig));
        } catch (e) {
            applyThemeConfig(null); // Fallback si falla JSON
        }
    } else {
        // Si no hay config, revisamos si había un fondo antiguo (compatibilidad)
        const oldBg = localStorage.getItem(`bg_${target.userId}`);
        if (oldBg) {
            applyThemeConfig({ type: 'image', value: oldBg });
        } else {
            applyThemeConfig(null); // Default
        }
    }
};

// --- MODIFICACIÓN: OPCIÓN VACIAR CHAT (Abriendo modal) ---
document.getElementById('optClearChat').addEventListener('click', () => {
    chatOptionsMenu.classList.add('hidden');

    // 1. Configurar contexto
    deleteActionType = 'clear';
    messageIdToDelete = null; // No aplica ID específico

    // 2. Cambiar textos del modal dinámicamente
    document.querySelector('#deleteConfirmModal h3').textContent = "¿Vaciar chat?";
    document.querySelector('#deleteConfirmModal p').textContent = "Los mensajes se borrarán permanentemente.";

    // 3. Abrir modal
    document.getElementById('deleteConfirmModal').classList.remove('hidden');
});

// --- MODIFICACIÓN: OPCIÓN ELIMINAR CHAT (Abriendo modal) ---
document.getElementById('optDeleteChat').addEventListener('click', () => {
    chatOptionsMenu.classList.add('hidden');

    // 1. Configurar contexto
    deleteActionType = 'delete_chat';
    messageIdToDelete = null;

    // 2. Cambiar textos del modal dinámicamente
    document.querySelector('#deleteConfirmModal h3').textContent = "¿Eliminar chat?";
    document.querySelector('#deleteConfirmModal p').textContent = "¿Borrar chat y salir? Esta acción no se puede deshacer.";

    // 3. Abrir modal
    document.getElementById('deleteConfirmModal').classList.remove('hidden');
});
let messageIdToPin = null;
let currentPinnedMessageId = null; // ID del mensaje actualmente fijado

// 1. ABRIR EL MODAL DESDE EL MENÚ CONTEXTUAL
// (Asegúrate de tener el botón <button id="ctxPinBtn">Fijar</button> en tu HTML del menú contextual)
const ctxPinBtn = document.getElementById('ctxPinBtn');
if (ctxPinBtn) {
    ctxPinBtn.addEventListener('click', () => {
        // Guardamos el ID del mensaje seleccionado
        messageIdToPin = currentContextMessageId;
        closeContextMenu(); // Cerrar menú de 3 puntos/contextual

        // Abrir modal de confirmación
        document.getElementById('pinConfirmModal').classList.remove('hidden');
    });
}

// 2. CERRAR MODAL
window.closePinModal = () => {
    document.getElementById('pinConfirmModal').classList.add('hidden');
    messageIdToPin = null;
};

// 3. ACCIÓN: FIJAR PARA TODOS
document.getElementById('btnPinEveryone').addEventListener('click', () => {
    if (!messageIdToPin || !currentTargetUserId) return;

    // Emitir al servidor
    socket.emit('pin message', {
        messageId: messageIdToPin,
        toUserId: currentTargetUserId,
        type: 'everyone'
    });

    closePinModal();
});

// 4. ACCIÓN: FIJAR PARA MÍ (Local)
document.getElementById('btnPinMe').addEventListener('click', () => {
    if (!messageIdToPin || !currentTargetUserId) return;

    // Obtener datos del DOM para guardar texto limpio
    const msgEl = document.getElementById(`msg-${messageIdToPin}`);
    if (msgEl) {
        // Clonar y limpiar para obtener texto sin hora
        const clone = msgEl.cloneNode(true);
        const garbage = clone.querySelectorAll('.meta, .meta-row, .quoted-message, .deleted-label, .audio-meta-row, .swipe-reply-icon');
        garbage.forEach(el => el.remove());

        let type = 'text';
        if (clone.querySelector('.chat-image')) type = 'image';
        else if (clone.querySelector('.sticker-img')) type = 'sticker';
        else if (clone.querySelector('audio')) type = 'audio';

        let text = clone.innerText.trim();
        if (!text && type !== 'text') text = "";

        // GUARDAR EN LOCALSTORAGE
        const pinData = { messageId: messageIdToPin, content: text, type: type };
        localStorage.setItem(`pinned_local_${myUser.id}_${currentTargetUserId}`, JSON.stringify(pinData));

        // Actualizar UI
        currentPinnedMessageId = messageIdToPin;
        showPinnedBar(text, type);
    }
    closePinModal();
});

// Acción: Desfijar (Limpiar LocalStorage y Servidor)
document.getElementById('unpinBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentTargetUserId) return;

    // 1. Intentar borrar local
    localStorage.removeItem(`pinned_local_${myUser.id}_${currentTargetUserId}`);

    // 2. Intentar borrar servidor (Para todos)
    socket.emit('pin message', {
        messageId: null,
        toUserId: currentTargetUserId,
        type: 'everyone'
    });

    hidePinnedBar();
});

// 6. CLIC EN LA BARRA -> IR AL MENSAJE
document.getElementById('pinnedBarContent').addEventListener('click', () => {
    if (!currentPinnedMessageId) return;

    const msgEl = document.getElementById(`msg-${currentPinnedMessageId}`);
    if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Efecto visual de resaltado
        msgEl.style.transition = 'background 0.5s';
        const originalBg = msgEl.style.background;
        msgEl.style.background = 'rgba(99, 102, 241, 0.3)'; // Resaltado azulado
        setTimeout(() => { msgEl.style.background = originalBg; }, 1000);
    } else {
        showToast("El mensaje fijado es antiguo y no está cargado.");
    }
});

// 7. ESCUCHAR EVENTO DE SOCKET (ACTUALIZAR BARRA)
socket.on('chat pinned update', ({ messageId, content, type }) => {
    // Si es null, significa que se desfijó
    if (!messageId) {
        hidePinnedBar();
    } else {
        currentPinnedMessageId = messageId;
        showPinnedBar(content, type);
    }
});

// --- FUNCIONES UI AUXILIARES ---

function showPinnedBar(content, type) {
    const bar = document.getElementById('pinnedMessageBar');
    const textEl = document.getElementById('pinnedMessageText');
    const container = document.querySelector('.chat-container');

    // Procesar texto previo
    let previewText = content;
    if (type === 'image') previewText = '📷 Foto';
    else if (type === 'sticker') previewText = '✨ Sticker';
    else if (type === 'audio') previewText = '🎤 Mensaje de voz';

    // Si el contenido está encriptado o es JSON, mostrar texto genérico (seguridad)
    if (previewText.startsWith('{"iv":')) previewText = "🔒 Mensaje encriptado";

    textEl.textContent = previewText;

    bar.classList.remove('hidden');
    container.classList.add('has-pinned-message'); // Para ajustar padding
}

function hidePinnedBar() {
    const bar = document.getElementById('pinnedMessageBar');
    const container = document.querySelector('.chat-container');

    bar.classList.add('hidden');
    container.classList.remove('has-pinned-message');
    currentPinnedMessageId = null;
}

// Función helper para actualizar UI buscando el contenido en el DOM si no viene del socket
function updatePinnedBarUI(msgId) {
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (msgEl) {
        // 1. Clonamos el elemento para limpiarlo sin afectar el chat real
        const clone = msgEl.cloneNode(true);

        // 2. Eliminamos elementos que NO son el mensaje principal
        // (.meta = hora, .quoted-message = respuesta, .deleted-label = etiqueta borrado)
        const garbage = clone.querySelectorAll('.meta, .meta-row, .quoted-message, .deleted-label, .audio-meta-row, .swipe-reply-icon');
        garbage.forEach(el => el.remove());

        // 3. Detectar tipo
        let type = 'text';
        if (clone.querySelector('.chat-image')) type = 'image';
        else if (clone.querySelector('.sticker-img')) type = 'sticker';
        else if (clone.querySelector('audio')) type = 'audio';

        // 4. Obtener texto limpio
        let cleanText = clone.innerText.trim();

        // Si quedó vacío pero es multimedia, ajustar texto
        if (!cleanText && type === 'image') cleanText = ""; // showPinnedBar pondrá "Foto"

        currentPinnedMessageId = msgId;
        showPinnedBar(cleanText, type);
    }
}
document.getElementById('ctxEditBtn').addEventListener('click', () => {
    const msgEl = document.getElementById(`msg-${currentContextMessageId}`);
    if (!msgEl) return closeContextMenu();

    // Obtener texto limpio (sin hora, sin respuestas, etc.)
    const clone = msgEl.cloneNode(true);
    const garbage = clone.querySelectorAll('.meta-row, .quoted-message, .deleted-label, .audio-meta-row, .pin-icon');
    garbage.forEach(el => el.remove());

    const textToEdit = clone.innerText.trim();

    startEditing(currentContextMessageId, textToEdit);
    closeContextMenu();
});

// 2. INICIAR MODO EDICIÓN
function startEditing(msgId, currentText) {
    isEditing = true;
    currentEditingId = msgId;

    // UI
    clearReply(); // No se puede responder y editar a la vez
    editPreview.classList.remove('hidden');
    editPreviewText.textContent = currentText;
    document.getElementById('inputStack').classList.add('active');
    inputMsg.value = currentText;
    inputMsg.focus();

    // Cambiar icono de envío a Checkmark (✓)
    updateButtonState();
}

// 3. CANCELAR EDICIÓN
function cancelEditing() {
    isEditing = false;
    currentEditingId = null;
    editPreview.classList.add('hidden');
    document.getElementById('inputStack').classList.remove('active');
    inputMsg.value = '';
    updateButtonState();
}

closeEditBtn.addEventListener('click', cancelEditing);

// 4. MODIFICAR UPDATE BUTTON STATE (Para mostrar el Check)
// Busca tu función updateButtonState y modifícala:
function updateButtonState() {
    if (isEditing) {
        // Icono de Checkmark para confirmar edición
        mainActionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        mainActionBtn.style.backgroundColor = "#3b82f6"; // Azul Telegram
    } else {
        // Tu lógica original
        mainActionBtn.style.backgroundColor = ""; // Reset color
        mainActionBtn.innerHTML = isRecording ? ICONS.send : (inputMsg.value.trim().length > 0 ? ICONS.send : ICONS.mic);
    }
}
socket.on('message updated', ({ messageId, newContent, isEdited }) => {
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (msgEl) {
        // 1. Actualizar el contenido del mensaje (preservando hora y checks)
        // La forma más segura es buscar el nodo de texto directo o el span de contenido
        // Como tu estructura es compleja, vamos a reconstruir la parte de texto:

        // Asumiendo que el texto está en un span directo o nodo texto dentro de .message-content-wrapper
        // Borramos el texto viejo pero guardamos los metadatos
        const metaRow = msgEl.querySelector('.meta-row');
        const quote = msgEl.querySelector('.quoted-message');
        const pin = msgEl.querySelector('.pin-icon');

        // Limpiamos contenido
        msgEl.innerHTML = '';

        // Restauramos elementos auxiliares
        if (pin) msgEl.appendChild(pin);
        if (quote) msgEl.appendChild(quote);

        // Insertamos nuevo texto
        const textSpan = document.createElement('span');
        textSpan.textContent = newContent; // Ya viene desencriptado del server o plano
        msgEl.appendChild(textSpan);

        // Actualizamos o creamos la etiqueta "editado"
        if (isEdited && metaRow) {
            if (!metaRow.querySelector('.edited-label')) {
                const editLabel = document.createElement('span');
                editLabel.className = 'edited-label';
                editLabel.textContent = 'editado';
                editLabel.style.marginRight = '4px';
                metaRow.prepend(editLabel); // Poner antes de la hora
            }
        }

        // Restauramos metadatos
        if (metaRow) msgEl.appendChild(metaRow);

        // Animación visual
        msgEl.style.animation = "highlightEdit 0.5s ease";
        setTimeout(() => msgEl.style.animation = "", 500);
    }
});
document.querySelectorAll('.sticker-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Si tiene la clase inactive-btn, es Emoji o GIF (No funcional)
        if (btn.classList.contains('inactive-btn')) {
            // Opcional: Vibración o feedback
            if (navigator.vibrate) navigator.vibrate(20);
            console.log("Función no disponible aún");
        }
    });
});
/* --- CÓDIGO CORREGIDO --- */

// Solo definimos btnStickers porque no estaba guardada como variable global arriba.
// stickerPanel e inputMsg YA EXISTEN al principio del archivo, así que las usamos directamente.
const btnStickers = document.getElementById('btnStickers');

// 1. ABRIR/CERRAR STICKERS
btnStickers.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isOpen = stickerPanel.classList.contains('open');

    if (isOpen) {
        // CERRAR
        closeStickerPanel();
        inputMsg.focus(); // Volver al teclado
    } else {
        // ABRIR
        stickerPanel.classList.remove('hidden'); // Quitar display:none
        inputMsg.blur(); // Ocultar teclado nativo

        // Pequeño timeout para la animación
        requestAnimationFrame(() => {
            stickerPanel.classList.add('open'); // Activar altura

            // CRUCIAL: Esperar a que la transición termine o empiece para scrollear
            setTimeout(() => {
                scrollToBottom(true);
            }, 100);
        });

        // Cargar contenido si es necesario
        if (currentStickerTab === 'giphy') loadStickers();
        else loadFavoritesFromServer();
    }
});

// Cerrar si se toca el input
inputMsg.addEventListener('focus', () => {
    if (stickerPanel.classList.contains('open')) {
        closeStickerPanel();
    }
});

function closeStickerPanel() {
    stickerPanel.classList.remove('open');
    setTimeout(() => {
        stickerPanel.classList.add('hidden');
    }, 300); // Mismo tiempo que la transición CSS
}

// 3. Listener para clicks fuera
document.addEventListener('click', (e) => {
    if (!stickerPanel.contains(e.target) && !btnStickers.contains(e.target) && stickerPanel.classList.contains('open')) {
        // Solo cerrar si el click no fue en el input
        if (e.target !== inputMsg) {
            closeStickerPanel();
        }
    }
});

// 4. Feedback visual para botones inactivos
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

// 1. INICIALIZACIÓN: Chequear si soy Premium al hacer login
// (Busca tu función loginSuccess o añade esto al final del archivo para que corra al cargar)

function checkPremiumFeatures() {
    if (myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    } else {
        loveNotesBtn.classList.add('hidden');
    }
}
// Agrega esta llamada dentro de loginSuccess() también.

// 2. ABRIR MODAL Y CARGAR NOTAS
if (loveNotesBtn) {
    loveNotesBtn.addEventListener('click', async () => {
        loveNotesModal.classList.remove('hidden');
        loveNoteDot.classList.add('hidden'); // Quitar notificación al leer

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

// Cerrar modal
if (closeLoveNotes) {
    closeLoveNotes.addEventListener('click', () => loveNotesModal.classList.add('hidden'));
}

// 3. SOCKET: Recibir notificación en tiempo real
socket.on('new_love_note', () => {
    // Si soy premium, mostrar el puntito
    if (myUser && myUser.is_premium) {
        loveNoteDot.classList.remove('hidden');
        // Opcional: Sonido suave
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        showToast("¡Tienes una nueva nota especial! 💖");
    }
});
function checkPremiumFeatures() {
    // Verificamos que el elemento exista y que el usuario sea premium
    if (loveNotesBtn && myUser && myUser.is_premium) {
        loveNotesBtn.classList.remove('hidden');
    } else if (loveNotesBtn) {
        loveNotesBtn.classList.add('hidden');
    }
}

/* ==============================================
   LÓGICA DE CREACIÓN DE CANALES
   ============================================== */

let creationStep = 0; // 0: Start, 1: Members, 2: Info
let selectedMembers = new Set();
let myChannels = [];

const fabNewChat = document.getElementById('fabNewChat');
const creationModal = document.getElementById('creationModal');
const closeCreation = document.getElementById('closeCreation');
const creationTitle = document.getElementById('creationTitle');
const creationNextBtn = document.getElementById('creationNextBtn');

// Vistas
const viewStart = document.getElementById('viewStart');
const viewSelectMembers = document.getElementById('viewSelectMembers');
const viewChannelInfo = document.getElementById('viewChannelInfo');

// 1. ABRIR MODAL
fabNewChat.addEventListener('click', () => {
    creationModal.classList.remove('hidden');
    resetCreationFlow();
    // Cargar lista de contactos simple
    renderStartContacts();
});

closeCreation.addEventListener('click', () => {
    // Si estamos en pasos avanzados, volver atrás
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

    // Cambiar icono de cerrar a flecha atrás si no es el paso 0
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

// 2. PASO 1: SELECCIÓN "NUEVO CANAL"
document.getElementById('btnCreateChannel').addEventListener('click', () => {
    goToStep(1);
});

// Renderizar lista de contactos en inicio (Solo visual por ahora)
function renderStartContacts() {
    const list = document.getElementById('creationContactList');
    list.innerHTML = '';
    allUsersCache.forEach(u => {
        if (u.userId === myUser.id) return;
        const li = document.createElement('li');
        li.className = 'user-item';
        // (Reutilizar tu HTML de usuario simple)
        li.innerHTML = `<div class="u-avatar" style="background-image:url('${u.avatar || '/profile.png'}')"></div><div>${u.display_name || u.username}</div>`;
        li.onclick = () => { /* Abrir chat privado normal */ selectUser(u); creationModal.classList.add('hidden'); };
        list.appendChild(li);
    });
}

// 3. PASO 2: SELECCIONAR MIEMBROS
function renderMemberSelection() {
    const list = document.getElementById('memberSelectionList');
    list.innerHTML = '';

    allUsersCache.forEach(u => {
        if (u.userId === myUser.id) return;
        const li = document.createElement('li');
        li.className = `user-select-item ${selectedMembers.has(u.userId) ? 'selected' : ''}`;
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="u-avatar" style="background-image:url('${u.avatar || '/profile.png'}')"></div>
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


// --- INTEGRACIÓN CON SIDEBAR ---
async function loadMyChannels() {
    const channels = await apiRequest('/api/channels/my-channels');
    if (channels) {
        myChannels = channels;
        // Mezclar canales y usuarios en la lista lateral
        renderMixedSidebar();
    }
}

function renderMixedSidebar() {
    // Esta función reemplaza a renderUserList para mostrar ambos
    // Primero renderiza canales arriba (o mezclados por fecha si tuvieras last_msg)
    usersList.innerHTML = '';

    // 1. Canales
    myChannels.forEach(c => {
        const li = document.createElement('li');
        li.className = `user-item ${currentTargetUserId === 'c_' + c.id ? 'active' : ''}`; // Usamos prefijo c_
        li.innerHTML = `
            <div class="u-avatar" style="background-image:url('${c.avatar || '/profile.png'}'); border-radius:12px;"></div> <!-- Cuadrado redondeado para canales -->
            <div style="overflow:hidden;">
                <div style="font-weight:600; color:#fff;">${escapeHtml(c.name)}</div>
                <div style="font-size:12px; color:#a1a1aa;">📢 Canal</div>
            </div>`;
        li.onclick = () => selectChannel(c, li);
        usersList.appendChild(li);
    });

    // 2. Usuarios (Lógica existente)
    // ... copia aquí el bucle de renderUserList original ...
    // pero asegúrate de que al hacer append no borre lo anterior
    allUsersCache.sort((a, b) => b.online - a.online).forEach(u => {
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

// Lógica para seleccionar canal
// Lógica para seleccionar canal
async function selectChannel(channel, elem) {
    // 1. Configuración de variables
    currentTargetUserId = 'c_' + channel.id;
    currentTargetUserObj = { ...channel, isChannel: true };
    currentChatType = 'channel';

    // 2. UI de Selección
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    if (elem) elem.classList.add('active');

    // 3. Mostrar áreas principales
    emptyState.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    messagesList.classList.remove('hidden');

    // --- CORRECCIÓN MÓVIL Y FAB ---
    // A. Activar vista móvil (Esto arregla el bug de que no entraba)
    document.querySelector('.chat-container').classList.add('mobile-chat-active');

    // B. Ocultar botón flotante de nuevo chat
    if (fabNewChat) fabNewChat.classList.add('hidden');
    // -----------------------------

    // --- LIMPIEZA DE UI (FIX BUGS ANTERIOR) ---
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

    // 4. Lógica de Permisos
    if (channel.owner_id === myUser.id) {
        chatForm.classList.remove('hidden');
    } else {
        chatForm.classList.add('hidden');
    }

    // 5. Configurar Cabecera y Cargar Mensajes
    chatTitle.textContent = channel.name;
    currentChatAvatar.style.backgroundImage = `url('${channel.avatar}')`;
    currentChatAvatar.style.borderRadius = "12px";

    messagesList.innerHTML = '<li style="text-align:center;color:#666;margin-top:20px;">Cargando canal...</li>';
    const msgs = await apiRequest(`/api/channels/channel-messages/${channel.id}`);
    messagesList.innerHTML = '';

    if (msgs) {
        msgs.forEach(msg => {
            const isMe = msg.from_user_id === myUser.id;
            appendMessageUI(msg.content, isMe ? 'me' : 'other', msg.timestamp, msg.id, msg.type, null, msg.is_deleted, msg.caption);
        });
        scrollToBottom(false);
    }
}

// Modificar sendMessage para soportar canales
const originalSendMessage = sendMessage;
sendMessage = function (content, type, replyId = null) {
    if (currentChatType === 'channel') {
        const channelId = currentTargetUserObj.id;
        socket.emit('private message', {
            content,
            toChannelId: channelId, // Nuevo campo
            type,
            replyToId: replyId
        }, (res) => {
            // Confirmación local (aunque el socket emit 'channel_message' lo manejará también, evita duplicados con cuidado)
        });
    } else {
        originalSendMessage(content, type, replyId);
    }
}

// Escuchar mensajes de canal
socket.on('channel_message', (msg) => {
    // Si estoy en el canal correcto
    if (currentChatType === 'channel' && currentTargetUserObj.id === msg.channelId) {
        const isMe = msg.fromUserId === myUser.id;
        appendMessageUI(msg.content, isMe ? 'me' : 'other', msg.timestamp, msg.id, msg.type, null, 0, msg.caption);
        scrollToBottom(true);
    }
});

socket.on('channels_update', () => {
    loadMyChannels();
});

// Al iniciar sesión, cargar canales
const originalLoginSuccess = loginSuccess;
loginSuccess = function (user) {
    originalLoginSuccess(user);
    loadMyChannels();
}
/* =======================================================
   LÓGICA DEL PERFIL Y EDICIÓN DE CANAL
   ======================================================= */

const channelProfileModal = document.getElementById('channelProfileModal');
const channelEditModal = document.getElementById('channelEditModal');

// Elementos del Modal Info
const channelProfileAvatar = document.getElementById('channelProfileAvatar');
const channelProfileName = document.getElementById('channelProfileName');
const channelProfileBio = document.getElementById('channelProfileBio');
const btnEditChannel = document.getElementById('btnEditChannel');
const channelSubCount = document.getElementById('channelSubCount');

// Elementos del Modal Editar
const editChannelName = document.getElementById('editChannelName');
const editChannelBio = document.getElementById('editChannelBio');
const editChannelAvatarPreview = document.getElementById('editChannelAvatarPreview');
const editChannelAvatarInput = document.getElementById('editChannelAvatarInput');
let editChannelFile = null;

// 1. MODIFICAR LISTENER DEL HEADER (Para detectar click en canal)
// Busca donde tienes: getEl('headerAvatarBtn').addEventListener('click', ...) y reemplázalo o modifícalo:

getEl('headerAvatarBtn').addEventListener('click', () => {
    // A. Si es un CANAL
    if (currentChatType === 'channel' && currentTargetUserObj) {
        openChannelProfile();
    }
    // B. Si es un USUARIO (Lógica existente)
    else if (currentTargetUserObj) {
        // Tu código existente para abrir contactInfoModal
        const modal = getEl('contactInfoModal');
        modal.classList.remove('hidden');
    }
});

// 2. FUNCIÓN ABRIR PERFIL CANAL
// 2. FUNCIÓN ABRIR PERFIL CANAL (ACTUALIZADA)
async function openChannelProfile() {
    const channel = currentTargetUserObj;

    // Referencias a elementos del DOM
    const nameEl = document.getElementById('channelProfileName');
    const statusEl = document.getElementById('channelProfileStatus'); // El texto debajo del avatar
    const bioEl = document.getElementById('channelProfileBio');
    const avatarEl = document.getElementById('channelProfileAvatar');
    const subCountEl = document.getElementById('channelSubCount'); // Número en la lista
    const editBtn = document.getElementById('btnEditChannel');

    // Elementos condicionales
    const linkSection = document.getElementById('channelLinkSection');
    const publicLinkEl = document.getElementById('channelPublicLink');
    const subSection = document.getElementById('channelSubSection'); // El item de lista de suscriptores

    // 1. Rellenar datos básicos
    nameEl.textContent = channel.name;

    if (channel.description) {
        bioEl.textContent = channel.description;
        bioEl.style.color = "#e4e4e7";
    } else {
        bioEl.textContent = "Sin descripción.";
        bioEl.style.color = "#666";
    }

    let avatarUrl = channel.avatar || '/profile.png';
    avatarEl.style.backgroundImage = `url('${escapeHtml(avatarUrl)}')`;

    // 2. Verificar permisos de edición
    if (channel.owner_id === myUser.id) {
        editBtn.classList.remove('hidden');
    } else {
        editBtn.classList.add('hidden');
    }

    // 3. Obtener contadores reales (API)
    let memberCount = 0;
    try {
        const res = await apiRequest(`/api/channels/info/${channel.id}`);
        if (res) memberCount = res.memberCount || 0;
    } catch (e) {
        console.log(e);
    }

    // Texto de suscriptores (singular/plural)
    const subText = memberCount === 1 ? 'suscriptor' : 'suscriptores';

    // 4. LÓGICA DE VISUALIZACIÓN (PÚBLICO VS PRIVADO)

    if (channel.is_public) {
        // --- MODO PÚBLICO ---
        // A. Debajo del nombre muestra la cantidad de usuarios (Estilo Telegram)
        statusEl.textContent = `${memberCount} ${subText}`;
        statusEl.style.color = "#a1a1aa"; // Gris claro

        // B. Muestra el Link en la lista
        linkSection.classList.remove('hidden');
        const handle = channel.handle || 'enlace';
        publicLinkEl.textContent = `ap.me/${handle}`;

        // Copiar al hacer click
        publicLinkEl.onclick = () => {
            navigator.clipboard.writeText(`ap.me/${handle}`);
            showToast("Enlace copiado al portapapeles");
        };

        // C. Oculta el item de suscriptores de la lista (porque ya se muestra arriba)
        // (O déjalo si quieres que se repita, pero dijiste "donde esta canal privado muestre la cantidad")
        subSection.classList.add('hidden');

    } else {
        // --- MODO PRIVADO ---
        // A. Debajo del nombre muestra "canal privado"
        statusEl.textContent = "canal privado";
        statusEl.style.color = "#666"; // Gris oscuro

        // B. Oculta el Link en la lista
        linkSection.classList.add('hidden');

        // C. Muestra el item de suscriptores en la lista (como estaba antes)
        subSection.classList.remove('hidden');
        subCountEl.textContent = memberCount;
    }

    // Mostrar el modal
    document.getElementById('channelProfileModal').classList.remove('hidden');
}
const btnCloseChannel = document.getElementById('closeChannelProfile');

if (btnCloseChannel) {
    btnCloseChannel.addEventListener('click', () => {
        // Ocultar el modal añadiendo la clase 'hidden'
        document.getElementById('channelProfileModal').classList.add('hidden');
    });
}
// 4. ABRIR MODAL EDITAR (Al click en el lápiz)
btnEditChannel.addEventListener('click', () => {
    channelProfileModal.classList.add('hidden'); // Cerrar el de info

    // Rellenar datos actuales
    const channel = currentTargetUserObj;
    editChannelName.value = channel.name;
    editChannelBio.value = channel.description || '';
    editChannelAvatarPreview.style.backgroundImage = `url('${channel.avatar || '/profile.png'}')`;
    editChannelFile = null; // Resetear archivo

    channelEditModal.classList.remove('hidden');
});

// 5. CERRAR MODAL EDITAR
document.getElementById('closeChannelEdit').addEventListener('click', () => {
    channelEditModal.classList.add('hidden');
    channelProfileModal.classList.remove('hidden'); // Volver al perfil
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
// 6. PREVISUALIZAR AVATAR AL EDITAR
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

// 7. GUARDAR CAMBIOS CANAL
const saveInfoBtn = document.getElementById('saveChannelInfoBtn');

if (saveInfoBtn) {
    saveInfoBtn.addEventListener('click', async () => {
        const newName = document.getElementById('editChannelName').value.trim();
        const newBio = document.getElementById('editChannelBio').value.trim();
        const avatarInput = document.getElementById('editChannelAvatarInput'); // Asegurarnos de obtener el input actual
        const avatarFile = avatarInput && avatarInput.files ? avatarInput.files[0] : null;

        if (!newName) return alert("El nombre no puede estar vacío");
        if (!currentEditChannel) return;

        // Feedback visual de carga
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
                // Actualizar objeto localmente
                currentEditChannel.name = res.name;
                currentEditChannel.description = res.description;
                if (res.avatar) currentEditChannel.avatar = res.avatar;

                // Si es el chat que estamos viendo ahora, actualizar header
                if (currentTargetUserObj && currentTargetUserObj.id === currentEditChannel.id) {
                    currentTargetUserObj = { ...currentTargetUserObj, ...currentEditChannel };
                    updateChatHeaderInfo(currentTargetUserObj);
                    const currentAvatarEl = document.getElementById('currentChatAvatar');
                    if (currentAvatarEl) currentAvatarEl.style.backgroundImage = `url('${res.avatar || currentTargetUserObj.avatar}')`;
                }

                // Recargar lista lateral
                loadMyChannels();

                // Cerrar modal
                document.getElementById('channelEditModal').classList.add('hidden');

                // Opcional: Volver a abrir el perfil para ver cambios
                // openChannelProfile(); 
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
/* =======================================================
   LÓGICA DEL HEADER (PERFIL CANAL vs USUARIO)
   ======================================================= */

const headerBtn = document.getElementById('headerAvatarBtn');

// Usamos .onclick para SOBRESCRIBIR cualquier evento anterior.
// Esto soluciona el problema de que se abran dos modales a la vez.
headerBtn.onclick = (e) => {
    e.stopPropagation();

    // --- CASO A: Es un CANAL ---
    if (currentChatType === 'channel' && currentTargetUserObj) {
        // 1. Asegurar que el modal de usuario esté cerrado
        document.getElementById('contactInfoModal').classList.add('hidden');

        // 2. Abrir perfil del canal
        openChannelProfile();
    }

    // --- CASO B: Es un USUARIO (Chat Privado) ---
    else if (currentTargetUserObj) {
        // 1. Asegurar que el modal de canal esté cerrado
        document.getElementById('channelProfileModal').classList.add('hidden');

        // 2. Abrir Info de Contacto
        const modal = document.getElementById('contactInfoModal');
        const nameEl = document.getElementById('contactInfoName');
        const userEl = document.getElementById('contactRealUsername');
        const bioEl = document.getElementById('contactInfoBio');
        const avatarEl = document.getElementById('contactInfoAvatar');
        const adminSec = document.getElementById('adminActionsSection');

        // Rellenar datos
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

        // Lógica Admin (Botones de verificar/premium)
        if (myUser?.is_admin) {
            if (adminSec) adminSec.classList.remove('hidden');

            const verifyBtn = document.getElementById('toggleVerifyBtn');
            const premiumBtn = document.getElementById('togglePremiumBtn');
            const loveNoteSec = document.getElementById('adminLoveNoteSection');

            if (verifyBtn) verifyBtn.textContent = currentTargetUserObj.is_verified ? "Quitar Verificado" : "Verificar Usuario";
            if (premiumBtn) premiumBtn.textContent = currentTargetUserObj.is_premium ? "Quitar Corazón 💔" : "Poner Corazón 💖";

            // Mostrar sección de notas love si es premium
            if (loveNoteSec) {
                if (currentTargetUserObj.is_premium) loveNoteSec.classList.remove('hidden');
                else loveNoteSec.classList.add('hidden');
            }
        } else {
            if (adminSec) adminSec.classList.add('hidden');
        }

        // Mostrar el modal
        modal.classList.remove('hidden');

        // Habilitar edición de apodo si existe la función
        if (typeof enableNicknameEdit === 'function') {
            enableNicknameEdit('contactInfoName', currentTargetUserObj.userId);
        }
    }
};
/* ======================================================
   LÓGICA DE CREACIÓN DE CANALES (CORREGIDA)
   ====================================================== */

// 1. VARIABLES GLOBALES
let handleCheckTimeout = null;
let isHandleValid = false;
let channelAvatarFile = null; // <--- VARIABLE QUE FALTABA

// 2. REFERENCIAS DOM
const viewChannelType = document.getElementById('viewChannelType');

const creationCheckBtn = document.getElementById('creationCheckBtn');
const channelNameInput = document.getElementById('channelNameInput');
const channelLinkInput = document.getElementById('channelLinkInput');
const linkStatusText = document.getElementById('linkStatusText');
const radioInputs = document.querySelectorAll('input[name="channelType"]');
const publicLinkSection = document.getElementById('publicLinkSection');
const privateLinkSection = document.getElementById('privateLinkSection');

// 3. INICIAR MODAL
fabNewChat.addEventListener('click', () => {
    creationModal.classList.remove('hidden');
    resetCreationFlow();
    renderStartContacts();
});

function resetCreationFlow() {
    creationStep = 0;
    selectedMembers.clear();
    channelAvatarFile = null; // Resetear archivo
    isHandleValid = false;

    // Limpiar inputs si existen
    if (channelNameInput) channelNameInput.value = '';
    if (channelLinkInput) channelLinkInput.value = '';
    const bioInput = document.getElementById('channelBioInput');
    if (bioInput) bioInput.value = '';
    const avatarPreview = document.getElementById('channelAvatarPreview');
    if (avatarPreview) avatarPreview.style.backgroundImage = '';

    goToStep(0);
}

// 4. CONTROLADOR DE VISTAS (STEPS)
function goToStep(step) {
    creationStep = step;

    // Ocultar todas las vistas
    if (viewStart) viewStart.classList.add('hidden');
    if (viewSelectMembers) viewSelectMembers.classList.add('hidden');
    if (viewChannelInfo) viewChannelInfo.classList.add('hidden');
    if (viewChannelType) viewChannelType.classList.add('hidden');

    // Ocultar botones del header
    if (creationNextBtn) creationNextBtn.classList.add('hidden');
    if (creationCheckBtn) creationCheckBtn.classList.add('hidden');

    // Icono Cerrar vs Atrás
    const closeIcon = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    const backIcon = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';

    if (closeCreation) closeCreation.innerHTML = (step === 0) ? closeIcon : backIcon;

    // Lógica por paso
    if (step === 0) {
        if (creationTitle) creationTitle.textContent = "Nuevo Chat";
        viewStart.classList.remove('hidden');
    }
    else if (step === 1) {
        if (creationTitle) creationTitle.textContent = "Añadir Miembros";
        viewSelectMembers.classList.remove('hidden');
        renderMemberSelection();
        updateNextButton(); // Verificar si mostrar botón Siguiente
    }
    else if (step === 2) {
        if (creationTitle) creationTitle.textContent = "Nuevo Canal";
        viewChannelInfo.classList.remove('hidden');
        channelNameInput.focus();
        // Mostrar Check si ya escribió nombre
        if (channelNameInput.value.trim().length > 0) creationCheckBtn.classList.remove('hidden');
    }
    else if (step === 3) {
        if (creationTitle) creationTitle.textContent = "Tipo de canal";
        viewChannelType.classList.remove('hidden');
        validateChannelTypeStep(); // Verificar estado inicial
    }
}

// 5. LISTENERS DE NAVEGACIÓN
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
        // De Info -> Tipo
        if (channelNameInput.value.trim()) goToStep(3);
    }
    else if (creationStep === 3) {
        // De Tipo -> FIN
        submitCreateChannel();
    }
});

// 6. LOGICA ESPECÍFICA DE PASOS

// --- PASO 1: Helper para botón Siguiente ---
function updateNextButton() {
    if (selectedMembers.size > 0) {
        creationNextBtn.classList.remove('hidden');
        creationNextBtn.textContent = `Sig. (${selectedMembers.size})`;
    } else {
        creationNextBtn.classList.add('hidden');
    }
}

// --- PASO 2: Input Nombre y Avatar ---
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

// --- PASO 3: Tipo de Canal y Validación ---

// Cambio de Radio Button (Público/Privado)
radioInputs.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'public') {
            publicLinkSection.classList.remove('hidden');
            privateLinkSection.classList.add('hidden');
            validatePublicHandle();
        } else {
            publicLinkSection.classList.add('hidden');
            privateLinkSection.classList.remove('hidden');
            // Generar link privado falso visual
            const rnd = Math.random().toString(36).substring(7);
            document.getElementById('generatedPrivateLink').textContent = `t.me/+${rnd}`;
            // Privado siempre permite avanzar
            creationCheckBtn.classList.remove('hidden');
        }
    });
});

// Input de Enlace
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

// Función API Check Handle
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

// --- FUNCIÓN QUE FALTABA (validatePublicHandle) ---
function validatePublicHandle() {
    const val = channelLinkInput.value.trim();
    // Mostrar Check si es válido y largo suficiente
    if (val.length >= 5 && isHandleValid) {
        creationCheckBtn.classList.remove('hidden');
    } else {
        creationCheckBtn.classList.add('hidden');
    }
}

// --- FUNCIÓN QUE FALTABA (validateChannelTypeStep) ---
function validateChannelTypeStep() {
    const type = document.querySelector('input[name="channelType"]:checked').value;
    if (type === 'private') {
        creationCheckBtn.classList.remove('hidden');
    } else {
        validatePublicHandle();
    }
}

// 7. ENVÍO FINAL AL SERVIDOR
async function submitCreateChannel() {
    const name = channelNameInput.value.trim();
    const bioInput = document.getElementById('channelBioInput');
    const bio = bioInput ? bioInput.value.trim() : '';

    const type = document.querySelector('input[name="channelType"]:checked').value;
    const handle = channelLinkInput.value.trim();

    if (!name) return alert("Nombre requerido");
    if (type === 'public' && !isHandleValid) return alert("Enlace inválido o no disponible");

    // Loading visual
    creationCheckBtn.style.opacity = "0.5";
    creationCheckBtn.style.pointerEvents = "none";

    const fd = new FormData();
    fd.append('name', name);
    fd.append('bio', bio);
    fd.append('members', JSON.stringify(Array.from(selectedMembers)));
    fd.append('isPublic', type === 'public');

    if (type === 'public') fd.append('handle', handle);
    if (channelAvatarFile) fd.append('avatar', channelAvatarFile); // Ahora channelAvatarFile existe

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
/* ======================================================
   LÓGICA AVANZADA DE EDICIÓN DE CANAL
   ====================================================== */

let currentEditChannel = null;

// --- FUNCIÓN HELPER PARA CAMBIAR VISTA PÚBLICO/PRIVADO ---
function toggleLinkSections(val) {
    const pubSection = document.getElementById('editPublicLinkSection');
    const privSection = document.getElementById('editPrivateLinkSection');

    if (!pubSection || !privSection) return; // Seguridad por si no existen los elementos

    if (val === 'public') {
        pubSection.classList.remove('hidden');
        privSection.classList.add('hidden');
    } else {
        pubSection.classList.add('hidden');
        privSection.classList.remove('hidden');
    }
}

// 1. ABRIR EDICIÓN PRINCIPAL
btnEditChannel.addEventListener('click', () => {
    currentEditChannel = currentTargetUserObj; // Objeto del canal actual

    // Rellenar datos
    document.getElementById('editChannelName').value = currentEditChannel.name;
    document.getElementById('editChannelBio').value = currentEditChannel.description || '';
    document.getElementById('editChannelAvatarPreview').style.backgroundImage = `url('${currentEditChannel.avatar}')`;

    document.getElementById('lblChannelType').textContent = currentEditChannel.is_public ? "Público" : "Privado";

    // Obtener contadores reales
    refreshChannelCounts(currentEditChannel.id);

    // Navegación de modales
    channelProfileModal.classList.add('hidden');
    document.getElementById('channelEditModal').classList.remove('hidden');
});

// Helper: Refrescar contadores
async function refreshChannelCounts(cid) {
    // Miembros
    const mRes = await apiRequest(`/api/channels/info/${cid}`);
    document.getElementById('lblSubCount').textContent = mRes ? mRes.memberCount : 0;

    // Baneados
    const bRes = await apiRequest(`/api/channels/${cid}/banned`);
    document.getElementById('lblBannedCount').textContent = bRes ? bRes.length : 0;
}

// 2. NAVEGACIÓN: TIPO DE CANAL
document.getElementById('btnOpenChannelType').addEventListener('click', () => {
    document.getElementById('channelEditModal').classList.add('hidden');
    document.getElementById('channelTypeModal').classList.remove('hidden');

    // Setear estado actual
    const isPublic = !!currentEditChannel.is_public;
    document.querySelector(`input[name="editChannelType"][value="${isPublic ? 'public' : 'private'}"]`).checked = true;

    toggleLinkSections(isPublic ? 'public' : 'private');

    // Lógica para mostrar los links
    if (isPublic) {
        // Si es público, llenamos el input del handle
        document.getElementById('editChannelLinkInput').value = currentEditChannel.handle || '';
    }

    // SIEMPRE preparamos el link privado visualmente (aunque esté oculto)
    // Usamos el private_hash que viene del backend
    if (currentEditChannel.private_hash) {
        document.getElementById('editGeneratedLink').value = `ap.me/+${currentEditChannel.private_hash}`;
    } else if (!isPublic && currentEditChannel.invite_link) {
        // Fallback: si es privado actualmente, usamos el link actual
        document.getElementById('editGeneratedLink').value = currentEditChannel.invite_link;
    } else {
        document.getElementById('editGeneratedLink').value = 'Generando...';
    }
});

// Toggle UI Público/Privado
document.querySelectorAll('input[name="editChannelType"]').forEach(r => {
    r.addEventListener('change', (e) => {
        const val = e.target.value;
        toggleLinkSections(val);

        // Si selecciona Privado y tenemos el hash guardado localmente, lo mostramos
        if (val === 'private' && currentEditChannel.private_hash) {
            document.getElementById('editGeneratedLink').value = `ap.me/+${currentEditChannel.private_hash}`;
        }
    });
});

// Guardar Tipo de Canal
document.getElementById('saveChannelTypeBtn').addEventListener('click', async () => {
    const type = document.querySelector('input[name="editChannelType"]:checked').value;
    const isPublic = type === 'public';
    const handle = document.getElementById('editChannelLinkInput').value.trim();

    if (isPublic && handle.length < 5) return alert("El enlace debe tener al menos 5 caracteres");

    const res = await apiRequest(`/api/channels/${currentEditChannel.id}/update-type`, 'POST', { isPublic, handle });

    if (res && res.success) {
        // Actualizar local
        currentEditChannel.is_public = isPublic ? 1 : 0;
        currentEditChannel.handle = isPublic ? handle : null;
        if (res.newLink) currentEditChannel.invite_link = res.newLink;

        document.getElementById('lblChannelType').textContent = isPublic ? "Público" : "Privado";

        // Volver atrás
        document.getElementById('channelTypeModal').classList.add('hidden');
        document.getElementById('channelEditModal').classList.remove('hidden');
    } else {
        alert(res.error || "Error al actualizar (¿Enlace ocupado?)");
    }
});

// 3. NAVEGACIÓN: SUSCRIPTORES
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

        // Formatear fecha
        const date = new Date(u.joined_at);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        li.innerHTML = `
            <div class="simple-avatar" style="background-image:url('${u.avatar || '/profile.png'}')"></div>
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
        loadSubscribersList(); // Recargar lista
        refreshChannelCounts(currentEditChannel.id); // Actualizar contador en memoria
    }
}

// 4. NAVEGACIÓN: EXPULSADOS
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
            <div class="simple-avatar" style="background-image:url('${u.avatar || '/profile.png'}')"></div>
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

// 5. CERRAR MODALES (Botones Atrás)
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
// ===============================================
// LÓGICA PARA AÑADIR SUSCRIPTORES AL CANAL
// ===============================================

const channelAddMembersModal = document.getElementById('channelAddMembersModal');
const btnAddSubscribers = document.getElementById('btnAddSubscribers'); // El botón en el modal de suscriptores
const closeAddMembers = document.getElementById('closeAddMembers');
const addMembersList = document.getElementById('addMembersList');
const searchNewMembers = document.getElementById('searchNewMembers');
const confirmAddMembersBtn = document.getElementById('confirmAddMembersBtn');

let usersToAddToChannel = new Set(); // Almacena los IDs seleccionados

// 1. ABRIR EL MODAL DE SELECCIÓN
if (btnAddSubscribers) {
    btnAddSubscribers.addEventListener('click', async () => {
        // Ocultar el modal de lista de suscriptores actual
        document.getElementById('channelSubsModal').classList.add('hidden');

        // Mostrar el nuevo modal
        channelAddMembersModal.classList.remove('hidden');

        // Resetear
        usersToAddToChannel.clear();
        searchNewMembers.value = '';
        confirmAddMembersBtn.classList.add('hidden');
        addMembersList.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">Cargando contactos...</li>';

        // Cargar contactos disponibles (excluyendo los que ya son miembros)
        await renderAvailableContacts();
    });
}

// 2. CERRAR EL MODAL (Volver atrás)
if (closeAddMembers) {
    closeAddMembers.addEventListener('click', () => {
        channelAddMembersModal.classList.add('hidden');
        // Volver a mostrar el modal de suscriptores
        document.getElementById('channelSubsModal').classList.remove('hidden');
    });
}

// 3. RENDERIZAR CONTACTOS DISPONIBLES
async function renderAvailableContacts(filterText = '') {
    // A. Obtener miembros actuales del canal para no mostrarlos
    // (Asumimos que currentEditChannel tiene el ID correcto)
    if (!currentEditChannel) return;

    let currentMembersIds = [];
    try {
        const membersData = await apiRequest(`/api/channels/${currentEditChannel.id}/members`);
        currentMembersIds = membersData.map(m => m.id);
    } catch (e) {
        console.error("Error obteniendo miembros", e);
    }

    addMembersList.innerHTML = '';

    // B. Filtrar de la caché global de usuarios (allUsersCache)
    const candidates = allUsersCache.filter(u => {
        // Excluirme a mí mismo
        if (u.userId === myUser.id) return false;
        // Excluir los que ya son miembros
        if (currentMembersIds.includes(u.userId)) return false;
        // Filtro de búsqueda texto
        const name = (myNicknames[u.userId] || u.username).toLowerCase();
        return name.includes(filterText.toLowerCase());
    });

    if (candidates.length === 0) {
        addMembersList.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">No hay contactos disponibles.</li>';
        return;
    }

    // C. Renderizar lista
    candidates.forEach(u => {
        const li = document.createElement('li');
        // Usamos la misma clase 'user-item' para heredar el estilo base
        li.className = 'user-item';

        // Si ya estaba seleccionado en esta sesión (por si usa el buscador), marcarlo
        if (usersToAddToChannel.has(u.userId)) {
            li.classList.add('active'); // Clase CSS que pone el fondo morado/azul
        }

        const name = escapeHtml(myNicknames[u.userId] || u.username);
        const avatarUrl = (u.avatar && isValidUrl(u.avatar)) ? u.avatar : '/profile.png';

        li.innerHTML = `
            <div class="u-avatar" style="background-image: url('${escapeHtml(avatarUrl)}')"></div>
            <div style="flex:1;">
                <div style="font-weight:600; color:#fff;">${name}</div>
                <div style="font-size:12px; color:#a1a1aa;">${u.online ? 'En línea' : 'Desconectado'}</div>
            </div>
            <!-- Check visual opcional (solo se ve si está activo por CSS o lógica) -->
            <div class="selection-check" style="display:none;">✓</div> 
        `;

        // D. Evento de Selección
        li.onclick = () => {
            if (usersToAddToChannel.has(u.userId)) {
                usersToAddToChannel.delete(u.userId);
                li.classList.remove('active'); // Quita el estilo de seleccionado
            } else {
                usersToAddToChannel.add(u.userId);
                li.classList.add('active'); // Pone el estilo de seleccionado (mismo que chat)
            }
            toggleConfirmButton();
        };

        addMembersList.appendChild(li);
    });
}

// 4. MOSTRAR/OCULTAR BOTÓN DE CONFIRMAR (LA PALOMITA)
function toggleConfirmButton() {
    if (usersToAddToChannel.size > 0) {
        confirmAddMembersBtn.classList.remove('hidden');
    } else {
        confirmAddMembersBtn.classList.add('hidden');
    }
}

// 5. EVENTO DE BÚSQUEDA
if (searchNewMembers) {
    searchNewMembers.addEventListener('input', (e) => {
        renderAvailableContacts(e.target.value.trim());
    });
}

// 6. ENVIAR AL SERVIDOR (CLICK EN LA PALOMITA)
if (confirmAddMembersBtn) {
    confirmAddMembersBtn.addEventListener('click', async () => {
        if (usersToAddToChannel.size === 0) return;

        // Feedback visual
        const originalIcon = confirmAddMembersBtn.innerHTML;
        confirmAddMembersBtn.innerHTML = '...';
        confirmAddMembersBtn.style.pointerEvents = 'none';

        try {
            const res = await apiRequest(`/api/channels/${currentEditChannel.id}/add-members`, 'POST', {
                userIds: Array.from(usersToAddToChannel)
            });

            if (res && res.success) {
                // Cerrar este modal
                channelAddMembersModal.classList.add('hidden');

                // Volver al modal de suscriptores y recargar la lista
                document.getElementById('channelSubsModal').classList.remove('hidden');
                loadSubscribersList(); // Función existente que recarga la lista
                refreshChannelCounts(currentEditChannel.id); // Función existente que actualiza el número

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
/* ======================================================
   LÓGICA ACTUALIZADA DE ACCIONES DEL CANAL
   ====================================================== */

const btnChannelMenu = document.getElementById('btnChannelMenu');
const channelOptionsMenu = document.getElementById('channelOptionsMenu');

const btnActionShare = document.getElementById('btnActionShare');
const btnActionLeave = document.getElementById('btnActionLeave');
const btnActionMute = document.getElementById('btnActionMute');

const optChannelMute = document.getElementById('optChannelMute');
const optChannelLeave = document.getElementById('optChannelLeave');

// 1. TOGGLE MENÚ DE TRES PUNTOS
if (btnChannelMenu) {
    btnChannelMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        channelOptionsMenu.classList.toggle('hidden');
    });
}

// Cerrar menú al hacer click fuera
document.addEventListener('click', (e) => {
    if (channelOptionsMenu && !channelOptionsMenu.classList.contains('hidden')) {
        if (!channelOptionsMenu.contains(e.target) && !btnChannelMenu.contains(e.target)) {
            channelOptionsMenu.classList.add('hidden');
        }
    }
});

// 2. FUNCIÓN DE COMPARTIR (Botón Circular Central)
if (btnActionShare) {
    btnActionShare.addEventListener('click', () => {
        shareChannelLink();
    });
}

function shareChannelLink() {
    if (!currentTargetUserObj) return;

    // Obtener el link: si es público usa el handle, si es privado usa el invite_link (hash)
    let linkToShare = '';

    if (currentTargetUserObj.is_public && currentTargetUserObj.handle) {
        linkToShare = `ap.me/${currentTargetUserObj.handle}`;
    } else if (currentTargetUserObj.private_hash) {
        linkToShare = `ap.me/+${currentTargetUserObj.private_hash}`;
    } else if (currentTargetUserObj.invite_link) {
        linkToShare = currentTargetUserObj.invite_link; // Fallback
    } else {
        return showToast("No hay enlace disponible para este canal.");
    }

    navigator.clipboard.writeText(linkToShare).then(() => {
        showToast("Enlace del canal copiado");
    }).catch(() => {
        showToast("Error al copiar enlace");
    });
}

// 3. FUNCIÓN DE SALIR (Botón Circular Derecho y Menú)
function triggerLeaveChannel() {
    channelOptionsMenu.classList.add('hidden'); // Cerrar menú si estaba abierto

    // Reutilizamos el modal de confirmación de borrado, pero cambiamos el texto y la acción
    deleteActionType = 'leave_channel';

    // Cambiar textos del modal dinámicamente
    const modalTitle = document.querySelector('#deleteConfirmModal h3');
    const modalDesc = document.querySelector('#deleteConfirmModal p');
    const btnAction = document.getElementById('btnDeleteEveryone'); // Usamos el botón rojo principal
    const btnSecondary = document.getElementById('btnDeleteMe');

    if (modalTitle) modalTitle.textContent = "¿Salir del canal?";
    if (modalDesc) modalDesc.textContent = "¿Estás seguro de que quieres salir de este canal?";

    // Ocultar botón secundario (solo necesitamos Confirmar Salida y Cancelar)
    if (btnSecondary) btnSecondary.classList.add('hidden');

    // Configurar botón rojo
    if (btnAction) {
        btnAction.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Salir del canal
        `;
        btnAction.style.display = 'flex';
    }

    // Abrir modal
    document.getElementById('deleteConfirmModal').classList.remove('hidden');
}

// Listener para botón circular
if (btnActionLeave) {
    btnActionLeave.addEventListener('click', triggerLeaveChannel);
}
// Listener para opción del menú
if (optChannelLeave) {
    optChannelLeave.addEventListener('click', triggerLeaveChannel);
}

// 4. LÓGICA DE CONFIRMACIÓN DE SALIDA (Actualizar el listener existente de btnDeleteEveryone)
// Busca donde tienes: getEl('btnDeleteEveryone').addEventListener('click', ...) y reemplaza o actualiza el bloque:

const originalDeleteEveryoneBtn = document.getElementById('btnDeleteEveryone');
// Clonar para quitar listeners viejos y evitar duplicados si se ejecuta varias veces, 
// O simplemente añade la condición dentro del listener existente.
// Asumiré que editas el listener existente dentro de script.js:

originalDeleteEveryoneBtn.addEventListener('click', async () => {
    // ... tu lógica existente de borrar mensajes ...

    // NUEVO CASO: SALIR DEL CANAL
    if (deleteActionType === 'leave_channel') {
        if (!currentTargetUserObj || !currentTargetUserObj.isChannel) return;

        try {
            const res = await apiRequest(`/api/channels/${currentTargetUserObj.id}/leave`, 'POST');

            if (res && res.success) {
                showToast("Has salido del canal");
                closeDeleteModal();

                // Cerrar modal de perfil
                document.getElementById('channelProfileModal').classList.add('hidden');

                // Recargar lista lateral
                loadMyChannels();

                // Salir a la pantalla vacía
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

    // IMPORTANTE: Restaurar el botón secundario al cerrar por si se usa para borrar mensajes luego
    const btnSecondary = document.getElementById('btnDeleteMe');
    if (btnSecondary) btnSecondary.classList.remove('hidden');
});

// 5. BOTÓN SILENCIAR (Visual por ahora)
function toggleMuteUI() {
    channelOptionsMenu.classList.add('hidden');
    // Aquí iría la llamada al backend para mutear
    showToast("Notificaciones silenciadas (Visual)");
}
if (btnActionMute) btnActionMute.addEventListener('click', toggleMuteUI);
if (optChannelMute) optChannelMute.addEventListener('click', toggleMuteUI);