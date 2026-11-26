// Eight-player checks: every level spawns and idles safely, and the puzzles that scale with the team still work.
const HP=require('../public/game.js');
function G(i,n){const g=HP.createGame(i,n);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
function run(g,sec,inp){const n=Math.round(sec/HP.STEP);for(let k=0;k<n;k++){g.players.forEach(p=>{const v=inp?inp(p,k*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false);});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;}}
const P=(g,s)=>g.players.find(p=>p.slot===s);
const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;};
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};const f=v=>Math.round(v*10)/10;
ok(HP.MAXP===8,'eight player cap');
// every level, 5 to 8 players: built for that team size, everyone spawns standing and survives 3 idle seconds
for(let n=5;n<=8;n++)for(let i=0;i<25;i++){const g=G(i,n);ok(g.n===n&&g.players.length===n,'L'+(i+1)+' n'+n+' built for team');run(g,3);
 const bad=g.players.filter(p=>p.dead||!p.grounded);ok(!bad.length&&g.S.deaths===0,'L'+(i+1)+' n'+n+' idle safe (bad '+bad.map(p=>p.slot+':'+f(p.x)+','+f(p.y)).join(' ')+' deaths '+g.S.deaths+' '+g.S.lastCause+')');}
// joining past four rebuilds the level, and a ninth player is refused
{const g=G(12,4);ok(g.plateDefs.length===4,'SO n4 plates');HP.addPlayer(g,4);ok(g.n===5&&g.plateDefs.length===5,'SO rebuilds to 5 on join');for(let s=5;s<8;s++)HP.addPlayer(g,s);ok(g.n===8&&g.plateDefs.length===8,'SO 8 plates at 8');HP.addPlayer(g,8);ok(g.n===8,'n capped at 8');}
// Spread out at 8: seven pressed is not enough, all eight latch the door room open
{const g=G(12,8),pl=g.plateDefs;pl.forEach((p,i)=>put(g,i,p.x+5,p.y-14));put(g,7,300,306);run(g,0.3);ok(!g.S.sig.a.latched,'SO 7 of 8 no latch');put(g,7,pl[7].x+5,pl[7].y-14);run(g,0.3);ok(g.S.sig.a.latched,'SO 8 of 8 latch');
 const xs=pl.map(p=>p.x).sort((a,b)=>a-b);let minGap=1e9;for(let i=1;i<xs.length;i++)minGap=Math.min(minGap,xs[i]-xs[i-1]);const ys=new Set(pl.map(p=>p.y));ok(ys.size>=4,'SO buttons on '+ys.size+' different heights');}
// Hold the door at 8: eight AND buttons that all fit before the stairs
{const g=G(2,8),pl=g.plateDefs.filter(p=>p.and);ok(pl.length===8&&Math.max(...pl.map(p=>p.x))+20<=820,'HD 8 buttons fit');pl.forEach((p,i)=>put(g,i,p.x+5,136));run(g,0.3);ok(g.S.sig.c.latched,'HD all 8 latch');}
// Colour code at 8: purple/green/blue/white each have a button only they can press; gate E opens when all four stand on theirs
{const g=G(10,8),cp=g.plateDefs.filter(p=>p.sig==='e');ok(cp.length===4&&cp.every((p,i)=>p.color===4+i&&p.and),'CC n8 four colour buttons');ok(g.grid[12][98]==='E'&&g.door.x===1040,'CC n8 gate E and door moved');
 g.S.sig.a.latched=g.S.sig.b.latched=g.S.sig.c.latched=g.S.sig.d.latched=true;run(g,0.6);put(g,0,cp[0].x+5,136);put(g,1,cp[1].x+5,136);put(g,2,cp[2].x+5,136);put(g,3,cp[3].x+5,136);run(g,0.3);ok(!g.S.sig.e.latched,'CC wrong colours do nothing');
 for(let k=0;k<4;k++){put(g,k,200+k*12,136);put(g,4+k,cp[k].x+5,136)}run(g,0.3);ok(g.S.sig.e.latched,'CC 5-8 on their colours open gate E');}
// stacked friends count as lift riders: All aboard at 8 needs 5 on the lift and 3 on their heads
{const g=G(6,8),l=g.S.lifts[0];for(let i=0;i<5;i++)put(g,i,140+i*10,136);for(let i=5;i<8;i++)put(g,i,30+i*12,136);run(g,1);ok(l.y>=149,'AA 5 of 8 does not move y='+f(l.y));
 for(let i=5;i<8;i++)put(g,i,141+(i-5)*12,122);run(g,0.3);ok(l.r===8,'AA stacked riders counted r='+l.r);run(g,3);ok(l.y<=81,'AA lift rises with 8 y='+f(l.y));}
// Head count exact lift scales: 4 riders at 8 players
{const g=G(9,8),l=g.S.lifts[0];ok(l.w===40&&g.liftDefs[0].need===4,'HC exact 4 at n8');for(let i=0;i<4;i++)put(g,i,140+i*10,136);for(let i=4;i<8;i++)put(g,i,20+(i-4)*12,136);run(g,0.2);run(g,2.5);ok(l.y<=91,'HC 4 riders move y='+f(l.y));}
// Row together at 8: raft is 8 tiles; it only moves when all 8 aboard push the same way
{const g=G(20,8),r=g.S.rafts[0];ok(r.w===80,'RT raft 8 wide');for(let i=0;i<8;i++)put(g,i,101+i*10,136);run(g,0.3);const x0=r.x;run(g,1,p=>p.slot<7?{x:1}:{x:0});ok(Math.abs(r.x-x0)<0.5,'RT 7 of 8 pushing: no move');run(g,1,()=>({x:1}));ok(r.x>x0+20,'RT all 8 push moves '+f(r.x-x0));}
// door holds everyone
{const g=G(0,8);g.S.key.used=true;g.S.door.open=true;g.players.forEach((p,i)=>{p.inside=true});run(g,0.5);ok(g.S.won,'all 8 inside wins');}
console.log('pass',pass,'fail',fail);if(fail)process.exitCode=1;
