// ========================================
// BELLA ESTÉTICA - SCRIPT DE CONFIGURACIÓN
// ========================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
    console.log('🌸 Bella Estética - Configuración Inicial');
    console.log('==========================================');
    
    try {
        // Verificar variables de entorno
        console.log('1. Verificando configuración...');
        
        if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
            throw new Error('Variables de entorno DB_* no configuradas. Revisa el archivo .env');
        }
        
        // Conectar a MySQL
        console.log('2. Conectando a MySQL...');
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD || ''
        });
        
        // Crear base de datos si no existe
        console.log('3. Creando base de datos...');
        
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`✅ Base de datos '${process.env.DB_NAME}' creada/verificada`);
        
        await connection.end();
        
        // Las tablas se crean automáticamente cuando se inicia el servidor
        console.log('4. Configuración completada');
        console.log('');
        console.log('🚀 Para iniciar el servidor:');
        console.log('   npm run dev');
        console.log('');
        console.log('🌐 El sitio estará disponible en:');
        console.log('   http://localhost:3000');
        console.log('');
        console.log('📋 Próximos pasos:');
        console.log('   1. Configurar claves de Mercado Pago en .env');
        console.log('   2. Configurar email en .env (opcional)');
        console.log('   3. Personalizar la información del negocio');
        
    } catch (error) {
        console.error('❌ Error en la configuración:', error.message);
        console.log('');
        console.log('💡 Soluciones comunes:');
        console.log('   - Verificar que MySQL esté ejecutándose');
        console.log('   - Revisar credenciales en el archivo .env');
        console.log('   - Asegurarte de que el usuario tenga permisos');
        process.exit(1);
    }
}

// Ejecutar setup
setup();