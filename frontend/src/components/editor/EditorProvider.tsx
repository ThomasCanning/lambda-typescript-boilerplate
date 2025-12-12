import { createContext, useContext, type ReactNode } from "react"
import { useJobStatus } from "@/hooks/useJobStatus"
import { type GenerateJobStatus } from "@/lib/api"

interface EditorContextType {
  jobId: string
  status: GenerateJobStatus | undefined
  isLoading: boolean
  finalHtml: string | undefined
  agentStates: GenerateJobStatus["agentStates"]
}

const EditorContext = createContext<EditorContextType | undefined>(undefined)

export function EditorProvider({ jobId, children }: { jobId: string; children: ReactNode }) {
  const { data, isLoading } = useJobStatus(jobId)

  // Extract useful bits for easy access
  const finalHtml = data?.partials?.finalHtml
  const agentStates = data?.agentStates

  return (
    <EditorContext.Provider
      value={{
        jobId,
        status: data,
        isLoading,
        finalHtml,
        agentStates,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error("useEditor must be used within an EditorProvider")
  }
  return context
}
