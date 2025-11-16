// JMAP types per RFC 8620

/** JMAP Id: 1-255 octets, URL-safe base64 (A-Za-z0-9, -, _), no padding */
export type Id = string & { readonly __brand: "JmapId" }
