const TASKS = [
  {id:1,title:"ওয়েবসাইটের পরীক্ষামূলক টাস্ক",description:"এই ডেমো সাইটের একটি নির্দিষ্ট পেজ খুলে নির্দেশনা পড়ুন এবং শেষে 'Complete' চাপুন।",reward:5},
  {id:2,title:"ফিডব্যাক টাস্ক",description:"সাইটের একটি ফিচার সম্পর্কে বাস্তব ও গঠনমূলক মতামত লিখুন।",reward:10},
  {id:3,title:"ডেমো কনটেন্ট রিভিউ",description:"প্রকাশের আগে একটি ডেমো কনটেন্টের বানান ও তথ্য যাচাই করুন।",reward:8}
];

const state = JSON.parse(localStorage.getItem("bdTaskHub") || '{"balance":0,"completed":[],"refCode":"BD-USER"}');

function save(){localStorage.setItem("bdTaskHub",JSON.stringify(state)); render();}

function render(){
  document.getElementById("balance").textContent = "৳" + state.balance.toFixed(2);
  document.getElementById("completed").textContent = state.completed.length;
  document.getElementById("refCode").textContent = state.refCode;
  document.getElementById("refCode2").textContent = state.refCode;
  const list=document.getElementById("taskList");
  list.innerHTML="";
  TASKS.forEach(t=>{
    const done=state.completed.includes(t.id);
    const el=document.createElement("article");
    el.className="task";
    el.innerHTML=`<h3>${t.title}</h3><p>${t.description}</p><div class="reward">Reward: ৳${t.reward.toFixed(2)}</div>`;
    const b=document.createElement("button");
    b.className="btn";
    b.textContent=done?"Completed":"Start Task";
    b.disabled=done;
    b.onclick=()=>{
      if(!confirm("আপনি কি সত্যিই এই টাস্কের শর্ত পূরণ করেছেন?")) return;
      state.completed.push(t.id);
      state.balance += t.reward;
      save();
      alert("ডেমো রিওয়ার্ড যোগ হয়েছে। বাস্তব সাইটে admin/server-side verification প্রয়োজন।");
    };
    el.appendChild(b); list.appendChild(el);
  });
}

document.getElementById("withdrawForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number(document.getElementById("amount").value);
  const method=document.getElementById("method").value;
  const payment=document.getElementById("payment").value.trim();
  const msg=document.getElementById("withdrawMsg");
  if(amount<50){msg.textContent="ন্যূনতম ডেমো উত্তোলন ৳50।";return;}
  if(amount>state.balance){msg.textContent="আপনার ডেমো ব্যালেন্সের চেয়ে বেশি উত্তোলন করা যাবে না।";return;}
  if(!method || !payment){msg.textContent="সব তথ্য পূরণ করুন।";return;}
  state.balance-=amount; save();
  msg.textContent=`ডেমো রিকোয়েস্ট গ্রহণ করা হয়েছে: ৳${amount} (${method})। বাস্তব সাইটে এটি server-side verification queue-তে যাবে।`;
  e.target.reset();
});

document.getElementById("copyRef").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(state.refCode);alert("রেফারেল কোড কপি হয়েছে।")}
  catch(e){alert("কোড: "+state.refCode)}
});

render();
