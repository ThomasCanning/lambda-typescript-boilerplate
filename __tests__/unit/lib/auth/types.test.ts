import { AuthResult } from "../../../../src/lib/auth/types"
import { StatusCodes } from "http-status-codes"

describe("types", () => {
  describe("AuthResult", () => {
    it("returns true for authenticated context", () => {
      const result: AuthResult = { ok: true, bearerToken: "token" }
      expect(result.ok).toBe(true)
    })

    it("returns false for error result", () => {
      const result: AuthResult = {
        ok: false,
        statusCode: StatusCodes.UNAUTHORIZED,
        message: "Unauthorized",
      }
      expect(result.ok).toBe(false)
    })

    it("narrows type correctly", () => {
      const result: AuthResult = { ok: true, bearerToken: "token" }
      if (result.ok) {
        // TypeScript should know result.bearerToken exists here
        expect(result.bearerToken).toBe("token")
      }
    })
  })
})
