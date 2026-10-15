const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const dir=process.env.MAESTRO_DIR || require('path').join(__dirname,'..');
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace(/<link rel="stylesheet"[^>]*>/,'')
 .replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(path.join(dir,f),'utf8')+'</script>');
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'http://localhost/'});
const {window}=dom;window.addEventListener('error',e=>errors.push('window.error: '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(400);
  const E=window.eval('Engine'),doc=window.document;
  const ok=m=>console.log('ok:',m),fail=m=>errors.push(m);
  E.pause();
  // MANAGER IGNORES EVERYTHING
  while(E.state.t<1320){ E.advance(5); await sleep(8); }
  const s=E.state;
  console.log('   flags:',JSON.stringify(s.flags),'| towelLowest:',s.stats.towelLowest,'| maxWait:',s.stats.maxWait,'| hiit:',s.classes.find(c=>c.id==='hiit').status);
  s.flags.includes('towel-out')?ok('towel crisis surfaced'):fail('no towel crisis');
  s.flags.includes('queue')?ok('check-in queue crisis surfaced'):fail('no queue crisis');
  s.flags.includes('t03-crit')?ok('T-03 severe risk surfaced'):fail('no T-03 risk flag');
  s.classes.find(c=>c.id==='hiit').status==='cancelled'?ok('class cancelled without approval'):fail('class status '+s.classes.find(c=>c.id==='hiit').status);
  const flagsShown=doc.querySelectorAll('#flags .flag').length;
  flagsShown>=2?ok('crisis banners visible on ops board ('+flagsShown+')'):fail('banners not rendered: '+flagsShown);
  const badTiles=doc.querySelectorAll('#equipment-grid .eq-tile.bad').length;
  badTiles>=1?ok('equipment failure visible in DOM'):fail('no bad equipment tile');
  // brief in the failure branch
  doc.querySelector('#btn-brief').click(); await sleep(500);
  const bl=doc.querySelector('.brief-bullets').textContent;
  bl.includes('⚠')?ok('brief reflects the towel failure'):fail('brief does not reflect failure');
  console.log('   brief snippet:',bl.slice(0,140).replace(/\s+/g,' '));
  if(errors.length){console.log('\nERRORS:\n'+errors.join('\n'));process.exitCode=1;}else console.log('\nCRISIS BRANCH: ALL PASS ✔');
  window.close();
})();
