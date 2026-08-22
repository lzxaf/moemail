const RECEIVED_MAILBOX_IDS_KEY = "EMPEROR_RECEIVED_MAILBOX_IDS"

export function parseReceivedMailboxIds(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))]
  } catch {
    return []
  }
}

export async function getReceivedMailboxIds(kv: KVNamespace) {
  return parseReceivedMailboxIds(await kv.get(RECEIVED_MAILBOX_IDS_KEY))
}

export async function addReceivedMailboxId(kv: KVNamespace, mailboxId: string) {
  // ponytail: one emperor writes rarely; use a D1 join table if concurrent admins become a real need.
  const ids = await getReceivedMailboxIds(kv)
  if (!ids.includes(mailboxId)) {
    await kv.put(RECEIVED_MAILBOX_IDS_KEY, JSON.stringify([...ids, mailboxId]))
  }
}

export async function removeReceivedMailboxId(kv: KVNamespace, mailboxId: string) {
  const ids = await getReceivedMailboxIds(kv)
  await kv.put(RECEIVED_MAILBOX_IDS_KEY, JSON.stringify(ids.filter((id) => id !== mailboxId)))
}
