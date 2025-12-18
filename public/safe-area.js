// SAFE AREA FIX - Aplicar padding dinámico para evitar overlap con status bar
if (window.Capacitor) {
    const applySafeArea = async () => {
        let padding = 0;

        try {
            const { StatusBar } = window.Capacitor.Plugins || {};
            if (StatusBar?.getInfo) {
                const info = await StatusBar.getInfo();
                padding = info?.height || 0;
            }
        } catch (e) { }

        if (!padding) padding = 24; // fallback

        // Aplicar al contenedor principal
        const container = document.querySelector('.chat-container');
        if (container) container.style.paddingTop = `${padding}px`;

        // Aplicar a headers
        const applyHeaders = () => {
            document.querySelectorAll('.chat-header, .profile-nav-header, .editor-header').forEach(h => {
                if (!h.dataset.sa) {
                    h.style.paddingTop = `${padding}px`;
                    h.dataset.sa = '1';
                }
            });
        };

        applyHeaders();
        new MutationObserver(applyHeaders).observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applySafeArea);
    } else {
        applySafeArea();
    }
}
