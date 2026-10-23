import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TG_PRODUCTS } from '../../src/lib/tg/config';
import { dueSlot, editionInstant, editionSlot, scheduleCalendar } from '../../src/lib/tg/schedule';
import { reviewFixture } from './fixtures';

test('the same calendar and worker resolve Rome clocks across both DST changes',()=>{
 assert.equal(editionInstant('2026-10-24','19:15','Europe/Rome').at.toISOString(),'2026-10-24T17:15:00.000Z');
 assert.equal(editionInstant('2026-10-25','19:15','Europe/Rome').at.toISOString(),'2026-10-25T18:15:00.000Z');
 assert.deepEqual(editionInstant('2026-10-25','02:30','Europe/Rome'),{at:new Date('2026-10-25T00:30:00Z'),adjusted:true});
 assert.deepEqual(editionInstant('2026-03-29','02:30','Europe/Rome'),{at:new Date('2026-03-29T01:00:00Z'),adjusted:true});
 assert.equal(editionInstant('2026-10-20','10:00','Asia/Kathmandu').at.toISOString(),'2026-10-20T04:15:00.000Z');
});
test('midnight production uses the next edition date rather than the preparation date',()=>{
 const product={...TG_PRODUCTS[0],enabled:true,publishTime:'00:15'};
 const slot=dueSlot(product,new Date('2026-10-19T21:45:00Z'));
 assert.equal(slot?.date,'2026-10-20');assert.equal(slot?.prepareAt,'2026-10-19T21:30:00.000Z');assert.equal(slot?.scheduledAt,'2026-10-19T22:15:00.000Z');
 assert.equal(dueSlot(product,new Date('2026-10-19T21:29:59Z')),undefined);
 assert.equal(dueSlot(product,new Date('2026-10-19T22:45:01Z')),undefined);
});
test('a late restart cannot queue old news; disabled schedules remain a preview',()=>{
 const product={...TG_PRODUCTS[0],enabled:true};
 assert.ok(dueSlot(product,new Date('2026-10-20T17:30:00Z')));
 assert.equal(dueSlot(product,new Date('2026-10-20T19:00:00Z')),undefined);
 assert.equal(dueSlot({...product,enabled:false},new Date('2026-10-20T17:30:00Z')),undefined);
 const now=new Date('2026-10-20T12:00:00Z'),calendar=scheduleCalendar(TG_PRODUCTS,[],now);
 assert.equal(calendar.length,14);assert.equal(calendar.every(s=>!s.enabled&&!s.jobId),true);
 assert.equal(calendar.find(s=>s.date==='2026-10-25'&&s.edition==='it')?.scheduledAt,'2026-10-25T18:15:00.000Z');
});
test('changing programme settings does not shift an existing edition snapshot',()=>{
 const now=new Date('2026-10-20T12:00:00Z'),job=reviewFixture(now);
 job.product.publishTime='15:00';job.publicationPlan={platforms:['youtube'],scheduledAt:'2026-10-20T15:10:00.000Z'};
 const [slot]=scheduleCalendar([{...job.product,publishTime:'23:00'}],[job],now,1);
 assert.equal(slot.scheduledAt,job.publicationPlan.scheduledAt);assert.equal(slot.jobId,job.id);
 assert.equal(slot.prepareAt,editionSlot(job.product,job.date).prepareAt);
});
