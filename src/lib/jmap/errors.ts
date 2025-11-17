// Request level error urns

import { StatusCodes } from "http-status-codes"

export const unknownCapabilityUrn = "urn:ietf:params:jmap:error:unknownCapability" as const

export const notJsonUrn = "urn:ietf:params:jmap:error:notJSON" as const

export const notRequestUrn = "urn:ietf:params:jmap:error:notRequest" as const

//Must include limit property (name of limit) in problem details response
export const limitUrn = "urn:ietf:params:jmap:error:limit" as const

export type RequestErrorType =
  | "urn:ietf:params:jmap:error:unknownCapability"
  | "urn:ietf:params:jmap:error:notJSON"
  | "urn:ietf:params:jmap:error:notRequest"
  | "urn:ietf:params:jmap:error:limit"

export type RequestError = {
  type: RequestErrorType
  status: StatusCodes.BAD_REQUEST
  detail: string
  limit?: string
}

// Method level errors

export type MethodErrorType =
  | "serverUnavailable"
  | "serverFail"
  | "serverPartialFail"
  | "unknownMethod"
  | "invalidArguments"
  | "invalidResultReference"
  | "forbidden"
  | "accountNotFound"
  | "accountNotSupportedByMethod"
  | "accountReadOnly"
  | string

export type MethodError = {
  methodName: "error"
  arguments: {
    type: MethodErrorType
    description?: string
  }
  methodCallId: string
}
