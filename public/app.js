/**
 * Cork Marketplace - Frontend App Logic
 * Communicates with backend API for shared data
 */

(function () {
    'use strict';

    // ===== Config =====
    const API_BASE = '/api';
    const USER_KEY = 'corkMarketplace_user';
    const MOD_KEY = 'corkMarketplace_mod';

    let currentUser = localStorage.getItem(USER_KEY) || '';
    let modPassword = sessionStorage.getItem(MOD_KEY) || '';
    let isMod = false;
    let pendingClaimId = null;
    let selectedFile = null;

    // ===== DOM Elements =====
    const itemsGrid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    const userGreeting = document.getElementById('userGreeting');
    const btnSetName = document.getElementById('btnSetName');
    const fabListItem = document.getElementById('fabListItem');

    // Name Modal
    const nameModal = document.getElementById('nameModal');
    const closeNameModal = document.getElementById('closeNameModal');
    const userNameInput = document.getElementById('userName');
    const saveUserName = document.getElementById('saveUserName');

    // List Item Modal
    const listItemModal = document.getElementById('listItemModal');
    const closeListModal = document.getElementById('closeListModal');
    const listItemForm = document.getElementById('listItemForm');
    const imageUploadArea = document.getElementById('imageUploadArea');
    const itemImageInput = document.getElementById('itemImage');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const imagePreview = document.getElementById('imagePreview');
    const itemTitle = document.getElementById('itemTitle');
    const itemDescription = document.getElementById('itemDescription');
    const itemCategory = document.getElementById('itemCategory');
    const itemDonation = document.getElementById('itemDonation');
    const cancelListItem = document.getElementById('cancelListItem');
    const submitListItem = document.getElementById('submitListItem');

    // Claim Modal
    const claimModal = document.getElementById('claimModal');
    const closeClaimModal = document.getElementById('closeClaimModal');
    const claimMessage = document.getElementById('claimMessage');
    const cancelClaim = document.getElementById('cancelClaim');
    const confirmClaim = document.getElementById('confirmClaim');

    // Detail Modal
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

    // Moderator elements
    const btnModLogin = document.getElementById('btnModLogin');
    const modLoginModal = document.getElementById('modLoginModal');
    const closeModLoginModal = document.getElementById('closeModLoginModal');
    const modPasswordInput = document.getElementById('modPassword');
    const cancelModLogin = document.getElementById('cancelModLogin');
    const submitModLogin = document.getElementById('submitModLogin');

    // Edit Item Modal (Mod)
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

    // Delete Confirm Modal (Mod)
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');

    let editingItemId = null;

    // ===== API Functions =====
    async function fetchItems() {
        try {
            const res = await fetch(`${API_BASE}/items`);
            if (!res.ok) throw new Error('Failed to fetch items');
            return await res.json();
        } catch (err) {
            showToast('Error loading items. Please refresh.');
            return [];
        }
    }

    async function createItem(formData) {
        const res = await fetch(`${API_BASE}/items`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to create item');
        }
        return await res.json();
    }

    async function claimItem(id, claimedBy) {
        const res = await fetch(`${API_BASE}/items/${id}/claim`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimed_by: claimedBy })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to claim item');
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

        // Clear grid
        itemsGrid.innerHTML = '';

        if (items.length === 0) {
            emptyState.classList.add('visible');
            return;
        }

        emptyState.classList.remove('visible');

        items.forEach(item => {
            const card = createItemCard(item);
            itemsGrid.appendChild(card);
        });
    }

    function createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card' + (item.claimed ? ' claimed' : '');

        const timeAgo = getTimeAgo(new Date(item.created_at).getTime());
        const claimedClass = item.claimed ? ' claimed' : '';
        const claimText = item.claimed ? '❌ No Longer Available' : '✓ Claim Item';

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
                <div class="item-card-lister">By: ${escapeHtml(item.listed_by)}</div>
                ${item.claimed ? `<div style="font-size:0.7rem; color:var(--danger); margin-bottom:6px;">Claimed by: ${escapeHtml(item.claimed_by)}</div>` : ''}
                <div class="item-card-footer">
                    <button class="btn-claim${claimedClass}" data-item-id="${escapeAttr(item.id)}" ${item.claimed ? 'disabled' : ''}>
                        ${claimText}
                    </button>
                </div>
            </div>
        `;

        // Click card to open detail view (except when clicking the claim button)
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-claim')) {
                openDetailModal(item);
            }
        });

        // Claim button listener (stops propagation so it doesn't open detail)
        const claimBtn = card.querySelector('.btn-claim');
        if (!item.claimed) {
            claimBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openClaimModal(item);
            });
        }

        return card;
    }

    // ===== Item Detail Modal =====
    function openDetailModal(item) {
        currentDetailItem = item;
        detailTitle.textContent = item.title;
        detailImage.src = item.image_path;
        detailImage.alt = item.title;
        detailPrice.textContent = `€${Number(item.donation).toFixed(2)} suggested donation`;
        detailCategory.textContent = item.category;
        detailDescription.textContent = item.description;
        detailLister.textContent = `Listed by: ${item.listed_by}`;
        detailDate.textContent = new Date(item.created_at).toLocaleDateString('en-IE', {
            day: 'numeric', month: 'short', year: 'numeric'
        });

        if (item.claimed) {
            detailClaimedInfo.style.display = 'block';
            detailClaimedInfo.textContent = `❌ Claimed by ${item.claimed_by}`;
            detailClaimBtn.className = 'btn-claim claimed';
            detailClaimBtn.textContent = '❌ No Longer Available';
            detailClaimBtn.disabled = true;
        } else {
            detailClaimedInfo.style.display = 'none';
            detailClaimBtn.className = 'btn-claim';
            detailClaimBtn.textContent = '✓ Claim This Item';
            detailClaimBtn.disabled = false;
        }

        // Show/hide moderator actions
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

            modActionsEl.querySelector('#detailEditBtn').addEventListener('click', () => {
                closeDetailModalFn();
                openEditModal(item);
            });
            modActionsEl.querySelector('#detailDeleteBtn').addEventListener('click', () => {
                closeDetailModalFn();
                openDeleteConfirm(item.id);
            });
        }

        detailModal.classList.add('active');
    }

    function closeDetailModalFn() {
        detailModal.classList.remove('active');
        currentDetailItem = null;
    }

    // ===== Moderator Functions =====
    function openModLoginModal() {
        if (isMod) {
            // Already logged in - log out
            isMod = false;
            modPassword = '';
            sessionStorage.removeItem(MOD_KEY);
            btnModLogin.classList.remove('mod-active');
            showToast('Moderator logged out.');
            renderItems();
            return;
        }
        modPasswordInput.value = '';
        modLoginModal.classList.add('active');
        modPasswordInput.focus();
    }

    function closeModLoginModalFn() {
        modLoginModal.classList.remove('active');
    }

    async function handleModLogin() {
        const password = modPasswordInput.value;
        if (!password) {
            showToast('Please enter the password.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/mod/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                isMod = true;
                modPassword = password;
                sessionStorage.setItem(MOD_KEY, password);
                btnModLogin.classList.add('mod-active');
                closeModLoginModalFn();
                showToast('Moderator access granted. 🔓');
                renderItems();
            } else {
                showToast('Invalid password.');
            }
        } catch (err) {
            showToast('Error verifying password.');
        }
    }

    function openEditModal(item) {
        editingItemId = item.id;
        editTitle.value = item.title;
        editDescription.value = item.description;
        editCategory.value = item.category;
        editDonation.value = item.donation;

        if (item.claimed) {
            editUnclaimGroup.style.display = 'block';
            editUnclaim.checked = false;
        } else {
            editUnclaimGroup.style.display = 'none';
        }

        editItemModal.classList.add('active');
    }

    function closeEditModalFn() {
        editItemModal.classList.remove('active');
        editingItemId = null;
    }

    async function handleEditItem() {
        if (!editingItemId) return;

        const data = {
            title: editTitle.value.trim(),
            description: editDescription.value.trim(),
            category: editCategory.value,
            donation: Number(editDonation.value)
        };

        if (editUnclaim.checked) {
            data.claimed = 0;
        }

        if (!data.title || !data.description || data.donation < 0) {
            showToast('Please fill in all fields.');
            return;
        }

        submitEditItem.disabled = true;
        submitEditItem.textContent = 'Saving...';

        try {
            const res = await fetch(`${API_BASE}/items/${editingItemId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Mod-Key': modPassword
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                closeEditModalFn();
                await renderItems();
                showToast('Item updated successfully. ✅');
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to update item.');
            }
        } catch (err) {
            showToast('Error updating item.');
        } finally {
            submitEditItem.disabled = false;
            submitEditItem.textContent = 'Save Changes';
        }
    }

    function openDeleteConfirm(itemId) {
        editingItemId = itemId;
        deleteConfirmModal.classList.add('active');
    }

    function closeDeleteConfirmFn() {
        deleteConfirmModal.classList.remove('active');
    }

    async function handleDeleteItem() {
        if (!editingItemId) return;

        confirmDelete.disabled = true;
        confirmDelete.textContent = 'Deleting...';

        try {
            const res = await fetch(`${API_BASE}/items/${editingItemId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Mod-Key': modPassword
                }
            });

            if (res.ok) {
                closeDeleteConfirmFn();
                closeEditModalFn();
                await renderItems();
                showToast('Item deleted. 🗑️');
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to delete item.');
            }
        } catch (err) {
            showToast('Error deleting item.');
        } finally {
            confirmDelete.disabled = false;
            confirmDelete.textContent = 'Delete Permanently';
            editingItemId = null;
        }
    }

    // Check if mod session is still valid on load
    async function checkModSession() {
        if (modPassword) {
            try {
                const res = await fetch(`${API_BASE}/mod/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: modPassword })
                });
                if (res.ok) {
                    isMod = true;
                    btnModLogin.classList.add('mod-active');
                }
            } catch (e) {}
        }
    }

    // ===== User Name =====
    function openNameModal() {
        userNameInput.value = currentUser;
        nameModal.classList.add('active');
        userNameInput.focus();
    }

    function closeNameModalFn() {
        nameModal.classList.remove('active');
    }

    function handleSaveUserName() {
        const name = userNameInput.value.trim();
        if (!name) {
            showToast('Please enter your name.');
            return;
        }
        currentUser = name;
        localStorage.setItem(USER_KEY, currentUser);
        closeNameModalFn();
        updateUserBanner();
        showToast(`Name set to "${name}"`);
    }

    // ===== List Item =====
    function openListModal() {
        if (!currentUser) {
            showToast('Please set your name first!');
            openNameModal();
            return;
        }
        resetListForm();
        listItemModal.classList.add('active');
    }

    function closeListModalFn() {
        listItemModal.classList.remove('active');
        resetListForm();
    }

    function resetListForm() {
        listItemForm.reset();
        selectedFile = null;
        imagePreview.classList.remove('visible');
        imagePreview.src = '';
        uploadPlaceholder.classList.remove('hidden');
    }

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file.');
            return;
        }

        selectedFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = function (event) {
            imagePreview.src = event.target.result;
            imagePreview.classList.add('visible');
            uploadPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    async function handleSubmitItem() {
        // Validate
        if (!selectedFile) {
            showToast('Please add a photo of the item.');
            return;
        }
        if (!itemTitle.value.trim()) {
            showToast('Please enter a title.');
            itemTitle.focus();
            return;
        }
        if (!itemDescription.value.trim()) {
            showToast('Please enter a description.');
            itemDescription.focus();
            return;
        }
        if (!itemDonation.value || Number(itemDonation.value) < 0) {
            showToast('Please enter a suggested donation amount.');
            itemDonation.focus();
            return;
        }

        // Build form data
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('title', itemTitle.value.trim());
        formData.append('description', itemDescription.value.trim());
        formData.append('category', itemCategory.value);
        formData.append('donation', itemDonation.value);
        formData.append('listed_by', currentUser);

        submitListItem.disabled = true;
        submitListItem.textContent = 'Listing...';

        try {
            await createItem(formData);
            closeListModalFn();
            await renderItems();
            showToast('Item listed successfully! 🎉');
        } catch (err) {
            showToast(err.message);
        } finally {
            submitListItem.disabled = false;
            submitListItem.textContent = 'List Item';
        }
    }

    // ===== Claim Item =====
    function openClaimModal(item) {
        if (!currentUser) {
            showToast('Please set your name first!');
            openNameModal();
            return;
        }

        pendingClaimId = item.id;
        claimMessage.textContent = `Claim "${item.title}" for a suggested donation of €${Number(item.donation).toFixed(2)}?`;
        claimModal.classList.add('active');
    }

    function closeClaimModalFn() {
        claimModal.classList.remove('active');
        pendingClaimId = null;
    }

    async function handleConfirmClaim() {
        if (!pendingClaimId) return;

        confirmClaim.disabled = true;
        confirmClaim.textContent = 'Claiming...';

        try {
            await claimItem(pendingClaimId, currentUser);
            closeClaimModalFn();
            await renderItems();
            showToast('Item claimed! Please arrange collection and donation. 🤝');
        } catch (err) {
            showToast(err.message);
        } finally {
            confirmClaim.disabled = false;
            confirmClaim.textContent = 'Confirm Claim';
        }
    }

    // ===== Utilities =====
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    function showToast(message) {
        document.querySelectorAll('.toast').forEach(t => t.remove());
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ===== Event Listeners =====
    btnSetName.addEventListener('click', openNameModal);
    closeNameModal.addEventListener('click', closeNameModalFn);
    saveUserName.addEventListener('click', handleSaveUserName);
    userNameInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSaveUserName();
    });

    fabListItem.addEventListener('click', openListModal);
    closeListModal.addEventListener('click', closeListModalFn);
    cancelListItem.addEventListener('click', closeListModalFn);
    submitListItem.addEventListener('click', handleSubmitItem);

    imageUploadArea.addEventListener('click', () => itemImageInput.click());
    itemImageInput.addEventListener('change', handleImageSelect);

    // Drag and drop support (workaround for browser isolation)
    imageUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadArea.classList.add('drag-over');
    });
    imageUploadArea.addEventListener('dragleave', () => {
        imageUploadArea.classList.remove('drag-over');
    });
    imageUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                imagePreview.src = ev.target.result;
                imagePreview.classList.add('visible');
                uploadPlaceholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            showToast('Please drop an image file.');
        }
    });

    // Paste from clipboard support (Ctrl+V)
    document.addEventListener('paste', (e) => {
        if (!listItemModal.classList.contains('active')) return;
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                selectedFile = file;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    imagePreview.src = ev.target.result;
                    imagePreview.classList.add('visible');
                    uploadPlaceholder.classList.add('hidden');
                };
                reader.readAsDataURL(file);
                showToast('Image pasted from clipboard!');
                break;
            }
        }
    });

    closeClaimModal.addEventListener('click', closeClaimModalFn);
    cancelClaim.addEventListener('click', closeClaimModalFn);
    confirmClaim.addEventListener('click', handleConfirmClaim);

    // Detail Modal
    closeDetailModal.addEventListener('click', closeDetailModalFn);
    detailClaimBtn.addEventListener('click', () => {
        if (currentDetailItem && !currentDetailItem.claimed) {
            closeDetailModalFn();
            openClaimModal(currentDetailItem);
        }
    });

    // Moderator Modal
    btnModLogin.addEventListener('click', openModLoginModal);
    closeModLoginModal.addEventListener('click', closeModLoginModalFn);
    cancelModLogin.addEventListener('click', closeModLoginModalFn);
    submitModLogin.addEventListener('click', handleModLogin);
    modPasswordInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleModLogin();
    });

    // Edit Item Modal (Mod)
    closeEditModal.addEventListener('click', closeEditModalFn);
    cancelEditItem.addEventListener('click', closeEditModalFn);
    submitEditItem.addEventListener('click', handleEditItem);
    deleteItemBtn.addEventListener('click', () => {
        closeEditModalFn();
        openDeleteConfirm(editingItemId);
    });

    // Delete Confirm Modal (Mod)
    closeDeleteModal.addEventListener('click', closeDeleteConfirmFn);
    cancelDelete.addEventListener('click', closeDeleteConfirmFn);
    confirmDelete.addEventListener('click', handleDeleteItem);

    // Close modals on overlay click
    [nameModal, listItemModal, claimModal, detailModal, modLoginModal, editItemModal, deleteConfirmModal].forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Close modals on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            [nameModal, listItemModal, claimModal, detailModal, modLoginModal, editItemModal, deleteConfirmModal].forEach(m => m.classList.remove('active'));
        }
    });

    // ===== Auto-refresh every 30 seconds =====
    setInterval(renderItems, 30000);

    // ===== Init =====
    checkModSession();
    render();

})();
