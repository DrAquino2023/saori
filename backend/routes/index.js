// backend/routes/index.js
const express = require("express");
const router = express.Router();

const { getPool } = require("../config/mysql");
const { sendConfirmationEmail } = require("../utils/mailer");

// ────────────────────────────────────────────────────────────────
// Helper: formatea Date local a 'YYYY-MM-DD HH:MM:SS' (evita desfase UTC)
function toLocalSQL(date) {
  const z = date.getTimezoneOffset(); // minutos
  const local = new Date(date.getTime() - z * 60000);
  return local.toISOString().slice(0, 19).replace("T", " ");
}
// ────────────────────────────────────────────────────────────────

// Healthcheck MySQL
router.get("/db-ping", async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT 1 AS ok, DATABASE() AS db, @@version AS version"
    );
    res.json(rows[0]); // { ok: 1, db: 'saori', version: '...' }
  } catch (e) {
    console.error("DB ping error:", e);
    res.status(500).json({ error: "db_error", message: e.message });
  }
});

// Catálogo de servicios
router.get("/services", async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT id, name, duration_min, price_cents FROM saori.services ORDER BY id"
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /services error:", e);
    res.status(500).json({ error: "db_error", message: e.message });
  }
});

// Alta de reserva (MySQL)
router.post("/reservations", async (req, res) => {
  try {
    const { name, email, phone, service_id, resource_id, start_time } =
      req.body;

    // 1) Validación mínima
    if (!name || !email || !service_id || !resource_id || !start_time) {
      return res.status(400).json({ error: "bad_request" });
    }

    const pool = getPool();

    // 2) Traer servicio (duración y precio)
    const [svc] = await pool.query(
      "SELECT duration_min, price_cents FROM saori.services WHERE id = ?",
      [service_id]
    );
    if (svc.length === 0)
      return res.status(400).json({ error: "service_not_found" });

    const durationMin = Number(svc[0].duration_min);
    const priceCents = Number(svc[0].price_cents);

    // 3) Calcular ventana horaria a partir de start_time (string local 'YYYY-MM-DD HH:MM:SS')
    const start = new Date(start_time);
    if (isNaN(start.getTime()))
      return res.status(400).json({ error: "invalid_start_time" });
    const end = new Date(start.getTime() + durationMin * 60000);

    // 4) Strings SQL en hora local
    const startSql = toLocalSQL(start);
    const endSql = toLocalSQL(end);

    // 5) Verificar solapamiento en el mismo recurso
    const [overlap] = await pool.query(
      `SELECT 1
         FROM saori.reservations
        WHERE resource_id = ?
          AND status IN ('pending','confirmed')
          AND NOT (end_time <= ? OR start_time >= ?)
        LIMIT 1`,
      [resource_id, startSql, endSql]
    );
    if (overlap.length) return res.status(409).json({ error: "overlap" });

    // 6) Upsert del cliente y obtención del id
    const [custIns] = await pool.query(
      `INSERT INTO saori.customers (name, email, phone)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         id = LAST_INSERT_ID(id)`,
      [name, email, phone || null]
    );
    const customerId = custIns.insertId;

    // 7) Insertar reserva con estado 'pending'
    const [ins] = await pool.query(
      `INSERT INTO saori.reservations
         (service_id, resource_id, customer_id, start_time, end_time, status, price_cents)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [service_id, resource_id, customerId, startSql, endSql, priceCents]
    );

    // 8) Obtener nombre del servicio para el email
    const [svcInfo] = await pool.query(
      "SELECT name, duration_min FROM saori.services WHERE id = ?",
      [service_id]
    );

    // 9) Enviar email de confirmación (sin bloquear la respuesta)
    const reservationId = ins.insertId;
    sendConfirmationEmail({
      customerName: name,
      customerEmail: email,
      serviceName: svcInfo[0].name,
      date: start,
      time: start.toTimeString().slice(0, 5),
      duration: svcInfo[0].duration_min,
      reservationId: reservationId
    }).catch(err => {
      console.error('Error enviando email de confirmación:', err);
      // No fallar la reserva si el email falla
    });

    // 10) Responder con horarios en hora local y banderas de éxito
    return res.json({
      ok: true,
      success: true,
      reservation_id: reservationId, // snake_case
      reservationId: reservationId, // camelCase
      start_time: startSql,
      end_time: endSql,
    });
  } catch (e) {
    console.error("POST /reservations error:", e);
    return res.status(500).json({
      error: "server_error",
      code: e.code || null,
      sqlState: e.sqlState || null,
      sqlMessage: e.sqlMessage || e.message || null,
      sql: e.sql || null,
    });
  }
});

// Stub de pago (placeholder para que el front continúe)
router.post("/create-payment", async (_req, res) => {
  try {
    const preferenceId = "MP_TEST_PREF_" + Date.now();
    return res.json({
      ok: true,
      success: true,
      preferenceId,
      init_point: "#",
      sandbox_init_point: "#",
    });
  } catch (e) {
    console.error("POST /create-payment error:", e);
    return res.status(500).json({ error: "server_error" });
  }
});
// GET /api/reservations?date=YYYY-MM-DD&resource_id=1
router.get("/reservations", async (req, res) => {
  try {
    const { date, resource_id } = req.query;
    if (!date) return res.status(400).json({ error: "date_required" });

    const resourceId = Number(resource_id) || 1;
    const pool = getPool();

    // Trae reservas del día para el recurso indicado
    const [rows] = await pool.query(
      `SELECT id, service_id, resource_id, start_time, end_time, status
         FROM reservations
        WHERE resource_id = ?
          AND DATE(start_time) = ?`,
      [resourceId, date]
    );

    // El front espera campo 'fecha_hora' parseable por new Date()
    const toIsoLocal = (v) => {
      // v puede venir como Date o string segun mysql2 config
      const d = v instanceof Date ? v : new Date(v);
      const pad = (n) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const HH = pad(d.getHours());
      const MM = pad(d.getMinutes());
      const SS = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`;
    };

    const out = rows.map((r) => ({
      id: r.id,
      service_id: r.service_id,
      resource_id: r.resource_id,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
      fecha_hora: toIsoLocal(r.start_time),
    }));

    return res.json(out);
  } catch (err) {
    console.error("GET /api/reservations error", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/create-payment  → STUB para entorno local
// Devuelve un objeto compatible con el front. Si no hay URL real, el front hace fallback a guardar la reserva.
router.post('/create-payment', async (req, res) => {
  try {
    // Podés loguear lo que llega si querés depurar:
    // console.log('create-payment payload:', req.body);

    return res.json({
      ok: true,
      success: true,
      preferenceId: 'MP_TEST_PREF_STUB',
      init_point: '#',           // sin URL real → el front hará fallback
      sandbox_init_point: '#'
    });
  } catch (e) {
    console.error('POST /api/create-payment error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});



module.exports = router;
