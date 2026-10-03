"use client"

import { useState, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"
import { signOut } from "next-auth/react"
import { ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface EditEmperorCredentialsButtonProps {
  userId: string
  currentUsername?: string | null
  onSuccess?: () => void
}

export function EditEmperorCredentialsButton({
  userId,
  currentUsername,
  onSuccess,
}: EditEmperorCredentialsButtonProps) {
  const t = useTranslations("profile.promote")
  const tPassword = useTranslations("profile.password")
  const locale = useLocale()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState(currentUsername || "")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setUsername(currentUsername || "")
      setNewPassword("")
      setConfirmPassword("")
    }
  }, [open, currentUsername])

  const close = () => {
    setOpen(false)
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const trimmedUsername = username.trim()
    const isUsernameChanged = trimmedUsername !== (currentUsername || "")
    const isPasswordChanged = Boolean(newPassword)

    if (!isUsernameChanged && !isPasswordChanged) {
      toast({ title: tPassword("noChanges") })
      return
    }

    if (isUsernameChanged) {
      if (trimmedUsername.length < 1 || trimmedUsername.length > 20) {
        toast({ title: tPassword("usernameInvalid"), variant: "destructive" })
        return
      }
      if (trimmedUsername.includes("@") || !/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
        toast({ title: tPassword("usernameInvalid"), variant: "destructive" })
        return
      }
    }

    if (isPasswordChanged) {
      if (newPassword.length < 8) {
        toast({ title: tPassword("passwordTooShort"), variant: "destructive" })
        return
      }
      if (newPassword !== confirmPassword) {
        toast({ title: tPassword("passwordMismatch"), variant: "destructive" })
        return
      }
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: isUsernameChanged ? trimmedUsername : undefined,
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
        throw new Error(data.error || t("updateFailed"))
      }

      close()

      if (data.passwordUpdated) {
        toast({
          title: t("editEmperorSuccess"),
          description: tPassword("accountUpdated"),
        })
        void signOut({ callbackUrl: `/${locale}` })
      } else {
        toast({ title: tPassword("usernameUpdated") })
        onSuccess?.()
      }
    } catch (error) {
      toast({
        title: t("updateFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && (nextOpen ? setOpen(true) : close())}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-primary"
        onClick={() => setOpen(true)}
        title={t("editEmperor")}
        aria-label={t("editEmperorFor")}
      >
        <ShieldCheck className="w-4 h-4 text-amber-500" />
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editEmperorTitle")}</DialogTitle>
          <DialogDescription>{t("editEmperorDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`emperor-username-${userId}`}>{tPassword("username")}</Label>
            <Input
              id={`emperor-username-${userId}`}
              type="text"
              autoComplete="username"
              placeholder={tPassword("usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`emperor-password-${userId}`}>{tPassword("newPassword")}</Label>
            <Input
              id={`emperor-password-${userId}`}
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder={tPassword("newPasswordPlaceholder")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {Boolean(newPassword) && (
            <div className="space-y-2">
              <Label htmlFor={`emperor-confirm-password-${userId}`}>
                {tPassword("confirmPassword")}
              </Label>
              <Input
                id={`emperor-confirm-password-${userId}`}
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder={tPassword("confirmPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tPassword("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
