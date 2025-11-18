import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import { withAuth, jsonResponseHeaders, getHeader } from "../../lib/auth"
import { Request } from "../../lib/jmap/types"
import { requestErrors, RequestError } from "../../lib/jmap/errors"
import { StatusCodes } from "http-status-codes"

export const apiHandler = withAuth(
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    if (!isValidContentType(event)) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notJson,
          status: StatusCodes.BAD_REQUEST,
          detail: "Content type of the request was not application/json",
        } as RequestError),
      }
    }

    if (!event.body) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notJson,
          status: StatusCodes.BAD_REQUEST,
          detail: "Request body is missing",
        }),
      }
    }

    let parsedBody: Record<string, unknown> | undefined
    try {
      parsedBody = JSON.parse(event.body)
    } catch {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notJson,
          status: StatusCodes.BAD_REQUEST,
          detail: "Request did not parse as I-JSON",
        }),
      }
    }

    //validate that the parsedBody is of shape Request
    if (!parsedBody || !isValidRequest(parsedBody)) {
      return {
        statusCode: StatusCodes.BAD_REQUEST,
        headers: jsonResponseHeaders(event),
        body: JSON.stringify({
          type: requestErrors.notRequest,
          status: StatusCodes.BAD_REQUEST,
          detail: "Request did not conform to the structure of a Request object",
        } as RequestError),
      }
    }

    // For now, return a placeholder response
    return {
      statusCode: 200,
      headers: jsonResponseHeaders(event),
      body: JSON.stringify({ message: "Hello world" }),
    }
  }
)

function isValidContentType(event: APIGatewayProxyEventV2): boolean {
  const contentType = getHeader(event, "content-type")
  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    return false
  }
  return true
}

function isValidRequest(body: Record<string, unknown>): body is Request {
  // Must be an object (not null, not array)
  if (!body || Array.isArray(body) || typeof body !== "object") {
    return false
  }

  // Must have 'using' property that is an array of strings
  if (!("using" in body)) {
    return false
  }
  if (!Array.isArray(body.using)) {
    return false
  }
  if (!body.using.every((capability): capability is string => typeof capability === "string")) {
    return false
  }

  // Must have 'methodCalls' property that is an array
  if (!("methodCalls" in body)) {
    return false
  }
  if (!Array.isArray(body.methodCalls)) {
    return false
  }

  // Each methodCall must be a valid Invocation: [string, Record<string, unknown>, string]
  if (
    !body.methodCalls.every((call): call is Request["methodCalls"][number] => {
      if (!Array.isArray(call) || call.length !== 3) {
        return false
      }
      const [methodName, args, callId] = call
      return (
        typeof methodName === "string" &&
        typeof args === "object" &&
        args !== null &&
        !Array.isArray(args) &&
        typeof callId === "string"
      )
    })
  ) {
    return false
  }

  // If 'createdIds' is present, it must be an object with string keys and string values
  if ("createdIds" in body && body.createdIds !== undefined) {
    if (
      typeof body.createdIds !== "object" ||
      body.createdIds === null ||
      Array.isArray(body.createdIds)
    ) {
      return false
    }
    const createdIds = body.createdIds as Record<string, unknown>
    if (!Object.values(createdIds).every((value): value is string => typeof value === "string")) {
      return false
    }
  }

  return true
}
