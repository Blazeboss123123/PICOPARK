const HP=require('../public/game.js');
function G(i,n=2){const g=HP.createGame(i);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
function run(g,sec,inp){const n=Math.round(sec/HP.STEP);for(let k=0;k<n;k++){g.players.forEach(p=>{const v=inp?inp(p,k*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false);});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;}}
const P=(g,s)=>g.players.find(p=>p.slot===s);
const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;};
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};
const f=v=>Math.round(v*10)/10;
// Thin ice (4)
{const g=G(4);put(g,0,90,136);put(g,1,40,136);run(g,0.2);run(g,0.6,p=>p.slot===0?{x:1}:null);const x1=P(g,0).x;run(g,0.4);ok(P(g,0).x-x1>8,'ice slide '+f(P(g,0).x-x1));
 const g2=G(4);const c=g2.S.crates[0];put(g2,0,c.x-10,136);put(g2,1,c.x-20,136);run(g2,0.2);run(g2,2.5,()=>({x:1}));const xr=g2.S.crates[0].x;run(g2,0.3,()=>({x:-1}));run(g2,4);ok(g2.S.crates[0].x-xr>15,'ice crate glides '+f(g2.S.crates[0].x-xr));run(g2,6,()=>({x:1}));ok(g2.S.sig.a.on&&!g2.S.sig.a.gate,'ice crate on plate x='+f(g2.S.crates[0].x));
 const g3=G(4);put(g3,0,250,136);put(g3,1,120,136);run(g3,0.2);let k=0;while(P(g3,0).x<287&&k++<300)run(g3,1/120,p=>p.slot===0?{x:1}:null);run(g3,0.1,p=>p.slot===0?{x:1,j:1}:null);k=0;while(!P(g3,0).grounded&&k++<200)run(g3,1/120,p=>p.slot===0?{x:1,j:1}:null);run(g3,0.8,p=>p.slot===0?{x:-1}:null);ok(P(g3,0).y<=126&&P(g3,0).x>=330&&P(g3,0).x<=362&&!P(g3,0).dead,'island landing '+f(P(g3,0).x)+','+f(P(g3,0).y));}
// Head count (9)
{const g=G(9,3);const l=g.S.lifts[0];put(g,0,145,136);put(g,1,60,136);put(g,2,40,136);run(g,1.5);ok(l.y>=149,'HC 1 rider no move');put(g,1,160,136);run(g,0.1);run(g,3);ok(l.y<=91,'HC exact 2 moves y='+f(l.y));
 const g2=G(9,3);const l2=g2.S.lifts[0];put(g2,0,142,136);put(g2,1,152,136);put(g2,2,162,136);run(g2,1.5);ok(l2.y>=149,'HC 3 riders no move y='+f(l2.y));}
// Lights out (11)
{const g=G(11);put(g,0,195,136);run(g,0.3);ok(g.S.torches[1]===1,'torch lit');ok(g.S.torches[2]===0,'other torch unlit');}
// Flip-flop (13)
{const g=G(13);ok(g.S.flip===0,'flip start');put(g,0,60,136);put(g,1,40,136);run(g,0.2);run(g,0.6,p=>p.slot===0?{j:1}:null);ok(g.S.flip===1,'flip toggled by jump');
 // stand P1 on blue platform (cols 10-13 row14) while flip=1, P2 jumps -> P1 falls
 const g2=G(13);g2.S.flip=1;put(g2,0,115,126);put(g2,1,40,136);run(g2,0.3);ok(P(g2,0).grounded,'on blue');run(g2,0.5,p=>p.slot===1?{j:1}:null);ok(g2.S.restartT>0||P(g2,0).y>130,'blue vanished under P1');
 // single player hops across chain
 const g3=G(13,1);put(g3,0,88,136);run(g3,0.2);
 for(let h=0;h<8;h++){const p=P(g3,0);// walk to the right edge of whatever we stand on, then jump right and hold until landed
  const tx=Math.floor((p.x+5)/10),ty=Math.floor((p.y+15)/10);let ex=tx;while(g3.grid[ty][ex+1]&&g3.grid[ty][ex+1]!=='.'&&g3.grid[ty][ex+1]!=='^')ex++;const edge=(ex+1)*10;
  let k=0;while(P(g3,0).x+10<edge-1&&k++<200)run(g3,1/120,()=>({x:1}));
  run(g3,0.1,()=>({x:1,j:1}));k=0;while(!P(g3,0).grounded&&k++<200)run(g3,1/120,()=>({x:1,j:1}));run(g3,0.15,()=>({x:-1}));run(g3,0.1);if(g3.S.deaths)break;}
 ok(P(g3,0).x>=495&&!g3.S.deaths,'flip chain crossed x='+f(P(g3,0).x)+' deaths '+g3.S.deaths+' '+g3.S.cause);}
// Updraft (16)
{const g=G(16);put(g,0,145,136);put(g,1,40,136);run(g,2.2,(p,t)=>p.slot===0?{x:t>1.4?1:0}:null);run(g,0.6);ok(P(g,0).x>=160&&P(g,0).y<=47,'fan1 to ledge '+f(P(g,0).x)+','+f(P(g,0).y));
 const g2=G(16);put(g2,0,345,40);put(g2,1,160,46);run(g2,0.6);ok(g2.S.restartT>0||P(g2,0).y>60,'fan off -> fall');
 const g3=G(16);put(g3,1,262,46);put(g3,0,295,46);run(g3,0.1);run(g3,2.6,p=>p.slot===0?{x:1}:null);ok(!g3.S.deaths&&P(g3,0).x>=470&&P(g3,0).y<=46,'fans carry across '+f(P(g3,0).x)+','+f(P(g3,0).y)+' '+g3.S.cause);
 const g4=G(16);put(g4,0,582,46);put(g4,1,520,46);run(g4,1.5);ok(g4.S.key.carrier!==0,'fan4 off without plate');const g5=G(16);put(g5,1,662,46);put(g5,0,582,46);run(g5,1.5);ok(g5.S.key.carrier===0,'fan4 key with plate held');}
// Relay (17)
{const g=G(17);put(g,0,115,136);put(g,1,60,136);run(g,0.6);ok(g.S.key.carrier===0,'P1 in orange hole has key');
 run(g,0.7,p=>p.slot===0?{j:1,x:-1}:null);run(g,0.4);ok(P(g,0).y<=136,'P1 out '+f(P(g,0).y));
 put(g,0,85,136);put(g,1,96,136);run(g,0.2);run(g,0.1,p=>p.slot===0?{d:1}:null);ok(g.S.key.carrier===1,'key passed to P2');
 put(g,1,660,136);put(g,0,560,66);run(g,0.2);run(g,1.2,p=>p.slot===1?{x:-1}:null);ok(g.S.door.open&&!g.S.sig.a.gate,'teal reached door, hatch open');
 const g2=G(17);put(g2,1,115,136);run(g2,0.5);ok(P(g2,1).y===136,'P2 blocked by orange');}
// Row together (20)
{const g=G(20,2);const r=g.S.rafts[0];put(g,0,r.x+10,136);put(g,1,r.x+30,136);run(g,0.3);run(g,1,p=>p.slot===0?{x:1}:null);ok(Math.abs(r.x-100)<0.5,'raft needs all pushing');
 run(g,1,()=>({x:1}));ok(r.x>130&&!P(g,0).dead,'raft moves x='+f(r.x));const rx=r.x;run(g,0.5,p=>({x:p.slot?1:-1}));ok(Math.abs(r.x-rx)<0.5,'raft stops on disagreement');
 ok(P(g,0).x>r.x&&P(g,0).x<r.x+r.w,'P on raft');
 const g2=G(20,2);const r2=g2.S.rafts[0];put(g2,0,r2.x+40,136);put(g2,1,40,136);run(g2,0.2);run(g2,1.5,p=>p.slot===0?{x:1}:null);ok(Math.abs(r2.x-100)<0.5,'raft waits for all aboard');ok(!g2.S.deaths&&P(g2,0).x+10<=r2.x+r2.w+0.01,'rail: pushing alone does not walk you off into the lava x='+f(P(g2,0).x));
 put(g2,1,92,136);run(g2,0.2);ok(r2.n===1,'someone on the shore is not aboard n='+r2.n);}
// Conveyor (21)
{const g=G(21);put(g,0,150,136);put(g,1,40,136);run(g,0.5);ok(P(g,0).x>165,'belt carries '+f(P(g,0).x));
 const g2=G(21);put(g2,0,645,136);put(g2,1,770,136);run(g2,0.2);ok(g2.S.sig.a.on,'plate on belt');run(g2,1.5,p=>p.slot===0?{x:-1}:null);ok(P(g2,0).x<645,'walk against belt '+f(P(g2,0).x));}
// Crushers (22)
{const g=G(22);put(g,0,205,136);put(g,1,40,136);run(g,3.2);ok(g.S.restartT>0||g.S.deaths>0,'crushed under '+g.S.cause);
 const g2=G(22);put(g2,0,575,136);put(g2,1,400,136);run(g2,3);ok(g2.S.crush.slice(0,4).every(c=>c.y<=60.5),'plate stops crushers');
 const g3=G(22);put(g3,0,600,136);put(g3,1,560,136);let w=0;while(!(Math.abs(g3.S.crush[4].y-130)<0.5&&HP.crushPhase(g3,4).ph<HP.crushPhase(g3,4).T.waitT+HP.crushPhase(g3,4).T.dropT+0.2)&&w++<2000)run(g3,1/120);put(g3,0,650,116);let minY=999;for(let i=0;i<40;i++){run(g3,0.1);minY=Math.min(minY,P(g3,0).y)}ok(minY<=57&&!g3.S.deaths,'crusher lift rides up minY='+f(minY)+' '+g3.S.lastCause);}
// The peak (24)
{const g=G(24,2);const l=g.S.lifts[0];put(g,0,505,136);put(g,1,520,136);run(g,0.2);run(g,3);ok(l.y<=81,'peak lift up');
 const c=g.S.crush[0];let maxB=0;for(let i=0;i<40;i++){run(g,0.1);maxB=Math.max(maxB,c.y+c.h)}ok(Math.abs(maxB-80)<0.6,'peak crusher hits floor '+f(maxB));}
console.log('pass',pass,'fail',fail);
