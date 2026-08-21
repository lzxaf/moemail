import { Header } from "@/components/layout/header"
import { ThreeColumnLayout } from "@/components/emails/three-column-layout"
import { NoPermissionDialog } from "@/components/no-permission-dialog"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"
import type { Locale } from "@/i18n/config"
import { createDb } from "@/lib/db"
import { emails, users } from "@/lib/schema"
import { and, eq } from "drizzle-orm"

export const runtime = "edge"

export default async function MoePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ userId?: string; emailId?: string }>
}) {
  const { locale: localeFromParams } = await params
  const { userId, emailId } = await searchParams
  const locale = localeFromParams as Locale
  const session = await auth()

  if (!session?.user) {
    redirect(`/${locale}`)
  }

  const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL)
  const canManageUsersMailbox = userId
    ? await checkPermission(PERMISSIONS.MANAGE_USERS_MAILBOX)
    : false
  const managedUser = userId && canManageUsersMailbox
    ? await createDb().query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, name: true, username: true, email: true },
      })
    : null

  if (userId && !managedUser) {
    redirect(`/${locale}/profile`)
  }

  const mailboxOwnerId = managedUser?.id || session.user.id!
  const initialEmail = emailId
    ? await createDb().query.emails.findFirst({
        where: and(eq(emails.id, emailId), eq(emails.userId, mailboxOwnerId)),
        columns: { id: true, address: true },
      })
    : undefined

  return (
    <div className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 h-screen">
      <div className="container mx-auto h-full px-4 lg:px-8 max-w-[1600px]">
        <Header />
        <main className="h-full">
          <ThreeColumnLayout
            managedUser={managedUser || undefined}
            initialEmail={initialEmail}
          />
          {!hasPermission && <NoPermissionDialog />}
        </main>
      </div>
    </div>
  )
}
