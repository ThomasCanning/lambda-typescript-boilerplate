import { Code2, ScanSearch, Lightbulb } from "lucide-react"
import { AgentAvatar } from "../generate/agent-avatar"

export type AgentState = "idle" | "thinking" | "completed"

export type EditAgentStates = {
  selector?: AgentState
  planner?: AgentState
  editor?: AgentState
}

export function AgentStatusBar({ agentStates }: { agentStates?: EditAgentStates }) {
  return (
    <div className="flex items-center gap-6">
      <div className="text-lg font-bold">OneClick</div>
      <div className="w-px h-6 bg-border" />
      <AgentAvatar icon={ScanSearch} status={agentStates?.selector || "idle"} label="Selector" />
      <div className="w-8 h-px bg-gray-200" />
      <AgentAvatar icon={Lightbulb} status={agentStates?.planner || "idle"} label="Planner" />
      <div className="w-8 h-px bg-gray-200" />
      <AgentAvatar icon={Code2} status={agentStates?.editor || "idle"} label="Editor" />
    </div>
  )
}
