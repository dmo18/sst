import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestOwnership } from '../requestOwnership.ts';
test('Strict Mode cleanup synchronously permits a replacement request', () => { const owner = new RequestOwnership(); const first = owner.begin()!; owner.cancel(); const second = owner.begin()!; assert.equal(first.controller.signal.aborted, true); assert.equal(owner.owns(second.controller, second.sequence), true); });
test('manual and scheduled requests cannot overlap', () => { const owner = new RequestOwnership(); assert.ok(owner.begin()); assert.equal(owner.begin(), undefined); });
test('old completion cannot clear or own a newer request', () => { const owner = new RequestOwnership(); const old = owner.begin()!; owner.cancel(); const next = owner.begin()!; owner.finish(old.controller); assert.equal(owner.owns(next.controller, next.sequence), true); });
