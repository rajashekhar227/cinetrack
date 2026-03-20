require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
connectDB();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/movies',          require('./routes/movies'));
app.use('/api/reviews',         require('./routes/reviews'));
app.use('/api/lists',           require('./routes/lists'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/activity',        require('./routes/activity'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/groups',          require('./routes/groups'));
app.use('/api/messages',        require('./routes/messages'));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎬 CineTrack running at http://localhost:${PORT}`);
});