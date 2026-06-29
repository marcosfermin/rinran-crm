# Rinran CRM

CRM para gestionar contactos de WhatsApp. Funciona como tu bandeja de entrada: cualquier persona que te escriba aparece automáticamente con su nombre, bandera de país e historial de conversación. Desde el CRM respondés individualmente o enviás mensajes masivos a toda tu base.

Se conecta a tu WhatsApp a través de un servidor **OpenWA** — sin necesidad de Meta Business API, sin migrar tu número, sin aprobaciones. Funciona con el mismo número que ya usás.

Está diseñado para usarse desde el teléfono — podés instalarlo en la pantalla de inicio como si fuera una app.

---

## Características

- **Bandeja unificada** — Todos los mensajes entrantes en una sola pantalla, ordenados por el más reciente, con badge de no leídos.
- **Captura automática** — Cuando alguien te escribe, el contacto se crea solo con su nombre y teléfono. No hay que hacer nada manual.
- **Bandera de país** — Detecta el país por código de área (`+52` → 🇲🇽, `+54` → 🇦🇷, `+55` → 🇧🇷, etc.).
- **Chat individual** — Vista de conversación por contacto, con historial completo. Los mensajes nuevos aparecen solos cada 6 segundos.
- **Broadcast masivo** — Enviá un mensaje a toda una categoría o a todos tus contactos activos de una sola vez.
- **Categorías con colores** — Clasificá contactos en Lead, Cliente, VIP, Inactivo, o las que crees vos.
- **Dashboard** — Estadísticas en tiempo real: contactos por país, por categoría, mensajes enviados y recibidos.
- **Móvil primero** — Navegación por abajo en el teléfono, pantalla completa, instalable como app.
- **Todo en Docker** — Un solo comando levanta backend + frontend + base de datos.

---

## Cómo funciona con OpenWA

OpenWA es un servidor que conecta tu WhatsApp (personal o Business) a través de un QR code, igual que WhatsApp Web. El CRM se comunica con ese servidor para enviar y recibir mensajes.

```
[Tu WhatsApp — número que ya usás]
         │
         │ QR scan (una sola vez)
         ▼
  [Servidor OpenWA]  ←──────────────────── envía mensajes
         │                                  (desde el CRM)
         │ webhook (cada mensaje entrante)
         ▼
   [Rinran CRM]
         │
         ▼
  [Bandeja + Chats + Broadcasts]
```

**Ventajas sobre Meta Cloud API:**
- No necesitás cuenta de Meta Business ni crear ninguna app
- Usás tu número actual sin migrarlo ni eliminarlo
- Sin restricciones de templates para enviar mensajes
- Funciona con WhatsApp personal y WhatsApp Business

**A tener en cuenta:**
- El servidor OpenWA debe estar corriendo y conectado para que el CRM funcione
- WhatsApp detecta el uso como cliente no oficial — riesgo bajo pero existente para uso normal de negocio

---

## Requisitos

| Componente | Detalle |
|------------|---------|
| Docker + Docker Compose | Para correr el CRM |
| Servidor OpenWA | Corriendo y conectado a tu WhatsApp via QR |

> No necesitás Node.js, Meta Business account, ni ninguna otra cosa. Solo Docker y tu servidor OpenWA.

---

## Parte 1 — Configurar el servidor OpenWA

Si ya tenés el servidor OpenWA corriendo y conectado a tu WhatsApp, pasá directo al [Paso 2](#parte-2--instalar-y-levantar-el-crm).

### Paso 1 — Levantar OpenWA con Docker

La forma más rápida es correr OpenWA como contenedor Docker. Creá un archivo `docker-compose.openwa.yml` en una carpeta separada:

```yaml
services:
  openwa:
    image: openwa/wa-automate
    container_name: openwa
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - openwa-session:/app/.wwebjs_auth
    environment:
      - PORT=8080
      # Opcional: proteger el servidor con API key
      - API_KEY=tu_api_key_secreta

volumes:
  openwa-session:
```

```bash
docker compose -f docker-compose.openwa.yml up -d
```

### Paso 2 — Escanear el QR

1. Abrí los logs del contenedor:
   ```bash
   docker logs -f openwa
   ```
2. Aparecerá un **código QR** en la terminal
3. Abrí WhatsApp en tu teléfono → **Dispositivos vinculados → Vincular dispositivo**
4. Escaneá el QR
5. Cuando aparezca el mensaje `Client is ready!` en los logs, la conexión está establecida

La sesión se guarda en el volumen `openwa-session` — no necesitás re-escanear a menos que cierres la sesión desde el teléfono.

### Paso 3 — Verificar que OpenWA responde

```bash
curl http://localhost:8080/getConnectionState
```

Respuesta esperada:
```json
{ "response": "CONNECTED" }
```

---

## Parte 2 — Instalar y levantar el CRM

### Paso 4 — Clonar el repositorio

```bash
git clone https://github.com/marcosfermin/rinran-crm.git
cd rinran-crm
```

### Paso 5 — Configurar las variables de entorno

```bash
cp .env.example .env
```

Abrí `.env` y completá:

```env
# Puerto donde se accede al CRM desde el navegador
FRONTEND_PORT=3000

# URL del servidor OpenWA (sin slash final)
OPENWA_URL=http://localhost:8080

# API Key del servidor OpenWA (si lo configuraste con autenticación)
# Dejar vacío si no tiene autenticación
OPENWA_API_KEY=

# CORS (déjalo en * para empezar)
CORS_ORIGIN=*
```

> Si tu servidor OpenWA corre en otra máquina, reemplazá `localhost` por la IP o dominio de ese servidor. Ej: `http://192.168.1.50:8080`

### Paso 6 — Levantar con Docker

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos. Cuando termine:

```bash
docker compose ps
```

Deberías ver `rinran-backend` y `rinran-frontend` con estado `Up`.

Abrí el CRM en el navegador: **http://localhost:3000**

### Paso 7 — Verificar la conexión con OpenWA

```bash
curl http://localhost:3000/api/status
```

Respuesta esperada:

```json
{
  "crm": "ok",
  "openwa": { "connected": true, "state": "CONNECTED" },
  "openwa_url": "http://localhost:8080"
}
```

Si `connected` es `false`, revisá que el servidor OpenWA esté corriendo y que `OPENWA_URL` en el `.env` sea correcto.

---

## Parte 3 — Recibir mensajes entrantes (webhook)

Para que los mensajes que te llegan al WhatsApp aparezcan en la Bandeja del CRM, el servidor OpenWA tiene que avisarle al CRM cada vez que llega uno. Esto se hace configurando un webhook.

### Paso 8 — Configurar el webhook en OpenWA

En la configuración de tu servidor OpenWA, agregá la URL del webhook del CRM:

**Si usás Docker Compose en la misma máquina:**

Editá tu `docker-compose.openwa.yml` y agregá la variable de entorno:

```yaml
environment:
  - PORT=8080
  - API_KEY=tu_api_key_secreta
  - WEBHOOK_URL=http://rinran-backend:4000/webhook
```

> Usá el nombre del contenedor (`rinran-backend`) si OpenWA y el CRM están en la misma red Docker. Si están en máquinas distintas, usá la IP o dominio público del CRM.

**Si OpenWA está en otra máquina:**

```yaml
environment:
  - WEBHOOK_URL=https://tudominio.com/webhook
```

Reiniciá el contenedor OpenWA después del cambio:

```bash
docker compose -f docker-compose.openwa.yml restart
```

### Paso 9 — Verificar que llegan mensajes

Enviá un mensaje desde otro teléfono a tu número de WhatsApp. En pocos segundos debe aparecer en la **Bandeja** del CRM con:

- Nombre del contacto (tomado del perfil de WhatsApp)
- Número con bandera de país
- El mensaje recibido

Si no aparece, revisá los logs del backend:

```bash
docker compose logs -f backend
```

---

## Instalar en el teléfono

El CRM funciona desde el navegador del teléfono y se puede guardar en la pantalla de inicio como una app. Una vez instalado, abre en pantalla completa sin barra del browser — igual que una app nativa.

> Requiere que el CRM esté desplegado con HTTPS. No funciona desde `localhost`.

### iPhone — Safari

1. Abrí el CRM en **Safari** (debe ser Safari, no Chrome)
2. Tocá el botón de compartir — ícono de caja con flecha hacia arriba, en la barra inferior
3. Bajá en el menú hasta **"Agregar a pantalla de inicio"**
4. Ponele el nombre que quieras y tocá **Agregar**

### Android — Chrome

1. Abrí el CRM en **Chrome**
2. Tocá los tres puntos `⋮` arriba a la derecha
3. Tocá **"Agregar a pantalla de inicio"** o **"Instalar app"**
4. Confirmá con **Agregar**

> Chrome a veces muestra un banner automático abajo con el botón **"Instalar"** — podés usarlo directamente.

Desde la pantalla de inicio podés ver la Bandeja, responder chats y enviar broadcasts sin abrir el navegador manualmente.

---

## Parte 4 — Crear la campaña en Meta Ads

Esta parte es opcional. Si además de recibir mensajes directos querés capturar leads desde anuncios, podés crear una campaña con botón CTA a WhatsApp.

1. Ve a **[adsmanager.facebook.com](https://adsmanager.facebook.com)**
2. Clic en **Crear**
3. Objetivo: **Interacción** → subcategoría **Mensajes**
4. Plataforma: **WhatsApp**
5. Conectá tu número de WhatsApp
6. Diseñá el anuncio y elegí CTA **"Enviar mensaje"**

Cuando alguien haga clic y te escriba → OpenWA recibe el mensaje → el CRM lo captura automáticamente en la Bandeja.

---

## Estructura del proyecto

```
rinran-crm/
├── backend/
│   ├── src/
│   │   ├── server.js           Punto de entrada Express
│   │   ├── db.js               Conexión SQLite + schema + seed
│   │   ├── phoneUtils.js       Parser de teléfonos y detección de país
│   │   ├── whatsapp.js         Cliente OpenWA: sendText, getStatus, formato de números
│   │   └── routes/
│   │       ├── contacts.js     CRUD de contactos
│   │       ├── categories.js   CRUD de categorías
│   │       ├── messages.js     Envío individual y broadcast vía OpenWA
│   │       ├── inbox.js        Bandeja de conversaciones con no leídos
│   │       ├── stats.js        Estadísticas del dashboard
│   │       ├── status.js       Estado de conexión con OpenWA
│   │       └── webhook.js      Receptor de eventos del servidor OpenWA
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             Router + sidebar desktop + nav móvil
│   │   ├── index.css
│   │   ├── hooks/
│   │   │   └── useApi.js
│   │   └── pages/
│   │       ├── Inbox.jsx       Bandeja de conversaciones (pantalla principal)
│   │       ├── Dashboard.jsx   Estadísticas
│   │       ├── Contacts.jsx    Lista/tarjetas de contactos
│   │       ├── ContactDetail.jsx  Chat individual con polling automático
│   │       ├── Broadcast.jsx   Envío masivo + historial
│   │       └── Categories.jsx  Gestión de categorías
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
├── .env.example
├── .gitignore
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
| Teléfonos | libphonenumber-js |
| WhatsApp | OpenWA server (vía REST API) |
| HTTP client | Axios |

### Frontend
| Capa | Tecnología |
|------|-----------|
| UI | React 18 |
| Routing | React Router 6 |
| Estilos | Tailwind CSS 3 |
| Build | Vite 5 |
| Iconos | Lucide React |
| Servidor | Nginx (producción) |

### Infraestructura
| Elemento | Detalle |
|----------|---------|
| Contenedores | Docker + Docker Compose |
| Red interna | Bridge `rinran` |
| Persistencia | Docker volume `crm-data` → `/data/rinran.db` |

---

## API REST

Base URL: `http://localhost:3000/api`

### Contactos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/contacts` | Lista paginada. Params: `search`, `category_id`, `status`, `page`, `limit` |
| `GET` | `/contacts/:id` | Detalle + historial de mensajes |
| `POST` | `/contacts` | Crear. Body: `name`, `phone`, `category_id?`, `notes?` |
| `PATCH` | `/contacts/:id` | Actualizar. Body: `name?`, `category_id?`, `notes?`, `status?` |
| `DELETE` | `/contacts/:id` | Eliminar contacto y sus mensajes |

### Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/categories` | Lista con conteo de contactos |
| `POST` | `/categories` | Crear. Body: `name`, `color` (hex) |
| `PATCH` | `/categories/:id` | Actualizar nombre o color |
| `DELETE` | `/categories/:id` | Eliminar |

### Mensajes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/messages/send` | Envío individual vía OpenWA. Body: `contact_id`, `message` |
| `POST` | `/messages/broadcast` | Envío masivo. Body: `name?`, `message`, `category_id?` |
| `GET` | `/messages/broadcasts` | Historial de broadcasts |

### Bandeja

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/inbox` | Conversaciones ordenadas por último mensaje, con no leídos. Param: `search` |
| `PATCH` | `/inbox/:id/read` | Marca mensajes entrantes de un contacto como leídos |

### Estado y Webhook

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/status` | Estado de conexión del CRM con el servidor OpenWA |
| `POST` | `/webhook` | Receptor de eventos del servidor OpenWA (mensajes entrantes) |

---

## Formato de números

OpenWA usa el formato `{número}@c.us`. El CRM convierte automáticamente:

| Dirección | Formato | Ejemplo |
|-----------|---------|---------|
| CRM → OpenWA | `número@c.us` | `5491122334455@c.us` |
| OpenWA → CRM | E.164 con `+` | `+5491122334455` |

---

## Flujo completo de mensajes

```
  Alguien te escribe al WhatsApp
            │
            │ OpenWA detecta el mensaje
            ▼
  [Servidor OpenWA]
            │
            │ POST /webhook (evento tipo "message")
            ▼
     [Rinran CRM — webhook.js]
            │
       ┌────┴────┐
       │         │
   nuevo     existente
  contacto   contacto
       │         │
  se crea    se agrega
  automát.   al historial
       │         │
       └────┬────┘
            ▼
   [Bandeja — badge de no leído]
            │
       ┌────┴────┐
       │         │
  Respondés   Broadcast
  en el chat  por categoría
            │
            ▼
    [OpenWA envía el mensaje]
            │
            ▼
  [WhatsApp del contacto]
```

---

## Comandos útiles

```bash
# Ver logs en vivo
docker compose logs -f

# Ver logs solo del backend
docker compose logs -f backend

# Verificar conexión con OpenWA
curl http://localhost:3000/api/status

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
- Servidor OpenWA accesible desde el VPS

### Instalar Docker en Ubuntu

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### Clonar y configurar

```bash
git clone https://github.com/marcosfermin/rinran-crm.git
cd rinran-crm
cp .env.example .env
nano .env
docker compose up -d --build
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

El CRM queda en `https://tudominio.com` y el webhook en `https://tudominio.com/webhook`.

---

## Checklist completo

**Servidor OpenWA**
- [ ] OpenWA corriendo y conectado al WhatsApp (QR escaneado)
- [ ] `curl http://openwa-url:puerto/getConnectionState` responde `CONNECTED`
- [ ] Webhook configurado en OpenWA apuntando a `http://rinran-backend:4000/webhook` (o URL pública)

**CRM**
- [ ] `.env` completado con `OPENWA_URL` y `OPENWA_API_KEY` (si aplica)
- [ ] `docker compose up -d --build` sin errores
- [ ] `GET /api/status` responde `connected: true`

**Prueba de mensajes**
- [ ] Enviar un mensaje desde otro WhatsApp al número conectado
- [ ] El contacto aparece en la Bandeja del CRM automáticamente
- [ ] Responder desde el CRM y verificar que llega al WhatsApp

**Teléfono (opcional)**
- [ ] Abrir el CRM desde Safari (iPhone) o Chrome (Android)
- [ ] Agregar a pantalla de inicio
- [ ] Verificar que abre en pantalla completa

**Campaña Meta Ads (opcional)**
- [ ] Campaña creada con objetivo Mensajes y CTA a WhatsApp

---

## Licencia

MIT
