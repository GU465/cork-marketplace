# Cork Marketplace - SharePoint List Setup

## Step 1: Create the SharePoint List

1. Go to your SharePoint site (e.g., `https://deutscheboerse.sharepoint.com/sites/YourTeamSite`)
2. Click **+ New** → **List** → **Blank list**
3. Name: **Cork Marketplace**

## Step 2: Add Columns

Add the following columns to the list:

| Column Name | Type | Settings |
|-------------|------|----------|
| Title | Single line of text | *(already exists)* |
| Description1 | Multiple lines of text | Plain text, 6 lines |
| Category | Choice | Choices: Furniture, Books, Electronics, Clothes, Kitchen & Home, Sports & Outdoors, Other |
| SuggestedDonation | Number | 2 decimal places, Min: 0 |
| ImageUrl | Hyperlink or Picture | Format: Picture |
| Claimed | Yes/No | Default: No |
| ClaimedBy | Single line of text | *(not required)* |
| ClaimedAt | Date and Time | *(not required)* |

> **Note:** The `Author` (Created By) column is built-in and shows who listed the item.

## Step 3: Create a Document Library for Images

1. Click **+ New** → **Document Library**
2. Name: **MarketplaceImages**
3. This stores uploaded item photos

## Step 4: Apply Column Formatting (Optional)

Apply the JSON formats from the `/sharepoint/` folder for a nice SharePoint native view:

- **Category column**: Use `category-column-format.json`
- **Claimed column**: Use `claimed-column-format.json`
- **SuggestedDonation column**: Use `donation-column-format.json`
- **Gallery view**: Create a view called "Gallery" and apply `gallery-view-format.json`
