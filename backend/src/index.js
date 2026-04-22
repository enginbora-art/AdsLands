const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'https://adslands-frontend.onrender.com'],
}));
app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`AdsLens API running on http://localhost:${PORT}`);
});
