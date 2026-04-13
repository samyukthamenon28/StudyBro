import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function buildFallbackConcepts(material) {
  const cleaned = material.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const concepts = [];
  let current = '';
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 220 && current) {
      concepts.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current) concepts.push(current);

  return concepts.slice(0, 12).map((text, index) => ({
    title: `Concept ${index + 1}`,
    text,
    question: `Explain concept ${index + 1} in your own words.`,
    expectedAnswer: text,
    simplifiedExplanation: text,
    flashcardFront: `Concept ${index + 1}`,
    flashcardBack: text,
    tags: ['studybro'],
  }));
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model,
  });
});

app.post('/api/study/analyze', async (request, response) => {
  const material = String(request.body?.material || '').trim();
  const title = String(request.body?.title || 'Untitled Material').trim();

  if (!material) {
    response.status(400).json({ error: 'Material is required.' });
    return;
  }

  const client = getOpenAIClient();
  if (!client) {
    response.json({ provider: 'fallback', concepts: buildFallbackConcepts(material) });
    return;
  }

  try {
    const aiResponse = await client.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: 'You turn study material into structured study concepts. Respond with strict JSON only.' }],
        },
        {
          role: 'user',
          content: [{
            type: 'input_text',
            text: `Analyze this study material concept by concept for StudyBRO.\n\nTitle: ${title}\n\nMaterial:\n${material}\n\nReturn JSON with this exact shape:\n{\n  "concepts": [\n    {\n      "title": "short concept title",\n      "text": "source concept summary based on the material",\n      "question": "one recall question for this concept",\n      "expectedAnswer": "what a strong answer should include",\n      "simplifiedExplanation": "simpler re-explanation for weak students",\n      "flashcardFront": "front of flashcard",\n      "flashcardBack": "back of flashcard",\n      "tags": ["keyword", "keyword"]\n    }\n  ]\n}\n\nRules:\n- Split into 3 to 10 concepts depending on the material.\n- Keep concepts in study order.\n- Questions must be concept-specific.\n- Flashcards must be useful for revision.\n- Keep tags short.\n- Do not include markdown fences.\n- Output valid JSON only.`,
          }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'studybro_concepts',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              concepts: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    text: { type: 'string' },
                    question: { type: 'string' },
                    expectedAnswer: { type: 'string' },
                    simplifiedExplanation: { type: 'string' },
                    flashcardFront: { type: 'string' },
                    flashcardBack: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['title', 'text', 'question', 'expectedAnswer', 'simplifiedExplanation', 'flashcardFront', 'flashcardBack', 'tags'],
                },
              },
            },
            required: ['concepts'],
          },
        },
      },
    });

    const parsed = JSON.parse(aiResponse.output_text || '{}');
    response.json({
      provider: 'openai',
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : buildFallbackConcepts(material),
    });
  } catch (error) {
    response.status(500).json({
      error: 'AI analysis failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
      provider: 'error',
      concepts: buildFallbackConcepts(material),
    });
  }
});

app.listen(port, () => {
  console.log(`StudyBRO AI server listening on http://localhost:${port}`);
});
