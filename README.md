# tickyourbudget

A lightweight, offline-first Progressive Web App (PWA) for monthly budget tracking. Define recurring budget items, organize them by categories, and check them off as you pay — like a to-do list for your finances.

## Features

### Core
- **Monthly Checklist** — View and check off transactions month by month
- **Budget Item Templates** — Define recurring expenses with flexible frequencies (One Time, Weekly, Bi-Weekly, Monthly, Quarterly, Yearly)
- **End Date Support** — Optionally set an end date on budget items to stop generating transactions after a certain date
- **Categories & Sub-categories** — Organize budget items hierarchically
- **Auto Default Category** — A "General" category is created automatically with new profiles
- **Multiple Profiles** — Separate budgets for different contexts (Personal, Family, etc.)
- **Currency Selection** — 20 currencies supported with auto-detection based on locale
- **Transaction Snapshots** — Historical amounts are preserved even when budget items change

### Insights
- **Progress Bar** — Visual indicator of how much of the month's budget has been paid
- **Donut Chart** — Category breakdown chart (toggle on/off) with color-coded legend
- **Month-over-Month Comparison** — See how spending compares to the previous month

### Productivity
- **Search & Filter** — Filter transactions on the Home view or budget items on the Items view
- **Keyboard Shortcuts** — Navigate tabs (`1`–`5`), switch months (`←` `→`), go to today (`T`), create new (`N`), search (`/`), help (`?`)
- **CSV Export** — Download budget items as a `.csv` file alongside the existing JSON export

### Design & Platform
- **Dark/Light Theme** — Toggle between themes with system preference detection
- **Mobile Optimized** — Keyboard overlap fix, responsive toasts, bottom navigation
- **Offline-First** — Works without internet via Service Worker caching
- **Data Portability** — Import/Export all data as JSON or CSV
- **Installable** — Install as a native-like app on any device
- **No Frameworks** — Built with pure HTML5, CSS3, and vanilla JavaScript

## Tech Stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Frontend | HTML5, CSS3, ES6+ Modules        |
| Storage  | IndexedDB (client-side)          |
| PWA      | Service Worker, Web App Manifest |
| CI/CD    | GitHub Actions → GitHub Pages    |

## Getting Started

### Run Locally

Simply serve the files with any static HTTP server:

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

### Deploy to GitHub Pages

1. Push to the `main` branch
2. Go to **Settings → Pages → Source** and select **GitHub Actions**
3. The workflow in `.github/workflows/deploy.yml` auto-deploys on push

## Project Structure

```
├── index.html                  # Single-page app shell
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker
├── css/
│   └── styles.css              # All styles (light/dark themes)
├── js/
│   ├── app.js                  # App entry & router
│   ├── db.js                   # IndexedDB wrapper
│   ├── models.js               # Data models & helpers
│   ├── transaction-engine.js   # Transaction generation logic
│   ├── components/
│   │   ├── modal.js            # Modal & confirm dialogs
│   │   ├── toast.js            # Toast notifications
│   │   ├── theme.js            # Theme toggle
│   │   └── profile.js          # Profile CRUD
│   └── views/
│       ├── home.js             # Checklist (transactions)
│       ├── items.js            # Budget items management
│       ├── categories.js       # Categories management
│       └── data.js             # Import/export/settings
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── .github/
    └── workflows/
        └── deploy.yml          # GitHub Pages deployment
```

## Data Model

- **Profile** — A distinct budget context
- **Category** — Hierarchical labels (one level of nesting)
- **Budget Item** — Recurring expense/income template with optional end date
- **Transaction** — Snapshot instance of a budget item for a specific date

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`–`5` | Switch tabs (Home, Items, Categories, Data, Profiles) |
| `←` `→` | Previous / next month (Home view) |
| `T` | Jump to current month |
| `N` | New item or category (context-aware) |
| `/` | Focus the search bar |
| `?` | Show shortcuts overlay |
| `Esc` | Dismiss overlay or blur input |

## License

MIT