/**
 * Cork Marketplace - SharePoint Edition
 * Uses SharePoint REST API for data storage
 * No backend server needed - runs entirely on SharePoint
 */

(function () {
    'use strict';

    // ===== SharePoint Configuration =====
    // These will be auto-detected from the current page URL
    const SITE_URL = _spPageContextInfo
        ? _spPageContextInfo.webAbsoluteUrl
        : window.location.origin + window.location.pathname.split('/SitePages')[0].split('/Lists')[0];
    const LIST_NAME = 'Cork Marketplace';
    const IMAGE_LIBRARY = 'MarketplaceImages';

    let currentUser = '';
    let currentUserEmail = '';
    let pendingClaimId = null;
    let selectedFile = null;
    let requestDigest = '';
    let isMod = false;
    let currentDetailItem = null;
    let editingItemId = null;

    // ===== DOM Elements =====
    const itemsGrid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    const userGreeting = document.getElementById('userGreeting');
    const fabListItem = document.getElementById('fabListItem');

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

    // ===== SharePoint API Helpers =====
    async function getRequestDigest() {
        const res = await fetch(SITE_URL + '/_api/contextinfo', {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose' }
        });
        const data = await res.json();
        requestDigest = data.d.GetContextWebInformation.FormDigestValue;
        return requestDigest;
    }

    async function getCurrentUser() {
        const res = await fetch(SITE_URL + '/_api/web/currentuser', {
            headers: { 'Accept': 'application/json;odata=verbose' }
        });
        const data = await res.json();
        currentUser = data.d.Title;
        currentUserEmail = data.d.Email;
        return currentUser;
    }

    async function fetchItems() {
        try {
            const res = await fetch(
                SITE_URL + `/_api/web/lists/getbytitle('${LIST_NAME}')/items?$orderby=Created desc&$top=100&$select=*,ListedBy/Title,ClaimedBy/Title&$expand=ListedBy,ClaimedBy`,
                { headers: { 'Accept': 'application/json;odata=verbose' } }
            );
            if (!res.ok) throw new Error('Failed to fetch items');
            const data = await res.json();
            return data.d.results.map(item => ({
                id: item.Id,
                title: item.Title,
                description: item.Description1 || '',
                category: item.Category || 'Other',
                donation: item.SuggestedDonation || 0,
                image_path: item.ImageUrl || '',
                listed_by: item.ListedBy ? item.ListedBy.Title : 'Unknown',
                claimed: item.Claimed || false,
                claimed_by: item.ClaimedBy ? item.ClaimedBy.Title : '',
                created_at: item.Created,
                etag: item.__metadata.etag,
                uri: item.__metadata.uri
            }));
        } catch (err) {
            console.error('Error fetching items:', err);
            showToast('Error loading items. Please refresh.');
            return [];
        }
    }

    async function uploadImage(file) {
        const fileName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

        // Ensure the image library folder exists
        try {
            await fetch(SITE_URL + `/_api/web/lists/getbytitle('${IMAGE_LIBRARY}')`, {
                headers: { 'Accept': 'application/json;odata=verbose' }
            });
        } catch (e) {
            // Library might not exist - will be created in setup
        }

        const arrayBuffer = await file.arrayBuffer();

        const res = await fetch(
            SITE_URL + `/_api/web/getFolderByServerRelativeUrl('${new URL(SITE_URL).pathname}/${IMAGE_LIBRARY}')/files/add(overwrite=true,url='${fileName}')`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'X-RequestDigest': requestDigest,
                    'Content-Length': arrayBuffer.byteLength
                },
                body: arrayBuffer
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            throw new Error('Image upload failed: ' + errText);
        }

        const data = await res.json();
        return data.d.ServerRelativeUrl;
    }

    async function createItem(title, description, category, donation, imageUrl) {
        const itemData = {
            '__metadata': { 'type': 'SP.Data.Cork_x0020_MarketplaceListItem' },
            'Title': title,
            'Description1': description,
            'Category': category,
            'SuggestedDonation': donation,
            'ImageUrl': imageUrl,
            'Claimed': false
        };

        const res = await fetch(
            SITE_URL + `/_api/web/lists/getbytitle('${LIST_NAME}')/items`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': requestDigest
                },
                body: JSON.stringify(itemData)
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            throw new Error('Failed to create item: ' + errText);
        }

        return await res.json();
    }

    async function claimItem(item) {
        const res = await fetch(item.uri, {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'Content-Type': 'application/json;odata=verbose',
                'X-RequestDigest': requestDigest,
                'X-HTTP-Method': 'MERGE',
                'If-Match': item.etag
            },
            body: JSON.stringify({
                '__metadata': { 'type': 'SP.Data.Cork_x0020_MarketplaceListItem' },
                'Claimed': true,
                'ClaimedById': null // Will be set via separate call
            })
        });

        if (!res.ok) {
            throw new Error('Failed to claim item');
        }

        // Set ClaimedBy to current user using ensureuser
        const userRes = await fetch(SITE_URL + `/_api/web/ensureuser('${currentUserEmail}')`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json;odata=verbose',
                'X-RequestDigest': requestDigest
            }
        });
        const userData = await userRes.json();
        const userId = userData.d.Id;

        // Update the item with the ClaimedBy user
        await fetch(
            SITE_URL + `/_api/web/lists/getbytitle('${LIST_NAME}')/items(${item.id})`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': requestDigest,
                    'X-HTTP-Method': 'MERGE',
                    'If-Match': '*'
                },
                body: JSON.stringify({
                    '__metadata': { 'type': 'SP.Data.Cork_x0020_MarketplaceListItem' },
                    'Claimed': true,
                    'ClaimedById': userId
                })
            }
        );
    }

    async function deleteItem(item) {
        const res = await fetch(
            SITE_URL + `/_api/web/lists/getbytitle('${LIST_NAME}')/items(${item.id})`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'X-RequestDigest': requestDigest,
                    'X-HTTP-Method': 'DELETE',
                    'If-Match': '*'
                }
            }
        );
        if (!res.ok) throw new Error('Failed to delete item');
    }

    async function updateItem(itemId, data) {
        const res = await fetch(
            SITE_URL + `/_api/web/lists/getbytitle('${LIST_NAME}')/items(${itemId})`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/json;odata=verbose',
                    'Content-Type': 'application/json;odata=verbose',
                    'X-RequestDigest': requestDigest,
                    'X-HTTP-Method': 'MERGE',
                    'If-Match': '*'
                },
                body: JSON.stringify({
                    '__metadata': { 'type': 'SP.Data.Cork_x0020_MarketplaceListItem' },
                    ...data
                })
            }
        );
        if (!res.ok) throw new Error('Failed to update item');
    }

    // ===== Rendering =====
    async function render() {
        updateUserBanner();
        await renderItems();
    }

    function updateUserBanner() {
        if (currentUser) {
            userGreeting.textContent = `Hello, ${currentUser}!`;
        }
    }

    async function renderItems() {
        const items = await fetchItems();
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
        const imgSrc = item.image_path || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';

        card.innerHTML = `
            <img class="item-card-image" src="${escapeAttr(imgSrc)}" alt="${escapeAttr(item.title)}" loading="lazy" onerror="this.style.display='none'">
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
                    <button class="btn-claim${claimedClass}" ${item.claimed ? 'disabled' : ''}>
                        ${claimText}
                    </button>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-claim')) {
                openDetailModal(item);
            }
        });

        const claimBtn = card.querySelector('.btn-claim');
        if (!item.claimed) {
            claimBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openClaimModal(item);
            });
        }

        return card;
    }

    // ===== Detail Modal =====
    function openDetailModal(item) {
        currentDetailItem = item;
        detailTitle.textContent = item.title;
        detailImage.src = item.image_path || '';
        detailImage.alt = item.title;
        detailImage.style.display = item.image_path ? 'block' : 'none';
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

        detailModal.classList.add('active');
    }

    function closeDetailModalFn() {
        detailModal.classList.remove('active');
        currentDetailItem = null;
    }

    // ===== List Item =====
    function openListModal() {
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
        const reader = new FileReader();
        reader.onload = function (event) {
            imagePreview.src = event.target.result;
            imagePreview.classList.add('visible');
            uploadPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    async function handleSubmitItem() {
        if (!selectedFile) { showToast('Please add a photo.'); return; }
        if (!itemTitle.value.trim()) { showToast('Please enter a title.'); return; }
        if (!itemDescription.value.trim()) { showToast('Please enter a description.'); return; }
        if (!itemDonation.value || Number(itemDonation.value) < 0) { showToast('Please enter a donation amount.'); return; }

        submitListItem.disabled = true;
        submitListItem.textContent = 'Listing...';

        try {
            await getRequestDigest(); // Refresh digest
            const imageUrl = await uploadImage(selectedFile);
            await createItem(
                itemTitle.value.trim(),
                itemDescription.value.trim(),
                itemCategory.value,
                Number(itemDonation.value),
                imageUrl
            );
            closeListModalFn();
            await renderItems();
            showToast('Item listed successfully! 🎉');
        } catch (err) {
            console.error(err);
            showToast('Error: ' + err.message);
        } finally {
            submitListItem.disabled = false;
            submitListItem.textContent = 'List Item';
        }
    }

    // ===== Claim =====
    function openClaimModal(item) {
        pendingClaimId = item;
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
            await getRequestDigest();
            await claimItem(pendingClaimId);
            closeClaimModalFn();
            await renderItems();
            showToast('Item claimed! Please arrange collection and donation. 🤝');
        } catch (err) {
            showToast('Error: ' + err.message);
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
    fabListItem.addEventListener('click', openListModal);
    closeListModal.addEventListener('click', closeListModalFn);
    cancelListItem.addEventListener('click', closeListModalFn);
    submitListItem.addEventListener('click', handleSubmitItem);

    imageUploadArea.addEventListener('click', () => itemImageInput.click());
    itemImageInput.addEventListener('change', handleImageSelect);

    closeClaimModal.addEventListener('click', closeClaimModalFn);
    cancelClaim.addEventListener('click', closeClaimModalFn);
    confirmClaim.addEventListener('click', handleConfirmClaim);

    closeDetailModal.addEventListener('click', closeDetailModalFn);
    detailClaimBtn.addEventListener('click', () => {
        if (currentDetailItem && !currentDetailItem.claimed) {
            closeDetailModalFn();
            openClaimModal(currentDetailItem);
        }
    });

    // Close modals on overlay click
    [listItemModal, claimModal, detailModal].forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            [listItemModal, claimModal, detailModal].forEach(m => m.classList.remove('active'));
        }
    });

    // Auto-refresh every 30 seconds
    setInterval(renderItems, 30000);

    // ===== Init =====
    async function init() {
        try {
            await getCurrentUser();
            await getRequestDigest();
            render();
        } catch (err) {
            console.error('Init error:', err);
            showToast('Error connecting to SharePoint. Please refresh.');
        }
    }

    init();

})();
