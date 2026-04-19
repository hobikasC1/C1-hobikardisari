'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating practice questions (multiple choice and short answer) based on provided content.
 *
 * - generatePracticeQuestions - A function that generates practice questions based on the input content.
 * - GeneratePracticeQuestionsInput - The input type for the generatePracticeQuestions function.
 * - GeneratePracticeQuestionsOutput - The return type for the generatePracticeQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePracticeQuestionsInputSchema = z.object({
  textContent: z
    .string()
    .describe('The text content from which to generate practice questions.'),
});
export type GeneratePracticeQuestionsInput = z.infer<
  typeof GeneratePracticeQuestionsInputSchema
>;

const GeneratePracticeQuestionsOutputSchema = z.object({
  questions: z
    .array(z.string())
    .describe('An array of practice questions generated from the text content.'),
  progress: z.string().describe('Progress summary of practice question generation.'),
});
export type GeneratePracticeQuestionsOutput = z.infer<
  typeof GeneratePracticeQuestionsOutputSchema
>;

export async function generatePracticeQuestions(
  input: GeneratePracticeQuestionsInput
): Promise<GeneratePracticeQuestionsOutput> {
  return generatePracticeQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePracticeQuestionsPrompt',
  input: {schema: GeneratePracticeQuestionsInputSchema},
  output: {schema: GeneratePracticeQuestionsOutputSchema},
  prompt: `You are an expert educator specializing in generating practice questions to help students learn.

  Based on the provided text content, generate a variety of practice questions, including both multiple choice and short answer questions.
  The questions should cover the key concepts and relationships within the text.

  Text Content: {{{textContent}}}

  Questions: (Each question must be a single string in an array)
`,
});

const generatePracticeQuestionsFlow = ai.defineFlow(
  {
    name: 'generatePracticeQuestionsFlow',
    inputSchema: GeneratePracticeQuestionsInputSchema,
    outputSchema: GeneratePracticeQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {
      questions: output?.questions || [],
      progress: 'Generated practice questions based on the key concepts in the provided content.',
    };
  }
);
