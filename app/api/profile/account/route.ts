import { auth } from "@/lib/auth"
import { createDb } from "@/lib/db"
import { users } from "@/lib/schema"
import { ROLES } from "@/lib/permissions"
import { comparePassword, hashPassword } from "@/lib/utils"
import { updateAccountSchema } from "@/lib/validation"
import { and, eq, ne, sql } from "drizzle-orm"

export const runtime = "edge"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createDb()
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, username: true, email: true, name: true, image: true, password: true },
    with: {
      userRoles: {
        with: { role: true },
      },
    },
  })

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  const isEmperor = user.userRoles.some((ur) => ur.role.name === ROLES.EMPEROR)

  return Response.json({
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    image: user.image,
    hasPassword: Boolean(user.password),
    isEmperor,
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = updateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "输入格式不正确" }, { status: 400 })
  }

  const { username, currentPassword, newPassword } = parsed.data
  if (!username && !newPassword) {
    return Response.json({ error: "未做任何修改" }, { status: 400 })
  }

  const db = createDb()
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    with: {
      userRoles: {
        with: { role: true },
      },
    },
  })

  if (!currentUser) {
    return Response.json({ error: "用户不存在" }, { status: 404 })
  }

  const isEmperor = currentUser.userRoles.some((ur) => ur.role.name === ROLES.EMPEROR)
  const updateData: { username?: string; password?: string } = {}

  // 1. 处理用户名更新
  if (username && username !== currentUser.username) {
    const existing = await db.query.users.findFirst({
      where: and(
        ne(users.id, session.user.id),
        sql`LOWER(${users.username}) = LOWER(${username})`
      ),
    })

    if (existing) {
      return Response.json({ error: "该账户名已被占用" }, { status: 409 })
    }

    updateData.username = username
  }

  // 2. 处理密码更新
  if (newPassword) {
    if (currentUser.password) {
      if (currentPassword) {
        const isCurrentValid = await comparePassword(currentPassword, currentUser.password)
        if (!isCurrentValid) {
          return Response.json({ error: "当前密码错误" }, { status: 403 })
        }
      } else if (!isEmperor) {
        return Response.json({ error: "请输入当前密码" }, { status: 403 })
      }
    }
    updateData.password = await hashPassword(newPassword)
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ message: "未做任何更改", success: true })
  }

  await db.update(users)
    .set(updateData)
    .where(eq(users.id, session.user.id))

  return Response.json({
    success: true,
    username: updateData.username || currentUser.username,
    passwordUpdated: Boolean(updateData.password),
  })
}
