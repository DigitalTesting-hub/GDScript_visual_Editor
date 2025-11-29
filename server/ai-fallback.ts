import { generateWithGemini } from "./gemini";
import { generateWithGroq } from "./groq";

/**
 * Fallback logic: Try Gemini first, fall back to Groq if it fails
 */
export async function generateWithFallback(
  model: string,
  prompt: string,
  context?: string
): Promise<string> {
  const useGroq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0;

  try {
    console.log(`[AI] Attempting with Gemini (${model})...`);
    const result = await generateWithGemini(model, prompt, context);
    console.log("[AI] ✓ Gemini succeeded");
    return result;
  } catch (geminiError) {
    const errorMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
    console.warn(`[AI] Gemini failed: ${errorMsg}`);

    // Check if it's a rate limit error
    if (
      errorMsg.includes("429") ||
      errorMsg.includes("quota") ||
      errorMsg.includes("rate limit") ||
      errorMsg.includes("RESOURCE_EXHAUSTED")
    ) {
      console.log("[AI] Rate limit detected, attempting fallback to Groq...");

      if (!useGroq) {
        console.error("[AI] Groq API key not configured, cannot fallback");
        throw new Error("Gemini rate limited and Groq not configured");
      }

      try {
        const groqModel = model === "gemini-2.5-flash" ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
        console.log(`[AI] Attempting with Groq (${groqModel})...`);
        const result = await generateWithGroq(groqModel, prompt, context);
        console.log("[AI] ✓ Groq succeeded (fallback)");
        return result;
      } catch (groqError) {
        const groqErrorMsg = groqError instanceof Error ? groqError.message : String(groqError);
        console.error(`[AI] Groq fallback also failed: ${groqErrorMsg}`);
        throw new Error(`Both Gemini and Groq failed. Gemini: ${errorMsg}, Groq: ${groqErrorMsg}`);
      }
    }

    // If not a rate limit error, just throw
    throw geminiError;
  }
}
