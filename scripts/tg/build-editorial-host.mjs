import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const directory='.daily-agent/editorial-host';
await mkdir(directory,{recursive:true,mode:0o700});
const result=await build({entryPoints:['scripts/tg/editorial-host.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',conditions:['react-server'],
  outfile:directory+'/editorial-host.cjs',metafile:true,logLevel:'silent',
  external:['kerberos','@mongodb-js/zstd','@aws-sdk/credential-providers','snappy','mongodb-client-encryption','gcp-metadata','socks','aws4']});
const inputs=Object.keys(result.metafile.inputs);
if(inputs.some(x=>/\/tg\/(?:media\.ts|alex2-speech|publishers|metricool|final-review\.ts)/u.test(x)))throw Error('Media or publisher implementation in editorial host');
await writeFile(directory+'/inputs.json',JSON.stringify(inputs,null,2),{mode:0o600});
console.log(JSON.stringify({built:true,media:false,publishing:false}));
