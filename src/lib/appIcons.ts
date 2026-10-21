// Centralized Icon Pack for Add designer using Phosphor Icons
// These icons cover printing, stationery & cards, finishing, merchandise, daily transactions, and existing system icons.
// They can be consumed by Icon Pickers in layout editors or dynamic fields.

export interface AppIcon {
  id: string;
  className: string;
  label: string;
  category: string;
}

export const APP_ICONS: AppIcon[] = [
  // --- Printing ---
  { id: "print-printer", className: "ph-printer", label: "Printing", category: "Printing" },
  { id: "print-flex", className: "ph-flag-banner", label: "Flex / Banner", category: "Printing" },
  { id: "print-vinyl", className: "ph-paint-roller", label: "Vinyl Printing", category: "Printing" },
  { id: "print-offset", className: "ph-stack", label: "Offset Printing", category: "Printing" },
  { id: "print-screen", className: "ph-paint-brush", label: "Screen Printing", category: "Printing" },
  { id: "print-canvas", className: "ph-bounding-box", label: "Board / Signage", category: "Printing" },
  { id: "print-design", className: "ph-palette", label: "Design", category: "Printing" },
  { id: "print-image", className: "ph-image", label: "Artwork / Image", category: "Printing" },
  { id: "print-copy", className: "ph-copy", label: "Xerox / Copies", category: "Printing" },
  { id: "print-document", className: "ph-file-text", label: "Printout / Document", category: "Printing" },

  // --- Stationery & Cards ---
  { id: "card-visiting", className: "ph-identification-card", label: "Visiting Card", category: "Stationery & Cards" },
  { id: "card-id", className: "ph-identification-badge", label: "ID Card", category: "Stationery & Cards" },
  { id: "card-invitation", className: "ph-envelope-open", label: "Invitation", category: "Stationery & Cards" },
  { id: "card-sticker", className: "ph-sticker", label: "Sticker", category: "Stationery & Cards" },
  { id: "card-book", className: "ph-book-open", label: "Book Printing", category: "Stationery & Cards" },

  // --- Finishing ---
  { id: "finish-binding", className: "ph-book-bookmark", label: "Binding", category: "Finishing" },
  { id: "finish-lamination", className: "ph-book", label: "Lamination", category: "Finishing" },
  { id: "finish-frame", className: "ph-frame-corners", label: "Framing", category: "Finishing" },
  { id: "finish-cutting", className: "ph-scissors", label: "Cutting", category: "Finishing" },
  { id: "finish-measure", className: "ph-ruler", label: "Size / Measurement", category: "Finishing" },

  // --- Gifts & Merchandise ---

  { id: "merch-mug", className: "ph-coffee", label: "Mug / Cup", category: "Merchandise" },
  { id: "merch-keychain", className: "ph-key", label: "Key Chain", category: "Merchandise" },
  { id: "merch-badge", className: "ph-seal-check", label: "Badge / Token", category: "Merchandise" },
  { id: "merch-bag", className: "ph-tote", label: "Bag / Delivery", category: "Merchandise" },
  { id: "merch-package", className: "ph-package", label: "Courier / Package", category: "Merchandise" },

  // --- Daily Transactions & Finance ---
  { id: "tx-receipt", className: "ph-receipt", label: "Receipt / Bill", category: "Transactions" },
  { id: "tx-money", className: "ph-money", label: "Cash / Notes", category: "Transactions" },
  { id: "tx-coin", className: "ph-coins", label: "Coins", category: "Transactions" },
  { id: "tx-currency-inr", className: "ph-currency-inr", label: "Indian Rupee", category: "Transactions" },
  { id: "tx-wallet", className: "ph-wallet", label: "Wallet", category: "Transactions" },
  { id: "tx-card", className: "ph-credit-card", label: "Card Payment", category: "Transactions" },
  { id: "tx-bank", className: "ph-bank", label: "Bank Transfer", category: "Transactions" },
  { id: "tx-fuel", className: "ph-gas-pump", label: "Fuel", category: "Transactions" },
  { id: "tx-bus", className: "ph-bus", label: "Bus / Public Transport", category: "Transactions" },
  { id: "tx-car", className: "ph-car", label: "Car / Taxi", category: "Transactions" },
  { id: "tx-food", className: "ph-hamburger", label: "Food & Dining", category: "Transactions" },
  { id: "tx-repair", className: "ph-wrench", label: "Repair / Maintenance", category: "Transactions" },

  // --- System & UI Basics (Already Used) ---
  { id: "sys-user", className: "ph-user", label: "User", category: "System" },
  { id: "sys-user-circle", className: "ph-user-circle", label: "Client Profile", category: "System" },
  { id: "sys-users", className: "ph-users", label: "Team / Staff", category: "System" },
  { id: "sys-cal-blank", className: "ph-calendar-blank", label: "Job Date", category: "System" },
  { id: "sys-cal-check", className: "ph-calendar-check", label: "Confirmed Job", category: "System" },
  { id: "sys-pencil", className: "ph-pencil-circle", label: "Edit / Design", category: "System" },
  { id: "sys-dots", className: "ph-dots-three-circle", label: "Other / Misc", category: "System" },
  { id: "sys-trend-up", className: "ph-trend-up", label: "Income Trend", category: "System" },
  { id: "sys-trend-down", className: "ph-trend-down", label: "Expense Trend", category: "System" },
  { id: "sys-arrow-in", className: "ph-arrow-down-left", label: "Money In", category: "System" },
  { id: "sys-arrow-out", className: "ph-arrow-up-right", label: "Money Out", category: "System" },
  { id: "sys-buildings", className: "ph-buildings", label: "Office / Press", category: "System" },
  { id: "sys-envelope", className: "ph-envelope", label: "Email", category: "System" },
  { id: "sys-phone", className: "ph-phone", label: "Phone", category: "System" }
];

// Helper to group icons by category for pickers
export const APP_ICONS_BY_CATEGORY = APP_ICONS.reduce((acc, icon) => {
  if (!acc[icon.category]) {
    acc[icon.category] = [];
  }
  acc[icon.category].push(icon);
  return acc;
}, {} as Record<string, AppIcon[]>);
