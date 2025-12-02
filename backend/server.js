// 1) cargar .env al inicio
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');   // opcional: podrías usar express.json()
const cors = require('cors');
const routes = require('./routes/index');

const app = express();
// 2) puerto por .env con fallback 3001
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Rutas
app.use('/api', routes);

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// Start
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
