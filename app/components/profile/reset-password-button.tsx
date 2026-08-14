"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { KeyRound, Loader2 } from "lucide-react"
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

interface ResetPasswordButtonProps {
  userId: string
  userName: string
}

export function ResetPasswordButton({ userId, userName }: ResetPasswordButtonProps) {
  const t = useTranslations("profile.promote")
  const tPassword = useTranslations("profile.password")
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const close = () => {
    setOpen(false)
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (newPassword.length < 8) {
      toast({ title: tPassword("passwordTooShort"), variant: "destructive" })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: tPassword("passwordMismatch"), variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      })

      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? t("resetPasswordUnavailable")
            : t("resetPasswordFailed")
        )
      }

      close()
      toast({ title: t("resetPasswordSuccess") })
    } catch (error) {
      toast({
        title: t("resetPasswordFailed"),
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
        title={t("resetPassword")}
        aria-label={t("resetPasswordFor", { name: userName })}
      >
        <KeyRound className="w-4 h-4" />
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("resetPassword")}</DialogTitle>
          <DialogDescription>
            {t("resetPasswordDescription", { name: userName })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`reset-password-${userId}`}>{tPassword("newPassword")}</Label>
            <Input
              id={`reset-password-${userId}`}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`confirm-reset-password-${userId}`}>
              {tPassword("confirmPassword")}
            </Label>
            <Input
              id={`confirm-reset-password-${userId}`}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={loading}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("resetPassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
