# Rinran CRM

CRM para gestionar contactos de WhatsApp captados desde campañas de Meta. Guarda automáticamente a quienes te escriben, detecta su país por el código de área, los categoriza y permite enviarles mensajes individuales o masivos desde una interfaz web.

---

## Características

- **Captura automática** — Cuando alguien te escribe desde tu campaña de Meta (botón CTA a WhatsApp), el contacto se crea solo con su nombre y teléfono.
- **Bandera de país** — Detecta el país de cada contacto por su código de área (`+52` → 🇲🇽, `+54` → 🇦🇷, `+55` → 🇧🇷, etc.).
- **Categorías con colores** — Clasifica contactos en Lead, Cliente, VIP, Inactivo o las que crees.
- **Mensajería individual** — Vista de chat por contacto con historial completo de conversación.
- **Broadcast masivo** — Envía un mensaje a toda una categoría o a todos tus contactos activos.
- **Dashboard** — Estadísticas en tiempo real: contactos por país, por categoría, mensajes enviados.
- **Todo en Docker** — Un solo comando levanta backend + frontend + base de datos.

---

## Requisitos

| Herramienta | Versión mínima |
|-------------|---------------|
| Docker | 24+ |
| Docker Compose | v2+ |
| Cuenta Meta Business | — |
| Número WhatsApp Business API | — |

> No necesitas Node.js ni nada más instalado localmente. Docker lo maneja todo.

---

## Instalación rápida

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/rinran-crm.git
cd rinran-crm

# 2. Crear el archivo de variables de entorno
cp .env.example .env
```

Edita `.env` con tus credenciales (ver sección [Variables de entorno](#variables-de-entorno)).

```bash
# 3. Construir y levantar
docker compose up -d --build

# 4. Abrir en el navegador
open http://localhost:3000
```

Para detener:

```bash
docker compose down
```

---

## Variables de entorno

Archivo: `.env` (copia de `.env.example`)

```env
# Puerto local donde se accede al frontend
FRONTEND_PORT=3000

# Token de acceso permanente de tu App de Meta
WA_ACCESS_TOKEN=your_permanent_access_token_here

# ID del número de teléfono en WhatsApp Business
WA_PHONE_NUMBER_ID=your_phone_number_id_here

# Token de verificación para el webhook (tú lo eliges)
WA_VERIFY_TOKEN=rinran_secret_token_2026

# CORS (opcional, * permite todo)
CORS_ORIGIN=*
```

### Cómo obtener los valores de Meta

1. Entra a [Meta for Developers](https://developers.facebook.com/) y abre tu app.
2. Ve a **WhatsApp > Configuración de la API**.
3. Copia el **Token de acceso** (genera uno permanente desde la página de tokens de sistema).
4. Copia el **ID de número de teléfono** que aparece en esa misma pantalla.
5. El `WA_VERIFY_TOKEN` lo defines tú — cualquier cadena secreta sirve. Lo vas a usar al registrar el webhook.

---

## Configurar el webhook en Meta

El webhook recibe los mensajes que te envían tus contactos de WhatsApp. Meta necesita una URL pública para enviarte esos eventos.

### Si estás en desarrollo local (con ngrok)

```bash
# Instalar ngrok: https://ngrok.com/download
ngrok http 3000
# Copia la URL pública que aparece, ej: https://abc123.ngrok.io
```

### Registrar el webhook

1. En Meta for Developers, ve a **WhatsApp > Configuración**.
2. En la sección **Webhook**, haz clic en **Editar**.
3. Completa los campos:
   - **URL de devolución de llamada**: `https://tudominio.com/webhook`
   - **Token de verificación**: el mismo valor que pusiste en `WA_VERIFY_TOKEN`
4. Haz clic en **Verificar y guardar**.
5. Activa la suscripción al evento **messages**.

### Verificar que funciona

Escríbete desde otro WhatsApp al número registrado. El contacto debe aparecer automáticamente en el CRM con su nombre y bandera del país.

---

## Estructura del proyecto

```
rinran-crm/
├── backend/                    API REST + lógica de negocio
│   ├── src/
│   │   ├── server.js           Punto de entrada Express
│   │   ├── db.js               Conexión SQLite + schema + seed
│   │   ├── phoneUtils.js       Parser de teléfonos y detección de país
│   │   └── routes/
│   │       ├── contacts.js     CRUD de contactos
│   │       ├── categories.js   CRUD de categorías
│   │       ├── messages.js     Envío individual y broadcast
│   │       ├── stats.js        Estadísticas del dashboard
│   │       └── webhook.js      Receptor de mensajes de Meta
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   Interfaz React
│   ├── src/
│   │   ├── main.jsx            Punto de entrada React
│   │   ├── App.jsx             Router + sidebar
│   │   ├── index.css           Tailwind base
│   │   ├── hooks/
│   │   │   └── useApi.js       Cliente HTTP genérico
│   │   └── pages/
│   │       ├── Dashboard.jsx   Estadísticas y gráficos
│   │       ├── Contacts.jsx    Lista con filtros y búsqueda
│   │       ├── ContactDetail.jsx  Chat individual + edición
│   │       ├── Broadcast.jsx   Envío masivo + historial
│   │       └── Categories.jsx  Gestión de categorías
│   ├── Dockerfile              Build multi-stage (Vite → Nginx)
│   ├── nginx.conf              Proxy API + SPA routing
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
| Base de datos | SQLite vía `node:sqlite` (módulo nativo de Node.js 22) |
| Teléfonos | libphonenumber-js |
| WhatsApp | Meta Cloud API v20 |
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
| Persistencia | Docker volume `crm-data` montado en `/data` |

---

## API REST

Base URL: `http://localhost:3000/api` (en producción, tu dominio)

### Contactos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/contacts` | Lista paginada. Params: `search`, `category_id`, `status`, `page`, `limit` |
| `GET` | `/contacts/:id` | Detalle + historial de mensajes |
| `POST` | `/contacts` | Crear contacto. Body: `name`, `phone`, `category_id?`, `notes?`, `source?` |
| `PATCH` | `/contacts/:id` | Actualizar campos. Body: `name?`, `category_id?`, `notes?`, `status?` |
| `DELETE` | `/contacts/:id` | Eliminar contacto y sus mensajes |

**Ejemplo — crear contacto:**
```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"name": "Juan Pérez", "phone": "+5491122334455", "category_id": 1}'
```

**Respuesta:**
```json
{
  "id": 1,
  "name": "Juan Pérez",
  "phone": "+5491122334455",
  "country_code": "AR",
  "country_flag": "🇦🇷",
  "country_name": "Argentina",
  "category_id": 1,
  "status": "active",
  "source": "manual",
  "created_at": "2026-06-28 21:15:06"
}
```

### Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/categories` | Lista con conteo de contactos por categoría |
| `POST` | `/categories` | Crear. Body: `name`, `color` (hex) |
| `PATCH` | `/categories/:id` | Actualizar nombre o color |
| `DELETE` | `/categories/:id` | Eliminar (contactos quedan sin categoría) |

### Mensajes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/messages/send` | Enviar mensaje individual. Body: `contact_id`, `message` |
| `POST` | `/messages/broadcast` | Envío masivo. Body: `name?`, `message`, `category_id?` |
| `GET` | `/messages/broadcasts` | Historial de broadcasts |

**Ejemplo — broadcast a una categoría:**
```bash
curl -X POST http://localhost:3000/api/messages/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promo Julio",
    "message": "Hola! Tenemos una oferta especial para ti 🎉",
    "category_id": 1
  }'
```

**Respuesta inmediata** (el envío continúa en background):
```json
{ "broadcast_id": 1, "total": 42 }
```

### Estadísticas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/stats` | Totales, nuevos hoy, mensajes, distribución por país y categoría |

### Webhook

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/webhook` | Verificación del webhook por Meta |
| `POST` | `/webhook` | Recepción de mensajes entrantes |

---

## Base de datos

SQLite con WAL mode. Archivo en el volumen Docker `crm-data` (`/data/rinran.db`).

### Tablas

#### `categories`
```sql
id, name (UNIQUE), color, created_at
```

#### `contacts`
```sql
id, name, phone (UNIQUE), country_code, country_flag, country_name,
category_id (FK → categories), notes, status, source, created_at, updated_at
```
- `status`: `active` | `inactive`
- `source`: `manual` | `whatsapp`

#### `messages`
```sql
id, contact_id (FK → contacts), direction, content,
wa_message_id, status, sent_at
```
- `direction`: `inbound` | `outbound`

#### `broadcasts`
```sql
id, name, message, category_id (FK → categories),
total_recipients, sent_count, failed_count, status, created_at, sent_at
```
- `status`: `draft` | `sending` | `completed`

### Categorías por defecto (seed)

| Nombre | Color |
|--------|-------|
| Lead | `#f59e0b` 🟡 |
| Cliente | `#10b981` 🟢 |
| VIP | `#8b5cf6` 🟣 |
| Inactivo | `#6b7280` ⚫ |

---

## Flujo completo de una campaña

```
[Anuncio en Meta/Instagram]
          │
          │ Usuario hace clic en "Enviar mensaje"
          ▼
[WhatsApp del usuario → Tu número Business]
          │
          │ Meta envía el evento a tu webhook
          ▼
[POST /webhook]
          │
          ├─ ¿El teléfono ya existe? → agrega el mensaje al historial
          │
          └─ ¿Es nuevo? → crea contacto automáticamente
                           (nombre del perfil de WA, bandera por código de área, source = "whatsapp")
          │
          ▼
[Contacto visible en el CRM]
          │
          ├─ Lo categorías (Lead, Cliente, etc.)
          │
          └─ Le envías mensajes desde el CRM:
               - Individual: vista de chat
               - Masivo: Broadcast → seleccionas categoría → envía a todos
```

---

## Comandos útiles

```bash
# Ver logs en vivo
docker compose logs -f

# Ver logs solo del backend
docker compose logs -f backend

# Reiniciar un servicio sin rebuild
docker compose restart backend

# Rebuild y reiniciar (después de cambios en código)
docker compose up -d --build

# Entrar al contenedor del backend
docker compose exec backend sh

# Hacer backup de la base de datos
docker compose exec backend sh -c "cp /data/rinran.db /data/backup_$(date +%Y%m%d).db"

# Ver el contenido de la base de datos directamente
docker compose exec backend node --experimental-sqlite -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/data/rinran.db');
  console.log(db.prepare('SELECT * FROM contacts LIMIT 10').all());
"
```

---

## Despliegue en producción

### Con dominio propio (VPS)

1. Apunta tu dominio al IP del servidor.
2. Instala Nginx + Certbot en el host para el SSL:

```nginx
server {
    listen 443 ssl;
    server_name tudominio.com;

    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. Cambia `FRONTEND_PORT=3000` en tu `.env` si el host ya usa ese puerto.

### Importante para el webhook

Meta requiere HTTPS con certificado válido para el webhook. La URL que registras en Meta debe ser la URL pública con SSL, ej:

```
https://tudominio.com/webhook
```

---

## Licencia

MIT
