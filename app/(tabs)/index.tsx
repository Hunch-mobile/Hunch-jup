import { EventCarousel } from "@/components/EventCarousel";
import { EventMarketImageCarousel } from "@/components/EventMarketImageCarousel";
import { FilterPills } from "@/components/FilterPills";
import { MarketCard } from "@/components/MarketCard";

import { MarketTradeSheet } from "@/components/MarketTradeSheet";
import { MiniNewsCarousel } from "@/components/MiniNewsCarousel";
import { HomeFeedSkeleton, ListFooterSkeleton } from "@/components/skeletons";
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, marketsApi } from "@/lib/api";
import { Event, EventEvidence, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { useFundSolanaWallet } from "@privy-io/expo/ui";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


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
  | { type: 'market'; data: Market }
  | { type: 'eventCarousel'; data: Event[] }
  | { type: 'news'; data: EventEvidence[] };

export default function HomeScreen() {
  const { preferences, backendUser } = useUser();
  const { fundWallet } = useFundSolanaWallet();
  const { wallets } = useEmbeddedSolanaWallet();
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('Hot');
  const [events, setEvents] = useState<Event[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [newsItems, setNewsItems] = useState<EventEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const [portfolioPnl, setPortfolioPnl] = useState<number | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const [marketSheetVisible, setMarketSheetVisible] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [walletProvider, setWalletProvider] = useState<any>(null);
  const [selectedMarketEventTitle, setSelectedMarketEventTitle] = useState<string | undefined>(undefined);

  const isLoadingRef = useRef(false);
  const solanaWallet = wallets?.[0];

  const connection = useMemo(() => {
    const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
    return new Connection(rpcUrl, 'confirmed');
  }, []);

  useEffect(() => {
    const getProvider = async () => {
      if (solanaWallet) {
        try {
          const provider = await solanaWallet.getProvider();
          setWalletProvider(provider);
        } catch (error) {
          console.error('Failed to get wallet provider:', error);
        }
      }
    };
    getProvider();
  }, [solanaWallet]);

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

  // Load events when category changes (only on initial mount, not on filter clicks)
  useEffect(() => {
    // Only load if it's the initial load (loading is true)
    if (loading) {
      loadEventsForCategory(selectedCategory, true, false);
    }
  }, []);

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

  const loadEventsForCategory = async (category: string, reset: boolean = false, isFilterChange: boolean = false) => {
    if (isLoadingRef.current && !reset) return;
    isLoadingRef.current = true;

    try {
      if (reset) {
        // Only show full loading on initial load, not on filter changes
        if (isFilterChange) {
          setFilterLoading(true);
        } else {
          setLoading(true);
        }
        setError(null);
        setCursor(undefined);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      // Map 'Hot' to 'All' for the API, keep other categories as is
      const apiCategory = category === 'Hot' ? 'All' : category;

      // Fetch using the optimized consolidated endpoint
      // Backend now handles filtering, sorting, and market extraction
      const result = await marketsApi.fetchHomeFeed(
        20,
        reset ? undefined : cursor,
        apiCategory
      );

      // Events and topMarkets are now pre-processed by the backend
      const fetchedEvents = result.events || [];
      const fetchedMarkets = result.topMarkets || [];

      if (reset) {
        setEvents(fetchedEvents);
        setMarkets(fetchedMarkets);
      } else {
        setEvents(prev => [...prev, ...fetchedEvents]);
        setMarkets(prev => [...prev, ...fetchedMarkets]);
      }

      setCursor(result.cursor);
      // Use metadata.hasMore from backend instead of client-side calculation
      setHasMore(result.metadata?.hasMore ?? false);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      if (reset) {
        setError("Failed to load events");
      }
    } finally {
      setLoading(false);
      setFilterLoading(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  };


  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    // Trigger filter change loading
    loadEventsForCategory(category, true, true);
  }, []);

  const handleLoadMore = useCallback(() => {
    // Pagination is supported if we have a cursor/hasMore
    if (
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

  // Animated header transitions
  const valueScale = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  });

  const extrasOpacity = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const eventTitleByTicker = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((event) => map.set(event.ticker, event.title));
    return map;
  }, [events]);

  const handleOpenMarketSheet = (marketItem: Market) => {
    setSelectedMarket(marketItem);
    if (marketItem.eventTicker) {
      setSelectedMarketEventTitle(eventTitleByTicker.get(marketItem.eventTicker) || marketItem.title);
    } else {
      setSelectedMarketEventTitle(marketItem.title);
    }
    setMarketSheetVisible(true);
  };

  const handleCloseMarketSheet = () => {
    setMarketSheetVisible(false);
  };

  // Create mixed feed items (markets list with event carousels + news carousel)
  const feedItems = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];
    const NEWS_INTERVAL = 4;
    const EVENT_CAROUSEL_INTERVAL = 8;
    const EVENTS_PER_CAROUSEL = 7;
    let newsInserted = false;

    const marketsWithImages = markets.filter((m: any) => {
      if (typeof m?.image_url !== 'string') return false;
      if (!m.image_url.startsWith('http')) return false;
      if (m.image_url.toLowerCase().includes('kalshi-fallback-images')) return false;
      return true;
    });

    const marketsWithoutImages = markets.filter((m: any) => {
      if (typeof m?.image_url !== 'string') return true;
      if (!m.image_url.startsWith('http')) return true;
      if (m.image_url.toLowerCase().includes('kalshi-fallback-images')) return true;
      return false;
    });

    if (marketsWithImages.length === 0) {
      if (events.length > 0) {
        items.push({ type: 'eventCarousel', data: events.slice(0, EVENTS_PER_CAROUSEL) });
      }
      return items;
    }

    let eventCursor = 0;
    let itemIndex = 0;

    for (let i = 0; i < marketsWithImages.length; i++) {
      items.push({ type: 'market', data: marketsWithImages[i] });
      itemIndex++;

      if (!newsInserted && newsItems.length > 0 && itemIndex % NEWS_INTERVAL === 0) {
        items.push({ type: 'news', data: newsItems });
        newsInserted = true;
      }

      if ((i + 1) % EVENT_CAROUSEL_INTERVAL === 0 && eventCursor < events.length) {
        items.push({
          type: 'eventCarousel',
          data: events.slice(eventCursor, eventCursor + EVENTS_PER_CAROUSEL),
        });
        eventCursor += EVENTS_PER_CAROUSEL;
        itemIndex++;

        if (!newsInserted && newsItems.length > 0 && itemIndex % NEWS_INTERVAL === 0) {
          items.push({ type: 'news', data: newsItems });
          newsInserted = true;
        }
      }
    }

    // For non-"Hot" categories, append markets without images after the image-rich feed
    if (selectedCategory !== 'Hot' && marketsWithoutImages.length > 0) {
      marketsWithoutImages.forEach((m) => {
        items.push({ type: 'market', data: m });
      });
    }

    if (eventCursor < events.length) {
      items.push({
        type: 'eventCarousel',
        data: events.slice(eventCursor, eventCursor + EVENTS_PER_CAROUSEL),
      });
    }

    return items;
  }, [events, markets, newsItems, selectedCategory]);

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    if (item.type === 'news') {
      return <MiniNewsCarousel items={item.data} />;
    }
    if (item.type === 'eventCarousel') {
      return <EventCarousel items={item.data} />;
    }
    if (item.type === 'market') {
      return (
        <MarketCard
          item={item.data}
          onPress={() => handleOpenMarketSheet(item.data)}
          eventTitle={item.data.eventTicker ? eventTitleByTicker.get(item.data.eventTicker) : undefined}
        />
      );
    }
    return null;
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return <ListFooterSkeleton />;
  };

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header with Portfolio Value / PnL / Add Cash (collapses on scroll) */}
        <Animated.View className="px-5 pt-2 pb-2 flex-row items-center justify-between">
          <View className={headerCollapsed ? 'flex-1 items-center' : 'flex-1'}>
            {portfolioValue !== null ? (
              <>
                <Animated.Text
                  className="text-2xl font-extrabold text-txt-primary tracking-tight"
                  style={{ transform: [{ scale: valueScale }] }}
                >
                  {portfolioValue >= 1000000
                    ? `$${(portfolioValue / 1000000).toFixed(2)}M`
                    : portfolioValue >= 1000
                      ? `$${(portfolioValue / 1000).toFixed(1)}K`
                      : `$${portfolioValue.toFixed(2)}`}
                </Animated.Text>
                {portfolioPnl !== null && (
                  <Animated.Text
                    className="text-[16px] font-semibold mt-1"
                    style={{
                      opacity: extrasOpacity,
                      color: portfolioPnl >= 0 ? Theme.chartNeutral : Theme.error,
                    }}
                  >
                    {portfolioPnl >= 0 ? '+' : '-'}${Math.abs(portfolioPnl).toFixed(2)}
                  </Animated.Text>
                )}
              </>
            ) : (
              <Text className="text-2xl font-extrabold text-txt-primary tracking-tight">
                —
              </Text>
            )}
          </View>
          <Animated.View
            style={[
              { opacity: extrasOpacity },
              headerCollapsed && { position: 'absolute', right: 20 },
            ]}
          >
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
          </Animated.View>
        </Animated.View>

        {/* Scrollable content: Filters + MarketRail + Events + News */}
        <>
          {/* Filters always visible */}
          <FilterPills
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            preferredCategories={getPreferredCategories()}
          />

          {/* Content with loading states */}
          {loading || filterLoading ? (
            <HomeFeedSkeleton showFilters={false} />
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
                if (item.type === 'eventCarousel') return `event-carousel-${index}`;
                return `item-${index}`;
              }}
              renderItem={renderFeedItem}
              contentContainerStyle={{ paddingBottom: 80 }}
              showsVerticalScrollIndicator={false}
              refreshing={false}
              onRefresh={handleRefresh}
              onScroll={(event) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                const shouldCollapse = offsetY > 40;
                setHeaderCollapsed((prev) => {
                  if (prev === shouldCollapse) return prev;
                  Animated.timing(headerAnim, {
                    toValue: shouldCollapse ? 1 : 0,
                    duration: 200,
                    useNativeDriver: true,
                  }).start();
                  return shouldCollapse;
                });
              }}
              scrollEventThrottle={16}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListHeaderComponent={
                <>
                  <EventMarketImageCarousel items={events.slice(0, 10)} />

                </>
              }
              ListFooterComponent={renderFooter}
              ItemSeparatorComponent={() => null}
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
        </>
      </SafeAreaView>

      <MarketTradeSheet
        visible={marketSheetVisible}
        onClose={handleCloseMarketSheet}
        onTradeSuccess={() => { }}
        market={selectedMarket}
        backendUser={backendUser || null}
        walletProvider={walletProvider}
        connection={connection}
        eventTitle={selectedMarketEventTitle}
      />
    </View>
  );
}
