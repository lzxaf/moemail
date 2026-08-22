import { createDb } from "@/lib/db"
import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { emails } from "@/lib/schema"
import { encodeCursor, decodeCursor } from "@/lib/cursor"
import { getUserId } from "@/lib/apiKey"
import { checkMailboxAccess, checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { getReceivedMailboxIds } from "@/lib/emperor-mailboxes"

export const runtime = "edge"

const PAGE_SIZE = 20

export async function GET(request: Request) {
  const currentUserId = await getUserId()

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const requestedUserId = searchParams.get('userId')
  const userId = requestedUserId || currentUserId

  if (!await checkMailboxAccess(currentUserId, userId)) {
    return NextResponse.json({ error: "无权限查看" }, { status: 403 })
  }

  const db = createDb()

  try {
    const receivedMailboxIds = !requestedUserId && await checkPermission(PERMISSIONS.MANAGE_USERS_MAILBOX)
      ? await getReceivedMailboxIds(getRequestContext().env.SITE_CONFIG)
      : []
    const receivedMailboxIdSet = new Set(receivedMailboxIds)
    const ownerCondition = receivedMailboxIds.length > 0
      ? or(eq(emails.userId, userId!), inArray(emails.id, receivedMailboxIds))
      : eq(emails.userId, userId!)
    const baseConditions = and(
      ownerCondition,
      gt(emails.expiresAt, new Date())
    )

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(baseConditions)
    const totalCount = Number(totalResult[0].count)

    const conditions = [baseConditions]

    if (cursor) {
      const { timestamp, id } = decodeCursor(cursor)
      conditions.push(
        or(
          lt(emails.createdAt, new Date(timestamp)),
          and(
            eq(emails.createdAt, new Date(timestamp)),
            lt(emails.id, id)
          )
        )
      )
    }

    const results = await db.query.emails.findMany({
      where: and(...conditions),
      orderBy: (emails, { desc }) => [
        desc(emails.createdAt),
        desc(emails.id)
      ],
      limit: PAGE_SIZE + 1
    })

    const hasMore = results.length > PAGE_SIZE
    const nextCursor = hasMore
      ? encodeCursor(
          results[PAGE_SIZE - 1].createdAt.getTime(),
          results[PAGE_SIZE - 1].id
        )
      : null
    const emailList = hasMore ? results.slice(0, PAGE_SIZE) : results

    return NextResponse.json({
      emails: emailList.map((email) => ({
        ...email,
        subscribed: email.userId !== currentUserId && receivedMailboxIdSet.has(email.id),
      })),
      nextCursor,
      total: totalCount
    })
  } catch (error) {
    console.error('Failed to fetch user emails:', error)
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    )
  }
}
