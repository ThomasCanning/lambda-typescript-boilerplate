import { mastra } from "../../mastra"
import { selectRegionSchema } from "../../mastra/agents/selectAgent"

export async function selectRegion(screenshot: string, html: string) {
  const selectAgent = mastra.getAgent("selectAgent")

  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text:
            "The user has drawn a circle around the element they want to edit. Here is the page HTML: \n\n" +
            html,
        },
        {
          type: "image" as const,
          image:
            screenshot.startsWith("data:") || screenshot.startsWith("http")
              ? screenshot
              : `data:image/png;base64,${screenshot}`,
        },
      ],
    },
  ]

  const result = await selectAgent.generate(messages, {
    output: selectRegionSchema,
  })

  return result.object
}
