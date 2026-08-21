import assert from "node:assert/strict"
import { test } from "node:test"
import {
  adminMailboxRegistrationSchema,
  getConfiguredEmailDomains,
  isConfiguredEmailDomain,
} from "../app/lib/validation"

test("admin mailbox registration normalizes addresses and restricts configured domains", () => {
  const { address } = adminMailboxRegistrationSchema.parse({
    address: " Admin@Example.COM ",
  })

  assert.equal(address, "admin@example.com")
  assert.deepEqual(getConfiguredEmailDomains(" mail.example.com, Example.COM "), [
    "mail.example.com",
    "example.com",
  ])
  assert.equal(isConfiguredEmailDomain(address, "mail.example.com,example.com"), true)
  assert.equal(isConfiguredEmailDomain("admin@other.com", "example.com"), false)
  assert.equal(adminMailboxRegistrationSchema.safeParse({ address: "not-an-email" }).success, false)
})
