import { StatusCodes } from "http-status-codes"

export function validateEnvVar(
  varName: string,
  value: string | undefined
): { ok: true; value: string } | { ok: false; statusCode: number; message: string } {
  if (!value || value.trim().length === 0) {
    return {
      ok: false,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: `Server misconfiguration (${varName} missing)`,
    }
  }
  return { ok: true, value: value.trim() }
}
