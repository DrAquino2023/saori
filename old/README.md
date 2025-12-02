# 🌸 Bella Estética - Sistema de Gestión de Turnos

Sistema completo de gestión de turnos para centro de estética con integración de Mercado Pago, diseño responsive y optimización para conversiones.

## ✨ Características Principales

### 🎯 Marketing Digital Integrado
- **SEO optimizado** con Schema.org y meta tags
- **Google Analytics 4** y Facebook Pixel configurados
- **Newsletter popup** con lead magnets
- **WhatsApp integration** con tracking de conversiones
- **Promociones dinámicas** (30% OFF primera visita)

### 💅 Sistema de Reservas
- **Calendario interactivo** con disponibilidad en tiempo real
- **4 pasos simples** para completar la reserva
- **Validación automática** de horarios disponibles
- **Descuentos automáticos** para nuevos clientes
- **Confirmación por email** automática

### 💳 Integración Mercado Pago
- **Pagos seguros** con Mercado Pago
- **Múltiples métodos** de pago
- **Procesamiento en tiempo real**
- **Notificaciones automáticas**

### 📱 Diseño Responsive
- **Mobile-first** design
- **Optimizado para conversión**
- **Animaciones suaves**
- **Carga rápida**

## 🚀 Instalación Rápida

### Prerrequisitos
- Node.js 16+ y npm
- MySQL 8.0+
- Cuenta de Mercado Pago (para pagos)
- Gmail con App Password (para emails)

### 1. Clonar y Configurar
```bash
# Clonar el proyecto
git clone https://github.com/tu-usuario/bella-estetica.git
cd bella-estetica

# Instalar dependencias del backend
cd backend
npm install

# Volver al directorio raíz
cd ..
```

### 2. Configurar Base de Datos
```sql
-- Crear base de datos en MySQL
CREATE DATABASE bella_estetica CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- El sistema creará las tablas automáticamente al iniciar
```

### 3. Configurar Variables de Entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus configuraciones
nano .env
```

**Variables importantes a configurar:**
- `DB_PASSWORD`: Tu password de MySQL
- `MP_PUBLIC_KEY` y `MP_ACCESS_TOKEN`: Claves de Mercado Pago
- `EMAIL_USER` y `EMAIL_PASSWORD`: Credenciales de Gmail
- `GA_MEASUREMENT_ID`: ID de Google Analytics (opcional)

### 4. Iniciar el Sistema
```bash
# Desde el directorio backend
cd backend
npm run dev

# El servidor estará disponible en http://localhost:3000
```

## 📂 Estructura del Proyecto

```
bella-estetica/
├── 📁 frontend/                  # Archivos del cliente (HTML, CSS, JS)
│   ├── 📄 index.html            # Página principal del sitio
│   ├── 📁 css/
│   │   └── 📄 styles.css        # Estilos principales responsive
│   ├── 📁 js/
│   │   ├── 📄 main.js           # JavaScript principal (UI, analytics)
│   │   └── 📄 booking.js        # Sistema de reservas completo
│   └── 📁 assets/               # Imágenes y recursos estáticos
│
├── 📁 backend/                   # Servidor Node.js
│   ├── 📄 server.js             # Servidor principal con todas las rutas
│   ├── 📄 package.json          # Dependencias del backend
│   ├── 📁 routes/               # Rutas API organizadas (futuro)
│   ├── 📁 models/               # Modelos de base de datos (futuro)
│   └── 📁 config/               # Configuraciones (futuro)
│
├── 📁 database/                  # Archivos de base de datos
│   └── 📄 schema.sql            # Esquema de la base de datos (auto-generado)
│
├── 📄 .env                      # Variables de entorno (NO subir a git)
├── 📄 .env.example             # Ejemplo de variables de entorno
├── 📄 .gitignore               # Archivos a ignorar en git
├── 📄 README.md                # Este archivo
└── 📄 package.json             # Configuración del proyecto principal
```

## 🔧 Configuración Detallada

### Mercado Pago
1. Crear cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/)
2. Crear una aplicación
3. Obtener las claves de TEST y PRODUCCIÓN
4. Configurar en `.env`:
   ```env
   MP_PUBLIC_KEY=TEST-tu-clave-publica
   MP_ACCESS_TOKEN=TEST-tu-access-token
   ```

### Email (Gmail)
1. Activar verificación en 2 pasos en Gmail
2. Generar una "App Password"
3. Configurar en `.env`:
   ```env
   EMAIL_USER=tu-email@gmail.com
   EMAIL_PASSWORD=tu-app-password-de-16-caracteres
   ```

### Google Analytics
1. Crear propiedad en [Google Analytics](https://analytics.google.com/)
2. Obtener el Measurement ID (G-XXXXXXXXXX)
3. Configurar en `.env` y en `index.html`

### Facebook Pixel
1. Crear pixel en [Facebook Business](https://business.facebook.com/)
2. Obtener el Pixel ID
3. Configurar en `.env` y en `index.html`

## 📊 Funcionalidades del Sistema

### Para Clientes
- ✅ **Navegación intuitiva** con menú responsive
- ✅ **Catálogo de servicios** con precios y descripciones
- ✅ **Sistema de reservas de 4 pasos**:
  1. Selección de servicio
  2. Fecha y horario
  3. Datos personales
  4. Pago seguro
- ✅ **Descuento automático** del 30% para nuevos clientes
- ✅ **Confirmación por email** con todos los detalles
- ✅ **WhatsApp directo** para consultas
- ✅ **Newsletter** con tips de belleza

### Para el Negocio
- 📈 **Analytics completo** con Google Analytics y Facebook Pixel
- 📊 **Tracking de conversiones** en cada paso del proceso
- 💰 **Pagos automáticos** con Mercado Pago
- 📧 **Emails automáticos** de confirmación
- 📱 **WhatsApp tracking** para medir efectividad
- 🎯 **SEO optimizado** para aparecer en Google
- 📊 **Base de datos** de clientes automática

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor con nodemon (auto-restart)

# Producción
npm start           # Inicia servidor en modo producción

# Mantenimiento
npm run setup       # Configura base de datos inicial
npm test           # Ejecuta tests (cuando estén implementados)
```

## 🚀 Deploy a Producción

### Opción 1: Heroku
1. Crear app en Heroku
2. Agregar addon de MySQL (ClearDB)
3. Configurar variables de entorno en Heroku
4. Deploy desde Git

### Opción 2: VPS/DigitalOcean
1. Configurar servidor con Node.js y MySQL
2. Clonar repositorio
3. Configurar variables de entorno
4. Usar PM2 para mantener el proceso activo
5. Configurar proxy reverso con Nginx

### Variables de Entorno para Producción
```env
NODE_ENV=production
DATABASE_URL=mysql://usuario:password@host:puerto/database
MP_PUBLIC_KEY=APP_USR-tu-clave-de-produccion
MP_ACCESS_TOKEN=APP_USR-tu-access-token-de-produccion
```

## 📈 Optimizaciones Implementadas

### Performance
- ✅ Compresión GZIP activada
- ✅ Rate limiting para proteger APIs
- ✅ Imágenes optimizadas
- ✅ CSS y JS minificados
- ✅ Cache headers configurados

### SEO
- ✅ Meta tags completos
- ✅ Schema.org markup
- ✅ URLs amigables
- ✅ Sitemap XML (futuro)
- ✅ Google Analytics configurado

### Conversión
- ✅ Newsletter popup con descuento
- ✅ Promoción prominente de 30% OFF
- ✅ WhatsApp button flotante
- ✅ Proceso de reserva simplificado
- ✅ Testimonios de clientes
- ✅ Prueba social (contadores)

## 🔐 Seguridad

- ✅ Helmet para headers de seguridad
- ✅ Rate limiting contra ataques
- ✅ Validación de inputs
- ✅ CORS configurado
- ✅ Variables de entorno protegidas
- ✅ SQL injection prevention

## 🆘 Solución de Problemas

### Error de conexión a base de datos
```bash
# Verificar que MySQL esté ejecutándose
sudo service mysql start

# Verificar credenciales en .env
mysql -u root -p bella_estetica
```

### Error con Mercado Pago
- Verificar que las claves sean correctas
- Usar claves de TEST en desarrollo
- Verificar que la cuenta esté activa

### Emails no se envían
- Verificar App Password de Gmail
- Verificar configuración de 2FA
- Revisar logs del servidor

### El sitio no carga
- Verificar que el puerto 3000 esté disponible
- Revisar logs de errores en la consola
- Verificar que todas las dependencias estén instaladas

## 📞 Soporte

Para soporte técnico:
- 📧 Email: soporte@bellaestetica.com
- 💬 WhatsApp: +54 11 1234-5678
- 🐛 Issues: [GitHub Issues](https://github.com/tu-usuario/bella-estetica/issues)

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para detalles.

---

**¡Tu centro de estética online en menos de 30 minutos! 💅✨**