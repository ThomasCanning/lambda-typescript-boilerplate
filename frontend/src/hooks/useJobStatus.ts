import { useQuery } from "@tanstack/react-query"
import { getJobStatus } from "@/lib/api"

export function useJobStatus(jobId: string) {
  return useQuery({
    queryKey: ["generate-status", jobId],
    queryFn: () => getJobStatus(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      // Stop polling if complete or failed
      const status = query.state.data?.status
      if (status === "succeeded" || status === "failed") {
        return false
      }
      return 2000 // Poll every 2 seconds
    },
  })
}
