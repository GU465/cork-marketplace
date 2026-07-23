# Cork Marketplace - Power Apps Canvas App

## Complete Power Fx Formulas & Screen Configuration

---

## SCREEN 1: BrowseScreen (Gallery View)

### Screen OnVisible:
```
Set(varCurrentUser, User().FullName);
Set(varCurrentUserEmail, User().Email);
ClearCollect(
    colItems,
    SortByColumns(
        Filter('Cork Marketplace', true),
        "Created",
        SortOrder.Descending
    )
)
```

### Header Label:
- **Text**: `"🟢 Cork Marketplace"`
- **Font**: Segoe UI, Bold, Size 22
- **Color**: `RGBA(0, 107, 112, 1)` (teal)

### Search TextInput (txtSearch):
- **HintText**: `"Search items..."`

### Category Dropdown (ddCategory):
- **Items**: `["All", "Furniture", "Books", "Electronics", "Clothes", "Kitchen & Home", "Sports & Outdoors", "Other"]`
- **Default**: `"All"`

### Filter Toggle (tglAvailable):
- **Text**: `"Available only"`
- **Default**: `true`

### Gallery (galItems):
- **Items**:
```
Sort(
    Filter(
        'Cork Marketplace',
        // Search filter
        (IsBlank(txtSearch.Text) || 
         txtSearch.Text in Title || 
         txtSearch.Text in Description1),
        // Category filter
        (ddCategory.Selected.Value = "All" || 
         Category.Value = ddCategory.Selected.Value),
        // Available filter
        (!tglAvailable.Value || Claimed = false)
    ),
    Created,
    SortOrder.Descending
)
```

- **TemplatePadding**: 8
- **TemplateSize**: 280

### Gallery Card Layout:
#### Image (imgItem):
- **Image**: `ThisItem.ImageUrl`
- **Height**: 140
- **ImagePosition**: `ImagePosition.Fit`

#### Title Label:
- **Text**: `ThisItem.Title`
- **Font**: Segoe UI Semibold, Size 14

#### Description Label:
- **Text**: `ThisItem.Description1`
- **MaxLines**: 2
- **Color**: `RGBA(117, 117, 117, 1)`

#### Price Label:
- **Text**: `"€" & Text(ThisItem.SuggestedDonation, "0.00")`
- **Font**: Segoe UI Bold, Size 18
- **Color**: `RGBA(0, 107, 112, 1)`

#### Category Badge:
- **Text**: `ThisItem.Category.Value`
- **Fill**: 
```
Switch(
    ThisItem.Category.Value,
    "Furniture", RGBA(232, 245, 233, 1),
    "Books", RGBA(227, 242, 253, 1),
    "Electronics", RGBA(255, 243, 224, 1),
    "Clothes", RGBA(252, 228, 236, 1),
    "Kitchen & Home", RGBA(243, 229, 245, 1),
    "Sports & Outdoors", RGBA(224, 247, 250, 1),
    RGBA(245, 245, 245, 1)
)
```

#### Status Badge:
- **Text**: `If(ThisItem.Claimed, "❌ Claimed", "✓ Available")`
- **Fill**: `If(ThisItem.Claimed, RGBA(198, 40, 40, 1), RGBA(0, 163, 173, 1))`
- **Color**: `White`
- **BorderRadius**: 16

#### Listed By Label:
- **Text**: `"By: " & ThisItem.Author.DisplayName`
- **Font Size**: 11

#### OnSelect (Gallery):
```
Set(varSelectedItem, ThisItem);
Navigate(DetailScreen, ScreenTransition.None)
```

### FAB Button (btnListItem):
- **Text**: `"+"`
- **OnSelect**: `Navigate(NewItemScreen, ScreenTransition.None)`
- **Fill**: `RGBA(0, 163, 173, 1)`
- **Color**: `White`
- **BorderRadius**: 28
- **Width**: 56, **Height**: 56

---

## SCREEN 2: DetailScreen (Item Detail View)

### Back Arrow Icon:
- **OnSelect**: `Back()`

### Item Image:
- **Image**: `varSelectedItem.ImageUrl`
- **Height**: 250
- **ImagePosition**: `ImagePosition.Fit`

### Title Label:
- **Text**: `varSelectedItem.Title`
- **Font**: Segoe UI Bold, Size 20

### Price Label:
- **Text**: `"€" & Text(varSelectedItem.SuggestedDonation, "0.00")`
- **Font**: Segoe UI Bold, Size 24
- **Color**: `RGBA(0, 107, 112, 1)`

### Category Badge:
- **Text**: `varSelectedItem.Category.Value`

### Description Label:
- **Text**: `varSelectedItem.Description1`
- **AutoHeight**: true

### Listed By:
- **Text**: `"Listed by: " & varSelectedItem.Author.DisplayName`

### Listed Date:
- **Text**: `"Listed: " & Text(varSelectedItem.Created, "dd mmm yyyy")`

### Claimed Info (visible when claimed):
- **Visible**: `varSelectedItem.Claimed`
- **Text**: `"Claimed by " & varSelectedItem.ClaimedBy & " on " & Text(DateTimeValue(varSelectedItem.ClaimedAt), "dd mmm yyyy")`

### Claim Button (btnClaim):
- **Text**: `"🤝 Claim This Item"`
- **Visible**: `!varSelectedItem.Claimed`
- **Fill**: `RGBA(0, 163, 173, 1)`
- **OnSelect**:
```
Set(varShowClaimConfirm, true)
```

### Claim Confirmation (visible on varShowClaimConfirm):
- **Confirm Button OnSelect**:
```
Patch(
    'Cork Marketplace',
    LookUp('Cork Marketplace', ID = varSelectedItem.ID),
    {
        Claimed: true,
        ClaimedBy: varCurrentUser,
        ClaimedAt: Text(Now(), "yyyy-mm-ddThh:mm:ss")
    }
);
Set(varShowClaimConfirm, false);
Notify("Item claimed! Please arrange collection.", NotificationType.Success);
Back()
```

---

## SCREEN 3: NewItemScreen (List a New Item)

### Header:
- **Text**: `"List an Item"`

### Back/Cancel:
- **OnSelect**: `Back()`

### Form Fields:

#### Title Input (txtNewTitle):
- **HintText**: `"What are you giving away?"`
- **MaxLength**: 100

#### Description Input (txtNewDesc):
- **HintText**: `"Describe the item, condition, etc."`
- **Mode**: `TextMode.MultiLine`
- **MaxLength**: 500

#### Category Dropdown (ddNewCategory):
- **Items**: `["Furniture", "Books", "Electronics", "Clothes", "Kitchen & Home", "Sports & Outdoors", "Other"]`

#### Donation Amount (txtNewDonation):
- **HintText**: `"Suggested charity donation (€)"`
- **Format**: `TextFormat.Number`

#### Image Upload (addImage):
- **Use**: Add Picture control
- **MaxSize**: 5000000 (5MB)

### Submit Button (btnSubmit):
- **Text**: `"✓ List Item"`
- **Fill**: `RGBA(0, 163, 173, 1)`
- **DisplayMode**: 
```
If(
    !IsBlank(txtNewTitle.Text) && 
    !IsBlank(txtNewDesc.Text) && 
    !IsBlank(txtNewDonation.Text) &&
    Value(txtNewDonation.Text) >= 0,
    DisplayMode.Edit,
    DisplayMode.Disabled
)
```
- **OnSelect**:
```
// First upload the image to the document library
Set(varImageFileName, 
    Text(Now(), "yyyymmddhhmmss") & "_" & 
    Substitute(txtNewTitle.Text, " ", "_") & ".jpg"
);

// Upload image to MarketplaceImages library
// (Uses Power Automate flow - see below)
CorkMarketplace_UploadImage.Run(
    varImageFileName,
    addImage.Image
);

// Create the list item
Patch(
    'Cork Marketplace',
    Defaults('Cork Marketplace'),
    {
        Title: txtNewTitle.Text,
        Description1: txtNewDesc.Text,
        Category: {Value: ddNewCategory.Selected.Value},
        SuggestedDonation: Value(txtNewDonation.Text),
        ImageUrl: "https://yourtenant.sharepoint.com/sites/YourSite/MarketplaceImages/" & varImageFileName,
        Claimed: false
    }
);

Notify("Item listed successfully! 🎉", NotificationType.Success);
Reset(txtNewTitle);
Reset(txtNewDesc);
Reset(ddNewCategory);
Reset(txtNewDonation);
Reset(addImage);
Back()
```

---

## SCREEN 4: MyItemsScreen (Optional - My Listings)

### Gallery Items:
```
Filter(
    'Cork Marketplace',
    Author.Email = varCurrentUserEmail
)
```

### Delete Button (per item):
- **Visible**: `!ThisItem.Claimed`
- **OnSelect**:
```
Remove('Cork Marketplace', ThisItem);
Notify("Item removed.", NotificationType.Information)
```

---

## App-Level Settings

### App.OnStart:
```
Set(varCurrentUser, User().FullName);
Set(varCurrentUserEmail, User().Email);
Set(varAppThemeColor, RGBA(0, 163, 173, 1));
Set(varAppAccentColor, RGBA(0, 107, 112, 1))
```

### App Theme Colors:
| Element | Color |
|---------|-------|
| Primary (teal) | `RGBA(0, 163, 173, 1)` / #00A3AD |
| Dark teal | `RGBA(0, 107, 112, 1)` / #006B70 |
| Background | `RGBA(248, 249, 250, 1)` / #F8F9FA |
| Card background | `White` |
| Text primary | `RGBA(33, 33, 33, 1)` |
| Text secondary | `RGBA(117, 117, 117, 1)` |

---

## Navigation

Add a bottom navigation bar or tab control:
```
// Icons and screens:
// 🏠 Browse → BrowseScreen
// 📦 My Items → MyItemsScreen  
// ➕ List Item → NewItemScreen
```
