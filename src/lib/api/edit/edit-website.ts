import { mastra } from "../../mastra"
import { editorSchema } from "../../mastra/agents/editAgent"

export interface ExecuteEditInput {
  jobId?: string
  userId?: string
  plan: unknown
  fullHtml: string
}

export async function executeEdit({ jobId, userId, plan, fullHtml }: ExecuteEditInput) {
  const editorAgent = mastra.getAgent("editorAgent")

  const idString = jobId ? `Job ID: ${jobId}` : `User ID: ${userId}`

  const result = await editorAgent.generate(
    `
    ${idString}
    
    CURRENT HTML:
    ${fullHtml}

    USER REQUEST (IMPLEMENTATION PLAN):
    ${JSON.stringify(plan, null, 2)}
    `,
    { output: editorSchema }
  )

  return result.object
}
