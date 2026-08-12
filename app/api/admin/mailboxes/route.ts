import { createDb } from "@/lib/db"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"
import { emails, users } from "@/lib/schema"
import { and, desc, eq, gt, like, or, sql } from "drizzle-orm"

export const runtime = "edge"

export async function GET(request: Request) {
  if (!await checkPermission(PERMISSIONS.MANAGE_USERS_MAILBOX)) {
    return Response.json({ error: "权限不足" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page") || "1"))
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || "10")))
  const search = searchParams.get("search")?.trim()
  const searchCondition = search
    ? or(
        like(emails.address, `%${search}%`),
        like(users.username, `%${search}%`),
        like(users.email, `%${search}%`),
        like(users.name, `%${search}%`)
      )
    : undefined
  const conditions = and(gt(emails.expiresAt, new Date()), searchCondition)
  const db = createDb()

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .innerJoin(users, eq(users.id, emails.userId))
      .where(conditions)

    const mailboxList = await db
      .select({
        id: emails.id,
        address: emails.address,
        expiresAt: emails.expiresAt,
        ownerId: users.id,
        ownerName: users.name,
        ownerUsername: users.username,
        ownerEmail: users.email,
      })
      .from(emails)
      .innerJoin(users, eq(users.id, emails.userId))
      .where(conditions)
      .orderBy(desc(emails.createdAt), desc(emails.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    return Response.json({ mailboxes: mailboxList, total: Number(count), page, pageSize })
  } catch (error) {
    console.error("Failed to list mailboxes:", error)
    return Response.json({ error: "获取邮箱列表失败" }, { status: 500 })
  }
}
