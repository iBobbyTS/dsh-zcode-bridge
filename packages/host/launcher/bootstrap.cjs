// This entry must have no application/dependency imports before installing failure handlers.
// A static ESM import failure otherwise reaches Electron's default native error dialog.
const { app, BrowserWindow, webContents } = require('electron');
const { writeSync, readFileSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
let windowEvents=0,failed=false,shutdown;
function fail(error) {
  if(failed)return;failed=true;
  const code=typeof error?.code==='string'&&/^[A-Z0-9_-]+$/.test(error.code)?error.code:'LAUNCHER_UNCAUGHT_EXCEPTION';
  // No raw message/stack/URL/token is emitted. Structured bootstrap errors survive immediate exit.
  const state={phase:'failed',channelAvailable:false,services:[],reason:code,bootstrapFailure:true,mainPid:process.pid,headless:{windowEvents,windows:BrowserWindow.getAllWindows().length,webContents:webContents.getAllWebContents().length}};
  writeSync(1,JSON.stringify({type:'launcher-state',state})+'\n');
  if(shutdown){Promise.resolve(shutdown(2)).catch(()=>app.exit(2));}else app.exit(2);
}
process.on('uncaughtException',fail);
process.on('unhandledRejection',fail);
app.setActivationPolicy('prohibited');
app.on('browser-window-created',()=>{windowEvents++;fail({code:'WINDOW_CREATION_DENIED'})});
app.on('web-contents-created',()=>fail({code:'WEBCONTENTS_CREATION_DENIED'}));
try {
  const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
  app.setName('DSH ZCode Host');app.disableHardwareAcceleration();
  for(const key of ['home','appData','userData','sessionData','logs','temp','crashDumps','desktop','documents','downloads','music','pictures','videos'])app.setPath(key,config.paths[key]);
  app.commandLine.appendSwitch('no-sandbox');app.commandLine.appendSwitch('disable-background-networking');app.commandLine.appendSwitch('disable-crash-reporter');
}catch(error){fail(error);}
// No caller supplied module name. Failure injection tests copy this entry into scratch with
// a main.mjs containing a missing import; the production entry always loads its sibling.
if(!failed)import(pathToFileURL(path.join(__dirname,'main.mjs')).href).then(module=>{shutdown=module.stop}).catch(fail);
