const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const dir=process.env.MAESTRO_DIR || require('path').join(__dirname,'..');
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
// inline scripts & drop css link (server-less jsdom)
html=html.replace(/<link rel="stylesheet"[^>]*>/,'');
html=html.replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(path.join(dir,f),'utf8')+'</script>');
const errors=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>errors.push('jsdomError: '+e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'http://localhost/'});
const {window}=dom;
window.addEventListener('error',e=>errors.push('window.error: '+e.message));
setTimeout(async()=>{
  const fail=m=>errors.push(m); const ok=m=>console.log('ok:',m);
  try{
    if(window.document.readyState!=='complete') console.log('(readyState '+window.document.readyState+')');
    window.eval('typeof App!=="undefined" && App.boot && App.boot()');
    const E=window.eval('typeof Engine!=="undefined"?Engine:null');
    if(!E||!E.state)fail('Engine not initialised'); else ok('App.boot ran, Engine.state present');
    const clock=window.document.querySelector('#clock').textContent;
    clock!=='17:30'?fail('clock '+clock):ok('clock renders 17:30');
    const eq=window.document.querySelectorAll('#equipment-grid .eq-tile').length;
    eq!==6?fail('eq tiles '+eq):ok('6 equipment tiles rendered');
    const staff=window.document.querySelectorAll('#roster .staff-chip').length;
    staff!==8?fail('staff '+staff):ok('8 staff chips rendered');
    // beat A
    E.advance(11);
    await new Promise(r=>setTimeout(r,50));
    // conductor runs async (offline fallback resolves immediately) — wait a beat
    await new Promise(r=>setTimeout(r,300));
    const cards=window.document.querySelectorAll('#approval-queue .action').length;
    cards<3?fail('approval actions in DOM: '+cards):ok('approval card rendered '+cards+' actions (offline conductor)');
    const cardState=E.state.approvals[0];
    if(cardState){ cardState.actions.forEach(a=>E.decide(cardState.id,a.id,'approved')); }
    await new Promise(r=>setTimeout(r,50));
    const off=window.document.querySelector('#equipment-grid .eq-tile.bad .eq-id');
    !off?fail('T-03 not offline in DOM'):ok('T-03 offline visible ('+off.textContent+')');
    const moved=window.document.querySelector('.staff-chip.moved');
    !moved?fail('Priya reassignment not shown'):ok('Priya shown moved to Front Desk: '+moved.textContent.trim().slice(0,40));
    // guest
    E.advance(25);
    await new Promise(r=>setTimeout(r,400)); // chan-arrives → app calls chanCheckIn
    const msgs=window.document.querySelectorAll('#guest-feed .msg').length;
    !msgs?fail('guest welcome missing'):ok('guest welcome rendered ('+msgs+' msgs)');
    const lockHidden=window.document.querySelector('#guest-lock').classList.contains('hidden');
    !lockHidden?fail('phone still locked'):ok('phone unlocked after check-in');
    // concierge
    const res=await window.eval('AI.concierge("The sauna feels cold and I need towels",[])');
    !res.reply?fail('no concierge reply'):ok('concierge reply: "'+res.reply.slice(0,60)+'"');
    !res.order?fail('no order created'):ok('order: '+res.order.title+' (type '+res.order.type+')');
    window.eval('Engine.addGuestRequest('+JSON.stringify(res.order)+','+JSON.stringify(res.reply)+')');
    await new Promise(r=>setTimeout(r,50));
    const tr=window.document.querySelectorAll('#guest-tracker .tracker-card').length;
    !tr?fail('tracker missing'):ok('request tracker rendered ('+tr+' cards)');
    // evening brief
    const b=await window.eval('AI.eveningBrief(Engine.briefStats())');
    !b.headline?fail('brief empty'):ok('brief headline: "'+b.headline+'"');
    b.bullets&&b.bullets.length>=5?ok('brief has '+b.bullets.length+' bullets'):fail('brief bullets '+(b.bullets||[]).length);
    // reject -> replan flow through the real UI
    E.advance(6);
    await new Promise(r=>setTimeout(r,400));
    const cardB=E.state.approvals.find(c=>c.beat==='beatB');
    cardB?ok('beatB card proposed (sickness)'):fail('no beatB card');
    const beatACount=window.document.querySelectorAll('#approval-queue .appr-card').length;
    console.log('   approval cards now:',beatACount);
    if(cardB){
      const rejBtn=window.document.querySelector('#approval-queue .action .btn.reject');
      if(!rejBtn)fail('no reject button in DOM');
      else{
        rejBtn.click();
        await new Promise(r=>setTimeout(r,50));
        const chip=window.document.querySelector('.reject-chips .chip');
        chip?ok('reject-reason chips rendered after click'):fail('no reject chips after clicking reject');
        if(chip){
          chip.click();
          await new Promise(r=>setTimeout(r,500));
          const replan=E.state.approvals.find(c=>c.beat==='replan');
          replan?ok('Maestro re-planned after rejection ('+replan.actions.length+' new actions)'):fail('no replan card');
          const hist=window.document.querySelectorAll('#conductor-history .hist-row').length;
          console.log('   decision-history rows:',hist);
        }
      }
    }
  }catch(e){fail('sync: '+e.stack)}
  if(errors.length){console.log('\nERRORS:\n'+errors.join('\n'));process.exitCode=1;}
  else console.log('\nDOM SMOKE: ALL PASS ✔');
  window.close();
},500);
