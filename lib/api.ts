import { AuthError, BootstrapOAuthUserRequest, BootstrapOAuthUserResponse, CandleData, CopySettings, CreateCopySettingsRequest, CreateTradeRequest, DelegationStatus, Event, EventEvidence, EvidenceResponse, Follow, Market, OnboardingStep, PositionsResponse, Series, SyncUserRequest, TagsResponse, Trade, User, UsernameCheckResponse } from './types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://hunchdotrun-roan.vercel.app';
const JUPITER_PREDICTION_BASE_PATH = `${API_BASE_URL}/api/jupiter-prediction`;

// Auth token getter - must be set by the app before making authenticated calls
let _getAccessToken: (() => Promise<string | null>) | null = null;

export const setAccessTokenGetter = (getter: () => Promise<string | null>) => {
    _getAccessToken = getter;
};

// Helper to safely parse JSON responses
const safeJsonParse = async (response: Response) => {
    const text = await response.text();
    if (!text || text.trim() === '') {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

// Check if error is an auth error
const isAuthError = (error: any): error is AuthError => {
    return error?.code && ['MISSING_TOKEN', 'INVALID_TOKEN', 'USER_NOT_FOUND', 'DELEGATION_REQUIRED'].includes(error.code);
};

// Authenticated fetch helper - auto-injects Privy JWT
// Exported for use in other service files (e.g. tradeService.ts)
export const authenticatedFetch = async (
    url: string,
    options: RequestInit = {}
): Promise<Response> => {
    if (!_getAccessToken) {
        // Auth not initialized yet - treat as missing token
        const error: AuthError = { code: 'MISSING_TOKEN', error: 'Authentication not initialized' };
        throw error;
    }

    const accessToken = await _getAccessToken();
    if (!accessToken) {
        const error: AuthError = { code: 'MISSING_TOKEN', error: 'No access token available' };
        throw error;
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    return fetch(url, {
        ...options,
        headers,
    });
};

export const api = {
    // User endpoints
    bootstrapOAuthUser: async (data: BootstrapOAuthUserRequest): Promise<BootstrapOAuthUserResponse> => {
        const response = await fetch(`${API_BASE_URL}/api/auth/bootstrap-oauth-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to bootstrap OAuth user');
        }
        const result = await safeJsonParse(response);
        return result as BootstrapOAuthUserResponse;
    },

    syncUser: async (data: SyncUserRequest): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/api/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to sync user');
        }
        const result = await safeJsonParse(response);
        return result as User;
    },

    getUser: async (userId: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`);
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to get user');
        }
        return response.json();
    },

    registerPushToken: async (expoPushToken: string): Promise<void> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/users/push-token`, {
            method: 'POST',
            body: JSON.stringify({ expoPushToken }),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to register push token');
        }
    },

    removePushToken: async (): Promise<void> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/users/push-token`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to remove push token');
        }
    },

    savePreferences: async (userId: string, preferences: { interests?: string[]; habits?: string[]; hasCompletedOnboarding: boolean }): Promise<void> => {
        // Transform to backend format: {preferences: [...]}
        const body = {
            preferences: preferences.interests || [],
        };
        const response = await authenticatedFetch(`${API_BASE_URL}/api/users/${userId}/preferences`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to save preferences');
        }
        // Success - no need to parse response body
    },

    getUserPreferences: async (userId: string): Promise<{ interests?: string[]; habits?: string[]; hasCompletedOnboarding?: boolean } | null> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/users/${userId}/preferences`);
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to get preferences');
        }
        const result = await safeJsonParse(response);
        if (!result) {
            return null;
        }
        return result as { interests?: string[]; habits?: string[]; hasCompletedOnboarding?: boolean };
    },

    getTopUsers: async (sortBy: 'followers' | 'trades' = 'followers', limit: number = 4): Promise<User[]> => {
        const response = await fetch(`${API_BASE_URL}/api/users/top?sortBy=${sortBy}&limit=${limit}`);
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to get top users');
        }
        const result = await safeJsonParse(response);
        return result || [];
    },

    searchUsers: async (query: string): Promise<User[]> => {
        const response = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to search users');
        }
        return response.json();
    },

    checkUsernameAvailability: async (username: string): Promise<UsernameCheckResponse> => {
        const response = await fetch(`${API_BASE_URL}/api/users/username/check?username=${encodeURIComponent(username)}`);
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to check username availability');
        }
        const result = await safeJsonParse(response);
        return result as UsernameCheckResponse;
    },

    claimUsername: async (username: string): Promise<User> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/users/username/claim`, {
            method: 'POST',
            body: JSON.stringify({ username }),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            if (isAuthError(error)) throw error;
            throw new Error(error?.error || 'Failed to claim username');
        }
        const result = await safeJsonParse(response);
        return result as User;
    },

    saveOnboardingProgress: async (data: { step?: OnboardingStep; completed?: boolean; currentStep?: OnboardingStep }): Promise<{ onboardingStep?: OnboardingStep; hasCompletedOnboarding?: boolean }> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/users/onboarding/progress`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            if (isAuthError(error)) throw error;
            throw new Error(error?.error || 'Failed to save onboarding progress');
        }
        const result = await safeJsonParse(response);
        return (result || {}) as { onboardingStep?: OnboardingStep; hasCompletedOnboarding?: boolean };
    },

    // Follow endpoints (authenticated - followerId derived from JWT token)
    followUser: async (followingId: string): Promise<Follow> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/follow`, {
            method: 'POST',
            body: JSON.stringify({ followingId }),
        });
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to follow user');
        }
        return response.json();
    },

    unfollowUser: async (followingId: string): Promise<{ success: boolean }> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/follow`, {
            method: 'DELETE',
            body: JSON.stringify({ followingId }),
        });
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to unfollow user');
        }
        return response.json();
    },

    getFollowing: async (userId: string): Promise<Follow[]> => {
        const response = await fetch(`${API_BASE_URL}/api/follow/following?userId=${userId}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get following');
        }
        return response.json();
    },

    getFollowers: async (userId: string): Promise<Follow[]> => {
        const response = await fetch(`${API_BASE_URL}/api/follow/followers?userId=${userId}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get followers');
        }
        return response.json();
    },

    // Trade endpoints (authenticated - userId derived from JWT token)
    createTrade: async (data: CreateTradeRequest): Promise<Trade> => {
        // Remove userId from body - backend derives from auth token
        const { userId, ...tradeData } = data;
        const response = await authenticatedFetch(`${API_BASE_URL}/api/trades`, {
            method: 'POST',
            body: JSON.stringify(tradeData),
        });
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to create trade');
        }
        return response.json();
    },

    getUserTrades: async (userId: string, limit = 50, offset = 0): Promise<Trade[]> => {
        const response = await fetch(`${API_BASE_URL}/api/trades?userId=${userId}&limit=${limit}&offset=${offset}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get trades');
        }
        return response.json();
    },

    getTrade: async (tradeId: string): Promise<Trade | null> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/trades/${tradeId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to get trade');
        }
        const result = await safeJsonParse(response);
        return result as Trade | null;
    },

    getPositions: async (userId: string): Promise<PositionsResponse> => {
        const response = await fetch(`${API_BASE_URL}/api/positions?userId=${userId}&includeStats=true`);
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error((error as any)?.error || 'Failed to get positions');
        }
        const result = await safeJsonParse(response);
        if (!result) {
            throw new Error('Failed to get positions');
        }
        return result as PositionsResponse;
    },

    updateTradeQuote: async (tradeId: string, quote: string): Promise<Trade | null> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/trades`, {
            method: 'PATCH',
            body: JSON.stringify({ tradeId, quote }),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to update trade quote');
        }
        // Handle empty responses (204 No Content or empty body)
        const result = await safeJsonParse(response);
        return result as Trade | null;
    },

    // Feed endpoint
    getFeed: async ({
        userId,
        mode = 'following',
        limit = 50,
        offset = 0,
    }: {
        userId?: string;
        mode?: 'following' | 'global';
        limit?: number;
        offset?: number;
    }): Promise<Trade[]> => {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            mode,
        });
        if (userId && mode === 'following') {
            params.append('userId', userId);
        }
        const url = `${API_BASE_URL}/api/feed?${params.toString()}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(url, { signal: controller.signal }).finally(() => {
            clearTimeout(timeoutId);
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get feed');
        }
        return response.json();
    },

    // Fetch event evidence (news signals)
    fetchEvidence: async (eventTickers: string[]): Promise<EventEvidence[]> => {
        const tickersParam = eventTickers.join(',');
        const response = await fetch(`${API_BASE_URL}/api/events/evidence?eventTickers=${encodeURIComponent(tickersParam)}`);
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error((error as any)?.error || 'Failed to fetch evidence');
        }
        const data = (await safeJsonParse(response)) as EvidenceResponse | null;
        if (!data) {
            return [];
        }
        return data.evidence || [];
    },

    // Delegation Status endpoint (authenticated)
    getDelegationStatus: async (): Promise<DelegationStatus> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/users/delegation-status`, {
            method: 'GET',
        });
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to get delegation status');
        }
        return response.json();
    },

    // Copy Trading Settings endpoints (authenticated)
    createCopySettings: async (settings: CreateCopySettingsRequest): Promise<CopySettings> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/copy-settings`, {
            method: 'POST',
            body: JSON.stringify(settings),
        });
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to create copy settings');
        }
        return response.json();
    },

    getCopySettings: async (leaderId?: string): Promise<CopySettings[]> => {
        const url = leaderId
            ? `${API_BASE_URL}/api/copy-settings?leaderId=${leaderId}`
            : `${API_BASE_URL}/api/copy-settings`;
        const response = await authenticatedFetch(url, {
            method: 'GET',
        });
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to get copy settings');
        }
        const data = await response.json();
        // API returns single object when leaderId specified, array when not
        return Array.isArray(data) ? data : [data];
    },

    deleteCopySettings: async (leaderId: string): Promise<{ success: boolean }> => {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/copy-settings`, {
            method: 'DELETE',
            body: JSON.stringify({ leaderId }),
        });
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to delete copy settings');
        }
        return response.json();
    },

    updateCopySettings: async (
        followerId: string,
        leaderId: string,
        action: 'toggle'
    ): Promise<CopySettings> => {
        const response = await authenticatedFetch(
            `${API_BASE_URL}/api/copy-settings/${followerId}/${leaderId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ action }),
            }
        );
        if (!response.ok) {
            const error = await response.json();
            if (isAuthError(error)) throw error;
            throw new Error(error.error || 'Failed to update copy settings');
        }
        return response.json();
    },
};

const toNumberSafe = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
};

const microUsdToUnitPrice = (value: unknown): number | null => {
    const n = toNumberSafe(value);
    if (n === null) return null;
    return n / 1_000_000;
};

const toUnixSeconds = (value: unknown): number | undefined => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return undefined;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
};

type EventsResult = { events: Event[]; cursor?: string };
const EVENTS_REQUEST_CACHE_DURATION = 20 * 1000; // 20 seconds
const eventsRequestCache = new Map<string, { data: EventsResult; timestamp: number }>();
type HomeFeedResult = {
    events: Event[];
    topMarkets: Market[];
    cursor?: string;
    metadata?: { totalEvents: number; hasMore: boolean };
};
const HOME_FEED_REQUEST_CACHE_DURATION = 20 * 1000; // 20 seconds
const homeFeedRequestCache = new Map<string, { data: HomeFeedResult; timestamp: number }>();
const homeFeedInFlightRequests = new Map<string, Promise<HomeFeedResult>>();

const mapJupiterMarketToMarket = (market: any, eventId?: string): Market => {
    const buyYes = microUsdToUnitPrice(market?.pricing?.buyYesPriceUsd);
    const sellYes = microUsdToUnitPrice(market?.pricing?.sellYesPriceUsd);
    const buyNo = microUsdToUnitPrice(market?.pricing?.buyNoPriceUsd);
    const sellNo = microUsdToUnitPrice(market?.pricing?.sellNoPriceUsd);

    const rawStatus = String(market?.status || '').toLowerCase();
    const normalizedStatus =
        rawStatus === 'open' || rawStatus === 'live'
            ? 'active'
            : rawStatus || 'active';

    return {
        ticker: market?.marketId || '',
        eventTicker: eventId || market?.eventId,
        title: market?.metadata?.title || market?.marketTitle || market?.title || market?.marketId || 'Market',
        subtitle: market?.metadata?.subtitle || market?.eventTitle || '',
        status: normalizedStatus,
        yesSubTitle: market?.metadata?.title || market?.marketTitle,
        noSubTitle: market?.metadata?.subtitle,
        openTime: market?.openTime ?? market?.metadata?.openTime,
        closeTime: market?.closeTime ?? market?.metadata?.closeTime,
        volume: toNumberSafe(market?.pricing?.volume) ?? undefined,
        openInterest: toNumberSafe(market?.pricing?.openInterest) ?? undefined,
        result: market?.result || undefined,
        rulesPrimary: market?.metadata?.rulesPrimary || undefined,
        rulesSecondary: market?.metadata?.rulesSecondary || undefined,
        yesBid: sellYes !== null ? String(sellYes) : null,
        yesAsk: buyYes !== null ? String(buyYes) : null,
        noBid: sellNo !== null ? String(sellNo) : null,
        noAsk: buyNo !== null ? String(buyNo) : null,
        image_url:
            market?.image_url ||
            market?.eventImageUrl ||
            market?.featured_image_url ||
            undefined,
    };
};

const mapJupiterEventToEvent = (event: any): Event => {
    const eventImage =
        event?.metadata?.imageUrl ||
        event?.image_url ||
        event?.featured_image_url ||
        undefined;

    const mappedMarkets: Market[] = Array.isArray(event?.markets)
        ? event.markets.map((m: any) => mapJupiterMarketToMarket(m, event?.eventId))
        : [];

    const volumeUsd = toNumberSafe(event?.volumeUsd);
    return {
        ticker: event?.eventId || '',
        title: event?.metadata?.title || event?.eventId || 'Event',
        subtitle: event?.metadata?.subtitle || '',
        imageUrl: eventImage,
        category: event?.category || undefined,
        markets: mappedMarkets,
        closeTime: toUnixSeconds(event?.metadata?.closeTime),
        volume: volumeUsd !== null ? volumeUsd / 1_000_000 : undefined,
    } as Event;
};

export const marketsApi = {
    fetchMarkets: async (limit: number = 200): Promise<Market[]> => {
        const { events } = await marketsApi.fetchEvents(limit, { withNestedMarkets: true });
        return events.flatMap((event) => event.markets || []);
    },

    fetchTags: async (): Promise<TagsResponse> => {
        // Jupiter prediction API does not expose tags/categories endpoint.
        return { tagsByCategories: {} };
    },

    fetchSeries: async (): Promise<Series[]> => {
        // Jupiter prediction API does not expose a series endpoint.
        return [];
    },

    fetchEvents: async (
        limit: number = 200,
        options?: {
            status?: string;
            withNestedMarkets?: boolean;
            includeMarkets?: boolean;
            cursor?: string;
            provider?: string;
            category?: string;
            sortBy?: string;
            sortDirection?: 'asc' | 'desc';
            filter?: string;
        }
    ): Promise<EventsResult> => {
        const parsedCursor = Number(options?.cursor ?? '0');
        const start = Number.isFinite(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;
        const pageSize = Math.max(1, limit);
        const end = start + pageSize - 1;
        const params = new URLSearchParams({
            start: String(start),
            end: String(end),
        });

        if (options?.withNestedMarkets || options?.includeMarkets) params.append('includeMarkets', 'true');
        if (options?.status === 'active' && !options?.filter) params.append('filter', 'live');
        if (options?.provider) params.append('provider', options.provider);
        if (options?.category) params.append('category', options.category);
        if (options?.sortBy) params.append('sortBy', options.sortBy);
        if (options?.sortDirection) params.append('sortDirection', options.sortDirection);
        if (options?.filter) params.append('filter', options.filter);

        const requestUrl = `${JUPITER_PREDICTION_BASE_PATH}/events?${params.toString()}`;
        const now = Date.now();
        const cached = eventsRequestCache.get(requestUrl);
        if (cached && now - cached.timestamp < EVENTS_REQUEST_CACHE_DURATION) {
            return cached.data;
        }

        const response = await fetch(requestUrl);
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || `Failed to fetch events: ${response.statusText}`);
        }

        const payload = (await safeJsonParse(response)) as any;
        const data = Array.isArray(payload?.data) ? payload.data : [];
        const events = data.map(mapJupiterEventToEvent);
        const pagination = payload?.pagination;
        const nextCursor = pagination?.hasNext ? String(end + 1) : undefined;
        const result = { events, cursor: nextCursor };

        eventsRequestCache.set(requestUrl, { data: result, timestamp: now });
        if (eventsRequestCache.size > 20) {
            for (const [key, value] of eventsRequestCache) {
                if (now - value.timestamp >= EVENTS_REQUEST_CACHE_DURATION) {
                    eventsRequestCache.delete(key);
                }
            }
        }
        indexMappedEvents(events);

        return result;
    },

    fetchEventDetails: async (eventTicker: string): Promise<Event> => {
        const now = Date.now();
        const cached = eventCache.get(eventTicker);
        if (cached && now - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }

        // Use only /events endpoint (includeMarkets=true) for event+market data.
        const { events } = await marketsApi.fetchEvents(200, { includeMarkets: true });
        const matchedEvent = events.find((event) => event.ticker === eventTicker);
        if (!matchedEvent) {
            throw new Error(`Failed to fetch event details: event not found for ${eventTicker}`);
        }
        return matchedEvent;
    },

    fetchMarketByMint: async (): Promise<Market> => {
        throw new Error('Market-by-mint is not supported by Jupiter prediction API');
    },

    fetchMarketsBatch: async (): Promise<Market[]> => {
        return [];
    },

    fetchEventsBySeries: async (
        _seriesTickers: string | string[],
        options?: {
            withNestedMarkets?: boolean;
            status?: string;
            limit?: number;
        }
    ): Promise<Event[]> => {
        const { events } = await marketsApi.fetchEvents(options?.limit || 100, {
            withNestedMarkets: options?.withNestedMarkets,
            status: options?.status,
        });
        return events;
    },

    fetchHomeFeed: async (
        limit: number = 20,
        cursor?: string,
        category?: string
    ): Promise<HomeFeedResult> => {
        const pageSize = Math.max(1, limit);
        const parsedCursor = Number(cursor ?? '0');
        const start = Number.isFinite(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;
        const end = start + pageSize - 1;

        const params = new URLSearchParams({
            start: String(start),
            end: String(end),
        });
        if (category && category !== 'all') {
            params.append('category', category);
        }

        const requestUrl = `${API_BASE_URL}/api/home/feed?${params.toString()}`;
        const now = Date.now();
        const cached = homeFeedRequestCache.get(requestUrl);
        if (cached && now - cached.timestamp < HOME_FEED_REQUEST_CACHE_DURATION) {
            return cached.data;
        }

        const existingRequest = homeFeedInFlightRequests.get(requestUrl);
        if (existingRequest) {
            return existingRequest;
        }

        const requestPromise = (async () => {
            const response = await fetch(requestUrl);
            if (!response.ok) {
                const error = await safeJsonParse(response);
                throw new Error(error?.error || `Failed to fetch home feed: ${response.statusText}`);
            }

            const payload = (await safeJsonParse(response)) as any;
            const eventData = Array.isArray(payload?.events)
                ? payload.events
                : Array.isArray(payload?.data?.events)
                    ? payload.data.events
                    : [];
            const topMarketsData = Array.isArray(payload?.topMarkets)
                ? payload.topMarkets
                : Array.isArray(payload?.data?.topMarkets)
                    ? payload.data.topMarkets
                    : [];
            const pagination = payload?.pagination || payload?.data?.pagination;
            const hasMore = Boolean(pagination?.hasNext);
            const nextCursor = hasMore ? String(start + pageSize) : undefined;

            const events = eventData.map(mapJupiterEventToEvent);
            const topMarkets = topMarketsData.map((market: any) =>
                mapJupiterMarketToMarket(market, market?.eventId)
            );
            indexMappedEvents(events);
            for (const market of topMarkets) {
                if (market.ticker) {
                    marketCache.set(market.ticker, { data: market, timestamp: Date.now() });
                }
            }

            const result: HomeFeedResult = {
                events,
                topMarkets,
                cursor: nextCursor,
                metadata: {
                    totalEvents: Number(pagination?.total) || events.length,
                    hasMore,
                },
            };

            homeFeedRequestCache.set(requestUrl, { data: result, timestamp: now });
            if (homeFeedRequestCache.size > 40) {
                for (const [key, value] of homeFeedRequestCache) {
                    if (now - value.timestamp >= HOME_FEED_REQUEST_CACHE_DURATION) {
                        homeFeedRequestCache.delete(key);
                    }
                }
            }

            return result;
        })();

        homeFeedInFlightRequests.set(requestUrl, requestPromise);
        try {
            return await requestPromise;
        } finally {
            homeFeedInFlightRequests.delete(requestUrl);
        }
    },

    filterOutcomeMints: async (): Promise<string[]> => {
        return [];
    },

    fetchMarketDetails: async (ticker: string): Promise<Market> => {
        const now = Date.now();
        const cachedMarket = marketCache.get(ticker);
        if (cachedMarket && now - cachedMarket.timestamp < CACHE_DURATION) {
            return cachedMarket.data;
        }

        // Search recently-cached event details before fetching another large page.
        for (const { data: cachedEvent, timestamp } of eventCache.values()) {
            if (now - timestamp >= CACHE_DURATION) continue;
            const existingMarket = cachedEvent.markets?.find((m) => m.ticker === ticker);
            if (existingMarket) {
                marketCache.set(ticker, { data: existingMarket, timestamp: now });
                return existingMarket;
            }
        }

        const { events } = await marketsApi.fetchEvents(200, { includeMarkets: true });
        for (const event of events) {
            const market = event.markets?.find((m) => m.ticker === ticker);
            if (market) return market;
        }

        throw new Error(`Market not found for id: ${ticker}`);
    },

    fetchCandlesticksByMint: async (): Promise<CandleData[]> => {
        // No candlestick endpoint in current Jupiter API surface.
        return [];
    },
};

// Market details cache to avoid repeated API calls
const marketCache = new Map<string, { data: Market; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const indexMappedEvents = (events: Event[]): void => {
    const now = Date.now();
    for (const event of events) {
        if (event.ticker) {
            eventCache.set(event.ticker, { data: event, timestamp: now });
        }
        for (const market of event.markets || []) {
            if (market.ticker) {
                marketCache.set(market.ticker, { data: market, timestamp: now });
            }
        }
    }
};

export const getMarketDetails = async (ticker: string): Promise<Market | null> => {
    try {
        // Check cache first
        const cached = marketCache.get(ticker);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }

        // Fetch fresh data
        const market = await marketsApi.fetchMarketDetails(ticker);
        marketCache.set(ticker, { data: market, timestamp: Date.now() });
        return market;
    } catch (error) {
        console.error(`Failed to fetch market details for ${ticker}:`, error);
        return null;
    }
};

// Event details cache to avoid repeated API calls
const eventCache = new Map<string, { data: Event; timestamp: number }>();

export const getEventDetails = async (eventTicker: string): Promise<Event | null> => {
    try {
        // Check cache first
        const cached = eventCache.get(eventTicker);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }

        // Fetch fresh data
        const event = await marketsApi.fetchEventDetails(eventTicker);
        eventCache.set(eventTicker, { data: event, timestamp: Date.now() });
        return event;
    } catch (error) {
        console.error(`Failed to fetch event details for ${eventTicker}:`, error);
        return null;
    }
};
