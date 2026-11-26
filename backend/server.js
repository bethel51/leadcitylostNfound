const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment config
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://lcufindme.space',
    'https://www.lcufindme.space',
    'https://leadcitylostnfound.onrender.com',
    'http://127.0.0.1:5000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'null' // allow file:// protocol (opened locally)
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increased limit to support base64 profile/item photo data
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/admin', require('./routes/admin'));

// Base Route
app.get('/', (req, res) => {
  res.send('LCU FindMe API is running successfully...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});
