const socket = io({ autoConnect: false });

// --- REDIRECCIÓN DE SEGURIDAD ---
const saved = localStorage.getItem('chatUser');
if(!saved) {
    window.location.href = '/login.html';
}

// --- GIPHY API KEY ---
const GIPHY_API_KEY = 'dZrv40Fha5nImhg5hbNuiO3ZJtWqecwM'; 

// --- Variables de Estado ---
let myUser = null;
let currentTargetUserId = null;
let currentTargetUserObj = null; 
let messageIdToDelete = null;
let myNicknames = {}; 
let allUsersCache = []; 

// Variable para Reply
let currentReplyId = null; 

// --- Elementos DOM ---
const profileBtn = document.getElementById('profileBtn');
const profileModal = document.getElementById('profileModal');
const closeProfile = document.getElementById('closeProfile');
const myAvatar = document.getElementById('myAvatar');
const profilePreviewAvatar = document.getElementById('profilePreviewAvatar');
const profileUsername = document.getElementById('profileUsername');
const avatarInput = document.getElementById('avatarInput');
const profileLogout = document.getElementById('profileLogout');
const confirmModal = document.getElementById('confirmModal');

const usersList = document.getElementById('usersList');
const chatHeader = document.querySelector('.chat-header');
const emptyState = document.getElementById('emptyState');
const messagesList = document.getElementById('messages');
const chatForm = document.getElementById('form');
const inputMsg = document.getElementById('input');
const chatTitle = document.getElementById('chatTitle');
const currentChatAvatar = document.getElementById('currentChatAvatar');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const btnImage = document.getElementById('btnImage');
const chatImageInput = document.getElementById('chatImageInput');
const backBtn = document.getElementById('backBtn');
const chatContainer = document.querySelector('.chat-container');

const msgContextMenu = document.getElementById('msgContextMenu');
const ctxDeleteBtn = document.getElementById('ctxDeleteBtn');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDelete');

const headerAvatarBtn = document.getElementById('headerAvatarBtn');
const contactInfoModal = document.getElementById('contactInfoModal');
const closeContactInfo = document.getElementById('closeContactInfo');
const contactInfoAvatar = document.getElementById('contactInfoAvatar');
const contactInfoName = document.getElementById('contactInfoName');
const contactRealUsername = document.getElementById('contactRealUsername');
const nicknameInput = document.getElementById('nicknameInput');
const saveNicknameBtn = document.getElementById('saveNicknameBtn');

// Elementos Reply
const inputStack = document.getElementById('inputStack');
const replyPreview = document.getElementById('replyPreview');
const replyToName = document.getElementById('replyToName');
const replyToText = document.getElementById('replyToText');
const replyToImagePreview = document.getElementById('replyToImagePreview');
const closeReplyBtn = document.getElementById('closeReplyBtn');

// Elementos Stickers
const btnStickers = document.getElementById('btnStickers');
const stickerPanel = document.getElementById('stickerPanel');
const stickerSearch = document.getElementById('stickerSearch');
const stickerResults = document.getElementById('stickerResults');
// Referencias DOM adicionales para Pestañas de Favoritos
const tabGiphy = document.getElementById('tabGiphy');
const tabFavs = document.getElementById('tabFavs');
const stickerHeaderSearch = document.getElementById('stickerHeaderSearch');

// --- NUEVO: Elementos Modal Opciones Sticker (Menu al tocar) ---
const stickerOptionsModal = document.getElementById('stickerOptionsModal');
const stickerModalBackdrop = document.getElementById('stickerModalBackdrop');
const stickerModalPreview = document.getElementById('stickerModalPreview');
const btnStickerFavAction = document.getElementById('btnStickerFavAction');
const stickerFavIcon = document.getElementById('stickerFavIcon');
const stickerFavText = document.getElementById('stickerFavText');
const btnStickerClose = document.getElementById('btnStickerClose');
let currentStickerUrlInModal = null; // Para saber qué sticker estamos viendo

// --- ELEMENTOS DE AUDIO ---
const mainActionBtn = document.getElementById('mainActionBtn');
const recordingUI = document.getElementById('recordingUI');
const recordingTimer = document.getElementById('recordingTimer');
const cancelRecordingBtn = document.getElementById('cancelRecordingBtn');

const SEND_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
const MIC_ICON = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;

let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let isRecording = false;
let shouldSendAudio = true;

// Estado Stickers
let currentStickerTab = 'giphy'; // 'giphy' | 'favorites'
let myFavorites = new Set(); // Cache local de favoritos

// --- INICIALIZACIÓN ---
if(saved) {
    loginSuccess(JSON.parse(saved));
}

function loginSuccess(user) {
    myUser = user;
    profileBtn.classList.remove('hidden');
    updateMyAvatarUI(myUser.avatar);
    socket.auth = { userId: myUser.id, username: myUser.username };
    socket.connect();
    // Inicializar estado botón
    updateButtonState();
    
    // Cargar favoritos al inicio para tener la cache lista
    refreshFavoritesCache();
}

// --- LOGOUT ---
profileLogout.addEventListener('click', () => { profileModal.classList.add('hidden'); confirmModal.classList.remove('hidden'); });
document.getElementById('confirmYes').addEventListener('click', () => { 
    localStorage.removeItem('chatUser'); 
    window.location.href = '/login.html'; 
});
document.getElementById('confirmNo').addEventListener('click', () => { confirmModal.classList.add('hidden'); profileModal.classList.remove('hidden'); });

// --- SOCKET LISTENERS ---
socket.on('nicknames', (map) => {
    myNicknames = map;
    if(allUsersCache.length > 0) renderUserList(allUsersCache);
    if(currentTargetUserObj) {
        const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.username;
        chatTitle.textContent = displayName;
    }
});

profileBtn.addEventListener('click', () => {
    profileUsername.textContent = myUser.username;
    profileModal.classList.remove('hidden');
});
closeProfile.addEventListener('click', () => profileModal.classList.add('hidden'));

avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', myUser.id);
    const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
    if(res.ok) {
        // La actualización ahora vendrá por el socket 'user_updated_profile' también para mí
        const data = await res.json();
    }
});

function updateMyAvatarUI(url) {
    const css = url ? `url('${url}')` : '';
    myAvatar.style.backgroundImage = css;
    profilePreviewAvatar.style.backgroundImage = css;
}

// Contact Info
headerAvatarBtn.addEventListener('click', () => {
    if(!currentTargetUserObj) return;
    const displayName = myNicknames[currentTargetUserObj.userId] || currentTargetUserObj.username;
    contactInfoName.textContent = displayName;
    contactRealUsername.textContent = `@${currentTargetUserObj.username}`;
    nicknameInput.value = myNicknames[currentTargetUserObj.userId] || "";
    const css = currentTargetUserObj.avatar ? `url('${currentTargetUserObj.avatar}')` : '';
    contactInfoAvatar.style.backgroundImage = css;
    contactInfoModal.classList.remove('hidden');
});
closeContactInfo.addEventListener('click', () => contactInfoModal.classList.add('hidden'));
saveNicknameBtn.addEventListener('click', () => {
    if(!currentTargetUserObj) return;
    const newNickname = nicknameInput.value.trim();
    socket.emit('set nickname', { targetUserId: currentTargetUserObj.userId, nickname: newNickname });
    if(newNickname) myNicknames[currentTargetUserObj.userId] = newNickname;
    else delete myNicknames[currentTargetUserObj.userId];
    const displayName = newNickname || currentTargetUserObj.username;
    contactInfoName.textContent = displayName;
    chatTitle.textContent = displayName;
    renderUserList(allUsersCache);
    contactInfoModal.classList.add('hidden');
});

// --- STICKERS PANEL LOGIC ---
if(tabGiphy && tabFavs) {
    tabGiphy.addEventListener('click', () => switchStickerTab('giphy'));
    tabFavs.addEventListener('click', () => switchStickerTab('favorites'));
}

function switchStickerTab(tab) {
    currentStickerTab = tab;
    
    // UI Update
    if (tab === 'giphy') {
        tabGiphy.classList.add('active');
        tabFavs.classList.remove('active');
        if(stickerHeaderSearch) stickerHeaderSearch.classList.remove('hidden');
        loadStickers(stickerSearch.value); 
    } else {
        tabGiphy.classList.remove('active');
        tabFavs.classList.add('active');
        if(stickerHeaderSearch) stickerHeaderSearch.classList.add('hidden');
        loadFavoritesFromServer(); 
    }
}

btnStickers.addEventListener('click', () => {
    stickerPanel.classList.toggle('hidden');
    if(!stickerPanel.classList.contains('hidden')) {
        // Al abrir, refrescar caché de favoritos
        refreshFavoritesCache().then(() => {
            if (currentStickerTab === 'giphy') {
                loadStickers();
                stickerSearch.focus();
            } else {
                loadFavoritesFromServer();
            }
        });
    }
});

document.addEventListener('click', (e) => {
    if (!stickerPanel.contains(e.target) && !btnStickers.contains(e.target)) {
        stickerPanel.classList.add('hidden');
    }
});

let searchTimeout;
stickerSearch.addEventListener('input', (e) => {
    if (currentStickerTab !== 'giphy') return;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = e.target.value;
        if(query.length > 0) loadStickers(query);
        else loadStickers(); 
    }, 500);
});

async function refreshFavoritesCache() {
    try {
        const res = await fetch(`/api/favorites/${myUser.id}`);
        if(res.ok) {
            const list = await res.json();
            myFavorites = new Set(list);
        }
    } catch (e) { console.error("Error cargando favs cache", e); }
}

async function loadStickers(query = '') {
    stickerResults.innerHTML = '<div class="loading-stickers">Cargando...</div>';
    if(GIPHY_API_KEY === 'TU_API_KEY_AQUI') {
        stickerResults.innerHTML = '<div class="loading-stickers">Falta API Key de Giphy</div>';
        return;
    }
    let url;
    if (query) {
        url = `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_API_KEY}&q=${query}&limit=24&rating=g`;
    } else {
        url = `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`;
    }
    try {
        const res = await fetch(url);
        const data = await res.json();
        const items = data.data.map(item => ({
            url: item.images.fixed_height.url,
            thumb: item.images.fixed_height_small.url
        }));
        renderStickersGrid(items);
    } catch (err) {
        console.error("Error Giphy:", err);
        stickerResults.innerHTML = '<div class="loading-stickers">Error al cargar</div>';
    }
}

async function loadFavoritesFromServer() {
    stickerResults.innerHTML = '<div class="loading-stickers">Cargando favoritos...</div>';
    await refreshFavoritesCache(); 

    if (myFavorites.size === 0) {
        stickerResults.innerHTML = '<div class="loading-stickers">Aún no tienes stickers favoritos.</div>';
        return;
    }

    const items = Array.from(myFavorites).map(url => ({
        url: url,
        thumb: url 
    }));
    renderStickersGrid(items);
}

function renderStickersGrid(items) {
    stickerResults.innerHTML = '';
    if(!items || items.length === 0) {
        stickerResults.innerHTML = '<div class="loading-stickers">No se encontraron resultados</div>';
        return;
    }

    items.forEach(item => {
        // Wrapper para posicionar la estrella
        const wrapper = document.createElement('div');
        wrapper.className = 'sticker-item-wrapper';
        
        // Imagen
        const img = document.createElement('img');
        img.src = item.thumb; 
        img.className = 'sticker-thumb';
        img.loading = "lazy";
        
        // Acción click en imagen: Enviar sticker al chat
        img.addEventListener('click', () => {
            sendSticker(item.url);
            stickerPanel.classList.add('hidden');
        });

        // Botón Estrella (en el panel)
        const starBtn = document.createElement('button');
        starBtn.className = 'fav-action-btn';
        starBtn.innerHTML = '★'; 
        
        if (myFavorites.has(item.url)) starBtn.classList.add('is-fav');

        // Acción click en estrella: Toggle Fav
        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavoriteSticker(item.url, starBtn, wrapper);
        });

        wrapper.appendChild(img);
        wrapper.appendChild(starBtn);
        stickerResults.appendChild(wrapper);
    });
}

// Función compartida para agregar/quitar
async function toggleFavoriteSticker(url, btnElement = null, wrapperElement = null) {
    const isFav = myFavorites.has(url);
    if (isFav) {
        // Eliminar
        try {
            const res = await fetch('/api/favorites/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: myUser.id, url: url })
            });
            if (res.ok) {
                myFavorites.delete(url);
                if(btnElement) btnElement.classList.remove('is-fav');
                // Si estamos en la pestaña favoritos del panel, quitar elemento
                if (currentStickerTab === 'favorites' && wrapperElement) {
                    wrapperElement.remove();
                    if (myFavorites.size === 0) {
                        stickerResults.innerHTML = '<div class="loading-stickers">Aún no tienes stickers favoritos.</div>';
                    }
                }
            }
        } catch (e) { console.error(e); }
    } else {
        // Agregar
        try {
            const res = await fetch('/api/favorites/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: myUser.id, url: url })
            });
            if (res.ok) {
                myFavorites.add(url);
                if(btnElement) btnElement.classList.add('is-fav');
            }
        } catch (e) { console.error(e); }
    }
}

function sendSticker(url) {
    sendMessage(url, 'sticker', currentReplyId);
    clearReply();
}

// --- LOGICA MODAL OPCIONES STICKER (Menu al tocar en chat) ---

function openStickerOptions(url) {
    currentStickerUrlInModal = url;
    stickerModalPreview.src = url;

    // Verificar si ya es favorito para cambiar el texto del botón
    const isFav = myFavorites.has(url);
    updateFavButtonUI(isFav);

    stickerOptionsModal.classList.remove('hidden');
}

function closeStickerOptions() {
    stickerOptionsModal.classList.add('hidden');
    currentStickerUrlInModal = null;
}

function updateFavButtonUI(isFav) {
    if (isFav) {
        stickerFavIcon.textContent = '★';
        stickerFavText.textContent = 'Eliminar de favoritos';
        btnStickerFavAction.classList.add('is-favorite');
    } else {
        stickerFavIcon.textContent = '☆';
        stickerFavText.textContent = 'Añadir a favoritos';
        btnStickerFavAction.classList.remove('is-favorite');
    }
}

// Event Listeners del Modal
if(stickerModalBackdrop) stickerModalBackdrop.addEventListener('click', closeStickerOptions);
if(btnStickerClose) btnStickerClose.addEventListener('click', closeStickerOptions);

// Acción Botón Favorito en el Modal
if(btnStickerFavAction) {
    btnStickerFavAction.addEventListener('click', async () => {
        if (!currentStickerUrlInModal) return;
        
        // Llamamos a la lógica toggle (sin elementos de UI del panel, null null)
        await toggleFavoriteSticker(currentStickerUrlInModal, null, null);
        
        // Actualizamos UI del botón del modal
        const isFavNow = myFavorites.has(currentStickerUrlInModal);
        updateFavButtonUI(isFavNow);
        
        // Cerramos tras breve delay
        setTimeout(closeStickerOptions, 200);
    });
}

// --- REPLY ---
function setReply(msgId, content, type, ownerId) {
    currentReplyId = msgId;
    
    let name = "Usuario";
    if(ownerId == myUser.id) name = "Tú";
    else if(myNicknames[ownerId]) name = myNicknames[ownerId];
    else {
        const u = allUsersCache.find(u => u.userId == ownerId);
        if(u) name = u.username;
    }

    replyToName.textContent = name;
    
    if(type === 'image') {
        replyToText.innerHTML = `<svg viewBox="0 0 24 24" height="20" width="18" preserveAspectRatio="xMidYMid meet" class="" fill="none"><title>image-refreshed</title><path d="M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM5 19H19V5H5V19ZM7 17H17C17.2 17 17.35 16.9083 17.45 16.725C17.55 16.5417 17.5333 16.3667 17.4 16.2L14.65 12.525C14.55 12.3917 14.4167 12.325 14.25 12.325C14.0833 12.325 13.95 12.3917 13.85 12.525L11.25 16L9.4 13.525C9.3 13.3917 9.16667 13.325 9 13.325C8.83333 13.325 8.7 13.3917 8.6 13.525L6.6 16.2C6.46667 16.3667 6.45 16.5417 6.55 16.725C6.65 16.9083 6.8 17 7 17Z" fill="currentColor"></path></svg> Foto`;
        replyToImagePreview.style.backgroundImage = `url('${content}')`;
        replyToImagePreview.classList.remove('hidden');
    } else if (type === 'sticker') {
       replyToImagePreview.classList.add('hidden');
       replyToImagePreview.style.backgroundImage = 'none';
       replyToText.innerHTML = `<img src="${content}" class="reply-sticker-preview">`;
    } else if (type === 'audio') {
       replyToText.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> Mensaje de voz`;
       replyToImagePreview.classList.add('hidden');
    } else {
        replyToText.textContent = content;
        replyToImagePreview.classList.add('hidden');
    }

    replyPreview.classList.remove('hidden');
    if(inputStack) inputStack.classList.add('active'); 
    inputMsg.focus();
}

function clearReply() {
    currentReplyId = null;
    replyPreview.classList.add('hidden');
    if(inputStack) inputStack.classList.remove('active');
}
closeReplyBtn.addEventListener('click', clearReply);

// --- IMAGES ---
btnImage.addEventListener('click', () => chatImageInput.click());
chatImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch('/api/upload-chat-image', { method: 'POST', body: formData });
        if (res.ok) {
            const data = await res.json();
            sendMessage(data.imageUrl, 'image', currentReplyId);
            clearReply();
        }
    } catch (error) { console.error(error); }
    chatImageInput.value = '';
});

// --- USER LIST ---
socket.on('users', (users) => {
    allUsersCache = users;
    renderUserList(users);
});
function renderUserList(users) {
    usersList.innerHTML = '';
    users.sort((a, b) => (a.online === b.online) ? 0 : a.online ? -1 : 1);
    users.forEach(u => {
        if(u.userId === myUser.id) return;
        const li = document.createElement('li');
        li.className = 'user-item';
        if (!u.online) li.classList.add('offline');
        li.dataset.uid = u.userId; 
        if(currentTargetUserId === u.userId) li.classList.add('active');
        const avatarStyle = u.avatar ? `background-image: url('${u.avatar}')` : '';
        const statusText = u.online ? 'En línea' : 'Desconectado';
        const statusColor = u.online ? '#4ade80' : '#a1a1aa';
        const displayName = myNicknames[u.userId] || u.username;
        li.innerHTML = `
            <div class="u-avatar" style="${avatarStyle}">
                <div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:${statusColor};border:2px solid #18181b;"></div>
            </div>
            <div style="overflow:hidden;">
                <div style="font-weight:600; color: ${u.online ? '#fff' : '#bbb'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</div>
                <div style="font-size:12px; color:${statusColor}">${statusText}</div>
            </div>
        `;
        li.addEventListener('click', () => selectUser(u, li));
        usersList.appendChild(li);
    });
}

// --- ACTUALIZACIÓN DE PERFIL EN TIEMPO REAL ---
socket.on('user_updated_profile', ({ userId, avatar }) => {
    // 1. Actualizar caché local de usuarios para futuras renderizaciones
    const cachedUser = allUsersCache.find(u => u.userId == userId);
    if (cachedUser) {
        cachedUser.avatar = avatar;
    }

    // 2. Si soy yo el que se actualizó
    if (myUser && myUser.id == userId) {
        myUser.avatar = avatar;
        localStorage.setItem('chatUser', JSON.stringify(myUser)); // Persistir
        updateMyAvatarUI(avatar);
    }

    // 3. Actualizar la lista lateral (Sidebar) QUIRÚRGICAMENTE
    // Buscamos el elemento específico por su data-uid
    const sidebarAvatarItem = document.querySelector(`.user-item[data-uid="${userId}"] .u-avatar`);
    if (sidebarAvatarItem) {
        sidebarAvatarItem.style.backgroundImage = `url('${avatar}')`;
    }

    // 4. Actualizar la cabecera del chat (si estoy hablando con esa persona)
    if (currentTargetUserObj && currentTargetUserObj.userId == userId) {
        currentTargetUserObj.avatar = avatar; // Actualizar obj actual
        const currentHeaderAvatar = document.getElementById('currentChatAvatar');
        if (currentHeaderAvatar) {
            currentHeaderAvatar.style.backgroundImage = `url('${avatar}')`;
        }
    }

    // 5. Actualizar avatares en el historial de mensajes (Mensajes de Audio)
    if (myUser.id == userId) {
        // Actualizar mis avatares en mensajes de audio
        document.querySelectorAll('.message.me .audio-avatar-img').forEach(img => {
            img.src = avatar;
        });
    } else if (currentTargetUserId == userId) {
        // Actualizar sus avatares en mensajes de audio
        document.querySelectorAll('.message.other .audio-avatar-img').forEach(img => {
            img.src = avatar;
        });
    }
});

async function selectUser(targetUser, elem) {
    currentTargetUserId = targetUser.userId;
    currentTargetUserObj = targetUser;
    clearReply(); 
    
    const displayName = myNicknames[targetUser.userId] || targetUser.username;
    chatTitle.textContent = displayName;
    chatContainer.classList.add('mobile-chat-active');
    const css = targetUser.avatar ? `url('${targetUser.avatar}')` : '';
    currentChatAvatar.style.backgroundImage = css;
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    if(elem) elem.classList.add('active');
    else {
        const found = document.querySelector(`.user-item[data-uid="${targetUser.userId}"]`);
        if(found) found.classList.add('active');
    }
    emptyState.classList.add('hidden');
    chatHeader.classList.remove('hidden');
    messagesList.classList.remove('hidden');
    chatForm.classList.remove('hidden');
    messagesList.innerHTML = '<li style="text-align:center;color:#666;font-size:12px">Cargando historial...</li>';
    try {
        const res = await fetch(`/api/messages/${myUser.id}/${targetUser.userId}`);
        const history = await res.json();
        messagesList.innerHTML = '';
        history.forEach(msg => {
            const type = (msg.from_user_id === myUser.id) ? 'me' : 'other';
            
            let replyData = null;
            if(msg.reply_to_id) {
                let rName = "Usuario";
                if (msg.reply_from_id === myUser.id) rName = "Tú";
                else if (msg.reply_from_id === currentTargetUserId) rName = displayName;
                else if (myNicknames[msg.reply_from_id]) rName = myNicknames[msg.reply_from_id];

                let rContent = msg.reply_content;
                if(msg.reply_type === 'image') rContent = `<svg viewBox="0 0 24 24" height="20" width="18" preserveAspectRatio="xMidYMid meet" class="" fill="none"><title>image-refreshed</title><path d="M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H19C19.55 3 20.0208 3.19583 20.4125 3.5875C20.8042 3.97917 21 4.45 21 5V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM5 19H19V5H5V19ZM7 17H17C17.2 17 17.35 16.9083 17.45 16.725C17.55 16.5417 17.5333 16.3667 17.4 16.2L14.65 12.525C14.55 12.3917 14.4167 12.325 14.25 12.325C14.0833 12.325 13.95 12.3917 13.85 12.525L11.25 16L9.4 13.525C9.3 13.3917 9.16667 13.325 9 13.325C8.83333 13.325 8.7 13.3917 8.6 13.525L6.6 16.2C6.46667 16.3667 6.45 16.5417 6.55 16.725C6.65 16.9083 6.8 17 7 17Z" fill="currentColor"></path></svg> Foto`;
                else if(msg.reply_type === 'audio') rContent = `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> Mensaje de voz`;

                replyData = { username: rName, content: rContent };
            }
            appendMessageUI(msg.content, type, msg.timestamp, msg.id, msg.type, replyData);
        });
        messagesList.scrollTop = messagesList.scrollHeight;
    } catch (err) { 
        console.error(err);
        messagesList.innerHTML = '<li style="text-align:center;color:red">Error cargando mensajes</li>'; 
    }
}
backBtn.addEventListener('click', () => chatContainer.classList.remove('mobile-chat-active'));

// --- AUDIO LOGIC & BUTTON CONTROL ---

// 1. Estado del botón
function updateButtonState() {
    if (isRecording) {
        mainActionBtn.innerHTML = SEND_ICON;
    } else {
        const hasText = inputMsg.value.trim().length > 0;
        mainActionBtn.innerHTML = hasText ? SEND_ICON : MIC_ICON;
    }
}

// 2. Event Listener Input
inputMsg.addEventListener('input', () => {
    updateButtonState();
    if(currentTargetUserId) socket.emit('typing', { toUserId: currentTargetUserId });
});

// 3. Event Listener Botón Principal
mainActionBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    if (isRecording) {
        stopRecording();
        return;
    }

    const text = inputMsg.value.trim();
    if (text.length > 0) {
        sendMessage(text, 'text', currentReplyId);
        inputMsg.value = '';
        clearReply();
        socket.emit('stop typing', { toUserId: currentTargetUserId });
        updateButtonState(); 
        return;
    }

    // Input vacío -> Grabar
    startRecording();
});

// 4. Funciones de Grabación
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            if (shouldSendAudio) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await uploadAudio(audioBlob);
            }
            stream.getTracks().forEach(track => track.stop());
        };

        // UI
        isRecording = true;
        shouldSendAudio = true;
        inputStack.classList.add('recording');
        recordingUI.classList.remove('hidden');
        updateButtonState();
        
        // Timer
        let seconds = 0;
        recordingTimer.innerText = "0:00";
        recordingInterval = setInterval(() => {
            seconds++;
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            recordingTimer.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }, 1000);

        mediaRecorder.start();

    } catch (err) {
        console.error("Error al acceder al micrófono:", err);
        alert("No se pudo acceder al micrófono.");
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        resetRecordingUI();
    }
}

cancelRecordingBtn.addEventListener('click', () => {
    shouldSendAudio = false;
    stopRecording();
});

function resetRecordingUI() {
    isRecording = false;
    clearInterval(recordingInterval);
    inputStack.classList.remove('recording');
    recordingUI.classList.add('hidden');
    updateButtonState();
}

async function uploadAudio(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm'); 
    try {
        const res = await fetch('/api/upload-audio', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            sendMessage(data.audioUrl, 'audio', currentReplyId);
            clearReply();
        } 
    } catch (err) { console.error(err); }
}

// --- SEND & RECEIVE ---

function sendMessage(content, type, replyId = null) {
    if(!currentTargetUserId) return;
    socket.emit('private message', { content, toUserId: currentTargetUserId, type, replyToId: replyId }, (response) => {
        if (response && response.id) {
            let replyData = null;
            if(replyId) {
                replyData = { 
                    username: replyToName.textContent, 
                    content: replyToText.textContent 
                };
            }
            appendMessageUI(content, 'me', new Date(), response.id, type, replyData);
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    });
}

socket.on('private message', ({ id, content, fromUserId, timestamp, type, replyToId, reply_content, reply_type, reply_from_id }) => {
    if (currentTargetUserId === fromUserId) {
        let replyData = null;
        if(replyToId) {
            let rName = "Usuario";
            if (reply_from_id === myUser.id) rName = "Tú";
            else if (myNicknames[reply_from_id]) rName = myNicknames[reply_from_id];
            else if (allUsersCache.find(u => u.userId == reply_from_id)) rName = allUsersCache.find(u => u.userId == reply_from_id).username;

            let rText = reply_content;
            if (reply_type === 'image') rText = "📷 Foto";
            else if (reply_type === 'sticker') rText = "✨ Sticker";
            else if(msg.reply_type === 'audio') rContent = `<svg viewBox="0 0 15 15" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> Mensaje de voz`;

            replyData = { username: rName, content: rText };
        }
        appendMessageUI(content, 'other', timestamp, id, type || 'text', replyData);
        messagesList.scrollTop = messagesList.scrollHeight;
    } 
});

socket.on('message deleted', ({ messageId }) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
        const row = el.closest('.message-row');
        if(row) {
            row.style.transition = "opacity 0.3s, transform 0.3s";
            row.style.opacity = "0";
            setTimeout(() => row.remove(), 300);
        }
    }
});

// --- RENDER MESSAGE UI (UPDATED FOR AUDIO & CLICKABLE STICKERS + SKELETON LOADING) ---
function appendMessageUI(content, ownerType, dateStr, msgId, msgType = 'text', replyData = null) {
    const li = document.createElement('li');
    li.className = `message-row ${ownerType}`;
    
    if(msgType === 'sticker') li.classList.add('sticker-wrapper');

    li.id = `row-${msgId}`;
    const ownerId = (ownerType === 'me') ? myUser.id : currentTargetUserId;
    
    // HTML del Reply
    let quoteHtml = '';
    if(replyData) {
        quoteHtml = `
            <div class="quoted-message">
                <div class="quoted-name">${replyData.username}</div>
                <div class="quoted-text">${replyData.content}</div>
            </div>`;
    }

    let bodyHtml = '';

    // --- LÓGICA DE AUDIO PERSONALIZADO ---
     if (msgType === 'audio') {
        // CAMBIO: Usamos profile.png en lugar del SVG base64
        const defaultAvatar = '/profile.png';
        
        const avatarUrl = (ownerType === 'me') 
            ? (myUser.avatar || defaultAvatar) 
            : (currentTargetUserObj.avatar || defaultAvatar);

        const uniqueAudioId = `audio-${msgId}-${Date.now()}`;
        
        const msgDateObj = new Date(dateStr);
        const msgTimeStr = msgDateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        bodyHtml = `
            <div class="custom-audio-player">
                <img src="${avatarUrl}" class="audio-avatar-img" alt="Avatar" onerror="this.style.display='none'">
                <audio id="${uniqueAudioId}" src="${content}" preload="metadata" class="hidden-audio-element"></audio>
                <button class="audio-control-btn" id="btn-${uniqueAudioId}">
                    <svg viewBox="0 0 34 34" height="34" width="34" preserveAspectRatio="xMidYMid meet" class="" version="1.1" x="0px" y="0px" enable-background="new 0 0 34 34"><title>audio-play</title><path fill="currentColor" d="M8.5,8.7c0-1.7,1.2-2.4,2.6-1.5l14.4,8.3c1.4,0.8,1.4,2.2,0,3l-14.4,8.3 c-1.4,0.8-2.6,0.2-2.6-1.5V8.7z"></path></svg>
                </button>
                <div class="audio-right-col">
                    <div class="audio-slider-container">
                        <div class="waveform-bg"></div>
                        <div class="waveform-fill" id="fill-${uniqueAudioId}"></div>
                        <input type="range" class="audio-slider" id="slider-${uniqueAudioId}" value="0" min="0" step="0.1">
                    </div>
                    <div class="audio-meta-row">
                        <span class="audio-duration" id="time-${uniqueAudioId}">0:00</span>
                        <span class="audio-msg-time">${msgTimeStr}</span>
                    </div>
                </div>
            </div>
        `;
        setTimeout(() => initAudioPlayer(uniqueAudioId), 0);
    } 
    // --- LÓGICA DE IMAGEN CON SKELETON LOADING ---
    else if (msgType === 'image') {
        bodyHtml = `
            <div class="chat-image-container skeleton-wrapper image-skeleton">
                <img src="${content}" 
                     class="chat-image hidden-media" 
                     loading="lazy" 
                     onclick="viewFullImage(this.src)"
                     onload="this.classList.remove('hidden-media'); this.classList.add('visible-media'); this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('image-skeleton', 'skeleton-wrapper');">
            </div>`;
    } 
    // --- LÓGICA DE STICKER CON SKELETON LOADING ---
    else if (msgType === 'sticker') {
        bodyHtml = `
            <div class="skeleton-wrapper sticker-skeleton">
                <img src="${content}" 
                     class="sticker-img hidden-media" 
                     data-url="${content}" 
                     alt="sticker"
                     onload="this.classList.remove('hidden-media'); this.classList.add('visible-media'); this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('sticker-skeleton', 'skeleton-wrapper');">
            </div>`;
    }
    else {
        bodyHtml = `<span>${content}</span>`;
    }

    const date = new Date(dateStr);
    const time = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    const metaStyle = (msgType === 'audio') ? 'display: none !important;' : '';

    li.innerHTML = `
        <div class="swipe-reply-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 14 4 9 9 4"></polyline>
                <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
            </svg>
        </div>
        <div class="message-content-wrapper message ${ownerType}" id="msg-${msgId}">
            ${quoteHtml}
            ${bodyHtml}
            <div class="meta-row" style="${metaStyle}"><span class="meta">${time}</span></div>
        </div>
    `;

    messagesList.appendChild(li);

    // --- AGREGAR LISTENER DE CLICK AL STICKER RENDERIZADO ---
    if (msgType === 'sticker') {
        const renderedImg = li.querySelector('.sticker-img');
        if (renderedImg) {
            renderedImg.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar propagación a eventos del contenedor
                // Si la cache está vacía, la llenamos antes de abrir el modal para que el estado de favorito sea correcto
                if (myFavorites.size === 0) {
                    refreshFavoritesCache().then(() => openStickerOptions(content));
                } else {
                    openStickerOptions(content);
                }
            });
        }
    }

    const wrapper = li.querySelector('.message-content-wrapper');
    if (ownerType === 'me') addLongPressEvent(wrapper, msgId);
    addSwipeEvent(li, wrapper, msgId, content, msgType, ownerId);
}

window.viewFullImage = function(src) {
    const modal = document.createElement('div');
    modal.className = 'fullscreen-img-modal';
    modal.innerHTML = `<img src="${src}" class="fullscreen-img">`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
}

// --- GESTOS ---
function addSwipeEvent(row, wrapper, msgId, content, type, ownerId) {
    const icon = row.querySelector('.swipe-reply-icon');
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;
    const THRESHOLD = 70;

    wrapper.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isSwiping = true;
        wrapper.style.transition = 'none';
        icon.style.transition = 'none';
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const diff = e.touches[0].clientX - startX;
        
        if (diff > 0 && diff < 200) { 
            currentX = diff;
            wrapper.style.transform = `translateX(${currentX}px)`;
            const progress = Math.min(currentX / THRESHOLD, 1);
            icon.style.opacity = progress;
            icon.style.transform = `translateY(-50%) scale(${0.5 + (progress * 0.5)})`;
            icon.style.left = '10px';
        }
    }, { passive: true });

    const endSwipe = () => {
        if (!isSwiping) return;
        isSwiping = false;
        
        wrapper.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
        icon.style.transition = 'all 0.2s';

        if (currentX >= THRESHOLD) {
            if(navigator.vibrate) navigator.vibrate(30);
            setReply(msgId, content, type, ownerId);
        }

        wrapper.style.transform = 'translateX(0)';
        icon.style.opacity = '0';
        icon.style.transform = 'translateY(-50%) scale(0.5)';
        currentX = 0;
    };
    wrapper.addEventListener('touchend', endSwipe);
    wrapper.addEventListener('touchcancel', endSwipe);
}

function addLongPressEvent(element, msgId) {
    let pressTimer;
    const LONG_PRESS_DURATION = 600; 
    const startPress = (e) => {
        if (element.style.transform && element.style.transform !== 'translateX(0px)') return;
        element.classList.add('pressing');
        let cx = e.clientX || (e.touches && e.touches[0].clientX);
        let cy = e.clientY || (e.touches && e.touches[0].clientY);
        pressTimer = setTimeout(() => openContextMenu(cx, cy, msgId), LONG_PRESS_DURATION);
    };
    const cancelPress = () => { clearTimeout(pressTimer); element.classList.remove('pressing'); };
    element.addEventListener('mousedown', (e) => { if(e.button === 0) startPress(e); });
    element.addEventListener('mouseup', cancelPress);
    element.addEventListener('mouseleave', cancelPress);
    element.addEventListener('touchstart', startPress, { passive: true });
    element.addEventListener('touchend', cancelPress);
    element.addEventListener('touchmove', cancelPress);
}

function openContextMenu(x, y, msgId) {
    messageIdToDelete = msgId;
    const menuContent = msgContextMenu.querySelector('.context-menu-content');
    msgContextMenu.classList.remove('hidden');
    let top = y, left = x;
    if (window.innerWidth <= 768) {
        menuContent.style.position = 'fixed';
        menuContent.style.top = '50%'; menuContent.style.left = '50%';
        menuContent.style.transform = 'translate(-50%, -50%)';
    } else {
        menuContent.style.position = 'absolute';
        menuContent.style.transform = 'none';
        if (x + 200 > window.innerWidth) left = x - 200;
        if (y + 100 > window.innerHeight) top = y - 100;
        menuContent.style.top = `${top}px`; menuContent.style.left = `${left}px`;
    }
}
msgContextMenu.addEventListener('click', (e) => {
    if (e.target === msgContextMenu) { msgContextMenu.classList.add('hidden'); messageIdToDelete = null; }
});
ctxDeleteBtn.addEventListener('click', () => {
    msgContextMenu.classList.add('hidden'); deleteConfirmModal.classList.remove('hidden');
});
cancelDeleteBtn.addEventListener('click', () => {
    deleteConfirmModal.classList.add('hidden'); messageIdToDelete = null;
});
confirmDeleteBtn.addEventListener('click', () => {
    if (messageIdToDelete && currentTargetUserId) {
        socket.emit('delete message', { messageId: messageIdToDelete, toUserId: currentTargetUserId });
    }
    deleteConfirmModal.classList.add('hidden'); messageIdToDelete = null;
});

socket.on('typing', ({ fromUserId, username }) => {
    if(fromUserId === currentTargetUserId) {
        const name = myNicknames[fromUserId] || username;
        typingText.textContent = `${name} está escribiendo...`;
        typingIndicator.classList.remove('hidden');
    }
});
socket.on('stop typing', ({ fromUserId }) => {
    if(fromUserId === currentTargetUserId) typingIndicator.classList.add('hidden');
});
// --- LÓGICA DEL REPRODUCTOR DE AUDIO ---
function initAudioPlayer(audioId) {
    const audio = document.getElementById(audioId);
    const btn = document.getElementById(`btn-${audioId}`);
    const slider = document.getElementById(`slider-${audioId}`);
    const fillBar = document.getElementById(`fill-${audioId}`); // El div de las ondas coloreadas
    const timeDisplay = document.getElementById(`time-${audioId}`);
    
    if(!audio || !btn || !slider || !fillBar) return;

    const PLAY_ICON = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const PAUSE_ICON = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

    const formatTime = (secs) => {
        if(isNaN(secs)) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Función para actualizar visualmente las ondas
    const updateWaveform = () => {
        const val = slider.value;
        const max = slider.max || 100;
        const percentage = (val / max) * 100;
        fillBar.style.width = `${percentage}%`;
    };

    audio.addEventListener('loadedmetadata', () => {
        slider.max = audio.duration;
        timeDisplay.innerText = formatTime(audio.duration);
    });

    if (audio.readyState >= 1) {
        slider.max = audio.duration;
        timeDisplay.innerText = formatTime(audio.duration);
    }

    btn.addEventListener('click', () => {
        // Pausar otros
        document.querySelectorAll('audio').forEach(a => {
            if(a !== audio) {
                a.pause();
                const otherId = a.id.replace('audio-', ''); 
                const otherBtn = document.getElementById(`btn-${a.id}`);
                if(otherBtn) otherBtn.innerHTML = PLAY_ICON;
            }
        });

        if (audio.paused) {
            audio.play();
            btn.innerHTML = PAUSE_ICON;
        } else {
            audio.pause();
            btn.innerHTML = PLAY_ICON;
        }
    });

    audio.addEventListener('timeupdate', () => {
        slider.value = audio.currentTime;
        timeDisplay.innerText = formatTime(audio.currentTime); 
        updateWaveform();
    });

    slider.addEventListener('input', () => {
        audio.currentTime = slider.value;
        timeDisplay.innerText = formatTime(slider.value);
        updateWaveform();
    });

    audio.addEventListener('ended', () => {
        btn.innerHTML = PLAY_ICON;
        slider.value = 0;
        audio.currentTime = 0;
        timeDisplay.innerText = formatTime(audio.duration);
        updateWaveform();
    });
}