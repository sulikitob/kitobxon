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
  openModal(a.href, star ? MSG_STAR : MSG_CHAPTER);
}, true);
