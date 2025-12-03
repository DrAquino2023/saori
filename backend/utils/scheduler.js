const cron = require('node-cron');
const { getPool } = require('../config/mysql');
const { sendReminder24Hours, sendReminder2Hours } = require('./mailer');

/**
 * Sistema de recordatorios automáticos
 * Envía emails en momentos específicos antes de cada reserva
 */

/**
 * Envía recordatorios 24 horas antes
 * Se ejecuta cada hora
 */
function schedule24HourReminders() {
  // Ejecutar cada hora
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Ejecutando tarea: Recordatorios 24h...');

    try {
      const pool = getPool();

      // Buscar reservas que están entre 23 y 25 horas en el futuro
      // (ventana de 2 horas para asegurar que se envíen)
      const [reservations] = await pool.query(`
        SELECT
          r.id,
          r.start_time,
          s.name as service_name,
          s.duration_min,
          c.name as customer_name,
          c.email as customer_email
        FROM saori.reservations r
        JOIN saori.services s ON r.service_id = s.id
        JOIN saori.customers c ON r.customer_id = c.id
        WHERE r.status IN ('pending', 'confirmed')
          AND r.start_time BETWEEN
            DATE_ADD(NOW(), INTERVAL 23 HOUR)
            AND DATE_ADD(NOW(), INTERVAL 25 HOUR)
          AND (r.reminder_24h_sent IS NULL OR r.reminder_24h_sent = 0)
      `);

      console.log(`📧 Encontradas ${reservations.length} reservas para recordatorio 24h`);

      for (const reservation of reservations) {
        try {
          // Enviar email
          await sendReminder24Hours({
            customerName: reservation.customer_name,
            customerEmail: reservation.customer_email,
            serviceName: reservation.service_name,
            date: reservation.start_time,
            time: new Date(reservation.start_time).toTimeString().slice(0, 5),
            reservationId: reservation.id
          });

          // Marcar como enviado
          await pool.query(
            'UPDATE saori.reservations SET reminder_24h_sent = 1 WHERE id = ?',
            [reservation.id]
          );

          console.log(`✓ Recordatorio 24h enviado para reserva #${reservation.id}`);
        } catch (err) {
          console.error(`❌ Error enviando recordatorio 24h para reserva #${reservation.id}:`, err);
        }
      }

      console.log('✓ Tarea completada: Recordatorios 24h');
    } catch (err) {
      console.error('❌ Error en tarea de recordatorios 24h:', err);
    }
  });

  console.log('✓ Recordatorios 24h programados (cada hora)');
}

/**
 * Envía recordatorios 2 horas antes
 * Se ejecuta cada 30 minutos
 */
function schedule2HourReminders() {
  // Ejecutar cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    console.log('🔄 Ejecutando tarea: Recordatorios 2h...');

    try {
      const pool = getPool();

      // Buscar reservas que están entre 1.5 y 2.5 horas en el futuro
      const [reservations] = await pool.query(`
        SELECT
          r.id,
          r.start_time,
          s.name as service_name,
          s.duration_min,
          c.name as customer_name,
          c.email as customer_email
        FROM saori.reservations r
        JOIN saori.services s ON r.service_id = s.id
        JOIN saori.customers c ON r.customer_id = c.id
        WHERE r.status IN ('pending', 'confirmed')
          AND r.start_time BETWEEN
            DATE_ADD(NOW(), INTERVAL 90 MINUTE)
            AND DATE_ADD(NOW(), INTERVAL 150 MINUTE)
          AND (r.reminder_2h_sent IS NULL OR r.reminder_2h_sent = 0)
      `);

      console.log(`📧 Encontradas ${reservations.length} reservas para recordatorio 2h`);

      for (const reservation of reservations) {
        try {
          // Enviar email
          await sendReminder2Hours({
            customerName: reservation.customer_name,
            customerEmail: reservation.customer_email,
            serviceName: reservation.service_name,
            date: reservation.start_time,
            time: new Date(reservation.start_time).toTimeString().slice(0, 5),
            reservationId: reservation.id
          });

          // Marcar como enviado
          await pool.query(
            'UPDATE saori.reservations SET reminder_2h_sent = 1 WHERE id = ?',
            [reservation.id]
          );

          console.log(`✓ Recordatorio 2h enviado para reserva #${reservation.id}`);
        } catch (err) {
          console.error(`❌ Error enviando recordatorio 2h para reserva #${reservation.id}:`, err);
        }
      }

      console.log('✓ Tarea completada: Recordatorios 2h');
    } catch (err) {
      console.error('❌ Error en tarea de recordatorios 2h:', err);
    }
  });

  console.log('✓ Recordatorios 2h programados (cada 30 minutos)');
}

/**
 * Tarea de limpieza: marca reservas pasadas como completadas
 * Se ejecuta una vez al día a las 2 AM
 */
function scheduleCleanupTasks() {
  cron.schedule('0 2 * * *', async () => {
    console.log('🔄 Ejecutando tarea: Limpieza de reservas...');

    try {
      const pool = getPool();

      // Marcar reservas pasadas como completadas (si no fueron canceladas)
      const [result] = await pool.query(`
        UPDATE saori.reservations
        SET status = 'completed'
        WHERE status IN ('pending', 'confirmed')
          AND end_time < NOW()
      `);

      console.log(`✓ ${result.affectedRows} reservas marcadas como completadas`);

      // Opcional: Cancelar reservas con seña pendiente después de 24h
      const [cancelResult] = await pool.query(`
        UPDATE saori.reservations
        SET status = 'canceled'
        WHERE status = 'pending'
          AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND start_time > NOW()
      `);

      console.log(`✓ ${cancelResult.affectedRows} reservas canceladas por falta de pago`);

      console.log('✓ Tarea completada: Limpieza de reservas');
    } catch (err) {
      console.error('❌ Error en tarea de limpieza:', err);
    }
  });

  console.log('✓ Tarea de limpieza programada (diaria a las 2 AM)');
}

/**
 * Inicializa todas las tareas programadas
 */
function initScheduler() {
  console.log('🚀 Inicializando sistema de recordatorios automáticos...');

  schedule24HourReminders();
  schedule2HourReminders();
  scheduleCleanupTasks();

  console.log('✓ Sistema de recordatorios iniciado correctamente');
  console.log('  - Recordatorios 24h: Cada hora');
  console.log('  - Recordatorios 2h: Cada 30 minutos');
  console.log('  - Limpieza: Diaria a las 2 AM');
}

/**
 * Detiene todas las tareas programadas
 */
function stopScheduler() {
  cron.getTasks().forEach(task => task.stop());
  console.log('✓ Sistema de recordatorios detenido');
}

module.exports = {
  initScheduler,
  stopScheduler
};
