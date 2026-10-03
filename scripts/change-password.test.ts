import assert from "node:assert/strict"
import { test } from "node:test"
import {
  changePasswordSchema,
  resetPasswordSchema,
  updateAccountSchema,
  adminUpdateCredentialsSchema,
} from "../app/lib/validation"
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

test("updateAccountSchema allows modifying username, password, or both", () => {
  // Changing only username
  assert.equal(updateAccountSchema.safeParse({
    username: "emperor_new",
  }).success, true)

  // Changing only password
  assert.equal(updateAccountSchema.safeParse({
    newPassword: "newpassword123",
  }).success, true)

  // Changing both username and password
  assert.equal(updateAccountSchema.safeParse({
    username: "emperor_user",
    newPassword: "newpassword123",
  }).success, true)

  // Invalid username (email format not allowed)
  assert.equal(updateAccountSchema.safeParse({
    username: "emperor@mail.com",
  }).success, false)

  // Invalid username (special chars)
  assert.equal(updateAccountSchema.safeParse({
    username: "emperor#123",
  }).success, false)

  // Invalid password (too short)
  assert.equal(updateAccountSchema.safeParse({
    newPassword: "short",
  }).success, false)

  // Admin update credentials schema allows username and/or newPassword
  assert.equal(adminUpdateCredentialsSchema.safeParse({
    username: "emperor_boss",
    newPassword: "strongpassword123",
  }).success, true)

  assert.equal(adminUpdateCredentialsSchema.safeParse({
    username: "valid_name",
  }).success, true)
})

