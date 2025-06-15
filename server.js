require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const summaryRoute = require('./routes/summary');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(express.json());

app.use('/my-summary', summaryRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
