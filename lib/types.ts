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
    status: string; // 'active', 'finalized', 'resolved', 'closed'
    yesMint?: string;
    noMint?: string;
    volume?: number;
    accounts?: {
        yesMint?: string;
        noMint?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface Event {
    ticker: string;
    title: string;
    subtitle?: string;
    markets?: Market[];
}

export interface MarketsResponse {
    markets: Market[];
}

export interface EventsResponse {
    events: Event[];
}
