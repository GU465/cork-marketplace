<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cork Marketplace - Clearstream</title>
    <link rel="stylesheet" href="../SiteAssets/CorkMarketplace/styles.css">
</head>
<body>
    <!-- Header with Clearstream branding -->
    <header class="app-header">
        <div class="header-content">
            <img src="../SiteAssets/CorkMarketplace/images/ClearstreamLogo2.jpg" alt="Clearstream - Deutsche Börse Group" class="header-logo">
            <div class="header-title">
                <h1>Cork Marketplace</h1>
                <p class="tagline">Reuse &bull; Reduce Waste &bull; Support Charity</p>
            </div>
        </div>
    </header>

    <!-- Mission Banner -->
    <section class="mission-banner">
        <div class="mission-content">
            <div class="mission-recycle">
                <img src="../SiteAssets/CorkMarketplace/images/Reduce Reuse Recycle2.jpg" alt="Reduce Reuse Recycle" class="recycle-img">
            </div>
            <div class="mission-text">
                <p>Give your unwanted items a new home and help raise funds for our chosen charities. List items you no longer need and make a difference!</p>
            </div>
            <div class="mission-charities">
                <img src="../SiteAssets/CorkMarketplace/images/Cork Stroke Support Charity.jpg" alt="Cork Stroke Support" class="charity-logo">
                <img src="../SiteAssets/CorkMarketplace/images/Shine a Light Charity.jpg" alt="Shine A Light" class="charity-logo">
            </div>
        </div>
    </section>

    <!-- User Identity Banner -->
    <div class="user-banner">
        <div class="user-info">
            <span id="userGreeting">Loading...</span>
        </div>
    </div>

    <!-- Items Grid -->
    <main class="items-container">
        <div class="items-grid" id="itemsGrid"></div>
        <div class="empty-state" id="emptyState">
            <img src="../SiteAssets/CorkMarketplace/images/Marketplace Graphic.jpg" alt="Marketplace" class="empty-graphic">
            <h2>No items listed yet</h2>
            <p>Be the first to list an item for your colleagues!</p>
        </div>
    </main>

    <!-- FAB -->
    <button class="fab" id="fabListItem" title="List an item">
        <span class="fab-icon">+</span>
        <span class="fab-text">List an Item</span>
    </button>

    <!-- Modal: List an Item -->
    <div class="modal-overlay" id="listItemModal">
        <div class="modal modal-large">
            <div class="modal-header">
                <h2>List an Item</h2>
                <button class="modal-close" id="closeListModal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="listItemForm">
                    <div class="form-group">
                        <label for="itemImage">Photo *</label>
                        <div class="image-upload" id="imageUploadArea">
                            <input type="file" id="itemImage" accept="image/*" hidden>
                            <div class="upload-placeholder" id="uploadPlaceholder">
                                <span class="upload-icon">📷</span>
                                <p>Click or tap to add a photo</p>
                            </div>
                            <img id="imagePreview" class="image-preview" alt="Preview">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="itemTitle">Title *</label>
                        <input type="text" id="itemTitle" placeholder="e.g. IKEA Bookshelf" maxlength="80" required>
                    </div>
                    <div class="form-group">
                        <label for="itemDescription">Description *</label>
                        <textarea id="itemDescription" placeholder="Describe the item, condition, details..." rows="3" maxlength="500" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="itemCategory">Category</label>
                        <select id="itemCategory">
                            <option value="Furniture">Furniture</option>
                            <option value="Books">Books</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Clothes">Clothes</option>
                            <option value="Kitchen & Home">Kitchen & Home</option>
                            <option value="Sports & Outdoors">Sports & Outdoors</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="itemDonation">Suggested Donation (€) *</label>
                        <input type="number" id="itemDonation" placeholder="e.g. 5" min="0" step="0.50" required>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="cancelListItem">Cancel</button>
                <button class="btn btn-primary" id="submitListItem">List Item</button>
            </div>
        </div>
    </div>

    <!-- Modal: Item Detail -->
    <div class="modal-overlay" id="detailModal">
        <div class="modal modal-detail">
            <div class="modal-header">
                <h2 id="detailTitle">Item</h2>
                <button class="modal-close" id="closeDetailModal">&times;</button>
            </div>
            <div class="modal-body detail-body">
                <div class="detail-image-wrap">
                    <img id="detailImage" class="detail-image" alt="Item photo">
                </div>
                <div class="detail-info">
                    <div class="detail-price" id="detailPrice">€0.00</div>
                    <span class="detail-category" id="detailCategory">Category</span>
                    <p class="detail-description" id="detailDescription">Description</p>
                    <div class="detail-meta">
                        <span id="detailLister">Listed by: —</span>
                        <span id="detailDate">—</span>
                    </div>
                    <div id="detailClaimedInfo" class="detail-claimed-info" style="display:none;"></div>
                    <div class="detail-actions">
                        <button class="btn-claim" id="detailClaimBtn">✓ Claim Item</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal: Claim Confirmation -->
    <div class="modal-overlay" id="claimModal">
        <div class="modal">
            <div class="modal-header">
                <h2>Claim This Item</h2>
                <button class="modal-close" id="closeClaimModal">&times;</button>
            </div>
            <div class="modal-body">
                <p id="claimMessage">Are you sure you want to claim this item?</p>
                <p class="claim-note">Please arrange with the owner to collect the item and make your donation to the charity fund.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="cancelClaim">Cancel</button>
                <button class="btn btn-primary" id="confirmClaim">Confirm Claim</button>
            </div>
        </div>
    </div>

    <script src="../SiteAssets/CorkMarketplace/app-sharepoint.js"></script>
</body>
</html>
