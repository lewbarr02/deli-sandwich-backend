import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import summaryRoute from './routes/summary-route.js'; // ✅ match exact filename
import testRoute from './routes/test-route.js';       // ✅ new test route

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ESM __dirname support
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.use('/my-summary', summaryRoute);
app.use('/test', testRoute); // ✅ mount new test route

// Launch server
app.listen(PORT, () => {
  console.log(`✅ summary.js route file successfully loaded`);
  console.log(`✅ Server running on port ${PORT}`);
});
