import assert from "node:assert/strict"
import { test } from "node:test"
import {
  adminMailboxRegistrationSchema,
  getConfiguredEmailDomains,
  isConfiguredEmailDomain,
} from "../app/lib/validation"
import {
  addReceivedMailboxId,
  getReceivedMailboxIds,
  removeReceivedMailboxId,
} from "../app/lib/emperor-mailboxes"

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

test("emperor mailbox subscriptions can be added and removed without touching mailboxes", async () => {
  const values = new Map<string, string>()
  const kv = {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => { values.set(key, value) },
  } as unknown as KVNamespace

  await addReceivedMailboxId(kv, "mailbox-1")
  await addReceivedMailboxId(kv, "mailbox-1")
  assert.deepEqual(await getReceivedMailboxIds(kv), ["mailbox-1"])

  await removeReceivedMailboxId(kv, "mailbox-1")
  assert.deepEqual(await getReceivedMailboxIds(kv), [])
})
