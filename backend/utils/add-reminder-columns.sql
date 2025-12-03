-- Script de migración para agregar columnas de recordatorios
-- Ejecutar este script en MySQL para habilitar el tracking de recordatorios

USE saori;

-- Agregar columnas para trackear recordatorios enviados
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_2h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Agregar índices para mejorar performance de las queries de recordatorios
CREATE INDEX IF NOT EXISTS idx_reservations_start_time_status
ON reservations(start_time, status);

CREATE INDEX IF NOT EXISTS idx_reservations_reminders
ON reservations(reminder_24h_sent, reminder_2h_sent, start_time);

-- Verificar cambios
DESCRIBE reservations;
