import assert from 'node:assert/strict';
import {test} from 'node:test';
import {firstMacCommissionProduct} from '../../src/lib/tg/manual-commission';
import {reviewFixture} from './fixtures';
import type {TgJob} from '../../src/lib/tg/types';
const now=new Date('2026-10-25T08:15:22Z');
function candidate(){const old=reviewFixture(now);return {...old,date:'2026-10-25',state:'blocked',product:{...old.product,productionMode:'editorial',timezone:'Europe/Rome'},research:undefined,script:undefined,audit:undefined,scriptReview:undefined,manifest:undefined,assets:[],approvedAt:undefined,review:undefined,finalReview:undefined,sitePublication:undefined,deliveries:[],attempts:1,editorialRepairs:0,durationRepairs:0} as TgJob;}
test('an explicit first Mac window changes only the candidate and preserves the daily calendar',()=>{
 const job=candidate(),regular={...job.product,productionMode:'full' as const,productionTime:'07:30',publishTime:'08:15'};
 const product=firstMacCommissionProduct(job,regular,now);
 assert.equal(product.productionTime,'09:15');assert.equal(product.publishTime,'10:00');assert.equal(product.productionMode,'full');
 assert.equal(regular.productionTime,'07:30');assert.equal(regular.publishTime,'08:15');assert.equal(job.attempts,1);assert.equal(job.state,'blocked');
});
test('commissioning never reopens a reviewed, paid, exhausted, published or previous-day edition',()=>{
 for(const patch of [{script:{}},{audit:{passed:false}},{research:{}},{manifest:{}},{assets:[{}]},{attempts:3},{editorialRepairs:1},{sitePublication:{}},{date:'2026-10-24'},{product:{...candidate().product,productionMode:'full'}}]){
  const job={...candidate(),...patch} as TgJob;assert.throws(()=>firstMacCommissionProduct(job,candidate().product,now));
 }
 assert.throws(()=>firstMacCommissionProduct({...candidate(),date:'2026-10-25'},candidate().product,new Date('2026-10-25T22:20:00Z')));
});
