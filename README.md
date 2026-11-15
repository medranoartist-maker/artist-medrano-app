# Artist Medrano · Gestión de clientas (V5 para GitHub)

Versión de la V4 adaptada a **GitHub Pages + Supabase Auth + PostgreSQL**. Conserva la ficha de color, el buscador dinámico, el historial, la confirmación de guardado y la navegación de la V4.

## Muy importante

- **La web publicada es pública**, pero **las fichas son privadas**: solo los correos autorizados acceden a la base con inicio de sesión y políticas RLS.
- **No subir nunca a GitHub** archivos exportados de Google Sheets, diagnósticos reales, fotos identificables ni claves `service_role`.
- **GitHub Pages no es una base de datos**. La V4 usaba `google.script.run` y no se puede alojar tal cual fuera de Apps Script.
- Los datos de Google Sheets originales **no se trasladan automáticamente** a Supabase. Conservar Sheets sin eliminar nada y hacer una exportación privada antes de la migración de datos.
- La nueva implementación arranca vacía hasta importar los registros. El respaldo original sigue en Google Sheets.

## Paso 1 · Publicar el sitio en GitHub

1. Entrar a GitHub y crear un repositorio llamado `artist-medrano-app` (sin cargar datos de clientas). Puede ser público para usar GitHub Pages en GitHub Free.
2. Subir los archivos y carpetas de este ZIP **manteniendo `docs/`**. En la interfaz de GitHub, `Add file → Upload files`, arrastrar los archivos y confirmar `Commit changes`.
3. Ir a `Settings → Pages → Build and deployment → Deploy from a branch`.
4. Elegir `main` y `/docs`, pulsar `Save`.
5. El sitio quedará disponible en una dirección como `https://USUARIO.github.io/artist-medrano-app/` (el usuario es el verdadero nombre de la cuenta). Al principio indicará que falta conectar Supabase.

## Paso 2 · Crear la base de datos protegida

1. Crear un proyecto en [Supabase](https://supabase.com/) del salón.
2. En `SQL Editor`, pegar y ejecutar íntegro el contenido de `supabase/schema.sql`.
3. Abrir `Table Editor → salon_staff → Insert row`. Agregar **el correo de cada empleado** (en minúsculas) y `active = true`. Este listado es privado; no escribirlo en el código público.
4. En `Authentication → Providers`, habilitar el proveedor `Email` y confirmar la configuración de enlaces de ingreso.
5. En `Authentication → URL Configuration`, indicar como `Site URL` la URL real de GitHub Pages y agregar esa misma URL (incluida la `/` final) en `Redirect URLs`.
6. En la sección del proyecto que muestra `Project URL` y `Publishable key / anon public key`, copiar **solo** estos dos datos públicos.
7. Editar `docs/config.js` dentro de GitHub, completar `supabaseUrl` y `supabaseAnonKey` y guardar el commit.
8. Abrir el sitio de GitHub Pages, solicitar el enlace de acceso desde el correo autorizado y probar con un registro **ficticio**.

No pegar la `service_role` key (o secret key) en `docs/config.js`, ni en ningún archivo del repositorio.

## Paso 3 · Prueba mínima (sin información real)

- Abrir en computadora y Samsung Flip5: debería verse la misma pantalla de acceso.
- Iniciar sesión con un correo incluido en `salon_staff`.
- Buscar una clienta ficticia, crearla, completar y guardar un diagnóstico de prueba.
- Salir; entrar desde el otro dispositivo con el mismo correo; comprobar que están el nombre y su historial.
- Probar una cuenta no autorizada: no debería mostrar fichas.

## Paso 4 · Migrar los datos existentes (después de probar)

La V4 guarda datos de clientas en la pestaña `Clientas` de Sheets y las visitas completas como JSON en la columna F de la pestaña de cada clienta. También tiene tres clientas de demostración (`Sofía`, `Martina`, `Valentina`). Es necesario **exportar, revisar y mapear** estas filas antes de importarlas, porque la nueva base usa identificadores UUID para las clientas. No se debe copiar la planilla al repositorio.

El archivo `migration/exportar_respaldo.gs` ofrece una función de respaldo que genera un JSON privado **en tu Google Drive**. No ejecutarla desde un sitio público. Se incluye `migration/importar-a-supabase.mjs`, que conserva relaciones, estados y fechas sin enviar datos a GitHub. El importador puede ejecutarse en una computadora de confianza con Node.js.

Primero revisar el respaldo sin subir información a ningún servidor:

```powershell
node migration/importar-a-supabase.mjs "C:\ruta\artist-medrano-respaldo.json" --dry-run
```

Solo una vez que la base y los accesos estén probados, importar desde PowerShell en Windows (la clave secreta se obtiene de Supabase, **jamás se copia al repositorio ni a ChatGPT**):

```powershell
$env:SUPABASE_URL = "https://TU-PROYECTO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "CLAVE-SECRETA-SOLO-EN-TU-PC"
node migration/importar-a-supabase.mjs "C:\ruta\artist-medrano-respaldo.json"
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

Antes de ejecutar la importación real hay que comprobar el recuento y las filas problemáticas. Si las clientas de demostración tienen visitas, el importador también las incorpora. Las clientas ya creadas en Sheets conservan su UUID. Este proceso no borra ninguna pestaña de Sheets.

## Estructura

```text
artist-medrano-app/
├── docs/
│   ├── index.html       # Interfaz responsive (V4 adaptada)
│   ├── config.js        # Configuración pública de Supabase, sin secretos
│   └── .nojekyll
├── supabase/
│   └── schema.sql       # Tablas, permisos y seguridad RLS
├── migration/
│   ├── exportar_respaldo.gs
│   └── importar-a-supabase.mjs
└── README.md
```

## Cambios preservados

Se mantienen: búsqueda dinámica por nombre, alta con teléfono opcional, ficha e historial, diagnóstico de color existente, recomendación orientativa, plan profesional, guardar/validar, aviso ante cambios sin guardar, pantalla de guardado y salida. No se modifican las preguntas técnicas pendientes de revisión de Mariela.

## Desactivar el acceso público de la aplicación anterior

Después de confirmar que la nueva aplicación funciona, volver a `Apps Script → Implementar → Administrar implementaciones` y restringir el acceso de la implementación anterior (o archivarla). Mantener una copia de su código y la planilla original para el respaldo. El ajuste actual de «Cualquiera» no debe quedar abierto si contiene datos personales.

## Seguridad pendiente antes de producción

Evaluar consentimiento y privacidad, rotación de accesos del personal, copias de seguridad programadas, política de conservación de datos y auditoría de cambios. Este prototipo no sustituye una revisión de seguridad antes de cargar datos de salud o antecedentes sensibles.
