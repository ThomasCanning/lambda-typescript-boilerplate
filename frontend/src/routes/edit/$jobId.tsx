import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { EditPage } from "@/components/edit/edit-page"
import { EditHeaderTemp } from "@/components/edit/edit-header-temp"
import { SignupDialog } from "@/components/auth/signup-dialog"
import { useUser } from "@/lib/api"

export const Route = createFileRoute("/edit/$jobId")({
  component: EditJobPage,
})

function EditJobPage() {
  const { jobId } = Route.useParams()
  const [isSignupOpen, setIsSignupOpen] = useState(false)
  const { refreshUser } = useUser()
  const navigate = useNavigate()

  return (
    <>
      <EditPage
        jobId={jobId}
        header={<EditHeaderTemp onSignupClick={() => setIsSignupOpen(true)} />}
      />
      <SignupDialog
        open={isSignupOpen}
        onOpenChange={setIsSignupOpen}
        jobId={jobId}
        onSuccess={() => {
          void (async () => {
            await refreshUser()
            await navigate({ to: "/edit" })
          })()
        }}
      />
    </>
  )
}
