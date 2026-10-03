import { checkPermission } from "@/lib/auth"
import { getUserId } from "@/lib/apiKey"
import { createDb } from "@/lib/db"
import { PERMISSIONS, ROLES } from "@/lib/permissions"
import { users, userRoles } from "@/lib/schema"
import { hashPassword } from "@/lib/utils"
import { adminUpdateCredentialsSchema } from "@/lib/validation"
import { and, eq, ne, sql } from "drizzle-orm"

export const runtime = "edge"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkPermission(PERMISSIONS.PROMOTE_USER)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: userId } = await params
  const currentUserId = await getUserId()
  if (!userId) {
    return Response.json({ error: "Invalid user" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = adminUpdateCredentialsSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 })
  }

  const { username, newPassword } = parsed.data
  if (!username && !newPassword) {
    return Response.json({ error: "No changes specified" }, { status: 400 })
  }

  try {
    const db = createDb()
    const callerRoles = currentUserId
      ? await db.query.userRoles.findMany({
          where: eq(userRoles.userId, currentUserId),
          with: { role: true },
        })
      : []
    const isCallerEmperor = callerRoles.some((ur) => ur.role.name === ROLES.EMPEROR)

    // 非皇帝用户不能通过管理接口修改自己的凭据
    if (userId === currentUserId && !isCallerEmperor) {
      return Response.json({ error: "Invalid user" }, { status: 400 })
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        userRoles: {
          with: { role: true },
        },
      },
    })

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    const isTargetEmperor = targetUser.userRoles.some(({ role }) => role.name === ROLES.EMPEROR)

    // 只有皇帝本人能修改皇帝凭据，公爵等其他管理员禁止修改皇帝
    if (isTargetEmperor && !isCallerEmperor) {
      return Response.json({ error: "Cannot reset emperor password" }, { status: 403 })
    }

    const updateData: { username?: string; password?: string } = {}

    if (username && username !== targetUser.username) {
      const existing = await db.query.users.findFirst({
        where: and(
          ne(users.id, userId),
          sql`LOWER(${users.username}) = LOWER(${username})`
        ),
      })
      if (existing) {
        return Response.json({ error: "该用户名已被占用" }, { status: 409 })
      }
      updateData.username = username
    }

    if (newPassword) {
      if (!targetUser.username && !updateData.username) {
        return Response.json({ error: "Password unavailable" }, { status: 409 })
      }
      updateData.password = await hashPassword(newPassword)
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ success: true, message: "No changes" })
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))

    return Response.json({
      success: true,
      username: updateData.username || targetUser.username,
      passwordUpdated: Boolean(updateData.password),
    })
  } catch (error) {
    console.error("Failed to update user credentials:", error)
    return Response.json({ error: "Failed to update user" }, { status: 500 })
  }
}
