// routes/summary.js
console.log("✅ summary.js route file successfully loaded");

require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
globalThis.fetch = fetch;

import('node-fetch').then(module => {
  globalThis.Headers = module.Headers;
  globalThis.Request = module.Request;
  globalThis.Response = module.Response;
});

const { Blob, FormData } = require('formdata-node');
globalThis.Blob = Blob;
globalThis.FormData = FormData;

const { OpenAI } = require("openai");
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const privateKey = rawCreds.private_key?.replace(/\\n/g, '\n');
  const signedJWT = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

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

    let totalConnected = 0;
    let upgrades = 0;
    let downgrades = 0;
    const tagUpgradeCount = {};
    const tagDowngradeCount = {};
    const regionScore = {};

    const statusRank = {
      "Unspecified": 0,
      "Research": 1,
      "Follow-Up": 2,
      "Cold": 3,
      "Warm": 4,
      "Hot": 5,
      "Converted": 6
    };

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

      if (row['Notes'] || row['Cadence'] || row['Tags'] || row['Status']) {
        totalConnected++;
      }

      const prevStatus = row['Previous Status'] || 'Unspecified';
      const prevTags = (row['Previous Tags'] || '').split(',').map(t => t.trim());
      const currentTags = (row['Tags'] || '').split(',').map(t => t.trim());

      const currRank = statusRank[status] || 0;
      const prevRank = statusRank[prevStatus] || 0;

      if (currRank > prevRank) {
        upgrades++;
        currentTags.forEach(tag => {
          if (!prevTags.includes(tag)) {
            tagUpgradeCount[tag] = (tagUpgradeCount[tag] || 0) + 1;
          }
        });
      }

      if (currRank < prevRank) {
        downgrades++;
        currentTags.forEach(tag => {
          if (!prevTags.includes(tag)) {
            tagDowngradeCount[tag] = (tagDowngradeCount[tag] || 0) + 1;
          }
        });
      }

      if (!regionScore[state]) regionScore[state] = 0;
      if (status === "Converted") regionScore[state] += 3;
      else if (status === "Hot") regionScore[state] += 2;
      else if (status === "Warm") regionScore[state] += 1;
      else if (status === "Cold") regionScore[state] -= 1;
      else if (["Research", "Follow-Up"].includes(status)) regionScore[state] -= 0.5;
    });

    const getTopKey = (obj) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    const topUpgradeTag = getTopKey(tagUpgradeCount);
    const topDowngradeTag = getTopKey(tagDowngradeCount);

    const sortedRegions = Object.entries(regionScore).sort((a, b) => b[1] - a[1]);
    const strongestRegion = sortedRegions[0]?.[0] || "Unknown";
    const weakestRegion = sortedRegions[sortedRegions.length - 1]?.[0] || "Unknown";

    const fromMMDD = `${req.query.from.slice(5)}`;
    const toMMDD = `${req.query.to.slice(5)}`;

    const aiPrompt = `
Summarize the following metrics using MM-DD formatted dates and separate the output into two parts:
1. A highlight block with short single-sentence callouts (no actual bullets)
2. An "Insights:" paragraph afterward.

Details:
- You engaged with ${totalConnected} leads between ${fromMMDD} and ${toMMDD}.
- ${upgrades} leads had a status upgrade.
- ${downgrades} leads had a status downgrade.
- Most frequent upgrade tag: ${topUpgradeTag}.
- Most frequent downgrade tag: ${topDowngradeTag}.
- Strongest region: ${strongestRegion}.
- Weakest region: ${weakestRegion}.

Return clean HTML that preserves line breaks between highlight lines and starts the narrative section with the label “Insights:”
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: aiPrompt }],
      model: "gpt-4"
    });

    const aiResponse = completion.choices[0].message.content;
    console.log("🧠 AI Response:", aiResponse);

    const aiInsights = [aiResponse];

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
    console.error('❌ Error in /my-summary route:', {
      message: err.message,
      stack: err.stack,
      full: err
    });
    res.status(500).send('Something went wrong.');
  }
});

module.exports = router;
