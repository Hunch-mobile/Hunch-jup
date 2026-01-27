import { FilterPills } from "@/components/FilterPills";
import { MarketRail } from "@/components/MarketRail";
import { MarketTradeSheet } from "@/components/MarketTradeSheet";
import { MiniNewsCarousel } from "@/components/MiniNewsCarousel";
import { Theme } from '@/constants/theme';
import { useUser } from "@/contexts/UserContext";
import { api, marketsApi } from "@/lib/api";
import { formatPercent } from "@/lib/marketUtils";
import { Event, EventEvidence, Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { useFundSolanaWallet } from "@privy-io/expo/ui";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Text, TouchableOpacity, View } from "react-native";
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



const getTopMarketByVolume = (markets: Market[] | undefined): Market | null => {
  if (!markets || markets.length === 0) return null;
  const activeMarkets = markets.filter((market) => market.status === 'active');
  if (activeMarkets.length === 0) return null;
  return activeMarkets
    .slice()
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))[0] || null;
};

const EventCarousel = ({ items }: { items: Event[] }) => {
  const renderEventItem = ({ item }: { item: Event }) => {
    const topMarket = getTopMarketByVolume(item.markets);
    return (
      <TouchableOpacity
        className="w-[220px] mr-3 bg-app-card rounded-xl overflow-hidden"
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/event/[ticker]', params: { ticker: item.ticker } })}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: '100%', height: 110 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View className="w-full h-[110px] bg-app-card justify-center items-center">
            <Ionicons name="image-outline" size={22} color={Theme.textDisabled} />
          </View>
        )}
        <View className="px-3 py-3">
          <Text className="text-[14px] font-semibold text-txt-primary" numberOfLines={2}>
            {item.title}
          </Text>
          {topMarket && (
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-[12px] text-txt-secondary flex-1 mr-2" numberOfLines={1}>
                {topMarket.yesSubTitle || topMarket.title}
              </Text>
              <Text className="text-[12px] font-bold text-txt-primary">
                {formatPercent(topMarket.yesBid)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="py-4">
      <View className="px-5 mb-2">
        <Text className="text-[14px] font-semibold text-txt-primary">Events</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.ticker}
        renderItem={renderEventItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      />
    </View>
  );
};

const MarketCard = ({
  item,
  onPress,
  eventTitle,
}: {
  item: Market;
  onPress: () => void;
  eventTitle?: string;
}) => {
  const marketSubTitle = item.yesSubTitle || item.title;
  const yesBid = item.yesBid ? parseFloat(item.yesBid) * 100 : null;
  const noBid = item.noBid ? parseFloat(item.noBid) * 100 : null;

  return (
    <TouchableOpacity
      className="py-4 px-5 bg-transparent"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View className="flex-row items-start gap-4">
        {/* Left - Market Icon */}
        {item.image_url ? (
          <View className="w-[70px] h-[70px] rounded-[10px] bg-app-card overflow-hidden">
            <Image
              source={{ uri: item.image_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
            />
          </View>
        ) : (
          <View className="w-[70px] h-[70px] rounded-[10px] bg-app-card justify-center items-center">
            <Ionicons name="stats-chart" size={24} color={Theme.textPrimary} />
          </View>
        )}

        {/* Right Content */}
        <View className="flex-1 gap-1.5">
          {eventTitle ? (
            <Text className="text-[12px] text-txt-secondary" numberOfLines={1}>
              {eventTitle}
            </Text>
          ) : null}
          <Text className="text-[15px] font-bold text-txt-primary leading-5" numberOfLines={2}>
            {marketSubTitle}
          </Text>

          {/* Market Prices */}
          <View className="gap-1 mt-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-txt-secondary">Yes</Text>
              <Text className="text-[13px] font-bold text-txt-primary">
                {yesBid !== null ? formatPercent(item.yesBid) : '—'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] text-txt-secondary">No</Text>
              <Text className="text-[13px] font-bold text-txt-primary">
                {noBid !== null ? formatPercent(item.noBid) : '—'}
              </Text>
            </View>
          </View>

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
  | { type: 'market'; data: Market }
  | { type: 'eventCarousel'; data: Event[] }
  | { type: 'news'; data: EventEvidence[] };

export default function HomeScreen() {
  const { preferences, backendUser } = useUser();
  const { fundWallet } = useFundSolanaWallet();
  const { wallets } = useEmbeddedSolanaWallet();
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

      // Map 'Hot' to 'All' for the API, keep other categories as is
      const apiCategory = category === 'Hot' ? 'All' : category;

      // 1. Fetch Events using the new consolidated endpoint
      try {
        const result = await marketsApi.fetchHomeFeed(
          20,
          reset ? undefined : cursor,
          apiCategory
        );
        fetchedEvents = result.events;
        newCursor = result.cursor;
      } catch (err) {
        console.error("Failed to fetch home feed:", err);
        throw err;
      }

      // 2. Derive top-volume markets from events (one per event)
      fetchedMarkets = fetchedEvents
        .map((event) => getTopMarketByVolume(event.markets))
        .filter((market): market is Market => !!market);

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

    if (markets.length === 0) {
      if (events.length > 0) {
        items.push({ type: 'eventCarousel', data: events.slice(0, EVENTS_PER_CAROUSEL) });
      }
      return items;
    }

    let eventCursor = 0;
    let itemIndex = 0;

    for (let i = 0; i < markets.length; i++) {
      items.push({ type: 'market', data: markets[i] });
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

    if (eventCursor < events.length) {
      items.push({
        type: 'eventCarousel',
        data: events.slice(eventCursor, eventCursor + EVENTS_PER_CAROUSEL),
      });
    }

    return items;
  }, [events, markets, newsItems]);

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
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={Theme.accentSubtle} />
      </View>
    );
  };

  return (
    <View className="flex-1 bg-app-bg">
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
              if (item.type === 'eventCarousel') return `event-carousel-${index}`;
              return `item-${index}`;
            }}
            renderItem={renderFeedItem}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
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
                <FilterPills
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onCategoryChange={handleCategoryChange}
                  preferredCategories={getPreferredCategories()}
                />
                <MarketRail />
              </>
            }
            ListFooterComponent={renderFooter}
            ItemSeparatorComponent={({ leadingItem }) =>
              leadingItem?.type === 'market' ? (
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
