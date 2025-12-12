import { Search, Palette, PenTool, Hammer } from "lucide-react"
import { AgentAvatar } from "./agent-avatar"
import type { JobStatus } from "@/lib/api"

type AgentStatus = "idle" | "thinking" | "waiting" | "completed"

interface GenerateHeaderProps {
  jobStatus: JobStatus | null
  scraperStatus: AgentStatus
  colorStatus: AgentStatus
  copyStatus: AgentStatus
  builderStatus: AgentStatus
}

export function GenerateHeader({
  jobStatus,
  scraperStatus,
  colorStatus,
  copyStatus,
  builderStatus,
}: GenerateHeaderProps) {
  return (
    <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold tracking-tight">OneClick</h1>

        <div className="flex items-center gap-4">
          <AgentAvatar icon={Search} status={scraperStatus} label="Scraper" />
          <div className="w-8 h-px bg-gray-200" />
          <AgentAvatar icon={Palette} status={colorStatus} label="Designer" />
          <div className="w-8 h-px bg-gray-200" />
          <AgentAvatar icon={PenTool} status={copyStatus} label="Copywriter" />
          <div className="w-8 h-px bg-gray-200" />
          <AgentAvatar icon={Hammer} status={builderStatus} label="Builder" />
        </div>
      </div>

      {/* Status Text */}
      <div className="text-sm text-muted-foreground animate-pulse">
        {jobStatus?.progressMessage || "Initialize..."}
      </div>
    </header>
  )
}
