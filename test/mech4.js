// Player-count scaling and teamwork checks.
const HP=require('../public/game.js');const BOT=require('./bot.js');
function G(i,n){const g=HP.createGame(i,n);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
function run(g,sec,inp){const n=Math.round(sec/HP.STEP);for(let k=0;k<n;k++){g.players.forEach(p=>{const v=inp?inp(p,k*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false);});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;}}
const P=(g,s)=>g.players.find(p=>p.slot===s);
const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;};
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};const f=v=>Math.round(v*10)/10;
// stack k players at (x, floorY) and have the top one jump toward dir; returns top player's best (lowest) y
function stackJump(g,k,x,floorY,dir,park){g.players.forEach((p,i)=>{if(i<k){put(g,p.slot,x,floorY-14*(i+1))}else put(g,p.slot,park+(i-k)*12,floorY-14)});run(g,0.4);const top=P(g,k-1);let best=999;
 run(g,1.0,(p,t)=>p.slot===k-1?{x:t>0.12?dir:0,j:t<0.45}:null);g.players.forEach(p=>best=Math.min(best,p.y));return top}
// L1 at 3 players: wall is 5 tiles; two-stack fails, three-stack works
{const g=G(0,3);ok(g.grid[10][20]==='#'&&g.grid[9][20]==='.','L1 n3 wall height 5');const top=stackJump(g,2,155,150,1,60);ok(top.y>100,'L1 n3 two-stack fails y='+f(top.y));
 const g2=G(0,3);const t2=stackJump(g2,3,155,150,1,60);ok(t2.y<=86&&t2.x>=170,'L1 n3 three-stack climbs '+f(t2.x)+','+f(t2.y));}
// L1 at 2 players still 4 tiles and two-stack works
{const g=G(0,2);const t=stackJump(g,2,155,150,1,60);ok(t.y<=96,'L1 n2 two-stack climbs '+f(t.y));}
// Hold the door at 3: three AND buttons; two pressed is not enough
{const g=G(2,3);ok(g.plateDefs.filter(p=>p.and).length===3,'L3 n3 three AND plates');put(g,0,522,136);put(g,1,602,136);put(g,2,400,136);run(g,0.3);ok(!g.S.sig.c.latched,'L3 two of three no latch');put(g,2,682,136);run(g,0.3);ok(g.S.sig.c.latched,'L3 three latch');
 const g4=G(2,4);ok(g4.plateDefs.filter(p=>p.and).length===4,'L3 n4 four AND plates');}
// Heavy lifting at 3: crate needs everyone
{const g=G(1,3);const c=g.S.crates[0];put(g,0,c.x-10,136);put(g,1,c.x-20,136);put(g,2,c.x-30,136);run(g,0.2);run(g,1,p=>p.slot<2?{x:1}:null);ok(Math.abs(g.S.crates[0].x-80)<0.5,'L2 n3 two pushers not enough');run(g,1,()=>({x:1}));ok(g.S.crates[0].x>95,'L2 n3 three push');}
// Heavy lifting wall: needs crate + stack (no stack from ground)
{const g=G(1,2);g.S.sig.a.latched=true;const c=g.S.crates[1];c.x=430;run(g,0.2);const top=stackJump(g,2,445,130,1,380);ok(top.y<=76&&top.x>=460,'L2 crate+stack climbs '+f(top.x)+','+f(top.y));
 const g2=G(1,2);g2.S.sig.a.latched=true;g2.S.crates[1].x=350;run(g2,0.2);const t2=stackJump(g2,2,445,150,1,380);ok(t2.y>90,'L2 stack without crate fails '+f(t2.y));}
// Spread out at 2: left ledge needs a stack from the plank; both buttons open the door room
{const g=G(12,2);ok(g.plateDefs.length===2&&g.LH===340,'SO n2 two plates, tall level');const top=stackJump(g,2,128,230,-1,300);ok(top.y<=176&&top.x<=110,'SO stack to left ledge '+f(top.x)+','+f(top.y));
 const g1=G(12,2);const t1=stackJump(g1,1,128,230,-1,300);ok(t1.y>180,'SO single cannot reach ledge '+f(t1.y));
 const g2=G(12,2);put(g2,0,32,176);put(g2,1,562,306);run(g2,0.4);ok(g2.S.sig.a.latched&&!g2.S.sig.a.gate,'SO both buttons open gates');ok(g2.S.zoom<0.7,'SO camera zoomed out '+f(g2.S.zoom));
 const g3=G(12,3);ok(g3.plateDefs.length===3,'SO n3 three plates');const l=g3.S.lifts[0];put(g3,0,l.x+10,306);put(g3,1,60,306);put(g3,2,90,306);run(g3,0.2);run(g3,7);ok(l.y<=101,'SO lift takes one rider up y='+f(l.y));run(g3,0.6,p=>p.slot===0?{x:1}:null);ok(P(g3,0).y<=86&&P(g3,0).x>=250,'SO rider steps onto mid platform '+f(P(g3,0).x)+','+f(P(g3,0).y));}
// Spread out key: spring up to ledge, then stack to the key shelf
{const g=G(12,2);put(g,0,600,280);put(g,1,530,306);run(g,1.6,(p,t)=>p.slot===0?{x:t>0.25?-1:0}:null);ok(P(g,0).y<=216&&P(g,0).x<580,'SO spring to ledge '+f(P(g,0).x)+','+f(P(g,0).y));
 const g2=G(12,2);const top=stackJump(g2,2,505,230,-1,560);ok(g2.S.key.carrier>=0||top.y<=176,'SO stack to key shelf '+f(top.x)+','+f(top.y)+' carrier '+g2.S.key.carrier);}
// The climb: block to T2 needs a stack; camera follows upward
{const g=G(23,2);const t1=stackJump(g,1,54,300,1,200);ok(t1.y>250,'climb single cannot reach T2 '+f(t1.y));const g2=G(23,2);const t2=stackJump(g2,2,54,300,1,200);ok(t2.y<=246&&t2.x>=68,'climb stack reaches T2 '+f(t2.x)+','+f(t2.y));ok(g2.S.camY<g2.LH-180,'climb camera moved up camY='+f(g2.S.camY));}
// Colour code at 4: pink and yellow have their own jobs
{const g=G(10,4);ok(g.grid[15][52]==='3'&&g.grid[15][66]==='4','CC n4 pink and yellow pits');put(g,1,515,136);put(g,0,400,136);put(g,2,380,136);put(g,3,360,136);run(g,0.5);ok(P(g,1).y===136,'CC teal cannot enter pink pit');put(g,2,515,136);run(g,0.5);ok(g.S.sig.c.on,'CC pink pulls lever');}
// Relay at 3: stairs only after pink pulls lever
{const g=G(17,3);ok(g.grid[14][44]==='b','Relay n3 stairs are signal blocks');put(g,2,255,136);put(g,0,200,136);put(g,1,180,136);run(g,0.5);ok(g.S.sig.b.on,'Relay pink builds stairs');}
// Joining mid-level adapts and restarts the layout
{const g=G(0,2);run(g,0.5);HP.addPlayer(g,2);ok(g.n===3&&g.grid[10][20]==='#','adapt on join');HP.removePlayer(g,2);ok(g.n===2&&g.grid[10][20]==='.','adapt on leave');}
console.log('pass',pass,'fail',fail);
