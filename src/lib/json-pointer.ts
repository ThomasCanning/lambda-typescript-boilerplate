import { JsonValue } from "./jmap/types"

// Implements JSON Pointer algorithm [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901)
// With wildcard modification as described in [JMAP RFC 8620](https://www.rfc-editor.org/rfc/rfc8620)
export function evaluateJsonPointer(path: string, args: Record<string, unknown>): JsonValue {
  // Empty pointer references the whole document
  if (path === "") {
    return args
  }

  // JSON Pointer must start with '/' or be empty
  if (!path.startsWith("/")) {
    throw null
  }

  // Split into reference tokens (skip the first empty token from leading '/')
  const tokens = path.slice(1).split("/")
  let current: JsonValue = args

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const decodedToken = decodeReferenceToken(token)

    if (current === null || current === undefined) {
      throw null
    }

    if (Array.isArray(current)) {
      // Handle array indexing
      if (token === "*") {
        // JMAP extension: wildcard - apply rest of pointer to each element
        const remainingTokens = tokens.slice(i + 1)
        const remainingPointer = remainingTokens.length > 0 ? "/" + remainingTokens.join("/") : ""
        const results: JsonValue[] = []

        for (const item of current) {
          // If there are no remaining tokens, return the item itself
          if (remainingTokens.length === 0) {
            results.push(item)
            continue
          }

          // Use non-throwing helper for recursive call to allow skipping failed items
          // Only process items that are objects (JSON Pointer paths require object navigation)
          if (typeof item === "object" && item !== null && !Array.isArray(item)) {
            const result = tryEvaluateJsonPointer(remainingPointer, item as Record<string, unknown>)
            if (result !== undefined) {
              // Flatten arrays: if result is an array, add its items individually
              if (Array.isArray(result)) {
                results.push(...result)
              } else {
                results.push(result)
              }
            }
          }
          // If item is not an object or result is undefined, skip this item
        }

        return results
      } else if (token === "-") {
        // "-" refers to nonexistent element after last array element
        throw null
      } else {
        // Must be a numeric index
        const index = parseArrayIndex(token)
        if (index === null) {
          throw null
        }

        if (index < 0 || index >= current.length) {
          throw null
        }

        current = current[index]
      }
    } else if (typeof current === "object" && current !== null) {
      // Handle object property access
      // Member name must match exactly (byte-by-byte, no normalization)
      if (!(decodedToken in current)) {
        throw null
      }

      current = (current as Record<string, unknown>)[decodedToken]
    } else {
      // Current value is a primitive, cannot access properties
      throw null
    }
  }

  return current
}

/// Non-throwing wrapper to allow recursion to continue if the pointer evaluation fails
function tryEvaluateJsonPointer(
  pointer: string,
  document: Record<string, unknown>
): JsonValue | undefined {
  try {
    return evaluateJsonPointer(pointer, document)
  } catch {
    return undefined
  }
}

/**
 * Decodes a reference token by replacing escape sequences
 * Per spec: first replace '~1' with '/', then '~0' with '~'
 * @param token - The reference token to decode
 * @returns The decoded token
 */
function decodeReferenceToken(token: string): string {
  // First replace '~1' with '/', then '~0' with '~'
  // Order matters: if we did '~0' first, '~01' would incorrectly become '/'
  return token.replace(/~1/g, "/").replace(/~0/g, "~")
}

/**
 * Parses a string as an array index
 * Per spec: must be "0" or digits 1-9 followed by any digits (no leading zeros)
 * @param token - The token to parse
 * @returns The numeric index, or null if invalid
 */
function parseArrayIndex(token: string): number | null {
  // Empty string is invalid
  if (token.length === 0) {
    return null
  }

  // Must be "0" or start with 1-9 (no leading zeros)
  if (token === "0") {
    return 0
  }

  if (token[0] < "1" || token[0] > "9") {
    return null
  }

  // All remaining characters must be digits
  for (let i = 1; i < token.length; i++) {
    if (token[i] < "0" || token[i] > "9") {
      return null
    }
  }

  const index = Number.parseInt(token, 10)
  // Check if it's a safe integer (per JSON spec, arrays can have up to 2^53-1 elements)
  if (!Number.isSafeInteger(index)) {
    return null
  }

  return index
}
