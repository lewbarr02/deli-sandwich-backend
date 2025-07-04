// routes/summary-route.js
import { Blob } from 'buffer';
globalThis.Blob = Blob;

import dotenv from 'dotenv';
import express from 'express';
import { Pool } from 'pg';
import { OpenAI } from 'openai';
import fetch from 'node-fetch';
import { FormData } from 'formdata-node';

dotenv.config();

globalThis.fetch = fetch;
globalThis.Headers = fetch.Headers;
globalThis.FormData = FormData;

const router = express.Router();

// 🔐 PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.get('/', async (req, res) => {
  console.log("🟡 /my-summary route was hit with query:", req.query);

  try {
    const client = await pool.connect();
    const { from, to } = req.query;

    const result = await client.query(`
      SELECT * FROM leads
      WHERE date_added >= $1 AND date_added <= $2
    `, [from, to]);

    const rows = result.rows;
    const dateRange = `${from} – ${to}`;

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

    rows.forEach(row => {
      const tag = row.tags;
      const state = row.state;
      const status = row.status;
      const obstacle = row.obstacle;

      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      if (state) regionCounts[state] = (regionCounts[state] || 0) + 1;
      if (obstacle) obstacleList.push({ company: row.company, obstacle });

      if (['Hot', 'Warm'].includes(status)) {
        hotWarmNotes.push({
          company: row.company,
          status,
          state,
          note: row.notes,
          icon: statusIcon[status] || ''
        });
      }

      if (row.notes || row.cadence || row.tags || row.status) {
        totalConnected++;
      }

      const prevStatus = row.previous_status || 'Unspecified';
      const prevTags = (row.previous_tags || '').split(',').map(t => t.trim());
      const currentTags = (row.tags || '').split(',').map(t => t.trim());

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

    const fromMMDD = `${from.slice(5)}`;
    const toMMDD = `${to.slice(5)}`;

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

Return clean HTML that preserves line breaks between highlight lines and starts the narrative section with the label “Insights:”`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: aiPrompt }],
      model: "gpt-4"
    });

    const aiResponse = completion.choices[0].message.content;
    const aiInsights = [aiResponse];

    const tagCountsArr = Object.entries(tagCounts).map(([label, count]) => ({
      label,
      count,
      icon: statusIcon[label] || '🏷️'
    }));

    const formattedLeads = rows.map(row => ({
      name: row.name,
      company: row.company,
      status: row.status,
      statusIcon: statusIcon[row.status] || '',
      notes: row.notes || '',
      Tags: row.tags || '',
      ARR: row.arr || '',
      Size: row.size || '',
      Type: row.type || '',
      Website: row.website || '',
      City: row.city || '',
      State: row.state || '',
      Latitude: row.lat || '',
      Longitude: row.lon || ''
    }));

    const hotLeads = formattedLeads.filter(l => l.status === 'Hot');
    const warmLeads = formattedLeads.filter(l => l.status === 'Warm');
    const convertedLeads = formattedLeads.filter(l => l.status === 'Converted');

    client.release();

    res.render('summary-v3', {
      dateRange,
      aiInsights,
      tagCounts: tagCountsArr,
      leads: [...hotLeads, ...warmLeads, ...convertedLeads],
      hotLeads,
      warmLeads,
      convertedLeads,
      from,
      to
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

export default router;
