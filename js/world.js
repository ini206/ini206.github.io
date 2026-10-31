// Animated pixel winter-sunset lake (background for login + shop pages). No dependencies.
/* ---------- tiny pixel heart ---------- */
(()=>{const h=document.getElementById("heart");if(!h)return;const c=h.getContext("2d");
const m=["..XX..XX..",".XPPX.XPPX","XPWPPXPPPX","XPPPPPPPPX","XPPPPPPPPX",".XPPPPPPX.","..XPPPPX..","...XPPX...","....XX...."];
const col={X:"#2E5566",P:"#FF9CC6",W:"#FFFFFF"};
m.forEach((r,y)=>[...r].forEach((ch,x)=>{if(col[ch]){c.fillStyle=col[ch];c.fillRect(x,y,1,1)}}));})();


/* ---------- the world ---------- */
const cv=document.getElementById("world"), ctx=cv.getContext("2d");
const still=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let W,H,HZ,LB,K,bg,clouds,stars,snow,t0=performance.now(),cabin={};
function rnd(s){return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646}}
const C={
  sky:["#86D3EA","#9EDCEE","#B9E5F0","#D6E6EE","#F2DCE6","#FFCFDC","#FFC3D0","#FFC8BC"],
  sun:"#FFF1E6",glow:"#FFDCCF",
  far:"#A9D6E4",farS:"#93C7D9",near:"#7DBBD0",nearS:"#66A9C1",
  snow:"#FFF4F7",snowP:"#FFD7E3",snowS:"#DDEFF6",
  lake:["#FFD3DF","#C8EAF2","#A9DFEC","#93D4E6","#82CADF"],refF:"#BCE3EE",refN:"#9ED3E3",shim:"#FFFFFF",
  ground:"#FFFFFF",groundS:"#E2F3F8",groundD:"#CBE7F0",
  pine:"#3F938C",pineD:"#2F7C78",trunk:"#9C6B5B",
  wall:"#FFC9B0",wallS:"#F2AE96",roof:"#E8879F",roofD:"#D06F8A",win:"#FFE08A",door:"#B9776E",
  cloud:"#FFFFFF",cloudS:"#FFE3EA",hull:"#F08FA8",sail:"#FFFFFF",mast:"#2E5566",bird:"#2E5566",smoke:"#FFFFFF",
  lights:["#FF9CC6","#FFE08A","#8EE3F0","#FFFFFF"]
};
/* draw in logical pixels; canvas is K× larger so moving sprites glide in sub-pixel steps */
function px(g,x,y,w,h,c){g.fillStyle=c;const k=g===ctx?K:1;g.fillRect(Math.round(x*k)/k,Math.round(y*k)/k,Math.max(1/k,Math.round(w*k)/k),Math.max(1/k,Math.round(h*k)/k))}
function bpx(g,x,y,w,h,c){g.fillStyle=c;g.fillRect(x|0,y|0,Math.max(1,w|0),Math.max(1,h|0))}

function farRidge(x){return HZ-(18+9*Math.sin(x*.07+1.3)+6*Math.sin(x*.19+.4)+3*Math.sin(x*.47+2))}
function nearRidge(x){const d=Math.abs(x-W/2)/(W/2);const k=Math.max(0,(d-.3)/.7);
  return HZ-(k*k*(H*.5)+k*(5*Math.sin(x*.21)+3*Math.sin(x*.53+1)))}

function pine(g,x,base,h){bpx(g,x,base-2,1,2,C.trunk);
  for(let i=0;i<h;i++){const w=1+Math.floor((i%Math.ceil(h/3))*0.9)+Math.floor(i/(h/3));const y=base-2-h+i;
    bpx(g,x-w,y,w,1,C.pine);bpx(g,x,y,w+1,1,C.pineD);
    if(i%Math.ceil(h/3)===0)bpx(g,x-w+1,y,w,1,C.snow)}}

function buildStatic(){
  bg=document.createElement("canvas");bg.width=W;bg.height=H;const g=bg.getContext("2d");
  const n=C.sky.length,bh=HZ/n;
  for(let i=0;i<n;i++){bpx(g,0,Math.floor(i*bh),W,Math.ceil(bh)+1,C.sky[i]);
    if(i>0)for(let x=(i%2);x<W;x+=2)bpx(g,x,Math.floor(i*bh)-1,1,1,C.sky[i])}
  // low sunset sun, half behind the mountains
  const sx=Math.round(W*.5),sy=Math.round(HZ*.82),r=Math.max(7,Math.round(H*.08));
  for(let y=-r-4;y<=r+4;y++)for(let x=-r-4;x<=r+4;x++){const d=Math.hypot(x,y);
    if(d<=r)bpx(g,sx+x,sy+y,1,1,C.sun);else if(d<=r+4&&(x+y)%2===0)bpx(g,sx+x,sy+y,1,1,C.glow)}
  for(let x=0;x<W;x++){const ry=Math.round(farRidge(x)),sh=farRidge(x+1)>farRidge(x);
    bpx(g,x,ry,1,HZ-ry,sh?C.farS:C.far);
    if(HZ-ry>20)bpx(g,x,ry,1,Math.min(5,HZ-ry-17),sh?C.snowS:C.snowP)}
  for(let x=0;x<W;x++){const ry=Math.round(nearRidge(x));if(ry>=HZ)continue;const sh=nearRidge(x+1)>nearRidge(x);
    bpx(g,x,ry,1,HZ-ry,sh?C.nearS:C.near);
    if(HZ-ry>H*.2)bpx(g,x,ry,1,5+((x*7)%4),sh?C.snowS:C.snowP);
    else if(HZ-ry>H*.1)bpx(g,x,ry,1,2,sh?C.snowS:C.snow)}
  const lr=C.lake.length,lh=(LB-HZ)/lr;
  for(let i=0;i<lr;i++)bpx(g,0,HZ+Math.floor(i*lh),W,Math.ceil(lh)+1,C.lake[i]);
  for(let x=0;x<W;x++){const fr=HZ-farRidge(x),nr=HZ-Math.min(HZ,nearRidge(x));
    for(let y=0;y<Math.min(LB-HZ,fr*.55);y++)if((y+x)%3)bpx(g,x,HZ+y,1,1,C.refF);
    for(let y=0;y<Math.min(LB-HZ,nr*.6);y++)if((y+x)%3)bpx(g,x,HZ+y,1,1,C.refN)}
  for(let y=HZ+1;y<LB;y+=2){const w=Math.max(2,r*1.4-(y-HZ)*.8|0);bpx(g,sx-w/2,y,w,1,(y-HZ)%4?C.sun:C.snowP)}
  const R=rnd(7);
  for(let x=2;x<W;x+=3+Math.floor(R()*4)){const ny=Math.round(nearRidge(x));if(Math.abs(x-W/2)<W*.18)continue;
    pine(g,x,Math.min(HZ,ny+6)+1,4+Math.floor(R()*4))}
  // snowy foreground
  for(let x=0;x<W;x++){const top=LB+Math.round(1.5*Math.sin(x*.12)+Math.sin(x*.31));
    bpx(g,x,top,1,H-top,C.ground);bpx(g,x,top+1,1,2,C.groundS);
    if((x*13)%9===0)bpx(g,x,top+4+(x%5),2,1,C.groundD)}
  for(let i=0;i<W*.3;i++){const x=Math.floor(R()*W),y=LB+4+Math.floor(R()*(H-LB-5));bpx(g,x,y,1,1,C.groundS)}
  pine(g,Math.round(W*.06),H-2,14);pine(g,Math.round(W*.12),H-4,10);pine(g,Math.round(W*.93),H-1,16);
  const cx=Math.round(W*.76),cb=LB+Math.round((H-LB)*.6),cw=14,ch=8;
  bpx(g,cx,cb-ch,cw,ch,C.wall);bpx(g,cx+cw-3,cb-ch,3,ch,C.wallS);
  for(let i=0;i<6;i++)bpx(g,cx-2+i,cb-ch-1-i,cw+4-2*i,1,i<2?C.roofD:C.snow);
  bpx(g,cx-2,cb-ch-1,cw+4,1,C.roof);
  bpx(g,cx+cw-5,cb-ch-8,2,5,C.door);bpx(g,cx+cw-5,cb-ch-8,2,1,C.snow);
  bpx(g,cx+2,cb-6,3,3,C.win);bpx(g,cx+8,cb-4,2,4,C.door);
  bpx(g,cx-1,cb,cw+2,1,C.groundD);
  cabin={x:cx,b:cb,w:cw,h:ch};
}

function resize(){
  const s=Math.max(3,Math.round(Math.min(innerHeight/150,innerWidth/120)));
  W=Math.ceil(innerWidth/s);H=Math.ceil(innerHeight/s);HZ=Math.round(H*.58);LB=Math.round(H*.8);
  K=Math.max(1,Math.min(6,Math.round(s*(window.devicePixelRatio||1))));
  cv.width=W*K;cv.height=H*K;ctx.setTransform(K,0,0,K,0,0);ctx.imageSmoothingEnabled=false;
  const R=rnd(42);
  clouds=Array.from({length:Math.max(3,Math.round(W/45))},()=>({x:R()*W,y:4+R()*HZ*.4,s:.6+R()*.8,v:1.2+R()*1.6}));
  stars=Array.from({length:Math.round(W/10)},()=>({x:Math.round(R()*W),y:Math.round(R()*HZ*.35),p:R()*6.28}));
  snow=Array.from({length:Math.round(W*.7)},()=>({x:R()*W,y:R()*H,v:3+R()*5,p:R()*6.28,big:R()<.25}));
  buildStatic();if(still)paint(performance.now());
}

function cloud(x,y,s){const w=16*s,h=Math.max(3,5*s);
  px(ctx,x,y+2,w,h-2,C.cloud);px(ctx,x+3,y,w*.45,3,C.cloud);px(ctx,x+w*.45,y-1,w*.35,4,C.cloud);px(ctx,x+1,y+h-1,w-2,1,C.cloudS)}

function paint(now){
  const t=(now-t0)/1000;ctx.drawImage(bg,0,0,W,H);
  stars.forEach(s=>{const a=Math.sin(t*2+s.p);if(a>.7){px(ctx,s.x,s.y,1,1,"#FFFFFF");if(a>.94){px(ctx,s.x-1,s.y,3,1,"#FFFFFF");px(ctx,s.x,s.y-1,1,3,"#FFFFFF")}}});
  clouds.forEach(c=>cloud(((c.x+t*c.v)%(W+30))-20,c.y,c.s));
  for(let i=0;i<3;i++){const bx=((t*6+i*9)%(W+20))-10,by=HZ*.3+i*3+Math.sin(t*3+i);const f=Math.floor(t*4+i)%2;
    px(ctx,bx,by,1,1,C.bird);px(ctx,bx-1,by-f,1,1,C.bird);px(ctx,bx+1,by-f,1,1,C.bird)}
  for(let i=0;i<W/6;i++){const y=HZ+2+((i*7)%(LB-HZ-2)),x=((i*37+t*(4+(i%3)*2))%(W+6))-3;
    if(Math.sin(t*2+i)>-.2)px(ctx,Math.round(x),y,2+(i%3),1,C.shim)}
  const bx=W*.5+Math.sin(t*.15)*W*.22,by=HZ+(LB-HZ)*.45+Math.sin(t*1.6)*.8;
  px(ctx,bx-4,by,9,1,C.hull);px(ctx,bx-3,by+1,7,1,C.hull);px(ctx,bx,by-6,1,6,C.mast);
  for(let i=0;i<5;i++)px(ctx,bx+1,by-6+i,1+Math.floor(i*.8),1,C.sail);
  px(ctx,bx-3,by+2,7,1,"#C8EAF2");
  for(let i=0;i<5;i++){const k=((t*.5+i*.2)%1),sz=k<.5?2:1.5;px(ctx,cabin.x+cabin.w-4+Math.sin(k*6+i)*1.5,cabin.b-cabin.h-10-k*14,sz,sz,C.smoke)}
  if(Math.sin(t*5)>0)px(ctx,cabin.x+3,cabin.b-5,1,1,"#FFFFFF");
  // string lights on the cabin eave
  for(let i=0;i<8;i++){const lx=cabin.x-1+i*2,ly=cabin.b-cabin.h+(i%2);if(Math.sin(t*3+i*1.7)>-.3)px(ctx,lx,ly,1,1,C.lights[i%4])}
  snow.forEach(p=>{const y=((p.y+t*p.v)%(H+4))-2,x=((p.x+Math.sin(t*.8+p.p)*3)%W+W)%W;px(ctx,x,y,p.big?1.5:1,p.big?1.5:1,"#FFFFFF")});
}
let looping=false;
function loop(now){paint(now);requestAnimationFrame(loop)}
addEventListener("resize",()=>{clearTimeout(window._r);window._r=setTimeout(resize,120)});
resize();if(!still&&!looping){looping=true;requestAnimationFrame(loop)}

