'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface OcrResultRow {
  position: number;
  kartNumber: number;
  totalTime: string;
  bestTime: string;
  laps: number;
}

const PROMPT = `You are analyzing a race timing results sheet from LapSnapper Sports Timing.
Extract ALL rows from the results table. Each row has: Position, Driver (which is the kart number), Total time, Dif, Best time, Laps.

Return ONLY a JSON array with this exact structure (no markdown, no explanation):
[
  { "position": 1, "kartNumber": 7, "totalTime": "06:52.363", "bestTime": "00:57.371", "laps": 7 }
]

Rules:
- "Driver" column contains the KART NUMBER (an integer), not a name
- Times should be in the exact format shown on the sheet (MM:SS.mmm or SS.mmm)
- Position is the finishing position (integer)
- Include ALL rows, even if partially visible
- Return raw JSON only, no code blocks`;

const OCR_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash'] as const;

export async function extractResultsFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<OcrResultRow[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);

  let result: Awaited<ReturnType<ReturnType<typeof genAI.getGenerativeModel>['generateContent']>> | null = null;
  let lastError: unknown = null;

  for (const modelName of OCR_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      result = await model.generateContent([
        { text: PROMPT },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ]);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!result) {
    const message = lastError instanceof Error ? lastError.message : 'Unknown Gemini OCR error';
    throw new Error(`OCR model request failed: ${message}`);
  }

  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    return parsed as OcrResultRow[];
  } catch {
    throw new Error(`Failed to parse Gemini response: ${cleaned.slice(0, 200)}`);
  }
}
