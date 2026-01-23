import { CandleData, CreateTradeRequest, Event, EventEvidence, EventsResponse, EvidenceResponse, Follow, Market, MarketsResponse, PositionsResponse, Series, SeriesResponse, SyncUserRequest, TagsResponse, Trade, User } from './types';

const API_BASE_URL = 'https://hunchdotrun-roan.vercel.app';
const METADATA_API_BASE_URL = 'https://a.prediction-markets-api.dflow.net';
const DFLOW_API_KEY = process.env.EXPO_PUBLIC_DFLOW_API_KEY || '';

// Log API key status on initialization (not the actual key)
if (!DFLOW_API_KEY) {
    console.warn('[API] ⚠ DFLOW_API_KEY is not set! API calls may fail.');
} else {
    console.log('[API] ✓ DFLOW_API_KEY is configured');
}

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

export const api = {
    // User endpoints
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

    savePreferences: async (userId: string, preferences: { interests?: string[]; habits?: string[]; hasCompletedOnboarding: boolean }): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferences),
        });
        if (!response.ok) {
            const error = await safeJsonParse(response);
            throw new Error(error?.error || 'Failed to save preferences');
        }
        // Success - no need to parse response body
    },

    getUserPreferences: async (userId: string): Promise<{ interests?: string[]; habits?: string[]; hasCompletedOnboarding?: boolean } | null> => {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/preferences`);
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            const error = await response.json();
            throw new Error(error.error || 'Failed to get preferences');
        }
        return response.json();
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

    // Follow endpoints
    followUser: async (followerId: string, followingId: string): Promise<Follow> => {
        const response = await fetch(`${API_BASE_URL}/api/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followerId, followingId }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to follow user');
        }
        return response.json();
    },

    unfollowUser: async (followerId: string, followingId: string): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE_URL}/api/follow`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ followerId, followingId }),
        });
        if (!response.ok) {
            const error = await response.json();
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

    // Trade endpoints
    createTrade: async (data: CreateTradeRequest): Promise<Trade> => {
        const response = await fetch(`${API_BASE_URL}/api/trades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
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

    getPositions: async (userId: string): Promise<PositionsResponse> => {
        const response = await fetch(`${API_BASE_URL}/api/positions?userId=${userId}&includeStats=true`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get positions');
        }
        return response.json();
    },

    updateTradeQuote: async (tradeId: string, quote: string): Promise<Trade> => {
        const response = await fetch(`${API_BASE_URL}/api/trades/${tradeId}/quote`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quote }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update trade quote');
        }
        return response.json();
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
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch evidence');
        }
        const data: EvidenceResponse = await response.json();
        return data.evidence || [];
    },
};

export const marketsApi = {
    // Fetch all markets
    fetchMarkets: async (limit: number = 200): Promise<Market[]> => {
        const response = await fetch(
            `${API_BASE_URL}/api/dflow/markets?limit=${limit}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch markets: ${response.statusText}`);
        }

        const data: MarketsResponse = await response.json();
        return data.markets || [];
    },

    // Fetch tags for category filtering
    fetchTags: async (): Promise<TagsResponse> => {
        const response = await fetch(
            `${API_BASE_URL}/api/dflow/tags`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch tags: ${response.statusText}`);
        }

        return await response.json();
    },

    // Fetch series for a specific category
    fetchSeries: async (
        category: string,
        options?: {
            isInitialized?: boolean;
            status?: string;
        }
    ): Promise<Series[]> => {
        const queryParams = new URLSearchParams();
        queryParams.append('category', category);

        if (options?.isInitialized !== undefined) {
            queryParams.append('isInitialized', options.isInitialized.toString());
        }
        if (options?.status) {
            queryParams.append('status', options.status);
        }

        const response = await fetch(
            `${API_BASE_URL}/api/dflow/series?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch series: ${response.statusText}`);
        }

        const data: SeriesResponse = await response.json();
        return data.series || [];
    },

    // Fetch events with nested markets (supports pagination via cursor)
    fetchEvents: async (
        limit: number = 200,
        options?: {
            status?: string;
            withNestedMarkets?: boolean;
            cursor?: string;
        }
    ): Promise<{ events: Event[]; cursor?: string }> => {
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());

        if (options?.status) {
            queryParams.append('status', options.status);
        }
        if (options?.withNestedMarkets) {
            queryParams.append('withNestedMarkets', 'true');
        }
        if (options?.cursor) {
            queryParams.append('cursor', options.cursor);
        }

        const response = await fetch(
            `${API_BASE_URL}/api/dflow/events?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            let errorMessage = `Failed to fetch events: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = `Failed to fetch events: ${errorData.error || errorData.message || response.statusText}`;
            } catch {
                // If response is not JSON, use status text
            }
            throw new Error(errorMessage);
        }

        const data: EventsResponse = await response.json();
        return { events: data.events || [], cursor: data.cursor ? String(data.cursor) : undefined };
    },

    // Fetch event details
    fetchEventDetails: async (eventTicker: string): Promise<Event> => {
        const response = await fetch(
            `${API_BASE_URL}/api/dflow/event/${eventTicker}?withNestedMarkets=true`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch event details: ${response.statusText}`);
        }

        return await response.json();
    },

    // Fetch market by mint address
    fetchMarketByMint: async (mintAddress: string): Promise<Market> => {
        const response = await fetch(
            `${METADATA_API_BASE_URL}/api/v1/market/by-mint/${mintAddress}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': DFLOW_API_KEY,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch market by mint: ${response.statusText}`);
        }

        return await response.json();
    },

    // Fetch markets batch
    fetchMarketsBatch: async (mints: string[]): Promise<Market[]> => {
        const response = await fetch(
            `${API_BASE_URL}/api/dflow/markets/batch`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mints }),
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch markets batch: ${response.statusText}`);
        }

        const data: MarketsResponse = await response.json();
        return data.markets || [];
    },

    // Fetch events by series
    fetchEventsBySeries: async (
        seriesTickers: string | string[],
        options?: {
            withNestedMarkets?: boolean;
            status?: string;
            limit?: number;
        }
    ): Promise<Event[]> => {
        const queryParams = new URLSearchParams();

        const tickers = Array.isArray(seriesTickers) ? seriesTickers.join(',') : seriesTickers;
        queryParams.append('seriesTickers', tickers);

        if (options?.limit) {
            queryParams.append('limit', options.limit.toString());
        }
        if (options?.status) {
            queryParams.append('status', options.status);
        }
        if (options?.withNestedMarkets) {
            queryParams.append('withNestedMarkets', 'true');
        }

        const response = await fetch(
            `${API_BASE_URL}/api/dflow/events?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch events by series: ${response.statusText}`);
        }

        const data: EventsResponse = await response.json();
        return data.events || [];
    },

    // Filter outcome mints
    filterOutcomeMints: async (addresses: string[]): Promise<string[]> => {
        const response = await fetch(
            `${API_BASE_URL}/api/dflow/filter-outcome-mints`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ addresses }),
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to filter outcome mints: ${response.statusText}`);
        }

        const data = await response.json();
        return data.outcomeMints || [];
    },

    // Fetch market details by ticker
    fetchMarketDetails: async (ticker: string): Promise<Market> => {
        const response = await fetch(
            `${API_BASE_URL}/api/dflow/market/${ticker}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch market details: ${response.statusText}`);
        }

        return await response.json();
    },

    // Fetch candlestick data for charts by market mint address
    fetchCandlesticksByMint: async (
        mintAddress: string,
        options?: {
            startTs?: number;
            endTs?: number;
            periodInterval?: number; // in seconds (60 = 1min, 3600 = 1hr, 86400 = 1day)
        }
    ): Promise<CandleData[]> => {
        const queryParams = new URLSearchParams();
        if (options?.startTs) queryParams.append('startTs', options.startTs.toString());
        if (options?.endTs) queryParams.append('endTs', options.endTs.toString());
        if (options?.periodInterval) queryParams.append('periodInterval', options.periodInterval.toString());

        const url = `${METADATA_API_BASE_URL}/api/v1/market/by-mint/${mintAddress}/candlesticks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

        try {
            console.log(`[fetchCandlesticksByMint] Calling: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': DFLOW_API_KEY,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[fetchCandlesticksByMint] API Error (${response.status}) for mint ${mintAddress}:`, errorText);
                return [];
            }

            const data: any = await response.json();
            console.log(`[fetchCandlesticksByMint] Response for mint ${mintAddress.substring(0, 8)}...:`, {
                hasCandlesticks: !!data.candlesticks,
                count: data.candlesticks?.length || 0,
                firstCandle: data.candlesticks?.[0] || null
            });

            // Validate response structure
            if (!data.candlesticks || !Array.isArray(data.candlesticks)) {
                console.warn(`[fetchCandlesticksByMint] Invalid response structure for mint ${mintAddress}:`, data);
                return [];
            }

            // Transform the API response to match CandleData interface
            // API returns: { candlesticks: [{ end_period_ts, price: { open, high, low, close }, volume }] }
            // We need: { timestamp, open, high, low, close, volume }
            // For null close prices (zero volume periods), carry forward the previous close price
            let lastValidClose: number | null = null;

            const candlesticks = data.candlesticks
                .filter((candle: any) => {
                    // Validate basic candle structure
                    if (!candle.end_period_ts || !candle.price) {
                        console.warn(`[fetchCandlesticksByMint] Invalid candle structure:`, candle);
                        return false;
                    }
                    return true;
                })
                .map((candle: any) => {
                    // Use current close if available, otherwise carry forward from previous candle
                    const currentClose = candle.price.close;
                    let closePrice: number;

                    if (currentClose !== null && currentClose !== undefined) {
                        closePrice = currentClose;
                        lastValidClose = currentClose; // Update last valid close
                    } else if (lastValidClose !== null) {
                        // Use previous valid close price for null periods
                        closePrice = lastValidClose;
                    } else {
                        // Skip this candle if no previous valid close exists yet
                        return null;
                    }

                    return {
                        timestamp: candle.end_period_ts,
                        // Convert from cents to decimal (divide by 100)
                        open: (candle.price.open ?? closePrice) / 100,
                        high: (candle.price.high ?? closePrice) / 100,
                        low: (candle.price.low ?? closePrice) / 100,
                        close: closePrice / 100,
                        volume: candle.volume || 0,
                    };
                })
                .filter((candle: any) => candle !== null); // Remove any null entries

            console.log(`[fetchCandlesticksByMint] Transformed ${candlesticks.length} candles. Price range: ${Math.min(...candlesticks.map((c: CandleData) => c.low)).toFixed(4)} - ${Math.max(...candlesticks.map((c: CandleData) => c.high)).toFixed(4)}`);

            return candlesticks;
        } catch (error) {
            console.error(`[fetchCandlesticksByMint] Error fetching candlesticks for mint ${mintAddress}:`, error);
            return [];
        }
    },
};

// Market details cache to avoid repeated API calls
const marketCache = new Map<string, { data: Market; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
