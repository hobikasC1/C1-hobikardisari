'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing text content and extracting key concepts and relationships.
 *
 * - analyzeTextContent - A function that handles the text analysis process.
 * - AnalyzeTextContentInput - The input type for the analyzeTextContent function.
 * - AnalyzeTextContentOutput - The return type for the analyzeTextContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeTextContentInputSchema = z.object({
  textContent: z
    .string()
    .describe('The text content to be analyzed. This can be pasted or uploaded by the user.'),
});
export type AnalyzeTextContentInput = z.infer<typeof AnalyzeTextContentInputSchema>;

const AnalyzeTextContentOutputSchema = z.object({
  keyConcepts: z
    .string()
    .describe('A summary of the key concepts extracted from the text content.'),
  relationships: z
    .string()
    .describe('A description of the relationships between the key concepts.'),
  summary: z.string().describe('A concise summary of the provided text content.'),
});
export type AnalyzeTextContentOutput = z.infer<typeof AnalyzeTextContentOutputSchema>;

export async function analyzeTextContent(input: AnalyzeTextContentInput): Promise<AnalyzeTextContentOutput> {
  return analyzeTextContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeTextContentPrompt',
  input: {schema: AnalyzeTextContentInputSchema},
  output: {schema: AnalyzeTextContentOutputSchema},
  prompt: `You are an AI assistant designed to analyze text content and extract key concepts and relationships.

  Analyze the following text content and provide a summary of the key concepts, a description of the relationships between the concepts, and a concise summary of the text.

  Text Content: {{{textContent}}}`,
});

const analyzeTextContentFlow = ai.defineFlow(
  {
    name: 'analyzeTextContentFlow',
    inputSchema: AnalyzeTextContentInputSchema,
    outputSchema: AnalyzeTextContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
