import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"
import { AgentStatusBar, type EditAgentStates } from "./agent-status-bar"

type EditHeaderTempProps = {
  onSignupClick: () => void
  agentStates?: EditAgentStates
}

export function EditHeaderTemp({ onSignupClick, agentStates }: EditHeaderTempProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-20 border-b bg-background/95 backdrop-blur z-50 flex items-center justify-between px-6">
      <AgentStatusBar agentStates={agentStates} />
      <div className="flex gap-2">
        <Button variant="outline" onClick={onSignupClick}>
          <LogIn className="w-4 h-4 mr-2" />
          Sign Up to Deploy
        </Button>
      </div>
    </header>
  )
}
