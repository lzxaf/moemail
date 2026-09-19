import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { createDb } from "@/lib/db"
import { emails, roles, userRoles, users } from "@/lib/schema"
import { eq, and, gt, sql } from "drizzle-orm"
import { EXPIRY_OPTIONS } from "@/types/email"
import { EMAIL_CONFIG } from "@/config"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { getUserId } from "@/lib/apiKey"
import { getUserRole } from "@/lib/auth"
import { ROLES } from "@/lib/permissions"
import { comparePassword, hashPassword } from "@/lib/utils"
import { removeReceivedMailboxId } from "@/lib/emperor-mailboxes"

export const runtime = "edge"

const PERMANENT_EXPIRY = new Date('9999-01-01T00:00:00.000Z')

async function verifyTransferPassword(
  db: ReturnType<typeof createDb>,
  password: string,
  configuredPassword?: string
) {
  if (configuredPassword) {
    return comparePassword(password, await hashPassword(configuredPassword))
  }

  const admin = await db
    .select({ password: users.password })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(roles.name, ROLES.EMPEROR))
    .limit(1)

  return Boolean(admin[0]?.password && await comparePassword(password, admin[0].password))
}

export async function POST(request: Request) {
  const db = createDb()
  const env = getRequestContext().env

  const userId = await getUserId()
  const userRole = await getUserRole(userId!)

  try {
    const { name, expiryTime, domain, adminPassword, forceTransfer } = await request.json<{
      name: string
      expiryTime: number
      domain: string
      adminPassword?: string
      forceTransfer?: boolean
    }>()

    if (!EXPIRY_OPTIONS.some(option => option.value === expiryTime)) {
      return NextResponse.json(
        { error: "无效的过期时间" },
        { status: 400 }
      )
    }

    const domainString = await env.SITE_CONFIG.get("EMAIL_DOMAINS")
    const domains = domainString ? domainString.split(',') : ["moemail.app"]

    if (!domains || !domains.includes(domain)) {
      return NextResponse.json(
        { error: "无效的域名" },
        { status: 400 }
      )
    }

    const address = `${name || nanoid(8)}@${domain}`
    const existingEmail = await db.query.emails.findFirst({
      where: eq(sql`LOWER(${emails.address})`, address.toLowerCase())
    })

    if (existingEmail) {
      if (existingEmail.userId === userId) {
        return NextResponse.json(
          { error: "该邮箱已经属于你的账户", code: "ALREADY_OWNER" },
          { status: 409 }
        )
      }

      if (!forceTransfer || !adminPassword) {
        return NextResponse.json(
          { error: "该邮箱已被占用", code: "EMAIL_IN_USE" },
          { status: 409 }
        )
      }

      if (!await verifyTransferPassword(
        db,
        adminPassword,
        env.ADMIN_TRANSFER_PASSWORD || process.env.ADMIN_TRANSFER_PASSWORD
      )) {
        return NextResponse.json(
          { error: "管理员密码错误", code: "ADMIN_PASSWORD_INVALID" },
          { status: 403 }
        )
      }

      const now = new Date()
      const expires = expiryTime === 0
        ? PERMANENT_EXPIRY
        : new Date(now.getTime() + expiryTime)

      await db.update(emails)
        .set({ userId: userId!, expiresAt: expires })
        .where(eq(emails.id, existingEmail.id))

      try {
        await removeReceivedMailboxId(env.SITE_CONFIG, existingEmail.id)
      } catch (error) {
        console.error("Failed to remove transferred mailbox subscription:", error)
      }

      return NextResponse.json({
        id: existingEmail.id,
        email: existingEmail.address,
        transferred: true,
      })
    }

    if (userRole !== ROLES.EMPEROR) {
      const maxEmails = await env.SITE_CONFIG.get("MAX_EMAILS") || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString()
      const activeEmailsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(
          and(
            eq(emails.userId, userId!),
            gt(emails.expiresAt, new Date())
          )
        )

      if (Number(activeEmailsCount[0].count) >= Number(maxEmails)) {
        return NextResponse.json(
          { error: `已达到最大邮箱数量限制 (${maxEmails})` },
          { status: 403 }
        )
      }
    }

    const now = new Date()
    const expires = expiryTime === 0
      ? PERMANENT_EXPIRY
      : new Date(now.getTime() + expiryTime)
    
    const emailData: typeof emails.$inferInsert = {
      address,
      createdAt: now,
      expiresAt: expires,
      userId: userId!
    }
    
    const result = await db.insert(emails)
      .values(emailData)
      .returning({ id: emails.id, address: emails.address })
    
    return NextResponse.json({ 
      id: result[0].id,
      email: result[0].address 
    })
  } catch (error) {
    console.error('Failed to generate email:', error)
    return NextResponse.json(
      { error: "创建邮箱失败" },
      { status: 500 }
    )
  }
}
