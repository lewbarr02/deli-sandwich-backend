// routes/summary.js
console.log("✅ summary.js route file successfully loaded");

require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

const auth = new google.auth.GoogleAuth({
  credentials: (() => {
    try {
      return JSON.parse(process.env.GOOGLE_CREDS);
    } catch (e) {
      console.error("❌ GOOGLE_CREDS parse failed:", e.message);
      return {};
    }
  })(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const SHEET_ID = '1dXgbgJOaQRnUjBt59Ox8Wfw1m5VyFmKd8F9XmCR1VkI';
const SHEET_NAME = 'Mapping_Tool_Master_List_Cleaned_Geocoded';

router.get('/', async (req, res) => {
  console.log("🟡 /my-summary route was hit with query:", req.query);
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME
    });

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
      if (obstacle) obstacleList.push({ company: row['Company'], obstacle });

      if (status === 'Hot' || status === 'Warm') {
        hotWarmNotes.push({
          company: row['Company'],
          status,
          state,
          note: row['Notes'],
          icon: statusIcon[status] || ''
        });
      }
    });

    const aiInsights = [
      `You contacted ${filtered.length} leads between ${req.query.from} and ${req.query.to}.`,
      `${hotWarmNotes.length} were marked as Hot or Warm.`,
      `Top states: ${Object.entries(regionCounts).sort((a,b) => b[1]-a[1]).slice(0, 2).map(e => e[0]).join(', ')}`,
      `Frequent tags: ${Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0, 2).map(e => e[0]).join(', ')}`,
      `Notable obstacles: ${obstacleList.length} leads mentioned a blocker.`
    ];

    const tagCountsArr = Object.entries(tagCounts).map(([label, count]) => ({
      label,
      count,
      icon: statusIcon[label] || '🏷️'
    }));

    const formattedLeads = filtered.map(row => ({
      name: row['Name'],
      company: row['Company'],
      status: row['Status'],
      statusIcon: statusIcon[row['Status']] || '',
      notes: row['Notes'] || '',
      Tags: row['Tags'] || '',
      ARR: row['ARR'] || '',
      Size: row['Size'] || '',
      Type: row['Type'] || '',
      Website: row['Website'] || '',
      City: row['City'] || '',
      State: row['State'] || '',
      Latitude: row['Latitude'] || '',
      Longitude: row['Longitude'] || ''
    }));

    res.render('summary', {
      dateRange,
      aiInsights,
      tagCounts: tagCountsArr,
      leads: formattedLeads,
      from: req.query.from,
      to: req.query.to
    });

  } catch (err) {
    console.error('❌ Error in /my-summary route:', err?.response?.data || err.message || err);
    res.status(500).send('Something went wrong.');
  }
});

router.post('/submit', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const lead = req.body;
    const id = lead.ID?.trim();

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME
    });

    const rows = getRes.data.values;
    const headers = rows[0];

    const targetRowIndex = rows.findIndex((row, i) => {
      if (i === 0) return false;
      const company = row[headers.indexOf("Company")]?.trim() || "";
      const city = row[headers.indexOf("City")]?.trim() || "";
      const state = row[headers.indexOf("State")]?.trim() || "";
      return `${company}|${city}|${state}` === id;
    }) + 1;

    const newRow = [
      lead.Name || '',
      lead.City || '',
      lead.State || '',
      lead.Company || '',
      lead.Tags || '',
      lead['Cadence Name'] || '',
      lead.Notes || '',
      lead.Website || '',
      lead.Date || new Date().toISOString().split('T')[0],
      lead.Type || '',
      lead.Status || '',
      lead['Net New'] || '',
      lead.Size || '',
      lead.ARR || '',
      lead.Obstacle || '',
      lead['Self Sourced'] || ''
    ];

    if (targetRowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A${targetRowIndex}:P${targetRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [newRow]
        }
      });
      console.log("🔁 Updated existing row for:", id);
      res.status(200).send("🔁 Updated existing row");
    } else {
      console.warn("❌ No matching row found for:", id);
      return res.status(400).send(`❌ No matching row found for ID: ${id}`);
    }

  } catch (err) {
    console.error("❌ Sheets API error:", err);
    res.status(500).send("❌ Failed to submit via Sheets API");
  }
});

module.exports = router;
