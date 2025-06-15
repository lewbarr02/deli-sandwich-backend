const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = async function generateSummary(leads) {
  const prompt = `
You are an AI assistant for a SaaS sales rep analyzing lead data.
Write a short narrative summary based on the following leads:

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
    return completion.choices[0].message.content;
  } catch (err) {
    console.error("OpenAI error:", err);
    return "Unable to generate summary.";
  }
};