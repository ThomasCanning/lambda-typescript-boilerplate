import { Invocation } from "../types"

export function coreEcho(methodCall: Invocation): Invocation {
  const methodName = methodCall[0]
  const methodArguments = methodCall[1]
  const methodCallId = methodCall[2]

  return [methodName, methodArguments, methodCallId]
}
