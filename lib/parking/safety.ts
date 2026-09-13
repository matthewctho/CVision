import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { SafetyScore } from "@/lib/types";

// Gemini's free tier (no card required) is plenty for a short per-lot
// classification task like this.
const MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You rate the physical safety of a parking facility for a parking app.

Score strictly from the concrete facts given to you about THIS lot - lighting, security cameras, staffing, isolation, reported incidents, or being an official government-operated facility. Never infer a score from a suburb, city, or address alone, and never rely on assumptions about a neighborhood's reputation.

If nothing in the given facts is actually safety-relevant, set hasEnoughData to false and explain why in reasoning - the score field is ignored in that case, do not guess a number. Otherwise set hasEnoughData to true and give a real 1 (avoid) to 5 (very safe) score.`;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    hasEnoughData: { type: "boolean" },
    score: { type: "integer", minimum: 1, maximum: 5 },
    reasoning: { type: "string", maxLength: 240 },
  },
  required: ["hasEnoughData", "score", "reasoning"],
};

const MAX_REASONING_LENGTH = 240;

const SafetyResultSchema = z.object({
  hasEnoughData: z.boolean(),
  score: z.number().int().min(1).max(5),
  // Length isn't validated here - the model doesn't always stay under the
  // hint given in the prompt/schema, so it's truncated below instead of
  // rejecting an otherwise-valid response over a cosmetic overrun.
  reasoning: z.string(),
});

type SafetyInput = {
  id: string;
  name: string;
  address: string;
  /** An official, verifiable fact about the facility itself (e.g. "government-operated Park&Ride"). */
  officialFact?: string;
  /** Short review excerpts, if any were fetched for this lot. */
  reviewSnippets?: string[];
};

const cache = new Map<string, SafetyScore>();

function buildGroundingText(input: SafetyInput): string | null {
  const facts: string[] = [];
  if (input.officialFact) facts.push(input.officialFact);
  if (input.reviewSnippets?.length) {
    facts.push("Review excerpts:\n" + input.reviewSnippets.map((s) => `- "${s}"`).join("\n"));
  }
  return facts.length ? facts.join("\n\n") : null;
}

export async function getSafetyScore(input: SafetyInput): Promise<SafetyScore> {
  const cached = cache.get(input.id);
  if (cached) return cached;

  const grounding = buildGroundingText(input);
  if (!grounding) {
    const result: SafetyScore = {
      score: null,
      basedOn: "insufficient_data",
      reasoning: "No safety-relevant details available for this lot.",
    };
    cache.set(input.id, result);
    return result;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set - skipping safety scoring");
    return { score: null, basedOn: "insufficient_data", reasoning: "Safety scoring is not configured." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Parking lot: ${input.name}\nAddress: ${input.address}\n\n${grounding}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
      },
    });

    const parsed = SafetyResultSchema.parse(JSON.parse(response.text ?? ""));
    const reasoning =
      parsed.reasoning.length > MAX_REASONING_LENGTH
        ? `${parsed.reasoning.slice(0, MAX_REASONING_LENGTH - 1)}…`
        : parsed.reasoning;
    const result: SafetyScore = parsed.hasEnoughData
      ? { score: parsed.score, reasoning, basedOn: "ai_estimate" }
      : { score: null, reasoning, basedOn: "insufficient_data" };
    cache.set(input.id, result);
    return result;
  } catch (err) {
    console.error("Safety scoring failed:", err);
    return { score: null, basedOn: "insufficient_data", reasoning: "Safety assessment failed." };
  }
}
