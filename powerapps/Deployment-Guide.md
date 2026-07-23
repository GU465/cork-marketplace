# Cork Marketplace - Power Apps Deployment Guide

## Quick Start (15-20 minutes)

### Prerequisites
- Microsoft 365 license with Power Apps included
- Access to a SharePoint team site
- Power Apps Maker portal access: https://make.powerapps.com

---

## Step 1: Create the SharePoint List (5 min)
Follow the instructions in `SharePoint-List-Setup.md`

---

## Step 2: Create the Canvas App (10 min)

1. Go to **https://make.powerapps.com**
2. Select your environment (default is fine)
3. Click **+ Create** → **Canvas app from blank** → **Tablet** layout
4. Name: **Cork Marketplace**

### Connect Data Source:
1. Left panel → **Data** icon (cylinder)
2. Click **+ Add data**
3. Search **SharePoint** → Select your site → Select **Cork Marketplace** list
4. Also add the **MarketplaceImages** library if using image uploads

### Build Screens:
1. Follow the formulas in `PowerApps-Formulas.md`
2. Start with **BrowseScreen** (gallery of items)
3. Add **DetailScreen** (item details + claim)
4. Add **NewItemScreen** (list a new item)

---

## Step 3: Image Upload (Power Automate Flow)

Since Power Apps can't directly upload to a SharePoint library easily, create a simple Power Automate flow:

### Create Flow: "CorkMarketplace_UploadImage"

1. Go to **https://make.powerautomate.com**
2. **+ Create** → **Instant cloud flow**
3. Trigger: **Power Apps (V2)**
4. Add inputs:
   - `FileName` (Text)
   - `FileContent` (File)
5. Add action: **SharePoint - Create file**
   - Site: Your SharePoint site
   - Library: MarketplaceImages
   - File Name: `FileName` from trigger
   - File Content: `FileContent` from trigger
6. Add action: **Respond to a PowerApp or flow**
   - Output: `ImageUrl` = concat site URL + "/MarketplaceImages/" + FileName
7. **Save** the flow

### In Power Apps:
- The flow will appear under **Action** → **Power Automate** in the app editor
- Call it: `CorkMarketplace_UploadImage.Run(fileName, imageContent)`

---

## Step 4: Publish & Share

### Publish:
1. In Power Apps Studio → **File** → **Save**
2. Click **Publish**

### Share with Colleagues:
1. Go to https://make.powerapps.com → **Apps**
2. Click **⋯** on your app → **Share**
3. Add specific people or a Microsoft 365 Group (e.g., "Clearstream Cork Office")
4. They get **User** permission (can use the app)
5. Check **"Send an email invitation"** to notify them

### Add to Microsoft Teams:
1. Open **Microsoft Teams**
2. Go to the desired Team/Channel
3. Click **+** (Add a tab) → **Power Apps**
4. Select **Cork Marketplace**
5. Click **Save**

Now your colleagues can access the marketplace directly from Teams!

---

## Step 5: Optional Enhancements

### Push Notifications (when item is claimed):
1. Create a Power Automate flow triggered by "When an item is modified" in SharePoint
2. Condition: Claimed changed from No to Yes
3. Action: Send email/Teams notification to the item author

### Weekly Digest:
1. Scheduled flow (weekly)
2. Get items created in last 7 days
3. Send summary to a Teams channel

### Analytics:
- Power Apps tracks usage automatically
- View in https://make.powerapps.com → **Analytics**

---

## Advantages of This Approach

| Feature | Status |
|---------|--------|
| Free with M365 license | ✅ |
| No external hosting needed | ✅ |
| Corporate SSO authentication | ✅ |
| Only colleagues can access | ✅ |
| Works in Teams | ✅ |
| Works on mobile | ✅ |
| Auto-identifies users | ✅ |
| No passwords to manage | ✅ |
| Data stays in your tenant | ✅ |
| IT-approved platform | ✅ |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't see SharePoint list | Ensure you have at least Contribute access |
| Power Apps not available | Check with IT - may need license assignment |
| Image upload fails | Verify MarketplaceImages library permissions |
| Colleagues can't open app | Re-share with correct permissions |
| Slow gallery loading | Add `Delegation`-compatible filters only |
