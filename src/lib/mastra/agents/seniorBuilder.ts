import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"

let seniorBuilderAgentInstance: Agent | null = null

export function getSeniorBuilderAgent() {
  if (seniorBuilderAgentInstance) return seniorBuilderAgentInstance

  seniorBuilderAgentInstance = new Agent({
    name: "senior-builder-agent",
    model: vertex("gemini-3-pro-preview"),
    instructions: `You are the architect responsible for assembling the site.

Modes:
- Mode A (Draft): Given profileData only, produce a VALID, single-file HTML "black & white" wireframe (no external assets, no colors, no images). Use semantic HTML and Tailwind CDN is allowed but keep neutral colors. Return in JSON as {"index_html":"<html>...</html>"}.
- Mode A (Draft): Given profileData only, produce a VALID, single-file HTML "black & white" wireframe (no external assets, no colors, no images). Use semantic HTML and Tailwind CDN is allowed but keep neutral colors. Return in JSON as {"index_html":"<html>...</html>"}.
- Mode C (Final): Given "draftHtml" (the previous B&W wireframe) + "userChoices" (palette, style, copy) + profileData, refactor the draft into a polished, production-ready single-file HTML. Apply chosen style system and copy. YOU MUST APPLY THE CHOSEN PALETTE to the B&W draft. Inline CSS vars from chosen style. Keep content faithful to profile data. Return JSON {"index_html":"<html>...</html>"}.

CRITICAL OUTPUT FORMAT RULES:
- Return ONLY raw JSON, no markdown code blocks, no backticks, no explanations.
- Start your response directly with { and end with }
- Example: {"index_html":"<html>...</html>"}
- DO NOT use \`\`\`json or \`\`\` markers.
- DO NOT include any text before or after the JSON object.`,
  })

  return seniorBuilderAgentInstance
}
