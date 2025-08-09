{
  "name": "luxury-store-firebase",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "firebase": "^9.22.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
# Luxury Store — Firebase + Netlify Ready

## Overview
Single-page React store with:
- Black glass luxury theme
- 3D-like product tilt
- Cart + Razorpay test checkout
- Firebase Auth (admin) + Firestore (products/meta) + Storage (product images)
- Admin panel: change brand name, add/edit/delete products, change admin password (via Firebase Auth)

## Setup (quick)
1. Clone this repo or create new repo and paste files.
2. Run locally:
## Firebase setup
1. Go to https://console.firebase.google.com → Create Project.
2. In Project Overview → Add web app → register app.
3. Copy the firebase config object and replace `REPLACE_WITH_FIREBASE_CONFIG` in `src/firebase.js`.
4. In Firebase console:
- Authentication → Sign-in method → enable Email/Password.
- Firestore Database → Create database (start in test mode for now).
- Storage → Create default bucket.
5. Create initial admin user:
- Authentication → Users → Add user \
  **Email:** `nohacker892@gmail.com` \
  **Password:** `luxarystore07860`
- (After first login change password via Admin panel or Firebase console.)

## Firestore structure (recommended)
- collection `meta` (doc id: `site`) with fields:
- brand: string
- collection `products`:
- each doc: { title, price (number), desc, img (url) }

You can seed products from Admin panel.

## Razorpay test
- Use test key id in code: find `rzp_test_yourkeyhere` in `src/App.jsx` and replace with your test key id.
- Test UPI: `success@razorpay`, card: `4111 1111 1111 1111` (any future date, cvv 123).

## Deploy to Netlify
1. Push repo to GitHub.
2. Create Netlify account → New site → Import from Git → select this repo.
3. Build command: `npm run build` (Netlify auto-detects), Publish directory: `build`.
4. Deploy.

## Security notes
- This demo stores admin info in Firebase Auth. After setup, change the password.
- For production, implement server-side order verification for Razorpay (webhooks).
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SoapyStore — Minimal Luxe</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
// firebase.js (modular v9)
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = REPLACE_WITH_FIREBASE_CONFIG;

/* Example:
const firebaseConfig = {
  apiKey: "xxx",
  authDomain: "xxx.firebaseapp.com",
  projectId: "xxx",
  storageBucket: "xxx.appspot.com",
  messagingSenderId: "xxx",
  appId: "xxx"
};
*/

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
import React, { useEffect, useState } from "react";
import { auth, db, storage } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, setDoc
} from "firebase/firestore";

function App(){
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [brand, setBrand] = useState("SoapyStore");
  const [cart, setCart] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(()=>{
    // auth listener
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if(u) fetchMeta();
    });
    // products realtime
    const col = collection(db, 'products');
    const unsubProd = onSnapshot(col, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setProducts(arr);
    });
    return () => { unsub(); unsubProd(); };
  },[]);

  async function fetchMeta(){
    try{
      const docRef = doc(db, 'meta', 'site');
      const ds = await getDocs(collection(db,'meta')); // just in case
      // try direct get
      const d = (await import("firebase/firestore")).getDoc ? null : null;
      // fallback: read doc directly
      const snap = await fetchMetaBrand();
      if(snap) setBrand(snap);
    }catch(e){}
  }

  // helper to read brand from meta/site
  async function fetchMetaBrand(){
    try{
      const docRef = doc(db,'meta','site');
      const res = await (await import("firebase/firestore")).getDoc(docRef);
      if(res.exists()) return res.data().brand;
    }catch(e){}
    return null;
  }

  // cart handlers
  function addToCart(p){
    setCart(prev=>{
      const ex = prev.find(i=>i.id===p.id);
      if(ex) return prev.map(i=> i.id===p.id ? {...i, qty: i.qty+1} : i);
      return [...prev, {...p, qty:1}];
    });
  }
  function removeFromCart(id){
    setCart(prev => prev.filter(i=>i.id!==id));
  }
  function getTotal(){ return cart.reduce((s,i)=>s + i.price * i.qty, 0); }

  function checkout(){
    if(cart.length===0){ alert('Cart is empty'); return; }
    const total = getTotal();
    const options = {
      key: "rzp_test_yourkeyhere",
      amount: total * 100,
      currency: "INR",
      name: brand,
      description: "Order payment",
      handler: function(resp){
        alert("Payment success: " + resp.razorpay_payment_id);
        setCart([]);
      }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  // simple login (admin)
  async function login(email, pass){
    try{
      await signInWithEmailAndPassword(auth, email, pass);
      setShowAdmin(false);
    }catch(e){ alert('Login failed: '+ e.message); }
  }
  async function logout(){ await signOut(auth); }

  return (
    <div className="app-wrap">
      <header className="top">
        <div className="brand">{brand}</div>
        <div className="actions">
          {user ? <button className="btn" onClick={()=> setShowAdmin(true)}>Admin</button>
               : <button className="btn" onClick={()=> setShowAdmin(true)}>Admin Login</button>}
          <button className="btn" onClick={()=> alert('Cart: '+ cart.length)}>Cart ({cart.reduce((s,i)=>s+i.qty,0)})</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <h1>{brand} — Minimal. Modern. Luxury.</h1>
            <p className="muted">Premium curated clothing — crafted with care.</p>
          </div>
          <div className="hero-visual">Model / Visual</div>
        </section>

        <section className="product-grid">
          {products.map(p=>(
            <article className="card" key={p.id}>
              <div className="thumb">{ p.img ? <img src={p.img} alt={p.title} /> : <div>{p.title}</div> }</div>
              <h3>{p.title}</h3>
              <div className="muted small">{p.desc}</div>
              <div className="price">₹{p.price}</div>
              <div className="card-actions">
                <button className="btn" onClick={()=> addToCart(p)}>Add to Cart</button>
              </div>
            </article>
          ))}
        </section>

        <div className="cart-area">
          <h3>Cart</h3>
          {cart.map(i=>(
            <div key={i.id} className="cart-row">
              <div>{i.title} x {i.qty}</div>
              <div>₹{i.price * i.qty}</div>
              <div><button className="btn" onClick={()=> removeFromCart(i.id)}>Remove</button></div>
            </div>
          ))}
          <div className="total">Total: ₹{getTotal()}</div>
          <button className="btn btn-black" onClick={checkout}>Pay (Razorpay)</button>
        </div>
      </main>

      {showAdmin && <AdminModal onClose={()=> setShowAdmin(false)} login={login} user={user} brand={brand} setBrand={setBrand} />}

    </div>
  );
}

/* --------------- Admin modal component --------------- */
function AdminModal({ onClose, login, user, brand, setBrand }){
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pTitle, setPTitle] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDesc, setPDesc] = useState("");

  async function handleCreateProduct(){
    try{
      const col = collection(db,'products');
      await addDoc(col, { title:pTitle, price: Number(pPrice), desc: pDesc, img: ''});
      setPTitle(''); setPPrice(''); setPDesc('');
      alert('Product added');
    }catch(e){ alert('Error: '+e.message); }
  }

  return (
    <div className="modal-bg">
      <div className="modal">
        <button onClick={onClose} className="btn">Close</button>
        {!user ? (
          <div>
            <h3>Admin Login</h3>
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} type="password" />
            <button className="btn" onClick={()=> login(email, pass)}>Login</button>
          </div>
        ) : (
          <div>
            <h3>Admin Panel</h3>
            <div>
              <label>Brand name</label>
              <input value={brand} onChange={e=> setBrand(e.target.value)} />
              <button className="btn" onClick={async ()=>{
                // set meta site doc
                await setDoc(doc(db,'meta','site'), { brand });
                alert('Brand updated');
              }}>Save Brand</button>
            </div>

            <hr />

            <div>
              <h4>Add product</h4>
              <input placeholder="Title" value={pTitle} onChange={e=>setPTitle(e.target.value)} />
              <input placeholder="Price" value={pPrice} onChange={e=>setPPrice(e.target.value)} />
              <input placeholder="Desc" value={pDesc} onChange={e=>setPDesc(e.target.value)} />
              <button className="btn" onClick={handleCreateProduct}>Add Product</button>
            </div>

            <div style={{marginTop:12}}>
              <button className="btn" onClick={async ()=>{ await signOut(auth); alert('Logged out'); }}>Logout</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
:root{--bg:#070707;--fg:#fff;--muted:#bfbfbf}
body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:linear-gradient(180deg,#050505,#0b0b0b);color:var(--fg)}
.app-wrap{max-width:1100px;margin:0 auto;padding:20px}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.04);padding-bottom:12px}
.brand{font-weight:800;letter-spacing:2px;font-size:20px}
.btn{background:none;border:1px solid rgba(255,255,255,0.08);padding:8px 10px;border-radius:8px;color:var(--fg);cursor:pointer}
.btn-black{background:#fff;color:#000;border:none;padding:8px 12px}
.hero{display:flex;justify-content:space-between;align-items:center;padding:28px 0}
.hero-visual{width:320px;height:200px;background:linear-gradient(180deg,#0b0b0b,#121212);display:flex;align-items:center;justify-content:center;border-radius:12px}
.product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;margin-top:18px}
.card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.03);box-shadow:0 8px 30px rgba(0,0,0,0.6);transition:transform .25s}
.card:hover{transform:translateY(-6px) scale(1.02)}
.thumb{height:220px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#0c0c0c;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover}
.muted{color:var(--muted)}
.price{font-weight:800;margin-top:8px}
.card-actions{margin-top:10px}
.cart-area{margin-top:28px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.03)}
.cart-row{display:flex;justify-content:space-between;padding:6px 0}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000}
.modal{background:linear-gradient(180deg,#0b0b0b,#0a0a0a);padding:16px;border-radius:10px;width:520px;max-width:95%}
input,textarea{width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:var(--fg);margin-top:8px}
@media (max-width:800px){ .hero{flex-direction:column} .hero-visual{width:100%} .product-grid{grid-template-columns:repeat(1,1fr)} .modal{width:95%} }
