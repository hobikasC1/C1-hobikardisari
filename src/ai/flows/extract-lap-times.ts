'use server';

/**
 * @fileOverview This file defines a Genkit flow for extracting lap times from an image of a timing sheet.
 *
 * - extractLapTimes - A function that handles the image analysis and data extraction.
 * - ExtractLapTimesInput - The input type for the extractLapTimes function.
 * - ExtractLapTimesOutput - The return type for the extractLapTimes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LapTimeEntrySchema = z.object({
  kartNumber: z.number().describe('The kart number (No.).'),
  lapTime: z.string().describe('The best lap time (Overall BestTm).'),
});

const ExtractLapTimesInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a timing sheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractLapTimesInput = z.infer<typeof ExtractLapTimesInputSchema>;

const ExtractLapTimesOutputSchema = z.object({
  lapTimes: z
    .array(LapTimeEntrySchema)
    .describe('An array of lap time entries extracted from the image.'),
});
export type ExtractLapTimesOutput = z.infer<typeof ExtractLapTimesOutputSchema>;

export async function extractLapTimes(input: ExtractLapTimesInput): Promise<ExtractLapTimesOutput> {
  return extractLapTimesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractLapTimesPrompt',
  input: {schema: ExtractLapTimesInputSchema},
  output: {schema: ExtractLapTimesOutputSchema},
  prompt: `You are an expert race data assistant. Analyze the provided image of a race timing sheet.
Your task is to extract the kart number and the overall best lap time for each position.

- The kart number is under the "No." column.
- The lap time is under the "Overall BestTm" column.

Return the data as a structured array of lap time entries.

Image to analyze: {{media url=photoDataUri}}`,
});

const extractLapTimesFlow = ai.defineFlow(
  {
    name: 'extractLapTimesFlow',
    inputSchema: ExtractLapTimesInputSchema,
    outputSchema: ExtractLapTimesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output || { lapTimes: [] };
  }
);
