// ANDROID BACK BUTTON HANDLER
// Handles hardware back button on Android devices

// Wait for Capacitor to be ready
window.addEventListener('capacitorReady', () => {
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.App) {
        return;
    }

    const { App } = window.Capacitor.Plugins;

    App.addListener('backButton', () => {
        // Check if we're in a chat view
        const chatContainer = document.querySelector('.chat-container');
        const isChatActive = chatContainer && chatContainer.classList.contains('mobile-chat-active');

        // If in chat, go back to list
        if (isChatActive) {
            const backBtn = document.querySelector('.back-btn');
            if (backBtn) {
                backBtn.click();
            } else {
                chatContainer.classList.remove('mobile-chat-active');
            }
        } else {
            // Exit app
            App.exitApp();
        }
    });
});

// Fallback: also try on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Try to register after a short delay to ensure Capacitor is ready
    setTimeout(() => {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            const { App } = window.Capacitor.Plugins;

            App.addListener('backButton', () => {
                // 1. Check for open modals first
                const modals = [
                    'profileModal',
                    'contactInfoModal',
                    'channelProfileModal',
                    'creationModal',
                    'loveNotesModal'
                ];

                for (const modalId of modals) {
                    const modal = document.getElementById(modalId);
                    // Modals are open when they DON'T have the 'hidden' class
                    if (modal && !modal.classList.contains('hidden')) {
                        modal.classList.add('hidden');
                        return; // Stop here, modal closed
                    }
                }

                // 2. Check if we're in a chat view
                const chatContainer = document.querySelector('.chat-container');
                const isChatActive = chatContainer && chatContainer.classList.contains('mobile-chat-active');

                if (isChatActive) {
                    const backBtn = document.querySelector('.back-btn');
                    if (backBtn) backBtn.click();
                    else chatContainer.classList.remove('mobile-chat-active');
                } else {
                    // 3. No modal open, not in chat → exit app
                    App.exitApp();
                }
            });
        }
    }, 1000);
});
