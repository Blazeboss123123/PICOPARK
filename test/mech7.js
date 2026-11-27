// Worlds 6-10: seesaws, melting ice, searchlights, bombs, cannons, lifts, climbs, twin keys and rising lava, in every level that uses them.
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
 const want=Math.min(rest.length,8),spots=[];for(let cx=x;spots.length<want&&cx>x-600;cx-=11.5)if(safe(cx))spots.push(cx);for(let cx=x+11.5;spots.length<want&&cx<x+400;cx+=11.5)if(safe(cx))spots.push(cx);if(!spots.length)spots.push(x);
 rest.forEach((s,i)=>put(g,s,spots[i%spots.length],F*T-14-14*Math.floor(i/spots.length)))}
function clearNew(g,x){g.rooms.forEach(r=>{if(r.x>=x-1)return;if(r.sig&&g.S.sig[r.sig])g.S.sig[r.sig].latched=true;if(r.t==='melt')for(let c=r.x+2;c<=r.x+19;c++)g.grid[r.F][c]='#';if(r.t==='cannon')for(let c=r.x+6;c<=r.x+20;c++)g.grid[r.F][c]='#'});for(let y=0;y<g.H;y++)for(let c=0;c<Math.min(g.W,x);c++)if(g.grid[y][c]==='&')g.S.blast[y*g.W+c]=1;g.searchDefs=g.searchDefs.filter(d=>d.x2>x*HP.TS);if(g.flags.rise)g.flags.rise=null}
function openBefore(g,x){clearNew(g,x);if(g.flags.light)g.flags.light={g:1e9,y:1,r:1};g.rooms.forEach(r=>{if(r.sig&&r.x<x-1)g.S.sig[r.sig].latched=true;if(r.t==='crate'&&r.x<x){const c=g.S.crates.find(c=>Math.abs(c.x-(r.x+2)*T)<1);if(c){c.x=(r.x+12)*T;c.y=r.F*T}}if(r.t==='pin'&&r.x<x){const i=g.S.slimes.findIndex(s=>Math.abs(s.y+s.h-r.F*T)<1&&s.x>=(r.x+5)*T&&s.x<=(r.x+18)*T);if(i>=0)g.S.slimes[i].dead=1}})}
const slimeIn=(g,x0,x1)=>g.S.slimes.findIndex((s,i)=>{const d=g.slimeDefs[i];return d.x>=x0*T-1&&d.x<=x1*T+1});


const stack=(g,slots,x,Y)=>slots.forEach((s,i)=>put(g,s,x,Y-14*i));
const tap=(t,t0)=>t>=t0&&t<t0+0.1;
const levels=[...Array(HP.LEVELS.length).keys()].filter(i=>i>=25);
for(const li of levels)for(const n of [2,3,5,8]){
 const g0=G(li,n),name=g0.name+' n'+n,slots=[...Array(n).keys()];
 g0.rooms.forEach(rm=>{const Y=rm.F*T-14,tag=name+' '+rm.t+'@'+rm.x;
  const fresh=()=>{const g=G(li,n);openBefore(g,rm.x);return g};
  if(rm.t==='key'||rm.t==='key2'){
   const top=(rm.F-rm.s)*T,k=rm.s>4?3:2,key=rm.t==='key2'?'key2':'key';
   {const g=fresh();park(g,[0],rm.x*T,rm.F);put(g,0,(rm.x+1)*T,Y);run(g,0.2);let best=1e9;run(g,1.2,(p,t)=>{if(p.slot===0)best=Math.min(best,p.y);return p.slot===0?{x:t>0.1&&p.x<(rm.x+1.8)*T?1:0,j:t<0.45}:null});ok(best>top-13,tag+' ledge out of reach alone');}
   {const g=fresh();park(g,slots.slice(0,k),rm.x*T-20,rm.F);stack(g,slots.slice(0,k),(rm.x+1)*T-2,Y);run(g,0.4);
    run(g,1.6,(p,t)=>p.slot===k-1?{x:t>0.12&&p.x<(rm.x+4)*T?1:0,j:t<0.45}:null);ok(g.S[key].carrier===k-1,tag+' a stack of '+k+' gets the '+key+' ('+g.S[key].carrier+')');}
  }
  if(rm.t==='seesaw'){
   const pads=g0.S.sees.filter(s=>Math.abs(s.x-(rm.x+4)*T)<1||Math.abs(s.x-(rm.x+8)*T)<1),cliff=(rm.F-8)*T-14,cx=(rm.x+11)*T,lv=(rm.x+13)*T;
   {// a plain jump onto the seesaw isn't enough
    const g=fresh();park(g,[0,1],rm.x*T,rm.F);const R=g.S.sees.find(s=>Math.abs(s.x-(rm.x+8)*T)<1);put(g,1,R.x+10,R.y-14);put(g,0,(rm.x+1)*T,Y);run(g,0.3);let best=1e9;
    run(g,1.6,(p,t)=>{if(p.slot===1)best=Math.min(best,p.y);return p.slot===0?{x:t<0.25?1:0,j:t<0.5}:p.slot===1?{x:p.vy<0?1:0}:null});ok(best>cliff+2,tag+' a jump from the ground doesn\'t launch anyone up the cliff ('+f(best/T)+')');}
   {// from the pillar it does; the launched player pulls the lever, stairs appear, everyone climbs
    const g=fresh();park(g,[0,1],rm.x*T,rm.F);const R=g.S.sees.find(s=>Math.abs(s.x-(rm.x+8)*T)<1);put(g,1,R.x+10,R.y-14);put(g,0,(rm.x+2)*T+5,(rm.F-4)*T-14);run(g,0.3);
    run(g,2,(p,t)=>p.slot===0?{x:t<0.3?1:0,j:t<0.2}:p.slot===1?{x:p.vy<-10||(!p.grounded&&p.x<cx+6)?1:0}:null);const me=P(g,1);
    ok(Math.abs(me.y-cliff)<1.5&&me.x>=cx-2&&!g.S.deaths,tag+' jumping from the pillar launches a friend up the cliff ('+f(me.x/T)+','+f(me.y/T)+') '+g.S.lastCause);
    run(g,1.5,p=>p.slot===1?{x:p.x<lv?1:0}:null);ok(g.S.sig[rm.sig].latched,tag+' the lever up there opens the stairs');
    run(g,7,(p,t)=>p.slot===1?null:{x:p.x<lv+30?1:0,j:(t%0.5)<0.3});ok(g.players.every(p=>p.y<=cliff+1)&&!g.S.deaths,tag+' everyone climbs up ('+g.players.map(p=>f(p.y/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='lift'){
   const top=(rm.F-rm.h)*T-14,lx=(rm.x+1)*T,end=(rm.x+rm.lw+3)*T;
   {const g=fresh();const l=g.S.lifts.find(l=>Math.abs(l.x-lx)<1);slots.slice(1).forEach((s,i)=>put(g,s,l.x+3+(i%Math.max(1,rm.lw-1))*10.5,l.y-14-14*Math.floor(i/Math.max(1,rm.lw-1))));put(g,0,(rm.x-2)*T,Y);run(g,3);ok(Math.abs(l.y-rm.F*T)<1,tag+' the lift waits for everyone');
    put(g,0,l.x+l.w-11,l.y-14-28);run(g,6);ok(l.y<rm.F*T-rm.h*T+1,tag+' everyone aboard: up it goes ('+f(l.y/T)+')');
    run(g,5,(p,t)=>({x:p.x<end+8?1:0,j:p.x<end+8&&(t%0.6)<0.3}));ok(g.players.every(p=>p.y<=top+1)&&!g.S.deaths,tag+' everyone steps off at the top ('+g.players.map(p=>f(p.y/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='climb'){
   const top=(rm.F-rm.s)*T-14,k=rm.s>4?3:2,wall=(rm.x+4)*T,lv=(rm.x+6)*T;
   {const g=fresh();park(g,[0],rm.x*T,rm.F);put(g,0,wall-12,Y);run(g,0.2);let best=1e9;run(g,1.2,(p,t)=>{if(p.slot===0)best=Math.min(best,p.y);return p.slot===0?{x:1,j:t<0.45}:null});ok(best>top+1,tag+' the wall is too high alone');}
   {const g=fresh();park(g,slots.slice(0,k),wall-30,rm.F);stack(g,slots.slice(0,k),wall-11,Y);run(g,0.4);run(g,1.6,(p,t)=>p.slot===k-1?{x:t>0.12?1:0,j:t<0.45}:null);
    ok(P(g,k-1).y<=top+1,tag+' a stack of '+k+' gets over ('+f(P(g,k-1).y/T)+')');run(g,1,p=>p.slot===k-1?{x:p.x<lv?1:0}:null);ok(g.S.sig[rm.sig].latched,tag+' lever makes the stairs');
    run(g,7,(p,t)=>({x:p.x<lv+30?1:0,j:p.x<lv+30&&(t%0.5)<0.3}));ok(g.players.every(p=>p.y<=top+1)&&!g.S.deaths,tag+' everyone climbs ('+g.players.map(p=>f(p.y/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='melt'){
   const fl=g0.S.melts.filter(m=>m.x>=(rm.x+3)*T-1&&m.x<=(rm.x+15)*T+1),end=(rm.x+21)*T;
   {const g=fresh();park(g,[0],rm.x*T,rm.F);const m=g.S.melts.find(m=>Math.abs(m.x-(rm.x+7)*T)<1);put(g,0,m.x+5,m.y-14);run(g,4);ok(g.S.deaths>0&&g.S.cause==='spikes',tag+' stand still and the floe melts under you ('+g.S.lastCause+')');}
   {const g=fresh();park(g,[],rm.x*T,rm.F);const m=g.S.melts.find(m=>Math.abs(m.x-(rm.x+7)*T)<1);const k=Math.min(n,3);stack(g,slots.slice(0,k),m.x+5,m.y-14);let t=0;while(t<3&&!g.S.deaths){run(g,0.05);t+=0.05}ok(g.S.deaths>0&&t<1.6,tag+' crowd one floe and it goes fast ('+f(t)+'s)');}
   {// one by one, short hops floe to floe
    const g=fresh();park(g,[],(rm.x+1)*T,rm.F);const edges=[2,5,9,13,17].map(e=>(rm.x+e)*T);let tm=0;const start={};slots.forEach((s,i)=>start[s]=i*0.9);const hop={};
    while(tm<8+n*1.6&&!g.S.deaths&&!g.players.every(p=>p.inside||p.x>end)){g.players.forEach(p=>{if(!p.inside&&p.grounded&&p.x>end+2)p.inside=true});run(g,1/60,p=>{const go=tm>=start[p.slot];if(!go)return null;const fx_=p.x+p.w+3,col=Math.floor(fx_/T),sup=g.grid[rm.F][col]==='#'||g.S.melts.some(m=>m.st===0&&fx_>=m.x&&fx_<=m.x+m.w);if(p.grounded&&!sup&&(hop[p.slot]==null||tm-hop[p.slot]>0.3))hop[p.slot]=tm;const goal=end+10+n*11,j=(hop[p.slot]!=null&&tm-hop[p.slot]<0.12)||(p.x<goal&&p.grounded&&sup&&Math.abs(p.vx)<20&&tm-start[p.slot]>0.5&&(tm%0.4)<0.12);return{x:p.x<goal?1:0,j}});tm+=1/60}
    ok(g.players.every(p=>p.inside||p.x>end)&&!g.S.deaths,tag+' the team hops across one after another ('+f(tm)+'s, '+g.players.map(p=>f(p.x/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='search'){
   const si=g0.searchDefs.findIndex(d=>Math.abs(d.x-(rm.x+1)*T)<1),end=(rm.x+31)*T;
   const sI=g=>g.searchDefs.findIndex(d=>Math.abs(d.x-(rm.x+1)*T)<1),at=(g,x)=>{const d=g.searchDefs[sI(g)];d.x=x-10;d.x2=x-10+d.w+0.001;d.spd=1e-6;};
   {const g=fresh();park(g,[0],rm.x*T,rm.F);at(g,(rm.x+5)*T);put(g,0,(rm.x+5)*T,Y);run(g,0.3);ok(!g.S.deaths,tag+' standing still in the light is safe');run(g,0.5,p=>p.slot===0?{x:1}:null);ok(g.S.deaths>0&&g.S.cause==='spotted',tag+' moving in the light gets you caught');}
   {const g=fresh();park(g,[0],rm.x*T,rm.F);at(g,(rm.x+10)*T);put(g,0,(rm.x+9)*T+2,Y);run(g,0.2);run(g,0.25,p=>p.slot===0?{x:1}:null);ok(!g.S.deaths,tag+' under cover you can move '+g.S.lastCause);}
   {// the team crosses: move while the light is away or you're under cover, freeze when it's close
    const g=fresh();park(g,[],(rm.x+1)*T,rm.F);const gi=sI(g),d=g.searchDefs[gi];let tm=0;
    while(tm<45&&!g.S.deaths&&!g.players.every(p=>p.x+p.w>d.x2)){const bx=HP.searchX(g,gi);run(g,1/30,p=>{const near=p.x+p.w>bx-22&&p.x<bx+d.w+22;const goal=d.x2+10+n*11;return{x:!near&&p.x<goal?1:0,j:!near&&p.x<goal&&Math.abs(p.vx)<20&&tm>1&&(tm%0.4)<0.2}});tm+=1/30}
    ok(g.players.every(p=>p.x+p.w>d.x2)&&!g.S.deaths,tag+' the team sneaks through ('+f(tm)+'s) '+g.S.lastCause);}
  }
  if(rm.t==='bomb'){
   const bi=g0.bombDefs.findIndex(d=>Math.abs(d.x-(rm.x+1)*T)<1),wall=(rm.x+32)*T,hur=[12,22].map(h=>(rm.x+h)*T);
   const runTo=(p,goal)=>({x:p.x<goal?1:0,j:hur.some(h=>p.x+p.w>h-12&&p.x<h+12)});
   {const g=fresh();park(g,[0],rm.x*T,rm.F);put(g,0,(rm.x+1)*T+2,Y);run(g,0.2);run(g,0.1,p=>p.slot===0?{d:true}:null);ok(g.S.bombs[bi].carrier===0,tag+' press down to take a bomb');
    run(g,6,p=>p.slot===0?runTo(p,wall+20):null);ok(g.S.deaths>0&&g.S.cause==='bomb'&&!g.S.blast[(rm.F-1)*g.W+rm.x+32],tag+' one runner can\'t make it before the fuse ('+g.S.lastCause+')');}
   {const g=fresh();park(g,[0,1],rm.x*T,rm.F);put(g,0,(rm.x+1)*T+2,Y);put(g,1,(rm.x+17)*T,Y);run(g,0.2);run(g,0.1,p=>p.slot===0?{d:true}:null);const b=g.S.bombs[bi];let tm=0;
    while(tm<8&&!g.S.deaths&&!g.S.blast[(rm.F-1)*g.W+rm.x+32]){run(g,1/60,p=>{if(p.slot>1)return null;if(b.carrier!==p.slot)return null;const o=P(g,1-p.slot),near=Math.abs(o.x-p.x)<12&&b.from!==o.slot&&o.x>p.x-2;return near?{d:Math.floor(tm*60)%2===0}:runTo(p,wall+20)});tm+=1/60}
    ok(g.S.blast[(rm.F-1)*g.W+rm.x+32]&&!g.S.deaths,tag+' two players relay it and blow the wall ('+f(tm)+'s) '+g.S.lastCause);
    for(let k=0;k<80;k++){g.players.forEach(p=>{if(!p.inside&&p.x>(rm.x+34)*T+2)p.inside=true});run(g,0.1,(p,t)=>({x:1,j:(g.S.t%0.5)<0.25}))}ok(g.players.every(p=>p.inside||p.x>=(rm.x+34)*T-1)&&!g.S.deaths,tag+' then everyone walks through ('+g.players.map(p=>f(p.x/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='cannon'){
   const ci=g0.cannonDefs.findIndex(c=>Math.abs(c.x-(rm.x+3)*T)<1),c=g0.cannonDefs[ci],across=(rm.x+21)*T,lv=(rm.x+24)*T;
   const fire=(g,s)=>{put(g,s,c.x+5,Y);run(g,0.15);run(g,0.1,p=>p.slot===s?{d:true}:null);run(g,2.2)};
   {const g=fresh();park(g,[0],rm.x*T-30,rm.F);fire(g,0);ok(!g.S.deaths&&P(g,0).x<(rm.x+6)*T,tag+' unaimed, it just pops you up ('+f(P(g,0).x/T)+') '+g.S.lastCause);}
   {const g=fresh();park(g,[0,1],rm.x*T-30,rm.F);put(g,0,rm.x*T-25,Y);put(g,1,rm.x*T+5,Y);run(g,0.3);ok(g.S.sig[rm.sig].on,tag+' the button aims it');fire(g,0);const me=P(g,0);
    ok(!g.S.deaths&&me.x>=across&&me.grounded,tag+' aimed, it fires you across the pit ('+f(me.x/T)+') '+g.S.lastCause);
    run(g,1.5,p=>p.slot===0?{x:p.x<lv?1:p.x>lv+4?-1:0}:null);ok(g.S.sig[rm.sig].latched,tag+' the lever locks the aim');
    put(g,1,c.x+5,Y);fire(g,1);ok(P(g,1).x>=across&&!g.S.deaths,tag+' the aimer comes across last '+g.S.lastCause);}
  }
  if(rm.t==='runkey'){
   const R=g0.keyRun;if(!R)return;const hy=g0.keyHome.y+9-14;
   {const g=fresh();g.players.forEach(p=>{if(p.slot>0)p.inside=true});put(g,0,R.lo-15,hy);run(g,0.2);const k=g.S.key;for(let t=0;t<8;t+=0.05)run(g,0.05,p=>p.slot===0?{x:k.x>p.x+5?1:-1}:null);ok(k.carrier<0,tag+' one chaser can\'t catch it');}
   {const g=fresh();g.players.forEach(p=>{if(p.slot>1)p.inside=true});put(g,0,R.lo-15,hy);put(g,1,R.hi+12,hy);run(g,0.2);const k=g.S.key;let t=0;while(t<8&&k.carrier<0&&!g.S.deaths){run(g,0.05,p=>p.slot<2?{x:k.x>p.x+5?1:-1}:null);t+=0.05}ok(k.carrier>=0,tag+' two trap it ('+f(t)+'s)');}
  }
 });
}

// ---------- twin keys ----------
for(const li of levels){const g0=G(li,3);if(!g0.key2Home)continue;
 const g=G(li,3);g.flags.rise=null;const d=g.door;g.players.forEach(p=>put(g,p.slot,d.x-30-p.slot*12,d.y+8));run(g,0.2);g.S.key.carrier=0;put(g,0,d.x+5,d.y+8);run(g,0.3);ok(g.S.key.used&&!g.S.door.open,g0.name+' one key isn\'t enough');
 g.S.key2.x=d.x-40;g.S.key2.y=d.y+8;g.key2Home={x:d.x-40,y:d.y+8};put(g,1,d.x-45,d.y+8);run(g,0.2);put(g,0,d.x-45,d.y+2);run(g,0.1);ok(g.S.key2.carrier===1,g0.name+' someone else must carry the second key');
 put(g,1,d.x+5,d.y+8);run(g,0.3);ok(g.S.door.open,g0.name+' both keys open the door');}
{const g=G(31,3);const h=g.key2Home;g.players.forEach(p=>put(g,p.slot,h.x-40-p.slot*12,h.y+9-14));run(g,0.2);g.S.key.carrier=0;put(g,0,h.x-5,h.y-5);run(g,0.3);ok(g.S.key2.carrier!==0,'one player can\'t carry both keys');}

// ---------- rising lava ----------
for(const li of levels){const g0=G(li,2);if(!g0.flags.rise)continue;const R=g0.flags.rise;
 const g=G(li,2);run(g,R.delay-0.5);ok(g.S.lava>=R.from-0.01,g0.name+' lava waits '+R.delay+'s');let t=0;while(t<60&&!g.S.deaths){run(g,0.25);t+=0.25}
 ok(g.S.deaths>0&&g.S.cause==='lava',g0.name+' lava rises and gets anyone who stays at the bottom ('+f(t)+'s)');
 const g2=G(li,2);g2.players.length=0;g2.S.t=1e4;g2.S.lava=R.top+3;run(g2,3);ok(Math.abs(g2.S.lava-R.top)<0.01,g0.name+' lava stops below the exit');}
console.log('pass',pass,'fail',fail);if(fail)process.exitCode=1;
