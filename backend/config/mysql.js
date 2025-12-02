// backend/config/mysql.js
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'saori',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('MySQL pool creado para base de datos:');
  }
  return pool;
}

module.exports = { getPool };G