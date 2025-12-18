let myUser = null;

async function apiRequest(url, method = 'GET', body = null) {
    try {
        const fullUrl = typeof getApiUrl === 'function' ? getApiUrl(url) : url;

        // En móvil, usar CapacitorHttp para evitar CORS
        const isNative = !!(window.Capacitor || window.CapacitorPlugins?.Capacitor);

        // Buscar CapacitorHttp - puede estar en Capacitor.Plugins
        const CapHttp = window.Capacitor?.Plugins?.CapacitorHttp;

        console.log('[DEBUG] isNative:', isNative);
        console.log('[DEBUG] window.Capacitor:', !!window.Capacitor);
        console.log('[DEBUG] window.Capacitor?.Plugins:', !!window.Capacitor?.Plugins);
        console.log('[DEBUG] CapHttp:', !!CapHttp);

        if (isNative && CapHttp) {
            console.log('[DEBUG] ✅ Using CapacitorHttp for:', fullUrl);

            const options = {
                url: fullUrl,
                method: method,
                headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}
            };

            if (body) {
                if (body instanceof FormData) {
                    // CapacitorHttp no soporta FormData directamente
                    // En este caso usaremos fetch normal
                    const res = await fetch(fullUrl, {
                        method,
                        body
                    });
                    if (res.status === 401 || res.status === 403) {
                        localStorage.removeItem('chatUser');
                        window.location.href = '/login';
                        return null;
                    }
                    return res.ok ? await res.json() : null;
                } else {
                    options.data = body;
                }
            }

            console.log('[DEBUG] CapacitorHttp request options:', options);
            const response = await CapHttp.request(options);
            console.log('[DEBUG] CapacitorHttp response:', response.status, response.data);

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('chatUser');
                if (isNative) {
                    showMobileLogin();
                } else {
                    window.location.href = '/login';
                }
                return null;
            }

            return response.status >= 200 && response.status < 300 ? response.data : null;
        } else {
            // En web, usar fetch normal
            console.log('[DEBUG] ❌ Using fetch (not native or no CapHttp) for:', fullUrl);
            const headers = {};
            if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

            const opts = { method, headers };
            if (body) opts.body = body instanceof FormData ? body : JSON.stringify(body);

            const res = await fetch(fullUrl, opts);

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('chatUser');
                window.location.href = '/login';
                return null;
            }

            return res.ok ? await res.json() : null;
        }
    } catch (e) {
        console.error('API Error', e, url);
        return null;
    }
}
