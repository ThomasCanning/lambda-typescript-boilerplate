import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"

const ONLY_JSON =
  "CRITICAL: Return ONLY raw JSON starting with { and ending with }. No markdown code blocks (no ```json or ```), no backticks, no explanations before or after."

let styleAgentInstance: Agent | null = null

export function getStyleAgent() {
  if (styleAgentInstance) return styleAgentInstance

  styleAgentInstance = new Agent({
    name: "style-system-agent",
    model: vertex("gemini-2.0-flash"),
    instructions: `You design layout systems that align to a selected color palette.

Inputs: 
- profileData JSON
- selectedPalette JSON (primary, secondary, background, text, accent)

Task: Produce THREE layout/CSS system options that conceptually match the selected palette.
For each option include:
- css_variables: an object mapping CSS custom properties to values (e.g., {"--bg":"#000"})
- layout_description: concise description of structure/components
- html_preview_snippet: tiny hero-only wireframe using minimal divs and inline styles that reference the css_variables colors (no external assets)

Output schema:
{ "options": [ { "id": "style-1", "label": "Minimal Grid", "css_variables": { "--bg": "#fff" }, "layout_description": "...", "html_preview_snippet": "<div>...</div>" }, ... ] }
${ONLY_JSON}`,
  })

  return styleAgentInstance
}
