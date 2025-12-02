// ========================================
// BELLA ESTÉTICA - SERVIDOR PRINCIPAL
// ========================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Cargar variables de entorno
dotenv.config();

// Configuración
const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARES
// ========================================

// Security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://connect.facebook.net", "https://sdk.mercadopago.com"],
            imgSrc: ["'self'", "data:", "https:", "https://www.facebook.com"],
            connectSrc: ["'self'", "https://www.google-analytics.com", "https://api.mercadopago.com"]
        }
    }
}));

// CORS
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://bellaestetica.com', 'https://www.bellaestetica.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por IP
    message: {
        error: 'Demasiadas solicitudes, por favor intenta más tarde.',
        retryAfter: '15 minutos'
    }
});
app.use('/api/', limiter);

// Rate limiting más estricto para bookings
const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // máximo 5 reservas por hora por IP
    message: {
        error: 'Límite de reservas alcanzado. Puedes hacer máximo 5 reservas por hora.',
        retryAfter: '1 hora'
    }
});

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// ========================================
// CONFIGURACIÓN BASE DE DATOS
// ========================================

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bella_estetica',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

let db;

async function initDatabase() {
    try {
        db = mysql.createPool(dbConfig);
        
        // Test connection
        const connection = await db.getConnection();
        console.log('✅ Base de datos conectada exitosamente');
        connection.release();
        
        // Crear tablas si no existen
        await createTables();
        
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error);
        process.exit(1);
    }
}

async function createTables() {
    const tables = [
        // Tabla de servicios
        `CREATE TABLE IF NOT EXISTS services (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            duration INT NOT NULL COMMENT 'Duration in minutes',
            slots_needed INT DEFAULT 1 COMMENT 'Number of time slots needed',
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        
        // Tabla de clientes
        `CREATE TABLE IF NOT EXISTS clients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            phone VARCHAR(50) NOT NULL,
            newsletter_subscribed BOOLEAN DEFAULT FALSE,
            first_visit BOOLEAN DEFAULT TRUE,
            total_visits INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_phone (phone)
        )`,
        
        // Tabla de reservas
        `CREATE TABLE IF NOT EXISTS bookings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            client_id INT NOT NULL,
            service_id INT NOT NULL,
            booking_date DATE NOT NULL,
            booking_time TIME NOT NULL,
            duration INT NOT NULL,
            original_price DECIMAL(10,2) NOT NULL,
            discount DECIMAL(10,2) DEFAULT 0,
            total_price DECIMAL(10,2) NOT NULL,
            status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
            payment_status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
            payment_id VARCHAR(255),
            mp_preference_id VARCHAR(255),
            mp_payment_id VARCHAR(255),
            comments TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
            INDEX idx_date_time (booking_date, booking_time),
            INDEX idx_client (client_id),
            INDEX idx_status (status),
            INDEX idx_payment_status (payment_status),
            UNIQUE KEY unique_slot (booking_date, booking_time)
        )`,
        
        // Tabla de newsletter
        `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            unsubscribed_at TIMESTAMP NULL,
            active BOOLEAN DEFAULT TRUE,
            source VARCHAR(50) DEFAULT 'website',
            INDEX idx_email (email),
            INDEX idx_active (active)
        )`,
        
        // Tabla de configuración
        `CREATE TABLE IF NOT EXISTS settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(100) NOT NULL UNIQUE,
            setting_value TEXT NOT NULL,
            setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        
        // Tabla de logs de actividad
        `CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            action VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id INT,
            details JSON,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_action (action),
            INDEX idx_entity (entity_type, entity_id),
            INDEX idx_created_at (created_at)
        )`
    ];
    
    for (const tableSQL of tables) {
        try {
            await db.execute(tableSQL);
        } catch (error) {
            console.error('Error creando tabla:', error);
        }
    }
    
    // Insertar servicios predeterminados
    await insertDefaultServices();
    await insertDefaultSettings();
}

async function insertDefaultServices() {
    const services = [
        ['Limpieza Facial Profunda', 'Tratamiento completo de limpieza, hidratación y renovación facial.', 3500, 60, 2],
        ['Depilación Láser', 'Depilación definitiva con tecnología láser de última generación.', 4200, 90, 3],
        ['Tratamiento Antienvejecimiento', 'Reduce líneas de expresión y mejora la elasticidad de la piel.', 2800, 45, 2],
        ['Tratamiento Corporal Completo', 'Masajes reductores, drenaje linfático y tonificación muscular.', 5000, 120, 4],
        ['Diseño de Cejas', 'Perfilado y diseño profesional de cejas para realzar tu mirada.', 1800, 30, 1],
        ['Paquete Premium', 'Facial + corporal + diseño de cejas. El tratamiento completo.', 6500, 150, 5]
    ];
    
    for (const service of services) {
        try {
            await db.execute(
                'INSERT IGNORE INTO services (name, description, price, duration, slots_needed) VALUES (?, ?, ?, ?, ?)',
                service
            );
        } catch (error) {
            // Ignoro errores de duplicados
        }
    }
}

async function insertDefaultSettings() {
    const settings = [
        ['business_hours_start', '9', 'number', 'Hora de inicio del negocio'],
        ['business_hours_end', '19', 'number', 'Hora de cierre del negocio'],
        ['saturday_hours_end', '15', 'number', 'Hora de cierre los sábados'],
        ['lunch_break_start', '13', 'number', 'Inicio del horario de almuerzo'],
        ['lunch_break_end', '14', 'number', 'Fin del horario de almuerzo'],
        ['time_slot_duration', '30', 'number', 'Duración de cada slot en minutos'],
        ['first_visit_discount', '0.30', 'number', 'Descuento para primera visita (0-1)'],
        ['max_advance_booking_days', '60', 'number', 'Máximo días para reservar con anticipación'],
        ['work_days', '[1,2,3,4,5,6]', 'json', 'Días laborables (0=Domingo, 1=Lunes, etc.)'],
        ['mp_public_key', process.env.MP_PUBLIC_KEY || '', 'string', 'Mercado Pago Public Key'],
        ['mp_access_token', process.env.MP_ACCESS_TOKEN || '', 'string', 'Mercado Pago Access Token'],
        ['email_host', process.env.EMAIL_HOST || 'smtp.gmail.com', 'string', 'SMTP Host'],
        ['email_user', process.env.EMAIL_USER || '', 'string', 'Email de envío'],
        ['email_password', process.env.EMAIL_PASSWORD || '', 'string', 'Password del email'],
        ['business_name', 'Bella Estética', 'string', 'Nombre del negocio'],
        ['business_address', 'Av. Corrientes 1234, CABA', 'string', 'Dirección del negocio'],
        ['business_phone', '+54 11 1234-5678', 'string', 'Teléfono del negocio'],
        ['business_email', 'info@bellaestetica.com', 'string', 'Email del negocio']
    ];
    
    for (const setting of settings) {
        try {
            await db.execute(
                'INSERT IGNORE INTO settings (setting_key, setting_value, setting_type, description) VALUES (?, ?, ?, ?)',
                setting
            );
        } catch (error) {
            // Ignoro errores de duplicados
        }
    }
}

// ========================================
// CONFIGURACIÓN MERCADO PAGO
// ========================================

let mercadopago;

async function initMercadoPago() {
    try {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (accessToken) {
            mercadopago = new MercadoPagoConfig({
                accessToken: accessToken,
                options: {
                    timeout: 5000
                }
            });
            console.log('✅ Mercado Pago configurado exitosamente');
        } else {
            console.warn('⚠️ Mercado Pago Access Token no configurado');
        }
    } catch (error) {
        console.error('❌ Error configurando Mercado Pago:', error);
    }
}

// ========================================
// CONFIGURACIÓN EMAIL
// ========================================

let emailTransporter;

async function initEmailService() {
    try {
        emailTransporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        
        // Verificar configuración
        if (process.env.EMAIL_USER) {
            await emailTransporter.verify();
            console.log('✅ Servicio de email configurado exitosamente');
        } else {
            console.warn('⚠️ Credenciales de email no configuradas');
        }
    } catch (error) {
        console.warn('⚠️ Error configurando email:', error.message);
    }
}

// ========================================
// RUTAS
// ========================================

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ========================================
// API ROUTES
// ========================================

// Servicios
app.get('/api/services', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM services WHERE active = TRUE ORDER BY price ASC'
        );
        res.json({ services: rows });
    } catch (error) {
        console.error('Error obteniendo servicios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Horarios ocupados
app.get('/api/bookings/occupied-slots', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'Fecha requerida' });
        }
        
        const [rows] = await db.execute(`
            SELECT booking_time, duration 
            FROM bookings 
            WHERE booking_date = ? 
            AND status IN ('confirmed', 'pending')
            ORDER BY booking_time ASC
        `, [date]);
        
        // Generar todos los slots ocupados basado en duración
        const occupiedSlots = [];
        
        rows.forEach(booking => {
            const startTime = booking.booking_time;
            const duration = booking.duration;
            const slotsNeeded = Math.ceil(duration / 30); // 30 min slots
            
            const [hours, minutes] = startTime.split(':').map(Number);
            
            for (let i = 0; i < slotsNeeded; i++) {
                const slotTime = new Date();
                slotTime.setHours(hours, minutes + (i * 30), 0, 0);
                const timeStr = slotTime.toTimeString().slice(0, 5);
                occupiedSlots.push(timeStr);
            }
        });
        
        res.json({ occupiedSlots });
    } catch (error) {
        console.error('Error obteniendo slots ocupados:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Verificar disponibilidad
app.post('/api/bookings/check-availability', async (req, res) => {
    try {
        const { date, time, service } = req.body;
        
        if (!date || !time || !service) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        // Obtener duración del servicio
        const [serviceRows] = await db.execute(
            'SELECT duration FROM services WHERE name = ? AND active = TRUE',
            [service]
        );
        
        if (serviceRows.length === 0) {
            return res.status(400).json({ error: 'Servicio no encontrado' });
        }
        
        const duration = serviceRows[0].duration;
        const slotsNeeded = Math.ceil(duration / 30);
        
        // Verificar conflictos
        const [hours, minutes] = time.split(':').map(Number);
        let hasConflict = false;
        
        for (let i = 0; i < slotsNeeded; i++) {
            const checkTime = new Date();
            checkTime.setHours(hours, minutes + (i * 30), 0, 0);
            const checkTimeStr = checkTime.toTimeString().slice(0, 5);
            
            const [conflictRows] = await db.execute(`
                SELECT id FROM bookings 
                WHERE booking_date = ? 
                AND booking_time = ?
                AND status IN ('confirmed', 'pending')
            `, [date, checkTimeStr]);
            
            if (conflictRows.length > 0) {
                hasConflict = true;
                break;
            }
        }
        
        res.json({ available: !hasConflict });
    } catch (error) {
        console.error('Error verificando disponibilidad:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear preferencia de pago
app.post('/api/payments/create-preference', async (req, res) => {
    try {
        if (!mercadopago) {
            return res.status(500).json({ error: 'Mercado Pago no configurado' });
        }
        
        const { service, date, time, client, originalPrice, discount, totalPrice } = req.body;
        
        const preference = new Preference(mercadopago);
        
        const preferenceData = {
            items: [
                {
                    title: service,
                    description: `Reserva para ${date} a las ${time}`,
                    unit_price: totalPrice,
                    quantity: 1,
                    currency_id: 'ARS'
                }
            ],
            payer: {
                name: client.firstName,
                surname: client.lastName,
                email: client.email,
                phone: {
                    number: client.phone.replace(/\D/g, '')
                }
            },
            back_urls: {
                success: `${req.protocol}://${req.get('host')}/success`,
                failure: `${req.protocol}://${req.get('host')}/failure`,
                pending: `${req.protocol}://${req.get('host')}/pending`
            },
            auto_return: 'approved',
            external_reference: `booking_${Date.now()}`,
            metadata: {
                service,
                date,
                time,
                original_price: originalPrice,
                discount,
                client_email: client.email
            }
        };
        
        const result = await preference.create({ body: preferenceData });
        
        res.json({ preference: result });
    } catch (error) {
        console.error('Error creando preferencia:', error);
        res.status(500).json({ error: 'Error creando preferencia de pago' });
    }
});

// Crear booking
app.post('/api/bookings/create', bookingLimiter, async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { service, date, time, duration, client, originalPrice, discount, totalPrice, paymentData } = req.body;
        
        // Crear o obtener cliente
        let clientId;
        const [existingClient] = await connection.execute(
            'SELECT id, first_visit FROM clients WHERE email = ?',
            [client.email]
        );
        
        if (existingClient.length > 0) {
            clientId = existingClient[0].id;
            
            // Actualizar datos del cliente
            await connection.execute(`
                UPDATE clients SET 
                first_name = ?, last_name = ?, phone = ?, 
                newsletter_subscribed = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [client.firstName, client.lastName, client.phone, client.newsletter, clientId]);
        } else {
            // Crear nuevo cliente
            const [result] = await connection.execute(`
                INSERT INTO clients 
                (first_name, last_name, email, phone, newsletter_subscribed, first_visit) 
                VALUES (?, ?, ?, ?, ?, TRUE)
            `, [client.firstName, client.lastName, client.email, client.phone, client.newsletter]);
            
            clientId = result.insertId;
        }
        
        // Obtener ID del servicio
        const [serviceRows] = await connection.execute(
            'SELECT id FROM services WHERE name = ? AND active = TRUE',
            [service]
        );
        
        if (serviceRows.length === 0) {
            throw new Error('Servicio no encontrado');
        }
        
        const serviceId = serviceRows[0].id;
        
        // Crear booking
        const [bookingResult] = await connection.execute(`
            INSERT INTO bookings 
            (client_id, service_id, booking_date, booking_time, duration, 
             original_price, discount, total_price, status, payment_status, 
             payment_id, comments) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'approved', ?, ?)
        `, [clientId, serviceId, date, time, duration, originalPrice, discount, totalPrice, 
            paymentData?.payment_id || null, client.comments]);
        
        const bookingId = bookingResult.insertId;
        
        // Actualizar contador de visitas del cliente
        await connection.execute(
            'UPDATE clients SET total_visits = total_visits + 1, first_visit = FALSE WHERE id = ?',
            [clientId]
        );
        
        // Suscribir a newsletter si corresponde
        if (client.newsletter) {
            await connection.execute(
                'INSERT IGNORE INTO newsletter_subscribers (email, source) VALUES (?, ?)',
                [client.email, 'booking']
            );
        }
        
        // Log de actividad
        await connection.execute(`
            INSERT INTO activity_logs (action, entity_type, entity_id, details, ip_address, user_agent)
            VALUES ('booking_created', 'booking', ?, ?, ?, ?)
        `, [bookingId, JSON.stringify({ service, date, time, totalPrice }), req.ip, req.get('User-Agent')]);
        
        await connection.commit();
        
        // Enviar email de confirmación
        if (emailTransporter) {
            try {
                await sendBookingConfirmationEmail({
                    bookingId,
                    client,
                    service,
                    date,
                    time,
                    totalPrice
                });
            } catch (emailError) {
                console.error('Error enviando email:', emailError);
                // No fallar la reserva por error de email
            }
        }
        
        res.json({
            booking: {
                id: bookingId,
                service,
                date,
                time,
                totalPrice,
                status: 'confirmed'
            }
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Error creando booking:', error);
        res.status(500).json({ error: 'Error creando la reserva' });
    } finally {
        connection.release();
    }
});

// Newsletter subscription
app.post('/api/newsletter/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Email inválido' });
        }
        
        await db.execute(
            'INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?) ON DUPLICATE KEY UPDATE active = TRUE, source = ?',
            [email, 'popup', 'popup']
        );
        
        res.json({ message: 'Suscripción exitosa' });
    } catch (error) {
        console.error('Error en suscripción:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ========================================
// EMAIL FUNCTIONS
// ========================================

async function sendBookingConfirmationEmail({ bookingId, client, service, date, time, totalPrice }) {
    if (!emailTransporter) return;
    
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(price);
    };
    
    const emailHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Confirmación de Reserva - Bella Estética</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #d4af37, #b8941f); color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .booking-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                .button { display: inline-block; background: #d4af37; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>¡Reserva Confirmada! ✨</h1>
                    <p>Tu turno en Bella Estética ha sido confirmado</p>
                </div>
                
                <div class="content">
                    <h2>Hola ${client.firstName}! 👋</h2>
                    <p>¡Qué emoción! Tu reserva ha sido confirmada exitosamente. Te esperamos para mimarte y realzar tu belleza natural.</p>
                    
                    <div class="booking-details">
                        <h3>📅 Detalles de tu reserva:</h3>
                        <p><strong>Código de reserva:</strong> #${bookingId}</p>
                        <p><strong>Servicio:</strong> ${service}</p>
                        <p><strong>Fecha:</strong> ${formatDate(date)}</p>
                        <p><strong>Hora:</strong> ${time}</p>
                        <p><strong>Total pagado:</strong> ${formatPrice(totalPrice)}</p>
                    </div>
                    
                    <h3>📍 ¿Dónde nos encontramos?</h3>
                    <p>Av. Corrientes 1234, CABA<br>
                    📞 +54 11 1234-5678</p>
                    
                    <h3>💡 Recomendaciones:</h3>
                    <ul>
                        <li>Te recomendamos llegar 10 minutos antes de tu cita</li>
                        <li>Si tienes alguna alergia, por favor infórmanos</li>
                        <li>Recuerda traer tu documento de identidad</li>
                    </ul>
                    
                    <div style="text-align: center;">
                        <a href="https://wa.me/5491123456789?text=Hola! Tengo una reserva confirmada (Código: ${bookingId})" class="button">
                            💬 Contactar por WhatsApp
                        </a>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Bella Estética - Tu centro de belleza de confianza<br>
                    Si necesitas cancelar o reprogramar, contáctanos con al menos 24hs de anticipación.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const mailOptions = {
        from: `"Bella Estética" <${process.env.EMAIL_USER}>`,
        to: client.email,
        subject: `¡Reserva Confirmada! #${bookingId} - Bella Estética`,
        html: emailHTML
    };
    
    await emailTransporter.sendMail(mailOptions);
}

// ========================================
// PÁGINAS DE RESULTADO DE PAGO
// ========================================

app.get('/success', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Pago Exitoso - Bella Estética</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8f0; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                .success-icon { font-size: 4rem; color: #4caf50; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✅</div>
                <h1>¡Pago Exitoso!</h1>
                <p>Tu reserva ha sido confirmada exitosamente.</p>
                <p>Recibirás un email con todos los detalles.</p>
                <p><a href="/">Volver al inicio</a></p>
            </div>
        </body>
        </html>
    `);
});

app.get('/failure', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Error en el Pago - Bella Estética</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fff0f0; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                .error-icon { font-size: 4rem; color: #f44336; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">❌</div>
                <h1>Error en el Pago</h1>
                <p>No pudimos procesar tu pago. Por favor intenta de nuevo.</p>
                <p><a href="/">Volver e intentar de nuevo</a></p>
            </div>
        </body>
        </html>
    `);
});

app.get('/pending', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Pago Pendiente - Bella Estética</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fffdf0; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                .pending-icon { font-size: 4rem; color: #ff9800; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="pending-icon">⏳</div>
                <h1>Pago Pendiente</h1>
                <p>Tu pago está siendo procesado.</p>
                <p>Te notificaremos cuando se confirme.</p>
                <p><a href="/">Volver al inicio</a></p>
            </div>
        </body>
        </html>
    `);
});

// ========================================
// RUTA PRINCIPAL
// ========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Catch all para SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ========================================
// MANEJO DE ERRORES
// ========================================

app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========================================
// INICIALIZACIÓN DEL SERVIDOR
// ========================================

async function startServer() {
    try {
        await initDatabase();
        await initMercadoPago();
        await initEmailService();
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
            console.log(`🌐 URL: http://localhost:${PORT}`);
            console.log(`📅 Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log('🌸 Bella Estética - Sistema operativo');
        });
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Cerrando servidor...');
    if (db) {
        await db.end();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Cerrando servidor...');
    if (db) {
        await db.end();
    }
    process.exit(0);
});

// Iniciar servidor
startServer();