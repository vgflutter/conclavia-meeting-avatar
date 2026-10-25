import 'server-only';
import {TgWorkerModel} from '@/models/tg/TgWorker';
import {TgControllerModel} from '@/models/tg/TgController';
import {tgReadiness} from './readiness';
import type {TgProduct} from './types';

export async function productionRuntime(now=new Date()){
  const [worker,controller]=await Promise.all([
    TgWorkerModel.findOne().sort({heartbeatAt:-1}).select('heartbeatAt phase jobId lastErrorAt').lean(),
    TgControllerModel.findOne({key:'daily-production'}).lean(),
  ]);
  return {
    worker:{online:Boolean(worker&&now.getTime()-worker.heartbeatAt.getTime()<90000),lastSeen:worker?.heartbeatAt.toISOString(),phase:worker?.phase,jobId:worker?.jobId,lastErrorAt:worker?.lastErrorAt?.toISOString()},
    controller:{online:Boolean(controller&&now.getTime()-controller.heartbeatAt.getTime()<180000),lastSeen:controller?.heartbeatAt.toISOString(),mode:controller?.mode,driver:controller?.driver,lastDate:controller?.lastDate,lastState:controller?.lastState,lastFinishedAt:controller?.lastFinishedAt?.toISOString()},
  };
}
export function readinessWithRuntime(product:TgProduct,runtime:{worker:{online:boolean};controller:{online:boolean}}){
  const readiness=tgReadiness(product),scoped=product.productionStandard==='cdaily-v1'&&product.publicationDriver==='chatgpt-work';
  const checks=readiness.checks.map(c=>c.id==='worker'?{...c,ready:c.ready&&(scoped?runtime.controller.online:runtime.worker.online)}:c);
  return {...readiness,checks,editorialReady:readiness.editorialConfigured&&Boolean(checks.find(c=>c.id==='worker')?.ready),
    productionReady:!readiness.mediaDeferred&&checks.every(c=>c.ready)&&(product.siteFirst||readiness.channels.every(c=>c.ready))};
}
