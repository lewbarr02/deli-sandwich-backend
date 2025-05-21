import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty lead list' });
  }

  const prompt = `
You are an AI assistant for a SaaS sales rep analyzing lead data.
Based on the following lead entries, write a concise narrative summary of insights.
Focus on things like common states, statuses, tags, companies, or any emerging patterns.

Leads:
${JSON.stringify(leads, null, 2)}

Summary:
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 300
    });

    const message = completion.choices[0].message.content;
    res.status(200).json({ summary: message });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
}

