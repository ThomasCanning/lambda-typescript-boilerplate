import { mastra } from "../../mastra"
import { selectRegionSchema } from "../../mastra/agents/selectAgent"

export async function selectRegion(screenshot: string, html: string) {
  const selectAgent = mastra.getAgent("selectAgent")

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "The user has drawn a circle around the element they want to edit. Here is the page HTML: \n\n" +
            html,
        },
        {
          type: "image",
          image: screenshot, // Base64 or URL
        },
      ],
    },
  ]

  const result = await selectAgent.generate(messages, {
    output: selectRegionSchema,
  })

  return result.object
}
