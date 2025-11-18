import { createMethodError, methodErrors } from "./errors"
import { Invocation, ResultReference } from "./types"

// Takes in
export function evaluateResultReference(
  ref: ResultReference,
  methodResponses: Invocation[]
): unknown {
  // Step 1: Find response with matching method call id
  let response: Invocation | undefined
  for (let i = 0; i < methodResponses.length; i++) {
    if (methodResponses[i][2] === ref.resultOf) {
      response = methodResponses[i]
      break
    }
  }
  if (!response) {
    return createMethodError(methodErrors.invalidResultReference, ref.resultOf)
  }

  return response
}
