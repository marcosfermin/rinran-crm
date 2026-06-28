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
| Cuenta de Facebook | — |
| Número de teléfono libre (sin WhatsApp instalado) | — |

> No necesitas Node.js ni nada más instalado localmente. Docker lo maneja todo.

---

## Parte 1 — Configurar Meta y WhatsApp Business API

Antes de levantar el CRM necesitas crear una App en Meta y registrar tu número. Sigue estos pasos en orden.

### Paso 1 — Crear una cuenta de Meta Business Manager

Si ya tienes una, salta al paso 2.

1. Ve a **[business.facebook.com](https://business.facebook.com)**
2. Clic en **Crear cuenta**
3. Ingresa el nombre de tu negocio, tu nombre y tu correo
4. Verifica tu correo cuando te llegue el email de confirmación

---

### Paso 2 — Crear la App en Meta for Developers

1. Ve a **[developers.facebook.com](https://developers.facebook.com)**
2. Inicia sesión con tu cuenta de Facebook
3. Clic en **Mis Apps → Crear App**
4. Selecciona el tipo: **Business**

   > Si no ves la opción "Business", selecciona "Otro" y luego "Business".

5. Completa el formulario:
   - **Nombre de la app**: `Rinran CRM` (o el que prefieras)
   - **Correo de contacto**: tu correo
   - **Cuenta de Business Manager**: selecciona la que creaste en el Paso 1
6. Clic en **Crear App** y confirma con tu contraseña de Facebook

---

### Paso 3 — Agregar WhatsApp a tu App

1. Dentro del panel de tu app, ve al menú lateral y busca **Agregar productos**
2. Encuentra **WhatsApp** y haz clic en **Configurar**
3. Acepta las condiciones del servicio de WhatsApp Business

---

### Paso 4 — Registrar tu número de teléfono

> El número que uses **no puede tener WhatsApp instalado** (ni personal ni Business). Si lo tiene, primero elimina la cuenta de WhatsApp de ese número.

1. En el menú lateral, ve a **WhatsApp → Configuración de la API**
2. Baja hasta la sección **Número de teléfono** y clic en **Agregar número de teléfono**
3. Completa el perfil del negocio:
   - Nombre del negocio
   - Zona horaria
   - Categoría
4. Ingresa tu número de teléfono con código de país (ej: `+1 555 123 4567`)
5. Elige verificación por **SMS** o **llamada de voz**
6. Ingresa el código de 6 dígitos que recibes

   > Meta también te da un **número de prueba gratuito** en esa misma pantalla. Puedes usarlo para probar sin registrar el tuyo, pero solo permite enviar mensajes a hasta 5 números verificados manualmente.

---

### Paso 5 — Obtener el Token de Acceso permanente

El token temporal que aparece en el panel expira en 24 horas. Para producción necesitas uno permanente.

1. Ve a **[business.facebook.com/settings](https://business.facebook.com/settings)**
2. En el menú lateral: **Usuarios → Usuarios del sistema**
3. Clic en **Agregar** → nombre: `rinran-bot`, rol: **Administrador**
4. Una vez creado, clic en **Generar nuevo token**
5. Selecciona tu app (`Rinran CRM`)
6. Activa los permisos:
   - `whatsapp_business_messaging` ✓
   - `whatsapp_business_management` ✓
7. Clic en **Generar token** y **cópialo ahora** — no lo verás de nuevo

   Ese token va en `WA_ACCESS_TOKEN` de tu `.env`.

---

### Paso 6 — Copiar el ID del número de teléfono

1. Ve a **WhatsApp → Configuración de la API** dentro de tu app
2. En la sección **Número de teléfono**, verás tu número listado
3. Debajo del número hay un campo **ID de número de teléfono** — cópialo

   Ese valor va en `WA_PHONE_NUMBER_ID` de tu `.env`.

---

## Parte 2 — Instalar y levantar el CRM

### Paso 7 — Clonar el repositorio

```bash
git clone https://github.com/marcosfermin/rinran-crm.git
cd rinran-crm
```

### Paso 8 — Configurar las variables de entorno

```bash
cp .env.example .env
```

Abre `.env` y completa con tus datos:

```env
# Puerto local donde se accede al CRM desde el navegador
FRONTEND_PORT=3000

# Token permanente del usuario de sistema (Paso 5)
WA_ACCESS_TOKEN=EAAxxxxxxxxxxxxxx

# ID del número de teléfono (Paso 6)
WA_PHONE_NUMBER_ID=123456789012345

# Token de verificación del webhook — invéntalo tú, cualquier texto secreto
WA_VERIFY_TOKEN=mi_token_secreto_2026

# CORS (déjalo en * para empezar)
CORS_ORIGIN=*
```

### Paso 9 — Levantar con Docker

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos mientras construye las imágenes. Cuando termine:

```bash
# Verificar que los contenedores están corriendo
docker compose ps
```

Deberías ver `rinran-backend` y `rinran-frontend` con estado `Up`.

Abre el CRM en tu navegador: **http://localhost:3000**

---

## Parte 3 — Conectar el webhook de Meta

El webhook es el canal por donde Meta te avisa cuando alguien te escribe. Necesita una URL pública con HTTPS.

### Opción A — Servidor en producción (recomendado)

Si tienes un VPS con dominio, ve directo al [Despliegue en producción](#despliegue-en-producción) para configurar HTTPS, luego vuelve aquí.

Tu URL de webhook será: `https://tudominio.com/webhook`

### Opción B — Prueba local con ngrok

Si quieres probar antes de tener servidor:

1. Descarga ngrok desde **[ngrok.com/download](https://ngrok.com/download)**
2. Crea una cuenta gratuita y copia tu authtoken
3. Ejecuta:

```bash
ngrok config add-authtoken TU_AUTHTOKEN
ngrok http 3000
```

4. ngrok te dará una URL pública como `https://abc123.ngrok-free.app` — úsala como tu dominio en los pasos siguientes

---

### Paso 10 — Registrar el webhook en Meta

1. Ve a tu app en **[developers.facebook.com](https://developers.facebook.com)**
2. Menú lateral: **WhatsApp → Configuración**
3. Baja hasta la sección **Webhook** y clic en **Editar**
4. Completa los campos:
   - **URL de devolución de llamada**: `https://tudominio.com/webhook`
   - **Token de verificación**: el mismo valor que pusiste en `WA_VERIFY_TOKEN`
5. Clic en **Verificar y guardar**

   > Meta enviará un GET a tu URL para confirmar que responde. Si el CRM está corriendo, responderá automáticamente y verás el mensaje "Webhook verificado".

6. Una vez verificado, activa la suscripción:
   - Busca el evento **messages** y activa el toggle ✓

---

### Paso 11 — Verificar que todo funciona

Toma otro teléfono con WhatsApp y envía un mensaje a tu número registrado. En pocos segundos el contacto debe aparecer en el CRM con:

- Su nombre (tomado del perfil de WhatsApp)
- Su número con código de país
- La bandera de su país
- Fuente: `whatsapp`

Si no aparece, revisa los logs:

```bash
docker compose logs -f backend
```

---

## Parte 4 — Crear la campaña en Meta Ads

### Paso 12 — Crear anuncio con CTA a WhatsApp

1. Ve a **[adsmanager.facebook.com](https://adsmanager.facebook.com)**
2. Clic en **Crear**
3. Objetivo: **Interacción** → subcategoría **Mensajes**
4. Plataforma de mensajería: **WhatsApp**
5. Conecta la página de Facebook de tu negocio y el número de WhatsApp registrado
6. Diseña tu anuncio (imagen/video + texto)
7. En el CTA (llamada a la acción) selecciona **Enviar mensaje**
8. El mensaje de bienvenida que aparece cuando el usuario abre WhatsApp puedes personalizarlo

Cuando alguien haga clic en el anuncio y te escriba → el CRM lo captura automáticamente.

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

Base URL: `http://localhost:3000/api`

### Contactos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/contacts` | Lista paginada. Params: `search`, `category_id`, `status`, `page`, `limit` |
| `GET` | `/contacts/:id` | Detalle + historial de mensajes |
| `POST` | `/contacts` | Crear contacto. Body: `name`, `phone`, `category_id?`, `notes?` |
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
| `POST` | `/messages/send` | Envío individual. Body: `contact_id`, `message` |
| `POST` | `/messages/broadcast` | Envío masivo. Body: `name?`, `message`, `category_id?` |
| `GET` | `/messages/broadcasts` | Historial de broadcasts |

### Estadísticas y Webhook

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/stats` | Totales, distribución por país y categoría |
| `GET` | `/webhook` | Verificación del webhook por Meta |
| `POST` | `/webhook` | Recepción de mensajes entrantes |

---

## Base de datos

SQLite con WAL mode. Archivo persistido en el volumen Docker `crm-data` (`/data/rinran.db`).

| Tabla | Descripción |
|-------|-------------|
| `categories` | Etiquetas con nombre y color |
| `contacts` | Contactos con teléfono, país, categoría y fuente |
| `messages` | Historial de mensajes entrantes y salientes |
| `broadcasts` | Registro de envíos masivos con contadores |

### Categorías creadas automáticamente al iniciar

| Nombre | Color |
|--------|-------|
| Lead | Amarillo `#f59e0b` |
| Cliente | Verde `#10b981` |
| VIP | Violeta `#8b5cf6` |
| Inactivo | Gris `#6b7280` |

---

## Flujo completo de una campaña

```
[Anuncio en Meta/Instagram]
          │
          │  Usuario hace clic en "Enviar mensaje"
          ▼
[WhatsApp del usuario → Tu número Business]
          │
          │  Meta envía el evento al webhook del CRM
          ▼
[POST /webhook]
          │
          ├─ ¿El teléfono ya existe? → agrega mensaje al historial
          │
          └─ ¿Es nuevo? → crea contacto automáticamente
                          (nombre del perfil WA + bandera por código de área)
          │
          ▼
[Contacto visible en el CRM]
          │
          ├─ Lo categorizas (Lead, Cliente, VIP...)
          │
          └─ Le envías mensajes:
               · Individual → vista de chat
               · Masivo     → Broadcast por categoría
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

# Rebuild completo después de cambios en el código
docker compose up -d --build

# Entrar al contenedor del backend
docker compose exec backend sh

# Backup de la base de datos
docker compose exec backend sh -c "cp /data/rinran.db /data/backup_$(date +%Y%m%d).db"

# Detener todo
docker compose down
```

---

## Despliegue en producción

### Requisitos del servidor
- VPS con Ubuntu 22.04+ (o cualquier Linux)
- Docker + Docker Compose instalados
- Dominio apuntando al IP del servidor

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
nano .env   # completar con tus credenciales
docker compose up -d --build
```

### Configurar HTTPS con Nginx + Certbot

```bash
# Instalar Nginx y Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Crear configuración de Nginx
sudo nano /etc/nginx/sites-available/rinran
```

Contenido del archivo:

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
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/rinran /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Generar certificado SSL (reemplaza tudominio.com con el tuyo)
sudo certbot --nginx -d tudominio.com

# Certbot edita la config automáticamente para HTTPS
sudo systemctl reload nginx
```

Tu CRM estará disponible en `https://tudominio.com` y el webhook en `https://tudominio.com/webhook`.

---

## Checklist completo antes de recibir leads

- [ ] Cuenta de Meta Business Manager creada
- [ ] App de Meta tipo Business creada
- [ ] WhatsApp agregado como producto en la app
- [ ] Número de teléfono registrado y verificado
- [ ] Token de acceso permanente generado (usuario de sistema)
- [ ] `.env` completado con `WA_ACCESS_TOKEN` y `WA_PHONE_NUMBER_ID`
- [ ] CRM corriendo: `docker compose up -d --build`
- [ ] Dominio con HTTPS apuntando al servidor
- [ ] Webhook registrado en Meta y verificado
- [ ] Evento `messages` suscrito en el webhook
- [ ] Prueba: enviar un mensaje desde otro WhatsApp y verificar que aparece en el CRM
- [ ] Campaña de Meta Ads creada con CTA a WhatsApp

---

## Licencia

MIT
