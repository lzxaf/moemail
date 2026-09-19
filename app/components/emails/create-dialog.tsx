"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Copy, Plus, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { nanoid } from "nanoid"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EXPIRY_OPTIONS } from "@/types/email"
import { useCopy } from "@/hooks/use-copy"
import { useConfig } from "@/hooks/use-config"

interface CreateDialogProps {
  onEmailCreated: () => void
}

export function CreateDialog({ onEmailCreated }: CreateDialogProps) {
  const { config } = useConfig()
  const t = useTranslations("emails.create")
  const tList = useTranslations("emails.list")
  const tCommon = useTranslations("common.actions")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailName, setEmailName] = useState("")
  const [currentDomain, setCurrentDomain] = useState("")
  const [expiryTime, setExpiryTime] = useState(EXPIRY_OPTIONS[1].value.toString())
  const [transferRequired, setTransferRequired] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [transferError, setTransferError] = useState("")
  const { toast } = useToast()
  const { copyToClipboard } = useCopy()

  const generateRandomName = () => {
    setEmailName(nanoid(8))
    resetTransfer()
  }

  const copyEmailAddress = () => {
    copyToClipboard(`${emailName}@${currentDomain}`)
  }

  const resetTransfer = () => {
    setTransferRequired(false)
    setAdminPassword("")
    setTransferError("")
  }

  const createEmail = async (forceTransfer = false) => {
    if (!emailName.trim()) {
      toast({
        title: tList("error"),
        description: t("namePlaceholder"),
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/emails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emailName,
          domain: currentDomain,
          expiryTime: parseInt(expiryTime),
          ...(forceTransfer ? { forceTransfer: true, adminPassword } : {})
        })
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string; code?: string }
        if (data.code === "EMAIL_IN_USE") {
          setTransferRequired(true)
          setTransferError("")
          return
        }
        if (data.code === "ADMIN_PASSWORD_INVALID") {
          setTransferRequired(true)
          setTransferError(t("invalidAdminPassword"))
          return
        }
        toast({
          title: tList("error"),
          description: data.code === "ALREADY_OWNER" ? t("alreadyOwner") : (data.error || t("failed")),
          variant: "destructive"
        })
        return
      }

      toast({
        title: tList("success"),
        description: forceTransfer ? t("transferSuccess") : t("success")
      })
      onEmailCreated()
      setOpen(false)
      setEmailName("")
      resetTransfer()
    } catch {
      toast({
        title: tList("error"),
        description: forceTransfer ? t("transferFailed") : t("failed"),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resetTransfer()
  }

  useEffect(() => {
    if ((config?.emailDomainsArray?.length ?? 0) > 0) {
      setCurrentDomain(config?.emailDomainsArray[0] ?? "")
    }
  }, [config])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              value={emailName}
              onChange={(e) => {
                setEmailName(e.target.value)
                resetTransfer()
              }}
              placeholder={t("namePlaceholder")}
              className="flex-1"
            />
            {(config?.emailDomainsArray?.length ?? 0) > 1 && (
                <Select value={currentDomain} onValueChange={(value) => {
                  setCurrentDomain(value)
                  resetTransfer()
                }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config?.emailDomainsArray?.map(d => (
                    <SelectItem key={d} value={d}>@{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={generateRandomName}
              type="button"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {transferRequired && (
            <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm font-medium">{t("emailInUse")}</p>
              <p className="text-xs text-muted-foreground">{t("transferDescription")}</p>
              <div className="space-y-2">
                <Label htmlFor="admin-transfer-password">{t("adminPassword")}</Label>
                <Input
                  id="admin-transfer-password"
                  type="password"
                  autoComplete="off"
                  value={adminPassword}
                  onChange={(event) => {
                    setAdminPassword(event.target.value)
                    setTransferError("")
                  }}
                  placeholder={t("adminPasswordPlaceholder")}
                />
              </div>
              {transferError && (
                <p className="text-xs font-medium text-destructive" role="alert">{transferError}</p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => createEmail(true)}
                disabled={loading || !adminPassword}
                className="w-full"
              >
                {loading ? t("transferring") : t("transfer")}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Label className="shrink-0 text-muted-foreground">{t("expiryTime")}</Label>
            <RadioGroup
              value={expiryTime}
              onValueChange={setExpiryTime}
              className="flex gap-6"
            >
              {EXPIRY_OPTIONS.map((option, index) => {
                const labels = [t("oneHour"), t("oneDay"), t("threeDays"), t("permanent")]
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <RadioGroupItem value={option.value.toString()} id={option.value.toString()} />
                    <Label htmlFor={option.value.toString()} className="cursor-pointer text-sm">
                      {labels[index]}
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">{t("domain")}:</span>
            {emailName ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{`${emailName}@${currentDomain}`}</span>
                <div
                  className="shrink-0 cursor-pointer hover:text-primary transition-colors"
                  onClick={copyEmailAddress}
                >
                  <Copy className="size-4" />
                </div>
              </div>
            ) : (
              <span className="text-gray-400">...</span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={() => createEmail()} disabled={loading || transferRequired}>
            {loading ? t("creating") : t("create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
