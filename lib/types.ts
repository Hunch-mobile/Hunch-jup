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
    side: 'yes' | 'no';
    amount: string;
    transactionSig: string;
    createdAt: string;
    user?: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        walletAddress: string;
    };
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
}

export interface CreateTradeRequest {
    userId: string;
    marketTicker: string;
    side: 'yes' | 'no';
    amount: string;
    transactionSig: string;
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
