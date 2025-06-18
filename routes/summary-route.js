// routes/summary.js
console.log("✅ summary.js route file successfully loaded");

require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const router = express.Router();

const rawCreds = (() => {
  try {
    return JSON.parse(process.env.GOOGLE_CREDS);
  } catch (e) {
    console.error("❌ GOOGLE_CREDS parse failed:", e.message);
    return {};
  }
})();

const SHEET_ID = '1dXgbgJOaQRnUjBt59Ox8Wfw1m5VyFmKd8F9XmCR1VkI';
const SHEET_NAME = 'Mapping_Tool_Master_List_Cleaned_Geocoded';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function getAccessToken() {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const payload = {
    iss: rawCreds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: GOOGLE_TOKEN_URL,
    exp,
    iat
  };

  const signedJWT = jwt.sign(payload, rawCreds.private_key, { algorithm: 'RS256' });

  const response = await axios.post(GOOGLE_TOKEN_URL, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedJWT
  });

  return response.data.access_token;
}

router.get('/', async (req, res) => {
  console.log("🟡 /my-summary route was hit with query:", req.query);
  try {
    const accessToken = await getAccessToken();

    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const rows = response.data.values;
    const dateRange = `${req.query.from} – ${req.query.to}`;

    if (!rows || rows.length < 2) {
      return res.render('summary', {
        dateRange,
        aiInsights: ['No data found.'],
        tagCounts: [],
        leads: []
      });
    }

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });

    const fromDate = new Date(req.query.from);
    const toDate = new Date(req.query.to);

    const filtered = data.filter(row => {
      const rawDate = row['Date'];
      const d = new Date(rawDate);
      return !isNaN(d) && d >= fromDate && d <= toDate;
    });

    const statusIcon = {
      'Hot': '🔥',
      'Warm': '🌞',
      'Converted': '🏆',
      'Cold': '🧊',
      'Research': '🔍',
      'Follow-Up': '⏳'
    };

    const tagCounts = {};
    const regionCounts = {};
    const obstacleList = [];
    const hotWarmNotes = [];

    filtered.forEach(row => {
      const tag = row['Tags'];
      const state = row['State'];
      const status = row['Status'];
      const obstacle = row['Obstacle'];

      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      if (state) regionCounts[state] = (regionCounts[state] || 0) + 1;
      if (obstacle) ob
