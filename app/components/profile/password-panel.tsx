"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { signOut } from "next-auth/react"
import { KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

export function PasswordPanel() {
  const t = useTranslations("profile.password")
  const locale = useLocale()
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (newPassword.length < 8) {
      toast({ title: t("passwordTooShort"), variant: "destructive" })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({ title: t("passwordMismatch"), variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (!response.ok) {
        const message = response.status === 403
          ? t("currentPasswordIncorrect")
          : response.status === 409
            ? t("passwordUnavailable")
            : response.status === 400
              ? t("invalidPassword")
              : t("updateFailed")
        throw new Error(message)
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast({ title: t("updateSuccess") })
      void signOut({ callbackUrl: `/${locale}` })
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
        <KeyRound className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{t("description")}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">{t("currentPassword")}</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? t("updating") : t("update")}
        </Button>
      </form>
    </div>
  )
}
