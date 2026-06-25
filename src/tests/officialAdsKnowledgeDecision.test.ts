/**
 * Official Ads Knowledge Decision — Unit Tests
 * Çalıştırma: npx tsx src/tests/officialAdsKnowledgeDecision.test.ts
 * supabase thenable mock ile onay/ret/versiyonlama doğrulanır.
 */
import assert from 'assert'
import {
  listPendingKnowledge,
  approveKnowledgeItem,
  rejectKnowledgeItem,
} from '../../lib/dijimagic/officialAdsKnowledgeDecision'

let passed = 0
let failed = 0
const queue: Array<() => Promise<void>> = []
function test(name: string, fn: () => void | Promise<void>): void {
  queue.push(async () => {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
      passed++
    } catch (e) {
      console.error(`  ✗ ${name}`)
      console.error(`    ${e instanceof Error ? e.message : e}`)
      failed++
    }
  })
}

interface UpdateRec {
  set: any
  filters: Record<string, any>
}

function makeDb(selectResponses: Array<{ data: any[] }>) {
  const updates: UpdateRec[] = []
  let selIdx = 0

  const selectChain = () => {
    let done = false
    const resp = selectResponses[selIdx] ?? { data: [] }
    const chain: any = {
      eq: () => chain,
      in: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: any) => {
        if (done) return
        done = true
        selIdx++
        resolve({ data: resp.data, error: null })
      },
    }
    return chain
  }

  const updateChain = (set: any) => {
    let done = false
    const filters: Record<string, any> = {}
    const chain: any = {
      eq: (c: string, v: any) => { filters[`eq:${c}`] = v; return chain },
      in: (c: string, v: any) => { filters[`in:${c}`] = v; return chain },
      is: (c: string, v: any) => { filters[`is:${c}`] = v; return chain },
      then: (resolve: any) => {
        if (done) return
        done = true
        updates.push({ set, filters })
        resolve({ error: null })
      },
    }
    return chain
  }

  return {
    updates,
    from: () => ({ select: () => selectChain(), update: (set: any) => updateChain(set) }),
  }
}

const target = { id: 't1', platform: 'meta', normalized_key: 'meta.objective.x', version: 2, review_status: 'review_required' }

test('approve: bulunamayan id → not_found', async () => {
  const db = makeDb([{ data: [] }])
  const r = await approveKnowledgeItem(db, 't1', 'admin@x')
  assert.strictEqual(r.ok, false)
  assert.strictEqual(r.error, 'not_found')
  assert.strictEqual(db.updates.length, 0)
})

test('approve: review_required değilse → not_pending', async () => {
  const db = makeDb([{ data: [{ ...target, review_status: 'approved' }] }])
  const r = await approveKnowledgeItem(db, 't1', 'admin@x')
  assert.strictEqual(r.ok, false)
  assert.strictEqual(r.error, 'not_pending')
})

test('approve: önceki versiyonu emekliye ayırır + hedefi onaylar', async () => {
  const db = makeDb([{ data: [target] }])
  const r = await approveKnowledgeItem(db, 't1', 'admin@x')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(db.updates.length, 2)

  const deprecate = db.updates[0]
  assert.strictEqual(deprecate.set.review_status, 'deprecated')
  assert.ok(deprecate.set.effective_to, 'effective_to set edilmeli')
  assert.strictEqual(deprecate.filters['eq:normalized_key'], 'meta.objective.x')
  assert.ok(deprecate.filters['in:review_status'].includes('approved'))
  assert.strictEqual(deprecate.filters['is:effective_to'], null)

  const approve = db.updates[1]
  assert.strictEqual(approve.set.review_status, 'approved')
  assert.strictEqual(approve.set.approved_by, 'admin@x')
  assert.strictEqual(approve.set.effective_to, null)
  assert.strictEqual(approve.filters['eq:id'], 't1')
})

test('reject: deprecated yapar', async () => {
  const db = makeDb([])
  const r = await rejectKnowledgeItem(db, 't1')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(db.updates.length, 1)
  assert.strictEqual(db.updates[0].set.review_status, 'deprecated')
  assert.strictEqual(db.updates[0].filters['eq:id'], 't1')
})

test('listPending: taslak + yürürlükteki onaylı versiyonu (diff) eşler', async () => {
  const draft = { ...target, id: 'd1', summary: 'yeni' }
  const current = { ...target, id: 'c1', review_status: 'approved', summary: 'eski' }
  const db = makeDb([{ data: [draft] }, { data: [current] }])
  const entries = await listPendingKnowledge(db)
  assert.strictEqual(entries.length, 1)
  assert.strictEqual(entries[0].item.id, 'd1')
  assert.ok(entries[0].current)
  assert.strictEqual(entries[0].current!.id, 'c1')
})

test('listPending: taslak yoksa boş', async () => {
  const db = makeDb([{ data: [] }])
  const entries = await listPendingKnowledge(db)
  assert.strictEqual(entries.length, 0)
})

;(async () => {
  for (const t of queue) await t()
  console.log(`\n${passed + failed} test: ${passed} geçti, ${failed} başarısız`)
  if (failed > 0) process.exit(1)
})()
