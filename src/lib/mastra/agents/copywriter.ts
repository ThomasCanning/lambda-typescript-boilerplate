import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"
import { z } from "zod"

export const copywriterAgent = new Agent({
  name: "copywriter-agent",
  model: vertex("gemini-2.5-flash-lite"),
  instructions: `You are a concise marketing copywriter.

Input: LinkedIn profile JSON.
Task: Create THREE distinct copy options for a personal website based on the profile.
Style Requirements:
1. ONE option MUST be "Minimalist": Ultra-concise. Max 2 short sentences. No fluff, no adjectives, just the core professional identity. (Note: This overrides the general length rule).
2. The other TWO options should use styles that YOU determine are best suited for this specific person's background and industry (e.g., "Visionary", "Technical", "Creative", "Bold", "Academic", etc.). Choose labels that describe the tone accurately.

Rules:
Rules:
- Headline: MAX 10-15 words. For "Minimalist", MAX 8 words (e.g., "Building accessible web experiences.").
- Bio: For standard options, 2-3 sentences max. For "Minimalist", 1-2 SHORT sentences max.
- Respect factual data; no fabrications. DO NOT invent dates (e.g., "Summer 2025") or roles not in the input.
- STRICTLY GROUNDED: If a specific detail (like internship plans) is not in the "about" or "experience" data, DO NOT include it.
- If the "About" section is empty, use the "Headline" and "Experience" to infer a professional summary, but do not hallucinate future aspirations.

Output schema:
{ "options": [ { "id": "copy-1", "label": "Minimalist", "headline": "...", "bio": "..." }, { "id": "copy-2", "label": "DynamicStyle1", ... }, ... ] }`,
})

export const copyOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  headline: z.string(),
  bio: z.string(),
})

export const copyOptionsSchema = z.object({
  options: z.array(copyOptionSchema),
})
