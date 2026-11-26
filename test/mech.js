const HP=require('../public/game.js');
const T=HP.TS;
function G(i,n=2){const g=HP.createGame(i);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
function run(g,sec,inp){const n=Math.round(sec/HP.STEP);for(let k=0;k<n;k++){g.players.forEach(p=>{const v=inp?inp(p,k*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false);});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;}}
const P=(g,s)=>g.players.find(p=>p.slot===s);
const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;};
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};
// L1: single can't climb 4-tile wall; stack can
{const g=G(0);put(g,0,150,136);put(g,1,60,136);run(g,0.3);run(g,1,(p)=>p.slot===0?{x:1,j:1}:null);ok(P(g,0).y>130,'L1 single blocked');
 put(g,0,155,136);put(g,1,155,121);run(g,0.4);run(g,0.9,(p,t)=>p.slot===1?{x:t>0.12?1:0,j:t<0.5}:null);ok(P(g,1).y<=97,'L1 stack climbs '+P(g,1).y);}
// L2: crate needs 2; onto plate opens gate
{const g=G(1);const c=g.S.crates[0];put(g,0,c.x-10,136);put(g,1,c.x-20,136);run(g,0.2);run(g,1,(p)=>p.slot===0?{x:1}:null);ok(Math.abs(g.S.crates[0].x-80)<0.5,'L2 one pusher no move');
 run(g,9,()=>({x:1}));ok(g.S.crates[0].x>=268&&g.S.sig.a.on&&!g.S.sig.a.gate,'L2 crate on plate opens gate x='+g.S.crates[0].x);}
// L3: AND plates latch, timed plate
{const g=G(2);put(g,0,282,96);put(g,1,240,136);run(g,0.2);ok(g.S.sig.b.on,'L3 timed on');run(g,0.25,(p)=>p.slot===0?{x:-1}:null);run(g,4.0);ok(g.S.sig.b.on,'L3 timed still on');run(g,1.2);ok(!g.S.sig.b.on,'L3 timed expired');
 put(g,0,522,136);put(g,1,602,136);run(g,0.3);ok(g.S.sig.c.latched,'L3 AND latched');run(g,0.5,(p)=>({x:1}));ok(g.S.sig.c.on,'L3 stays on');}
// L4: red light kills movement
{const g=G(3);run(g,3.4+1.0+0.3);ok(g.S.light.ph===2,'L4 red phase');run(g,0.1,(p)=>p.slot===0?{x:1}:null);ok(g.S.restartT>0&&g.S.cause==='red','L4 caught on red');}
// L5: rope keeps players together
{const g=G(5);put(g,0,40,136);put(g,1,30,136);run(g,2,(p)=>p.slot===0?{x:1}:null);const d=Math.hypot(P(g,0).x-P(g,1).x,P(g,0).y-P(g,1).y);ok(d<60,'L5 rope dist '+d.toFixed(1));ok(P(g,1).x>60,'L5 dragged');}
// L6: lift needs all
{const g=G(6);put(g,0,150,136);put(g,1,60,136);run(g,1);ok(g.S.lifts[0].y>=149,'L6 lift waits');put(g,1,165,136);run(g,0.1);run(g,3);ok(g.S.lifts[0].y<=81,'L6 lift up y='+g.S.lifts[0].y);
 run(g,0.6,()=>({x:1}));const l2=g.S.lifts[1];put(g,0,l2.x+5,66);put(g,1,l2.x+25,66);run(g,7);ok(l2.x>=579,'L6 ferry x='+l2.x);}
// L7: balance - crate on A + player on B -> B up to ledge
{const g=G(7);run(g,4,()=>({x:1}));run(g,0.3);const b=g.S.bals[0];put(g,0,20,106);put(g,1,b.pans[1].x+15,b.pans[1].y-14);run(g,2.5);ok(Math.abs(b.pans[1].y-80)<1,'L7 B up y='+b.pans[1].y+' wa='+b.wa+' wb='+b.wb);run(g,1.5,(p)=>p.slot===1?{x:1}:null);ok(P(g,1).x>262&&P(g,1).y<=66,'L7 on ledge '+P(g,1).x+','+P(g,1).y);}
// L8: colour floor - P1 drops, P2 doesn't
{const g=G(10);put(g,0,195,136);put(g,1,240,136);run(g,0.5);ok(P(g,0).y>145,'L8 P1 dropped y='+P(g,0).y);ok(P(g,1).y===136,'L8 P2 stays');ok(g.S.sig.a.on,'L8 lever pulled');
 run(g,0.6,(p)=>p.slot===0?{j:1,x:1}:null);ok(P(g,0).y<=136,'L8 P1 jumps out y='+P(g,0).y);
 put(g,0,795,136);put(g,1,770,136);run(g,0.5);ok(P(g,0).y===136,'L8 P1 blocked by teal ice');}
// L9: spring to ledge
{const g=G(8);put(g,0,95,136);put(g,1,40,136);run(g,1.6,(p,t)=>p.slot===0?{x:1,j:t<0.3}:null);ok(P(g,0).y<=56&&P(g,0).x>=135,'L9 sprung onto ledge '+P(g,0).x+','+P(g,0).y);
 const g2=G(8);put(g2,0,475,136);put(g2,1,595,136);run(g2,0.3);ok(!g2.S.sig.a.gate,'L9 lid open');run(g2,1.3,(p,t)=>p.slot===1?{x:t>0.45?1:0,j:t<0.3}:null);ok(P(g2,1).y<=46&&P(g2,1).x>=615,'L9 lid spring to ledge '+P(g2,1).x+','+P(g2,1).y);}
// L10: bridge breaks with 2
{const g=G(12);put(g,0,420,306);put(g,1,440,306);run(g,0.6);ok(g.S.restartT>0||g.S.bridges[0].st>0,'L13 bridge broke');const g2=G(12);put(g2,0,420,306);run(g2,0.5);ok(g2.S.bridges[0].st===0,'L13 one ok');}
// L13: big crate needs all and drops into hole
{const g=G(18,3);run(g,0.1);put(g,0,170,136);put(g,1,158,136);put(g,2,146,136);run(g,0.2);run(g,1,(p)=>p.slot<2?{x:1}:null);ok(Math.abs(g.S.crates[0].x-180)<0.5,'L13 two not enough');run(g,9,()=>({x:1}));ok(g.S.crates[0].y>=129,'L13 crate in hole y='+g.S.crates[0].y+' x='+g.S.crates[0].x);}
// L14: autoscroll squash
{const g=G(19);run(g,2.2);put(g,0,g.S.cam+290,136);put(g,1,g.S.cam+2,136);const c=g.S.crates;run(g,0.4);ok(g.S.cam>0,'L14 scrolling');
 const g2=G(19);run(g2,0.1);put(g2,0,290,116);put(g2,1,282,136);run(g2,14);ok(g2.S.deaths>=1&&['squash','spikes'].includes(g2.S.cause),'L14 squash cause='+g2.S.cause);}
// L15: alcove lever by P1 jump; P2 can't
{const g=G(23);put(g,1,108,246);put(g,0,90,246);run(g,0.3);run(g,0.6,(p)=>p.slot===1?{j:1}:null);ok(!g.S.sig.b.on,'climb P2 cannot pull');put(g,1,140,246);put(g,0,108,246);run(g,0.1);run(g,0.6,(p)=>p.slot===0?{j:1}:null);ok(g.S.sig.b.on&&!g.S.sig.b.gate,'climb P1 pulls lever, hatch open '+g.S.lastCause);}
// key + door + win (L1)
{const g=G(0);put(g,0,320,96);put(g,1,330,96);g.S.sig.a.latched=true;const k=g.S.key;put(g,0,k.x-5,56);run(g,0.3);ok(g.S.key.carrier===0,'key picked');put(g,0,522,96);put(g,1,528,80);run(g,0.5);ok(g.S.door.open,'door open');run(g,0.1,()=>({d:1}));run(g,0.3);ok(g.S.won,'win');}
console.log('pass',pass,'fail',fail);
