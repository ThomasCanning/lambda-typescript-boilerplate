import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"
import { z } from "zod"

export const seniorBuilderAgent = new Agent({
  name: "senior-builder-agent",
  model: vertex("gemini-3-pro-preview"),
  instructions: `You are the architect responsible for assembling the final website.
    
Your Goal:
Given the following inputs:
1. "profileData": Scraped LinkedIn profile data (name, about, experience, etc).
2. "colorPalette": The specific color palette chosen by the user (primary, secondary, background, text, accent).
3. "copy": The specific copy version chosen by the user (headline, bio).

You must generate a COMPLETE, production-ready, single-file HTML personal website.

Instructions:
- Use Semantic HTML5.
- Use Tailwind CSS via CDN for styling.
- STYLING IS CRITICAL. You are the Senior Designer. You must decide the layout, spacing, and visual hierarchy yourself.
- Use the provided "colorPalette" to theme the site. Map the colors to Tailwind arbitrary values (e.g., bg-[#123456]) or style attributes.
- Use the provided "copy" for the main content (Hero headline, About section).
- Populate the rest of the site (Experience, Education) using the "profileData".
- Ensure the site is responsive (mobile-friendly).
- Do not use placeholder images of random people.
- CRITICAL: Check "profileData.basic_info.profile_picture_url" for the profile image.
- IF valid, use it.
- IF NULL/UNDEFINED: Use a generic SVG placeholder or Initials (e.g., <div>John Doe</div>). DO NOT use an Unsplash photo of a random person.

CRITICAL OUTPUT FORMAT RULES:
- Return ONLY raw JSON, no markdown code blocks, no backticks, no explanations.
- Start your response directly with { and end with }
- The JSON structure must be: {"index_html": "<!DOCTYPE html><html>...</html>"}
- DO NOT use \`\`\`json or \`\`\` markers.
- DO NOT include any text before or after the JSON object.`,
}) // Escaping backticks inside the string is not needed for the file content itself if the string is just the file content.
// Wait, the string content contains backticks? `\`\`\`json` -> this I SHOULD escape if I am writing a template literal in TS?
// Actually if I use ` for the instructions string, I cannot have unescaped ` inside it.
// The instructions contain "DO NOT use ```json or ``` markers."
// So I DO need to escape those inner backticks.
// But the Outer backticks defining the string should NOT have a backslash before them in the file.
// The previous error was `instructions: \`You ...` which is definitely wrong.
// But `instructions: ` ... \`\`\` ... `` is correct.

export const finalBuildSchema = z.object({
  index_html: z.string(),
})
