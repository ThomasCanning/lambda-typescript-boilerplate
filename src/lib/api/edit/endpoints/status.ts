import { editStore } from "../edit-store"
import { createProblemDetails, errorTypes } from "../../../errors"
import { StatusCodes } from "http-status-codes"

export const getEditStatus = async (jobId: string) => {
  if (!jobId) {
    throw createProblemDetails({
      type: errorTypes.badRequest,
      status: StatusCodes.BAD_REQUEST,
      detail: "Missing jobId",
      title: "Bad Request",
    })
  }

  const job = await editStore.get(jobId)

  if (!job) {
    throw createProblemDetails({
      type: errorTypes.notFound,
      status: StatusCodes.NOT_FOUND,
      detail: `Job not found: ${jobId}`,
      title: "Not Found",
    })
  }

  return {
    jobId: job.jobId,
    status: job.status,
    agentStates: job.agentStates,
    error: job.error,
    // We might want to return result if succeeded, or partials?
    // For now, minimal status.
    // If we want the updated website, we call GET /api/edit later.
  }
}
