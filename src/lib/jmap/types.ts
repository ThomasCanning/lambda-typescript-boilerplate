// JMAP types per RFC 8620
//Ensure where these types are used that they adhere to the rules

// Root types

/** JMAP Id: 1-255 octets, URL-safe base64 (A-Za-z0-9, -, _), no padding */
export type Id = string & { readonly __brand: "JmapId" }

/** Int: -2^53+1 <= value <= 2^53-1 (safe integer range) */
export type Int = number & { readonly __brand: "JmapInt" }

/** UnsignedInt: 0 <= value <= 2^53-1 */
export type UnsignedInt = Int & { readonly __brand: "JmapUnsignedInt" }

/** Date: RFC3339 date-time string, normalized (uppercase letters, no zero time-secfrac) */
export type Date = string & { readonly __brand: "JmapDate" }

/** UTCDate: Date with time-offset "Z" (UTC) */
export type UTCDate = Date & { readonly __brand: "JmapUTCDate" }

//TODO IJSON type
export type JsonValue = ReturnType<typeof JSON.parse>

// ------------------------------------------------------------

// Session types

export type Session = {
  capabilities: Capabilities
  accounts: Accounts
  primaryAccounts: {
    [key: string]: Id
  }
  username: string
  apiUrl: string
  downloadUrl: string
  uploadUrl: string
  eventSourceUrl: string
  state: string
}

export type Capabilities = Record<string, Record<string, unknown>>

export interface Account {
  name: string
  isPersonal: boolean
  isReadOnly: boolean
  accountCapabilities: Capabilities
}

export type Accounts = Record<Id, Account>

// ------------------------------------------------------------

// Capability types

export type CapabilityJmapCore = {
  maxSizeUpload: UnsignedInt
  maxConcurrentUpload: UnsignedInt
  maxSizeRequest: UnsignedInt
  maxConcurrentRequests: UnsignedInt
  maxCallsInRequest: UnsignedInt
  maxObjectsInGet: UnsignedInt
  maxObjectsInSet: UnsignedInt
  collationAlgorithms: string[]
}

export const capabilities = {
  core: "urn:ietf:params:jmap:core",
} as const

// ------------------------------------------------------------

// API types

// Tuple of [method name, arguments, method call id]
export type Invocation = [string, Record<string, unknown>, string]

export type JmapRequest = {
  using: string[] //capabilities
  methodCalls: Invocation[]
  createdIds?: Record<Id, Id> // map from client specified creation id to the id the server assigned when a record was successfully created
}

export type JmapResponse = {
  methodResponses: Invocation[]
  createdIds?: Record<Id, Id>
  sessionState: string
}

// TODO implement usage of this in api handler
export type ResultReference = {
  resultOf: string
  name: string
  path: string
}
