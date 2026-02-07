/**
 * LLM Processing with Gemini (NEW SDK)
 *
 * Analyzes kid submissions and generates structured summaries
 */

import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set');
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface LLMAnalysisResult {
  summary: string;
  story: string;
  category: string;
  tags: string[];
  suggested_stars: number;
  confidence: number;
  needs_parent_review: boolean;
}

const CATEGORIES = [
  'Reading',
  'Chores',
  'Exercise',
  'Learning',
  'Creative',
  'Helping Others',
  'Other'
];

/**
 * Analyze a text submission with Gemini
 */
export async function analyzeSubmission(
  text: string,
  imageUrl?: string
): Promise<LLMAnalysisResult> {
  const prompt = `Analyze this achievement submission from a kid in a family reward system.

Kid's description: "${text}"
${imageUrl ? 'Image: [attached]' : 'No image provided'}

Return ONLY valid JSON with this exact structure:
{
  "summary": "Short one-sentence description of achievement (max 100 chars)",
  "story": "An engaging 2-4 sentence story about this achievement that celebrates the kid's effort (max 300 chars)",
  "category": "One of: ${CATEGORIES.join(', ')}",
  "tags": ["tag1", "tag2"],
  "suggested_stars": 2,
  "confidence": 0.85,
  "needs_parent_review": false
}

Rules:
- **IMPORTANT: Respond in the SAME LANGUAGE as the kid's description**
  - If the kid wrote in English, write summary and story in English
  - If the kid wrote in Chinese (中文), write summary and story in Chinese
  - Match the language automatically
- Keep summary under 100 characters
- Write story in third person, make it warm and encouraging (e.g., "Today, [Kid] showed responsibility by..." or "今天，[孩子]展現了責任感...")
- Keep story under 300 characters but make it descriptive and celebratory
- suggested_stars: 1-3 based on effort/achievement
  - 1 star: Small tasks (made bed, brushed teeth)
  - 2 stars: Medium tasks (homework, reading, chores)
  - 3 stars: Big achievements (completed project, big help, exceptional effort)
- Set needs_parent_review=true if:
  - Text is vague or unclear
  - Achievement seems exaggerated
  - Cannot determine actual effort
- confidence: 0.0-1.0 (how confident you are in the assessment)
- tags: 2-4 relevant keywords (can be in English or Chinese, matching the input language)
- NEVER invent facts not stated or shown
- If uncertain, set needs_parent_review=true`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const response = result.text || '';

    // Extract JSON from response (might have markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed: LLMAnalysisResult = JSON.parse(jsonMatch[0]);

    // Validate the response
    if (!parsed.summary || !parsed.story || !parsed.category || !Array.isArray(parsed.tags)) {
      throw new Error('Invalid LLM response structure');
    }

    // Ensure suggested_stars is between 1-3
    parsed.suggested_stars = Math.max(1, Math.min(3, parsed.suggested_stars));

    // Ensure confidence is between 0-1
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

    return parsed;
  } catch (error) {
    console.error('LLM analysis failed:', error);

    // Fallback response if LLM fails
    return {
      summary: text.substring(0, 100),
      story: `Today, this achievement was recorded: "${text.substring(0, 150)}". Great effort!`,
      category: 'Other',
      tags: ['unprocessed'],
      suggested_stars: 2,
      confidence: 0.0,
      needs_parent_review: true
    };
  }
}

/**
 * Test the LLM with a sample submission
 */
export async function testLLM() {
  console.log('🧪 Testing Gemini API...\n');

  const testCases = [
    'Read 20 pages of Harry Potter',
    'Cleaned my room and made my bed',
    'Did all my homework',
    'Helped mom with groceries'
  ];

  for (const text of testCases) {
    console.log(`📝 Input: "${text}"`);
    const result = await analyzeSubmission(text);
    console.log(`✅ Result:`, JSON.stringify(result, null, 2));
    console.log('---\n');
  }

  console.log('🎉 LLM test complete!');
}
