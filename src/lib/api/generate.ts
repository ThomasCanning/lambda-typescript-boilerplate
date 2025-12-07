import { getMastra } from "../mastra"

export interface GenerateRequest {
  prompt: string
}

export interface GenerateResponse {
  text: string
  toolResults?: unknown[]
}

export async function generate(body: string): Promise<GenerateResponse> {
  const request: GenerateRequest = JSON.parse(body)

  const mastra = getMastra()
  const workflow = mastra.getWorkflow("websiteBuilderWorkflow")

  if (!workflow) {
    throw new Error("websiteBuilderWorkflow not found")
  }

  const run = await workflow.createRunAsync()

  // The 'prompt' from the request is the LinkedIn URL
  const result = await run.start({
    inputData: {
      url: request.prompt,
    },
  })

  if (result.status === "success" && result.result) {
    return {
      text: result.result.html as string,
    }
  }

  throw new Error(`Workflow execution failed. Status: ${result.status}`)
}
