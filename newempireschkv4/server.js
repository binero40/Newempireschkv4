const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Ensure data dir
fs.mkdirSync('./data', { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static
app.use('/public', express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/checker', require('./routes/checker'));
app.use('/api/cookies', require('./routes/cookies'));
app.use('/api/generator', require('./routes/generator'));
app.use('/api/admin', require('./routes/admin'));

// Health
app.get('/health', (req, res) => res.json({ status: 'alive', uptime: process.uptime() }));

app.listen(PORT, () => {
  console.log(`🏰 New Empires Amazon running on port ${PORT}`);
});
