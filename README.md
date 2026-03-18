# Hunch

A mobile prediction market and social trading platform built on Solana.

## About

Hunch enables users to trade prediction markets, follow successful traders, and leverage copy-trading functionality to replicate strategies from top performers. The platform aggregates markets from Jupiter Prediction and integrates with Polymarket for leaderboard and copy trading features.

## Key Features

### Prediction Markets
Trade Yes/No outcome tokens on events across multiple categories including crypto, sports, politics, and entertainment. Markets are sourced from Jupiter Prediction with real-time price data and interactive charts.

### Social Trading
Build a network by following successful traders on the platform. Access curated feeds including "For You" personalized recommendations and "Following" feeds to track activity from traders you follow. Discover top performers and share your own trades.

### Copy Trading
Automatically replicate trades from selected leaders with configurable parameters:
- Set amount per trade and maximum total allocation
- Copy both internal Hunch traders and external Polymarket traders
- Key Quorum delegation for secure automated execution

### Portfolio Management
- Aggregated position view organized by market and side (Yes/No)
- Real-time PnL calculations with entry price tracking
- Active and historical position tracking
- USDC balance management with deposit and withdrawal

### Leaderboards
View top Polymarket traders ranked by PnL and volume. Filter by category and time period to discover consistent performers worth following or copying.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native 0.81 |
| Platform | Expo 54 |
| Routing | expo-router (file-based) |
| Styling | NativeWind (Tailwind CSS) |
| State | React Context |
| Authentication | Privy |
| Blockchain | Solana Web3.js |
| Package Manager | pnpm |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

```bash
pnpm install
```

### Development

```bash
# Start the development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

## Project Structure

```
hunch-app/
├── app/                      # Screens (file-based routing)
│   ├── _layout.tsx           # Root layout with providers and auth flow
│   ├── (tabs)/               # Tab navigator
│   │   ├── index.tsx         # Home - Event carousels, market feed, portfolio summary
│   │   ├── social.tsx        # Social feed with For You and Following tabs
│   │   ├── leaderboard.tsx   # Polymarket trader rankings
│   │   └── profile.tsx       # User positions, copy settings, balance
│   ├── login.tsx             # OAuth login (Twitter/X, Apple, Google)
│   ├── onboarding/           # Link X, claim username, select interests
│   ├── event/[ticker]/       # Event detail with associated markets
│   ├── market/[ticker]/      # Market detail with trading interface
│   ├── user/[userId]/        # User profile and followers
│   ├── profile/[identifier]/ # Unified profile (Hunch or Polymarket)
│   └── trade/[tradeId]/      # Individual trade detail
├── components/
│   ├── AddCashSheet.tsx      # Deposit USDC via QR or card
│   ├── CreditCard.tsx        # Balance display and withdrawal
│   ├── MarketTradeSheet.tsx  # Swipe-to-trade interface with keypad
│   ├── SellPositionSheet.tsx # Position exit flow
│   ├── CopyTradeSheet.tsx    # Copy trading configuration
│   ├── PositionCard.tsx      # Position display with PnL
│   ├── LightChart.tsx        # Price charts
│   └── skeletons/            # Loading state components
├── contexts/
│   └── UserContext.tsx       # User state, positions, balance, copy settings
├── hooks/
│   └── useCopyTrading.ts     # Copy trading logic
├── lib/
│   ├── api.ts                # REST API client with authentication
│   ├── tradeService.ts       # Jupiter order execution and USDC transfers
│   ├── types.ts              # TypeScript definitions
│   └── pushNotifications.ts  # Expo push notification handling
├── constants/
│   └── theme.ts              # Color palette and theme configuration
└── assets/                   # Images and fonts
```

## Architecture

### Frontend (hunch-app)

React Native mobile application built with Expo. Key responsibilities:
- User interface and navigation
- Authentication flow via Privy OAuth
- Trade execution through embedded Solana wallet
- Real-time position and balance tracking
- Push notification handling

### Backend (hunch-backend)

Node.js REST API deployed on Vercel as serverless functions. Key responsibilities:
- User management and authentication validation
- Trade recording and position aggregation
- Social features (follows, feeds, posts)
- Copy trading configuration and execution
- Proxy layer for Jupiter Prediction and Polymarket APIs

### External Services

| Service | Purpose |
|---------|---------|
| **Privy** | OAuth authentication (Twitter/X, Apple, Google), embedded Solana wallet creation, JWT token management, transaction sponsorship |
| **Jupiter Prediction** | Primary prediction market source, event and market data, sponsor-signed order generation |
| **Polymarket** | Trader leaderboard data, position history, candlestick price data, copy trading source |
| **Solana** | USDC settlement, transaction signing and confirmation, wallet balance queries |
| **CoinGecko** | SOL/USD price feed |
| **Expo Push** | Push notification delivery |

### Authentication Flow

1. User initiates OAuth via Privy (Twitter/X, Apple, or Google)
2. Privy creates an embedded Solana wallet for the user
3. Backend bootstraps and syncs user data
4. User completes onboarding: link X account, claim username, select interests, follow suggested traders
5. Auth gate enforces routing based on authentication and onboarding completion state

### Trading Flow

1. User selects market and enters trade parameters
2. Frontend requests sponsor-signed order from backend
3. Privy embedded wallet signs the transaction
4. Transaction submitted and confirmed on Solana
5. Trade recorded in backend for position tracking

## Data Models

### User
Privy-linked identity with claimed username, preferences, onboarding state, and push notification tokens.

### Trade
Individual trade record with market reference, side (Yes/No), amount, price, transaction signature, and timestamp.

### Position
Aggregated view by market and side with entry price (weighted average), current value, PnL calculation, and trade count.

### Copy Settings
Configuration for each followed leader including amount per trade, maximum allocation, and active status. Supports both internal Hunch traders and external Polymarket wallets.

## Deployment

### iOS
- Deployment target: iOS 17.5
- Distribution: App Store
- Bundle identifier: `run.hunch.app`
- Features: Apple Sign-In, Passkeys via `hunch.run`

### Android
- Compile SDK: 35
- Distribution: Play Store
- Permissions: POST_NOTIFICATIONS

### Build System
EAS (Expo Application Services) for native builds and OTA updates.

## License

Proprietary - All rights reserved.
