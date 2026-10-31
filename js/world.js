// Animated pixel lake that follows the time of day in Vietnam (dawn, day, sunset, dusk, night + aurora). No dependencies.
/* ===== pixel heart ===== */
(()=>{const h=document.getElementById("heart");if(!h)return;const c=h.getContext("2d");
const m=["..XX..XX..",".XPPX.XPPX","XPWPPXPPPX","XPPPPPPPPX","XPPPPPPPPX",".XPPPPPPX.","..XPPPPX..","...XPPX...","....XX...."];
const col={X:"#2E5566",P:"#FF9CC6",W:"#FFFFFF"};
m.forEach((r,y)=>[...r].forEach((ch,x)=>{if(col[ch]){c.fillStyle=col[ch];c.fillRect(x,y,1,1)}}));})();

/* ===== the world, now following the time of day ===== */
const cv=document.getElementById("world"),ctx=cv.getContext("2d");
const still=matchMedia("(prefers-reduced-motion: reduce)").matches;
let W,H,HZ,LB,K,bg,clouds,stars,snow,cabin={},t0=performance.now();
function rnd(s){return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}}

// Palettes per moment of the day (no purple anywhere: nights are deep teal-navy).
const PAL={
 night:{sky:["#0E2236","#12293F","#163049","#1A3852","#1E405B","#234863","#29506B","#2E5872"],sun:"#F4F7FF",glow:"#9FB8D6",
  far:"#2C4E66",farS:"#253F55",near:"#21435A",nearS:"#1B384C",snow:"#C9DCEB",snowP:"#B7CDE0",snowS:"#9DB6CB",
  lake:["#24465F","#1F3F57","#1B384F","#173147","#142B40"],refF:"#2A4D66",refN:"#22435A",shim:"#9FC3DD",
  ground:"#C7D9E8",groundS:"#B3C8DA",groundD:"#9DB5CA",pine:"#2B5E5B",pineD:"#214D4B",cloud:"#35566F",cloudS:"#2B4A61"},
 dawn:{sky:["#9CC9E8","#B5D6EC","#CFE2EE","#E6E8EE","#F8E3E4","#FFD9D6","#FFD3C6","#FFD8B8"],sun:"#FFF3DC",glow:"#FFE2C4",
  far:"#B3D2E2",farS:"#9DC2D6",near:"#8CB9CF",nearS:"#76A7C0",snow:"#FFF6F4",snowP:"#FFE0D8",snowS:"#E0EEF5",
  lake:["#FFDCD3","#CDE7F0","#B2DCEA","#9BD0E3","#8AC6DD"],refF:"#C2E0EC",refN:"#A8D2E2",shim:"#FFFFFF",
  ground:"#FFFFFF",groundS:"#E6F2F7",groundD:"#CFE6EF",pine:"#4A9A92",pineD:"#3A847E",cloud:"#FFFFFF",cloudS:"#FFE3EA"},
 day:{sky:["#5EC3EA","#72CBEC","#86D3EE","#9ADBF0","#AEE2F2","#C2E9F4","#D3EFF6","#E2F4F8"],sun:"#FFFBEA",glow:"#FFF2C8",
  far:"#B7DCEA",farS:"#A0CEE0",near:"#86C2D6",nearS:"#6FB0C7",snow:"#FFFFFF",snowP:"#F4FBFF",snowS:"#DCEFF7",
  lake:["#C9EEF8","#A8E1F2","#8ED6EC","#7CCBE5","#6EC1DE"],refF:"#BFE4EF",refN:"#9CD4E5",shim:"#FFFFFF",
  ground:"#FFFFFF",groundS:"#E5F3F8",groundD:"#CDE7F0",pine:"#3F938C",pineD:"#2F7C78",cloud:"#FFFFFF",cloudS:"#E6F4FA"},
 sunset:{sky:["#86D3EA","#9EDCEE","#B9E5F0","#D6E6EE","#F2DCE6","#FFCFDC","#FFC3D0","#FFC8BC"],sun:"#FFF1E6",glow:"#FFDCCF",
  far:"#A9D6E4",farS:"#93C7D9",near:"#7DBBD0",nearS:"#66A9C1",snow:"#FFF4F7",snowP:"#FFD7E3",snowS:"#DDEFF6",
  lake:["#FFD3DF","#C8EAF2","#A9DFEC","#93D4E6","#82CADF"],refF:"#BCE3EE",refN:"#9ED3E3",shim:"#FFFFFF",
  ground:"#FFFFFF",groundS:"#E2F3F8",groundD:"#CBE7F0",pine:"#3F938C",pineD:"#2F7C78",cloud:"#FFFFFF",cloudS:"#FFE3EA"},
 dusk:{sky:["#3F7391","#5A87A0","#7C9DB0","#A9B3BE","#D6B8C2","#F0B7C2","#F7B4B8","#F5B9A8"],sun:"#FFD9C4",glow:"#F7B9A8",
  far:"#6F98AE",farS:"#5E879E",near:"#527F97",nearS:"#456F86",snow:"#EADFE6",snowP:"#F3C9D3",snowS:"#B8CFDB",
  lake:["#F0BFC8","#8FB7CA","#7AA8BE","#6799B1","#5A8BA5"],refF:"#86AEC2",refN:"#6E9AB1",shim:"#F6E6EC",
  ground:"#EEF3F7",groundS:"#D6E3EC",groundD:"#BED2DF",pine:"#356F6C",pineD:"#2A5F5D",cloud:"#E8C9D2",cloudS:"#C9A9B6"}
};
const KEYS=[[0,"night"],[5,"night"],[6.5,"dawn"],[9.5,"day"],[15.5,"day"],[17.5,"sunset"],[19.2,"dusk"],[20.4,"night"],[24,"night"]];
const FIXED={trunk:"#9C6B5B",wall:"#FFC9B0",wallS:"#F2AE96",roof:"#E8879F",roofD:"#D06F8A",win:"#FFE08A",door:"#B9776E",
  hull:"#F08FA8",sail:"#FFFFFF",mast:"#2E5566",lights:["#FF9CC6","#FFE08A","#8EE3F0","#FFFFFF"]};
const hx=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const mix=(a,b,t)=>"#"+hx(a).map((v,i)=>Math.round(v+(hx(b)[i]-v)*t).toString(16).padStart(2,"0")).join("");
function paletteAt(h){
  let i=0;while(i<KEYS.length-2&&h>=KEYS[i+1][0])i++;
  const [h0,a]=KEYS[i],[h1,b]=KEYS[i+1],t=h1===h0?0:Math.min(1,Math.max(0,(h-h0)/(h1-h0)));
  const A=PAL[a],B=PAL[b],o={...FIXED};
  for(const k in A)o[k]=Array.isArray(A[k])?A[k].map((c,j)=>mix(c,B[k][j],t)):mix(A[k],B[k],t);
  return o;
}
// 0 = full day, 1 = full night
function nightness(h){if(h>=20.4||h<5)return 1;if(h>=19.2)return(h-19.2)/1.2;if(h<6.5)return 1-(h-5)/1.5;return 0}
let HOUR=17.5,C=paletteAt(HOUR),NF=0;

function px(g,x,y,w,h,c){g.fillStyle=c;const k=g===ctx?K:1;g.fillRect(Math.round(x*k)/k,Math.round(y*k)/k,Math.max(1/k,Math.round(w*k)/k),Math.max(1/k,Math.round(h*k)/k))}
function bpx(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x|0,y|0,Math.max(1,w|0),Math.max(1,h|0))}
function farRidge(x){return HZ-(18+9*Math.sin(x*.07+1.3)+6*Math.sin(x*.19+.4)+3*Math.sin(x*.47+2))}
function nearRidge(x){const d=Math.abs(x-W/2)/(W/2);const k=Math.max(0,(d-.3)/.7);return HZ-(k*k*(H*.5)+k*(5*Math.sin(x*.21)+3*Math.sin(x*.53+1)))}
function pine(g,x,base,h){bpx(g,x,base-2,1,2,C.trunk);
  for(let i=0;i<h;i++){const w=1+Math.floor((i%Math.ceil(h/3))*.9)+Math.floor(i/(h/3));const y=base-2-h+i;
    bpx(g,x-w,y,w,1,C.pine);bpx(g,x,y,w+1,1,C.pineD);if(i%Math.ceil(h/3)===0)bpx(g,x-w+1,y,w,1,C.snow)}}

function buildStatic(){
  bg=document.createElement("canvas");bg.width=W;bg.height=H;const g=bg.getContext("2d");
  const n=C.sky.length,bh=HZ/n;
  for(let i=0;i<n;i++){bpx(g,0,Math.floor(i*bh),W,Math.ceil(bh)+1,C.sky[i]);if(i>0)for(let x=(i%2);x<W;x+=2)bpx(g,x,Math.floor(i*bh)-1,1,1,C.sky[i])}
  // sun arcs across the day; moon at night
  const r=Math.max(7,Math.round(H*.08));
  if(NF<1){const p=Math.min(1,Math.max(0,(HOUR-5.8)/(19.8-5.8))),sx=Math.round(W*(.18+.64*p)),sy=Math.round(HZ*(.92-.62*Math.sin(Math.PI*p)));
    for(let y=-r-4;y<=r+4;y++)for(let x=-r-4;x<=r+4;x++){const d=Math.hypot(x,y);
      if(d<=r)bpx(g,sx+x,sy+y,1,1,C.sun);else if(d<=r+4&&(x+y)%2===0)bpx(g,sx+x,sy+y,1,1,C.glow)}
    for(let y=HZ+1;y<LB;y+=2){const w=Math.max(2,r*1.4-(y-HZ)*.8|0);bpx(g,sx-w/2,y,w,1,(y-HZ)%4?C.sun:C.snowP)}
    cabin.sunX=sx}
  if(NF>0){const mx=Math.round(W*.76),my=Math.round(HZ*.22),mr=Math.max(5,Math.round(H*.05));
    for(let y=-mr-3;y<=mr+3;y++)for(let x=-mr-3;x<=mr+3;x++){const d=Math.hypot(x,y);
      if(d<=mr)bpx(g,mx+x,my+y,1,1,(Math.hypot(x-mr*.4,y+mr*.2)<mr*.35||Math.hypot(x+mr*.3,y-mr*.35)<mr*.22)?"#D9E3F0":"#F4F7FF");
      else if(d<=mr+3&&(x+y)%2===0&&NF>.5)bpx(g,mx+x,my+y,1,1,"#4E6E8A")}
    for(let y=HZ+2;y<LB;y+=3)bpx(g,mx-2,y,4,1,"#C9DCEB")}
  for(let x=0;x<W;x++){const ry=Math.round(farRidge(x)),sh=farRidge(x+1)>farRidge(x);
    bpx(g,x,ry,1,HZ-ry,sh?C.farS:C.far);if(HZ-ry>20)bpx(g,x,ry,1,Math.min(5,HZ-ry-17),sh?C.snowS:C.snowP)}
  for(let x=0;x<W;x++){const ry=Math.round(nearRidge(x));if(ry>=HZ)continue;const sh=nearRidge(x+1)>nearRidge(x);
    bpx(g,x,ry,1,HZ-ry,sh?C.nearS:C.near);
    if(HZ-ry>H*.2)bpx(g,x,ry,1,5+((x*7)%4),sh?C.snowS:C.snowP);else if(HZ-ry>H*.1)bpx(g,x,ry,1,2,sh?C.snowS:C.snow)}
  const lr=C.lake.length,lh=(LB-HZ)/lr;
  for(let i=0;i<lr;i++)bpx(g,0,HZ+Math.floor(i*lh),W,Math.ceil(lh)+1,C.lake[i]);
  for(let x=0;x<W;x++){const fr=HZ-farRidge(x),nr=HZ-Math.min(HZ,nearRidge(x));
    for(let y=0;y<Math.min(LB-HZ,fr*.55);y++)if((y+x)%3)bpx(g,x,HZ+y,1,1,C.refF);
    for(let y=0;y<Math.min(LB-HZ,nr*.6);y++)if((y+x)%3)bpx(g,x,HZ+y,1,1,C.refN)}
  const R=rnd(7);
  for(let x=2;x<W;x+=3+Math.floor(R()*4)){const ny=Math.round(nearRidge(x));if(Math.abs(x-W/2)<W*.18)continue;pine(g,x,Math.min(HZ,ny+6)+1,4+Math.floor(R()*4))}
  for(let x=0;x<W;x++){const top=LB+Math.round(1.5*Math.sin(x*.12)+Math.sin(x*.31));
    bpx(g,x,top,1,H-top,C.ground);bpx(g,x,top+1,1,2,C.groundS);if((x*13)%9===0)bpx(g,x,top+4+(x%5),2,1,C.groundD)}
  for(let i=0;i<W*.3;i++){const x=Math.floor(R()*W),y=LB+4+Math.floor(R()*(H-LB-5));bpx(g,x,y,1,1,C.groundS)}
  pine(g,Math.round(W*.06),H-2,14);pine(g,Math.round(W*.12),H-4,10);pine(g,Math.round(W*.93),H-1,16);
  const cx=Math.round(W*.76),cb=LB+Math.round((H-LB)*.6),cw=14,ch=8;
  bpx(g,cx,cb-ch,cw,ch,mix(C.wall,"#5C4A5A",NF*.55));bpx(g,cx+cw-3,cb-ch,3,ch,mix(C.wallS,"#4A3C4A",NF*.55));
  for(let i=0;i<6;i++)bpx(g,cx-2+i,cb-ch-1-i,cw+4-2*i,1,i<2?C.roofD:C.snow);
  bpx(g,cx-2,cb-ch-1,cw+4,1,C.roof);bpx(g,cx+cw-5,cb-ch-8,2,5,C.door);bpx(g,cx+cw-5,cb-ch-8,2,1,C.snow);
  bpx(g,cx+2,cb-6,3,3,C.win);bpx(g,cx+8,cb-4,2,4,C.door);bpx(g,cx-1,cb,cw+2,1,C.groundD);
  // warm window light spilling on the snow at night
  if(NF>.3)for(let i=0;i<5;i++)for(let x=0;x<3+i*2;x++)if((x+i)%2===0)bpx(g,cx+3-i+x,cb+1+i,1,1,"#FFE9B0");
  cabin={...cabin,x:cx,b:cb,w:cw,h:ch};
}
function resize(){
  const s=Math.max(3,Math.round(Math.min(innerHeight/150,innerWidth/120)));
  W=Math.ceil(innerWidth/s);H=Math.ceil(innerHeight/s);HZ=Math.round(H*.58);LB=Math.round(H*.8);
  K=Math.max(1,Math.min(6,Math.round(s*(devicePixelRatio||1))));
  cv.width=W*K;cv.height=H*K;ctx.setTransform(K,0,0,K,0,0);ctx.imageSmoothingEnabled=false;
  const R=rnd(42);
  clouds=Array.from({length:Math.max(3,Math.round(W/45))},()=>({x:R()*W,y:4+R()*HZ*.4,s:.6+R()*.8,v:1.2+R()*1.6}));
  stars=Array.from({length:Math.round(W/4)},()=>({x:Math.round(R()*W),y:Math.round(R()*HZ*.7),p:R()*6.28}));
  snow=Array.from({length:Math.round(W*.7)},()=>({x:R()*W,y:R()*H,v:3+R()*5,p:R()*6.28,big:R()<.25}));
  buildStatic();if(still)paint(performance.now());
}
function setHour(h){HOUR=(h+24)%24;C=paletteAt(HOUR);NF=nightness(HOUR);if(W){buildStatic();if(still)paint(performance.now())}
  document.documentElement.dataset.night=NF>.5?"1":"0"}
function cloud(x,y,s){const w=16*s,h=Math.max(3,5*s);
  px(ctx,x,y+2,w,h-2,C.cloud);px(ctx,x+3,y,w*.45,3,C.cloud);px(ctx,x+w*.45,y-1,w*.35,4,C.cloud);px(ctx,x+1,y+h-1,w-2,1,C.cloudS)}
function aurora(t){
  if(NF<.35)return;const a=(NF-.35)/.65;ctx.globalAlpha=.32*a;
  const bands=[["#7FF0C8",.18,.06],["#8EE3F0",.26,.05],["#FF9CC6",.33,.035]];
  for(const[col,yf,amp]of bands)for(let x=0;x<W;x+=1){
    const y=HZ*yf+Math.sin(x*.05+t*.35)*HZ*amp+Math.sin(x*.013-t*.2)*HZ*amp*1.4;const len=4+3*Math.sin(x*.09+t);
    if((x+Math.floor(t*4))%5!==0)px(ctx,x,y,1,len,col)}
  ctx.globalAlpha=1}
function paint(now){
  const t=(now-t0)/1000;ctx.drawImage(bg,0,0,W,H);
  aurora(t);
  const thr=NF>.5?.15:.7;
  stars.forEach((s,i)=>{if(NF<.5&&i%3)return;const a=Math.sin(t*2+s.p);if(a>thr){px(ctx,s.x,s.y,1,1,"#FFFFFF");if(a>.94){px(ctx,s.x-1,s.y,3,1,"#FFFFFF");px(ctx,s.x,s.y-1,1,3,"#FFFFFF")}}});
  clouds.forEach(c=>cloud(((c.x+t*c.v)%(W+30))-20,c.y,c.s));
  if(NF<.6)for(let i=0;i<3;i++){const bx=((t*6+i*9)%(W+20))-10,by=HZ*.3+i*3+Math.sin(t*3+i);const f=Math.floor(t*4+i)%2;
    px(ctx,bx,by,1,1,"#2E5566");px(ctx,bx-1,by-f,1,1,"#2E5566");px(ctx,bx+1,by-f,1,1,"#2E5566")}
  for(let i=0;i<W/6;i++){const y=HZ+2+((i*7)%(LB-HZ-2)),x=((i*37+t*(4+(i%3)*2))%(W+6))-3;if(Math.sin(t*2+i)>-.2)px(ctx,Math.round(x),y,2+(i%3),1,C.shim)}
  const bx=W*.5+Math.sin(t*.15)*W*.22,by=HZ+(LB-HZ)*.45+Math.sin(t*1.6)*.8;
  px(ctx,bx-4,by,9,1,C.hull);px(ctx,bx-3,by+1,7,1,C.hull);px(ctx,bx,by-6,1,6,C.mast);
  for(let i=0;i<5;i++)px(ctx,bx+1,by-6+i,1+Math.floor(i*.8),1,C.sail);
  if(NF>.4)px(ctx,bx+1,by-7,1,1,"#FFE08A");
  for(let i=0;i<5;i++){const k=((t*.5+i*.2)%1),sz=k<.5?2:1.5;px(ctx,cabin.x+cabin.w-4+Math.sin(k*6+i)*1.5,cabin.b-cabin.h-10-k*14,sz,sz,NF>.5?"#A9BED0":"#FFFFFF")}
  if(Math.sin(t*5)>0)px(ctx,cabin.x+3,cabin.b-5,1,1,"#FFFFFF");
  for(let i=0;i<8;i++){const lx=cabin.x-1+i*2,ly=cabin.b-cabin.h+(i%2);if(Math.sin(t*3+i*1.7)>-.3)px(ctx,lx,ly,1,1,FIXED.lights[i%4])}
  snow.forEach(p=>{const y=((p.y+t*p.v)%(H+4))-2,x=((p.x+Math.sin(t*.8+p.p)*3)%W+W)%W;px(ctx,x,y,p.big?1.5:1,p.big?1.5:1,"#FFFFFF")});
}
let looping=false;function loop(n){paint(n);requestAnimationFrame(loop)}
addEventListener("resize",()=>{clearTimeout(window._r);window._r=setTimeout(resize,120)});

/* ---------- boot: follow Vietnam's clock ---------- */
const vnHour=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const g=k=>+p.find(x=>x.type===k).value;return (g("hour")%24)+g("minute")/60};
const phaseName=h=>h<5||h>=20.4?"Night":h<6.5?"Dawn":h<9.5?"Morning":h<15.5?"Day":h<17.5?"Afternoon":h<19.2?"Sunset":"Dusk";
let followClock=true;
setHour(vnHour());resize();
setInterval(()=>{if(followClock)setHour(vnHour())},60000);
if(!still&&!looping){looping=true;requestAnimationFrame(loop)}
window.Lake={pick:h=>{followClock=false;setHour(h)},auto:()=>{followClock=true;setHour(vnHour())},
  phaseName,get hour(){return HOUR},get follow(){return followClock}};
