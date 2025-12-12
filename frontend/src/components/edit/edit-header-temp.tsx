import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"

type EditHeaderTempProps = {
  onSignupClick: () => void
}

export function EditHeaderTemp({ onSignupClick }: EditHeaderTempProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur z-50 flex items-center justify-between px-6">
      <div className="text-lg font-bold">OneClick</div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onSignupClick}>
          <LogIn className="w-4 h-4 mr-2" />
          Sign Up to Deploy
        </Button>
      </div>
    </header>
  )
}
