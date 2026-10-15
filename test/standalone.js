const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const file=path.join(process.env.MAESTRO_DIR || require('path').join(__dirname,'..'),'maestro-standalone.html');
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'http://localhost/'});
const {window}=dom;window.addEventListener('error',e=>errors.push('window.error: '+e.message));
// simulate sandbox: kill localStorage
Object.defineProperty(window,'localStorage',{get(){throw new Error('SecurityError: storage blocked');}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(400);
  const E=window.eval('Engine');const doc=window.document;
  if(!E||!E.state){console.log('FAIL: engine dead without localStorage');process.exit(1);}
  console.log('ok: standalone boots with localStorage blocked');
  // open settings & save (memory-only path)
  doc.querySelector('#btn-settings').click();
  doc.querySelector('#set-mode').value='baked';
  doc.querySelector('#btn-save-settings').click();
  await sleep(50);
  console.log('ok: settings saved via memory fallback, mode =',window.eval('AI.settings().mode'));
  E.advance(11); await sleep(400);
  const acts=doc.querySelectorAll('#approval-queue .action').length;
  acts>=3?console.log('ok: conductor card rendered ('+acts+' actions) without network/storage'):(errors.push('no actions'),0);
  if(errors.length){console.log('ERRORS:',errors);process.exitCode=1;}else console.log('STANDALONE: ALL PASS ✔');
  window.close();
})();
