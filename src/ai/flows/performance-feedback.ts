// src/ai/flows/performance-feedback.ts
'use server';
/**
 * @fileOverview A flow that provides personalized feedback on user answers.
 *
 * - getPersonalizedFeedback - A function that provides personalized feedback on user answers.
 * - PersonalizedFeedbackInput - The input type for the getPersonalizedFeedback function.
 * - PersonalizedFeedbackOutput - The return type for the getPersonalizedFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedFeedbackInputSchema = z.object({
  question: z.string().describe('The question asked.'),
  answer: z.string().describe('The user provided answer.'),
  correctAnswer: z.string().describe('The correct answer to the question.'),
  topic: z.string().describe('The topic or subject of the question.'),
});
export type PersonalizedFeedbackInput = z.infer<typeof PersonalizedFeedbackInputSchema>;

const PersonalizedFeedbackOutputSchema = z.object({
  feedback: z.string().describe('Personalized feedback on the user answer.'),
  correct: z.boolean().describe('Whether the answer was correct or not'),
});
export type PersonalizedFeedbackOutput = z.infer<typeof PersonalizedFeedbackOutputSchema>;

export async function getPersonalizedFeedback(input: PersonalizedFeedbackInput): Promise<PersonalizedFeedbackOutput> {
  return personalizedFeedbackFlow(input);
}

const personalizedFeedbackPrompt = ai.definePrompt({
  name: 'personalizedFeedbackPrompt',
  input: {schema: PersonalizedFeedbackInputSchema},
  output: {schema: PersonalizedFeedbackOutputSchema},
  prompt: `You are an AI study assistant that provides helpful and constructive feedback on student answers.

  Question: {{{question}}}
  Student Answer: {{{answer}}}
  Correct Answer: {{{correctAnswer}}}
  Topic: {{{topic}}}

  Provide feedback to the student. The feedback should:
  * Highlight correct aspects of the answer.
  * Identify areas for improvement, and explain why the original answer was incorrect.
  * Offer explanations to clarify difficult concepts.
  * Be encouraging and promote further learning.

  In addition to the feedback, also state whether the answer was correct or not, setting the 'correct' output field to true or false.
`,
});

const personalizedFeedbackFlow = ai.defineFlow(
  {
    name: 'personalizedFeedbackFlow',
    inputSchema: PersonalizedFeedbackInputSchema,
    outputSchema: PersonalizedFeedbackOutputSchema,
  },
  async input => {
    const {output} = await personalizedFeedbackPrompt(input);
    return output!;
  }
);
