import { coreEcho } from "../../../../../src/lib/jmap/core/echo"
import { Invocation } from "../../../../../src/lib/jmap/types"

describe("coreEcho", () => {
  it("should return the same invocation tuple", () => {
    const invocation: Invocation = ["Core/echo", { foo: "bar" }, "c1"]

    const result = coreEcho(invocation)

    expect(result).toEqual(invocation)
  })

  it("should preserve nested argument data", () => {
    const invocation: Invocation = [
      "Core/echo",
      { nested: { arr: [1, 2], flag: true }, value: 42 },
      "c42",
    ]

    const result = coreEcho(invocation)

    expect(result[1]).toBe(invocation[1])
    expect(result[1]).toEqual({
      nested: { arr: [1, 2], flag: true },
      value: 42,
    })
  })

  it("should include the original method call id", () => {
    const invocation: Invocation = ["Core/echo", {}, "client-call"]

    const result = coreEcho(invocation)

    expect(result[2]).toBe("client-call")
  })
})
