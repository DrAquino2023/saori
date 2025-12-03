const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

// Configuración del transportador
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

/**
 * Lee una plantilla HTML y reemplaza los placeholders
 */
async function loadTemplate(templateName, data) {
    try {
        const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
        let template = await fs.readFile(templatePath, 'utf-8');

        // Reemplazar placeholders con datos reales
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, data[key] || '');
        });

        return template;
    } catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        throw error;
    }
}

/**
 * Formatea una fecha a formato legible en español
 */
function formatDate(date) {
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    return new Date(date).toLocaleDateString('es-AR', options);
}

/**
 * Envía email de confirmación de reserva
 */
async function sendConfirmationEmail(reservationData) {
    try {
        const { customerName, customerEmail, serviceName, date, time, duration, reservationId } = reservationData;

        const templateData = {
            customerName,
            serviceName,
            date: formatDate(date),
            time,
            duration: duration || '90',
            reservationId
        };

        const htmlContent = await loadTemplate('confirmacion-reserva', templateData);

        const mailOptions = {
            from: `"Saori - Centro de Estética" <${process.env.EMAIL_USER}>`,
            to: customerEmail,
            subject: `✓ Reserva Confirmada #${reservationId} - Saori`,
            html: htmlContent,
            text: `Hola ${customerName},\n\nTu reserva ha sido confirmada:\n\nServicio: ${serviceName}\nFecha: ${formatDate(date)}\nHora: ${time} hs\nNº Reserva: #${reservationId}\n\n¡Te esperamos!\n\nSaori - Centro de Estética`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email de confirmación enviado a ${customerEmail}:`, info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error enviando email de confirmación:', error);
        throw error;
    }
}

/**
 * Envía recordatorio 24 horas antes del turno
 */
async function sendReminder24Hours(reservationData) {
    try {
        const { customerName, customerEmail, serviceName, date, time, reservationId } = reservationData;

        const templateData = {
            customerName,
            serviceName,
            date: formatDate(date),
            time,
            reservationId
        };

        const htmlContent = await loadTemplate('recordatorio-24h', templateData);

        const mailOptions = {
            from: `"Saori - Centro de Estética" <${process.env.EMAIL_USER}>`,
            to: customerEmail,
            subject: `🔔 Recordatorio: Tu turno es mañana - Saori`,
            html: htmlContent,
            text: `Hola ${customerName},\n\nTe recordamos que mañana tienes tu turno:\n\nServicio: ${serviceName}\nFecha: ${formatDate(date)}\nHora: ${time} hs\n\n¡Te esperamos!\n\nSaori - Centro de Estética`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Recordatorio 24h enviado a ${customerEmail}:`, info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error enviando recordatorio 24h:', error);
        throw error;
    }
}

/**
 * Envía recordatorio 2 horas antes del turno
 */
async function sendReminder2Hours(reservationData) {
    try {
        const { customerName, customerEmail, serviceName, date, time, reservationId } = reservationData;

        const templateData = {
            customerName,
            serviceName,
            date: formatDate(date),
            time,
            reservationId
        };

        const htmlContent = await loadTemplate('recordatorio-2h', templateData);

        const mailOptions = {
            from: `"Saori - Centro de Estética" <${process.env.EMAIL_USER}>`,
            to: customerEmail,
            subject: `⏰ ¡Tu turno es HOY a las ${time}! - Saori`,
            html: htmlContent,
            text: `Hola ${customerName},\n\n¡Tu turno es HOY!\n\nServicio: ${serviceName}\nHora: ${time} hs\nDirección: Ombú 2865, San Justo\n\n¡Te esperamos en 2 horas!\n\nSaori - Centro de Estética`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Recordatorio 2h enviado a ${customerEmail}:`, info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error enviando recordatorio 2h:', error);
        throw error;
    }
}

/**
 * Envía email de cancelación
 */
async function sendCancellationEmail(reservationData) {
    try {
        const { customerName, customerEmail, serviceName, date, time, reservationId } = reservationData;

        const mailOptions = {
            from: `"Saori - Centro de Estética" <${process.env.EMAIL_USER}>`,
            to: customerEmail,
            subject: `❌ Reserva Cancelada #${reservationId} - Saori`,
            html: `
                <h2>Reserva Cancelada</h2>
                <p>Hola <strong>${customerName}</strong>,</p>
                <p>Tu reserva ha sido cancelada:</p>
                <ul>
                    <li><strong>Servicio:</strong> ${serviceName}</li>
                    <li><strong>Fecha:</strong> ${formatDate(date)}</li>
                    <li><strong>Hora:</strong> ${time} hs</li>
                    <li><strong>Nº Reserva:</strong> #${reservationId}</li>
                </ul>
                <p>Si deseas agendar un nuevo turno, <a href="https://wa.me/5491122481809">contáctanos</a>.</p>
                <p>Saludos,<br>Equipo Saori</p>
            `,
            text: `Hola ${customerName},\n\nTu reserva #${reservationId} ha sido cancelada.\n\nSi deseas agendar un nuevo turno, contáctanos.\n\nSaori - Centro de Estética`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Email de cancelación enviado a ${customerEmail}:`, info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error enviando email de cancelación:', error);
        throw error;
    }
}

/**
 * Verifica la configuración del servicio de email
 */
async function verifyEmailConfig() {
    try {
        await transporter.verify();
        console.log('✓ Servicio de email configurado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error en configuración de email:', error);
        return false;
    }
}

module.exports = {
    sendConfirmationEmail,
    sendReminder24Hours,
    sendReminder2Hours,
    sendCancellationEmail,
    verifyEmailConfig
};
