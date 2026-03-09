// TypeScript types for backend API responses

export interface User {
    id: string;
    privyId: string;
    walletAddress: string;
    displayName: string | null;
    username?: string | null;
    avatarUrl: string | null;
    followerCount: number;
    followingCount: number;
    onboardingStep?: OnboardingStep;
    hasCompletedOnboarding?: boolean;
    walletReady?: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: {
        trades: number;
    };
}

export type OnboardingStep =
    | 'LINK_X'
    | 'USERNAME'
    | 'INTERESTS'
    | 'SUGGESTED_FOLLOWERS'
    | 'COMPLETE';

export interface BootstrapOAuthUserRequest {
    privyId: string;
    provider: 'apple' | 'twitter' | 'google' | string;
    linkedAccounts?: Array<Record<string, any>>;
    username?: string;
    displayName?: string;
}

export interface BootstrapOAuthUserResponse {
    user: User;
    walletReady: boolean;
    onboardingStep: OnboardingStep;
    isNewUser: boolean;
}

export interface UsernameCheckResponse {
    username: string;
    normalizedUsername: string;
    available: boolean;
    reason?: string;
}

export interface Trade {
    id: string;
    userId: string;
    marketTicker: string;
    eventTicker?: string | null;
    conditionId?: string | null;
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
    userId?: string; // Optional - backend derives from auth token
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
    entryPrice?: string;
    isDummy?: boolean;
}

export interface ApiError {
    error: string;
}

// Copy Trading Settings Types
export interface CopySettings {
    id: string;
    followerId: string;
    leaderId: string;
    amountPerTrade: number;
    maxTotalAmount: number;
    spentAmount: number;
    isActive: boolean;
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
    leader?: User;
}

export interface ExternalCopySetting {
    id: string;
    followerId: string;
    externalLeaderId: string;
    amountPerTrade: number;
    maxTotalAmount: number;
    spentAmount?: number;
    enabled: boolean;
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
    externalLeader?: {
        id: string;
        walletAddress: string;
        displayName: string | null;
        avatarUrl: string | null;
        source: string;
        cachedPnl: number | null;
    };
}

export interface CreateExternalCopySettingsRequest {
    externalLeaderId: string;
    amountPerTrade: number;
    maxTotalAmount: number;
}

export interface CreateCopySettingsRequest {
    leaderId: string;
    amountPerTrade: number;
    maxTotalAmount: number;
    expiresAt?: string;
    delegationSignature?: string;
    signedMessage?: string;
}

// Unified copy-leader entry (returned by /api/copy/all-leaders)
interface CopyLeaderBase {
    settingsId: string;
    leaderId: string;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string;
    amountPerTrade: number;
    maxTotalAmount: number;
    usedAmount: number;
    enabled: boolean;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface InternalCopyLeader extends CopyLeaderBase {
    type: 'internal';
}

export interface ExternalCopyLeader extends CopyLeaderBase {
    type: 'external';
    source: string;
    cachedPnl: number | null;
    cachedVolume: number | null;
    autoExecuteOpens: boolean;
    autoExecuteCloses: boolean;
    partialSellThreshold: number;
}

export type CopyLeaderEntry = InternalCopyLeader | ExternalCopyLeader;

export interface AllLeadersResponse {
    leaders: CopyLeaderEntry[];
}

// Auth Error Types
export type AuthErrorCode = 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'USER_NOT_FOUND' | 'DELEGATION_REQUIRED';

export interface AuthError {
    code: AuthErrorCode;
    error: string;
}

// Delegation Status Types (for copy trading)
export interface DelegationStatus {
    hasValidDelegation: boolean;
    signedAt: string | null;
}

// Markets API Types (DFlow External API)
export interface Market {
    marketId?: string;
    ticker: string;
    seriesTicker?: string;
    title: string;
    subtitle?: string;
    status: string; // 'active', 'finalized', 'resolved', 'closed'
    eventId?: string;
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
    colorCode?: string;
    conditionId?: string;
    accounts?: {
        [key: string]: {
            marketLedger?: string;
            yesMint?: string;
            noMint?: string;
            isInitialized?: boolean;
            redemptionStatus?: string | null;
        };
    };
    image_url?: string;
}

export interface SettlementSource {
    name: string;
    url: string;
}

export interface Event {
    eventId?: string;
    ticker: string;
    seriesTicker?: string;
    title: string;
    subtitle?: string;
    category?: string;
    isLive?: boolean;
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

export interface DFlowCandlePricePoint {
    close: number | null;
    high: number | null;
    low: number | null;
    open: number | null;
    previous?: number | null;
}

export interface DFlowCandlestick {
    end_period_ts: number;
    price?: DFlowCandlePricePoint | null;
    volume?: number | null;
}

export interface DFlowCandlesticksResponse {
    candlesticks: DFlowCandlestick[];
    ticker: string;
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

// User Positions from /api/users/:userId/positions
export interface UserPosition {
    marketTicker: string;
    side: 'yes' | 'no';
    netSize: number;
    avgEntryPrice: number;
    tradeCount: number;
    lastTradedAt: string;
    marketTitle: string;
    marketSubtitle: string;
    imageUrl: string | null;
    colorCode: string | null;
    currentPrice: number | null;
    enteredAmount: number;
    realizedPnl: number | null;
    unrealizedPnl: number | null;
    totalPnl: number | null;
    pnlPercent: number | null;
    isClosed: boolean;
}

export interface UserPositionsResponse {
    positions: UserPosition[];
    previousPositions: UserPosition[];
}

// Post Types
export interface Post {
    id: string;
    userId: string;
    content: string | null;
    postType: 'text' | 'position_share';
    marketTicker: string | null;
    side: 'yes' | 'no' | null;
    positionSize: number | null;
    entryPrice: number | null;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        walletAddress: string;
    };
}

export interface CreatePostRequest {
    content?: string;
    postType: 'text' | 'position_share';
    marketTicker?: string;
    side?: 'yes' | 'no';
    positionSize?: number;
    entryPrice?: number;
}

// Jupiter prediction API response types
export interface JupiterPredictionEventListResponse {
    data: any[];
    pagination?: {
        start: number;
        end: number;
        total: number;
        hasNext: boolean;
    };
}

export interface JupiterPredictionOrderResponse {
    transaction: string | null;
    txMeta: {
        blockhash: string;
        lastValidBlockHeight: number;
    } | null;
    externalOrderId: string | null;
    order: {
        orderPubkey?: string;
        positionPubkey?: string;
        marketId: string;
        isBuy: boolean;
        isYes: boolean;
        contracts?: string;
        newContracts?: string;
        orderCostUsd?: string;
        newSizeUsd?: string;
    };
}

// ============================================
// Polymarket Leaderboard Types
// ============================================

export type LeaderboardCategory =
    | 'OVERALL'
    | 'POLITICS'
    | 'SPORTS'
    | 'CRYPTO'
    | 'CULTURE'
    | 'MENTIONS'
    | 'WEATHER'
    | 'ECONOMICS'
    | 'TECH'
    | 'FINANCE';

export type LeaderboardTimePeriod = 'DAY' | 'WEEK' | 'MONTH' | 'ALL';

export type LeaderboardOrderBy = 'PNL' | 'VOL';

export interface PolymarketTrader {
    rank: string;
    proxyWallet: string;
    userName: string;
    vol: number;
    pnl: number;
    profileImage: string | null;
    xUsername: string | null;
    verifiedBadge: boolean;
}

export interface LeaderboardResponse {
    traders: PolymarketTrader[];
    category: LeaderboardCategory;
    timePeriod: LeaderboardTimePeriod;
    orderBy: LeaderboardOrderBy;
}

export interface LeaderboardParams {
    category?: LeaderboardCategory;
    timePeriod?: LeaderboardTimePeriod;
    orderBy?: LeaderboardOrderBy;
    limit?: number;
    offset?: number;
    user?: string;
    userName?: string;
}

// ============================================
// Unified Profile Types
// ============================================

export type ProfileType = 'hunch' | 'external';

export interface HunchProfile {
    profileType: 'hunch';
    id: string;
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
    username: string | null;
    hasCompletedOnboarding: boolean;
    privyId: string;
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
    isOwnProfile: boolean;
}

export interface ExternalProfile {
    profileType: 'external';
    id: string;
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
    source: string;
    xUsername: string | null;
    verifiedBadge: boolean;
    bio: string | null;
    cachedPnl: number | null;
    cachedVolume: number | null;
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
    isOwnProfile: boolean;
}

export type UnifiedProfile = HunchProfile | ExternalProfile;

export interface UnifiedProfileResponse {
    profile: UnifiedProfile;
}

// ============================================
// Polymarket Positions Types
// ============================================

export interface PolymarketPosition {
    proxyWallet: string;
    asset: string;
    conditionId: string;
    size: number;
    avgPrice: number;
    initialValue: number;
    currentValue: number;
    cashPnl: number;
    percentPnl: number;
    totalBought: number;
    realizedPnl: number;
    percentRealizedPnl: number;
    curPrice: number;
    redeemable: boolean;
    mergeable: boolean;
    title: string;
    slug: string;
    icon: string;
    eventSlug: string;
    outcome: string;
    outcomeIndex: number;
    oppositeOutcome: string;
    oppositeAsset: string;
    endDate: string;
    negativeRisk: boolean;
}

export interface PolymarketPositionsResponse {
    positions: PolymarketPosition[];
    user: string;
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}

export interface PolymarketPositionsParams {
    user: string;
    market?: string;
    eventId?: string;
    sizeThreshold?: number;
    redeemable?: boolean;
    mergeable?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'CURRENT' | 'INITIAL' | 'TOKENS' | 'CASHPNL' | 'PERCENTPNL' | 'TITLE' | 'RESOLVING' | 'PRICE' | 'AVGPRICE';
    sortDirection?: 'ASC' | 'DESC';
}

export interface PolymarketClosedPosition {
    proxyWallet: string;
    asset: string;
    conditionId: string;
    avgPrice: number;
    totalBought: number;
    realizedPnl: number;
    curPrice: number;
    timestamp: number;
    title: string;
    slug: string;
    icon: string;
    eventSlug: string;
    outcome: string;
    outcomeIndex: number;
    oppositeOutcome: string;
    oppositeAsset: string;
    endDate: string;
}

export interface PolymarketClosedPositionsResponse {
    positions: PolymarketClosedPosition[];
    user: string;
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}

export interface PolymarketClosedPositionsParams {
    user: string;
    market?: string;
    eventId?: string;
    title?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'REALIZEDPNL' | 'TITLE' | 'PRICE' | 'AVGPRICE' | 'TIMESTAMP';
    sortDirection?: 'ASC' | 'DESC';
}

// ============================================
// Extended Follow Types for External Profiles
// ============================================

export interface ExternalFollowRelationship {
    id: string;
    followerId: string;
    externalProfileId: string;
    createdAt: string;
    profileType: 'external';
    follower: {
        id: string;
        displayName: string | null;
        avatarUrl: string | null;
        walletAddress: string;
    };
    externalProfile: {
        id: string;
        walletAddress: string;
        displayName: string | null;
        avatarUrl: string | null;
        source: string;
        xUsername: string | null;
        verifiedBadge: boolean;
    };
}

export interface HunchFollowRelationship extends Follow {
    profileType: 'hunch';
}

export type UnifiedFollowRelationship = HunchFollowRelationship | ExternalFollowRelationship;

export interface FollowExternalRequest {
    walletAddress: string;
    source?: string;
}

export interface UnfollowExternalRequest {
    walletAddress: string;
}

// New unified following/followers API response types
export interface FollowingItem {
    id: string;
    profileType: 'hunch' | 'external';
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
    userId?: string;
    externalProfileId?: string;
    source?: string;
    xUsername?: string | null;
    verifiedBadge?: boolean;
}

export interface FollowingResponse {
    following: FollowingItem[];
    counts: {
        total: number;
        hunchUsers: number;
        externalProfiles: number;
    };
}

export interface FollowerItem {
    id: string;
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
}

export interface FollowersResponse {
    followers: FollowerItem[];
    profileType?: string;
    walletAddress?: string;
    count: number;
}

// ============================================
// External Trade Feed Types
// ============================================

export interface ExternalTradeTrader {
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
    xUsername: string | null;
    verifiedBadge: boolean;
    followerCount?: number;
    cachedPnl?: number | null;
    isFollowing?: boolean;
}

export interface ExternalTrade {
    id: string;
    trader: ExternalTradeTrader;
    conditionId: string;
    marketTitle: string;
    outcome: string;
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    usdcAmount: number;
    timestamp: string;
    transactionHash: string | null;
}

export interface ExternalTradeFeedResponse {
    trades: ExternalTrade[];
    total: number;
}
