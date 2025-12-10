import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"

const ONLY_JSON =
  "CRITICAL: Return ONLY raw JSON starting with { and ending with }. No markdown code blocks (no ```json or ```), no backticks, no explanations before or after."

let copywriterAgentInstance: Agent | null = null

export function getCopywriterAgent() {
  if (copywriterAgentInstance) return copywriterAgentInstance

  copywriterAgentInstance = new Agent({
    name: "copywriter-agent",
    model: vertex("gemini-2.0-flash"),
    instructions: `You are a concise marketing copywriter.

Input: LinkedIn profile JSON.
Task: Rewrite the "About" narrative into THREE distinct tones (e.g., Storyteller, Executive, Minimalist).
Rules:
- Create a headline (1 sentence) and a short bio (3-5 sentences max) per option.
- Respect factual data; no fabrications. DO NOT invent dates (e.g., "Summer 2025") or roles not in the input.
- STRICTLY GROUNDED: If a specific detail (like internship plans) is not in the "about" or "experience" data, DO NOT include it.
- If the "About" section is empty, use the "Headline" and "Experience" to infer a professional summary, but do not hallucinate future aspirations.
Output schema:
{ "options": [ { "id": "copy-1", "label": "Storyteller", "headline": "...", "bio": "..." }, ... ] }
${ONLY_JSON}`,
  })

  return copywriterAgentInstance
}
