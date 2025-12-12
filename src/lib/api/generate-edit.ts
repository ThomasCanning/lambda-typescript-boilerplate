import { SQSClient, SendMessageCommand, SQSClientConfig } from "@aws-sdk/client-sqs"

function createSqsClient(): SQSClient {
  const config: SQSClientConfig = {}
  if (process.env.AWS_REGION) config.region = process.env.AWS_REGION
  if (process.env.SQS_ENDPOINT) config.endpoint = process.env.SQS_ENDPOINT

  // Local SQS emulators also require credentials for request signing.
  if (config.endpoint || process.env.IS_LOCAL_DEV === "true") {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    }
  }

  return new SQSClient(config)
}

export async function startEdit(jobId: string, prompt: string) {
  const sqsClient = createSqsClient()
  const queueUrl = process.env.GENERATION_QUEUE_URL
  if (!queueUrl) {
    throw new Error("Missing required environment variable: GENERATION_QUEUE_URL")
  }
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ jobId, editPrompt: prompt }),
    })
  )
  return { success: true }
}
