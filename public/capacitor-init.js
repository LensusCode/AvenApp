// Capacitor plugins are automatically available globally via window.Capacitor
// No need for ES6 imports in non-bundled apps

// Wait for Capacitor to be ready
document.addEventListener('DOMContentLoaded', async () => {
    // Check if running on native platform
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
            // Get plugins from Capacitor
            const { StatusBar } = window.Capacitor.Plugins;
            const { SplashScreen } = window.Capacitor.Plugins;

            // Configure StatusBar
            if (StatusBar) {
                await StatusBar.setStyle({ style: 'DARK' });
                await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
            }

            // Hide Splash Screen after load
            window.addEventListener('load', () => {
                setTimeout(async () => {
                    if (SplashScreen) {
                        await SplashScreen.hide();
                    }
                }, 500);
            });
        } catch (error) {
            console.error('[Capacitor Setup Error]', error);
        }
    }
});
