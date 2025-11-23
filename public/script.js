const socket = io({ autoConnect: false });

// --- REDIRECCIÓN DE SEGURIDAD ---
// Si no hay usuario en localStorage, ir al login
const saved = localStorage.getItem('chatUser');
if(!saved) {
    window.location.href = '/login.html';
}

// --- Variables de Estado ---
let myUser = null;
let currentTargetUserId = null;
let currentTargetUserObj = null; 
let messageIdToDelete = null;
let myNicknames = {}; 
let allUsersCache = []; 

// --- Elementos DOM ---
// (Ya no buscamos los elementos del form login aquí porque están en login.html)
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
}

// --- LOGOUT (Redirección) ---
profileLogout.addEventListener('click', () => { profileModal.classList.add('hidden'); confirmModal.classList.remove('hidden'); });
document.getElementById('confirmYes').addEventListener('click', () => { 
    localStorage.removeItem('chatUser'); 
    window.location.href = '/login.html'; 
});
document.getElementById('confirmNo').addEventListener('click', () => { confirmModal.classList.add('hidden'); profileModal.classList.remove('hidden'); });


// --- SOCKET LISTENERS & CHAT LOGIC (Igual que antes) ---

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
        const data = await res.json();
        myUser.avatar = data.avatarUrl;
        localStorage.setItem('chatUser', JSON.stringify(myUser));
        updateMyAvatarUI(data.avatarUrl);
        socket.emit('avatar updated', data.avatarUrl);
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

// Chat Images
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
            sendMessage(data.imageUrl, 'image');
        }
    } catch (error) { console.error(error); }
    chatImageInput.value = '';
});

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

async function selectUser(targetUser, elem) {
    currentTargetUserId = targetUser.userId;
    currentTargetUserObj = targetUser;
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
            appendMessageUI(msg.content, type, msg.timestamp, msg.id, msg.type);
        });
        messagesList.scrollTop = messagesList.scrollHeight;
    } catch (err) { messagesList.innerHTML = '<li style="text-align:center;color:red">Error</li>'; }
}

backBtn.addEventListener('click', () => chatContainer.classList.remove('mobile-chat-active'));

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = inputMsg.value.trim();
    if(content) {
        sendMessage(content, 'text');
        inputMsg.value = '';
        socket.emit('stop typing', { toUserId: currentTargetUserId });
    }
});

function sendMessage(content, type) {
    if(!currentTargetUserId) return;
    socket.emit('private message', { content, toUserId: currentTargetUserId, type }, (response) => {
        if (response && response.id) {
            appendMessageUI(content, 'me', new Date(), response.id, type);
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    });
}

socket.on('private message', ({ id, content, fromUserId, timestamp, type }) => {
    if (currentTargetUserId === fromUserId) {
        appendMessageUI(content, 'other', timestamp, id, type || 'text');
        messagesList.scrollTop = messagesList.scrollHeight;
    } 
});

socket.on('message deleted', ({ messageId }) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
        el.style.transition = "opacity 0.3s, transform 0.3s";
        el.style.opacity = "0";
        el.style.transform = "scale(0.9)";
        setTimeout(() => el.remove(), 300);
    }
});

function appendMessageUI(content, ownerType, dateStr, msgId, msgType = 'text') {
    const li = document.createElement('li');
    li.className = `message ${ownerType}`;
    li.id = `msg-${msgId}`;
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (ownerType === 'me') addLongPressEvent(li, msgId);
    let bodyHtml = '';
    if (msgType === 'image') {
        bodyHtml = `<div class="chat-image-container"><img src="${content}" class="chat-image" loading="lazy" onclick="viewFullImage(this.src)"></div>`;
    } else {
        bodyHtml = `<span>${content}</span>`;
    }
    li.innerHTML = `${bodyHtml}<div class="meta-row"><span class="meta">${time}</span></div>`;
    messagesList.appendChild(li);
}

window.viewFullImage = function(src) {
    const modal = document.createElement('div');
    modal.className = 'fullscreen-img-modal';
    modal.innerHTML = `<img src="${src}" class="fullscreen-img">`;
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
}

function addLongPressEvent(element, msgId) {
    let pressTimer;
    const LONG_PRESS_DURATION = 600; 
    element.addEventListener('mousedown', (e) => {
        if(e.button !== 0) return; 
        element.classList.add('pressing');
        pressTimer = setTimeout(() => openContextMenu(e.clientX, e.clientY, msgId), LONG_PRESS_DURATION);
    });
    const cancelMouse = () => { clearTimeout(pressTimer); element.classList.remove('pressing'); };
    element.addEventListener('mouseup', cancelMouse);
    element.addEventListener('mouseleave', cancelMouse);
    element.addEventListener('touchstart', (e) => {
        element.classList.add('pressing');
        const touch = e.touches[0];
        pressTimer = setTimeout(() => openContextMenu(touch.clientX, touch.clientY, msgId), LONG_PRESS_DURATION);
    }, { passive: true });
    const cancelTouch = () => { clearTimeout(pressTimer); element.classList.remove('pressing'); };
    element.addEventListener('touchend', cancelTouch);
    element.addEventListener('touchmove', cancelTouch);
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

inputMsg.addEventListener('input', () => {
    if(currentTargetUserId) socket.emit('typing', { toUserId: currentTargetUserId });
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