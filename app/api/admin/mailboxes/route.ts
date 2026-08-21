import { createDb } from "@/lib/db"
import { checkPermission } from "@/lib/auth"
import { getUserId } from "@/lib/apiKey"
import { PERMISSIONS } from "@/lib/permissions"
import { emails, users } from "@/lib/schema"
import { and, desc, eq, gt, like, or, sql } from "drizzle-orm"
import { getRequestContext } from "@cloudflare/next-on-pages"
import {
  adminMailboxRegistrationSchema,
  isConfiguredEmailDomain,
} from "@/lib/validation"

export const runtime = "edge"

const PERMANENT_EXPIRY = new Date("9999-01-01T00:00:00.000Z")

export async function POST(request: Request) {
  if (!await checkPermission(PERMISSIONS.MANAGE_USERS_MAILBOX)) {
    return Response.json({ error: "权限不足", code: "FORBIDDEN" }, { status: 403 })
  }

  const emperorId = await getUserId()
  if (!emperorId) {
    return Response.json({ error: "未登录", code: "UNAUTHORIZED" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "邮箱地址格式不正确", code: "INVALID_ADDRESS" }, { status: 400 })
  }

  const parsed = adminMailboxRegistrationSchema.safeParse(payload)
  if (!parsed.success) {
    return Response.json({ error: "邮箱地址格式不正确", code: "INVALID_ADDRESS" }, { status: 400 })
  }

  const { address } = parsed.data
  const domainConfig = await getRequestContext().env.SITE_CONFIG.get("EMAIL_DOMAINS")
  if (!isConfiguredEmailDomain(address, domainConfig)) {
    return Response.json({ error: "邮箱域名不在网站配置中", code: "INVALID_DOMAIN" }, { status: 400 })
  }

  const db = createDb()

  try {
    const existing = await db.query.emails.findFirst({
      where: eq(sql`LOWER(${emails.address})`, address),
    })

    if (existing) {
      const ownerId = existing.userId || emperorId
      await db.update(emails)
        .set({ userId: ownerId, expiresAt: PERMANENT_EXPIRY })
        .where(eq(emails.id, existing.id))

      return Response.json({
        mailbox: { id: existing.id, address: existing.address, ownerId },
        created: false,
      })
    }

    const [mailbox] = await db.insert(emails)
      .values({
        address,
        userId: emperorId,
        createdAt: new Date(),
        expiresAt: PERMANENT_EXPIRY,
      })
      .returning({ id: emails.id, address: emails.address, ownerId: emails.userId })

    return Response.json({ mailbox, created: true })
  } catch (error) {
    console.error("Failed to register admin mailbox:", error)
    return Response.json({ error: "登记邮箱失败", code: "REGISTER_FAILED" }, { status: 500 })
  }
}

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
