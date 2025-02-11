import * as Net from "./net.js";
import * as DB from "./db.js";
import {
    format,
    formatISO,
    isValid as isValidDate,
    parseISO
} from "https://cdn.jsdelivr.net/npm/date-fns@2.29.3/esm/index.js";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js";
import { nanoid } from "https://cdn.jsdelivr.net/npm/nanoid@5.0.9/nanoid.js";

// Ontology & utilities
const ONTOLOGY = [
    { name:"location", dataType:"location", conditions:["is","contains","regex","between","before","after"], defCond:"is" },
    { name:"time",     dataType:"time",     conditions:["is","before","after","between","regex"], defCond:"is" },
    { name:"desc",     dataType:"string",   conditions:["is","contains","regex"],                 defCond:"is" },
    { name:"mood",     dataType:"string",   conditions:["is","contains","regex"],                 defCond:"is" }
];
const getTagDef = n => ONTOLOGY.find(t=>t.name===n)||{name:n,dataType:"string",conditions:["is","contains","regex"],defCond:"is"};
const nowISO      = ()=>formatISO(new Date());
const shortDate   = ts=>{ let d=typeof ts==="string"?parseISO(ts):new Date(ts); return isValidDate(d)?format(d,localStorage.dateFormat||"Pp"):""; };

// Minimal Editor
class Editor {
    constructor(el) {
        this.el=el; this.sel=null;
        this.el.addEventListener("input",()=>this.sanitize());
        this.el.addEventListener("mouseup",()=>this.saveSel());
        this.el.addEventListener("keyup",()=>this.saveSel());
        this.el.addEventListener("keydown",e=>{
            if(e.code==="Enter"){ e.preventDefault(); this.insertBr(); }
        });
    }
    sanitize() {
        let c=this.el.innerHTML, s=DOMPurify.sanitize(c,{ALLOWED_TAGS:["br","b","i","span"],ALLOWED_ATTR:["class","contenteditable"]});
        if(c!==s){ this.el.innerHTML=s; this.restoreSel(); }
    }
    insertBr() {
        this.focus(); if(!this.sel) return;
        let r=this.sel; r.deleteContents();
        r.insertNode(document.createElement("br"));
        r.collapse(false);
        let sel=getSelection(); sel.removeAllRanges(); sel.addRange(r);
        this.saveSel();
    }
    saveSel() {
        let s=getSelection(); if(!s.rangeCount) return; this.sel=s.getRangeAt(0).cloneRange();
    }
    restoreSel() {
        if(this.sel){ let s=getSelection(); s.removeAllRanges(); s.addRange(this.sel); }
    }
    focus() {
        if(document.activeElement!==this.el){ this.el.focus(); if(!getSelection().rangeCount){let r=document.createRange();r.selectNodeContents(this.el);r.collapse(false);let s=getSelection();s.removeAllRanges();s.addRange(r);} this.saveSel(); }
    }
    getHTML(){ return this.el.innerHTML; }
    setHTML(h){ this.el.innerHTML=h; this.sanitize(); }
    insertNode(n){
        this.focus(); this.restoreSel();
        let s=getSelection(),r=s.rangeCount?s.getRangeAt(0):null;
        if(!r) return;
        r.deleteContents(); r.insertNode(n); r.collapse(false); s.removeAllRanges(); s.addRange(r); this.saveSel();
    }
}

// Inline Tag
class InlineTag {
    constructor(tagDef,onUpdate){
        this.td=tagDef; this.cond=tagDef.defCond; this.value="";
        this.id=nanoid(); this.onUpdate=onUpdate;
        this.el=document.createElement("span");
        this.el.className="inline-tag"; this.el.contentEditable="false"; this.el.id=this.id;
        this.render();
    }
    render(){
        this.el.innerHTML="";
        let nameSpan=document.createElement("span");
        nameSpan.textContent=this.td.name; nameSpan.className="tag-name";
        let condSel=document.createElement("select"); condSel.className="tag-cond";
        this.td.conditions.forEach(c=>{
            let o=document.createElement("option"); o.value=c; o.textContent=c; if(c===this.cond)o.selected=true; condSel.appendChild(o);
        });
        let valInput=document.createElement("input"); valInput.className="tag-val"; valInput.type=this.td.dataType==="time"?"datetime-local":"text";
        valInput.value=this.value;
        let rm=document.createElement("button"); rm.textContent="×"; rm.className="tag-rm";
        [nameSpan, condSel, valInput, rm].forEach(e=>this.el.appendChild(e));
        condSel.onchange=e=>{this.cond=e.target.value;this.value="";this.render();this.onUpdate();};
        valInput.oninput=()=>{this.value=valInput.value;this.onUpdate();};
        rm.onclick=()=>{this.el.remove();this.onUpdate();};
    }
}

// Tagger Popup
class Tagger {
    constructor(editor,allTags,onInsert=()=>{}){
        this.ed=editor; this.all=allTags; this.onInsert=onInsert;
        this.fuse=new Fuse(this.all,{keys:["name"],threshold:0.3});
        this.popup=document.createElement("div"); this.popup.id="tag-popup"; this.popup.style.display="none";
        this.search=document.createElement("input"); this.list=document.createElement("ul");
        this.popup.append(this.search,this.list); document.body.appendChild(this.popup);
        this.search.oninput=()=>this.render(this.search.value);
        document.addEventListener("click",e=>{
            if(!this.popup.contains(e.target)&&e.target.id!=="insert-tag-btn") this.hide();
        });
    }
    show(){
        this.ed.focus(); this.ed.saveSel();
        this.search.value=""; this.render("");
        let r=this.getCaretRect(); this.popup.style.left=(r.left)+"px"; this.popup.style.top=(r.top+25)+"px";
        this.popup.style.display="block"; this.search.focus();
    }
    hide(){ this.popup.style.display="none"; }
    render(q){
        this.list.innerHTML="";
        let res=q?this.fuse.search(q).map(r=>r.item):this.all;
        if(!res.length){ let li=document.createElement("li"); li.textContent="No tags"; this.list.appendChild(li); return; }
        res.forEach(t=>{
            let li=document.createElement("li"); li.tabIndex=0;
            li.innerHTML=t.name.replace(new RegExp(q,"gi"),m=>`<b>${m}</b>`);
            li.onclick=()=>{this.insert(t);this.hide();};
            this.list.appendChild(li);
        });
    }
    insert(def){
        let inTag=new InlineTag(getTagDef(def.name),()=>this.onInsert());
        this.ed.insertNode(inTag.el);
    }
    getCaretRect(){
        let s=getSelection(); if(!s.rangeCount) return {left:0,top:0};
        let r=s.getRangeAt(0).cloneRange(); r.collapse(true);
        let rect=r.getClientRects()[0]; return rect?rect:{left:0,top:0};
    }
}

// Main
document.addEventListener("DOMContentLoaded",async()=>{
    let db=new DB.DB(), keys=await DB.loadKeys(), appEl=document.createElement("div");
    appEl.innerHTML=`
    <nav class="sidebar">
      <button id="dash-btn">Dashboard</button>
      <button id="items-btn">Content</button>
      <button id="nostr-btn">Nostr</button>
      <button id="settings-btn">Settings</button>
    </nav>
    <main>
      <section id="dash-view" class="view" style="display:none;">
        <h2>Dashboard</h2>
        <div id="dash-info"></div>
      </section>
      <section id="items-view" class="view" style="display:none;">
        <h2>Items</h2>
        <div><input id="search" placeholder="search"><button id="new-item">New</button></div>
        <div id="items-list"></div>
        <div id="editor-wrap" style="display:none;">
          <button id="insert-tag-btn">Insert Tag</button>
          <div id="editor" contenteditable="true"></div>
          <input id="item-name">
          <button id="save-item">Save</button>
          <button id="del-item">Delete</button>
          <button id="cancel-item">Cancel</button>
        </div>
      </section>
      <section id="nostr-view" class="view" style="display:none;">
        <h2>Nostr</h2>
        <button id="gen-keys">Generate</button>
        <button id="friend">Friend Peer</button>
        <button id="send-msg">Send Test Msg</button>
        <div id="pubkey-info"></div>
        <div id="feed"></div>
      </section>
      <section id="settings-view" class="view" style="display:none;">
        <h2>Settings</h2>
        <label>Date Format:
          <select id="date-format">
            <option value="Pp">Default (Pp)</option>
            <option value="yyyy-MM-dd HH:mm">yyyy-MM-dd HH:mm</option>
          </select>
        </label>
      </section>
    </main>
    <div id="tag-popup" style="display:none;"></div>
    <div id="notification"></div>
  `;
    document.body.appendChild(appEl);

    let navBtns={
        dash:   document.getElementById("dash-btn"),
        items:  document.getElementById("items-btn"),
        nostr:  document.getElementById("nostr-btn"),
        sets:   document.getElementById("settings-btn")
    };
    let views={
        dash: document.getElementById("dash-view"),
        items:document.getElementById("items-view"),
        nostr:document.getElementById("nostr-view"),
        sets: document.getElementById("settings-view")
    };
    Object.keys(navBtns).forEach(k=>{
        navBtns[k].onclick=()=>{
            Object.values(views).forEach(v=>v.style.display="none");
            views[k].style.display="block";
            if(k==="dash") renderDash();
            if(k==="items") renderItems();
            if(k==="nostr") updateNostrUI();
            if(k==="sets") document.getElementById("date-format").value=localStorage.dateFormat||"Pp";
        };
    });

    // Editor & Tagger
    let editor=new Editor(document.getElementById("editor"));
    let tagger=new Tagger(editor,ONTOLOGY,()=>{/* optional live update */});

    // Items
    let selItem=null, fuse=new Fuse([],{keys:["name","content"],threshold:0.4});
    let itemsList=document.getElementById("items-list");
    let search=document.getElementById("search");
    let edWrap=document.getElementById("editor-wrap");
    let itemName=document.getElementById("item-name");
    let renderItems=async()=>{
        itemsList.innerHTML="Loading...";
        let filter=search.value.toLowerCase(),all=await db.getAll();
        fuse.setCollection(all);
        let out=filter?fuse.search(filter).map(r=>r.item):all;
        itemsList.innerHTML=out.length?out.map(o=>`
      <div class="item" data-id="${o.id}"><b>${o.name}</b> — ${shortDate(o.updatedAt)}</div>
    `).join(""):"No items";
        itemsList.querySelectorAll(".item").forEach(i=>{
            i.onclick=async()=>{ let id=i.getAttribute("data-id"); let obj=await db.get(id); openEditor(obj); };
        });
    };
    let openEditor=o=>{
        selItem=o; edWrap.style.display="block";
        editor.setHTML(o.content||""); itemName.value=o.name||"";
    };
    let closeEditor=()=>{
        selItem=null; edWrap.style.display="none";
        editor.setHTML(""); itemName.value="";
    };
    let extractTags=html=>{
        let d=new DOMParser().parseFromString(html,"text/html");
        return [...d.querySelectorAll(".inline-tag")].map(e=>{
            let n=e.querySelector(".tag-name")?.textContent.trim()||"", c=e.querySelector(".tag-cond")?.value||"is", v=e.querySelector(".tag-val")?.value||"";
            return {name:n,condition:c,value:v};
        });
    };
    document.getElementById("new-item").onclick=()=>openEditor({id:nanoid(),name:"",content:"",tags:[],createdAt:nowISO(),updatedAt:nowISO()});
    document.getElementById("save-item").onclick=async()=>{
        if(!selItem) return;
        if(!itemName.value.trim()) return notify("Name required","warn");
        selItem.name=itemName.value.trim();
        selItem.content=DOMPurify.sanitize(editor.getHTML(),{ALLOWED_TAGS:["br","b","i","span"],ALLOWED_ATTR:["class","contenteditable"]});
        selItem.tags=extractTags(selItem.content);
        selItem.updatedAt=nowISO();
        await db.save(selItem);
        closeEditor(); renderItems();
        if(nostr) nostr.publish({kind:1,content:selItem.name,tags:[],created_at:Math.floor(Date.now()/1000)});
    };
    document.getElementById("del-item").onclick=async()=>{
        if(selItem && confirm("Delete?")){
            await db.delete(selItem.id); closeEditor(); renderItems();
        }
    };
    document.getElementById("cancel-item").onclick=closeEditor;
    document.getElementById("insert-tag-btn").onclick=e=>{ e.preventDefault(); tagger.show(); };
    search.oninput=_.debounce(renderItems,300);

    // Dashboard
    let dashInfo=document.getElementById("dash-info");
    async function renderDash(){
        let all=await db.getAll(); dashInfo.innerHTML=`Items: ${all.length} <br> Last updated: ${all.slice(-1)[0]?.name||"N/A"}`;
    }

    // Nostr
    let nostr=keys?new Net.Nostr({pub:keys.pub,priv:keys.priv,onEvent:e=>onNostrEvent(e)}):null;
    if(nostr) nostr.connect();
    let pubkeyInfo=document.getElementById("pubkey-info"),feed=document.getElementById("feed");
    let updateNostrUI=()=>{ pubkeyInfo.textContent=keys?("PubKey: "+keys.pub):"No Keys"; };
    let onNostrEvent=e=>{ feed.innerHTML+=`<div><b>Msg from ${e.pubkey.slice(0,8)}:</b> ${e.content}</div>`; };
    document.getElementById("gen-keys").onclick=async()=>{
        let k=await Net.generateKeys(); keys=k; await DB.saveKeys(k); nostr=new Net.Nostr({pub:k.pub,priv:k.priv,onEvent:e=>onNostrEvent(e)}); nostr.connect(); updateNostrUI();
    };
    document.getElementById("friend").onclick=()=>{
        let pk=prompt("Enter friend's pubkey:"); if(pk&&nostr) nostr.subscribeToPubkey(pk);
    };
    document.getElementById("send-msg").onclick=()=>{
        if(nostr) nostr.publish({kind:1,content:"Hello from "+keys.pub.slice(0,8),tags:[],created_at:Math.floor(Date.now()/1000)});
    };

    // Settings
    document.getElementById("date-format").onchange=e=>{ localStorage.dateFormat=e.target.value; notify("Date format saved"); };

    // Notifications
    let note=document.getElementById("notification"),q=[];
    let notify=(msg,type="info")=>{
        q.push({msg,type}); if(q.length===1) showNext();
    };
    let showNext=()=>{
        if(!q.length) return; note.textContent=q[0].msg; note.className="show "+q[0].type;
        setTimeout(()=>{ note.className=""; q.shift(); if(q.length) setTimeout(showNext,100); },3000);
    };

    // Initial
    navBtns.dash.click();
});
