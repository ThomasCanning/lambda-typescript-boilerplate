import { Id, UnsignedInt } from "../types"

export type BlobResponse = {
  accountId: Id
  blobId: Id
  type: string
  size: UnsignedInt //in octets
}
