import './setup-globals.js';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors'; // ✅ ADDED: CORS middleware
import path from 'path';
import { fileURLToPath } from 'url';

import summaryRoute from './routes/summary-route.js'; // ✅ match exact filename
import testRoute from './routes/test-route.js';       // ✅ new test route
import updateLeadRoute from './routes/update-lead.js'; // ✅ NEW: route for lead editing

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
app.use(cors()); // ✅ ADDED: allow cross-origin requests

// Routes
app.use('/my-summary', summaryRoute);
app.use('/test', testRoute);
app.use('/update-lead', updateLeadRoute); // ✅ NEW: lead editing endpoint

// Launch server
app.listen(PORT, () => {
  console.log(`✅ summary.js route file successfully loaded`);
  console.log(`✅ Server running on port ${PORT}`);
});
