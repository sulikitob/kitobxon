// auth-gate.js — sahifaga bitta marta ulanadi:
// <script type="module" src="auth-gate.js"></script>
//
// Tizim: odam ro'yxatdan o'tadi -> "admin tasdiqlashini kuting" xabari chiqadi.
// Siz Firestore'da `ruxsat` kolleksiyasiga uning emailini qo'shsangiz, hamma bo'lim ochiladi.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDpPcnPR7eIUszgEKcbTxGmx6EpAqaa1kU",
    authDomain: "yosh-kitobxon-996ea.firebaseapp.com",
    projectId: "yosh-kitobxon-996ea",
    storageBucket: "yosh-kitobxon-996ea.firebasestorage.app",
    messagingSenderId: "53160446209",
    appId: "1:53160446209:web:bd66a7ece7be8325d3f300"
};

// ---------- Sozlamalar ----------
const FREE_CHAPTERS = 1;                          // login so'ramasdan nechta bobga kirish mumkin
const ALLOW_GOOGLE  = true;                       // false bo'lsa "Google bilan kirish" tugmasi yashiriladi
const ADMIN_LINK    = "https://t.me/dou_shen_peak"; // "Adminga yozish" tugmasi shu yerga olib boradi

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const MSG_STAR    = "Bu bo'lim ⭐ belgili. Davom etish uchun kiring yoki ro'yxatdan o'ting.";
const MSG_CHAPTER = "Bepul kirish tugadi. Davom etish uchun kiring yoki ro'yxatdan o'ting.";

let pendingHref = null;
const approvedCache = {};

// ---------- Tasdiqlanganmi? (Firestore: ruxsat/{email}, ichida ok: true) ----------
async function isApproved(user) {
  if (!user || !user.email) return false;
  const key = user.email.toLowerCase();
  if (approvedCache[key]) return true;
  try {
    const snap = await getDoc(doc(db, 'ruxsat', key));
    const ok = snap.exists() && snap.data().ok === true;
    if (ok) approvedCache[key] = true;
    return ok;
  } catch (e) { return false; }
}

// ---------- Oyna (modal) ----------
const $ = id => document.getElementById(id);
const val = id => $(id).value.trim();

function buildModal() {
  if ($('gateModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'gateModal';
  wrap.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);align-items:center;justify-content:center;padding:16px';
  const btn = 'width:100%;padding:11px;margin:6px 0 0;border:0;border-radius:30px;font-weight:bold;cursor:pointer;font-size:15px';
  wrap.innerHTML = `
    <div role="dialog" aria-modal="true" style="background:#1e1e1e;border:2px solid #ffcc00;border-radius:18px;padding:24px;width:350px;max-width:100%;text-align:center;font-family:Arial,sans-serif;color:#fff;box-shadow:0 0 30px rgba(255,204,0,.35)">

      <div id="gateForm">
        <h3 style="margin:0 0 8px;color:#ffe89b">Kirish</h3>
        <p id="gateMsg" style="margin:0 0 14px;font-size:14px;color:#ccc;line-height:1.5"></p>
        <input id="gateEmail" type="email" placeholder="Email" autocomplete="email" style="width:100%;padding:11px;margin:5px 0;border-radius:8px;border:0;font-size:15px">
        <input id="gatePass" type="password" placeholder="Parol (kamida 6 belgi)" autocomplete="current-password" style="width:100%;padding:11px;margin:5px 0;border-radius:8px;border:0;font-size:15px">
        <button id="gateLogin"  style="${btn};background:#00ff99;color:#111">Kirish</button>
        <button id="gateSignup" style="${btn};background:#ffcc00;color:#111">Ro'yxatdan o'tish</button>
        <button id="gateGoogle" style="${btn};background:#fff;color:#111">Google bilan kirish</button>
        <div id="gateErr" style="color:#ff6b6b;font-size:13px;margin-top:10px;min-height:18px"></div>
      </div>

      <div id="gatePending" style="display:none">
        <h3 id="pendTitle" style="margin:0 0 10px;color:#ffe89b"></h3>
        <p style="margin:0 0 10px;font-size:14px;color:#ccc;line-height:1.6">
          Kirish huquqini admin beradi. Login va parol (ruxsat) olish uchun adminga murojaat qiling va shu emailni ayting:
        </p>
        <div id="pendEmail" style="background:#2a2a2a;border-radius:8px;padding:10px;font-weight:bold;color:#00ff99;word-break:break-all;margin-bottom:8px"></div>
        <a id="pendAdmin" target="_blank" rel="noopener" style="display:block;${btn};background:#ffcc00;color:#111;text-decoration:none">Adminga yozish</a>
        <button id="pendRecheck" style="${btn};background:transparent;border:2px solid #00ff99;color:#00ff99">Tekshirish</button>
        <button id="pendSwitch"  style="${btn};background:transparent;border:2px solid #666;color:#bbb">Boshqa akkaunt bilan kirish</button>
        <div id="pendStatus" style="font-size:13px;margin-top:10px;min-height:18px;color:#ff9900"></div>
      </div>

      <div id="gateClose" style="color:#aaa;cursor:pointer;margin-top:10px;font-size:13px">Yopish</div>
    </div>`;
  document.body.appendChild(wrap);

  wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
  $('gateClose').onclick  = closeModal;
  $('gateLogin').onclick  = () => attempt(() => signInWithEmailAndPassword(auth, val('gateEmail'), $('gatePass').value), false);
  $('gateSignup').onclick = () => attempt(() => createUserWithEmailAndPassword(auth, val('gateEmail'), $('gatePass').value), true);
  $('gateGoogle').onclick = () => attempt(() => signInWithPopup(auth, new GoogleAuthProvider()), false);
  if (!ALLOW_GOOGLE) $('gateGoogle').style.display = 'none';

  $('pendAdmin').href = ADMIN_LINK;
  $('pendRecheck').onclick = async () => {
    const st = $('pendStatus');
    st.style.color = '#999'; st.textContent = 'Tekshirilmoqda...';
    if (await isApproved(auth.currentUser)) { closeModal(); if (pendingHref) go(pendingHref); }
    else { st.style.color = '#ff9900'; st.textContent = 'Hali tasdiqlanmagan. Admin ruxsat bergach, qayta tekshiring.'; }
  };
  $('pendSwitch').onclick = async () => { await signOut(auth); openForm(pendingHref, ''); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openForm(href, msg) {
  buildModal();
  pendingHref = href;
  $('gateMsg').textContent = msg || 'Email va parol bilan kiring.';
  $('gateErr').textContent = '';
  $('gateForm').style.display = 'block';
  $('gatePending').style.display = 'none';
  $('gateModal').style.display = 'flex';
}

function openPending(href, justRegistered) {
  buildModal();
  pendingHref = href;
  $('pendTitle').textContent = justRegistered
    ? "✅ Ro'yxatdan o'tdingiz!"
    : "⏳ Akkauntingiz hali tasdiqlanmagan";
  $('pendEmail').textContent = (auth.currentUser && auth.currentUser.email) || '';
  $('pendStatus').textContent = '';
  $('gateForm').style.display = 'none';
  $('gatePending').style.display = 'block';
  $('gateModal').style.display = 'flex';
}

function closeModal() {
  const m = $('gateModal');
  if (m) m.style.display = 'none';
}

const GOOGLE_HINT = ALLOW_GOOGLE ? " Agar Google orqali kirgan bo'lsangiz, «Google bilan kirish» ni bosing." : "";
const ERRORS = {
  'auth/invalid-credential':   "Email yoki parol noto'g'ri." + GOOGLE_HINT,
  'auth/wrong-password':       "Email yoki parol noto'g'ri." + GOOGLE_HINT,
  'auth/user-not-found':       "Bunday foydalanuvchi yo'q. «Ro'yxatdan o'tish» ni bosing.",
  'auth/email-already-in-use': "Bu email avval ro'yxatdan o'tgan. «Kirish» ni bosing." + GOOGLE_HINT,
  'auth/weak-password':        "Parol kamida 6 belgidan iborat bo'lsin.",
  'auth/invalid-email':        "Email noto'g'ri yozilgan.",
  'auth/missing-password':     "Parolni kiriting.",
  'auth/too-many-requests':    "Juda ko'p urinish. Bir ozdan keyin qayta urinib ko'ring.",
  'auth/popup-closed-by-user': "",
  'auth/unauthorized-domain':  "Bu sayt Firebase'da ruxsat etilmagan (Authorized domains)."
};

async function attempt(fn, isSignup) {
  const err = $('gateErr');
  err.textContent = '';
  try {
    const cred = await fn();
    await ensureProfile(cred.user);
    if (await isApproved(cred.user)) {
      closeModal();
      if (pendingHref) go(pendingHref);
    } else {
      openPending(pendingHref, isSignup);
    }
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
// ⭐ (premium sinfi): faqat tasdiqlangan akkaunt kira oladi
// Bob kartalari (card-green): FREE_CHAPTERS marta hamma uchun bepul, keyin faqat tasdiqlangan akkaunt
document.addEventListener('click', async e => {
  const a = e.target.closest('a.card');
  if (!a) return;
  const star    = a.classList.contains('premium');
  const chapter = a.classList.contains('card-green') && !star;
  if (!star && !chapter) return;

  e.preventDefault();
  await auth.authStateReady();                 // saqlangan loginni tiklab olguncha kutadi
  const user = auth.currentUser;

  if (await isApproved(user)) { go(a.href); return; }

  if (chapter) {
    const used = +localStorage.getItem('freeChapters') || 0;
    if (used < FREE_CHAPTERS) {
      localStorage.setItem('freeChapters', used + 1);
      go(a.href);
      return;
    }
  }

  if (user) openPending(a.href, false);
  else openForm(a.href, star ? MSG_STAR : MSG_CHAPTER);
}, true);
