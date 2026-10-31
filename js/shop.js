// Her shopping page: wish bubbles + send. Runs only after auth confirms her account.
import { db, requireRole, logout } from "./firebase.js?v=20261031c";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { TO_NAME } from "./config.js?v=20261031c";

const user = await requireRole("her");
document.documentElement.dataset.auth = "ok";
document.getElementById("bye").addEventListener("click", () => logout(""));

// Firestore rules re-check every field server-side; this is just the honest client.
const sendWishlist = (items, note) =>
  addDoc(collection(db, "wishlists"), { items, note, by: user.uid, sentAt: serverTimestamp() });

/* ---------- wishlist ---------- */
const KEY="lakeside-wishlist-"+user.uid;
let items=[];
try{const s=localStorage.getItem(KEY);if(s)items=JSON.parse(s)}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(items))}catch(e){}}

const intro=document.getElementById("intro"),main=document.getElementById("main"),fab=document.getElementById("fab"),fabs=document.getElementById("fabs"),sendBtn=document.getElementById("send"),
  board=document.getElementById("board"),countEl=document.getElementById("count"),
  sheet=document.getElementById("sheet"),form=document.getElementById("form"),txt=document.getElementById("txt"),title=document.getElementById("sheetTitle");
let editing=null,justAdded=null,tapTimer=null,tapId=null;

let started=false;
function begin(){if(started)return;started=true;intro.hidden=true;main.hidden=false;fabs.hidden=false;render()}
const startBtn=document.getElementById("start");
startBtn.addEventListener("pointerdown",e=>{if(e.button===0||e.pointerType!=="mouse")begin()});
startBtn.addEventListener("click",begin);
addEventListener("keydown",e=>{if(!started&&(e.key==="Enter"||e.key===" "))begin()});

function render(){
  board.replaceChildren();countEl.textContent=items.length;sendBtn.disabled=!items.length;markSent();
  if(!items.length){const e=document.createElement("div");e.className="empty px";e.textContent="Your list is empty. Tap + to add your first wish!";board.append(e);return}
  items.forEach(it=>{const b=document.createElement("button");b.type="button";b.className="bubble px"+(it.id===justAdded?" new":"");
    b.textContent=it.text;b.dataset.id=it.id;b.style.animationDelay=it.id===justAdded?"":(-(it.id%7)*.45)+"s";
    b.setAttribute("aria-label",it.text+". Tap to edit, double tap to delete.");
    b.addEventListener("pointerdown",()=>b.classList.add("hold"));b.addEventListener("pointerleave",()=>b.classList.remove("hold"));
    b.addEventListener("click",()=>tap(it.id,b));
    b.addEventListener("keydown",e=>{if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();remove(it.id,b)}});
    board.append(b)});
  justAdded=null;
}
function tap(id,el){
  if(tapId===id&&tapTimer){clearTimeout(tapTimer);tapTimer=null;tapId=null;remove(id,el);return}
  clearTimeout(tapTimer);tapId=id;tapTimer=setTimeout(()=>{tapTimer=null;tapId=null;openSheet(id)},280);
}
function remove(id,el){el.classList.add("pop");setTimeout(()=>{items=items.filter(i=>i.id!==id);save();render()},320)}
function openSheet(id){editing=id;const it=items.find(i=>i.id===id);title.textContent=it?"EDIT WISH ✎":"NEW WISH ✿";
  txt.value=it?it.text:"";sheet.hidden=false;setTimeout(()=>txt.focus(),30)}
function closeSheet(){sheet.hidden=true;editing=null}
fab.onclick=()=>openSheet(null);
document.getElementById("cancel").onclick=closeSheet;
sheet.addEventListener("click",e=>{if(e.target===sheet)closeSheet()});
addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!sheet.hidden)closeSheet();else if(!sendSheet.hidden)closeSend()});
txt.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
form.addEventListener("submit",e=>{e.preventDefault();const v=txt.value.trim();
  if(!v){txt.placeholder="Type something first ✿";txt.focus();return}
  if(editing!=null){const it=items.find(i=>i.id===editing);if(it)it.text=v}
  else{const id=Date.now();items.push({id,text:v});justAdded=id}
  save();closeSheet();render()});

/* ---------- send ---------- */
const SENT_KEY="lakeside-wishlist-sent-"+user.uid;
const sendSheet=document.getElementById("sendSheet"),sendForm=document.getElementById("sendForm"),sentCard=document.getElementById("sentCard"),
  note=document.getElementById("note"),sendMsg=document.getElementById("sendMsg"),sendGo=document.getElementById("sendGo"),sendSum=document.getElementById("sendSum");
document.getElementById("toName").textContent=TO_NAME.toUpperCase();
function sig(){return JSON.stringify(items.map(i=>i.text))}
function markSent(){let last="";try{last=localStorage.getItem(SENT_KEY)||""}catch(e){}document.getElementById("sentTag").hidden=!(items.length&&last===sig())}
function openSend(){if(!items.length)return;sendSum.textContent=items.length+(items.length===1?" wish":" wishes")+" ready to go.";
  sendMsg.textContent="";sendForm.hidden=false;sentCard.hidden=true;sendSheet.hidden=false;setTimeout(()=>note.focus(),30)}
function closeSend(){sendSheet.hidden=true}
sendBtn.onclick=openSend;
document.getElementById("sendCancel").onclick=closeSend;
document.getElementById("sentClose").onclick=closeSend;
sendSheet.addEventListener("click",e=>{if(e.target===sendSheet)closeSend()});
sendForm.addEventListener("submit",async e=>{e.preventDefault();
  sendGo.disabled=true;sendGo.textContent="Sending…";sendMsg.textContent="";
  try{await sendWishlist(items.map(i=>i.text.slice(0,160)),note.value.trim().slice(0,300));
    try{localStorage.setItem(SENT_KEY,sig())}catch(e){}
    note.value="";sendForm.hidden=true;sentCard.hidden=false;markSent();
  }catch(err){sendMsg.textContent="That didn't go through ("+(err&&err.code||"network error")+"). Try again in a moment.";}
  finally{sendGo.disabled=false;sendGo.textContent="Send ✉"}
});
