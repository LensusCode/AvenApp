# Solución de problema de red - Gradle

## Problema
Gradle no puede resolver `repo.maven.apache.org` debido a un problema de DNS local.

## Solución aplicada
✅ Agregué repositorios alternativos en `android/build.gradle`:
- Aliyun Mirror (más confiable en algunas regiones)
- JitPack (backup adicional)

## Próximo paso en Android Studio

1. **Click en "Retry"** o **"Sync Now"** en Android Studio
2. Gradle intentará descargar las dependencias usando los nuevos repositorios

## Si el problema persiste

### Opción 1: Cambiar DNS temporalmente (Recomendado)

Usa DNS de Google o Cloudflare temporalmente:

**PowerShell (como Administrador):**
```powershell
# Ver adaptadores de red
Get-NetAdapter | Where-Object {$_.Status -eq "Up"}

# Cambiar a DNS de Google (reemplaza "Ethernet" con tu adaptador)
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses ("8.8.8.8","8.8.4.4")

# O usar Cloudflare
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses ("1.1.1.1","1.0.0.1")
```

**Después de compilar, restaurar DNS:**
```powershell
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ResetServerAddresses
```

### Opción 2: Modo Offline de Gradle

Si ya descargaste las dependencias antes:
1. En Android Studio: **File → Settings**
2. Busca **"Gradle"**
3. Activa **"Offline work"**
4. Click **"Sync Now"**

### Opción 3: Limpiar caché de Gradle

```powershell
cd android
./gradlew clean --refresh-dependencies
```

## Verificar si funcionó

Después de aplicar la solución, intenta en Android Studio:
- Click en el botón 🔄 "Sync Project with Gradle Files"
- Espera a que aparezca "BUILD SUCCESSFUL" en la pestaña Build

Si ves errores de red, aplica la Opción 1 (cambiar DNS).
