// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const { getPool } = require("../config/mysql");
const { sendCancellationEmail, sendReminder24Hours, sendReminder2Hours } = require("../utils/mailer");

// Middleware de autenticación simple (mejorar en producción)
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Formato esperado: "Basic base64(user:password)"
  const base64Credentials = authHeader.split(' ')[1] || '';
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // Verificar credenciales (usar variables de entorno en producción)
  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === validUser && password === validPass) {
    next();
  } else {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
};

// Aplicar autenticación a todas las rutas de admin
router.use(adminAuth);

// GET /api/admin/reservations - Listar todas las reservas
router.get('/reservations', async (req, res) => {
  try {
    const { status, date_from, date_to, limit = 100, offset = 0 } = req.query;
    const pool = getPool();

    let query = `
      SELECT
        r.id,
        r.start_time,
        r.end_time,
        r.status,
        r.price_cents,
        r.created_at,
        s.name as service_name,
        s.duration_min,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM saori.reservations r
      JOIN saori.services s ON r.service_id = s.id
      JOIN saori.customers c ON r.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    if (date_from) {
      query += ' AND DATE(r.start_time) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND DATE(r.start_time) <= ?';
      params.push(date_to);
    }

    query += ' ORDER BY r.start_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);

    // Contar total para paginación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM saori.reservations r
      WHERE 1=1
    `;
    const countParams = [];

    if (status) {
      countQuery += ' AND r.status = ?';
      countParams.push(status);
    }

    if (date_from) {
      countQuery += ' AND DATE(r.start_time) >= ?';
      countParams.push(date_from);
    }

    if (date_to) {
      countQuery += ' AND DATE(r.start_time) <= ?';
      countParams.push(date_to);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    return res.json({
      ok: true,
      data: rows,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('GET /admin/reservations error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// GET /api/admin/reservations/:id - Obtener una reserva específica
router.get('/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [rows] = await pool.query(`
      SELECT
        r.*,
        s.name as service_name,
        s.duration_min,
        s.price_cents as service_price,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM saori.reservations r
      JOIN saori.services s ON r.service_id = s.id
      JOIN saori.customers c ON r.customer_id = c.id
      WHERE r.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'reservation_not_found' });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('GET /admin/reservations/:id error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// PUT /api/admin/reservations/:id - Actualizar una reserva
router.put('/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, start_time, notes } = req.body;
    const pool = getPool();

    // Primero verificar que la reserva existe
    const [existing] = await pool.query(
      'SELECT id FROM saori.reservations WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'reservation_not_found' });
    }

    // Construir query de actualización
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (start_time) {
      updates.push('start_time = ?');
      params.push(start_time);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'no_updates_provided' });
    }

    params.push(id);

    await pool.query(
      `UPDATE saori.reservations SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return res.json({ ok: true, message: 'reservation_updated' });
  } catch (err) {
    console.error('PUT /admin/reservations/:id error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// POST /api/admin/reservations/:id/cancel - Cancelar una reserva
router.post('/reservations/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { send_email = true } = req.body;
    const pool = getPool();

    // Obtener datos de la reserva antes de cancelar
    const [rows] = await pool.query(`
      SELECT
        r.id,
        r.start_time,
        s.name as service_name,
        c.name as customer_name,
        c.email as customer_email
      FROM saori.reservations r
      JOIN saori.services s ON r.service_id = s.id
      JOIN saori.customers c ON r.customer_id = c.id
      WHERE r.id = ? AND r.status != 'canceled'
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'reservation_not_found_or_already_canceled' });
    }

    const reservation = rows[0];

    // Actualizar estado a cancelado
    await pool.query(
      'UPDATE saori.reservations SET status = ? WHERE id = ?',
      ['canceled', id]
    );

    // Enviar email de cancelación si está habilitado
    if (send_email) {
      sendCancellationEmail({
        customerName: reservation.customer_name,
        customerEmail: reservation.customer_email,
        serviceName: reservation.service_name,
        date: reservation.start_time,
        time: new Date(reservation.start_time).toTimeString().slice(0, 5),
        reservationId: id
      }).catch(err => {
        console.error('Error enviando email de cancelación:', err);
      });
    }

    return res.json({ ok: true, message: 'reservation_canceled' });
  } catch (err) {
    console.error('POST /admin/reservations/:id/cancel error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// POST /api/admin/reservations/:id/send-reminder - Enviar recordatorio manual
router.post('/reservations/:id/send-reminder', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = '24h' } = req.body; // '24h' o '2h'
    const pool = getPool();

    // Obtener datos de la reserva
    const [rows] = await pool.query(`
      SELECT
        r.id,
        r.start_time,
        s.name as service_name,
        c.name as customer_name,
        c.email as customer_email
      FROM saori.reservations r
      JOIN saori.services s ON r.service_id = s.id
      JOIN saori.customers c ON r.customer_id = c.id
      WHERE r.id = ? AND r.status IN ('pending', 'confirmed')
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'reservation_not_found_or_invalid_status' });
    }

    const reservation = rows[0];
    const emailData = {
      customerName: reservation.customer_name,
      customerEmail: reservation.customer_email,
      serviceName: reservation.service_name,
      date: reservation.start_time,
      time: new Date(reservation.start_time).toTimeString().slice(0, 5),
      reservationId: id
    };

    // Enviar según el tipo
    if (type === '24h') {
      await sendReminder24Hours(emailData);
    } else if (type === '2h') {
      await sendReminder2Hours(emailData);
    } else {
      return res.status(400).json({ error: 'invalid_reminder_type' });
    }

    return res.json({ ok: true, message: 'reminder_sent' });
  } catch (err) {
    console.error('POST /admin/reservations/:id/send-reminder error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// GET /api/admin/stats - Estadísticas del panel
router.get('/stats', async (req, res) => {
  try {
    const pool = getPool();
    const today = new Date().toISOString().split('T')[0];

    // Reservas de hoy
    const [todayReservations] = await pool.query(`
      SELECT COUNT(*) as count
      FROM saori.reservations
      WHERE DATE(start_time) = ? AND status IN ('pending', 'confirmed')
    `, [today]);

    // Reservas pendientes totales
    const [pendingReservations] = await pool.query(`
      SELECT COUNT(*) as count
      FROM saori.reservations
      WHERE status = 'pending'
    `);

    // Reservas confirmadas totales
    const [confirmedReservations] = await pool.query(`
      SELECT COUNT(*) as count
      FROM saori.reservations
      WHERE status = 'confirmed'
    `);

    // Ingresos del mes
    const [monthlyRevenue] = await pool.query(`
      SELECT COALESCE(SUM(price_cents), 0) as total
      FROM saori.reservations
      WHERE MONTH(start_time) = MONTH(CURRENT_DATE())
        AND YEAR(start_time) = YEAR(CURRENT_DATE())
        AND status IN ('confirmed', 'completed')
    `);

    // Total de clientes
    const [totalCustomers] = await pool.query(`
      SELECT COUNT(*) as count
      FROM saori.customers
    `);

    return res.json({
      ok: true,
      stats: {
        today_reservations: todayReservations[0].count,
        pending_reservations: pendingReservations[0].count,
        confirmed_reservations: confirmedReservations[0].count,
        monthly_revenue: monthlyRevenue[0].total / 100, // convertir a pesos
        total_customers: totalCustomers[0].count
      }
    });
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

module.exports = router;
