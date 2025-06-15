// utils/analyze.js

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeLeads(leads) {
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new Error('Invalid or empty lead list');
  }

  const prompt = `
You are an AI assistant for a SaaS sales rep analyzing lead data.
Based on the following lead entries, write a concise narrative summary of insights.
Focus on things like common states, statuses, tags, companies, or any emerging patterns.

Leads:
${JSON.stringify(leads, null, 2)}

Summary:
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 300,
  });

  return completion.choices[0].message.content;
}

module.exports = { analyzeLeads };
