# ToysBot - Bot de WhatsApp Inteligente para Tienda de Juguetes

## 🎯 Descripción

ToysBot es un bot de WhatsApp inteligente diseñado específicamente para **Toys**, la cadena líder en juguetes educativos, sostenibles y de tendencias en Nicaragua. El bot detecta automáticamente el origen de los mensajes (ads de Facebook/Instagram vs consultas generales) y proporciona respuestas personalizadas según el contexto.

## ✨ Características Principales

### 🎯 Detección Inteligente de Origen
- **Detección automática** de usuarios que vienen de ads de Facebook/Instagram
- **Extracción de contexto** del producto anunciado
- **Respuestas personalizadas** según el origen del mensaje
- **Seguimiento de conversación** contextual

### 🔗 Integración con Odoo
- **Registro automático** de todas las interacciones
- **Consulta de historial** del cliente (si está registrado)
- **Sincronización** con CRM de la empresa
- **Métricas y reportes** de conversaciones

### 🌍 Soporte Multiidioma
- **Español predeterminado** (idioma principal)
- **Detección automática** de preferencia de idioma
- **Respuestas contextuales** en el idioma del usuario

### 📱 Funcionalidades del Bot

#### Para Usuarios de Ads (Facebook/Instagram):
1. **Precio** - Información detallada de precios
2. **Stock** - Disponibilidad en tiempo real
3. **Descripción** - Características del producto
4. **Otras opciones** - Productos similares, promociones, sucursales

#### Para Usuarios Generales:
1. **Consultar precio** de productos específicos
2. **Buscar productos** por categoría/edad/género/marca/precio
3. **Ver descuentos** y promociones vigentes
4. **Información de sucursales** y horarios
5. **Compra online** con enlaces directos

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 16+ 
- WhatsApp Web conectado
- Cuenta de desarrollador de Meta (para ads)
- Instancia de Odoo (opcional)

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd base-js-baileys-memory
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crear un archivo `.env` en la raíz del proyecto:

```env
# Configuración de Odoo
ODOO_URL=https://tu-odoo.com
ODOO_API_KEY=tu-api-key-odoo
ODOO_DB=tu-database-odoo

# Configuración de Meta (Facebook/Instagram)
META_ACCESS_TOKEN=tu-meta-access-token
META_APP_ID=tu-meta-app-id

# Configuración del servidor
PORT=4000
WEBHOOK_PORT=4001
NODE_ENV=development
```

### 4. Ejecutar el bot
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🔧 Configuración de Integraciones

### Meta API (Facebook/Instagram Ads)
1. Crear una app en [Meta Developer Console](https://developers.facebook.com/)
2. Configurar el webhook en: `http://tu-dominio:4001/webhook/meta`
3. Agregar el token de acceso en las variables de entorno
4. Configurar los parámetros de tracking en los ads

### Odoo CRM
1. Instalar el módulo WhatsApp en Odoo
2. Configurar la API key en las variables de entorno
3. El bot registrará automáticamente todas las interacciones
4. Consultar historial de clientes en tiempo real

## 📱 Uso del Bot

### Flujo para Usuarios de Ads:
1. Usuario hace clic en ad de Facebook/Instagram
2. Meta envía contexto del producto al webhook
3. Bot detecta origen y saluda personalizadamente
4. Ofrece opciones específicas del producto anunciado
5. Registra interacción en Odoo

### Flujo para Usuarios Generales:
1. Usuario escribe "hola" en WhatsApp
2. Bot detecta origen general
3. Ofrece menú completo de opciones
4. Guía al usuario según su selección
5. Registra interacción en Odoo

## 🎨 Personalización

### Modificar Respuestas
Editar el archivo `src/bot-final.js` para personalizar:
- Mensajes de saludo
- Opciones del menú
- Respuestas específicas
- Lógica de detección

### Configuración de Productos
Editar el archivo `config.js` para modificar:
- Catálogo de productos
- Categorías disponibles
- Promociones vigentes
- Información de sucursales

## 📊 Monitoreo y Reportes

### Logs del Bot
- Todas las interacciones se registran en consola
- Webhook de Meta registra contexto de ads
- Integración con Odoo para reportes empresariales

### Métricas Disponibles
- Usuarios por origen (ads vs general)
- Productos más consultados
- Conversiones de ads
- Tiempo de respuesta del bot

## 🛠️ Estructura del Proyecto

```
base-js-baileys-memory/
├── src/
│   ├── bot-final.js          # Bot principal
│   └── app.js               # Bot original
├── config.js                # Configuración centralizada
├── package.json             # Dependencias
├── README.md               # Documentación
└── .env                    # Variables de entorno
```

## 🔍 Solución de Problemas

### Bot no responde
1. Verificar conexión a WhatsApp Web
2. Revisar logs en consola
3. Confirmar que el QR fue escaneado

### Webhook no funciona
1. Verificar puerto 4001 esté abierto
2. Confirmar configuración en Meta Developer Console
3. Revisar logs del webhook

### Error de Odoo
1. Verificar credenciales en variables de entorno
2. Confirmar que el módulo WhatsApp esté instalado
3. Revisar conectividad de red

## 📞 Soporte

Para soporte técnico o consultas sobre la implementación:
- Revisar logs del bot
- Verificar configuración de variables de entorno
- Consultar documentación de Meta API y Odoo

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

## 🎉 Agradecimientos

Desarrollado para **Toys Nicaragua** con tecnología de WhatsApp Web.js y Baileys.