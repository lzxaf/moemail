"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Mail, Search, Trash2, User2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useConfig } from "@/hooks/use-config"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface MailboxItem {
  id: string
  address: string
  expiresAt: string
  ownerId: string
  ownerName: string | null
  ownerUsername: string | null
  ownerEmail: string | null
}

const PAGE_SIZE = 10

export function MailboxPanel() {
  const t = useTranslations("profile.mailbox")
  const locale = useLocale()
  const { config } = useConfig()
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [newAddress, setNewAddress] = useState("")
  const [registering, setRegistering] = useState(false)
  const [registrationError, setRegistrationError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mailboxToDelete, setMailboxToDelete] = useState<MailboxItem | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchMailboxes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (query) params.set("search", query)
      const response = await fetch(`/api/admin/mailboxes?${params}`)
      const data = await response.json() as {
        mailboxes?: MailboxItem[]
        total?: number
        error?: string
      }
      if (!response.ok) throw new Error(data.error || t("loadFailed"))
      setMailboxes(data.mailboxes || [])
      setTotal(data.total || 0)
    } catch (error) {
      toast({
        title: t("loadFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, query, t, toast])

  useEffect(() => {
    fetchMailboxes()
  }, [fetchMailboxes])

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    setRegistering(true)
    setRegistrationError("")

    try {
      const response = await fetch("/api/admin/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newAddress }),
      })
      const data = await response.json() as {
        mailbox?: { address: string }
        created?: boolean
        code?: string
      }

      if (!response.ok || !data.mailbox) {
        const message = data.code === "INVALID_DOMAIN"
          ? t("invalidDomain")
          : data.code === "INVALID_ADDRESS"
            ? t("invalidAddress")
            : t("registerFailed")
        setRegistrationError(message)
        return
      }

      setNewAddress("")
      setSearch(data.mailbox.address)
      toast({ title: data.created ? t("registerSuccess") : t("existingSuccess") })
    } catch {
      setRegistrationError(t("registerFailed"))
    } finally {
      setRegistering(false)
    }
  }

  const handleDelete = async (mailbox: MailboxItem) => {
    setDeletingId(mailbox.id)
    try {
      const response = await fetch(`/api/emails/${mailbox.id}`, { method: "DELETE" })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || t("deleteFailed"))
      toast({ title: t("deleteSuccess") })
      setMailboxToDelete(null)
      if (mailboxes.length === 1 && page > 1) setPage((value) => value - 1)
      else await fetchMailboxes()
    } catch (error) {
      toast({
        title: t("deleteFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const ownerLabel = (mailbox: MailboxItem) =>
    mailbox.ownerName || mailbox.ownerUsername || mailbox.ownerEmail || mailbox.ownerId

  return (
    <div className="bg-background rounded-lg border-2 border-primary/20 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-6">
        <Mail className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <span className="text-sm text-muted-foreground ml-auto" aria-live="polite">
          {t("total", { count: total })}
        </span>
      </div>

      <form onSubmit={handleRegister} className="mb-6 space-y-3 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-1">
          <Label htmlFor="admin-mailbox-address">{t("registerTitle")}</Label>
          <p id="admin-mailbox-hint" className="text-xs text-muted-foreground">
            {t("registerDescription")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("allowedDomains", {
              domains: config?.emailDomainsArray.map((domain) => domain.trim()).filter(Boolean).join(", ") || "—",
            })}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="admin-mailbox-address"
            type="email"
            value={newAddress}
            onChange={(event) => {
              setNewAddress(event.target.value)
              setRegistrationError("")
            }}
            placeholder={t("addressPlaceholder")}
            aria-describedby="admin-mailbox-hint admin-mailbox-error"
            disabled={registering}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={registering || !newAddress.trim()} className="w-full sm:w-auto">
            {registering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {registering ? t("registering") : t("startReceiving")}
          </Button>
        </div>
        {registrationError && (
          <p id="admin-mailbox-error" className="text-xs font-medium text-destructive" role="alert">
            {registrationError}
          </p>
        )}
      </form>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t("loading")}
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="space-y-2">
          {mailboxes.map((mailbox) => (
            <div key={mailbox.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={`/${locale}/moe?userId=${mailbox.ownerId}&emailId=${mailbox.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  aria-label={t("viewAddress", { address: mailbox.address })}
                >
                  <span className="break-all">{mailbox.address}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  <User2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t("owner", { name: ownerLabel(mailbox) })}</span>
                  {mailbox.ownerUsername && mailbox.ownerName && (
                    <span className="truncate">@{mailbox.ownerUsername}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(mailbox.expiresAt).getFullYear() === 9999
                    ? t("permanent")
                    : t("expiresAt", { date: new Date(mailbox.expiresAt).toLocaleString() })}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive border-destructive/30 hover:text-destructive"
                onClick={() => setMailboxToDelete(mailbox)}
                title={t("delete")}
                aria-label={t("deleteAddress", { address: mailbox.address })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t("previous")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("page", { current: page, total: totalPages })}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((value) => value + 1)} disabled={page >= totalPages}>
            {t("next")}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      <AlertDialog open={!!mailboxToDelete} onOpenChange={(open) => !open && !deletingId && setMailboxToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {mailboxToDelete && t("deleteConfirm", {
                address: mailboxToDelete.address,
                owner: ownerLabel(mailboxToDelete),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingId}
              onClick={(event) => {
                event.preventDefault()
                if (mailboxToDelete) handleDelete(mailboxToDelete)
              }}
            >
              {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : t("deleteConfirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
