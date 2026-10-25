import {spawn} from 'node:child_process';

/** Stop the whole owned worker tree on deadline or LaunchAgent shutdown. */
export function runMacCommand(file,args,{cwd,env,inherit=false,timeout=0,signal}={}) {
 return new Promise((ok,fail)=>{
  if(signal?.aborted){fail(Error('Produttore interrotto'));return;}
  const grouped=process.platform!=='win32';
  const child=spawn(file,args,{cwd,env,detached:grouped,stdio:['ignore',inherit?'inherit':'pipe','ignore']});
  let out='',stopped=false,killTimer;
  const signalOwned=value=>{try{if(grouped&&child.pid)process.kill(-child.pid,value);else child.kill(value);}catch{}};
  const stop=()=>{
   if(stopped)return;
   stopped=true;signalOwned('SIGTERM');
   killTimer=setTimeout(()=>signalOwned('SIGKILL'),5000);killTimer.unref();
  };
  const timer=timeout?setTimeout(stop,timeout):undefined;
  signal?.addEventListener('abort',stop,{once:true});
  const cleanup=()=>{
   // The direct child can exit before its descendants; terminate any survivors.
   if(stopped)signalOwned('SIGKILL');
   clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',stop);
  };
  child.stdout?.on('data',bytes=>{out=(out+String(bytes)).slice(-100000);});
  child.once('error',()=>{cleanup();fail(Error('Prerequisito non disponibile'));});
  child.once('close',code=>{cleanup();if(code===0&&!stopped)ok(out.trim());else fail(Error('Comando non completato; consultare lo stato privato'));});
 });
}
