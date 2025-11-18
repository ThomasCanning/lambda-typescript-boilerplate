// Request level error urns

import { StatusCodes } from "http-status-codes"
import { Invocation } from "./types"

export const requestErrors = {
  unknownCapability: "urn:ietf:params:jmap:error:unknownCapability",
  notJson: "urn:ietf:params:jmap:error:notJSON",
  notRequest: "urn:ietf:params:jmap:error:notRequest",
  limit: "urn:ietf:params:jmap:error:limit",
} as const

type RequestErrorType = (typeof requestErrors)[keyof typeof requestErrors]

export type RequestError = {
  type: RequestErrorType
  status: StatusCodes.BAD_REQUEST
  detail: string
  limit?: string
}

export const methodErrors = {
  serverUnavailable: "serverUnavailable",
  serverFail: "serverFail",
  serverPartialFail: "serverPartialFail",
  unknownMethod: "unknownMethod",
  invalidArguments: "invalidArguments",
  invalidResultReference: "invalidResultReference",
  forbidden: "forbidden",
  accountNotFound: "accountNotFound",
  accountNotSupportedByMethod: "accountNotSupportedByMethod",
  accountReadOnly: "accountReadOnly",
} as const

export type MethodErrorType = (typeof methodErrors)[keyof typeof methodErrors]

export function createMethodError(type: MethodErrorType, methodCallId: string): Invocation {
  // error response has response name error, type property, and the id of the call that failed
  // optionally description
  const response: Invocation = ["error", { type: type }, methodCallId]
  return response
}
