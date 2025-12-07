import { useMutation } from "@tanstack/react-query"
import { postGenerate, type GenerateRequest, type GenerateResponse } from "../http/generate"

export function useGenerate() {
  return useMutation<GenerateResponse, Error, GenerateRequest>({
    mutationKey: ["generate"],
    mutationFn: async (request: GenerateRequest) => {
      return postGenerate(request)
    },
  })
}
