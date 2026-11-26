// Every teamwork room in every level, at several team sizes: it needs the team, and the team can do it.
const HP=require('../public/game.js');
function G(i,n){const g=HP.createGame(i,n);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
function run(g,sec,inp){const k=Math.round(sec/HP.STEP);for(let i=0;i<k;i++){g.players.forEach(p=>{const v=inp?inp(p,i*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,false)});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;}}
const P=(g,s)=>g.players.find(p=>p.slot===s);const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;p.dead=0;p.inside=false;};
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};const f=v=>Math.round(v*10)/10;
const T=HP.TS;
// a spot on solid, open ground at row F, scanning from x in direction dir, avoiding crates and taken spots
function spot(g,x,F,dir,taken){for(let k=0;k<80;k++,x+=dir*11){const a=Math.floor(x/T),b=Math.floor((x+9.9)/T);if(a<0||b>=g.W)break;const row=g.grid[F],up=g.grid[F-1];if(row[a]!=='#'||row[b]!=='#'||'#ABCDEabcde'.includes(up[a])||'#ABCDEabcde'.includes(up[b]))continue;
  const r={x,y:F*T-14,w:10,h:14};if(g.S.crates.some(c=>HP.ov(r,c))||taken.some(t=>Math.abs(t-x)<10.5))continue;taken.push(x);return x}return null}
// stand players side by side on unbroken ground from x; when the ground runs out, the rest stand on their heads
function line(g,slots,x,F,dir){const placed=[];let cx=x;for(const s of slots){let okx=null;for(let k=0;k<3&&okx==null;k++){const a=Math.floor(cx/T),b=Math.floor((cx+9.9)/T),row=g.grid[F],up=g.grid[F-1];const r={x:cx,y:F*T-14,w:10,h:14};
   if(a>=0&&b<g.W&&row[a]==='#'&&row[b]==='#'&&!'#ABCDEabcde'.includes(up[a])&&!'#ABCDEabcde'.includes(up[b])&&!g.S.crates.some(c=>HP.ov(r,c))&&!(g.fireDefs||[]).some(f=>HP.ov(r,f)))okx=cx;else cx+=dir*3}
  if(okx==null)break;put(g,s,okx,F*T-14);placed.push(okx);cx=okx+dir*11}
 const rest=slots.slice(placed.length);rest.forEach((s,i)=>{const base=placed[i%Math.max(1,placed.length)]??x;put(g,s,base,F*T-14-14*(1+Math.floor(i/Math.max(1,placed.length))))})}
// fill any crate gaps before x with their crates, so the team can be placed anywhere
function bridgeBefore(g,x){if(g.flags.light)g.flags.light={g:1e9,y:1,r:1};g.rooms.forEach(r=>{if((r.t==='fire'||r.t==='gate'||r.t==='buttons')&&r.x<x-1)g.S.sig[r.sig].latched=true;if(r.t==='crate'&&r.x<x){const c=g.S.crates.find(c=>Math.abs(c.x-(r.x+2)*T)<1);if(c){c.x=(r.x+12)*T;c.y=r.F*T}}})}
for(let li=0;li<HP.LEVELS.length;li++)for(const n of [2,3,5,8]){
 const g0=G(li,n);if(!g0.rooms.length)continue;const name=g0.name+' n'+n;
 g0.rooms.forEach(rm=>{const Y=rm.F*T-14,tag=name+' '+rm.t+'@'+rm.x,slots=[...Array(n).keys()];
  if(rm.t==='crate'){
   {const g=G(li,n);bridgeBefore(g,rm.x);const c=g.S.crates.find(c=>Math.abs(c.x-(rm.x+2)*T)<1);c.x-=300;line(g,slots.slice(1),(rm.x-1)*T,rm.F,-1);put(g,0,(rm.x+9)*T,Y);run(g,0.2);run(g,1.6,(p,t)=>p.slot===0?{x:1,j:t>0.28&&t<0.6}:null);ok(P(g,0).x<(rm.x+17)*T||g.S.deaths>0,tag+' gap is too wide to jump alone ('+f(P(g,0).x/T)+')');}
   {const g=G(li,n);bridgeBefore(g,rm.x);const c=g.S.crates.find(c=>Math.abs(c.x-(rm.x+2)*T)<1);line(g,slots,c.x-10.5,rm.F,-1);run(g,0.3);
    let t=0;while(t<12&&!(c.y>=rm.F*T-0.5)){run(g,0.1,()=>({x:1}));t+=0.1}ok(Math.abs(c.y-rm.F*T)<0.6&&Math.abs(c.x-(rm.x+12)*T)<1,tag+' team pushed the crate into the gap ('+f(c.x/T)+','+f(c.y/T)+')');
    const goal=(rm.x+17)*T;run(g,0.3);run(g,4,p=>({x:p.x<goal+n*11?1:0,j:false}));ok(g.players.every(p=>p.x>=goal-1)&&!g.S.deaths,tag+' everyone crossed ('+g.players.map(p=>f(p.x/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='gate'){
   const g=G(li,n);bridgeBefore(g,rm.x+1);const sg=g.S.sig[rm.sig],L=(rm.x+1)*T+4,R=(rm.x+8)*T+4,past=(rm.x+6)*T;
   put(g,0,L,Y);line(g,slots.slice(1),rm.x*T-6,rm.F,-1);run(g,0.4);ok(sg.on,tag+' left button opens it');
   run(g,4,(p,t)=>p.slot===0?null:{x:p.x<past+6+(n-1)*11?1:0,j:p.x<past+6&&(t%0.7)<0.35});ok(g.players.every(p=>p.slot===0||p.x>=past),tag+' the others got through ('+g.players.map(p=>f(p.x/T)).join(',')+')');
   put(g,1,R,Y);run(g,0.3);run(g,1.5,p=>p.slot===0?{x:p.x<past+4?1:0}:null);ok(P(g,0).x>=past&&!g.S.deaths,tag+' holder let through from the far side '+g.S.lastCause);
   const g2=G(li,n);bridgeBefore(g2,rm.x+1);line(g2,slots,rm.x*T-6,rm.F,-1);run(g2,0.3);ok(!g2.S.sig[rm.sig].on,tag+' closed when nobody holds it');}
  if(rm.t==='fire'){
   const top=(rm.F-rm.s)*T,k=rm.s>4?3:2,fx=(rm.x+8)*T,past=(rm.x+9)*T+2;
   {const g=G(li,n);bridgeBefore(g,rm.x+1);line(g,slots.slice(1),(rm.x-1)*T,rm.F,-1);put(g,0,(rm.x+6)*T,Y);run(g,0.2);run(g,1,p=>p.slot===0?{x:1}:null);ok(g.S.deaths>0&&g.S.lastCause.startsWith('fire'),tag+' fire burns anyone who walks in');}
   {const g1=G(li,n);bridgeBefore(g1,rm.x+1);line(g1,slots.slice(1),(rm.x-1)*T,rm.F,-1);put(g1,0,rm.x*T,Y);run(g1,0.2);run(g1,1.2,(p,t)=>p.slot===0?{x:t>0.1&&p.x<(rm.x+2)*T?1:0,j:t<0.45}:null);ok(P(g1,0).y>top-13,tag+' ledge out of reach alone');}
   const g=G(li,n);bridgeBefore(g,rm.x+1);line(g,slots.slice(k),(rm.x-1)*T-12,rm.F,-1);for(let i=0;i<k;i++)put(g,i,rm.x*T-2,Y-14*i);run(g,0.4);
   run(g,1.4,(p,t)=>p.slot===k-1?{x:t>0.12&&p.x<(rm.x+2.2)*T?1:0,j:t<0.45}:null);const tp=P(g,k-1);ok(tp.y<=top-13&&!g.S.deaths,tag+' stack of '+k+' reaches the ledge ('+(tp.x/T).toFixed(1)+','+(tp.y/T).toFixed(1)+')');
   put(g,k-1,(rm.x+2)*T+4,top-14);run(g,0.3);ok(g.S.sig[rm.sig].on,tag+' ledge button puts the fire out');
   g.players.forEach((p,i)=>{if(p.slot!==k-1&&p.y<rm.F*T-20)put(g,p.slot,(rm.x+5)*T+((i%3)-1)*4,Y-14*Math.floor(i/3))});run(g,0.3);
   run(g,4,(p,t)=>p.slot===k-1?null:{x:p.x<past+(n-1)*11?1:0,j:p.y<rm.F*T-20&&(t%0.8)<0.3});ok(g.players.every(p=>p.slot===k-1||p.x>=past)&&!g.S.deaths,tag+' team walked through '+g.S.lastCause);
   const far=g.players.find(p=>p.slot!==k-1);put(g,far.slot,(rm.x+11)*T+4,Y);run(g,0.3);run(g,2.5,(p,t)=>p.slot===k-1?{x:p.x<past+4?1:0}:null);ok(P(g,k-1).x>=past&&!g.S.deaths,tag+' ledge holder brought across '+g.S.lastCause);}
  if(rm.t==='order'){
   const g=G(li,n),sg=g.S.sig[rm.sig],xs=[...Array(rm.k).keys()].map(i=>(rm.x+1+i*rm.gap)*T+4);bridgeBefore(g,rm.x+1);
   // one runner can't make it between switches in time
   {const g1=G(li,n);bridgeBefore(g1,rm.x+1);line(g1,slots.slice(1),(rm.x-1)*T,rm.F,-1);put(g1,0,xs[0],Y);run(g1,0.3);run(g1,rm.gap*T/78*(rm.k)+1.5,p=>p.slot===0?{x:1}:null);ok(!g1.S.sig[rm.sig].latched,tag+' one runner can\'t do it alone');}
   // wrong order does nothing; the right order, one player per switch, opens it
   line(g,slots.slice(rm.k),(rm.x-1)*T,rm.F,-1);xs.forEach((x,i)=>put(g,i,x-24,Y));run(g,0.3);
   run(g,0.5,p=>p.slot===1?{x:1}:null);ok(!sg.latched&&(g.S.seq[rm.sig]||{next:1}).next===1,tag+' switch 2 first does nothing');put(g,1,xs[1]-24,Y);run(g,1.5);
   for(let i=0;i<rm.k;i++)run(g,0.45,p=>p.slot===i?{x:1}:null);ok(sg.latched,tag+' '+rm.k+' players in order open it');}
  if(rm.t==='run'){
   const g=G(li,n),sg=g.S.sig[rm.sig],L=(rm.x+1)*T+5,R=(rm.x+13)*T+5,past=(rm.x+12)*T+1;bridgeBefore(g,rm.x+1);
   line(g,slots.slice(1),(rm.x)*T-2,rm.F,-1);put(g,0,L,Y);run(g,0.3);ok(!sg.on,tag+' standing still: no bridge');
   run(g,0.6,p=>p.slot===0?{x:-1}:null);ok(sg.on&&Math.abs(P(g,0).x-L)<2,tag+' running on the treadmill holds the bridge and keeps you there');
   run(g,4,(p,t)=>p.slot===0?{x:-1}:{x:p.x<(rm.x+16)*T+(n-1)*11?1:0,j:p.x<(rm.x+4)*T&&(t%0.8)<0.3});ok(g.players.every(p=>p.slot===0||p.x>=past)&&!g.S.deaths,tag+' team crossed while one runs '+g.S.lastCause);
   put(g,1,R,Y);run(g,0.3);run(g,3,(p,t)=>p.slot===1?{x:-1}:p.slot===0?{x:p.x<past+4?1:0}:null);ok(P(g,0).x>=past&&!g.S.deaths,tag+' runner brought across by the far treadmill '+g.S.lastCause);
   const g2=G(li,n);bridgeBefore(g2,rm.x+1);line(g2,slots.slice(1),rm.x*T-2,rm.F,-1);put(g2,0,(rm.x+4)*T,Y);run(g2,0.2);run(g2,1.5,p=>p.slot===0?{x:1}:null);ok(g2.S.deaths>0,tag+' no bridge without a runner');}
  if(rm.t==='buttons'){
   const top=(rm.F-rm.s)*T,k=rm.s>4?3:2,px=(rm.x+1)*T+2,onP=p=>({x:p.x<(rm.x+3.6)*T?1:0});
   {const g1=G(li,n);bridgeBefore(g1,rm.x+1);line(g1,slots.slice(1),(rm.x+8)*T,rm.F,1);put(g1,0,px,Y);run(g1,0.2);run(g1,1.2,(p,t)=>p.slot===0?{x:t>0.1&&p.x<(rm.x+3.6)*T?1:0,j:t<0.45}:null);ok(P(g1,0).y>top-13,tag+' pillar out of reach alone');}
   const g=G(li,n);bridgeBefore(g,rm.x+1);const sg=g.S.sig[rm.sig];line(g,slots.slice(k),(rm.x+8)*T,rm.F,1);for(let i=0;i<k;i++)put(g,i,px,Y-14*i);run(g,0.4);
   run(g,1.4,(p,t)=>p.slot===k-1?{x:t>0.12?onP(p).x:0,j:t<0.45}:null);const tp=P(g,k-1);ok(tp.y<=top-13&&tp.x>=(rm.x+3)*T-1&&!g.S.deaths,tag+' stack of '+k+' reaches the pillar ('+f(tp.x/T)+','+f(tp.y/T)+')');
   const pl=g.plateDefs.filter(p=>p.sig===rm.sig);ok(pl.length===n,tag+' one button per player');
   pl.forEach((p,i)=>put(g,g.players[i].slot,p.x+5,p.y-14));run(g,0.4);ok(sg.latched&&!g.S.deaths,tag+' all buttons at once open it');}
 });
}
console.log('pass',pass,'fail',fail);if(fail)process.exitCode=1;
