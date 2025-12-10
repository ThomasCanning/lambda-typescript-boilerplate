import { generateWorkerHandler } from "../../../src/handlers/queue/generate-worker"
import { SQSEvent } from "aws-lambda/trigger/sqs"

jest.mock("../../../src/lib/mastra/workflows/website-builder", () => ({
  websiteBuilderWorkflow: {
    createRunAsync: jest.fn().mockResolvedValue({
      start: jest.fn().mockResolvedValue({
        status: "suspended",
        context: {
          profileData: { name: "Test" },
          colorOptions: { options: [{ id: "palette-1" }] },
          copyOptions: { options: [{ id: "copy-1" }] },
        },
      }),
    }),
  },
  selectionStep: {
    execute: jest.fn().mockImplementation(async ({ resumeData, state }) => {
      // Simulate resume logic
      if (resumeData?.selectedPaletteId && resumeData?.selectedCopyId) {
        return {
          status: "success",
          selectedPaletteId: resumeData.selectedPaletteId,
          selectedCopyId: resumeData.selectedCopyId,
          colorOptions: state.colorOptions || { options: [{ id: "palette-1" }] },
          copyOptions: state.copyOptions || { options: [{ id: "copy-1" }] },
        }
      }
      return {
        status: "suspended",
        data: {
          colorOptions: state.colorOptions || { options: [{ id: "palette-1" }] },
          copyOptions: state.copyOptions || { options: [{ id: "copy-1" }] },
        },
        suspendPayload: {
          colorOptions: state.colorOptions || { options: [{ id: "palette-1" }] },
          copyOptions: state.copyOptions || { options: [{ id: "copy-1" }] },
        },
      }
    }),
  },
  seniorStep: {
    execute: jest.fn().mockResolvedValue({
      html: "<html>final</html>",
    }),
  },
}))

jest.mock("@aws-sdk/lib-dynamodb", () => {
  class GetCommand {
    constructor(public input: unknown) {}
  }
  class UpdateCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  const sendMock = jest.fn()
  const docClient = { send: sendMock }
  return {
    GetCommand,
    UpdateCommand,
    DynamoDBDocumentClient: { from: () => docClient },
    __sendMock: sendMock,
  }
})

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: function DynamoDBClient() {},
}))

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: function SQSClient() {},
}))

jest.mock("../../../src/lib/api/generate", () => {
  return {
    runGenerateJob: async (
      _prompt: string,
      onProgress: (u: {
        step: "awaiting_choices"
        message: string
        partials: Record<string, unknown>
      }) => Promise<void>
    ) => {
      await onProgress({
        step: "awaiting_choices",
        message: "options ready",
        partials: {
          profileData: { name: "Test" },
          colorOptions: { options: [{ id: "palette-1" }] },
          copyOptions: { options: [{ id: "copy-1" }] },
        },
      })
    },
  }
})

jest.mock("../../../src/lib/mastra/agents", () => {
  return {
    getCopywriterAgent: () => ({
      generate: async () => Promise.resolve({ text: "{}" }),
    }),
    getColorAgent: () => ({
      generate: async () => Promise.resolve({ text: "{}" }),
    }),
    getSeniorBuilderAgent: () => ({
      generate: async () =>
        Promise.resolve({
          text: JSON.stringify({ index_html: "<html>final</html>" }),
        }),
    }),
  }
})

const sendMock = jest.requireMock("@aws-sdk/lib-dynamodb").__sendMock as jest.Mock

const buildSQSEvent = (body: Record<string, unknown>): SQSEvent => ({
  Records: [
    {
      messageId: "1",
      receiptHandle: "",
      body: JSON.stringify(body),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "0",
        SenderId: "sender",
        ApproximateFirstReceiveTimestamp: "0",
        SequenceNumber: "0",
        MessageGroupId: "1",
        MessageDeduplicationId: "1",
      },
      messageAttributes: {},
      md5OfBody: "",
      eventSource: "aws:sqs",
      eventSourceARN: "",
      awsRegion: "us-east-1",
    },
  ],
})

describe("HITL flow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GENERATION_JOBS_TABLE = "table"
    process.env.GENERATION_QUEUE_URL = "queue"
  })

  it("goes to awaiting_choices after initial run", async () => {
    sendMock.mockImplementationOnce(async () => ({})) // initial GetCommand check
    sendMock.mockImplementationOnce(async () => ({})) // status running
    sendMock.mockImplementationOnce(async () => ({})) // awaiting choices update

    await generateWorkerHandler(
      buildSQSEvent({
        jobId: "job-1",
        prompt: "https://linkedin.com/in/test",
      })
    )

    const updates = sendMock.mock.calls
      .map((call) => call[0])
      .filter((cmd) => cmd.constructor.name === "UpdateCommand")
    expect(updates).toHaveLength(2)
    const awaiting = updates[1].input as { ExpressionAttributeValues: Record<string, unknown> }
    expect(awaiting.ExpressionAttributeValues[":status"]).toBe("awaiting_choices")
    const partials = awaiting.ExpressionAttributeValues[":partials"] as Record<string, unknown>
    expect(partials.colorOptions).toBeDefined()
    expect(partials.copyOptions).toBeDefined()
  })

  it("finalizes after both choices are made", async () => {
    sendMock.mockImplementationOnce(async () => ({
      Item: {
        status: "awaiting_choices",
        partials: {
          profileData: { name: "Test" },
          colorOptions: { options: [{ id: "palette-1" }] },
          copyOptions: { options: [{ id: "copy-1" }] },
        },
        choices: {},
      },
    })) // initial job fetch
    sendMock.mockImplementationOnce(async () => ({})) // running update
    sendMock.mockImplementation(() => ({})) // subsequent updates

    await generateWorkerHandler(
      buildSQSEvent({
        jobId: "job-1",
        selectedPaletteId: "palette-1",
        selectedCopyId: "copy-1",
      })
    )

    const successUpdate = sendMock.mock.calls
      .map((c) => c[0])
      .find(
        (cmd) =>
          cmd.constructor.name === "UpdateCommand" &&
          (cmd.input as { ExpressionAttributeValues: Record<string, unknown> })
            .ExpressionAttributeValues[":status"] === "succeeded"
      )
    expect(successUpdate).toBeDefined()
    const resultVal = (
      successUpdate as { input: { ExpressionAttributeValues: Record<string, unknown> } }
    ).input.ExpressionAttributeValues[":result"] as { text: string }
    expect(resultVal.text).toContain("final")
  })
})
