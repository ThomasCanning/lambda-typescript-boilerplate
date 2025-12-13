import { APIGatewayProxyEventV2 } from "aws-lambda"
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { WebsiteContent } from "../website-content"
import { createProblemDetails, errorTypes } from "../../../errors"
import { StatusCodes } from "http-status-codes"
import { randomUUID } from "node:crypto"

const sqsClient = new SQSClient({})

export const applyEdit = async (event: APIGatewayProxyEventV2, content: WebsiteContent) => {
  const queueUrl = process.env.GENERATION_QUEUE_URL

  if (!queueUrl) {
    throw createProblemDetails({
      type: errorTypes.internalServerError,
      status: StatusCodes.INTERNAL_SERVER_ERROR,
      detail: "Server misconfiguration (GENERATION_QUEUE_URL missing)",
      title: "Internal Server Error",
    })
  }

  if (!event.body) {
    throw createProblemDetails({
      type: errorTypes.badRequest,
      status: StatusCodes.BAD_REQUEST,
      detail: "Missing request body",
      title: "Bad Request",
    })
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch (_e) {
    throw createProblemDetails({
      type: errorTypes.badRequest,
      status: StatusCodes.BAD_REQUEST,
      detail: "Invalid JSON body",
      title: "Bad Request",
    })
  }

  // dynamo table stores screenshot, selectedHtml, and prompt for a job ID
  // sqs queue will have just editJobId

  // Case 1: Screenshot provided - Start new job
  // Write screenshot to dynamo under editJobId
  // Send SQS message with editJobId
  if (body.screenshot) {
    const editJobId = randomUUID()

    await import("../edit-store").then(({ editStore }) =>
      editStore.update(editJobId, {
        screenshot: body.screenshot,
        originalHtml: content.html,
      })
    )

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          jobId: editJobId,
          type: "edit",
        }),
      })
    )

    return {
      jobId: editJobId,
      message: "Screenshot received",
    }
  }

  // Case 2: Prompt and Job ID provided
  // Write prompt to dynamo under jobId
  // If dynamo has selectedHtml, send SQS message with editJobId

  if (body.prompt && body.jobId) {
    const { editStore } = await import("../edit-store")
    await editStore.update(body.jobId, { prompt: body.prompt })

    const job = await editStore.get(body.jobId)

    if (job?.selectedHtml) {
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            jobId: body.jobId,
            type: "edit",
          }),
        })
      )
    }

    return {
      jobId: body.jobId,
      message: "Prompt received",
    }
  }

  throw createProblemDetails({
    type: errorTypes.badRequest,
    status: StatusCodes.BAD_REQUEST,
    detail: "Invalid request. Provide either 'screenshot' or 'jobId' and 'prompt'.",
    title: "Bad Request",
  })
}
