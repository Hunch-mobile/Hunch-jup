// TypeScript types for backend API responses

export interface User {
    id: string;
    privyId: string;
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
    followerCount: number;
    followingCount: number;
    createdAt: string;
    updatedAt: string;
    _count?: {
        trades: number;
    };
}

export interface Trade {
    id: string;
    userId: string;
    marketTicker: string;
    eventTicker?: string | null;
    side: 'yes' | 'no';
    action?: 'BUY' | 'SELL';
    amount: string;
    transactionSig: string;
    quote?: string | null;
    isDummy?: boolean;
    createdAt: string;
    user?: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        walletAddress: string;
    };
}

export interface TradeWithDetails extends Trade {
    market?: Market | null;
    event?: Event | null;
}

export interface AggregatedPosition {
    marketTicker: string;
    eventTicker: string | null;
    side: 'yes' | 'no';
    totalTokenAmount: number;
    totalUsdcAmount: number;
    averageEntryPrice: number;
    currentPrice: number | null;
    currentValue: number | null;
    profitLoss: number | null;
    profitLossPercentage: number | null;
    tradeCount: number;
    market: Market | null;
    eventImageUrl: string | null;
    trades: TradeWithDetails[];
    totalCostBasis: number;
    totalTokensBought: number;
    totalTokensSold: number;
    totalSellProceeds: number;
    realizedPnL: number;
    unrealizedPnL: number | null;
    totalPnL: number | null;
    positionStatus: 'OPEN' | 'CLOSED' | 'PARTIALLY_CLOSED';
}

export interface PositionStats {
    [key: string]: number | null;
}

export interface PositionsResponse {
    positions: {
        active: AggregatedPosition[];
        previous: AggregatedPosition[];
    };
    stats: PositionStats | null;
}

export interface Follow {
    id: string;
    followerId: string;
    followingId: string;
    createdAt: string;
    follower: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        walletAddress: string;
    };
    following: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        walletAddress: string;
    };
}

export interface SyncUserRequest {
    privyId: string;
    walletAddress: string;
    displayName?: string;
    avatarUrl?: string;
    preferences?: string[];
}

export interface CreateTradeRequest {
    userId: string;
    marketTicker: string;
    eventTicker?: string;
    side: 'yes' | 'no';
    action?: 'BUY' | 'SELL';
    amount: string;
    quote?: string;
    walletAddress?: string;
    transactionSig?: string;
    executedInAmount?: string;  // Raw amount of tokens/USDC sent
    executedOutAmount?: string; // Raw amount of tokens/USDC received
    isDummy?: boolean;
}

export interface ApiError {
    error: string;
}

// Markets API Types (DFlow External API)
export interface Market {
    ticker: string;
    title: string;
    subtitle?: string;
    status: string; // 'active', 'finalized', 'resolved', 'closed'
    eventTicker?: string;
    marketType?: string;
    yesSubTitle?: string;
    noSubTitle?: string;
    openTime?: number;
    closeTime?: number;
    expirationTime?: number;
    volume?: number;
    openInterest?: number;
    result?: string;
    canCloseEarly?: boolean;
    earlyCloseCondition?: string;
    rulesPrimary?: string;
    rulesSecondary?: string;
    yesBid?: string | null;
    yesAsk?: string | null;
    noBid?: string | null;
    noAsk?: string | null;
    yesMint?: string;
    noMint?: string;
    accounts?: {
        [key: string]: {
            marketLedger?: string;
            yesMint?: string;
            noMint?: string;
            isInitialized?: boolean;
            redemptionStatus?: string | null;
        };
    };
}

export interface SettlementSource {
    name: string;
    url: string;
}

export interface Event {
    ticker: string;
    seriesTicker?: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    competition?: string;
    competitionScope?: string;
    strikeDate?: number | null;
    strikePeriod?: string | null;
    volume?: number;
    volume24h?: number;
    liquidity?: number;
    openInterest?: number;
    closeTime?: number;
    settlementSources?: SettlementSource[] | any;
    markets?: Market[];
}

export interface MarketsResponse {
    markets: Market[];
}

export interface EventsResponse {
    events: Event[];
    cursor?: number;
}

// Candlestick chart data types
export interface CandleData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface CandlesResponse {
    candles: CandleData[];
    marketTicker: string;
    resolution: string;
}

export interface CandlesticksByMintResponse {
    candlesticks: CandleData[];
    ticker: string;
}

// Event Evidence Types (News/Signals)
export interface EventEvidence {
    id: string;
    eventTicker: string;
    marketTicker: string;
    marketQuestion: string;
    evidenceSentence: string;
    highlightScore: number;
    classification: 'CONFIRMATION' | 'REQUIREMENT' | 'DELAY' | 'RISK' | 'NONE';
    headline?: string | null;
    explanation?: string | null;
    sourceUrls: string[];  // Array of source URLs
    sourceTitle?: string | null;
    sourcePublishedAt?: string | null;
    createdAt: string;
    updatedAt?: string;
}

export interface EvidenceResponse {
    evidence: EventEvidence[];
}

// Tags and Series Types (for category filtering)
export interface TagsResponse {
    tagsByCategories: Record<string, string[]>;
}

export interface Series {
    ticker: string;
    title: string;
    category: string;
    tags?: string[];
    status?: string;
}

export interface SeriesResponse {
    series: Series[];
}
