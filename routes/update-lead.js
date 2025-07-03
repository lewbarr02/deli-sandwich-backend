// Trigger redeploy to ensure last_updated field is live
// routes/update-lead.js

import express from 'express';
import db from '../db.js'; // assumes you have db.js exporting a pooled pg client

const router = express.Router();

router.post('/', async (req, res) => {
  const {
    id,
    tags,
    type,
    status,
    notes,
    website,
    net_new,
    size,
    arr,
    obstacle,
    self_sourced
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing lead ID' });
  }

  try {
    const result = await db.query(
      `
      INSERT INTO leads (
        id, tags, type, status, notes,
        website, net_new, size, arr, obstacle, self_sourced
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        tags = EXCLUDED.tags,
        type = EXCLUDED.type,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        website = EXCLUDED.website,
        net_new = EXCLUDED.net_new,
        size = EXCLUDED.size,
        arr = EXCLUDED.arr,
        obstacle = EXCLUDED.obstacle,
        self_sourced = EXCLUDED.self_sourced,
        last_updated = NOW()
      RETURNING *;
      `,
      [
        id,
        tags || null,
        type || null,
        status || null,
        notes || null,
        website || null,
        net_new || null,
        size || null,
        arr !== undefined ? parseFloat(arr) : 0,
        obstacle || null,
        typeof self_sourced === 'boolean' ? self_sourced : self_sourced === 'Yes'
      ]
    );

    res.json({ success: true, lead: result.rows[0] });
  } catch (err) {
    console.error('❌ Database error in /update-lead:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
// trigger redeploy
