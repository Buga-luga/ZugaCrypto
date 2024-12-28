ZugaCrypto/
├── src/
│   ├── components/
│   │   ├── Chart/
│   │   │   ├── CandlestickChart.tsx
│   │   │   └── ChartControls.tsx
│   │   ├── Strategy/
│   │   │   ├── EMAStrategy.tsx
│   │   │   └── GridStrategy.tsx
│   │   └── common/
│   │       ├── TimeframeSelector.tsx
│   │       └── StrategySelector.tsx
│   ├── services/
│   │   ├── api/
│   │   │   └── binanceAPI.ts
│   │   └── strategies/
│   │       ├── emaStrategy.ts
│   │       └── gridStrategy.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── chartHelpers.ts
├── package.json
└── README.md

### Configuration Choices
- ✅ Source Directory (`src/`): Yes
- ✅ App Router: Yes
- ✅ Turbopack: Yes
- ✅ Import Alias: Yes (using `@/*`)

### Tech Stack
- **Framework:** Next.js
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Linting:** ESLint

### Dependencies
#### Core Dependencies
- react
- react-dom
- next

#### Development Dependencies
- typescript
- @types/node
- @types/react
- @types/react-dom
- postcss
- tailwindcss
- eslint
- eslint-config-next
- @eslint/eslintrc

## Development
To run the development server with Turbopack:
