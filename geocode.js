require("dotenv").config();
const { Client } = require("pg");
const fetch = require("node-fetch");

const db = new Client({
  connectionString: process.env.DATABASE_URL,
});

db.connect().then(async () => {
  const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;
  if (!OPENCAGE_API_KEY) {
    console.error("❌ Missing OPENCAGE_API_KEY in .env");
    process.exit(1);
  }

  const results = await db.query(`
    SELECT id, city, state
    FROM leads
    WHERE (lat IS NULL OR lat = '') OR (lon IS NULL OR lon = '')
  `);

  console.log(`🌍 Found ${results.rows.length} leads missing lat/lon...`);

  for (const row of results.rows) {
    const { id, city, state } = row;
    if (!city || !state) continue;

    const query = `${city}, ${state}`;
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&limit=1`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data?.results?.[0]?.geometry) {
        const { lat, lng } = data.results[0].geometry;

        await db.query(
          `UPDATE leads SET lat = $1, lon = $2 WHERE id = $3`,
          [lat.toString(), lng.toString(), id]
        );

        console.log(`✅ Updated ${query} → (${lat}, ${lng})`);
      } else {
        console.warn(`⚠️ No result for ${query}`);
      }
    } catch (err) {
      console.error(`❌ Error for ${query}:`, err.message);
    }

    await new Promise((r) => setTimeout(r, 1000)); // Respect rate limit
  }

  await db.end();
  console.log("🎉 Done geocoding.");
});
