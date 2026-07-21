/**
 * Cork Marketplace - App Logic
 * Uses localStorage for persistence. No backend required for demo.
 */

(function () {
    'use strict';

    // ===== State =====
    const STORAGE_KEY = 'corkMarketplace_items';
    const USER_KEY = 'corkMarketplace_user';

    let items = loadItems();
    let currentUser = loadUser();
    let pendingClaimId = null;
    let uploadedImageData = null;

    // ===== DOM Elements =====
    const itemsFeed = document.getElementById('itemsFeed');
    const emptyState = document.getElementById('emptyState');
    const userBanner = document.getElementById('userBanner');
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

    // ===== Persistence =====
    function loadItems() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveItems() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            showToast('Storage full. Try removing old items.');
        }
    }

    function loadUser() {
        try {
            return localStorage.getItem(USER_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function saveUser(name) {
        currentUser = name.trim();
        localStorage.setItem(USER_KEY, currentUser);
    }

    // ===== Rendering =====
    function render() {
        updateUserBanner();
        renderItems();
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

    function renderItems() {
        // Remove existing cards (keep empty state for now)
        const existingCards = itemsFeed.querySelectorAll('.item-card');
        existingCards.forEach(card => card.remove());

        if (items.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        // Show most recent first
        const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);

        sorted.forEach(item => {
            const card = createItemCard(item);
            itemsFeed.appendChild(card);
        });
    }

    function createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card' + (item.claimed ? ' claimed' : '');
        card.dataset.id = item.id;

        const timeAgo = getTimeAgo(item.createdAt);
        const claimedClass = item.claimed ? ' claimed' : '';
        const claimText = item.claimed ? '❌ Claimed' : '✓ Claim Item';

        card.innerHTML = `
            <img class="item-card-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">
            <div class="item-card-body">
                <div class="item-card-header">
                    <h3 class="item-card-title">${escapeHtml(item.title)}</h3>
                    <span class="item-card-donation">€${Number(item.donation).toFixed(2)}</span>
                </div>
                <p class="item-card-description">${escapeHtml(item.description)}</p>
                <div class="item-card-meta">
                    <span class="item-card-category">${escapeHtml(item.category)}</span>
                    <span>${timeAgo}</span>
                </div>
                <div class="item-card-footer">
                    <span class="item-card-lister">Listed by: ${escapeHtml(item.listedBy)}</span>
                    <button class="btn-claim${claimedClass}" data-item-id="${item.id}" ${item.claimed ? 'disabled' : ''}>
                        ${claimText}
                    </button>
                </div>
                ${item.claimed ? `<div style="margin-top:8px; font-size:0.8rem; color:var(--danger);">Claimed by: ${escapeHtml(item.claimedBy)}</div>` : ''}
            </div>
        `;

        // Claim button listener
        const claimBtn = card.querySelector('.btn-claim');
        if (!item.claimed) {
            claimBtn.addEventListener('click', () => openClaimModal(item.id));
        }

        return card;
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
        saveUser(name);
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
        uploadedImageData = null;
        imagePreview.classList.remove('visible');
        imagePreview.src = '';
        uploadPlaceholder.classList.remove('hidden');
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file.');
            return;
        }

        // Limit file size (compress if needed)
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                // Resize to max 600px width to save storage
                const canvas = document.createElement('canvas');
                const maxWidth = 600;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                uploadedImageData = canvas.toDataURL('image/jpeg', 0.7);
                imagePreview.src = uploadedImageData;
                imagePreview.classList.add('visible');
                uploadPlaceholder.classList.add('hidden');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function handleSubmitItem() {
        // Validate
        if (!uploadedImageData) {
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

        const newItem = {
            id: generateId(),
            title: itemTitle.value.trim(),
            description: itemDescription.value.trim(),
            category: itemCategory.value,
            donation: Number(itemDonation.value),
            image: uploadedImageData,
            listedBy: currentUser,
            claimed: false,
            claimedBy: null,
            createdAt: Date.now()
        };

        items.push(newItem);
        saveItems();
        closeListModalFn();
        renderItems();
        showToast('Item listed successfully! 🎉');
    }

    // ===== Claim Item =====
    function openClaimModal(itemId) {
        if (!currentUser) {
            showToast('Please set your name first!');
            openNameModal();
            return;
        }

        const item = items.find(i => i.id === itemId);
        if (!item || item.claimed) return;

        pendingClaimId = itemId;
        claimMessage.textContent = `Claim "${item.title}" for a suggested donation of €${Number(item.donation).toFixed(2)}?`;
        claimModal.classList.add('active');
    }

    function closeClaimModalFn() {
        claimModal.classList.remove('active');
        pendingClaimId = null;
    }

    function handleConfirmClaim() {
        if (!pendingClaimId) return;

        const item = items.find(i => i.id === pendingClaimId);
        if (!item || item.claimed) {
            closeClaimModalFn();
            return;
        }

        item.claimed = true;
        item.claimedBy = currentUser;
        item.claimedAt = Date.now();

        saveItems();
        closeClaimModalFn();
        renderItems();
        showToast('Item claimed! Please arrange collection and donation. 🤝');
    }

    // ===== Utilities =====
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
        // Remove existing toasts
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
    itemImageInput.addEventListener('change', handleImageUpload);

    closeClaimModal.addEventListener('click', closeClaimModalFn);
    cancelClaim.addEventListener('click', closeClaimModalFn);
    confirmClaim.addEventListener('click', handleConfirmClaim);

    // Close modals on overlay click
    [nameModal, listItemModal, claimModal].forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            [nameModal, listItemModal, claimModal].forEach(m => m.classList.remove('active'));
        }
    });

    // ===== Init =====
    render();

})();
