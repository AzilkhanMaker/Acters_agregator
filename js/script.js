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

const ADMIN_ACTIVATION_CODE = "ADMIN-RICK-2026";
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function emailToKey(email) {
    return email.trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_');
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

async function decryptText(encryptedObj) {
    if (!encryptedObj || !encryptedObj.cipher || !encryptedObj.iv) return null;
    try {
        const key = await getCryptoKey();
        const iv = new Uint8Array(encryptedObj.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const cipherBytes = new Uint8Array(encryptedObj.cipher.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
        return new TextDecoder().decode(plainBuffer);
    } catch (e) {
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- БУРГЕР-МЕНЮ ---
    const burgerBtn = document.getElementById('burgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (burgerBtn && mobileMenu) {
        burgerBtn.addEventListener('click', (e) => {
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

    document.querySelectorAll('.no-copy').forEach(el => {
        el.addEventListener('copy', (e) => e.preventDefault());
    });

    // --- ШАБЛОНЫ И АВТОФОРМАТИРОВАНИЕ ВВОДА ---
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
            passHintEl.style.color = '#d93838';
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

    // --- 1. СТРАНИЦА РЕГИСТРАЦИИ (register.html) ---
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

        if (concertSelect) {
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
                opt.setAttribute('data-base-price', c.price || 12000);
                opt.textContent = `${actorName} — ${c.city} (${c.date})`;
                concertSelect.appendChild(opt);
            });
        }

        function updateSummary() {
            const selectedRadio = document.querySelector('input[name="ticketType"]:checked');
            if (!selectedRadio || !summaryTotal) return;
            const price = parseInt(selectedRadio.getAttribute('data-price'), 10);
            const count = parseInt(ticketCountInput.value, 10) || 1;
            const labelText = selectedRadio.parentElement.textContent.split('—')[0].trim();
            summaryCategory.textContent = labelText;
            summaryCount.textContent = count;
            summaryTotal.textContent = (price * count).toLocaleString();
        }

        if (buyToggle && purchaseSection) {
            buyToggle.addEventListener('change', () => {
                purchaseSection.style.display = buyToggle.checked ? 'block' : 'none';
                submitBtn.textContent = buyToggle.checked
                    ? 'Зарегистрироваться и оплатить'
                    : 'Зарегистрироваться';
            });
        }

        radioButtons.forEach(r => r.addEventListener('change', updateSummary));
        if (ticketCountInput) ticketCountInput.addEventListener('input', updateSummary);
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

            const withTicket = buyToggle && buyToggle.checked;
            let cardClean = '';
            if (withTicket) {
                cardClean = document.getElementById('cardNumber').value.replace(/\s+/g, '');
                const expiry = document.getElementById('cardExpiry').value.trim();
                const cvc = document.getElementById('cardCvc').value.trim();
                if (!/^\d{16}$/.test(cardClean)) setErr('cardError', 'Введите ровно 16 цифр номера карты');
                if (!/^\d{2}\/\d{2}$/.test(expiry)) setErr('expiryError', 'Формат: ММ/ГГ');
                if (!/^\d{3}$/.test(cvc)) setErr('cvcError', 'CVC должен содержать 3 цифры');
            }

            if (!isValid) return;

            const userKey = emailToKey(cleanEmail);
            const existingUserSnap = await db.ref(`user_profiles/${userKey}`).once('value');
            if (existingUserSnap.exists()) {
                setErr('emailError', 'Пользователь с этим email уже зарегистрирован. Войдите в аккаунт.');
                return;
            }

            try {
                const encryptedPass = await encryptText(pass1);

                await db.ref(`user_profiles/${userKey}`).set({
                    name: fullname,
                    email: cleanEmail,
                    phone: phone,
                    createdAt: new Date().toISOString()
                });

                await db.ref(`user_passwords/${userKey}`).set(encryptedPass);

                await db.ref(`user_roles/${userKey}`).set({
                    isAdmin: false
                });

                if (withTicket) {
                    const encryptedCard = await encryptText(cardClean);
                    await db.ref(`user_cards/${userKey}`).set({
                        last4: cardClean.slice(-4),
                        masked: '•••• •••• •••• ' + cardClean.slice(-4),
                        encryptedCard: encryptedCard.cipher,
                        iv: encryptedCard.iv,
                        mode: encryptedCard.mode
                    });

                    const selectedRadio = document.querySelector('input[name="ticketType"]:checked');
                    const categoryName = selectedRadio.parentElement.textContent.split('—')[0].trim();
                    const selectedConcertText = concertSelect ? concertSelect.options[concertSelect.selectedIndex].text : 'Rick Astley Live';

                    const newOrderRef = db.ref('orders').push();
                    await newOrderRef.set({
                        userKey,
                        email: cleanEmail,
                        concertTitle: selectedConcertText,
                        ticketCategory: categoryName,
                        ticketCount: Number(ticketCountInput.value) || 1,
                        totalPrice: summaryTotal.textContent,
                        date: new Date().toLocaleDateString()
                    });
                }

                localStorage.setItem('activeUserEmail', cleanEmail);
                modal.classList.add('active');
            } catch (err) {
                console.error(err);
                alert('Ошибка сохранения данных в базу.');
            }
        });

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                modal.classList.remove('active');
                window.location.href = 'account.html';
            });
        }
    }

    // --- 2. СТРАНИЦА ВХОДА И СБРОСА ПАРОЛЯ (login.html) ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cleanEmail = document.getElementById('loginEmail').value.trim().toLowerCase();
            const passwordInput = document.getElementById('loginPassword').value;
            const loginError = document.getElementById('loginError');
            if (loginError) loginError.textContent = '';

            const userKey = emailToKey(cleanEmail);
            const passSnap = await db.ref(`user_passwords/${userKey}`).once('value');
            const passRecord = passSnap.val();

            if (!passRecord) {
                if (loginError) loginError.textContent = 'Аккаунт с такой почтой не найден.';
                return;
            }

            const decryptedPassword = await decryptText(passRecord);
            if (decryptedPassword === passwordInput) {
                localStorage.setItem('activeUserEmail', cleanEmail);
                window.location.href = 'account.html';
            } else if (loginError) {
                loginError.textContent = 'Неверный пароль.';
            }
        });

        const forgotLink = document.getElementById('forgotPasswordLink');
        const resetBox = document.getElementById('resetBox');
        const sendResetCodeBtn = document.getElementById('sendResetCodeBtn');
        const confirmResetBtn = document.getElementById('confirmResetBtn');

        if (forgotLink && resetBox) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                resetBox.style.display = resetBox.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (sendResetCodeBtn) {
            sendResetCodeBtn.addEventListener('click', async () => {
                const cleanEmail = document.getElementById('loginEmail').value.trim().toLowerCase();
                const statusEl = document.getElementById('resetStatus');
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                    statusEl.textContent = 'Укажите корректный Email в поле входа выше.';
                    return;
                }

                const userKey = emailToKey(cleanEmail);
                const profileSnap = await db.ref(`user_profiles/${userKey}`).once('value');
                if (!profileSnap.exists()) {
                    statusEl.textContent = 'Пользователь с таким Email не найден.';
                    return;
                }

                const code = String(Math.floor(100000 + Math.random() * 900000));
                const encryptedCode = await encryptText(code);

                await db.ref(`password_resets/${userKey}`).set({
                    cipher: encryptedCode.cipher,
                    iv: encryptedCode.iv,
                    expiresAt: Date.now() + 15 * 60 * 1000
                });

                document.getElementById('resetConfirmStep').style.display = 'block';
                statusEl.textContent = `Код сброса сгенерирован и привязан к ${cleanEmail} (код для проверки: ${code}).`;
            });
        }

        if (confirmResetBtn) {
            confirmResetBtn.addEventListener('click', async () => {
                const cleanEmail = document.getElementById('loginEmail').value.trim().toLowerCase();
                const codeVal = document.getElementById('resetCodeInput').value.trim();
                const newPassVal = document.getElementById('newVerifyPassword').value;
                const statusEl = document.getElementById('resetStatus');

                if (!strongPasswordRegex.test(newPassVal)) {
                    statusEl.textContent = 'Пароль: от 8 символов, заглавная и строчная буквы, цифра.';
                    return;
                }

                const userKey = emailToKey(cleanEmail);
                const resetSnap = await db.ref(`password_resets/${userKey}`).once('value');
                const resetRecord = resetSnap.val();

                if (!resetRecord || Date.now() > resetRecord.expiresAt) {
                    statusEl.textContent = 'Срок действия кода истёк или код не запрашивался.';
                    return;
                }

                const decryptedCode = await decryptText(resetRecord);
                if (decryptedCode !== codeVal) {
                    statusEl.textContent = 'Неверный код подтверждения.';
                    return;
                }

                const newEncryptedPass = await encryptText(newPassVal);
                await db.ref(`user_passwords/${userKey}`).set(newEncryptedPass);
                await db.ref(`password_resets/${userKey}`).remove();

                statusEl.textContent = 'Пароль успешно зашифрован и обновлён! Войдите с новым паролем.';
            });
        }
    }

    // --- 3. ЛИЧНЫЙ КАБИНЕТ (account.html) ---
    const accName = document.getElementById('accName');
    const accEmail = document.getElementById('accEmail');
    const ticketHistory = document.getElementById('ticketHistory');

    if (accName && accEmail && ticketHistory) {
        const activeEmail = localStorage.getItem('activeUserEmail');
        if (!activeEmail) {
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

        if (profile) {
            accName.textContent = profile.name || '—';
            accEmail.textContent = profile.email || activeEmail;
            const accPhone = document.getElementById('accPhone');
            if (accPhone) accPhone.textContent = profile.phone || '—';
        }

        const accCard = document.getElementById('accCard');
        if (accCard && card && card.masked) {
            accCard.textContent = card.masked;
        }

        const applyAdminUI = () => {
            const badge = document.getElementById('adminBadge');
            const linkBox = document.getElementById('adminConsoleLinkBox');
            const accessSection = document.getElementById('adminAccessSection');
            if (badge) badge.style.display = 'inline';
            if (linkBox) linkBox.style.display = 'block';
            if (accessSection) accessSection.style.display = 'none';
        };

        if (role && role.isAdmin === true) {
            applyAdminUI();
        }

        const activateAdminBtn = document.getElementById('activateAdminBtn');
        if (activateAdminBtn) {
            activateAdminBtn.addEventListener('click', async () => {
                const codeVal = document.getElementById('adminCodeInput').value.trim();
                const msgEl = document.getElementById('adminCodeMsg');
                if (codeVal === ADMIN_ACTIVATION_CODE) {
                    await db.ref(`user_roles/${userKey}`).set({ isAdmin: true });
                    applyAdminUI();
                } else if (msgEl) {
                    msgEl.textContent = 'Неверный код доступа.';
                }
            });
        }

        if (orders) {
            ticketHistory.innerHTML = Object.entries(orders).map(([id, o]) => `
                <div style="border-bottom: 1px solid #d5d9eb; padding-bottom: 10px; margin-bottom: 10px;">
                    <p>🎫 <strong>${o.concertTitle || 'Rick Astley Live'}</strong></p>
                    <p>ID заказа: <code>${id}</code></p>
                    <p>Категория: ${o.ticketCategory} (${o.ticketCount} шт.)</p>
                    <p>Сумма: <strong>${o.totalPrice} ₸</strong> | Дата: ${o.date}</p>
                </div>
            `).join('');
        } else {
            ticketHistory.innerHTML = `<p style="color: #666;">У вас пока нет купленных билетов. <a href="prices.html">Выбрать концерт</a></p>`;
        }
    }

    // --- 4. АДМИН-КОНСОЛЬ (admin-console.html) ---
    const adminConsolePanel = document.getElementById('adminConsolePanel');
    if (adminConsolePanel) {
        const activeEmail = localStorage.getItem('activeUserEmail');
        const userKey = activeEmail ? emailToKey(activeEmail) : null;
        const roleSnap = userKey ? await db.ref(`user_roles/${userKey}`).once('value') : null;
        const isAdmin = roleSnap && roleSnap.val() && roleSnap.val().isAdmin === true;

        if (!isAdmin) {
            adminConsolePanel.innerHTML = '<p style="color:#d93838;font-weight:bold;">Доступ запрещён. У вашего аккаунта нет прав администратора.</p>';
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
                alert('Актёр добавлен.');
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
                alert('Концерт и партия билетов созданы.');
            });
        }
    }

    // --- 5. ФИЛЬТР ГОРОДОВ И ВЫХОД ---
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter) {
        cityFilter.addEventListener('change', (e) => {
            const selectedCity = e.target.value;
            document.querySelectorAll('.concert-table tbody tr').forEach(row => {
                const rowCity = row.getAttribute('data-city');
                row.style.display = (selectedCity === 'all' || rowCity === selectedCity) ? '' : 'none';
            });
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('activeUserEmail');
            window.location.href = 'login.html';
        });
    }
});