import { FilterPills } from "@/components/FilterPills";
import { MarketRail } from "@/components/MarketRail";
import { MiniNewsCarousel } from "@/components/MiniNewsCarousel";
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, marketsApi } from "@/lib/api";
import { formatPercent, getTopMarkets } from "@/lib/marketUtils";
import { Event, EventEvidence, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useFundSolanaWallet } from "@privy-io/expo/ui";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Filter active events (events with at least one active market)
const isEventActive = (event: Event): boolean => {
  const activeMarkets = event.markets?.filter(
    market => market.status === 'active'
  ) || [];
  return activeMarkets.length > 0;
};

// Sort events by volume (highest first)
const sortByVolume = (events: Event[]): Event[] => {
  return [...events].sort((a, b) => (b.volume || 0) - (a.volume || 0));
};

// Chunk array into smaller pieces (for API batching)
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const EventCard = ({ item }: { item: Event }) => {
  const topMarkets = getTopMarkets(item.markets, 2);

  const handlePress = () => {
    router.push({ pathname: '/event/[ticker]', params: { ticker: item.ticker } });
  };

  return (
    <TouchableOpacity
      className="py-4 px-5 bg-transparent"
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <View className="flex-row items-start gap-4">
        {/* Left - Event Image */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: 70, height: 70 }}
            className="rounded-[10px]"
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="w-[70px] h-[70px] rounded-[10px] bg-app-card justify-center items-center">
            <Ionicons name="image-outline" size={24} color={Theme.textDisabled} />
          </View>
        )}

        {/* Right Content */}
        <View className="flex-1 gap-1.5">
          {item.competition && (
            <Text className="text-[10px] font-semibold text-txt-secondary uppercase tracking-wider">
              {item.competition}
            </Text>
          )}

          <Text className="text-[15px] font-semibold text-txt-primary leading-5" numberOfLines={2}>
            {item.title}
          </Text>

          {/* Top Markets */}
          {topMarkets.length > 0 && (
            <View className="gap-1 mt-1">
              {topMarkets.map((market: Market) => (
                <View key={market.ticker} className="flex-row items-center justify-between py-1">
                  <Text className="flex-1 text-[13px] text-txt-secondary mr-2" numberOfLines={1}>
                    {market.yesSubTitle || market.title}
                  </Text>
                  <Text className="text-[13px] font-bold text-txt-primary">
                    {formatPercent(market.yesBid)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MarketCard = ({ item }: { item: Market }) => {
  const handlePress = () => {
    router.push({ pathname: '/market/[ticker]', params: { ticker: item.ticker } });
  };

  const displayTitle = item.yesSubTitle || item.title;
  const yesBid = item.yesBid ? parseFloat(item.yesBid) * 100 : null;

  return (
    <TouchableOpacity
      className="py-4 px-5 bg-transparent"
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <View className="flex-row items-start gap-4">
        {/* Left - Market Icon */}
        <View className="w-[70px] h-[70px] rounded-[10px] bg-app-card justify-center items-center">
          <Ionicons name="stats-chart" size={24} color={Theme.textPrimary} />
        </View>

        {/* Right Content */}
        <View className="flex-1 gap-1.5">
          <Text className="text-[10px] font-semibold text-txt-secondary uppercase tracking-wider">
            Market
          </Text>
          <Text className="text-[15px] font-semibold text-txt-primary leading-5" numberOfLines={2}>
            {displayTitle}
          </Text>

          {/* Market Price */}
          {yesBid !== null && (
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-[13px] text-txt-secondary">Yes</Text>
              <Text className="text-[13px] font-bold text-txt-primary">
                {formatPercent(item.yesBid)}
              </Text>
            </View>
          )}

          {/* Volume */}
          {item.volume && item.volume > 0 && (
            <Text className="text-[11px] text-txt-disabled mt-0.5">
              Vol: ${(item.volume / 1000).toFixed(1)}K
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Default categories fallback
const DEFAULT_CATEGORIES = [
  'Hot',
  'Climate and Weather',
  'Companies',
  'Crypto',
  'Economics',
  'Elections',
  'Entertainment',
  'Financials',
  'Mentions',
  'Politics',
  'Science and Technology',
  'Social',
  'Sports',
  'Transportation',
];

// Cache for tags response
let tagsCache: { categories: string[]; timestamp: number } | null = null;
const TAGS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// News event tickers for evidence
const NEWS_EVENT_TICKERS = ['KXFEDDECISION-26JAN', 'KXFEDCHAIRNOM-29'];

// Feed item types for mixed list
type FeedItem =
  | { type: 'event'; data: Event }
  | { type: 'market'; data: Market }
  | { type: 'news'; data: EventEvidence[] };

export default function HomeScreen() {
  const { preferences, backendUser } = useUser();
  const { fundWallet } = useFundSolanaWallet();
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [events, setEvents] = useState<Event[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [newsItems, setNewsItems] = useState<EventEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const [portfolioPnl, setPortfolioPnl] = useState<number | null>(null);

  const isLoadingRef = useRef(false);

  // Get preferred categories from user interests
  const getPreferredCategories = (): string[] => {
    if (!preferences?.interests && !preferences?.habits) {
      return [];
    }
    
    // Use interests if available, otherwise fall back to habits mapping (backwards compatibility)
    if (preferences.interests && preferences.interests.length > 0) {
      return preferences.interests.filter(int => categories.includes(int));
    }
    
    // Legacy habits mapping (for backwards compatibility)
    const habitToCategories: Record<string, string[]> = {
      'Exercise': ['Sports', 'Transportation'],
      'Meditate': ['Social', 'Entertainment'],
      'Read books': ['Science and Technology', 'Entertainment'],
      'Plan a day': [],
      'Do yoga': ['Sports'],
      'Write in journal': ['Social'],
      'Healthy breakfast': ['Companies', 'Economics'],
    };
    
    const relevantCategories = new Set<string>();
    (preferences.habits || []).forEach(habit => {
      const cats = habitToCategories[habit] || [];
      cats.forEach(cat => relevantCategories.add(cat));
    });
    
    return Array.from(relevantCategories);
  };

  // Load categories and news on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Reload news when preferences change
  useEffect(() => {
    loadNews();
  }, [preferences]);

  // Set default category based on preferences when they're loaded
  useEffect(() => {
    if (categories.length > 1) {
      const preferredCategories = getPreferredCategories();
      if (preferredCategories.length > 0) {
        // Prioritize first preferred category
        setSelectedCategory(preferredCategories[0]);
      }
    }
  }, [preferences, categories]);

  // Load events when category changes
  useEffect(() => {
    loadEventsForCategory(selectedCategory, true);
  }, [selectedCategory]);

  // Load portfolio value
  const loadPortfolioValue = useCallback(async () => {
    if (!backendUser) {
      setPortfolioValue(null);
      setPortfolioPnl(null);
      return;
    }
    try {
      const { positions } = await api.getPositions(backendUser.id);
      const totalPositionValue = positions.active.reduce((sum, pos) => {
        return sum + (pos.currentValue || 0);
      }, 0);
      const totalPnl = positions.active.reduce((sum, pos) => {
        if (typeof pos.profitLoss === 'number') return sum + pos.profitLoss;
        const cv = typeof pos.currentValue === 'number' ? pos.currentValue : 0;
        const cb = typeof pos.totalCostBasis === 'number' ? pos.totalCostBasis : 0;
        return sum + (cv - cb);
      }, 0);
      setPortfolioValue(totalPositionValue);
      setPortfolioPnl(totalPnl);
    } catch (error) {
      console.error('Failed to load portfolio value:', error);
      setPortfolioValue(null);
      setPortfolioPnl(null);
    }
  }, [backendUser]);

  useEffect(() => {
    loadPortfolioValue();
  }, [loadPortfolioValue]);

  // Load news evidence - filter by preferences if available
  const loadNews = async () => {
    try {
      const evidence = await api.fetchEvidence(NEWS_EVENT_TICKERS);
      
      // Filter news by preferred categories if user has preferences
      const preferredCategories = getPreferredCategories();
      if (preferredCategories.length > 0) {
        // For now, we show all news, but this could be enhanced to filter by event categories
        // when the evidence includes category information
        setNewsItems(evidence);
      } else {
        setNewsItems(evidence);
      }
    } catch (err) {
      console.error('Failed to load news:', err);
    }
  };

  const loadCategories = async () => {
    try {
      // Check cache first
      if (tagsCache && Date.now() - tagsCache.timestamp < TAGS_CACHE_DURATION) {
        setCategories(tagsCache.categories);
        return;
      }

      const tagsResponse = await marketsApi.fetchTags();
      const categoryNames = Object.keys(tagsResponse.tagsByCategories);
      const allCategories = ['Hot', ...categoryNames];

      tagsCache = { categories: allCategories, timestamp: Date.now() };
      setCategories(allCategories);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      // Use default categories as fallback
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const loadEventsForCategory = async (category: string, reset: boolean = false) => {
    if (isLoadingRef.current && !reset) return;
    isLoadingRef.current = true;

    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setCursor(undefined);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      let fetchedEvents: Event[] = [];
      let fetchedMarkets: Market[] = [];
      let newCursor: string | undefined;

      if (category === 'Hot') {
        // Flow 1: Fetch all events with pagination
        const result = await marketsApi.fetchEvents(20, {
          status: 'active',
          withNestedMarkets: true,
          cursor: reset ? undefined : cursor,
        });
        fetchedEvents = result.events;
        newCursor = result.cursor;

        // Also fetch markets
        try {
          const allMarkets = await marketsApi.fetchMarkets(20);
          // Filter active markets only
          fetchedMarkets = allMarkets.filter(
            market => market.status === 'active'
          );
        } catch (err) {
          console.error("Failed to fetch markets:", err);
          // Continue without markets if fetch fails
        }
      } else {
        // Flow 2: Fetch series for category, then events by series tickers
        const series = await marketsApi.fetchSeries(category, {
          isInitialized: true,
          status: 'active',
        });

        const tickers = series.map(s => s.ticker);

        if (tickers.length === 0) {
          fetchedEvents = [];
        } else {
          // Split into chunks of 25 for API limits
          const tickerChunks = chunkArray(tickers, 25);
          const allEvents: Event[] = [];

          for (const chunk of tickerChunks) {
            const chunkEvents = await marketsApi.fetchEventsBySeries(chunk, {
              withNestedMarkets: true,
              status: 'active',
            });
            allEvents.push(...chunkEvents);
          }

          fetchedEvents = allEvents;
        }
        // No pagination for category-specific events
        newCursor = undefined;
      }

      // Filter and sort events
      const activeEvents = fetchedEvents.filter(isEventActive);
      const sortedEvents = sortByVolume(activeEvents);

      // Sort markets by volume (highest first)
      const sortedMarkets = [...fetchedMarkets].sort((a, b) => (b.volume || 0) - (a.volume || 0));

      if (reset) {
        setEvents(sortedEvents);
        setMarkets(sortedMarkets);
      } else {
        setEvents(prev => [...prev, ...sortedEvents]);
        setMarkets(prev => [...prev, ...sortedMarkets]);
      }

      setCursor(newCursor);
      setHasMore(!!newCursor && activeEvents.length > 0);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      if (reset) {
        setError("Failed to load events");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  };

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleLoadMore = useCallback(() => {
    // Only paginate for "All" category
    if (
      selectedCategory === 'All' &&
      hasMore &&
      !loading &&
      !loadingMore &&
      cursor
    ) {
      loadEventsForCategory(selectedCategory, false);
    }
  }, [selectedCategory, hasMore, loading, loadingMore, cursor]);

  const handleRefresh = useCallback(() => {
    loadEventsForCategory(selectedCategory, true);
  }, [selectedCategory]);

  // Create mixed feed items (events + markets + news carousel)
  const feedItems: FeedItem[] = [];
  const NEWS_INTERVAL = 4; // Insert news after every 4 items

  // Combine events and markets, interleaving them
  const maxLength = Math.max(events.length, markets.length);
  let itemIndex = 0;

  for (let i = 0; i < maxLength; i++) {
    // Add event if available
    if (i < events.length) {
      feedItems.push({ type: 'event', data: events[i] });
      itemIndex++;

      // Insert news carousel after every NEWS_INTERVAL items (but only once if we have news)
      if (newsItems.length > 0 && itemIndex % NEWS_INTERVAL === 0 && itemIndex <= NEWS_INTERVAL) {
        feedItems.push({ type: 'news', data: newsItems });
      }
    }

    // Add market if available (alternate with events)
    if (i < markets.length) {
      feedItems.push({ type: 'market', data: markets[i] });
      itemIndex++;

      // Insert news carousel after every NEWS_INTERVAL items (but only once if we have news)
      if (newsItems.length > 0 && itemIndex % NEWS_INTERVAL === 0 && itemIndex <= NEWS_INTERVAL) {
        feedItems.push({ type: 'news', data: newsItems });
      }
    }
  }

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'news') {
      return <MiniNewsCarousel items={item.data} />;
    }
    if (item.type === 'market') {
      return <MarketCard item={item.data} />;
    }
    return <EventCard item={item.data} />;
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={Theme.accentSubtle} />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-app-bg">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header with Portfolio Value and Search Button */}
        <View className="px-5 pt-4 pb-3 flex-row justify-between items-center">
          <View className="flex-1">
            {portfolioValue !== null ? (
              <>
                <Text className="text-3xl font-extrabold text-txt-primary tracking-tight">
                  {portfolioValue >= 1000000
                    ? `$${(portfolioValue / 1000000).toFixed(2)}M`
                    : portfolioValue >= 1000
                    ? `$${(portfolioValue / 1000).toFixed(1)}K`
                    : `$${portfolioValue.toFixed(2)}`}
                </Text>
                {portfolioPnl !== null && (
                  <Text
                    className="text-[16px]  font-semibold mt-1"
                    style={{ color: portfolioPnl >= 0 ? Theme.chartNeutral : Theme.error }}
                  >
                    {portfolioPnl >= 0 ? '+' : '-'}${Math.abs(portfolioPnl).toFixed(2)}
                  </Text>
                )}
              </>
            ) : (
              <Text className="text-3xl font-extrabold text-txt-primary tracking-tight">—</Text>
            )}
          </View>
          <TouchableOpacity
            className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-md bg-slate-200"
            onPress={() => {
              if (backendUser?.walletAddress) {
                fundWallet({ address: backendUser.walletAddress, amount: "0.2" });
              }
            }}
            activeOpacity={0.7}
          >
            <Text className="text-[15px] font-medium text-txt-primary">+ Add Cash</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Pills - Fixed at top, prioritized by preferences */}
        <FilterPills
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          preferredCategories={getPreferredCategories()}
        />

        {/* Scrollable content: MarketRail + Events + News */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={Theme.accentSubtle} />
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-status-error text-base mb-3">{error}</Text>
            <TouchableOpacity
              className="bg-txt-primary py-2.5 px-5 rounded-lg"
              onPress={handleRefresh}
            >
              <Text className="text-txt-inverse text-sm font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={feedItems}
            keyExtractor={(item, index) => {
              if (item.type === 'news') return `news-${index}`;
              if (item.type === 'market') return `market-${item.data.ticker}`;
              return `event-${item.data.ticker}`;
            }}
            renderItem={renderFeedItem}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={handleRefresh}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={<MarketRail />}
            ListFooterComponent={renderFooter}
            ItemSeparatorComponent={({ leadingItem }) =>
              leadingItem?.type === 'event' || leadingItem?.type === 'market' ? (
                <View className="h-px bg-border opacity-50" />
              ) : null
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-20">
                <Ionicons name="search-outline" size={48} color={Theme.textDisabled} />
                <Text className="text-txt-secondary text-base mt-4">
                  No events or markets found
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
