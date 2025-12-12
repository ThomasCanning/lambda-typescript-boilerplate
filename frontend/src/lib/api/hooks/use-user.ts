import { useState, useEffect } from "react"
import { getMe, type User } from "../http/auth"

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const u = await getMe()
      setUser(u)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshUser()
  }, [])

  return { user, isLoading, refreshUser }
}
