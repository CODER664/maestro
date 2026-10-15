const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const dir=process.env.MAESTRO_DIR || require('path').join(__dirname,'..');
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
html=html.replace(/<link rel="stylesheet"[^>]*>/,'');
html=html.replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(path.join(dir,f),'utf8')+'</script>');
const errors=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push('jsdomError: '+e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'http://localhost/'});
const {window}=dom;
window.addEventListener('error',e=>errors.push('window.error: '+e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(400);
  const E=window.eval('Engine'); const ok=m=>console.log('ok:',m); const fail=m=>errors.push(m);
  const doc=window.document;
  // play/pause button sanity, then drive the clock deterministically
  doc.querySelector('#btn-play').click(); await sleep(50);
  E.state.running?ok('play button starts clock'):fail('play did not start');
  E.pause();
  let edited=false;
  while(E.state.t<1320){
    E.advance(3);
    await sleep(12); // let async conductor/promises settle
    const pend=E.state.approvals[0];
    if(pend){
      for(const a of [...pend.actions]){
        if(a.decision) continue;
        if(!edited && a.effect && a.effect.type==='restock_towels'){
          const edBtn=doc.querySelector(`[data-edit="${pend.id}"][data-action="${a.id}"]`);
          if(edBtn){
            edBtn.click(); await sleep(10);
            const field=doc.querySelector(`#edit-${pend.id}-${a.id} .edit-field[data-k="qty"]`);
            if(field){ field.value='100'; doc.querySelector(`[data-saveedit="${pend.id}"][data-action="${a.id}"]`).click(); edited=true; ok('edit flow: towel qty changed to 100 & approved'); }
            else fail('edit field not found');
          } else fail('edit button not found');
        } else {
          const btn=doc.querySelector(`[data-approve="${pend.id}"][data-action="${a.id}"]`);
          if(btn) btn.click(); else E.decide(pend.id,a.id,'approved');
        }
        await sleep(10);
      }
    }
    // exercise the guest chat once after check-in
    if(E.state.guest.checkedIn && !global.__asked){
      global.__asked=true;
      const input=doc.querySelector('#guest-input');
      input.value='It is freezing in the sauna and I would like two fresh towels';
      doc.querySelector('#guest-send').click();
      await sleep(300);
      ok('guest request sent through concierge UI');
    }
  }
  await sleep(200);
  console.log('   reached:',E.fmt(E.state.t),'| edited:',edited);
  E.state.t>=1319?ok('simulation ran to 22:00 close'):fail('did not reach close, t='+E.fmt(E.state.t));
  const s=E.state;
  console.log('   stats:',JSON.stringify({proposed:s.stats.actionsProposed,approved:s.stats.approved,edited:s.stats.edited,checkedIn:s.stats.checkedIn,maxWait:s.stats.maxWait,towelLowest:s.stats.towelLowest,classSaved:s.stats.classSaved,flags:s.flags}));
  s.stats.edited>=1?ok('edited stat recorded'):fail('edited stat missing');
  !s.flags.includes('towel-out')?ok('no towel crisis all evening'):fail('towel-out flag present');
  // evening brief modal via button
  doc.querySelector('#btn-brief').click(); await sleep(600);
  doc.querySelector('#brief-modal').classList.contains('open')?ok('brief modal opened'):fail('brief modal not open');
  const headline=doc.querySelector('.brief-headline');
  headline&&headline.textContent?ok('brief headline in DOM: "'+headline.textContent.slice(0,60)+'"'):fail('no headline rendered');
  doc.querySelector('#btn-close-brief').click(); await sleep(30);
  // guest pane final state
  const msgs=doc.querySelectorAll('#guest-feed .msg').length;
  console.log('   guest messages:',msgs);
  msgs>=3?ok('guest conversation rich ('+msgs+' msgs)'):fail('too few guest msgs');
  const log=doc.querySelectorAll('#log .log-row').length;
  log>10?ok('activity feed populated ('+log+' rows)'):fail('activity feed thin');
  if(errors.length){console.log('\nERRORS:\n'+errors.join('\n'));process.exitCode=1;}else console.log('\nFULL-EVENING RUN: ALL PASS ✔');
  window.close();
})();
