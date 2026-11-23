const firebaseConfig = {
    apiKey: "AIzaSyAdj9--YZ2PbeWJwAJEikfiv_VFY7IrEyc",
    authDomain: "rick-46516.firebaseapp.com",
    databaseURL: "https://rick-46516-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rick-46516",
    storageBucket: "rick-46516.firebasestorage.app",
    messagingSenderId: "364967638459",
    appId: "1:364967638459:web:e8ebf1933670860b16009e",
    measurementId: "G-BS0KBQ20NG"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth();

const ADMIN_ACTIVATION_CODE = "ADMIN-RICK-2026";
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function emailToKey(email) {
    return email.trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_');
}

function waitForAuthUser() {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

async function getCryptoKey() {
    const rawKey = new TextEncoder().encode("RickConcertSecretKey2026!32Byte!");
    return crypto.subtle.importKey(
        "raw",
        rawKey.slice(0, 32),
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptText(plainText) {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);
    const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return {
        cipher: Array.from(new Uint8Array(cipherBuffer), b => b.toString(16).padStart(2, '0')).join(''),
        iv: Array.from(iv, b => b.toString(16).padStart(2, '0')).join(''),
        mode: "AES-GCM"
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- БУРГЕР-МЕНЮ ---
    const burgerBtn = document.getElementById('burgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (burgerBtn && mobileMenu) {
        burgerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            mobileMenu.classList.toggle('active');
        });
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => mobileMenu.classList.remove('active'));
        });
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && e.target !== burgerBtn) {
                mobileMenu.classList.remove('active');
            }
        });
    }

    // --- ШАБЛОНЫ И АВТОФОРМАТИРОВАНИЕ ---
    const phoneEl = document.getElementById('phone');
    phoneEl?.addEventListener('input', () => {
        let digits = phoneEl.value.replace(/\D/g, '');
        if (digits.startsWith('8')) digits = '7' + digits.slice(1);
        if (!digits.startsWith('7') && digits.length > 0) digits = '7' + digits;
        digits = digits.slice(0, 11);

        let formatted = '';
        if (digits.length > 0) formatted = '+' + digits[0];
        if (digits.length > 1) formatted += ' (' + digits.slice(1, 4);
        if (digits.length >= 4) formatted += ')';
        if (digits.length > 4) formatted += ' ' + digits.slice(4, 7);
        if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
        if (digits.length > 9) formatted += '-' + digits.slice(9, 11);
        phoneEl.value = formatted;
    });

    const cardEl = document.getElementById('cardNumber');
    cardEl?.addEventListener('input', () => {
        const digits = cardEl.value.replace(/\D/g, '').slice(0, 16);
        cardEl.value = digits.replace(/(.{4})/g, '$1 ').trim();
    });

    const expiryEl = document.getElementById('cardExpiry');
    expiryEl?.addEventListener('input', () => {
        const digits = expiryEl.value.replace(/\D/g, '').slice(0, 4);
        expiryEl.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
    });

    const passInputEl = document.getElementById('verifyPassword');
    const passHintEl = document.getElementById('passwordStrengthHint');
    passInputEl?.addEventListener('input', () => {
        if (!passHintEl) return;
        if (strongPasswordRegex.test(passInputEl.value)) {
            passHintEl.textContent = 'Надёжный пароль (8+ символов, A-Z, a-z, цифра)';
            passHintEl.style.color = '#16a34a';
        } else {
            passHintEl.textContent = 'Нужно: от 8 символов, заглавная и строчная буквы, цифра';
            passHintEl.style.color = '#dc2626';
        }
    });

    document.getElementById('fillTestRegisterBtn')?.addEventListener('click', () => {
        document.getElementById('fullname').value = 'Алексей Смирнов';
        document.getElementById('email').value = 'alex.test@example.com';
        document.getElementById('phone').value = '+7 (705) 123-45-67';
        document.getElementById('verifyPassword').value = 'Concert2026';
        document.getElementById('verifyPasswordConfirm').value = 'Concert2026';
        passInputEl?.dispatchEvent(new Event('input'));
    });

    // --- 1. СТРАНИЦА ЦЕН И ФИЛЬТРАЦИИ (prices.html) ---
    const tbody = document.getElementById('concertsTableBody');
    if (tbody) {
        const cityFilter = document.getElementById('cityFilter');
        const searchInput = document.getElementById('searchConcertInput');
        const maxPriceRange = document.getElementById('maxPriceRange');
        const maxPriceLabel = document.getElementById('maxPriceLabel');
        const resetBtn = document.getElementById('resetFiltersBtn');
        const noConcertsMsg = document.getElementById('noConcertsMsg');
        const priceCards = document.querySelectorAll('.price-card');

        try {
            const [actorsSnap, concertsSnap, ticketsSnap] = await Promise.all([
                db.ref('actors').once('value'),
                db.ref('concerts').once('value'),
                db.ref('tickets').once('value')
            ]);
            const actors = actorsSnap.val() || {};
            const concerts = concertsSnap.val() || {};
            const tickets = ticketsSnap.val() || {};

            const availableByConcert = {};
            Object.values(tickets).forEach(t => {
                if (t.status === 'available' && t.concertId) {
                    availableByConcert[t.concertId] = (availableByConcert[t.concertId] || 0) + 1;
                }
            });

            Object.entries(concerts).forEach(([concertId, c]) => {
                const actorName = (actors[c.actorId] && actors[c.actorId].name) || 'Артист';
                const cityLower = (c.city || '').toLowerCase();
                let citySlug = 'other';
                if (cityLower.includes('астан')) citySlug = 'astana';
                else if (cityLower.includes('алмат')) citySlug = 'almaty';
                else if (cityLower.includes('усть-каменогорск') || cityLower.includes('өскемен')) citySlug = 'ust-kamenogorsk';

                const numericPrice = Number(c.price || 0);
                const freeCount = availableByConcert[concertId] ?? (c.totalTickets || '—');

                const tr = document.createElement('tr');
                tr.setAttribute('data-city', citySlug);
                tr.setAttribute('data-price', String(numericPrice));
                tr.innerHTML = `
                    <td>${actorName}</td>
                    <td>${c.city || '—'}</td>
                    <td>${c.date || '—'}</td>
                    <td>${numericPrice.toLocaleString()} ₸</td>
                    <td>${freeCount}</td>
                    <td><a href="register.html?buy=1&price=${numericPrice}" class="table-btn">Выбрать</a></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.warn('Не удалось подгрузить концерты из БД:', e);
        }

        function applyAllFilters() {
            const selectedCity = cityFilter ? cityFilter.value : 'all';
            const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const maxPrice = maxPriceRange ? Number(maxPriceRange.value) : Infinity;

            if (maxPriceLabel && maxPriceRange) {
                maxPriceLabel.textContent = Number(maxPriceRange.value).toLocaleString();
            }

            let visibleCount = 0;
            tbody.querySelectorAll('tr').forEach(row => {
                const rowCity = row.getAttribute('data-city') || 'other';
                const rowPrice = Number(row.getAttribute('data-price') || 0);
                const rowText = row.textContent.toLowerCase();

                const show = (selectedCity === 'all' || rowCity === selectedCity)
                    && rowPrice <= maxPrice
                    && (!query || rowText.includes(query));

                row.style.display = show ? '' : 'none';
                if (show) visibleCount++;
            });

            if (noConcertsMsg) {
                noConcertsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
            }

            priceCards.forEach(card => {
                const cardPrice = Number(card.getAttribute('data-card-price') || 0);
                card.style.opacity = cardPrice <= maxPrice ? '1' : '0.4';
            });
        }

        cityFilter?.addEventListener('change', applyAllFilters);
        searchInput?.addEventListener('input', applyAllFilters);
        maxPriceRange?.addEventListener('input', applyAllFilters);
        resetBtn?.addEventListener('click', () => {
            if (cityFilter) cityFilter.value = 'all';
            if (searchInput) searchInput.value = '';
            if (maxPriceRange) maxPriceRange.value = '35000';
            applyAllFilters();
        });

        applyAllFilters();
    }

    // --- 2. РЕГИСТРАЦИЯ (register.html) ---
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const buyToggle = document.getElementById('buyTicketToggle');
        const purchaseSection = document.getElementById('ticketPurchaseSection');
        const submitBtn = document.getElementById('registerSubmitBtn');
        const concertSelect = document.getElementById('concertSelect');
        const radioButtons = document.querySelectorAll('input[name="ticketType"]');
        const ticketCountInput = document.getElementById('ticketCount');
        const summaryCategory = document.getElementById('summaryCategory');
        const summaryCount = document.getElementById('summaryCount');
        const summaryTotal = document.getElementById('summaryTotal');

        const params = new URLSearchParams(window.location.search);
        if (params.get('buy') === '1' && buyToggle && purchaseSection) {
            buyToggle.checked = true;
            purchaseSection.style.display = 'block';
            submitBtn.textContent = 'Зарегистрироваться и оплатить';
        }

        if (concertSelect) {
            try {
                const [actorsSnap, concertsSnap] = await Promise.all([
                    db.ref('actors').once('value'),
                    db.ref('concerts').once('value')
                ]);
                const actors = actorsSnap.val() || {};
                const concerts = concertsSnap.val() || {};
                Object.entries(concerts).forEach(([id, c]) => {
                    const actorName = (actors[c.actorId] && actors[c.actorId].name) || 'Артист';
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = `${actorName} — ${c.city} (${c.date})`;
                    concertSelect.appendChild(opt);
                });
            } catch (e) {
                console.warn('Ошибка загрузки списка концертов:', e);
            }
        }

        function updateSummary() {
            const selectedRadio = document.querySelector('input[name="ticketType"]:checked');
            if (!selectedRadio || !summaryTotal) return;
            const price = parseInt(selectedRadio.getAttribute('data-price'), 10);
            const count = Math.max(1, parseInt(ticketCountInput.value, 10) || 1);
            const labelText = selectedRadio.parentElement.textContent.split('—')[0].trim();
            summaryCategory.textContent = labelText;
            summaryCount.textContent = count;
            summaryTotal.textContent = (price * count).toLocaleString();
        }

        buyToggle?.addEventListener('change', () => {
            if (purchaseSection) {
                purchaseSection.style.display = buyToggle.checked ? 'block' : 'none';
            }
            if (submitBtn) {
                submitBtn.textContent = buyToggle.checked
                    ? 'Зарегистрироваться и оплатить'
                    : 'Зарегистрироваться';
            }
        });

        radioButtons.forEach(r => r.addEventListener('change', updateSummary));
        ticketCountInput?.addEventListener('input', updateSummary);
        updateSummary();

        const modal = document.getElementById('successModal');
        const closeModal = document.getElementById('closeModal');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            let isValid = true;
            const setErr = (id, msg) => {
                const el = document.getElementById(id);
                if (el) el.textContent = msg;
                if (msg) isValid = false;
            };

            ['nameError', 'emailError', 'phoneError', 'verifyPasswordError', 'verifyPasswordConfirmError', 'cardError', 'expiryError', 'cvcError']
                .forEach(id => setErr(id, ''));

            const fullname = document.getElementById('fullname').value.trim();
            const cleanEmail = document.getElementById('email').value.trim().toLowerCase();
            const phone = document.getElementById('phone').value.trim();
            const pass1 = document.getElementById('verifyPassword').value;
            const pass2 = document.getElementById('verifyPasswordConfirm').value;

            if (!fullname) setErr('nameError', 'Введите Имя и Фамилию');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) setErr('emailError', 'Введите корректный email');
            if (!/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone)) setErr('phoneError', 'Формат: +7 (XXX) XXX-XX-XX');
            if (!strongPasswordRegex.test(pass1)) {
                setErr('verifyPasswordError', 'Пароль: от 8 символов, заглавная и строчная буквы, цифра');
            }
            if (pass1 !== pass2) setErr('verifyPasswordConfirmError', 'Пароли не совпадают');

            const withTicket = Boolean(buyToggle && buyToggle.checked);
            let cardClean = '';
            if (withTicket) {
                cardClean = document.getElementById('cardNumber').value.replace(/\s+/g, '');
                const expiry = document.getElementById('cardExpiry').value.trim();
                const cvc = document.getElementById('cardCvc').value.trim();
                if (!/^\d{16}$/.test(cardClean)) setErr('cardError', 'Введите 16 цифр номера карты');
                if (!/^\d{2}\/\d{2}$/.test(expiry)) setErr('expiryError', 'Формат: ММ/ГГ');
                if (!/^\d{3}$/.test(cvc)) setErr('cvcError', 'Введите 3 цифры CVC');
            }

            if (!isValid) return;

            try {
                const cred = await auth.createUserWithEmailAndPassword(cleanEmail, pass1);
                const uid = cred.user.uid;
                const userKey = emailToKey(cleanEmail);

                await db.ref(`user_profiles/${userKey}`).set({
                    uid,
                    name: fullname,
                    email: cleanEmail,
                    phone,
                    createdAt: new Date().toISOString()
                });

                await db.ref(`user_roles/${userKey}`).set({
                    uid,
                    isAdmin: false
                });

                if (withTicket) {
                    const encryptedCard = await encryptText(cardClean);
                    await db.ref(`user_cards/${userKey}`).set({
                        uid,
                        last4: cardClean.slice(-4),
                        masked: '•••• •••• •••• ' + cardClean.slice(-4),
                        encryptedCard: encryptedCard.cipher,
                        iv: encryptedCard.iv,
                        mode: encryptedCard.mode
                    });

                    const selectedRadio = document.querySelector('input[name="ticketType"]:checked');
                    const categoryName = selectedRadio.parentElement.textContent.split('—')[0].trim();
                    const concertTitle = concertSelect ? concertSelect.options[concertSelect.selectedIndex].text : 'Rick Astley Live';

                    await db.ref('orders').push().set({
                        userKey,
                        uid,
                        email: cleanEmail,
                        concertTitle,
                        ticketCategory: categoryName,
                        ticketCount: Math.max(1, Number(ticketCountInput.value) || 1),
                        totalPrice: summaryTotal.textContent,
                        date: new Date().toLocaleDateString()
                    });
                }

                localStorage.setItem('activeUserEmail', cleanEmail);
                modal?.classList.add('active');
            } catch (err) {
                console.error(err);
                if (err.code === 'auth/email-already-in-use') {
                    setErr('emailError', 'Этот email уже зарегистрирован. Перейдите на страницу входа.');
                } else {
                    setErr('emailError', 'Ошибка регистрации: ' + err.message);
                }
            }
        });

        closeModal?.addEventListener('click', () => {
            modal?.classList.remove('active');
            window.location.href = 'account.html';
        });
    }

    // --- 3. ВХОД И СБРОС ПАРОЛЯ (login.html) ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        document.getElementById('toggleLoginPassBtn')?.addEventListener('click', () => {
            const input = document.getElementById('loginPassword');
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cleanEmail = document.getElementById('loginEmail').value.trim().toLowerCase();
            const passwordInput = document.getElementById('loginPassword').value;
            const loginError = document.getElementById('loginError');
            if (loginError) loginError.textContent = '';

            try {
                await auth.signInWithEmailAndPassword(cleanEmail, passwordInput);
                localStorage.setItem('activeUserEmail', cleanEmail);
                window.location.href = 'account.html';
            } catch (err) {
                if (loginError) loginError.textContent = 'Неверный email или пароль.';
            }
        });

        const forgotLink = document.getElementById('forgotPasswordLink');
        const resetBox = document.getElementById('resetBox');
        const sendResetCodeBtn = document.getElementById('sendResetCodeBtn');

        forgotLink?.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetBox) {
                resetBox.style.display = resetBox.style.display === 'none' ? 'block' : 'none';
            }
        });

        sendResetCodeBtn?.addEventListener('click', async () => {
            const cleanEmail = document.getElementById('loginEmail').value.trim().toLowerCase();
            const statusEl = document.getElementById('resetStatus');
            if (!statusEl) return;

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                statusEl.style.color = '#dc2626';
                statusEl.textContent = 'Сначала введите корректный Email в поле входа выше.';
                return;
            }

            try {
                await auth.sendPasswordResetEmail(cleanEmail);
                statusEl.style.color = '#16a34a';
                statusEl.textContent = `Письмо отправлено на ${cleanEmail}. Проверьте «Входящие» и «Спам».`;
            } catch (err) {
                statusEl.style.color = '#dc2626';
                statusEl.textContent = err.code === 'auth/user-not-found'
                    ? 'Пользователь с таким Email не найден.'
                    : 'Ошибка отправки: ' + err.message;
            }
        });
    }

    // --- 4. ЛИЧНЫЙ КАБИНЕТ (account.html) ---
    const accName = document.getElementById('accName');
    const accEmail = document.getElementById('accEmail');
    const ticketHistory = document.getElementById('ticketHistory');

    if (accName && accEmail && ticketHistory) {
        const currentUser = await waitForAuthUser();
        const activeEmail = (currentUser && currentUser.email) || localStorage.getItem('activeUserEmail');
        if (!currentUser && !activeEmail) {
            window.location.href = 'login.html';
            return;
        }

        const userKey = emailToKey(activeEmail);
        const [profileSnap, cardSnap, roleSnap, ordersSnap] = await Promise.all([
            db.ref(`user_profiles/${userKey}`).once('value'),
            db.ref(`user_cards/${userKey}`).once('value'),
            db.ref(`user_roles/${userKey}`).once('value'),
            db.ref('orders').orderByChild('userKey').equalTo(userKey).once('value')
        ]);

        const profile = profileSnap.val();
        const card = cardSnap.val();
        const role = roleSnap.val();
        const orders = ordersSnap.val();

        accName.textContent = (profile && profile.name) || '—';
        accEmail.textContent = (profile && profile.email) || activeEmail;
        const accPhone = document.getElementById('accPhone');
        if (accPhone) accPhone.textContent = (profile && profile.phone) || '—';

        const accCard = document.getElementById('accCard');
        if (accCard && card && card.masked) accCard.textContent = card.masked;

        const applyAdminUI = () => {
            const badge = document.getElementById('adminBadge');
            const linkBox = document.getElementById('adminConsoleLinkBox');
            const accessSection = document.getElementById('adminAccessSection');
            if (badge) badge.style.display = 'inline';
            if (linkBox) linkBox.style.display = 'block';
            if (accessSection) accessSection.style.display = 'none';
        };

        if (role && role.isAdmin === true) applyAdminUI();

        document.getElementById('activateAdminBtn')?.addEventListener('click', async () => {
            const codeVal = document.getElementById('adminCodeInput').value.trim();
            const msgEl = document.getElementById('adminCodeMsg');
            if (codeVal === ADMIN_ACTIVATION_CODE) {
                await db.ref(`user_roles/${userKey}`).set({
                    uid: currentUser ? currentUser.uid : null,
                    isAdmin: true
                });
                applyAdminUI();
            } else if (msgEl) {
                msgEl.textContent = 'Неверный код доступа.';
            }
        });

        if (orders) {
            ticketHistory.innerHTML = Object.entries(orders).map(([id, o]) => `
                <div style="border-bottom: 1px solid #d1d5db; padding-bottom: 10px; margin-bottom: 10px;">
                    <p>🎫 <strong>${o.concertTitle || 'Rick Astley Live'}</strong></p>
                    <p>ID: <code>${id}</code></p>
                    <p>Категория: ${o.ticketCategory} (${o.ticketCount} шт.)</p>
                    <p>Сумма: <strong>${o.totalPrice} ₸</strong> | Дата: ${o.date}</p>
                </div>
            `).join('');
        } else {
            ticketHistory.innerHTML = `<p style="color: #4b5563;">Заказов пока нет. <a href="prices.html" style="color: var(--accent-color);">Выбрать билет</a></p>`;
        }
    }

    // --- 5. АДМИН-КОНСОЛЬ (admin-console.html) ---
    const adminConsolePanel = document.getElementById('adminConsolePanel');
    if (adminConsolePanel) {
        const currentUser = await waitForAuthUser();
        const activeEmail = (currentUser && currentUser.email) || localStorage.getItem('activeUserEmail');
        const userKey = activeEmail ? emailToKey(activeEmail) : null;
        const roleSnap = userKey ? await db.ref(`user_roles/${userKey}`).once('value') : null;
        const isAdmin = Boolean(roleSnap && roleSnap.val() && roleSnap.val().isAdmin === true);

        if (!isAdmin) {
            adminConsolePanel.innerHTML = '<p style="color:#dc2626;font-weight:700;">Доступ запрещён. Активируйте права администратора в личном кабинете.</p>';
        } else {
            const actorSelect = document.getElementById('concertActorSelect');
            const refreshActors = async () => {
                const snap = await db.ref('actors').once('value');
                const actors = snap.val() || {};
                actorSelect.innerHTML = Object.entries(actors)
                    .map(([id, a]) => `<option value="${id}">${a.name}</option>`).join('');
            };
            await refreshActors();

            document.getElementById('addActorForm')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('actorNameInput').value.trim();
                if (!name) return;
                await db.ref('actors').push({ name, createdAt: Date.now() });
                document.getElementById('actorNameInput').value = '';
                await refreshActors();
                alert('Артист добавлен.');
            });

            document.getElementById('createConcertForm')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const actorId = actorSelect.value;
                const city = document.getElementById('concertCityInput').value.trim();
                const date = document.getElementById('concertDateInput').value.trim();
                const price = Number(document.getElementById('concertPriceInput').value);
                const count = Number(document.getElementById('concertTicketsCountInput').value);
                if (!actorId || !city || !date || !price || !count) return;

                const concertRef = await db.ref('concerts').push({ actorId, city, date, price, totalTickets: count });
                for (let i = 1; i <= count; i++) {
                    await db.ref('tickets').push({
                        concertId: concertRef.key,
                        actorId,
                        seatNumber: i,
                        status: 'available'
                    });
                }
                alert('Концерт и билеты созданы.');
            });
        }
    }

    // --- 6. ВЫХОД ---
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try {
            await auth.signOut();
        } catch (e) {
            console.warn(e);
        }
        localStorage.removeItem('activeUserEmail');
        window.location.href = 'login.html';
    });
});
