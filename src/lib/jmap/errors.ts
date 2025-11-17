// Request level error urns

import { StatusCodes } from "http-status-codes"

export const unknownCapabilityUrn: string = "urn:ietf:params:jmap:error:unknownCapability" as const

export const notJsonUrn: string = "urn:ietf:params:jmap:error:notJSON" as const

export const notRequestUrn: string = "urn:ietf:params:jmap:error:notRequest" as const

//Must include limit property (name of limit) in problem details response
export const limitUrn: string = "urn:ietf:params:jmap:error:limit" as const

export type RequestErrorType =
  | typeof unknownCapabilityUrn
  | typeof notJsonUrn
  | typeof notRequestUrn
  | typeof limitUrn

export type requestError = {
  type: RequestErrorType
  status: StatusCodes.BAD_REQUEST
  detail: string
  limit?: string
}
