// --- Firebase ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
  getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, getDocs, query, where
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

// --- Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDAv3m65La3hiFF0grOR4Y-wkgFOpWBULQ",
  authDomain: "ecommerce-3fce4.firebaseapp.com",
  projectId: "ecommerce-3fce4",
  storageBucket: "ecommerce-3fce4.appspot.com",
  messagingSenderId: "34719726963",
  appId: "1:34719726963:web:4e4bfd02f3209052a41906"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = id => document.getElementById(id);
const page = document.body.id;
const ADMIN_UID = 'NJtL7u6sDBb3jbFmCgSmZKXgznn1';
let currentUser = null;

// --- Helpers ---
async function updateCartBadge() {
  if (!currentUser) {
    $('cart-count') && ($('cart-count').textContent = 0);
    return;
  }
  const cartSnap = await getDocs(collection(db, "carts", currentUser.uid, "items"));
  $('cart-count') && ($('cart-count').textContent = cartSnap.size);
}

// --- Load Products ---
async function loadProducts() {
  const productsEl = $('products');
  const productsRef = collection(db, 'products');
  const snap = await getDocs(productsRef);

  if (snap.empty) {
    productsEl.innerHTML = '<p>No products available.</p>';
    return;
  }

  productsEl.innerHTML = '';
  snap.forEach(docSnap => {
    const p = { id: docSnap.id, ...docSnap.data() };
    let alreadyInCart = false;
    if (currentUser) {
      alreadyInCart = false; // will check later
    }

    productsEl.innerHTML += `
      <div class="col-md-4">
        <div class="card mb-3">
          <img src="${p.image || 'https://via.placeholder.com/300'}" class="card-img-top">
          <div class="card-body">
            <h5>${p.name}</h5>
            <p>${p.desc || ''}</p>
            ${currentUser ? `<button class="btn btn-dark add-to-cart" data-id="${p.id}">Add to Cart</button>` : ''}
          </div>
        </div>
      </div>
    `;
  });

  // Add to cart button
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.onclick = async () => {
      const prodId = btn.dataset.id;
      const cartSnap = await getDocs(collection(db, "carts", currentUser.uid, "items"));
      const exists = cartSnap.docs.some(d => d.data().productId === prodId);
      if (exists) return Swal.fire('Info', 'Already in cart', 'info');

      await addDoc(collection(db, "carts", currentUser.uid, "items"), { productId: prodId, qty: 1 });
      Swal.fire('Added', 'Product added to cart', 'success');
      updateCartBadge();
      btn.disabled = true;
      btn.textContent = 'Added';
    };
  });
}

// --- Auth State ---
onAuthStateChanged(auth, (user) => {
  currentUser = user || null;

  // Navbar login/logout
  const loginLink = $('login-link');
  if (loginLink) {
    if (page === 'page-login') {
      loginLink.textContent = 'Login';
      loginLink.href = 'login.html';
      loginLink.onclick = null;
    } else {
      if (currentUser) {
        loginLink.textContent = 'Logout';
        loginLink.href = '#';
        loginLink.onclick = async () => {
          await signOut(auth);
          Swal.fire('Logged out', 'See you soon', 'info').then(() => window.location.href = 'login.html');
        };
      } else {
        loginLink.textContent = 'Login';
        loginLink.href = 'login.html';
        loginLink.onclick = null;
      }
    }
  }

  updateCartBadge();

  if (page === 'page-index') loadProducts();
});

// --- Login ---
$('login-btn')?.addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const password = $('login-password').value.trim();
  if (!email || !password) return Swal.fire('Error', 'Enter email & password', 'error');

  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    Swal.fire('Welcome', 'Login successful', 'success').then(() => {
      if (user.uid === ADMIN_UID) window.location.href = 'dashboard.html';
      else window.location.href = 'index.html';
    });
  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
});

// --- Signup ---
$('signup-btn')?.addEventListener('click', async () => {
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value.trim();
  if (!email || !password) return Swal.fire('Error', 'Enter email & password', 'error');

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    Swal.fire('Success', 'Account created', 'success').then(() => window.location.href = 'login.html');
  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
});

// --- Dashboard (Admin) ---
if (page === 'page-dashboard') {
  const productsRef = collection(db, 'products');
  const tableBody = document.querySelector('#admin-table tbody');

  onSnapshot(productsRef, snap => {
    tableBody.innerHTML = '';
    snap.forEach(docSnap => {
      const p = { id: docSnap.id, ...docSnap.data() };
      tableBody.innerHTML += `
        <tr>
          <td>${p.name}</td>
          <td>${p.price || 0}</td>
          <td>
            <button class="btn btn-sm btn-warning edit" data-id="${p.id}">Edit</button>
            <button class="btn btn-sm btn-danger delete" data-id="${p.id}">Delete</button>
          </td>
        </tr>
      `;
    });

    // --- Delete product ---
    document.querySelectorAll('.delete').forEach(btn => {
      btn.onclick = async () => {
        const confirmed = await Swal.fire({
          title: 'Delete?',
          showCancelButton: true,
          icon: 'warning'
        }).then(r => r.isConfirmed);
        if (!confirmed) return;

        const prodId = btn.dataset.id;
        await deleteDoc(doc(db, 'products', prodId));

        // Remove from all carts
        const cartsSnap = await getDocs(collection(db, 'carts'));
        for (const userCartDoc of cartsSnap.docs) {
          const itemsSnap = await getDocs(collection(db, 'carts', userCartDoc.id, 'items'));
          for (const itemDoc of itemsSnap.docs) {
            if (itemDoc.data().productId === prodId) {
              await deleteDoc(doc(db, 'carts', userCartDoc.id, 'items', itemDoc.id));
            }
          }
        }
        Swal.fire('Deleted', 'Product removed', 'success');
      };
    });

    // --- Edit product ---
    document.querySelectorAll('.edit').forEach(btn => {
      btn.onclick = async () => {
        const prodId = btn.dataset.id;
        const prodSnap = snap.docs.find(d => d.id === prodId);
        const data = prodSnap.data();

        const { value: updated } = await Swal.fire({
          title: 'Edit Product',
          html: `
            <input id="prod-name" class="swal2-input" placeholder="Name" value="${data.name}">
            <input id="prod-price" type="number" class="swal2-input" placeholder="Price" value="${data.price || 0}">
            <input id="prod-image" class="swal2-input" placeholder="Image URL" value="${data.image || ''}">
            <textarea id="prod-desc" class="swal2-textarea" placeholder="Description">${data.desc || ''}</textarea>
          `,
          focusConfirm: false,
          preConfirm: () => {
            const name = document.getElementById('prod-name').value.trim();
            const price = parseFloat(document.getElementById('prod-price').value) || 0;
            const image = document.getElementById('prod-image').value.trim();
            const desc = document.getElementById('prod-desc').value.trim();
            if (!name) throw new Error('Product name required');
            return { name, price, image, desc };
          }
        });

        if (updated) {
          await updateDoc(doc(db, 'products', prodId), updated);
          Swal.fire('Updated', 'Product updated', 'success');
        }
      };
    });
  });

  $('save-prod')?.addEventListener('click', async () => {
    const name = $('prod-name').value.trim();
    const price = parseFloat($('prod-price').value) || 0;
    const file = $('prod-file')?.files?.[0];
    let imageUrl = $('prod-image').value.trim();

    if (!name) return Swal.fire('Error', 'Product name required', 'error');
    if (file) {
      const storageRef = ref(storage, `products/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      imageUrl = await getDownloadURL(storageRef);
    }

    await addDoc(productsRef, { name, price, image: imageUrl, desc: $('prod-desc').value.trim() });
    Swal.fire('Added', 'Product added', 'success');
    document.querySelector('#productModal .btn-close').click();
  });
}

// --- Cart Page ---
if (page === 'page-cart') {
  const cartEl = $('cart-items');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cartEl.innerHTML = '<p>Please log in to view your cart.</p>';
      return;
    }

    const snap = await getDocs(collection(db, "carts", user.uid, "items"));
    if (snap.empty) {
      cartEl.innerHTML = '<p>Your cart is empty.</p>';
      return;
    }

    cartEl.innerHTML = '';
    for (const docSnap of snap.docs) {
      const item = docSnap.data();
      const prodSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', item.productId)));
      const prod = prodSnap.docs[0]?.data() || {};
      cartEl.innerHTML += `
        <div class="d-flex justify-content-between border p-2 mb-2">
          <span>${prod.name || 'Unknown Product'} - $${prod.price || 0}</span>
          <span>Qty: ${item.qty}</span>
          <button class="btn btn-danger btn-sm remove" data-id="${docSnap.id}">Remove</button>
        </div>
      `;
    }

    document.querySelectorAll('.remove').forEach(btn => {
      btn.onclick = async () => {
        await deleteDoc(doc(db, "carts", user.uid, "items", btn.dataset.id));
        Swal.fire('Removed', 'Item removed from cart', 'success');
        location.reload();
      };
    });
  });
}

// --- Checkout Page ---
if (page === 'page-checkout') {
  const checkoutList = $('checkout-list');
  const checkoutTotal = $('checkout-total');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      checkoutList.innerHTML = '<p>Please log in to checkout.</p>';
      $('place-order').disabled = true;
      return;
    }

    const snap = await getDocs(collection(db, "carts", user.uid, "items"));
    if (snap.empty) {
      checkoutList.innerHTML = '<p>Your cart is empty.</p>';
      $('place-order').disabled = true;
      checkoutTotal.textContent = '$0.00';
      return;
    }

    checkoutList.innerHTML = '';
    let total = 0;

    for (const docSnap of snap.docs) {
      const item = docSnap.data();
      const prodSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', item.productId)));
      const prod = prodSnap.docs[0]?.data() || {};
      const price = prod.price || 0;
      const qty = item.qty || 1;
      total += price * qty;

      checkoutList.innerHTML += `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <span>${prod.name || 'Unknown Product'} - $${price}</span>
          <input type="number" class="form-control form-control-sm w-25 me-2 qty-input" min="1" value="${qty}" data-id="${docSnap.id}" data-price="${price}">
          <span class="item-total">$${(price * qty).toFixed(2)}</span>
          <button class="btn btn-danger btn-sm ms-2 remove-item" data-id="${docSnap.id}">Remove</button>
        </div>
      `;
    }

    checkoutTotal.textContent = `$${total.toFixed(2)}`;
    $('place-order').disabled = false;

    document.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('input', () => {
        const newQty = parseInt(input.value) || 1;
        const price = parseFloat(input.dataset.price);
        input.nextElementSibling.textContent = `$${(newQty * price).toFixed(2)}`;

        let newTotal = 0;
        document.querySelectorAll('.qty-input').forEach(i => {
          newTotal += parseInt(i.value) * parseFloat(i.dataset.price);
        });
        checkoutTotal.textContent = `$${newTotal.toFixed(2)}`;
      });
    });

    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.onclick = async () => {
        const itemId = btn.dataset.id;
        await deleteDoc(doc(db, "carts", user.uid, "items", itemId));
        Swal.fire('Removed', 'Item removed from cart', 'success');
        btn.parentElement.remove();

        let newTotal = 0;
        document.querySelectorAll('.qty-input').forEach(i => {
          newTotal += parseInt(i.value) * parseFloat(i.dataset.price);
        });
        checkoutTotal.textContent = `$${newTotal.toFixed(2)}`;

        if (document.querySelectorAll('.list-group-item').length === 0) {
          checkoutList.innerHTML = '<p>Your cart is empty.</p>';
          $('place-order').disabled = true;
        }
      };
    });

    $('place-order').onclick = async () => {
      for (const docSnap of snap.docs) {
        const newQty = parseInt(document.querySelector(`.qty-input[data-id="${docSnap.id}"]`).value) || 1;
        await updateDoc(doc(db, "carts", user.uid, "items", docSnap.id), { qty: newQty });
        await deleteDoc(doc(db, "carts", user.uid, "items", docSnap.id));
      }
      Swal.fire('Order Placed!', 'Thank you for your purchase.', 'success').then(() => {
        window.location.href = 'index.html';
      });
    };
  });
}
