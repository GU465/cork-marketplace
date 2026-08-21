/**
 * Cork Marketplace - ISO (In Search Of) Page Logic
 * Communicates with backend API for ISO requests
 */

(function () {
    'use strict';

    const API_BASE = '/api';
    const USER_KEY = 'corkMarketplace_user';
    const MOD_KEY = 'corkMarketplace_mod';

    let currentUser = localStorage.getItem(USER_KEY) || '';
    let modPassword = sessionStorage.getItem(MOD_KEY) || '';
    let isMod = false;
    let pendingClaimId = null;
    let selectedFile = null;

    // DOM Elements
    const itemsGrid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    const userGreeting = document.getElementById('userGreeting');
    const btnSetName = document.getElementById('btnSetName');
    const fabListItem = document.getElementById('fabListItem');

    const nameModal = document.getElementById('nameModal');
    const closeNameModal = document.getElementById('closeNameModal');
    const userNameInput = document.getElementById('userName');
    const saveUserName = document.getElementById('saveUserName');

    const listItemModal = document.getElementById('listItemModal');
    const closeListModal = document.getElementById('closeListModal');
    const listItemForm = document.getElementById('listItemForm');
    const imageUploadArea = document.getElementById('imageUploadArea');
    const itemImageInput = document.getElementById('itemImage');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const imagePreview = document.getElementById('imagePreview');
    const itemImageUrl = document.getElementById('itemImageUrl');
    const itemTitle = document.getElementById('itemTitle');
    const itemDescription = document.getElementById('itemDescription');
    const itemCategory = document.getElementById('itemCategory');
    const itemDonation = document.getElementById('itemDonation');
    const cancelListItem = document.getElementById('cancelListItem');
    const submitListItem = document.getElementById('submitListItem');

    const claimModal = document.getElementById('claimModal');
    const closeClaimModal = document.getElementById('closeClaimModal');
    const claimMessage = document.getElementById('claimMessage');
    const cancelClaim = document.getElementById('cancelClaim');
    const confirmClaim = document.getElementById('confirmClaim');

    const detailModal = document.getElementById('detailModal');
    const closeDetailModal = document.getElementById('closeDetailModal');
    const detailTitle = document.getElementById('detailTitle');
    const detailImage = document.getElementById('detailImage');
    const detailPrice = document.getElementById('detailPrice');
    const detailCategory = document.getElementById('detailCategory');
    const detailDescription = document.getElementById('detailDescription');
    const detailLister = document.getElementById('detailLister');
    const detailDate = document.getElementById('detailDate');
    const detailClaimedInfo = document.getElementById('detailClaimedInfo');
    const detailClaimBtn = document.getElementById('detailClaimBtn');
    let currentDetailItem = null;

    const btnModLogin = document.getElementById('btnModLogin');
    const modLoginModal = document.getElementById('modLoginModal');
    const closeModLoginModal = document.getElementById('closeModLoginModal');
    const modPasswordInput = document.getElementById('modPassword');
    const cancelModLogin = document.getElementById('cancelModLogin');
    const submitModLogin = document.getElementById('submitModLogin');

    const editItemModal = document.getElementById('editItemModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editTitle = document.getElementById('editTitle');
    const editDescription = document.getElementById('editDescription');
    const editCategory = document.getElementById('editCategory');
    const editDonation = document.getElementById('editDonation');
    const editUnclaim = document.getElementById('editUnclaim');
    const editUnclaimGroup = document.getElementById('editUnclaimGroup');
    const cancelEditItem = document.getElementById('cancelEditItem');
    const submitEditItem = document.getElementById('submitEditItem');
    const deleteItemBtn = document.getElementById('deleteItemBtn');

    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');

    const offerThankYouModal = document.getElementById('offerThankYouModal');
    const closeOfferThankYouModal = document.getElementById('closeOfferThankYouModal');
    const closeOfferThankYouBtn = document.getElementById('closeOfferThankYouBtn');

    const helpModal = document.getElementById('helpModal');
    const closeHelpModal = document.getElementById('closeHelpModal');
    const helpName = document.getElementById('helpName');
    const helpMessage = document.getElementById('helpMessage');
    const cancelHelp = document.getElementById('cancelHelp');
    const submitHelp = document.getElementById('submitHelp');
    const helpBtn = document.getElementById('helpBtn');

    const btnViewMessages = document.getElementById('btnViewMessages');
    const messagesModal = document.getElementById('messagesModal');
    const closeMessagesModal = document.getElementById('closeMessagesModal');
    const closeMessagesBtn = document.getElementById('closeMessagesBtn');
    const messagesList = document.getElementById('messagesList');

    const btnViewAudit = document.getElementById('btnViewAudit');
    const auditModal = document.getElementById('auditModal');
    const closeAuditModal = document.getElementById('closeAuditModal');
    const closeAuditBtn = document.getElementById('closeAuditBtn');
    const auditList = document.getElementById('auditList');

    let editingItemId = null;

    // ===== API Functions =====
    async function fetchItems() {
        try {
            const res = await fetch(`${API_BASE}/iso`);
            if (!res.ok) throw new Error('Failed to fetch');
            return await res.json();
        } catch (err) {
            showToast('Error loading requests. Please refresh.');
            return [];
        }
    }

    async function createItem(formData) {
        const res = await fetch(`${API_BASE}/iso`, { method: 'POST', body: formData });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to create request');
        }
        return await res.json();
    }

    async function offerItem(id, offeredBy) {
        const res = await fetch(`${API_BASE}/iso/${id}/offer`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offered_by: offeredBy })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to offer item');
        }
        return await res.json();
    }

    // ===== Rendering =====
    async function render() {
        updateUserBanner();
        await renderItems();
    }

    function updateUserBanner() {
        if (currentUser) {
            userGreeting.textContent = `Hello, ${currentUser}!`;
            btnSetName.textContent = 'Change Name';
        } else {
            userGreeting.textContent = 'Welcome! Please set your name to get started.';
            btnSetName.textContent = 'Set Name';
        }
    }

    async function renderItems() {
        const items = await fetchItems();
        itemsGrid.innerHTML = '';
        if (items.length === 0) { emptyState.classList.add('visible'); return; }
        emptyState.classList.remove('visible');
        items.forEach(item => itemsGrid.appendChild(createItemCard(item)));
    }

    function createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card' + (item.claimed ? ' claimed' : '');
        const timeAgo = getTimeAgo(new Date(item.created_at).getTime());
        const claimedClass = item.claimed ? ' claimed' : '';
        const claimText = item.claimed ? '✅ Offer Received' : '🤝 Offer This Item';

        card.innerHTML = `
            <img class="item-card-image" src="${escapeAttr(item.image_path)}" alt="${escapeAttr(item.title)}" loading="lazy">
            <div class="item-card-body">
                <div class="item-card-title">${escapeHtml(item.title)}</div>
                <div class="item-card-description">${escapeHtml(item.description)}</div>
                <div class="item-card-price">€${Number(item.donation).toFixed(2)}</div>
                <div class="item-card-meta">
                    <span class="item-card-category">${escapeHtml(item.category)}</span>
                    <span>${timeAgo}</span>
                </div>
                <div class="item-card-lister">Requested by: ${escapeHtml(item.listed_by)}</div>
                ${item.claimed ? `<div style="font-size:0.7rem; color:#5c6bc0; margin-bottom:6px;">Offered by: ${escapeHtml(item.claimed_by)}</div>` : ''}
                <div class="item-card-footer">
                    <button class="btn-claim${claimedClass}" data-item-id="${escapeAttr(item.id)}" ${item.claimed ? 'disabled' : ''}>
                        ${claimText}
                    </button>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-claim')) openDetailModal(item);
        });

        const claimBtn = card.querySelector('.btn-claim');
        if (!item.claimed) {
            claimBtn.addEventListener('click', (e) => { e.stopPropagation(); openOfferModal(item); });
        }
        return card;
    }

    // ===== Detail Modal =====
    function openDetailModal(item) {
        currentDetailItem = item;
        detailTitle.textContent = item.title;
        detailImage.src = item.image_path;
        detailImage.alt = item.title;
        detailPrice.textContent = `€${Number(item.donation).toFixed(2)} suggested donation`;
        detailCategory.textContent = item.category;
        detailDescription.textContent = item.description;
        detailLister.textContent = `Requested by: ${item.listed_by}`;
        detailDate.textContent = new Date(item.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });

        if (item.claimed) {
            detailClaimedInfo.style.display = 'block';
            detailClaimedInfo.textContent = `✅ Offered by ${item.claimed_by}`;
            detailClaimBtn.className = 'btn-claim claimed';
            detailClaimBtn.textContent = '✅ Offer Received';
            detailClaimBtn.disabled = true;
        } else {
            detailClaimedInfo.style.display = 'none';
            detailClaimBtn.className = 'btn-claim';
            detailClaimBtn.textContent = '🤝 Offer This Item';
            detailClaimBtn.disabled = false;
        }

        let modActionsEl = document.getElementById('detailModActions');
        if (modActionsEl) modActionsEl.remove();
        if (isMod) {
            modActionsEl = document.createElement('div');
            modActionsEl.id = 'detailModActions';
            modActionsEl.className = 'detail-mod-actions';
            modActionsEl.innerHTML = `
                <button class="btn-mod-edit" id="detailEditBtn">✏️ Edit</button>
                <button class="btn-mod-delete" id="detailDeleteBtn">🗑️ Delete</button>
            `;
            detailClaimBtn.parentElement.after(modActionsEl);
            modActionsEl.querySelector('#detailEditBtn').addEventListener('click', () => { closeDetailModalFn(); openEditModal(item); });
            modActionsEl.querySelector('#detailDeleteBtn').addEventListener('click', () => { closeDetailModalFn(); openDeleteConfirm(item.id); });
        }
        detailModal.classList.add('active');
    }

    function closeDetailModalFn() { detailModal.classList.remove('active'); currentDetailItem = null; }

    // ===== Offer Flow =====
    function openOfferModal(item) {
        if (!currentUser) { showToast('Please set your name first!'); openNameModal(); return; }
        pendingClaimId = item.id;
        claimMessage.textContent = `Offer "${item.title}" to ${item.listed_by}?`;
        claimModal.classList.add('active');
    }

    function closeOfferModalFn() { claimModal.classList.remove('active'); pendingClaimId = null; }

    async function handleConfirmOffer() {
        if (!pendingClaimId) return;
        confirmClaim.disabled = true;
        confirmClaim.textContent = 'Offering...';
        try {
            await offerItem(pendingClaimId, currentUser);
            closeOfferModalFn();
            await renderItems();
            offerThankYouModal.classList.add('active');
        } catch (err) {
            showToast(err.message);
        } finally {
            confirmClaim.disabled = false;
            confirmClaim.textContent = 'Confirm Offer';
        }
    }

    function closeOfferThankYouFn() { offerThankYouModal.classList.remove('active'); }

    // ===== Moderator =====
    function openModLoginModal() {
        if (isMod) {
            isMod = false; modPassword = ''; sessionStorage.removeItem(MOD_KEY);
            btnModLogin.classList.remove('mod-active');
            btnViewMessages.style.display = 'none'; btnViewAudit.style.display = 'none';
            showToast('Moderator logged out.'); renderItems(); return;
        }
        modPasswordInput.value = ''; modLoginModal.classList.add('active'); modPasswordInput.focus();
    }
    function closeModLoginModalFn() { modLoginModal.classList.remove('active'); }

    async function handleModLogin() {
        const password = modPasswordInput.value;
        if (!password) { showToast('Please enter the password.'); return; }
        try {
            const res = await fetch(`${API_BASE}/mod/verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (res.ok) {
                isMod = true; modPassword = password; sessionStorage.setItem(MOD_KEY, password);
                btnModLogin.classList.add('mod-active');
                btnViewMessages.style.display = 'inline-block'; btnViewAudit.style.display = 'inline-block';
                closeModLoginModalFn(); showToast('Moderator access granted. 🔓'); renderItems();
            } else { showToast('Invalid password.'); }
        } catch (err) { showToast('Error verifying password.'); }
    }

    function openEditModal(item) {
        editingItemId = item.id; editTitle.value = item.title; editDescription.value = item.description;
        editCategory.value = item.category; editDonation.value = item.donation;
        if (item.claimed) { editUnclaimGroup.style.display = 'block'; editUnclaim.checked = false; }
        else { editUnclaimGroup.style.display = 'none'; }
        editItemModal.classList.add('active');
    }
    function closeEditModalFn() { editItemModal.classList.remove('active'); editingItemId = null; }

    async function handleEditItem() {
        if (!editingItemId) return;
        const data = { title: editTitle.value.trim(), description: editDescription.value.trim(), category: editCategory.value, donation: Number(editDonation.value) };
        if (editUnclaim.checked) data.claimed = 0;
        if (!data.title || !data.description || data.donation < 0) { showToast('Please fill in all fields.'); return; }
        submitEditItem.disabled = true; submitEditItem.textContent = 'Saving...';
        try {
            const res = await fetch(`${API_BASE}/iso/${editingItemId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Mod-Key': modPassword }, body: JSON.stringify(data)
            });
            if (res.ok) { closeEditModalFn(); await renderItems(); showToast('Request updated. ✅'); }
            else { const err = await res.json(); showToast(err.error || 'Failed to update.'); }
        } catch (err) { showToast('Error updating request.'); }
        finally { submitEditItem.disabled = false; submitEditItem.textContent = 'Save Changes'; }
    }

    function openDeleteConfirm(itemId) { editingItemId = itemId; deleteConfirmModal.classList.add('active'); }
    function closeDeleteConfirmFn() { deleteConfirmModal.classList.remove('active'); }

    async function handleDeleteItem() {
        if (!editingItemId) return;
        confirmDelete.disabled = true; confirmDelete.textContent = 'Deleting...';
        try {
            const res = await fetch(`${API_BASE}/iso/${editingItemId}`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Mod-Key': modPassword }
            });
            if (res.ok) { closeDeleteConfirmFn(); closeEditModalFn(); await renderItems(); showToast('Request deleted. 🗑️'); }
            else { const err = await res.json(); showToast(err.error || 'Failed to delete.'); }
        } catch (err) { showToast('Error deleting request.'); }
        finally { confirmDelete.disabled = false; confirmDelete.textContent = 'Delete Permanently'; editingItemId = null; }
    }

    async function checkModSession() {
        if (modPassword) {
            try {
                const res = await fetch(`${API_BASE}/mod/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: modPassword }) });
                if (res.ok) { isMod = true; btnModLogin.classList.add('mod-active'); btnViewMessages.style.display = 'inline-block'; btnViewAudit.style.display = 'inline-block'; }
            } catch (e) {}
        }
    }

    // ===== User Name =====
    function openNameModal() { userNameInput.value = currentUser; nameModal.classList.add('active'); userNameInput.focus(); }
    function closeNameModalFn() { nameModal.classList.remove('active'); }
    function handleSaveUserName() {
        const name = userNameInput.value.trim();
        if (!name) { showToast('Please enter your name.'); return; }
        currentUser = name; localStorage.setItem(USER_KEY, currentUser); closeNameModalFn(); updateUserBanner(); showToast(`Name set to "${name}"`);
    }

    // ===== List / Post Request =====
    function openListModal() {
        if (!currentUser) { showToast('Please set your name first!'); openNameModal(); return; }
        resetListForm(); listItemModal.classList.add('active');
    }
    function closeListModalFn() { listItemModal.classList.remove('active'); resetListForm(); }
    function resetListForm() {
        listItemForm.reset(); selectedFile = null; imagePreview.classList.remove('visible'); imagePreview.src = '';
        uploadPlaceholder.classList.remove('hidden'); if (itemImageUrl) itemImageUrl.value = '';
    }

    function handleImageSelect(e) {
        const file = e.target.files[0]; if (!file) return;
        if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => { imagePreview.src = ev.target.result; imagePreview.classList.add('visible'); uploadPlaceholder.classList.add('hidden'); };
        reader.readAsDataURL(file);
    }

    async function handleSubmitItem() {
        const imageUrl = itemImageUrl ? itemImageUrl.value.trim() : '';
        if (!itemTitle.value.trim()) { showToast('Please enter what you\'re looking for.'); itemTitle.focus(); return; }
        if (!itemDescription.value.trim()) { showToast('Please enter a description.'); itemDescription.focus(); return; }
        if (!itemDonation.value || Number(itemDonation.value) < 0) { showToast('Please enter a suggested donation amount.'); itemDonation.focus(); return; }

        const formData = new FormData();
        if (selectedFile) formData.append('image', selectedFile);
        if (imageUrl) formData.append('image_url', imageUrl);
        formData.append('title', itemTitle.value.trim());
        formData.append('description', itemDescription.value.trim());
        formData.append('category', itemCategory.value);
        formData.append('donation', itemDonation.value);
        formData.append('listed_by', currentUser);

        submitListItem.disabled = true; submitListItem.textContent = 'Posting...';
        try {
            await createItem(formData); closeListModalFn(); await renderItems(); showToast('Request posted! 🔍');
        } catch (err) { showToast(err.message); }
        finally { submitListItem.disabled = false; submitListItem.textContent = 'Post Request'; }
    }

    // ===== Help =====
    function openHelpModal() { helpName.value = currentUser || ''; helpMessage.value = ''; helpModal.classList.add('active'); }
    function closeHelpModalFn() { helpModal.classList.remove('active'); }
    async function handleSubmitHelp() {
        const name = helpName.value.trim(); const message = helpMessage.value.trim();
        if (!name || !message) { showToast('Please fill in your name and message.'); return; }
        submitHelp.disabled = true; submitHelp.textContent = 'Sending...';
        try {
            const res = await fetch(`${API_BASE}/help`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) });
            const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Failed to send');
            closeHelpModalFn(); showToast('Message sent to admin. Thank you! 📩');
        } catch (err) { showToast(err.message); }
        finally { submitHelp.disabled = false; submitHelp.textContent = 'Send Message'; }
    }

    // ===== Messages & Audit (Mod) =====
    async function openMessagesModal() {
        messagesModal.classList.add('active'); messagesList.innerHTML = '<p class="messages-loading">Loading...</p>';
        try {
            const res = await fetch(`${API_BASE}/help`, { headers: { 'X-Mod-Key': modPassword } });
            if (!res.ok) throw new Error(); const requests = await res.json();
            if (requests.length === 0) { messagesList.innerHTML = '<p class="messages-empty">No help requests yet.</p>'; return; }
            messagesList.innerHTML = requests.map(r => `<div class="message-card"><div class="message-header"><strong>${escapeHtml(r.name)}</strong><span class="message-date">${new Date(r.created_at).toLocaleString()}</span></div><p class="message-text">${escapeHtml(r.message)}</p></div>`).join('');
        } catch (err) { messagesList.innerHTML = '<p class="messages-empty">Error loading messages.</p>'; }
    }
    function closeMessagesModalFn() { messagesModal.classList.remove('active'); }

    async function openAuditModal() {
        auditModal.classList.add('active'); auditList.innerHTML = '<p class="messages-loading">Loading...</p>';
        try {
            const res = await fetch(`${API_BASE}/audit`, { headers: { 'X-Mod-Key': modPassword } });
            if (!res.ok) throw new Error(); const entries = await res.json();
            if (entries.length === 0) { auditList.innerHTML = '<p class="messages-empty">No activity yet.</p>'; return; }
            auditList.innerHTML = entries.map(e => {
                const label = {listed:'🆕 Listed', claimed:'✅ Offered', edited:'✏️ Edited', deleted:'🗑️ Deleted'}[e.action] || e.action;
                return `<div class="message-card"><div class="message-header"><strong>${label}</strong><span class="message-date">${new Date(e.created_at).toLocaleString()}</span></div><p class="message-text">${escapeHtml(e.details||'')}</p><span class="audit-by">by ${escapeHtml(e.performed_by||'—')}</span></div>`;
            }).join('');
        } catch (err) { auditList.innerHTML = '<p class="messages-empty">Error loading audit log.</p>'; }
    }
    function closeAuditModalFn() { auditModal.classList.remove('active'); }

    // ===== Utilities =====
    function escapeHtml(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
    function escapeAttr(str) { if (!str) return ''; return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function getTimeAgo(ts) {
        const s = Math.floor((Date.now()-ts)/1000); if(s<60) return 'Just now';
        const m=Math.floor(s/60); if(m<60) return `${m}m ago`;
        const h=Math.floor(m/60); if(h<24) return `${h}h ago`;
        const d=Math.floor(h/24); if(d<7) return `${d}d ago`;
        return new Date(ts).toLocaleDateString();
    }
    function showToast(msg) {
        document.querySelectorAll('.toast').forEach(t=>t.remove());
        const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
    }

    // ===== Event Listeners =====
    btnSetName.addEventListener('click', openNameModal);
    closeNameModal.addEventListener('click', closeNameModalFn);
    saveUserName.addEventListener('click', handleSaveUserName);
    userNameInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSaveUserName(); });

    fabListItem.addEventListener('click', openListModal);
    closeListModal.addEventListener('click', closeListModalFn);
    cancelListItem.addEventListener('click', closeListModalFn);
    submitListItem.addEventListener('click', handleSubmitItem);

    imageUploadArea.addEventListener('click', () => itemImageInput.click());
    itemImageInput.addEventListener('change', handleImageSelect);
    imageUploadArea.addEventListener('dragover', e => { e.preventDefault(); imageUploadArea.classList.add('drag-over'); });
    imageUploadArea.addEventListener('dragleave', () => imageUploadArea.classList.remove('drag-over'));
    imageUploadArea.addEventListener('drop', e => {
        e.preventDefault(); imageUploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            selectedFile = file; const reader = new FileReader();
            reader.onload = ev => { imagePreview.src = ev.target.result; imagePreview.classList.add('visible'); uploadPlaceholder.classList.add('hidden'); };
            reader.readAsDataURL(file);
        } else showToast('Please drop an image file.');
    });
    document.addEventListener('paste', e => {
        if (!listItemModal.classList.contains('active')) return;
        for (let i = 0; i < e.clipboardData.items.length; i++) {
            if (e.clipboardData.items[i].type.startsWith('image/')) {
                const file = e.clipboardData.items[i].getAsFile(); selectedFile = file;
                const reader = new FileReader();
                reader.onload = ev => { imagePreview.src = ev.target.result; imagePreview.classList.add('visible'); uploadPlaceholder.classList.add('hidden'); };
                reader.readAsDataURL(file); showToast('Image pasted from clipboard!'); break;
            }
        }
    });

    closeClaimModal.addEventListener('click', closeOfferModalFn);
    cancelClaim.addEventListener('click', closeOfferModalFn);
    confirmClaim.addEventListener('click', handleConfirmOffer);

    closeDetailModal.addEventListener('click', closeDetailModalFn);
    detailClaimBtn.addEventListener('click', () => { if (currentDetailItem && !currentDetailItem.claimed) { closeDetailModalFn(); openOfferModal(currentDetailItem); } });

    btnModLogin.addEventListener('click', openModLoginModal);
    closeModLoginModal.addEventListener('click', closeModLoginModalFn);
    cancelModLogin.addEventListener('click', closeModLoginModalFn);
    submitModLogin.addEventListener('click', handleModLogin);
    modPasswordInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleModLogin(); });

    closeEditModal.addEventListener('click', closeEditModalFn);
    cancelEditItem.addEventListener('click', closeEditModalFn);
    submitEditItem.addEventListener('click', handleEditItem);
    deleteItemBtn.addEventListener('click', () => { closeEditModalFn(); openDeleteConfirm(editingItemId); });

    closeDeleteModal.addEventListener('click', closeDeleteConfirmFn);
    cancelDelete.addEventListener('click', closeDeleteConfirmFn);
    confirmDelete.addEventListener('click', handleDeleteItem);

    closeOfferThankYouModal.addEventListener('click', closeOfferThankYouFn);
    closeOfferThankYouBtn.addEventListener('click', closeOfferThankYouFn);

    helpBtn.addEventListener('click', openHelpModal);
    closeHelpModal.addEventListener('click', closeHelpModalFn);
    cancelHelp.addEventListener('click', closeHelpModalFn);
    submitHelp.addEventListener('click', handleSubmitHelp);

    btnViewMessages.addEventListener('click', openMessagesModal);
    closeMessagesModal.addEventListener('click', closeMessagesModalFn);
    closeMessagesBtn.addEventListener('click', closeMessagesModalFn);

    btnViewAudit.addEventListener('click', openAuditModal);
    closeAuditModal.addEventListener('click', closeAuditModalFn);
    closeAuditBtn.addEventListener('click', closeAuditModalFn);

    const allModals = [nameModal, listItemModal, claimModal, detailModal, modLoginModal, editItemModal, deleteConfirmModal, offerThankYouModal, helpModal, messagesModal, auditModal];
    allModals.forEach(modal => modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') allModals.forEach(m => m.classList.remove('active')); });

    setInterval(renderItems, 30000);
    checkModSession();
    render();

})();
