import { Button } from "@/components/ui/button"
import { Rocket } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { User } from "@/lib/api/http/auth"

type EditHeaderAuthedProps = {
  onDeployClick: () => void
  isDeploying?: boolean
  user: User
}

export function EditHeaderAuthed({ onDeployClick, isDeploying, user }: EditHeaderAuthedProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur z-50 flex items-center justify-between px-6">
      <div className="text-lg font-bold">OneClick</div>
      <div className="flex gap-2">
        <Button variant="default" onClick={onDeployClick} disabled={isDeploying}>
          {isDeploying ? <Spinner className="mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
          {user.subdomain ? "Update Deployment" : "Deploy Site"}
        </Button>
      </div>
    </header>
  )
}
