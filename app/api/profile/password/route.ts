import { auth } from "@/lib/auth"
import { createDb } from "@/lib/db"
import { users } from "@/lib/schema"
import { comparePassword, hashPassword } from "@/lib/utils"
import { changePasswordSchema } from "@/lib/validation"
import { eq } from "drizzle-orm"

export const runtime = "edge"

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

  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid password" }, { status: 400 })
  }

  try {
    const db = createDb()
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { password: true },
    })

    if (!user?.password) {
      return Response.json({ error: "Password unavailable" }, { status: 409 })
    }

    const isCurrentPasswordValid = await comparePassword(
      parsed.data.currentPassword,
      user.password
    )
    if (!isCurrentPasswordValid) {
      return Response.json({ error: "Incorrect current password" }, { status: 403 })
    }

    await db.update(users)
      .set({ password: await hashPassword(parsed.data.newPassword) })
      .where(eq(users.id, session.user.id))

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to change password:", error)
    return Response.json({ error: "Failed to change password" }, { status: 500 })
  }
}
