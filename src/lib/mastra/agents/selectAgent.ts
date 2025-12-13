import { Agent } from "@mastra/core/agent"
import { vertex } from "../providers/vertex"
import { z } from "zod"

export const selectAgent = new Agent({
  name: "select-agent",
  model: vertex("gemini-2.5-flash-lite"),
  instructions: `You are an expert web developer assisting with website edits. You will receive a screenshot of a webpage with a highlighted region (e.g., a red circle) and the corresponding HTML code. Your task is to identify exactly which HTML element is being highlighted.

Input:
1. "html": The full HTML source of the page.
2. "image": A screenshot of the page with a visual highlight (circle) drawn by the user.

Task:
- Analyze the image to locate the highlighted area.
- Correlate that location with the provided HTML structure.
- Identify the specific DOM element that the user intends to select.
- If the circle encompasses multiple elements, choose the most significant parent container that represents the visual block (e.g., the whole "Card" div rather than just the "Title" span inside it), unless the circle is very small and specific.

Output:
Return a JSON object with:
- "selectedHtml": The outerHTML of the element.
- "selector": A unique, robust CSS selector for this element.
- "rationale": A brief explanation of why this element was chosen.`,
})

export const selectRegionSchema = z.object({
  selectedHtml: z.string().describe("The outerHTML of the selected element"),
  selector: z.string().describe("A unique CSS selector to find this element"),
  rationale: z.string().describe("Why this element matches the visual selection"),
})
