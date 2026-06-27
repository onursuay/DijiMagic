import assert from 'node:assert/strict'
import { isAgenticEnabled } from '../lib/website/agenticFlag.mjs'

const prev = process.env.WEBSITE_AGENTIC
process.env.WEBSITE_AGENTIC = '0'
assert.equal(isAgenticEnabled(), false, 'FAIL: 0 iken false (byte-aynı korunur)')
delete process.env.WEBSITE_AGENTIC
assert.equal(isAgenticEnabled(), false, 'FAIL: tanımsız iken false')
process.env.WEBSITE_AGENTIC = '1'
assert.equal(isAgenticEnabled(), true, 'FAIL: 1 iken true')
process.env.WEBSITE_AGENTIC = prev
console.log('agenticFlag OK')
