import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"
import { linkedInProfileTool } from "../tools/linkedin-profile"

export const scraperAgent = new Agent({
  name: "scraper-agent",
  instructions: `You are a specialized LinkedIn scraper. Your ONLY job is to use the linkedInProfileTool to fetch profile data.

CRITICAL INSTRUCTIONS:
1. You MUST call the linkedInProfileTool. This tool does NOT require internet access - it works offline with mock data.
2. When you receive a LinkedIn URL, immediately call linkedInProfileTool with: { "profileUrls": ["<the-url-you-received>"] }
3. After the tool returns data, extract the first profile from the 'profiles' array.
4. Output ONLY the raw JSON object (profiles[0]) as a string. No markdown, no code blocks, no conversational text.
5. Example: If tool returns { profiles: [{ name: "John", ... }] }, output: {"name":"John",...}

DO NOT:
- Say you don't have internet access
- Ask for JSON data directly
- Provide example URLs
- Add any text before or after the JSON

You MUST call the tool. It is available and ready to use.`,
  model: vertex("gemini-2.0-flash"),
  tools: { linkedInProfileTool },
})
