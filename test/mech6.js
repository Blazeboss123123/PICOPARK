// Slimes, lean platforms, the runaway key and the heavy key: the mechanics and every room built from them.
const HP=require('../public/game.js');
const T=HP.TS;
function G(i,n){const g=HP.createGame(i,n);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
function run(g,sec,inp){const k=Math.round(sec/HP.STEP);for(let i=0;i<k;i++){g.players.forEach(p=>{const v=inp?inp(p,i*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false)});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;if(g.S.restartT>0)return;}}
const P=(g,s)=>g.players.find(p=>p.slot===s);
const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;p.dead=0;p.inside=false;p.on=null;};
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};const f=v=>Math.round(v*10)/10;
// park everyone not under test on safe ground just left of x (row F), stacking when the ground runs out
function park(g,keep,x,F){const rest=g.players.filter(p=>!keep.includes(p.slot)).map(p=>p.slot);if(!rest.length)return;if(x==null){x=g.spawn.x*T+40;F=g.spawn.floor}
 const safe=cx=>{const a=Math.floor(cx/T),b=Math.floor((cx+9.9)/T),row=g.grid[F],up=g.grid[F-1];if(a<0||b>=g.W||row[a]!=='#'||row[b]!=='#'||'#&ABCDEabcde'.includes(up[a])||'#&ABCDEabcde'.includes(up[b]))return false;const r={x:cx,y:F*T-14,w:10,h:14};
  return !g.S.crates.some(c=>HP.ov(r,c))&&!g.plateDefs.some(pl=>cx+10>pl.x-2&&cx<pl.x+pl.w+2)&&!g.fireDefs.some(f=>HP.ov(r,f))&&!g.slimeDefs.some((d,i)=>!g.S.slimes[i].dead&&cx+10>Math.min(d.x,d.x2)-34&&cx<Math.max(d.x,d.x2)+28)&&!g.S.tilts.some(t=>Math.abs(t.y-F*T)<1&&cx+10>t.x&&cx<t.x+t.w)};
 const want=3,spots=[];for(let cx=x;spots.length<want&&cx>x-400;cx-=11.5)if(safe(cx))spots.push(cx);for(let cx=x+11.5;spots.length<want&&cx<x+400;cx+=11.5)if(safe(cx))spots.push(cx);if(!spots.length)spots.push(x);
 rest.forEach((s,i)=>put(g,s,spots[i%spots.length],F*T-14-14*Math.floor(i/spots.length)))}
function clearNew(g,x){g.rooms.forEach(r=>{if(r.x>=x-1)return;if(r.sig&&g.S.sig[r.sig])g.S.sig[r.sig].latched=true;if(r.t==='melt')for(let c=r.x+2;c<=r.x+19;c++)g.grid[r.F][c]='#';if(r.t==='cannon')for(let c=r.x+6;c<=r.x+20;c++)g.grid[r.F][c]='#'});for(let y=0;y<g.H;y++)for(let c=0;c<Math.min(g.W,x);c++)if(g.grid[y][c]==='&')g.S.blast[y*g.W+c]=1;g.searchDefs=g.searchDefs.filter(d=>d.x2>x*HP.TS);if(g.flags.rise)g.flags.rise=null}
function openBefore(g,x){clearNew(g,x);if(g.flags.light)g.flags.light={g:1e9,y:1,r:1};g.rooms.forEach(r=>{if(r.sig&&r.x<x-1)g.S.sig[r.sig].latched=true;if(r.t==='crate'&&r.x<x){const c=g.S.crates.find(c=>Math.abs(c.x-(r.x+2)*T)<1);if(c){c.x=(r.x+12)*T;c.y=r.F*T}}if(r.t==='pin'&&r.x<x){const i=g.S.slimes.findIndex(s=>Math.abs(s.y+s.h-r.F*T)<1&&s.x>=(r.x+5)*T&&s.x<=(r.x+18)*T);if(i>=0)g.S.slimes[i].dead=1}})}
const slimeIn=(g,x0,x1)=>g.S.slimes.findIndex((s,i)=>{const d=g.slimeDefs[i];return d.x>=x0*T-1&&d.x<=x1*T+1});

// ---------- slimes ----------
{const g=G(14,2);const i=slimeIn(g,13,13.1),sl=g.S.slimes[i];put(g,1,2*T,15*T-14);put(g,0,sl.x+40,15*T-14);run(g,0.1);run(g,2.5,p=>p.slot===0?{x:-1}:null);
 ok(g.S.deaths===1&&g.S.cause==='slime',"walking into a slime's side kills ("+g.S.lastCause+')');}
{// a normal jump vs a bounce off a slime's head
 const g=G(14,2);put(g,1,2*T,15*T-14);put(g,0,8*T,15*T-14);run(g,0.2);let top=1e9;run(g,1,(p,t)=>{if(p.slot===0)top=Math.min(top,p.y);return p.slot===0?{j:t<0.5}:null});const plain=15*T-14-top;
 const g2=G(14,2);put(g2,1,2*T,15*T-14);const i=slimeIn(g2,13,13.1),sl=g2.S.slimes[i];g2.slimeDefs[i].spd=0;put(g2,0,sl.x+1,sl.y-40);let top2=1e9;run(g2,1.2,p=>{if(p.slot===0)top2=Math.min(top2,p.y);return p.slot===0?{j:true}:null});
 const bounce=sl.y-14-top2;ok(!g2.S.deaths&&bounce>plain+20,'bouncing off a slime goes much higher than a jump ('+f(bounce)+' vs '+f(plain)+')');}
{const g=G(14,2);const i=g.slimeDefs.findIndex(d=>d.spiky),sl=g.S.slimes[i];g.slimeDefs[i].spd=0;put(g,1,sl.x-60,15*T-14);put(g,0,sl.x+1,sl.y-40);run(g,1);ok(g.S.deaths===1&&g.S.cause==='slime','spiky slimes hurt from above too');}
{const g=G(3,3);const i=g.S.slimes.length-1;g.S.light.ph=2;g.S.light.t=0;g.flags.light={g:1,y:1,r:1e9};const x0=g.S.slimes[i].x;run(g,1);ok(Math.abs(g.S.slimes[i].x-x0)<0.01,'slimes freeze on red');}

// ---------- rooms ----------
for(let li=0;li<HP.LEVELS.length;li++)for(const n of [2,3,5,8]){
 const g0=G(li,n),name=g0.name+' n'+n,slots=[...Array(n).keys()];
 g0.rooms.forEach(rm=>{const Y=rm.F*T-14,tag=name+' '+rm.t+'@'+rm.x;
  if(rm.t==='pin'){
   {// nobody gets past the slime in the tunnel
    if(!g0.flags.rope){const g=G(li,n);openBefore(g,rm.x);park(g,[0],rm.x*T,rm.F);put(g,0,(rm.x+3)*T,Y);run(g,0.2);run(g,8,(p,t)=>p.slot===0?{x:1,j:(t%0.6)<0.2}:null);
    ok(g.S.deaths>0&&g.S.cause==='slime',tag+' the slime gets anyone who walks in ('+g.S.lastCause+')');}}
   {// push the crate through: it flattens the slime and everyone gets through
    const g=G(li,n);openBefore(g,rm.x);const c=g.S.crates.find(c=>Math.abs(c.x-(rm.x+1)*T)<1);const i=slimeIn(g,rm.x+6,rm.x+6);
    const need=HP.needOf(g,g.crateDefs[g.S.crates.indexOf(c)].need);const pushers=g.flags.rope?slots:slots.slice(0,need);park(g,pushers,c.x-12-need*11,rm.F);pushers.forEach((s,k)=>put(g,s,c.x-10.5-k*10.6,Y));run(g,0.2);
    let t=0;while(t<16&&!g.S.slimes[i].dead&&!g.S.deaths){run(g,0.1,p=>pushers.includes(p.slot)?{x:1}:null);t+=0.1}
    ok(g.S.slimes[i].dead&&!g.S.deaths,tag+' crate squashes the slime ('+f(t)+'s, '+g.S.lastCause+')');
    const goal=(rm.x+21)*T;run(g,9,(p,t)=>({x:p.x<goal+(p.slot%4)*11?1:0,j:p.x>(rm.x+18)*T&&p.x<goal&&(t%0.6)<0.25}));
    ok(g.players.every(p=>p.x>=(rm.x+19)*T-1)&&!g.S.deaths,tag+' everyone got through ('+g.players.map(p=>f(p.x/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='slime'){
   const i=slimeIn(g0,rm.x+2,rm.x+2),top=(rm.F-rm.h)*T,ledge=[(rm.x+10)*T,(rm.x+14)*T];
   {// a plain jump can't reach the ledge
    const g=G(li,n);openBefore(g,rm.x);park(g,[0],rm.x*T,rm.F);g.S.slimes[i].dead=1;put(g,0,(rm.x+9)*T,Y);run(g,0.2);let best=1e9;run(g,1.4,(p,t)=>{if(p.slot===0)best=Math.min(best,p.y);return p.slot===0?{x:1,j:t<0.5}:null});
    ok(best>top-13,tag+' ledge out of reach with a plain jump');}
   {// touch its side and you're out
    const g=G(li,n);openBefore(g,rm.x);park(g,[0],rm.x*T,rm.F);const sl=g.S.slimes[i];g.slimeDefs[i].spd=0;put(g,0,sl.x-14,Y);run(g,0.2);run(g,1,p=>p.slot===0?{x:1}:null);ok(g.S.deaths>0&&g.S.cause==='slime',tag+' the big slime hurts from the side');}
   {// bounce up, hold the gate, team through, then the far button lets the bouncer down and through
    const g=G(li,n);openBefore(g,rm.x);park(g,[0],rm.x*T,rm.F);const sl=g.S.slimes[i],d=g.slimeDefs[i];sl.x=(d.x+d.x2)/2+10;d.spd=0;
    put(g,0,sl.x+sl.w/2-5,sl.y-30);run(g,2.2,p=>p.slot===0?{x:p.x<ledge[0]+8?1:0,j:true}:null);const me=P(g,0);
    ok(!g.S.deaths&&Math.abs(me.y-(top-14))<1&&me.x>ledge[0]-6,tag+' bounce reaches the ledge ('+f(me.x/T)+','+f(me.y/T)+')');
    run(g,0.8,p=>p.slot===0?{x:me.x<(rm.x+11.5)*T?1:me.x>(rm.x+12.2)*T?-1:0}:null);ok(g.S.sig[rm.sig].on,tag+' ledge button opens the gate');
    const past=(rm.x+16)*T;g.players.forEach((p,k)=>{if(p.slot)put(g,p.slot,(rm.x+11)*T+(k%3)*11,Y-14*Math.floor(k/3))});d.spd=0;sl.x=d.x;run(g,0.2,p=>p.slot===0?null:{});
    run(g,4,(p,t)=>p.slot===0?null:{x:p.x<past+3*T+(p.slot%4)*11?1:0,j:p.y<Y-2&&(t%0.7)<0.3});ok(g.players.every(p=>p.slot===0||p.x>=past-1)&&!g.S.deaths,tag+' the team goes through ('+g.players.map(p=>f(p.x/T)).join(',')+') '+g.S.lastCause);
    const pc=(rm.x+18)*T-5,hp=g.players.filter(p=>p.slot).sort((a,b)=>Math.abs(a.x-pc)-Math.abs(b.x-pc))[0].slot;run(g,4,p=>p.slot===0?{x:g.S.sig[rm.sig].on&&p.x<past+2?1:0}:p.slot===hp?{x:p.x<pc-2?1:p.x>pc+2?-1:0,j:Math.abs(p.x-pc)>4&&(g.S.t%0.6)<0.25}:null);ok(P(g,0).x>=past-1&&!g.S.deaths,tag+' bouncer brought through by the far button ('+f(P(g,0).x/T)+') '+g.S.lastCause);}
  }
  if(rm.t==='tilt'){
   const ti=g0.S.tilts.findIndex(t=>Math.abs(t.x-(rm.x+2)*T)<1),fi=g0.fireDefs.findIndex(fd=>fd.x>(rm.x+2)*T&&fd.x<(rm.x+2+rm.lw)*T);
   const on=(g,t,ofs)=>slots.forEach((s,k)=>put(g,s,t.x+t.w/2-5+ofs(k),rm.F*T-14-14*Math.floor(k/Math.max(1,Math.floor(t.w/11)))));
   {// everyone on the right half: it drifts right and carries them
    const g=G(li,n);openBefore(g,rm.x);const t=g.S.tilts[ti];g.fireDefs[fi].period=1e9;g.fireDefs[fi].on=0;const lim=Math.floor(t.w/2/11);on(g,t,k=>8+(k%Math.max(1,lim))*10);run(g,0.1);const x0=t.x;run(g,1.5);
    ok(t.x>x0+25&&!g.S.deaths,tag+' all on the right: it drifts right ('+f((t.x-x0)/T)+' tiles) '+g.S.lastCause);
    const t2=G(li,n);openBefore(t2,rm.x);const tt=t2.S.tilts[ti];t2.fireDefs[fi].period=1e9;t2.fireDefs[fi].on=0;on(t2,tt,k=>k%2?-9:9);if(n%2)put(t2,n-1,tt.x+tt.w/2-5,rm.F*T-28);run(t2,0.1);const x1=tt.x;run(t2,1.5);
    ok(Math.abs(tt.x-x1)<2&&!t2.S.deaths,tag+' balanced: it stays put ('+f(tt.x-x1)+')');
    // left alone, it drifts home
    park(t2,[],rm.x*T,rm.F);tt.x=(rm.x+10)*T;run(t2,6);ok(Math.abs(tt.x-(rm.x+2)*T)<2,tag+' empty, it drifts back home ('+f(tt.x/T)+')');}
   {// riding into the lit fire burns
    const g=G(li,n);openBefore(g,rm.x);const t=g.S.tilts[ti];g.fireDefs[fi].period=1e9;g.fireDefs[fi].on=1;park(g,[0],rm.x*T,rm.F);t.x=g.fireDefs[fi].x-t.w-10;put(g,0,t.x+t.w-11,rm.F*T-14);run(g,3);ok(g.S.deaths>0&&g.S.cause==='fire',tag+' fire burns riders');}
   {// the whole crossing, with a simple caller: go, stop short of the fire, wait for it to go out, go
    const g=G(li,n);openBefore(g,rm.x);const t=g.S.tilts[ti],fd=g.fireDefs[fi],far=(rm.x+2+rm.lw)*T;on(g,t,k=>((k%2)?-1:1)*(6+Math.floor(k/2)%2*10));run(g,0.3);
    let tm=0,mode='go';const lim=Math.max(1,Math.floor(t.w/2/11));
    while(tm<40&&!g.S.deaths&&!g.players.every(p=>p.x>far+2)){
     const front=Math.max(...g.players.map(p=>p.x+p.w)),back=Math.min(...g.players.map(p=>p.x)),lit=HP.fireLit(g,fi)||HP.fireWarn(g,fi);
     const ph=((g.S.t+fd.off)%fd.period+fd.period)%fd.period,offLeft=ph>=fd.period*fd.on?fd.period-ph:0,need=(front-back+fd.w+8)/Math.min(56,22*n)+0.6,inside=front>fd.x-3&&back<fd.x+fd.w+2;
     if(t.x+t.w>=far-1)mode='off';else if(back>fd.x+fd.w+2||inside)mode='go';else if(front>fd.x-60&&offLeft<need)mode='stop';else mode='go';
     run(g,1/30,(p)=>{const k=p.slot;if(mode==='off')return{x:1,j:p.x<far&&p.x+p.w>far-3};const tx=mode==='go'?t.x+t.w-11-(k%lim)*10:t.x+t.w/2-5+((k%2)?-1:1)*(6+Math.floor(k/2)%2*10)+(n%2&&k===n-1?-(((k%2)?-1:1)*(6+Math.floor(k/2)%2*10)):0);return{x:p.x<tx-2?1:p.x>tx+2?-1:0}});tm+=1/30}
    ok(g.players.every(p=>p.x>far+2)&&!g.S.deaths,tag+' the team leans across, stopping for the fire ('+f(tm)+'s, '+g.players.map(p=>f(p.x/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='up'){
   const g=G(li,n),wall=(rm.x+8)*T,k=g.S.key;run(g,0.1);g.players.forEach(p=>put(g,p.slot,wall-40-p.slot*11,Y));run(g,0.3);k.carrier=0;
   {const me=P(g,0);put(g,0,wall-10,Y);run(g,0.2);run(g,0.8,p=>p.slot===0?{x:1,j:true}:null);ok(P(g,0).y>=Y-2,tag+' heavy key: the carrier can\'t jump the step');}
   if(rm.h===1){put(g,1,wall+1,Y-10);run(g,0.3);run(g,0.1,p=>p.slot===0?{d:true}:null);ok(k.carrier===1,tag+' pass it up to a friend on the step');}
   else{put(g,1,wall-10,Y-14.5);put(g,2,wall+1,Y-20);run(g,0.4);run(g,0.1,p=>p.slot===0?{d:true}:null);run(g,0.1);const a=k.carrier;run(g,0.1,p=>p.slot===1?{d:true}:null);
    ok(a===1&&k.carrier===2,tag+' passed up a stack: 0 -> '+a+' -> '+k.carrier);}
   {const g3=G(li,n);run(g3,0.1);g3.players.forEach(p=>put(g3,p.slot,wall-40-p.slot*11,Y));run(g3,0.3);put(g3,1,wall-10,Y);run(g3,0.2);run(g3,0.8,(p,t)=>p.slot===1?{x:1,j:t<0.4}:null);ok(P(g3,1).y<Y-5,tag+' without the key you just hop up');}
  }
 });
}

// ---------- the runaway key ----------
for(const li of [1,14,19])for(const n of [2,3,5]){
 const g0=G(li,n),R=g0.keyRun,hy=g0.keyHome.y+9-14,name=g0.name+' n'+n;
 const prep=(g,keep)=>{if(g.flags.scroll){g.flags.scroll=1e-9;g.S.scroll=R.lo-40}openBefore(g,1e9);g.players.forEach(p=>{if(!keep.includes(p.slot))p.inside=true})};
 {const g=G(li,n);prep(g,[0]);put(g,0,R.lo-15,hy);run(g,0.2);let hops=0;const k=g.S.key;
  for(let t=0;t<10;t+=0.05){run(g,0.05,p=>p.slot===0?{x:k.x>p.x+5?1:-1}:{x:0});if(k.hop>0.45)hops++}
  ok(k.carrier<0&&!g.S.deaths,name+' one chaser can\'t catch the key ('+k.carrier+') '+g.S.lastCause);ok(hops>0,name+' cornered, the key hops over the chaser');}
 {const g=G(li,n);prep(g,[0,1]);put(g,0,R.lo-15,hy);put(g,1,R.hi+12,hy);run(g,0.2);const k=g.S.key;let t=0;
  while(t<8&&k.carrier<0&&!g.S.deaths){run(g,0.05,p=>p.slot<2?{x:k.x>p.x+5?1:-1}:null);t+=0.05}
  ok(k.carrier>=0&&k.carrier<2&&!g.S.deaths,name+' two players trap and catch it ('+f(t)+'s, carrier '+k.carrier+') '+g.S.lastCause);}
}

// ---------- the heavy key ----------
{const g=G(18,3);run(g,0.1);const k=g.S.key;k.carrier=0;put(g,0,20*T,15*T-14);run(g,0.2);const x0=P(g,0).x;run(g,1,p=>p.slot===0?{x:1}:null);const v=(P(g,0).x-x0);
 const g2=G(18,3);run(g2,0.1);put(g2,0,20*T,15*T-14);run(g2,0.2);const x1=P(g2,0).x;run(g2,1,p=>p.slot===0?{x:1}:null);ok(v<0.75*(P(g2,0).x-x1),'heavy key slows you down ('+f(v)+' vs '+f(P(g2,0).x-x1)+')');}
console.log('pass',pass,'fail',fail);if(fail)process.exitCode=1;
