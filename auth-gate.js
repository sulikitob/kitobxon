// auth-gate.js — barcha sahifalarga bitta marta ulanadi:
// <script type="module" src="auth-gate.js"></script>
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase Console -> Project settings -> Your apps dagi configni shu yerga qo'ying
const firebaseConfig = {
    apiKey: "AIzaSyDpPcnPR7eIUszgEKcbTxGmx6EpAqaa1kU",
    authDomain: "yosh-kitobxon-996ea.firebaseapp.com",
    projectId: "yosh-kitobxon-996ea",
    storageBucket: "yosh-kitobxon-996ea.firebasestorage.app",
    messagingSenderId: "53160446209",
    appId: "1:53160446209:web:bd66a7ece7be8325d3f300"
};

// Login so'ramasdan nechta bobga kirish mumkin
const FREE_CHAPTERS = 1;

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const MSG_STAR    = "Bu bo'lim ⭐ belgili. Davom etish uchun email va parol bilan kiring.";
const MSG_CHAPTER = "Bepul kirish tugadi. Boshqa boblarni ochish uchun email va parol bilan kiring.";

let pendingHref = null;
let pendingMsg = '';
let chosenPlan = null;

// ---------- Narxlar oynasi: 1) tarif tanlash 2) email + login ----------
const PRICING_HTML = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zuho narxlari</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{min-height:100%}
body{font-family:Arial,sans-serif;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;padding:20px;overflow-x:hidden}
.star{position:fixed;width:2px;height:2px;background:#fff;border-radius:50%;opacity:.6;animation:tw 3s infinite ease-in-out;pointer-events:none}
@keyframes tw{0%,100%{opacity:.1}50%{opacity:.9}}
.spark{position:absolute;width:4px;height:4px;background:#fff8d6;border-radius:50%;box-shadow:0 0 8px 3px #ffcc00;pointer-events:none;z-index:1;opacity:0;animation:twinkle ease-in-out infinite}
.spark.out{position:fixed;z-index:1}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1.3)}}
.box{position:relative;z-index:2;width:100%;max-width:665px;background:#0d0d0d;border:2px solid #ffcc00;border-radius:22px;padding:22px;box-shadow:0 0 35px rgba(255,204,0,.45)}
.badge{display:block;width:max-content;margin:0 auto 14px;background:#ffcc00;color:#000;font-size:10px;font-weight:bold;padding:5px 12px;border-radius:20px}
h1{text-align:center;font-size:22px}
h1 span{color:#ffcc00}
.sub{text-align:center;font-size:10px;color:#999;margin:8px 0 18px}
.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.plan{position:relative;overflow:hidden;background:#111;border:1px solid #4a3d00;border-radius:12px;padding:16px 12px;display:flex;flex-direction:column;gap:8px;text-align:center}
.plan.best{border-color:#ffcc00;box-shadow:0 0 14px rgba(255,204,0,.3)}
.plan h3{font-size:13px}
.old{font-size:10px;color:#777;text-decoration:line-through}
.price{font-size:20px;font-weight:bold;color:#ffcc00}
.price small{font-size:9px;color:#ccc;font-weight:normal}
.disc{align-self:center;font-size:9px;color:#2ee59d;border:1px solid #1f7a55;background:#0e2a1f;padding:3px 9px;border-radius:12px}
.ribbon{position:absolute;top:10px;right:-28px;transform:rotate(40deg);background:#ffcc00;color:#000;font-size:8px;font-weight:bold;padding:3px 30px}
ul{list-style:none;text-align:left;font-size:10px;display:flex;flex-direction:column;gap:5px;flex:1}
li::before{content:"★ ";color:#ffcc00}
.bonus{display:flex;gap:8px;align-items:center;text-align:left;border:1px solid #2f7fd0;background:#0c1a2c;border-radius:8px;padding:7px}
.bonus b.w{background:#3b8cf0;width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px}
.bonus div{font-size:9px;color:#9cc7f5}
.bonus div strong{display:block;font-size:10px;color:#4da3ff}
.btn{border:0;cursor:pointer;width:100%;padding:11px;border-radius:25px;font-weight:bold;font-size:13px;color:#000;background:linear-gradient(90deg,#ffe066,#ffcc00)}
.btn:hover{filter:brightness(1.1)}
.all{margin-top:14px;border:1px solid #4a3d00;border-radius:12px;padding:14px;background:#0f0f0f}
.all h4{text-align:center;font-size:11px;margin-bottom:10px}
.all ul{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}
.foot{text-align:center;font-size:8px;color:#666;margin-top:14px}
#step2{display:none}
.form h2{text-align:center;font-size:20px;margin-bottom:6px}
.chosen{text-align:center;color:#ffcc00;font-size:13px;margin-bottom:18px}
label{display:block;font-size:12px;color:#ccc;margin:12px 0 5px}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #4a3d00;background:#111;color:#fff;font-size:14px;outline:none}
input:focus{border-color:#ffcc00;box-shadow:0 0 10px rgba(255,204,0,.35)}
.err{color:#ff6b6b;font-size:11px;margin-top:5px;min-height:14px}
.back{background:none;border:0;color:#999;cursor:pointer;font-size:12px;margin-top:12px;display:block;margin-inline:auto}
@media(max-width:620px){.plans{grid-template-columns:1fr}.all ul{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="box">

  <div id="step1">
    <span class="badge">💎 ZUHO PREMIUM NARXLARI</span>
    <h1>Sizga qulay <span>tarifni</span> tanlang</h1>
    <p class="sub">Barcha tariflarda ★ belgili premium bo'limlarning barchasiga to'liq kirish beriladi</p>

    <div class="plans">
      <div class="plan">
        <h3>Oylik</h3>
        <div class="price">18 000 <small>so'm / oy</small></div>
        <ul>
          <li>Barcha premium bo'limlar</li>
          <li>Quiz testlar va kategoriyalar</li>
          <li>Har oy yangilanadigan material</li>
        </ul>
        <button class="btn" data-plan="Oylik" data-price="18 000 so'm">Tanlash</button>
      </div>

      <div class="plan best">
        <div class="ribbon">ENG FOYDALI</div>
        <h3>Yarim yillik (6 oy)</h3>
        <div class="old">108 000 so'm</div>
        <div class="price">100 000 <small>so'm</small></div>
        <span class="disc">Chegirma bilan</span>
        <ul>
          <li>Barcha premium bo'limlar</li>
          <li>Quiz testlar va kategoriyalar</li>
        </ul>
        <div class="bonus"><b class="w">W</b><div><strong>Bonus: Word file</strong>Barcha ma'lumotlar taqdim etiladi</div></div>
        <button class="btn" data-plan="Yarim yillik (6 oy)" data-price="100 000 so'm">Tanlash</button>
      </div>

      <div class="plan">
        <h3>Yillik (12 oy)</h3>
        <div class="old">216 000 so'm</div>
        <div class="price">200 000 <small>so'm</small></div>
        <span class="disc">Chegirma bilan</span>
        <ul>
          <li>Barcha premium bo'limlar</li>
          <li>Quiz testlar va kategoriyalar</li>
          <li>Eng arzon oylik narx</li>
        </ul>
        <div class="bonus"><b class="w">W</b><div><strong>Bonus: Word file</strong>Barcha ma'lumotlar taqdim etiladi</div></div>
        <button class="btn" data-plan="Yillik (12 oy)" data-price="200 000 so'm">Tanlash</button>
      </div>
    </div>

    <div class="all">
      <h4>Barcha tariflarga kiradi</h4>
      <ul>
        <li>Umumiy quiz testlar</li><li>Shaxs nomlari va ta'riflari</li>
        <li>Shaxs yoshlari va manzillari</li><li>Kasblar va mashinalar</li>
        <li>Joy nomlari va ta'riflari</li><li>Sonlar va raqamlar</li>
        <li>Taqriz</li><li>Mundarija va savollar statistikasi</li>
        <li>Barcha ma'lumotlar arxivi</li><li>Maxsus bo'lim</li>
      </ul>
    </div>
    <p class="foot" style="font-size:12px"><a href="#" id="haveLogin" style="color:#ffcc00">Hisobim bor — kirish</a></p>
    <p class="foot">Yarim yillik va yillik tariflarda narx chegirma bilan ko'rsatilgan · Yarim yillik va yillik tarifga — Word file bonus · Zuho.uz</p>
  </div>

  <div id="step2" class="form">
    <span class="badge">💎 ZUHO PREMIUM</span>
    <h2>Ma'lumotlaringizni kiriting</h2>
    <p class="chosen" id="chosen"></p>

    <label for="email">Email</label>
    <input type="email" id="email" placeholder="example@gmail.com" autocomplete="email">
    <div class="err" id="errEmail"></div>

    <label for="login">Login</label>
    <input type="text" id="login" placeholder="Login yarating" autocomplete="username">
    <div class="err" id="errLogin"></div>

    <button class="btn" id="submit" style="margin-top:16px">Davom etish</button>
    <button class="back" id="back">← Tariflarga qaytish</button>
  </div>
</div>

<script>
for(let i=0;i<60;i++){const s=document.createElement('span');s.className='star';s.style.top=Math.random()*100+'%';s.style.left=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';document.body.appendChild(s);}
function addSparks(p,n,x){for(let i=0;i<n;i++){const s=document.createElement('span');s.className='spark'+(x?' '+x:'');s.style.top=Math.random()*96+'%';s.style.left=Math.random()*96+'%';s.style.animationDuration=(1+Math.random()*2)+'s';s.style.animationDelay=(Math.random()*3)+'s';p.appendChild(s);}}
addSparks(document.querySelector('.box'),22);addSparks(document.body,18,'out');

let selected=null;
const $=id=>document.getElementById(id);

document.querySelectorAll('[data-plan]').forEach(function(b){
  b.addEventListener('click',function(){
    selected={plan:b.dataset.plan,price:b.dataset.price};
    $('chosen').textContent=selected.plan+' — '+selected.price;
    $('step1').style.display='none';
    $('step2').style.display='block';
  });
});

$('back').onclick=function(){
  $('step2').style.display='none';
  $('step1').style.display='block';
};

$('submit').onclick=function(){
  const email=$('email').value.trim(), login=$('login').value.trim();
  let ok=true;
  $('errEmail').textContent='';$('errLogin').textContent='';
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){$('errEmail').textContent="To'g'ri email kiriting";ok=false}
  if(login.length<3){$('errLogin').textContent="Login kamida 3 ta belgidan iborat bo'lsin";ok=false}
  if(!ok)return;
  parent.postMessage({type:'zuho:plan-selected',plan:selected.plan,price:selected.price,email:email,login:login},'*');
};

$('haveLogin').onclick=function(e){e.preventDefault();parent.postMessage({type:'zuho:have-account'},'*');};
</script>
</body>
</html>`;
let pricingFrame = null;

function openPricing(href, msg) {
  pendingHref = href;
  pendingMsg = msg;
  if (document.getElementById('gatePricing')) return;
  const o = document.createElement('div');
  o.id = 'gatePricing';
  o.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.88)';
  pricingFrame = document.createElement('iframe');
  pricingFrame.style.cssText = 'width:100%;height:100%;border:0';
  pricingFrame.srcdoc = PRICING_HTML;
  const x = document.createElement('button');
  x.textContent = '\u2715';
  x.style.cssText = 'position:absolute;top:14px;right:18px;width:38px;height:38px;border-radius:50%;border:1px solid #ffcc00;background:#111;color:#ffcc00;font-size:20px;cursor:pointer';
  x.onclick = closePricing;
  o.appendChild(pricingFrame); o.appendChild(x);
  document.body.appendChild(o);
}
function closePricing() {
  const o = document.getElementById('gatePricing');
  if (o) o.remove();
  pricingFrame = null;
}

window.addEventListener('message', e => {
  if (!pricingFrame || e.source !== pricingFrame.contentWindow || !e.data) return;
  if (e.data.type === 'zuho:plan-selected') {
    chosenPlan = { plan: e.data.plan, price: e.data.price, login: e.data.login || '' };
    const email = e.data.email || '';
    closePricing();
    openModal(pendingHref, pendingMsg + ' Tanlangan tarif: ' + chosenPlan.plan + ' (' + chosenPlan.price + ').');
    document.getElementById('gateEmail').value = email;   // email oldindan yozilgan
    document.getElementById('gatePass').focus();
  } else if (e.data.type === 'zuho:have-account') {
    closePricing();
    openModal(pendingHref, pendingMsg);
  }
});

// Tanlangan tarif va loginni foydalanuvchi profiliga yozib qo'yamiz (admin ko'rishi uchun)
async function savePlan(user) {
  if (!chosenPlan) return;
  try {
    await setDoc(doc(db, 'users', user.uid),
      { plan: chosenPlan.plan, price: chosenPlan.price, login: chosenPlan.login || '', planChosenAt: serverTimestamp() },
      { merge: true });
  } catch (e) { /* ruxsat bo'lmasa, e'tiborsiz qoldiramiz */ }
}

// ---------- Oyna (modal) ----------
function buildModal() {
  if (document.getElementById('gateModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'gateModal';
  wrap.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);align-items:center;justify-content:center;padding:16px';
  wrap.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:#1e1e1e;border:2px solid #ffcc00;border-radius:18px;padding:24px;width:340px;max-width:100%;text-align:center;font-family:Arial,sans-serif;color:#fff;box-shadow:0 0 30px rgba(255,204,0,.35)">
      <h3 style="margin:0 0 8px;color:#ffe89b">Kirish</h3>
      <p id="gateMsg" style="margin:0 0 14px;font-size:14px;color:#ccc;line-height:1.5"></p>
      <input id="gateEmail" type="email" placeholder="Email" autocomplete="email" style="width:100%;padding:11px;margin:5px 0;border-radius:8px;border:0;font-size:15px">
      <input id="gatePass" type="password" placeholder="Parol (kamida 6 belgi)" autocomplete="current-password" style="width:100%;padding:11px;margin:5px 0;border-radius:8px;border:0;font-size:15px">
      <button id="gateLogin"  style="width:100%;padding:11px;margin:6px 0 0;border:0;border-radius:30px;background:#00ff99;color:#111;font-weight:bold;cursor:pointer">Kirish</button>
      <button id="gateSignup" style="width:100%;padding:11px;margin:6px 0 0;border:0;border-radius:30px;background:#ffcc00;color:#111;font-weight:bold;cursor:pointer">Ro'yxatdan o'tish</button>
      <button id="gateGoogle" style="width:100%;padding:11px;margin:6px 0 0;border:0;border-radius:30px;background:#fff;color:#111;font-weight:bold;cursor:pointer">Google bilan kirish</button>
      <div id="gateErr" style="color:#ff6b6b;font-size:13px;margin-top:10px;min-height:18px"></div>
      <div id="gateClose" style="color:#aaa;cursor:pointer;margin-top:6px;font-size:13px">Yopish</div>
    </div>`;
  document.body.appendChild(wrap);

  wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
  document.getElementById('gateClose').onclick = closeModal;
  document.getElementById('gateLogin').onclick  = () => attempt(() => signInWithEmailAndPassword(auth, val('gateEmail'), val('gatePass')));
  document.getElementById('gateSignup').onclick = () => attempt(() => createUserWithEmailAndPassword(auth, val('gateEmail'), val('gatePass')));
  document.getElementById('gateGoogle').onclick = () => attempt(() => signInWithPopup(auth, new GoogleAuthProvider()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}
const val = id => document.getElementById(id).value.trim();

function openModal(href, msg) {
  buildModal();
  pendingHref = href;
  document.getElementById('gateMsg').textContent = msg;
  document.getElementById('gateErr').textContent = '';
  document.getElementById('gateModal').style.display = 'flex';
}
function closeModal() {
  const m = document.getElementById('gateModal');
  if (m) m.style.display = 'none';
}

const ERRORS = {
  'auth/invalid-credential':   "Email yoki parol noto'g'ri.",
  'auth/wrong-password':       "Email yoki parol noto'g'ri.",
  'auth/user-not-found':       "Bunday foydalanuvchi yo'q. «Ro'yxatdan o'tish» ni bosing.",
  'auth/email-already-in-use': "Bu email band. «Kirish» tugmasini bosing.",
  'auth/weak-password':        "Parol kamida 6 belgidan iborat bo'lsin.",
  'auth/invalid-email':        "Email noto'g'ri yozilgan.",
  'auth/popup-closed-by-user': "",
  'auth/unauthorized-domain':  "Bu sayt Firebase'da ruxsat etilmagan (Authorized domains)."
};

async function attempt(fn) {
  const err = document.getElementById('gateErr');
  err.textContent = '';
  try {
    const cred = await fn();
    await ensureProfile(cred.user);
    await savePlan(cred.user);
    closeModal();
    if (pendingHref) go(pendingHref);
  } catch (e) {
    err.textContent = ERRORS[e.code] ?? (e.code || e.message);
  }
}

// Profil hujjati yo'q bo'lsa, yaratib qo'yamiz (profile.html shu ma'lumotni to'ldiradi)
async function ensureProfile(user) {
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    const p = (user.displayName || '').trim().split(/\s+/);
    await setDoc(ref, {
      firstName: p[0] || '', lastName: p.slice(1).join(' '),
      name: (user.displayName || '').trim(),
      phone: '', email: user.email || '', photo: user.photoURL || '',
      createdAt: serverTimestamp(), results: []
    });
  } catch (e) { /* profil keyin profile.html da yaratiladi */ }
}

function go(href) {
  const w = window.open(href, '_blank');
  if (!w) location.href = href;   // brauzer yangi oynani bloklasa, shu oynada ochamiz
}

// ---------- Kartalarni boshqarish ----------
// ⭐ (premium sinfi) -> darhol login talab qilinadi
// Bob kartalari (card-green) -> FREE_CHAPTERS marta bepul, keyin login
document.addEventListener('click', async e => {
  const a = e.target.closest('a.card');
  if (!a) return;
  const star    = a.classList.contains('premium');
  const chapter = a.classList.contains('card-green') && !star;
  if (!star && !chapter) return;

  e.preventDefault();
  await auth.authStateReady();                 // saqlangan loginni tiklab olguncha kutadi

  if (auth.currentUser) { go(a.href); return; }

  if (chapter) {
    const used = +localStorage.getItem('freeChapters') || 0;
    if (used < FREE_CHAPTERS) {
      localStorage.setItem('freeChapters', used + 1);
      go(a.href);
      return;
    }
  }
  openPricing(a.href, star ? MSG_STAR : MSG_CHAPTER);
}, true);
