import { Button } from "@/components/ui/button"
import { Rocket } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { User } from "@/lib/api/http/auth"
import { AgentStatusBar, type EditAgentStates } from "./agent-status-bar"

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
    <header className="fixed top-0 left-0 right-0 h-20 border-b bg-background/95 backdrop-blur z-50 flex items-center justify-between px-6">
      <AgentStatusBar agentStates={agentStates} />
      <div className="flex gap-2">
        <Button variant="default" onClick={onDeployClick} disabled={isDeploying}>
          {isDeploying ? <Spinner className="mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
          {user.subdomain ? "Update Deployment" : "Deploy Site"}
        </Button>
      </div>
    </header>
  )
}
