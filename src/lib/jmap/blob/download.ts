import { Id, UnsignedInt } from "../types"
import { BlobResponse } from "./types"
import { newBlobId } from "../id"

export async function upload(
  accountId: Id,
  contentType: string,
  data: Buffer
): Promise<BlobResponse> {
  const blobId = newBlobId(data)
  const blobResponse: BlobResponse = {
    accountId: accountId,
    blobId: blobId,
    type: contentType,
    size: data.length as UnsignedInt,
  }

  return blobResponse
}
