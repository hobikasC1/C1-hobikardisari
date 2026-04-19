
import { config } from 'dotenv';
config();

// No AI flows are currently used in the Hobbykarting Racing System.
// If AI features are added later (e.g., predicting race outcomes, analyzing driver performance),
// relevant flow imports can be added here.

// Example: import '@/ai/flows/predict-race-outcome.ts';
import '@/ai/flows/extract-lap-times';
import '@/ai/flows/extract-race-results';

