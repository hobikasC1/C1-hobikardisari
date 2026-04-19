
'use server';

/**
 * @fileOverview This file defines a Genkit flow for extracting full race results from an image of a timing sheet.
 *
 * - extractRaceResults - A function that handles the image analysis and data extraction for race results.
 * - ExtractRaceResultsInput - The input type for the extractRaceResults function.
 * - ExtractRaceResultsOutput - The return type for the extractRaceResults function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RaceResultEntrySchema = z.object({
  kartNumber: z.number().describe('The kart number (No.).'),
  finishingPosition: z.number().describe('The finishing position (Pos).'),
  fastestLap: z.string().describe('The fastest lap time (BestLap).'),
  totalTime: z.string().describe('The total race time (Time).'),
});

const ExtractRaceResultsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a race timing sheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractRaceResultsInput = z.infer<typeof ExtractRaceResultsInputSchema>;

const ExtractRaceResultsOutputSchema = z.object({
  raceResults: z
    .array(RaceResultEntrySchema)
    .describe('An array of race result entries extracted from the image.'),
});
export type ExtractRaceResultsOutput = z.infer<typeof ExtractRaceResultsOutputSchema>;

export async function extractRaceResults(input: ExtractRaceResultsInput): Promise<ExtractRaceResultsOutput> {
  return extractRaceResultsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractRaceResultsPrompt',
  input: {schema: ExtractRaceResultsInputSchema},
  output: {schema: ExtractRaceResultsOutputSchema},
  prompt: `You are an expert race data assistant. Analyze the provided image of a race timing sheet.
Your task is to extract the finishing position, kart number, total time, and fastest lap for each driver.

- The finishing position is under the "Pos" column.
- The kart number is under the "No." column.
- The total race time is under the "Time" column.
- The fastest lap time is under the "BestLap" column.

Return the data as a structured array of race result entries.

Image to analyze: {{media url=photoDataUri}}`,
});

const extractRaceResultsFlow = ai.defineFlow(
  {
    name: 'extractRaceResultsFlow',
    inputSchema: ExtractRaceResultsInputSchema,
    outputSchema: ExtractRaceResultsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output || { raceResults: [] };
  }
);

