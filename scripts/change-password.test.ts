import assert from "node:assert/strict"
import { test } from "node:test"
import { changePasswordSchema, resetPasswordSchema } from "../app/lib/validation"
import { getPasswordVersion, isPasswordVersionValid } from "../app/lib/utils"

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

test("password sessions are valid only for the current password version", async () => {
  const currentVersion = await getPasswordVersion("current-password-hash")
  const oldVersion = await getPasswordVersion("old-password-hash")

  assert.equal(isPasswordVersionValid(currentVersion, currentVersion), true)
  assert.equal(isPasswordVersionValid(oldVersion, currentVersion), false)
  assert.equal(isPasswordVersionValid(undefined, currentVersion), false)
})
