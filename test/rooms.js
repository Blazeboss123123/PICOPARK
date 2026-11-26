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
function line(g,slots,x,F,dir){const taken=[];slots.forEach(s=>{const sx=spot(g,x,F,dir,taken);if(sx!=null)put(g,s,sx,F*T-14)})}
// fill any crate gaps before x with their crates, so the team can be placed anywhere
function bridgeBefore(g,x){g.rooms.forEach(r=>{if(r.t==='crate'&&r.x<x){const c=g.S.crates.find(c=>Math.abs(c.x-(r.x+2)*T)<1);if(c){c.x=(r.x+12)*T;c.y=r.F*T}}})}
for(let li=0;li<HP.LEVELS.length;li++)for(const n of [2,3,5,8]){
 const g0=G(li,n);if(!g0.rooms.length)continue;const name=g0.name+' n'+n;
 g0.rooms.forEach(rm=>{const Y=rm.F*T-14,tag=name+' '+rm.t+'@'+rm.x,slots=[...Array(n).keys()];
  if(rm.t==='crate'){
   {const g=G(li,n);bridgeBefore(g,rm.x);const c=g.S.crates.find(c=>Math.abs(c.x-(rm.x+2)*T)<1);c.x-=300;line(g,slots.slice(1),(rm.x-1)*T,rm.F,-1);put(g,0,(rm.x+9)*T,Y);run(g,0.2);run(g,1.6,(p,t)=>p.slot===0?{x:1,j:t>0.28&&t<0.6}:null);ok(P(g,0).x<(rm.x+17)*T||g.S.deaths>0,tag+' gap is too wide to jump alone ('+f(P(g,0).x/T)+')');}
   {const g=G(li,n);bridgeBefore(g,rm.x);const c=g.S.crates.find(c=>Math.abs(c.x-(rm.x+2)*T)<1);line(g,slots,c.x-10.5,rm.F,-1);run(g,0.3);
    let t=0;while(t<12&&!(c.y>=rm.F*T-0.5)){run(g,0.1,()=>({x:1}));t+=0.1}ok(Math.abs(c.y-rm.F*T)<0.6&&Math.abs(c.x-(rm.x+12)*T)<1,tag+' team pushed the crate into the gap ('+f(c.x/T)+','+f(c.y/T)+')');
    const goal=(rm.x+17)*T;run(g,0.3);run(g,4,p=>({x:1,j:false}));ok(g.players.every(p=>p.x>=goal-1)&&!g.S.deaths,tag+' everyone crossed ('+g.players.map(p=>f(p.x/T)).join(',')+') '+g.S.lastCause);}
  }
  if(rm.t==='gate'){
   const g=G(li,n);bridgeBefore(g,rm.x+1);const sg=g.S.sig[rm.sig],L=(rm.x+1)*T+4,R=(rm.x+8)*T+4,past=(rm.x+6)*T;
   put(g,0,L,Y);line(g,slots.slice(1),rm.x*T-6,rm.F,-1);run(g,0.4);ok(sg.on,tag+' left button opens it');
   run(g,4,(p,t)=>p.slot===0?null:{x:p.x<past+6+(n-1)*11?1:0,j:p.x<past+6&&(t%0.7)<0.35});ok(g.players.every(p=>p.slot===0||p.x>=past),tag+' the others got through ('+g.players.map(p=>f(p.x/T)).join(',')+')');
   put(g,1,R,Y);run(g,0.3);run(g,1.5,p=>p.slot===0?{x:p.x<past+4?1:0}:null);ok(P(g,0).x>=past&&!g.S.deaths,tag+' holder let through from the far side '+g.S.lastCause);
   const g2=G(li,n);bridgeBefore(g2,rm.x+1);line(g2,slots,rm.x*T-6,rm.F,-1);run(g2,0.3);ok(!g2.S.sig[rm.sig].on,tag+' closed when nobody holds it');}
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
