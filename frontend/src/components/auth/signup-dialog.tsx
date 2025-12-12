import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { signup } from "@/lib/api"
import { Spinner } from "@/components/ui/spinner"

interface SignupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  jobId?: string
}

export function SignupDialog({ open, onOpenChange, onSuccess, jobId }: SignupDialogProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await signup({ username: email, password, jobId })
      if (!res.success) {
        setError(res.error || "Signup failed")
        setIsLoading(false)
        return
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create an account</DialogTitle>
          <DialogDescription>Sign up to save your website and deploy it.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleAuth(e)
          }}
          className="space-y-4 py-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.
            </p>
          </div>

          {error && <div className="text-sm text-red-500 font-medium">{error}</div>}

          <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0 w-full">
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              Sign Up
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
