import { checkPermission } from "@/lib/auth"
import { getUserId } from "@/lib/apiKey"
import { createDb } from "@/lib/db"
import { PERMISSIONS, ROLES } from "@/lib/permissions"
import { users } from "@/lib/schema"
import { hashPassword } from "@/lib/utils"
import { resetPasswordSchema } from "@/lib/validation"
import { eq } from "drizzle-orm"

export const runtime = "edge"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkPermission(PERMISSIONS.PROMOTE_USER)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: userId } = await params
  if (!userId || userId === await getUserId()) {
    return Response.json({ error: "Invalid user" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid password" }, { status: 400 })
  }

  try {
    const db = createDb()
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
    if (targetUser.userRoles.some(({ role }) => role.name === ROLES.EMPEROR)) {
      return Response.json({ error: "Cannot reset emperor password" }, { status: 400 })
    }
    if (!targetUser.username) {
      return Response.json({ error: "Password unavailable" }, { status: 409 })
    }

    await db.update(users)
      .set({ password: await hashPassword(parsed.data.newPassword) })
      .where(eq(users.id, userId))

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to reset user password:", error)
    return Response.json({ error: "Failed to reset password" }, { status: 500 })
  }
}
