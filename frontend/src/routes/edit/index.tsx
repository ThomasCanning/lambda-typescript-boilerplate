import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { EditPage } from "@/components/edit/edit-page"
import { EditHeaderAuthed } from "@/components/edit/edit-header-authed"
import { useUser, deploySite } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export const Route = createFileRoute("/edit/")({
  component: EditAuthedPage,
})

function EditAuthedPage() {
  const { user, refreshUser, isLoading } = useUser()
  const [siteHtml, setSiteHtml] = useState<string>("")
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false)
  const [deploySubdomain, setDeploySubdomain] = useState("")
  const [deployError, setDeployError] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  const handleDeployClick = () => {
    // In dev mode, check if we have HTML content
    if (import.meta.env.DEV) {
      if (!siteHtml) {
        setDeployError("Please wait for the website to be loaded first.")
        return
      }
      void performDeploy()
      return
    }

    // Prod mode: check for subdomain
    if (user?.subdomain) {
      void performDeploy()
    } else {
      setIsDeployDialogOpen(true)
    }
  }

  const performDeploy = async (subdomain?: string) => {
    setIsDeploying(true)
    setDeployError(null)
    try {
      const res = await deploySite(siteHtml, subdomain)
      if (res.success) {
        setIsDeployDialogOpen(false)
        if (!import.meta.env.DEV) {
          await refreshUser()
          if (res.url) {
            window.open(res.url, "_blank")
          }
        }
      } else {
        if (res.error?.status === 409) {
          setDeployError("Subdomain is already taken. Please choose another.")
        } else {
          setDeployError(res.error?.detail || "Deployment failed")
        }
      }
    } catch (e) {
      console.error(e)
      setDeployError("An unexpected error occurred")
    } finally {
      setIsDeploying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <div>Please log in</div>
  }

  return (
    <>
      <EditPage
        jobId={undefined}
        onSiteLoaded={setSiteHtml}
        header={
          <EditHeaderAuthed
            onDeployClick={handleDeployClick}
            isDeploying={isDeploying}
            user={user}
          />
        }
      />

      <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy your website</DialogTitle>
            <DialogDescription>
              Choose a unique subdomain for your site. It will be available at{" "}
              {deploySubdomain || "your-subdomain"}.
              {import.meta.env.VITE_ROOT_DOMAIN || "example.com"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subdomain" className="text-right">
                Subdomain
              </Label>
              <Input
                id="subdomain"
                value={deploySubdomain}
                onChange={(e) =>
                  setDeploySubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="my-cool-site"
                className="col-span-3"
              />
            </div>
            {deployError && <p className="text-red-500 text-sm">{deployError}</p>}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                void performDeploy(deploySubdomain)
              }}
              disabled={isDeploying || !deploySubdomain}
            >
              {isDeploying ? <Spinner /> : "Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
