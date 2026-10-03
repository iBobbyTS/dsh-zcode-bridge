import {build} from 'esbuild';

const common={entryPoints:['packages/client/client.jsx'],bundle:true,external:['react','@deepseek-ai/*'],platform:'browser'};
// DSH loads classic scripts and materializes factories through its module table.
// The ESM artifact is for Node/jsdom checks, not the browser plugin export.
await build({...common,format:'esm',outfile:'packages/client/lib/client-test.mjs'});
await build({...common,format:'cjs',outfile:'packages/client/lib/client.js',
  banner:{js:'window.__ModuleLoader__.load({id:"@dsh-zcode/bridge-client",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},
  footer:{js:'return module.exports;}});'},
});
