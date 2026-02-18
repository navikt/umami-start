# Settings Feature

This feature contains all components, logic, and utilities related to website settings and tracking code management.

## Structure

```
client/features/settings/
├── api/                  # API calls and data fetching
│   ├── index.ts
│   └── websites.ts       # Fetch websites from backend
├── hooks/                # Custom React hooks
│   ├── index.ts
│   └── useWebsites.ts    # Hooks for managing websites, filters, and modal state
├── model/                # Types, interfaces, and constants
│   ├── constants.ts      # Constants (e.g., PROD_TEAM_ID)
│   ├── index.ts
│   └── types.ts          # TypeScript interfaces and types
├── ui/                   # UI components
│   ├── index.ts
│   ├── SnippetBlock.tsx        # Code snippet display with syntax highlighting
│   ├── TeamWebsites.tsx        # Main component for website table
│   └── TrackingCodeModal.tsx   # Modal for displaying tracking codes
├── utils/                # Utility functions
│   ├── index.ts
│   ├── snippetGenerators.ts  # Generate tracking code snippets
│   └── websiteUtils.ts       # Website grouping, filtering, and formatting
├── storage/              # Local storage utilities (empty for now)
└── index.ts              # Main export file
```

## Key Components

### TeamWebsites
Main component that displays a searchable, filterable table of all websites with their tracking codes.

**Features:**
- Search by name, domain, or ID
- Filter by environment (prod/dev/both)
- Group prod and dev versions of the same website
- Open modal to view tracking code snippets

### TrackingCodeModal
Modal dialog that displays various tracking code snippets for different frameworks:
- Standard HTML
- Next.js
- React with Vite.js
- Astro.js
- Google Tag Manager

### SnippetBlock
Reusable component for displaying syntax-highlighted code snippets with copy functionality.

## Hooks

### useWebsites()
Fetches and groups websites data from the API.

**Returns:**
- `data` - Raw website data
- `groupedData` - Websites grouped by base name
- `filteredData` - Filtered data based on search and environment filters
- `setFilteredData` - Function to update filtered data
- `isLoading` - Loading state
- `error` - Error state

### useWebsiteFilters(groupedData, setFilteredData)
Manages search and filter state for the website table.

**Returns:**
- `searchQuery` / `setSearchQuery` - Search query state
- `filter` / `setFilter` - Environment filter state

### useWebsiteModal()
Manages modal state and URL parameters for deep-linking to tracking codes.

**Returns:**
- `pendingSporingskode` - Pending website ID to display
- `setPendingSporingskode` - Function to set pending ID
- `openModal(id)` - Open modal and update URL
- `closeModal()` - Close modal and clear URL params

## Utilities

### websiteUtils.ts
- `getBaseName(name)` - Extract base name from website name
- `isProd(website)` - Check if website is production
- `groupWebsites(websites)` - Group websites by base name
- `formatDate(date)` - Format date to Norwegian format

### snippetGenerators.ts
Functions to generate tracking code snippets for different frameworks:
- `getStandardSnippet(websiteId)`
- `getNextJsSnippet(websiteId)`
- `getReactViteProviderSnippet()`
- `getReactViteHeadSnippet(websiteId)`
- `getAstroSnippet(websiteId)`
- `getGTMSnippet(websiteId)`

## Usage

Import from the feature:

```typescript
import { TeamWebsites } from '@/features/settings';
```

Or import specific parts:

```typescript
import { useWebsites, formatDate, SnippetBlock } from '@/features/settings';
```

## Migration Notes

The following components were migrated from `src/client/components/settings/`:
- `TeamWebsites.tsx` → `features/settings/ui/TeamWebsites.tsx`
- `SporingsModal.tsx` → `features/settings/ui/TrackingCodeModal.tsx`
- `SnippetBlock.tsx` → `features/settings/ui/SnippetBlock.tsx`

The tracking snippet generators were moved from `src/data/tracking-snippets.ts` to `features/settings/utils/snippetGenerators.ts`, with the original file now re-exporting from the new location for backward compatibility.

