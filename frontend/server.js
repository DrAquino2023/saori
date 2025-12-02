/**
 * SERVIDOR BACKEND - SISTEMA DE RESERVAS SAORI
 * Node.js + Express + SQLite + MercadoPago
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const mercadopago = require('mercadopago');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Configuración
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurar MercadoPago
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN || 'TU_ACCESS_TOKEN_AQUI'
});

// Configurar Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'tu-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'tu-app-password'
    }
});

// Base de datos SQLite
const DB_PATH = path.join(__dirname, 'reservas.db');

class Database {
    constructor() {
        this.db = new sqlite3.Database(DB_PATH);
        this.init();
    }
    
    init() {
        // Crear tablas si no existen
        this.db.serialize(() => {
            // Tabla de servicios
            this.db.run(`
                CREATE TABLE IF NOT EXISTS servicios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre VARCHAR(255) NOT NULL,
                    descripcion TEXT,
                    precio DECIMAL(10,2) NOT NULL,
                    duracion INTEGER NOT NULL,
                    activo BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Tabla de configuración de horarios
            this.db.run(`
                CREATE TABLE IF NOT EXISTS horarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dia_semana INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, etc.
                    hora_inicio TIME NOT NULL,
                    hora_fin TIME NOT NULL,
                    activo BOOLEAN DEFAULT 1,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Tabla de reservas
            this.db.run(`
                CREATE TABLE IF NOT EXISTS reservas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    servicio_id INTEGER NOT NULL,
                    cliente_nombre VARCHAR(255) NOT NULL,
                    cliente_email VARCHAR(255) NOT NULL,
                    cliente_telefono VARCHAR(20) NOT NULL,
                    cliente_edad INTEGER,
                    observaciones TEXT,
                    fecha_hora DATETIME NOT NULL,
                    precio_total DECIMAL(10,2) NOT NULL,
                    seña_pagada DECIMAL(10,2) NOT NULL,
                    metodo_pago VARCHAR(50) NOT NULL,
                    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, confirmada, cancelada, completada
                    mp_payment_id VARCHAR(100),
                    mp_preference_id VARCHAR(100),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (servicio_id) REFERENCES servicios (id)
                )
            `);
            
            // Tabla de notificaciones
            this.db.run(`
                CREATE TABLE IF NOT EXISTS notificaciones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reserva_id INTEGER NOT NULL,
                    tipo VARCHAR(50) NOT NULL, -- email, whatsapp
                    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, enviada, error
                    contenido TEXT,
                    enviado_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (reserva_id) REFERENCES reservas (id)
                )
            `);
            
            // Insertar servicios por defecto
            this.insertDefaultData();
        });
    }
    
    insertDefaultData() {
        const servicios = [
            ['Facial Premium Diamante', 'Tratamiento facial de lujo con tecnología de diamante', 4500, 120],
            ['Depilación Láser Premium', 'Tecnología láser de última generación', 3800, 120],
            ['Lifting Facial Sin Cirugía', 'Radiofrecuencia + Ultrasonido HIFU', 5200, 120],
            ['Corporal Reafirmante VIP', 'Drenaje linfático + Radiofrecuencia corporal', 4800, 120],
            ['Tratamiento Antiedad', 'Radiofrecuencia facial + Mesoterapia', 4200, 120],
            ['Peeling Químico Premium', 'Renovación celular profunda', 3500, 120],
            ['Hidrafacial Deluxe', 'Limpieza + Hidratación + Antioxidantes', 3200, 120],
            ['Protocolo Anticelulitis', 'Drenaje linfático + Electroestimulación', 4000, 120],
            ['Microdermoabrasión Premium', 'Exfoliación profunda + Hidratación', 2800, 120]
        ];
        
        servicios.forEach(servicio => {
            this.db.run(`
                INSERT OR IGNORE INTO servicios (nombre, descripcion, precio, duracion)
                SELECT ?, ?, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = ?)
            `, [...servicio, servicio[0]]);
        });
        
        // Horarios por defecto (Lunes a Sábado)
        const horarios = [
            [1, '09:00', '18:00'], // Lunes
            [2, '09:00', '18:00'], // Martes
            [3, '09:00', '18:00'], // Miércoles
            [4, '09:00', '18:00'], // Jueves
            [5, '09:00', '18:00'], // Viernes
            [6, '09:00', '16:00']  // Sábado
        ];
        
        horarios.forEach(horario => {
            this.db.run(`
                INSERT OR IGNORE INTO horarios (dia_semana, hora_inicio, hora_fin)
                SELECT ?, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM horarios WHERE dia_semana = ?)
            `, [...horario, horario[0]]);
        });
    }
    
    get(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    
    all(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
    
    run(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
}

const db = new Database();

// RUTAS DE LA API

// Obtener servicios
app.get('/api/servicios', async (req, res) => {
    try {
        const servicios = await db.all('SELECT * FROM servicios WHERE activo = 1 ORDER BY nombre');
        res.json(servicios);
    } catch (error) {
        console.error('Error fetching servicios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener horarios
app.get('/api/horarios', async (req, res) => {
    try {
        const horarios = await db.all('SELECT * FROM horarios WHERE activo = 1 ORDER BY dia_semana');
        res.json(horarios);
    } catch (error) {
        console.error('Error fetching horarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener reservas para una fecha
app.get('/api/reservations', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'Fecha requerida' });
        }
        
        const reservas = await db.all(`
            SELECT r.*, s.nombre as servicio_nombre, s.duracion
            FROM reservas r
            JOIN servicios s ON r.servicio_id = s.id
            WHERE DATE(r.fecha_hora) = ?
            AND r.estado IN ('confirmada', 'pendiente')
            ORDER BY r.fecha_hora
        `, [date]);
        
        res.json(reservas);
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear nueva reserva
app.post('/api/reservations', async (req, res) => {
    try {
        const {
            servicio,
            fecha,
            hora,
            cliente,
            total,
            seña,
            payment_method
        } = req.body;
        
        // Validar datos
        if (!servicio || !fecha || !hora || !cliente || !total || !seña) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        // Crear fecha completa
        const fechaHora = new Date(fecha);
        const [horaNum, minutoNum] = hora.time.split(':').map(Number);
        fechaHora.setHours(horaNum, minutoNum, 0, 0);
        
        // Verificar disponibilidad
        const existing = await db.get(`
            SELECT id FROM reservas 
            WHERE DATE(fecha_hora) = DATE(?)
            AND TIME(fecha_hora) BETWEEN TIME(?) AND TIME(?, '+2 hours')
            AND estado IN ('confirmada', 'pendiente')
        `, [fechaHora.toISOString(), fechaHora.toISOString(), fechaHora.toISOString()]);
        
        if (existing) {
            return res.status(409).json({ error: 'Horario no disponible' });
        }
        
        // Crear reserva
        const result = await db.run(`
            INSERT INTO reservas (
                servicio_id, cliente_nombre, cliente_email, cliente_telefono,
                cliente_edad, observaciones, fecha_hora, precio_total,
                seña_pagada, metodo_pago, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            servicio.id,
            cliente.nombre,
            cliente.email,
            cliente.telefono,
            cliente.edad,
            cliente.observaciones,
            fechaHora.toISOString(),
            total,
            seña,
            payment_method,
            payment_method === 'efectivo' ? 'confirmada' : 'pendiente'
        ]);
        
        const reservaId = result.lastID;
        
        // Enviar notificaciones
        await sendNotifications(reservaId);
        
        res.json({
            success: true,
            reservation_id: reservaId,
            message: 'Reserva creada exitosamente'
        });
        
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Crear preferencia de pago MercadoPago
app.post('/api/create-payment', async (req, res) => {
    try {
        const { reserva, amount, description } = req.body;
        
        const preference = {
            items: [
                {
                    title: description,
                    unit_price: amount,
                    quantity: 1,
                    currency_id: 'ARS'
                }
            ],
            payer: {
                name: reserva.cliente.nombre,
                email: reserva.cliente.email,
                phone: {
                    number: reserva.cliente.telefono
                }
            },
            back_urls: {
                success: `${req.protocol}://${req.get('host')}/payment-success`,
                failure: `${req.protocol}://${req.get('host')}/payment-failure`,
                pending: `${req.protocol}://${req.get('host')}/payment-pending`
            },
            auto_return: 'approved',
            external_reference: `reserva_${Date.now()}`,
            expires: true,
            expiration_date_from: new Date().toISOString(),
            expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
        };
        
        const response = await mercadopago.preferences.create(preference);
        
        // Guardar reservation con preference_id
        await db.run(`
            UPDATE reservas 
            SET mp_preference_id = ? 
            WHERE id = (
                SELECT id FROM reservas 
                ORDER BY created_at DESC 
                LIMIT 1
            )
        `, [response.body.id]);
        
        res.json({
            id: response.body.id,
            init_point: response.body.init_point
        });
        
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Error creando el pago' });
    }
});

// Webhook de MercadoPago
app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const { type, data } = req.body;
        
        if (type === 'payment') {
            const paymentId = data.id;
            
            // Obtener información del pago
            const payment = await mercadopago.payment.findById(paymentId);
            
            if (payment.body.status === 'approved') {
                // Actualizar reserva
                await db.run(`
                    UPDATE reservas 
                    SET estado = 'confirmada', mp_payment_id = ?
                    WHERE mp_preference_id = ?
                `, [paymentId, payment.body.additional_info.external_reference]);
                
                // Enviar notificaciones
                const reserva = await db.get(`
                    SELECT id FROM reservas 
                    WHERE mp_preference_id = ?
                `, [payment.body.additional_info.external_reference]);
                
                if (reserva) {
                    await sendNotifications(reserva.id);
                }
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Rutas de retorno de MercadoPago
app.get('/payment-success', (req, res) => {
    const { payment_id, status, external_reference } = req.query;
    res.redirect(`/?payment=success&reservation_id=${external_reference}`);
});

app.get('/payment-failure', (req, res) => {
    res.redirect('/?payment=failure');
});

app.get('/payment-pending', (req, res) => {
    res.redirect('/?payment=pending');
});

// PANEL DE ADMINISTRACIÓN

// Obtener todas las reservas
app.get('/api/admin/reservas', async (req, res) => {
    try {
        const { fecha, estado } = req.query;
        
        let query = `
            SELECT r.*, s.nombre as servicio_nombre, s.precio, s.duracion
            FROM reservas r
            JOIN servicios s ON r.servicio_id = s.id
        `;
        
        const params = [];
        const conditions = [];
        
        if (fecha) {
            conditions.push('DATE(r.fecha_hora) = ?');
            params.push(fecha);
        }
        
        if (estado) {
            conditions.push('r.estado = ?');
            params.push(estado);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY r.fecha_hora DESC';
        
        const reservas = await db.all(query, params);
        res.json(reservas);
    } catch (error) {
        console.error('Error fetching admin reservations:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar estado de reserva
app.put('/api/admin/reservas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        
        await db.run('UPDATE reservas SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [estado, id]);
        
        res.json({ success: true, message: 'Reserva actualizada' });
    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Configurar horarios
app.put('/api/admin/horarios', async (req, res) => {
    try {
        const { horarios } = req.body;
        
        // Eliminar horarios existentes
        await db.run('DELETE FROM horarios');
        
        // Insertar nuevos horarios
        for (const horario of horarios) {
            await db.run(`
                INSERT INTO horarios (dia_semana, hora_inicio, hora_fin, activo)
                VALUES (?, ?, ?, ?)
            `, [horario.dia_semana, horario.hora_inicio, horario.hora_fin, horario.activo]);
        }
        
        res.json({ success: true, message: 'Horarios actualizados' });
    } catch (error) {
        console.error('Error updating horarios:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// FUNCIONES DE NOTIFICACIÓN

async function sendNotifications(reservaId) {
    try {
        const reserva = await db.get(`
            SELECT r.*, s.nombre as servicio_nombre, s.precio
            FROM reservas r
            JOIN servicios s ON r.servicio_id = s.id
            WHERE r.id = ?
        `, [reservaId]);
        
        if (!reserva) return;
        
        // Enviar email
        await sendEmailNotification(reserva);
        
        // Programar recordatorio WhatsApp (24hs antes)
        await scheduleWhatsAppReminder(reserva);
        
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

async function sendEmailNotification(reserva) {
    try {
        const fechaHora = new Date(reserva.fecha_hora);
        const fechaFormat = fechaHora.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const horaFormat = fechaHora.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: reserva.cliente_email,
            subject: 'Confirmación de Reserva - Saori Centro de Belleza',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #FF1493, #FF69B4); color: white; padding: 2rem; text-align: center;">
                        <h1>¡Reserva Confirmada!</h1>
                    </div>
                    
                    <div style="padding: 2rem; background: #f9f9f9;">
                        <h2>Hola ${reserva.cliente_nombre},</h2>
                        <p>Tu reserva ha sido confirmada exitosamente.</p>
                        
                        <div style="background: white; padding: 1.5rem; border-radius: 10px; margin: 1rem 0;">
                            <h3>Detalles de tu cita:</h3>
                            <p><strong>Tratamiento:</strong> ${reserva.servicio_nombre}</p>
                            <p><strong>Fecha:</strong> ${fechaFormat}</p>
                            <p><strong>Hora:</strong> ${horaFormat}</p>
                            <p><strong>Total:</strong> $${reserva.precio_total.toLocaleString()}</p>
                            <p><strong>Seña pagada:</strong> $${reserva.seña_pagada.toLocaleString()}</p>
                        </div>
                        
                        <div style="background: #e8f4fd; padding: 1rem; border-radius: 5px; margin: 1rem 0;">
                            <p><strong>Recordatorio:</strong></p>
                            <ul>
                                <li>Llega 10 minutos antes de tu cita</li>
                                <li>Trae una toalla pequeña</li>
                                <li>Si necesitas cancelar, hazlo con 24hs de anticipación</li>
                            </ul>
                        </div>
                        
                        <p>¡Te esperamos!</p>
                        <p><strong>Saori Centro de Belleza</strong></p>
                    </div>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        // Registrar notificación
        await db.run(`
            INSERT INTO notificaciones (reserva_id, tipo, estado, contenido, enviado_at)
            VALUES (?, 'email', 'enviada', ?, CURRENT_TIMESTAMP)
        `, [reserva.id, JSON.stringify(mailOptions)]);
        
    } catch (error) {
        console.error('Error sending email:', error);
        
        // Registrar error
        await db.run(`
            INSERT INTO notificaciones (reserva_id, tipo, estado, contenido)
            VALUES (?, 'email', 'error', ?)
        `, [reserva.id, error.message]);
    }
}

async function scheduleWhatsAppReminder(reserva) {
    // Esta función podría implementar un sistema de cron jobs
    // o usar un servicio como node-cron para programar recordatorios
    console.log(`WhatsApp reminder scheduled for reservation ${reserva.id}`);
}

// Servir archivos estáticos
app.use(express.static(__dirname));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🌸 Servidor Saori iniciado en puerto ${PORT}`);
    console.log(`📊 Panel admin: http://localhost:${PORT}/admin`);
    console.log(`💳 MercadoPago configurado: ${mercadopago.configurations.getAccessToken() ? '✅' : '❌'}`);
});

module.exports = app;
