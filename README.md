# Rinran CRM

CRM para gestionar contactos de WhatsApp. Funciona como tu bandeja de entrada: cualquier persona que te escriba aparece automáticamente con su nombre, bandera de país e historial de conversación. Desde el CRM respondés individualmente o enviás mensajes masivos a toda tu base.

Se conecta a tu WhatsApp a través de **WAHA** (WhatsApp HTTP API) — sin necesidad de Meta Business API, sin migrar tu número, sin aprobaciones. Funciona con el mismo número que ya usás.

Está diseñado para usarse desde el teléfono — podés instalarlo en la pantalla de inicio como si fuera una app.

---

## Características

- **Bandeja unificada** — Todos los mensajes entrantes en una sola pantalla, ordenados por el más reciente, con badge de no leídos y sonido de notificación.
- **Tiempo real** — Mensajes nuevos aparecen al instante vía SSE (Server-Sent Events). Sin polling manual.
- **Captura automática** — Cuando alguien te escribe, el contacto se crea solo con su nombre y teléfono. No hay que hacer nada manual.
- **Captura de grupos** — Los mensajes de grupos también se capturan, usando al remitente como contacto.
- **Bandera de país** — Detecta el país por código de área (`+52` → 🇲🇽, `+54` → 🇦🇷, `+55` → 🇧🇷, etc.).
- **Chat individual** — Vista de conversación por contacto, con historial completo. Soporte para responder mensajes específicos (cita), enviar archivos, ubicaciones y notas de voz (grabación directa con conversor OGG/Opus para compatibilidad total con WhatsApp).
- **Broadcast masivo** — Enviá un mensaje a toda una categoría, tag o etapa del pipeline. Soporte para programar broadcasts.
- **Scripts & Objection Handler** — Biblioteca editable de scripts de venta palabra a palabra, 10 manejadores de objeciones tipo acordeón, y checklists HAZ/NO HAGAS. Cada script tiene botón de copiar para pegar directo en el chat.
- **Plantillas** — Guardá mensajes predefinidos para reutilizarlos desde cualquier chat.
- **Respuestas automáticas** — Configurá reglas para responder automáticamente según palabras clave o el primer mensaje.
- **Pipeline** — Vista Kanban de contactos por etapa de venta (Nuevo, En progreso, Ganado, etc.).
- **Categorías con colores** — Clasificá contactos en Lead, Cliente, VIP, Inactivo, o las que crees vos. Podés importar tus labels de WhatsApp al CRM con un solo clic.
- **Tags** — Etiquetás contactos con múltiples tags de colores.
- **Campos personalizados** — Definí campos extra para tus contactos (texto, número, fecha, select).
- **Notas internas** — Anotaciones privadas del equipo, visibles solo dentro del CRM.
- **Recordatorios** — Programá un seguimiento para un contacto. El CRM te notifica cuando vence y puede enviar automáticamente un mensaje de WhatsApp al contacto con variables `{{nombre}}` y `{{titulo}}`.
- **Multi-usuario** — Creá cuentas para todo tu equipo con roles admin/agente. Asignación automática por reglas.
- **Autenticación** — Login con email/contraseña, roles, y 2FA (TOTP) opcional.
- **Notificaciones push** — Notificaciones en el navegador y Web Push cuando llegan mensajes o vencen recordatorios.
- **Búsqueda global** — Buscá en contactos, mensajes y conversaciones desde un solo lugar.
- **Filtros guardados** — Guardá combinaciones de filtros de contactos para reutilizarlas.
- **Log de webhooks** — Revisá todos los eventos que llegaron desde WAHA en tiempo real.
- **Webhooks de salida** — Enviá eventos del CRM a URLs externas (Zapier, Make, tu propio backend).
- **API keys** — Generá claves de API para integrar el CRM con herramientas externas.
- **SMTP** — Configurá envío de emails desde el CRM.
- **Backup / Restore** — Exportá e importá la base de datos desde la UI.
- **Dashboard** — Estadísticas en tiempo real: contactos por país, por categoría, mensajes enviados y recibidos.
- **Móvil primero** — Navegación por abajo en el teléfono, pantalla completa, instalable como PWA.
- **Tema claro / oscuro** — Alternás desde cualquier pantalla.
- **Todo en Docker** — Un solo comando levanta backend + frontend + WAHA.

---

## Cómo funciona con WAHA

WAHA (WhatsApp HTTP API) es un servidor que conecta tu WhatsApp (personal o Business) a través de un QR code, igual que WhatsApp Web. El CRM se comunica con ese servidor para enviar y recibir mensajes. A diferencia del README original, **WAHA ya viene incluido** en el `docker-compose.yml` — no necesitás instalarlo por separado.

```
[Tu WhatsApp — número que ya usás]
         │
         │ QR scan (una sola vez, desde la UI del CRM)
         ▼
  [WAHA — contenedor rinran-waha]  ←──── envía mensajes (texto, archivos,
         │                                voz, ubicación, typing, seen...)
         │ webhook POST /webhook (cada mensaje entrante)
         ▼
   [Rinran CRM — backend]
         │
         │ SSE en tiempo real
         ▼
  [Frontend — Bandeja + Chats + Pipeline + Broadcasts]
```

**Ventajas sobre Meta Cloud API:**
- No necesitás cuenta de Meta Business ni crear ninguna app
- Usás tu número actual sin migrarlo ni eliminarlo
- Sin restricciones de templates para enviar mensajes
- Funciona con WhatsApp personal y WhatsApp Business

**A tener en cuenta:**
- WAHA corre en el contenedor `rinran-waha` junto al CRM
- El motor por defecto es NOWEB (sin Chromium, más liviano)
- WhatsApp detecta el uso como cliente no oficial — riesgo bajo pero existente para uso normal de negocio

---

## Requisitos

| Componente | Detalle |
|------------|---------|
| Docker + Docker Compose v2 | Para correr el CRM |
| Un número de WhatsApp | Para conectar vía QR |

> No necesitás Node.js, cuenta de Meta Business, servidor WAHA externo, ni ninguna otra cosa. Solo Docker.

---

## Instalación — Opción A: Setup automático (recomendado)

```bash
git clone https://github.com/marcosfermin/rinran-crm.git
cd rinran-crm
./setup.sh
```

El instalador hace todo:
1. Verifica que Docker y Docker Compose estén instalados
2. Te pide el puerto, email de admin, contraseña de admin y contraseña del dashboard WAHA
3. Genera secrets seguros (JWT, API key) automáticamente
4. Crea el `.env`
5. Construye e inicia los contenedores
6. Espera a que backend y frontend estén listos
7. Muestra la URL de acceso y las credenciales

Al terminar, verás algo así:

```
  ✓ Rinran CRM instalado correctamente

  Acceso:
    CRM          →  http://192.168.1.50:3000
    WAHA dashboard → http://192.168.1.50:3001/dashboard

  Credenciales CRM:
    Email      →  admin@miempresa.com
    Contraseña →  tu-contraseña

  Próximos pasos:
    1. Abre el CRM e inicia sesión
    2. Ve a WhatsApp / Sesiones y crea una sesión
    3. Escanea el QR con WhatsApp para conectar
```

---

## Instalación — Opción B: Manual

### Paso 1 — Clonar

```bash
git clone https://github.com/marcosfermin/rinran-crm.git
cd rinran-crm
cp .env.example .env
```

### Paso 2 — Configurar `.env`

```env
# Puerto donde se accede al CRM desde el navegador
FRONTEND_PORT=3000

# JWT — genera con: openssl rand -hex 32
JWT_SECRET=cambia-esto-por-un-secreto-seguro

# Usuario administrador (se crea solo si la base de datos está vacía)
ADMIN_EMAIL=admin@miempresa.com
ADMIN_PASSWORD=contraseña-segura

# WAHA — URL interna (no cambiar si usas Docker Compose)
OPENWA_URL=http://waha:3000

# API Key de WAHA — debe ser igual en ambas variables
# Genera con: openssl rand -hex 32
OPENWA_API_KEY=cambia-esto
WAHA_API_KEY=cambia-esto

# Dashboard web de WAHA
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=contraseña-dashboard

# CORS
CORS_ORIGIN=*
```

### Paso 3 — Levantar

```bash
docker compose up -d --build
```

Abrí el CRM en: **http://localhost:3000**

---

## Conectar WhatsApp

1. Iniciá sesión en el CRM con tu email y contraseña de admin
2. En el menú lateral, andá a **WhatsApp → Sesiones**
3. Hacé clic en **Nueva sesión** y escribí un nombre (ej: `mi-numero`)
4. El CRM crea la sesión en WAHA y mostrará un **código QR**
5. Abrí WhatsApp en tu teléfono → **Dispositivos vinculados → Vincular dispositivo**
6. Escaneá el QR
7. Cuando el estado cambie a `WORKING`, la conexión está establecida

La sesión se guarda en el volumen `waha-data` — no necesitás re-escanear a menos que cierres la sesión desde el teléfono o desde la UI.

---

## Verificar la conexión

```bash
# Health del backend
curl http://localhost:3000/health

# Estado de la sesión WAHA (con tu API key)
curl -H "X-Api-Key: tu-waha-api-key" http://localhost:3001/api/sessions
```

---

## Instalar en el teléfono (PWA)

El CRM funciona desde el navegador del teléfono y se puede guardar en la pantalla de inicio como una app. Una vez instalado, abre en pantalla completa sin barra del browser — igual que una app nativa.

> Requiere que el CRM esté desplegado con HTTPS. No funciona desde `localhost`.

### iPhone — Safari

1. Abrí el CRM en **Safari** (debe ser Safari, no Chrome)
2. Tocá el botón de compartir — ícono de caja con flecha hacia arriba
3. Bajá en el menú hasta **"Agregar a pantalla de inicio"**
4. Ponele el nombre que quieras y tocá **Agregar**

### Android — Chrome

1. Abrí el CRM en **Chrome**
2. Tocá los tres puntos `⋮` arriba a la derecha
3. Tocá **"Agregar a pantalla de inicio"** o **"Instalar app"**
4. Confirmá con **Agregar**

---

## Estructura del proyecto

```
rinran-crm/
├── backend/
│   ├── src/
│   │   ├── server.js              Punto de entrada Express + schedulers
│   │   ├── db.js                  SQLite vía node:sqlite — schema + migraciones
│   │   ├── phoneUtils.js          Parser de teléfonos y detección de país
│   │   ├── whatsapp.js            Cliente WAHA: send, getSession, media, labels, etc.
│   │   ├── middleware/
│   │   │   └── auth.js            JWT auth middleware
│   │   └── routes/
│   │       ├── auth.js            Login, registro, 2FA (TOTP)
│   │       ├── contacts.js        CRUD de contactos + campos custom + historial
│   │       ├── categories.js      CRUD de categorías (con sync a labels WAHA)
│   │       ├── messages.js        Envío individual, archivos, voz, ubicación, broadcast
│   │       ├── inbox.js           Bandeja de conversaciones con no leídos
│   │       ├── stats.js           Estadísticas del dashboard
│   │       ├── status.js          Estado de conexión con WAHA
│   │       ├── webhook.js         Receptor de eventos WAHA (mensajes entrantes + ACKs)
│   │       ├── sync.js            Importar chats/contactos existentes desde WAHA
│   │       ├── templates.js       CRUD de plantillas de mensajes
│   │       ├── autoReply.js       Reglas de respuesta automática
│   │       ├── tags.js            CRUD de tags
│   │       ├── internalNotes.js   Notas internas por contacto
│   │       ├── reminders.js       Recordatorios de seguimiento
│   │       ├── scripts.js         Scripts de venta y Objection Handler (CRUD + seed)
│   │       ├── users.js           Gestión de equipo (admin)
│   │       ├── savedFilters.js    Filtros guardados por usuario
│   │       ├── webhookLog.js      Log de eventos WAHA entrantes
│   │       ├── sse.js             Server-Sent Events (push en tiempo real)
│   │       ├── push.js            Web Push notifications
│   │       └── settings.js        Config. de empresa, webhook, SMTP, API keys, backup
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── sw.js                  Service Worker (PWA + Web Push)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                Router + sidebar + nav móvil + SSE + notif.
│   │   ├── index.css
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx    Contexto de autenticación JWT
│   │   ├── hooks/
│   │   │   └── useApi.js
│   │   ├── utils/
│   │   │   └── apiFetch.js        Fetch wrapper con auth header
│   │   ├── components/
│   │   │   ├── Avatar.jsx
│   │   │   └── InboxChatPanel.jsx Panel de chat embebido en la bandeja
│   │   └── pages/
│   │       ├── Login.jsx          Pantalla de inicio de sesión
│   │       ├── Inbox.jsx          Bandeja de conversaciones
│   │       ├── Dashboard.jsx      Estadísticas
│   │       ├── Contacts.jsx       Lista/tarjetas de contactos
│   │       ├── ContactDetail.jsx  Chat individual + notas + recordatorios
│   │       ├── Broadcast.jsx      Envío masivo + historial + programación
│   │       ├── Categories.jsx     Gestión de categorías
│   │       ├── Pipeline.jsx       Vista Kanban del pipeline de ventas
│   │       ├── Templates.jsx      Plantillas de mensajes
│   │       ├── AutoReply.jsx      Reglas de respuesta automática
│   │       ├── Sessions.jsx       Gestión de sesiones WAHA + escaneo QR
│   │       ├── Team.jsx           Gestión de usuarios del equipo
│   │       ├── GlobalSearch.jsx   Búsqueda global
│   │       ├── Reminders.jsx      Lista de recordatorios pendientes
│   │       ├── Scripts.jsx        Scripts de venta + Objection Handler + HAZ/NO HAGAS
│   │       ├── WebhookLog.jsx     Log de eventos WAHA
│   │       └── Settings.jsx       Configuración general (admin)
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
├── .env.example
├── setup.sh                       Instalador interactivo
└── README.md
```

---

## Stack tecnológico

### Backend
| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 22 |
| Framework | Express 4 |
| Base de datos | SQLite vía `node:sqlite` (nativo Node.js 22) |
| Autenticación | JWT (`jsonwebtoken`) + bcrypt |
| 2FA | TOTP (`speakeasy`) |
| Teléfonos | libphonenumber-js |
| WhatsApp | WAHA (devlikeapro/waha) vía REST API |
| QR codes | `qrcode` (generado en el backend, sin servicios externos) |
| Push | Web Push API (`web-push`) |
| HTTP client | Axios |

### Frontend
| Capa | Tecnología |
|------|-----------|
| UI | React 18 |
| Routing | React Router 6 |
| Estilos | Tailwind CSS 3 |
| Build | Vite 5 |
| Iconos | Lucide React |
| Real-time | Server-Sent Events (SSE) |
| Servidor | Nginx (producción) |

### Infraestructura
| Elemento | Detalle |
|----------|---------|
| Contenedores | Docker + Docker Compose |
| Servicios | `backend` (Express), `frontend` (Nginx), `waha` (WhatsApp) |
| Red interna | Bridge `rinran` |
| Persistencia CRM | Docker volume `crm-data` → `/data/rinran.db` |
| Persistencia WAHA | Docker volume `waha-data` → `/app/.sessions` |

---

## API REST

Base URL: `http://localhost:3000/api`

Todas las rutas (excepto `/api/auth` y `/webhook`) requieren el header:
```
Authorization: Bearer <jwt-token>
```

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/auth/login` | Login. Body: `email`, `password`. Devuelve `token` |
| `GET` | `/auth/me` | Perfil del usuario autenticado |
| `POST` | `/auth/2fa/setup` | Iniciar configuración de 2FA (genera QR TOTP) |
| `POST` | `/auth/2fa/verify` | Activar 2FA con el código del autenticador |
| `POST` | `/auth/2fa/disable` | Desactivar 2FA con contraseña actual |

### Contactos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/contacts` | Lista paginada. Params: `search`, `category_id`, `tag_id`, `status`, `pipeline_stage`, `assigned_to`, `page`, `limit` |
| `GET` | `/contacts/:id` | Detalle + historial de mensajes + notas + campos custom |
| `POST` | `/contacts` | Crear. Body: `name`, `phone`, `category_id?`, `notes?`, `pipeline_stage?` |
| `PATCH` | `/contacts/:id` | Actualizar nombre, categoría, notas, estado, pipeline, asignado |
| `DELETE` | `/contacts/:id` | Eliminar contacto (permanente) |
| `GET` | `/contacts/:id/photo` | Proxy de foto de perfil |
| `POST` | `/contacts/:id/photo` | Subir foto de perfil (base64, max 5MB) |

### Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/categories` | Lista con conteo de contactos |
| `POST` | `/categories` | Crear. Body: `name`, `color` (hex) |
| `PATCH` | `/categories/:id` | Actualizar nombre o color |
| `DELETE` | `/categories/:id` | Eliminar |

### Tags

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/tags` | Lista de tags |
| `POST` | `/tags` | Crear. Body: `name`, `color` |
| `PATCH` | `/tags/:id` | Actualizar |
| `DELETE` | `/tags/:id` | Eliminar |

### Mensajes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/messages/send` | Texto. Body: `contact_id`, `message`, `reply_to_id?` |
| `POST` | `/messages/send-file` | Archivo. Body: `contact_id`, `data` (base64), `filename`, `mimetype`, `caption?` |
| `POST` | `/messages/send-voice` | Nota de voz. Body: `contact_id`, `data`, `filename`, `mimetype` |
| `POST` | `/messages/send-location` | Ubicación. Body: `contact_id`, `latitude`, `longitude`, `title?` |
| `POST` | `/messages/broadcast` | Masivo. Body: `name?`, `message`, `category_id?`, `tag_id?`, `pipeline_stage?`, `scheduled_at?` |
| `GET` | `/messages/broadcasts` | Historial de broadcasts con estado por destinatario |

### Plantillas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/templates` | Lista de plantillas |
| `POST` | `/templates` | Crear. Body: `name`, `content` |
| `PATCH` | `/templates/:id` | Actualizar |
| `DELETE` | `/templates/:id` | Eliminar |

### Respuestas automáticas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/auto-reply` | Lista de reglas |
| `POST` | `/auto-reply` | Crear regla. Body: `name`, `trigger_type`, `trigger_value`, `response`, `is_active` |
| `PATCH` | `/auto-reply/:id` | Actualizar |
| `DELETE` | `/auto-reply/:id` | Eliminar |

### Bandeja

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/inbox` | Conversaciones con no leídos. Param: `search` |
| `PATCH` | `/inbox/:id/read` | Marca mensajes entrantes como leídos |

### Notas internas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/contacts/:id/notes` | Notas de un contacto |
| `POST` | `/contacts/:id/notes` | Crear nota. Body: `content` |
| `DELETE` | `/contacts/:id/notes/:noteId` | Eliminar nota |

### Recordatorios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/reminders` | Lista (filtro `?done=0` para pendientes) |
| `POST` | `/reminders` | Crear. Body: `contact_id`, `title`, `due_at`, `note?` |
| `PATCH` | `/reminders/:id` | Marcar completado o actualizar |
| `DELETE` | `/reminders/:id` | Eliminar |

### Equipo

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/team` | Lista de usuarios (admin) |
| `POST` | `/team` | Crear usuario. Body: `email`, `password`, `name`, `role` |
| `PATCH` | `/team/:id` | Actualizar usuario |
| `DELETE` | `/team/:id` | Eliminar usuario |

### Estadísticas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/stats` | Resumen: total contactos, mensajes, por país, por categoría |

### Estado y Webhook

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/status` | Estado de conexión del CRM con WAHA |
| `POST` | `/webhook` | Receptor de eventos WAHA (mensajes entrantes + ACKs) |
| `GET` | `/webhook-log` | Log de los últimos 500 eventos recibidos |

### Sesiones WAHA

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/wa/info` | Info de WAHA (versión, URL, webhook configurado) |
| `GET` | `/wa/sessions` | Lista de sesiones |
| `POST` | `/wa/sessions` | Crear sesión (auto-configura webhook). Body: `name`, `auto_webhook?` |
| `GET` | `/wa/sessions/:name` | Detalle de sesión |
| `PUT` | `/wa/sessions/:name` | Actualizar config de sesión |
| `POST` | `/wa/sessions/:name/:action` | Acciones: `start`, `stop`, `restart`, `logout` |
| `DELETE` | `/wa/sessions/:name` | Eliminar sesión |
| `GET` | `/wa/sessions/:name/qr` | QR code como data URI para escanear |
| `POST` | `/wa/sessions/:name/webhook` | Configurar webhook manualmente |
| `GET` | `/wa/check-number` | Verificar si un número tiene WhatsApp. Param: `phone` |

### Configuración

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/settings` | Config actual (nombre empresa, timezone, horario, SLA) |
| `PUT` | `/settings` | Actualizar (admin) |
| `POST` | `/settings/change-password` | Cambiar contraseña del usuario actual |
| `GET` | `/settings/custom-fields` | Definiciones de campos personalizados |
| `POST` | `/settings/custom-fields` | Crear campo. Body: `name`, `field_type`, `options_json?` |
| `DELETE` | `/settings/custom-fields/:id` | Eliminar campo |
| `GET` | `/settings/assignment-rules` | Reglas de asignación automática |
| `POST` | `/settings/assignment-rules` | Crear regla. Body: `name`, `category_id`, `agent_id` |
| `DELETE` | `/settings/assignment-rules/:id` | Eliminar regla |
| `GET` | `/settings/smtp` | Config SMTP (admin) |
| `PUT` | `/settings/smtp` | Actualizar SMTP |
| `POST` | `/settings/smtp/test` | Enviar email de prueba |
| `GET` | `/settings/outbound-webhooks` | Webhooks de salida |
| `POST` | `/settings/outbound-webhooks` | Crear webhook. Body: `name`, `url`, `events`, `secret?` |
| `DELETE` | `/settings/outbound-webhooks/:id` | Eliminar webhook |
| `GET` | `/settings/api-keys` | API keys del equipo (admin) |
| `POST` | `/settings/api-keys` | Generar API key. Body: `name` |
| `DELETE` | `/settings/api-keys/:id` | Revocar API key |
| `GET` | `/settings/backup` | Descargar backup de la base de datos |
| `POST` | `/settings/restore` | Restaurar desde backup |

### Otros

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/sse?token=<jwt>` | Stream SSE para eventos en tiempo real |
| `POST` | `/api/sync` | Importar chats/contactos existentes desde WAHA |
| `GET` | `/saved-filters` | Filtros guardados del usuario |
| `POST` | `/saved-filters` | Guardar filtro. Body: `name`, `filters_json` |
| `DELETE` | `/saved-filters/:id` | Eliminar filtro |
| `GET` | `/health` | Health check del backend |

---

## Formato de números

WAHA usa el formato `{número}@c.us`. El CRM convierte automáticamente:

| Dirección | Formato | Ejemplo |
|-----------|---------|---------|
| CRM → WAHA | `número@c.us` | `5491122334455@c.us` |
| WAHA → CRM | E.164 con `+` | `+5491122334455` |

Los usuarios `@lid` (anónimos de WhatsApp) se resuelven automáticamente vía el endpoint `/api/{session}/lids/`.

---

## Flujo completo de mensajes

```
  Alguien te escribe al WhatsApp
            │
            │ WAHA detecta el mensaje
            ▼
  [rinran-waha — contenedor Docker]
            │
            │ POST /webhook (evento tipo "message")
            ▼
     [backend — webhook.js]
            │
       ┌────┴──────────────┐
       │                   │
  nuevo contacto     contacto existente
  se crea            se agrega al historial
  automáticamente
       │                   │
       └────────┬──────────┘
                │
                │ Se verifica auto-reply (si aplica)
                │ Se emite evento SSE al frontend
                │ Se emite Web Push si el usuario no está activo
                ▼
   [Bandeja — badge de no leído + sonido]
                │
       ┌────────┴───────────────┐
       │                        │
  Respondés en el chat      Broadcast por categoría
  (texto / archivo /        tag o etapa del pipeline
   voz / ubicación)
            │
            │ WAHA envía el mensaje
            ▼
  [WhatsApp del contacto]
            │
            │ WAHA recibe ACK (entregado / leído)
            ▼
  [Backend actualiza estado del mensaje]
```

---

## Comandos útiles

```bash
# Ver logs en vivo
docker compose logs -f

# Ver logs solo del backend
docker compose logs -f backend

# Ver logs de WAHA
docker compose logs -f waha

# Verificar estado
curl http://localhost:3000/health

# Reiniciar sin rebuild
docker compose restart backend

# Rebuild completo (después de cambios en el código)
docker compose up -d --build

# Backup de la base de datos
docker compose exec backend sh -c "cp /data/rinran.db /data/backup_$(date +%Y%m%d).db"

# Detener todo
docker compose down
```

---

## Despliegue en producción

### Requisitos
- VPS con Ubuntu 22.04+ (o cualquier Linux)
- Docker + Docker Compose
- Dominio apuntando al IP del servidor

### Instalar Docker en Ubuntu

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### Clonar, configurar y levantar

```bash
git clone https://github.com/marcosfermin/rinran-crm.git
cd rinran-crm
./setup.sh
```

### Configurar HTTPS con Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/rinran
```

```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/rinran /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tudominio.com
```

El CRM queda en `https://tudominio.com`. El webhook de WAHA apunta internamente a `http://backend:4000/webhook` — no necesitás exposición pública del webhook.

---

## Checklist de instalación

**Requisitos**
- [ ] Docker y Docker Compose v2 instalados

**CRM**
- [ ] `.env` creado (`./setup.sh` o manual con `.env.example`)
- [ ] `docker compose up -d --build` sin errores
- [ ] `GET /health` responde `{ "status": "ok" }`
- [ ] Login en el CRM con las credenciales configuradas

**WhatsApp**
- [ ] Ir a **WhatsApp → Sesiones** en el CRM
- [ ] Crear sesión y escanear el QR con WhatsApp
- [ ] Estado de la sesión pasa a `WORKING`

**Prueba de mensajes**
- [ ] Enviar un mensaje desde otro WhatsApp al número conectado
- [ ] El contacto aparece en la Bandeja del CRM automáticamente
- [ ] Responder desde el CRM y verificar que llega al WhatsApp

**Teléfono (opcional)**
- [ ] Abrir el CRM desde Safari (iPhone) o Chrome (Android)
- [ ] Agregar a pantalla de inicio
- [ ] Verificar que abre en pantalla completa

---

## Licencia

MIT
