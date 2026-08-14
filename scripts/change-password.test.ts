import assert from "node:assert/strict"
import { test } from "node:test"
import { changePasswordSchema, resetPasswordSchema } from "../app/lib/validation"

test("change password input requires the current password and an 8-character new password", () => {
  assert.equal(changePasswordSchema.safeParse({
    currentPassword: "old-password",
    newPassword: "new-password",
  }).success, true)

  assert.equal(changePasswordSchema.safeParse({
    currentPassword: "",
    newPassword: "short",
  }).success, false)

  assert.equal(resetPasswordSchema.safeParse({
    newPassword: "admin-reset-password",
  }).success, true)

  assert.equal(resetPasswordSchema.safeParse({
    newPassword: "short",
  }).success, false)
})
