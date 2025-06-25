// server.js
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import summaryRoute from './routes/summary-route.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View engine and static assets
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // ✅ Needed for JSON POST body

// Routes
app.use('/my-summary', summaryRoute);

// Start server
app.listen(PORT, () => {
  console.log(`✅ summary.js route file successfully loaded`);
  console.log(`✅ Server running on port ${PORT}`);
});
