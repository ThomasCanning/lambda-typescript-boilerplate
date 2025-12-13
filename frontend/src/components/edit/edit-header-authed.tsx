import { Button } from "@/components/ui/button"
import { Rocket, Code2, ScanSearch, Lightbulb } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { User } from "@/lib/api/http/auth"
import { AgentAvatar } from "../generate/agent-avatar"

type AgentState = "idle" | "thinking" | "completed"

type EditAgentStates = {
  selector?: AgentState
  planner?: AgentState
  editor?: AgentState
}

type EditHeaderAuthedProps = {
  onDeployClick: () => void
  isDeploying?: boolean
  user: User
  agentStates?: EditAgentStates
}

export function EditHeaderAuthed({
  onDeployClick,
  isDeploying,
  user,
  agentStates,
}: EditHeaderAuthedProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <div className="text-lg font-bold">OneClick</div>
        <div className="w-px h-6 bg-border" />
        <AgentAvatar icon={ScanSearch} status={agentStates?.selector || "idle"} label="Selector" />
        <div className="w-8 h-px bg-gray-200" />
        <AgentAvatar icon={Lightbulb} status={agentStates?.planner || "idle"} label="Planner" />
        <div className="w-8 h-px bg-gray-200" />
        <AgentAvatar icon={Code2} status={agentStates?.editor || "idle"} label="Editor" />
      </div>
      <div className="flex gap-2">
        <Button variant="default" onClick={onDeployClick} disabled={isDeploying}>
          {isDeploying ? <Spinner className="mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
          {user.subdomain ? "Update Deployment" : "Deploy Site"}
        </Button>
      </div>
    </header>
  )
}
