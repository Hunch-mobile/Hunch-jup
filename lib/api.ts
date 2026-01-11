import { CreateTradeRequest, Event, EventsResponse, Follow, Market, MarketsResponse, SyncUserRequest, Trade, User } from './types';

const API_BASE_URL = 'https://hunchdotrun-roan.vercel.app';
const METADATA_API_BASE_URL = 'https://dev-prediction-markets-api.dflow.net';

export const api = {
    // User endpoints
    syncUser: async (data: SyncUserRequest): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/api/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to sync user');
        }
        return response.json();
    },

    getUser: async (userId: string): Promise<User> => {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get user');
        }
        return response.json();
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
    getFeed: async (userId: string, limit = 50, offset = 0): Promise<Trade[]> => {
        const response = await fetch(`${API_BASE_URL}/api/feed?userId=${userId}&limit=${limit}&offset=${offset}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get feed');
        }
        return response.json();
    },
};

export const marketsApi = {
    // Fetch all markets
    fetchMarkets: async (limit: number = 200): Promise<Market[]> => {
        const response = await fetch(
            `${METADATA_API_BASE_URL}/api/v1/markets?limit=${limit}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch markets: ${response.statusText}`);
        }

        const data: MarketsResponse = await response.json();
        return data.markets || [];
    },

    // Fetch events with nested markets
    fetchEvents: async (
        limit: number = 200,
        options?: {
            status?: string;
            withNestedMarkets?: boolean;
        }
    ): Promise<Event[]> => {
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());

        if (options?.status) {
            queryParams.append('status', options.status);
        }
        if (options?.withNestedMarkets) {
            queryParams.append('withNestedMarkets', 'true');
        }

        const response = await fetch(
            `${METADATA_API_BASE_URL}/api/v1/events?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch events: ${response.statusText}`);
        }

        const data: EventsResponse = await response.json();
        return data.events || [];
    },

    // Fetch event details
    fetchEventDetails: async (eventTicker: string): Promise<Event> => {
        const response = await fetch(
            `${METADATA_API_BASE_URL}/api/v1/event/${eventTicker}?withNestedMarkets=true`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
            `${METADATA_API_BASE_URL}/api/v1/markets/batch`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            `${METADATA_API_BASE_URL}/api/v1/events?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
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
            `${METADATA_API_BASE_URL}/api/v1/filter_outcome_mints`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            `${METADATA_API_BASE_URL}/api/v1/market/${ticker}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch market details: ${response.statusText}`);
        }

        return await response.json();
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
