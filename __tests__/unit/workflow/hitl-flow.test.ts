process.env.GOOGLE_CREDENTIALS_JSON = "{}"
process.env.GOOGLE_VERTEX_PROJECT = "test-project"
process.env.GOOGLE_VERTEX_LOCATION = "us-central1"

import { generateWorkerHandler } from "../../../src/handlers/queue/generate-worker"
import { SQSEvent } from "aws-lambda/trigger/sqs"

// Mock Mastra instance and agents
const mockResearcherGenerate = jest.fn()
const mockSeniorGenerate = jest.fn()
const mockDesignWorkflowStart = jest.fn()
const mockDesignWorkflowCreateRun = jest.fn()

jest.mock("../../../src/lib/mastra", () => ({
  mastra: {
    getAgent: jest.fn((name) => {
      if (name === "researcherAgent") {
        return {
          generate: mockResearcherGenerate,
        }
      }
      if (name === "seniorBuilderAgent") {
        return {
          generate: mockSeniorGenerate,
        }
      }
      return undefined
    }),
    getWorkflow: jest.fn((name) => {
      if (name === "designWorkflow") {
        return {
          createRunAsync: mockDesignWorkflowCreateRun,
        }
      }
      return undefined
    }),
  },
}))

// Mock DynamoDB
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

    // Default mock implementations
    mockResearcherGenerate.mockResolvedValue({
      object: { name: "Test User", about: "Bio" },
    })

    mockDesignWorkflowCreateRun.mockResolvedValue({
      start: mockDesignWorkflowStart,
    })

    mockDesignWorkflowStart.mockResolvedValue({
      status: "success",
    })

    mockSeniorGenerate.mockResolvedValue({
      object: { index_html: "<html>Final</html>" },
    })
  })

  it("Phase 1: runs researcher + design workflow -> awaiting_choices", async () => {
    sendMock.mockResolvedValue({}) // dynamo updates

    await generateWorkerHandler(
      buildSQSEvent({
        jobId: "job-1",
        prompt: "https://linkedin.com/in/test",
      })
    )

    // Check Researcher
    expect(mockResearcherGenerate).toHaveBeenCalled()
    expect(mockResearcherGenerate.mock.calls[0][0]).toContain("https://linkedin.com/in/test")

    // Check Design Workflow
    expect(mockDesignWorkflowCreateRun).toHaveBeenCalled()
    expect(mockDesignWorkflowStart).toHaveBeenCalledWith({
      inputData: {
        profileData: { name: "Test User", about: "Bio" },
        jobId: "job-1",
      },
    })

    // Check DynamoDB status updates
    // We expect: running (scraping) -> running (designing) -> awaiting_choices
    const updates = sendMock.mock.calls
      .map((call) => call[0])
      .filter((cmd) => cmd.constructor.name === "UpdateCommand")

    const awaiting = updates.find(
      (cmd) => cmd.input.ExpressionAttributeValues[":status"] === "awaiting_choices"
    )
    expect(awaiting).toBeDefined()
  })

  it("Phase 2: resumes with choices -> senior agent -> succeeded", async () => {
    // Mock initial GetCommand to return job data
    sendMock.mockImplementationOnce(async () => ({
      Item: {
        status: "awaiting_choices",
        partials: {
          profileData: { name: "Test" },
          colorOptions: {
            options: [
              {
                id: "palette-1",
                label: "Azure",
                primary: "#123456",
                secondary: "#654321",
                background: "#FFFFFF",
                text: "#000000",
                accent: "#ABCDEF",
              },
            ],
          },
          copyOptions: {
            options: [
              {
                id: "copy-1",
                label: "Storyteller",
                headline: "My Headline",
                bio: "My Bio",
              },
            ],
          },
        },
        choices: {},
      },
    }))
    // Subsequent updates
    sendMock.mockResolvedValue({})

    await generateWorkerHandler(
      buildSQSEvent({
        jobId: "job-1",
        selectedPaletteId: "palette-1",
        selectedCopyId: "copy-1",
      })
    )

    // Check Senior Agent
    expect(mockSeniorGenerate).toHaveBeenCalled()
    const seniorInput = JSON.parse(mockSeniorGenerate.mock.calls[0][0])
    expect(seniorInput.colorPalette.id).toBe("palette-1")
    expect(seniorInput.copy.id).toBe("copy-1")

    // Check DynamoDB success update
    const updates = sendMock.mock.calls
      .map((call) => call[0])
      .filter((cmd) => cmd.constructor.name === "UpdateCommand")

    const success = updates.find(
      (cmd) => cmd.input.ExpressionAttributeValues[":status"] === "succeeded"
    )
    expect(success).toBeDefined()
    const result = success.input.ExpressionAttributeValues[":result"]
    expect(result.text).toBe("Website generated successfully")
  })
})
