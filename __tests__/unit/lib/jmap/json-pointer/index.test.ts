import { evaluateJsonPointer } from "../../../../../src/lib/jmap/json-pointer/index"

describe("evaluateJsonPointer", () => {
  // Test document from RFC 6901 Section 5
  const testDocument = {
    foo: ["bar", "baz"],
    "": 0,
    "a/b": 1,
    "c%d": 2,
    "e^f": 3,
    "g|h": 4,
    "i\\j": 5,
    'k"l': 6,
    " ": 7,
    "m~n": 8,
  }

  describe("Empty pointer", () => {
    it('should return the whole document for empty pointer ""', () => {
      const result = evaluateJsonPointer("", testDocument)
      expect(result).toEqual(testDocument)
    })
  })

  describe("Syntax validation", () => {
    it("should throw error for pointer that does not start with '/'", () => {
      expect(() => {
        evaluateJsonPointer("foo", testDocument)
      }).toThrow()
    })

    it("should accept pointer starting with '/'", () => {
      const result = evaluateJsonPointer("/foo", testDocument)
      expect(result).toEqual(["bar", "baz"])
    })
  })

  describe("Object member access", () => {
    it('should access object member "/foo"', () => {
      const result = evaluateJsonPointer("/foo", testDocument)
      expect(result).toEqual(["bar", "baz"])
    })

    it('should access empty key member "/"', () => {
      const result = evaluateJsonPointer("/", testDocument)
      expect(result).toBe(0)
    })

    it('should access member with special characters "/c%d"', () => {
      const result = evaluateJsonPointer("/c%d", testDocument)
      expect(result).toBe(2)
    })

    it('should access member "/e^f"', () => {
      const result = evaluateJsonPointer("/e^f", testDocument)
      expect(result).toBe(3)
    })

    it('should access member "/g|h"', () => {
      const result = evaluateJsonPointer("/g|h", testDocument)
      expect(result).toBe(4)
    })

    it('should access member "/i\\j"', () => {
      const result = evaluateJsonPointer("/i\\j", testDocument)
      expect(result).toBe(5)
    })

    it('should access member "/k\\"l"', () => {
      const result = evaluateJsonPointer('/k"l', testDocument)
      expect(result).toBe(6)
    })

    it('should access member with space "/ "', () => {
      const result = evaluateJsonPointer("/ ", testDocument)
      expect(result).toBe(7)
    })

    it("should throw error for nonexistent member", () => {
      expect(() => {
        evaluateJsonPointer("/nonexistent", testDocument)
      }).toThrow()
    })

    it("should perform byte-by-byte matching (no Unicode normalization)", () => {
      // This tests that member names must match exactly
      const doc = { café: 1, "cafe\u0301": 2 } // Different Unicode representations
      const result1 = evaluateJsonPointer("/café", doc)
      expect(result1).toBe(1)
      const result2 = evaluateJsonPointer("/cafe\u0301", doc)
      expect(result2).toBe(2)
    })
  })

  describe("Token decoding (escape sequences)", () => {
    it('should decode "~1" to "/"', () => {
      // "/a~1b" should access member "a/b"
      const result = evaluateJsonPointer("/a~1b", testDocument)
      expect(result).toBe(1)
    })

    it('should decode "~0" to "~"', () => {
      // "/m~0n" should access member "m~n"
      const result = evaluateJsonPointer("/m~0n", testDocument)
      expect(result).toBe(8)
    })

    it("should decode escape sequences in correct order (first ~1, then ~0)", () => {
      // "~01" should become "~1" (not "/")
      // If we did ~0 first, "~01" would incorrectly become "/"
      const doc = { "~1": "correct", "/": "wrong" }
      const result = evaluateJsonPointer("/~01", doc)
      expect(result).toBe("correct")
    })

    it("should handle multiple escape sequences", () => {
      const doc = { "a/b/c": 1, "x~y~z": 2 }
      expect(evaluateJsonPointer("/a~1b~1c", doc)).toBe(1)
      expect(evaluateJsonPointer("/x~0y~0z", doc)).toBe(2)
    })
  })

  describe("Array indexing", () => {
    it('should access array element "/foo/0"', () => {
      const result = evaluateJsonPointer("/foo/0", testDocument)
      expect(result).toBe("bar")
    })

    it('should access array element "/foo/1"', () => {
      const result = evaluateJsonPointer("/foo/1", testDocument)
      expect(result).toBe("baz")
    })

    it("should accept index '0'", () => {
      const doc = { arr: ["first"] }
      const result = evaluateJsonPointer("/arr/0", doc)
      expect(result).toBe("first")
    })

    it("should accept indices starting with 1-9 (no leading zeros)", () => {
      const doc = { arr: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
      for (let i = 1; i <= 9; i++) {
        const result = evaluateJsonPointer(`/arr/${i}`, doc)
        expect(result).toBe(i)
      }
    })

    it("should reject leading zeros in array indices", () => {
      const doc = { arr: [1, 2, 3] }
      expect(() => {
        evaluateJsonPointer("/arr/01", doc)
      }).toThrow()
      expect(() => {
        evaluateJsonPointer("/arr/00", doc)
      }).toThrow()
    })

    it("should reject non-numeric tokens for array access", () => {
      const doc = { arr: [1, 2, 3] }
      expect(() => {
        evaluateJsonPointer("/arr/abc", doc)
      }).toThrow()
    })

    it("should throw error for index out of bounds (too large)", () => {
      const doc = { arr: [1, 2, 3] }
      expect(() => {
        evaluateJsonPointer("/arr/10", doc)
      }).toThrow()
    })

    it("should throw error for negative index", () => {
      const doc = { arr: [1, 2, 3] }
      expect(() => {
        evaluateJsonPointer("/arr/-1", doc)
      }).toThrow()
    })

    it('should throw error for "-" token (nonexistent element)', () => {
      const doc = { arr: [1, 2, 3] }
      expect(() => {
        evaluateJsonPointer("/arr/-", doc)
      }).toThrow()
    })

    it("should handle large array indices (up to safe integer limit)", () => {
      const largeIndex = 1000 // Use a reasonable large index for testing
      const doc = { arr: new Array(largeIndex + 1).fill(0).map((_, i) => i) }
      const result = evaluateJsonPointer(`/arr/${largeIndex}`, doc)
      expect(result).toBe(largeIndex)
    })

    it("should reject unsafe integer indices", () => {
      const doc = { arr: [] }
      const unsafeIndex = Number.MAX_SAFE_INTEGER + 1
      expect(() => {
        evaluateJsonPointer(`/arr/${unsafeIndex}`, doc)
      }).toThrow()
    })
  })

  describe("Nested structures", () => {
    it("should navigate nested objects", () => {
      const doc = {
        level1: {
          level2: {
            level3: "value",
          },
        },
      }
      const result = evaluateJsonPointer("/level1/level2/level3", doc)
      expect(result).toBe("value")
    })

    it("should navigate through arrays to objects", () => {
      const doc = {
        items: [
          { id: 1, name: "first" },
          { id: 2, name: "second" },
        ],
      }
      const result = evaluateJsonPointer("/items/0/name", doc)
      expect(result).toBe("first")
    })

    it("should navigate through objects to arrays", () => {
      const doc = {
        data: {
          numbers: [10, 20, 30],
        },
      }
      const result = evaluateJsonPointer("/data/numbers/1", doc)
      expect(result).toBe(20)
    })
  })

  describe("Error conditions", () => {
    it("should throw error when accessing property of null", () => {
      const doc = { prop: null }
      expect(() => {
        evaluateJsonPointer("/prop/subprop", doc)
      }).toThrow()
    })

    it("should throw error when accessing property of undefined", () => {
      const doc = { prop: undefined }
      expect(() => {
        evaluateJsonPointer("/prop/subprop", doc)
      }).toThrow()
    })

    it("should throw error when accessing property of primitive", () => {
      const doc = { prop: "string" }
      expect(() => {
        evaluateJsonPointer("/prop/subprop", doc)
      }).toThrow()
    })

    it("should throw error when accessing property of number", () => {
      const doc = { prop: 42 }
      expect(() => {
        evaluateJsonPointer("/prop/subprop", doc)
      }).toThrow()
    })

    it("should throw error when accessing property of boolean", () => {
      const doc = { prop: true }
      expect(() => {
        evaluateJsonPointer("/prop/subprop", doc)
      }).toThrow()
    })
  })

  describe("JMAP wildcard extension (*)", () => {
    it('should apply rest of pointer to each array element with "*"', () => {
      const doc = {
        items: [
          { id: 1, name: "first" },
          { id: 2, name: "second" },
          { id: 3, name: "third" },
        ],
      }
      const result = evaluateJsonPointer("/items/*/name", doc)
      expect(result).toEqual(["first", "second", "third"])
    })

    it('should return array elements when "*" is last token', () => {
      const doc = {
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      }
      const result = evaluateJsonPointer("/items/*", doc)
      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    it('should flatten nested arrays when "*" returns arrays', () => {
      const doc = {
        items: [{ tags: ["a", "b"] }, { tags: ["c", "d"] }, { tags: ["e"] }],
      }
      const result = evaluateJsonPointer("/items/*/tags", doc)
      // Should flatten: [["a", "b"], ["c", "d"], ["e"]] -> ["a", "b", "c", "d", "e"]
      expect(result).toEqual(["a", "b", "c", "d", "e"])
    })

    it('should skip non-object items when using "*"', () => {
      const doc = {
        items: [
          { id: 1, name: "first" },
          "not-an-object",
          { id: 2, name: "second" },
          42,
          { id: 3, name: "third" },
        ],
      }
      const result = evaluateJsonPointer("/items/*/name", doc)
      // Should only process objects, skip primitives
      expect(result).toEqual(["first", "second", "third"])
    })

    it('should skip items where pointer evaluation fails when using "*"', () => {
      const doc = {
        items: [
          { id: 1, name: "first" },
          { id: 2 }, // missing "name" property
          { id: 3, name: "third" },
        ],
      }
      const result = evaluateJsonPointer("/items/*/name", doc)
      // Should skip items where /name doesn't exist
      expect(result).toEqual(["first", "third"])
    })

    it('should handle "*" with empty array', () => {
      const doc = {
        items: [],
      }
      const result = evaluateJsonPointer("/items/*", doc)
      expect(result).toEqual([])
    })

    it('should handle nested "*" wildcards', () => {
      const doc = {
        groups: [
          {
            items: [
              { id: 1, name: "a" },
              { id: 2, name: "b" },
            ],
          },
          {
            items: [{ id: 3, name: "c" }],
          },
        ],
      }
      const result = evaluateJsonPointer("/groups/*/items/*/name", doc)
      // Should flatten: [["a", "b"], ["c"]] -> ["a", "b", "c"]
      expect(result).toEqual(["a", "b", "c"])
    })

    it('should skip array items (non-objects) when "*" is used', () => {
      const doc = {
        items: [{ id: 1 }, ["array-item"], { id: 2 }],
      }
      const result = evaluateJsonPointer("/items/*/id", doc)
      // Arrays are not objects, so should be skipped
      expect(result).toEqual([1, 2])
    })

    it('should return empty array when "*" matches no valid items', () => {
      const doc = {
        items: ["string1", "string2", 42],
      }
      const result = evaluateJsonPointer("/items/*/property", doc)
      // All items are primitives, none are objects
      expect(result).toEqual([])
    })
  })

  describe("Complex examples from RFC 6901", () => {
    it("should handle all examples from RFC 6901 Section 5", () => {
      expect(evaluateJsonPointer("", testDocument)).toEqual(testDocument)
      expect(evaluateJsonPointer("/foo", testDocument)).toEqual(["bar", "baz"])
      expect(evaluateJsonPointer("/foo/0", testDocument)).toBe("bar")
      expect(evaluateJsonPointer("/", testDocument)).toBe(0)
      expect(evaluateJsonPointer("/a~1b", testDocument)).toBe(1)
      expect(evaluateJsonPointer("/c%d", testDocument)).toBe(2)
      expect(evaluateJsonPointer("/e^f", testDocument)).toBe(3)
      expect(evaluateJsonPointer("/g|h", testDocument)).toBe(4)
      expect(evaluateJsonPointer("/i\\j", testDocument)).toBe(5)
      expect(evaluateJsonPointer('/k"l', testDocument)).toBe(6)
      expect(evaluateJsonPointer("/ ", testDocument)).toBe(7)
      expect(evaluateJsonPointer("/m~0n", testDocument)).toBe(8)
    })
  })
})
