"use client"

import { useState, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import { signOut } from "next-auth/react"
import { ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import type { User } from "next-auth"

interface PasswordPanelProps {
  user?: User
}

export function PasswordPanel({ user }: PasswordPanelProps) {
  const t = useTranslations("profile.password")
  const locale = useLocale()
  const router = useRouter()
  const { toast } = useToast()

  const [initialUsername, setInitialUsername] = useState(user?.username || "")
  const [username, setUsername] = useState(user?.username || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [hasPassword, setHasPassword] = useState(Boolean(user?.passwordVersion || user?.username))
  const [isEmperor, setIsEmperor] = useState(
    Boolean(user?.roles?.some((r) => r.name === "emperor"))
  )
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadAccountInfo() {
      try {
        const res = await fetch("/api/profile/account")
        if (res.ok) {
          const data = (await res.json()) as {
            username: string | null
            hasPassword: boolean
            isEmperor: boolean
          }
          if (isMounted) {
            if (data.username) {
              setInitialUsername(data.username)
              setUsername(data.username)
            }
            setHasPassword(data.hasPassword)
            setIsEmperor(data.isEmperor)
          }
        }
      } catch (e) {
        console.error("Failed to load account info:", e)
      } finally {
        if (isMounted) {
          setInitialLoading(false)
        }
      }
    }
    void loadAccountInfo()
    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const trimmedUsername = username.trim()
    const isUsernameChanged = trimmedUsername !== initialUsername
    const isPasswordChanged = Boolean(newPassword)

    if (!isUsernameChanged && !isPasswordChanged) {
      toast({ title: t("noChanges") })
      return
    }

    if (isUsernameChanged) {
      if (trimmedUsername.length < 1 || trimmedUsername.length > 20) {
        toast({ title: t("usernameInvalid"), variant: "destructive" })
        return
      }
      if (trimmedUsername.includes("@") || !/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
        toast({ title: t("usernameInvalid"), variant: "destructive" })
        return
      }
    }

    if (isPasswordChanged) {
      if (newPassword.length < 8) {
        toast({ title: t("passwordTooShort"), variant: "destructive" })
        return
      }
      if (newPassword !== confirmPassword) {
        toast({ title: t("passwordMismatch"), variant: "destructive" })
        return
      }
    }

    setLoading(true)
    try {
      const response = await fetch("/api/profile/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: isUsernameChanged ? trimmedUsername : undefined,
          currentPassword: currentPassword || undefined,
          newPassword: isPasswordChanged ? newPassword : undefined,
        }),
      })

      const data = (await response.json()) as {
        success?: boolean
        error?: string
        username?: string
        passwordUpdated?: boolean
      }

      if (!response.ok) {
        let message = data.error || t("updateFailed")
        if (response.status === 403) {
          message = t("currentPasswordIncorrect")
        } else if (response.status === 409) {
          message = data.error || t("usernameTaken")
        }
        throw new Error(message)
      }

      if (data.passwordUpdated) {
        toast({
          title: t("updateSuccess"),
          description: t("accountUpdated"),
        })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        void signOut({ callbackUrl: `/${locale}` })
      } else {
        toast({ title: t("usernameUpdated") })
        if (data.username) {
          setInitialUsername(data.username)
          setUsername(data.username)
        }
        router.refresh()
      }
    } catch (error) {
      toast({
        title: t("updateFailed"),
        description: error instanceof Error ? error.message : t("updateFailed"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background rounded-lg border-2 border-primary/20 p-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{t("accountSecurityTitle")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t("accountSecurityDesc")}
      </p>

      {initialLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="account-username">{t("username")}</Label>
              {!initialUsername && (
                <span className="text-xs text-amber-500 font-medium">
                  {t("setPasswordPlaceholder") ? "尚未设置账户名" : ""}
                </span>
              )}
            </div>
            <Input
              id="account-username"
              type="text"
              autoComplete="username"
              placeholder={t("usernamePlaceholder")}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">
                {isEmperor ? t("currentPasswordOptional") : t("currentPassword")}
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                placeholder={isEmperor ? "可留空（皇帝免验旧密码）" : undefined}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={loading}
                required={!isEmperor && Boolean(newPassword)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">
              {hasPassword ? t("newPassword") : t("setPassword")}
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder={
                hasPassword
                  ? t("newPasswordPlaceholder")
                  : t("setPasswordPlaceholder")
              }
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={loading}
              required={!hasPassword && !initialUsername}
            />
          </div>

          {(Boolean(newPassword) || !hasPassword) && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder={t("confirmPassword")}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading}
                required={Boolean(newPassword)}
              />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? t("saving") : t("saveChanges")}
          </Button>
        </form>
      )}
    </div>
  )
}
