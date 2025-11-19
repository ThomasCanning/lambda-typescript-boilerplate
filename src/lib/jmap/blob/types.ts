import { Id, UnsignedInt } from "../types"

export type UploadResponse = {
  accountId: Id
  blobId: Id
  type: string
  size: UnsignedInt //in octets
}

export type DownloadRequest = {
  accountId: Id
  blobId: Id
  name: string
  type: string
}
