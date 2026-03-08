import LeaderboardRow from "@/components/LeaderboardRow";
import { Theme } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { polymarketApi } from "@/lib/api";
import { LeaderboardCategory, LeaderboardOrderBy, LeaderboardTimePeriod, PolymarketTrader } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const YELLOW = '#FACC15';
const YELLOW_DARK = '#EAB308';
const hunchBadge = require("@/assets/icon-blue.png");

const CATEGORIES: { value: LeaderboardCategory; label: string }[] = [
    { value: 'OVERALL', label: 'All' },
    { value: 'POLITICS', label: 'Politics' },
    { value: 'SPORTS', label: 'Sports' },
    { value: 'CRYPTO', label: 'Crypto' },
    { value: 'CULTURE', label: 'Culture' },
    { value: 'TECH', label: 'Tech' },
    { value: 'FINANCE', label: 'Finance' },
    { value: 'ECONOMICS', label: 'Economics' },
];

const TIME_PERIODS: { value: LeaderboardTimePeriod; label: string }[] = [
    { value: 'DAY', label: '24h' },
    { value: 'WEEK', label: 'Week' },
    { value: 'MONTH', label: 'Month' },
    { value: 'ALL', label: 'All Time' },
];

const PAGE_SIZE = 25;

export default function LeaderboardScreen() {
    const { backendUser } = useUser();
    const [traders, setTraders] = useState<PolymarketTrader[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [category, setCategory] = useState<LeaderboardCategory>('OVERALL');
    const [timePeriod, setTimePeriod] = useState<LeaderboardTimePeriod>('WEEK');
    const [orderBy, setOrderBy] = useState<LeaderboardOrderBy>('PNL');

    const fetchLeaderboard = useCallback(async (reset = false) => {
        try {
            if (reset) {
                setLoading(true);
            }

            const offset = reset ? 0 : traders.length;
            const response = await polymarketApi.getLeaderboard({
                category,
                timePeriod,
                orderBy,
                limit: PAGE_SIZE,
                offset,
            });

            if (reset) {
                setTraders(response.traders);
            } else {
                setTraders(prev => [...prev, ...response.traders]);
            }

            setHasMore(response.traders.length === PAGE_SIZE);
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [category, timePeriod, orderBy, traders.length]);

    useEffect(() => {
        fetchLeaderboard(true);
    }, [category, timePeriod, orderBy]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLeaderboard(true);
    }, [fetchLeaderboard]);

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasMore && !loading) {
            setLoadingMore(true);
            fetchLeaderboard(false);
        }
    }, [loadingMore, hasMore, loading, fetchLeaderboard]);

    const handleCategoryChange = (newCategory: LeaderboardCategory) => {
        Haptics.selectionAsync();
        setCategory(newCategory);
    };

    const handleTimePeriodChange = (newPeriod: LeaderboardTimePeriod) => {
        Haptics.selectionAsync();
        setTimePeriod(newPeriod);
    };

    const handleOrderByToggle = () => {
        Haptics.selectionAsync();
        setOrderBy(prev => prev === 'PNL' ? 'VOL' : 'PNL');
    };

    const handleTraderPress = (trader: PolymarketTrader) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/profile/[identifier]',
            params: { identifier: trader.proxyWallet },
        });
    };

    const renderTrader = ({ item, index }: { item: PolymarketTrader; index: number }) => (
        <LeaderboardRow
            trader={item}
            orderBy={orderBy}
            onPress={() => handleTraderPress(item)}
        />
    );

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View className="py-4 items-center">
                <ActivityIndicator size="small" color={Theme.textSecondary} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View className="flex-1 items-center justify-center py-20">
                <Ionicons name="trophy-outline" size={48} color={Theme.textDisabled} />
                <Text className="text-txt-secondary mt-4 text-center">
                    No traders found for this category
                </Text>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-5 pt-2 pb-3">
                    <View className="flex-row items-center justify-between mb-5">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: '#F3F4F6' }}
                        >
                            <Ionicons name="chevron-back" size={20} color={Theme.textPrimary} />
                        </TouchableOpacity>
                        <View className="flex-row items-center gap-2">
                            <Image
                                source={hunchBadge}
                                style={{ width: 26, height: 26, borderRadius: 13 }}
                                contentFit="cover"
                            />
                            <Text className="text-xl font-bold text-txt-primary">Leaderboard</Text>
                        </View>
                        <View className="w-10" />
                    </View>

                    {/* Category Pills */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mb-3"
                        contentContainerStyle={{ paddingRight: 20 }}
                    >
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat.value}
                                onPress={() => handleCategoryChange(cat.value)}
                                className="mr-2 rounded-full"
                                style={{
                                    backgroundColor: category === cat.value ? YELLOW : '#F3F4F6',
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                }}
                            >
                                <Text
                                    className="text-sm font-semibold"
                                    style={{ color: category === cat.value ? '#000' : Theme.textSecondary }}
                                >
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Time Period & Sort Row */}
                    <View className="flex-row items-center justify-between">
                        {/* Time Period Tabs */}
                        <View className="flex-row rounded-xl p-1" style={{ backgroundColor: '#F3F4F6' }}>
                            {TIME_PERIODS.map((period) => (
                                <TouchableOpacity
                                    key={period.value}
                                    onPress={() => handleTimePeriodChange(period.value)}
                                    className="rounded-lg"
                                    style={{
                                        backgroundColor: timePeriod === period.value ? YELLOW : 'transparent',
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                    }}
                                >
                                    <Text
                                        className="text-xs font-semibold"
                                        style={{ color: timePeriod === period.value ? '#000' : Theme.textSecondary }}
                                    >
                                        {period.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Sort Toggle */}
                        <TouchableOpacity
                            onPress={handleOrderByToggle}
                            className="flex-row items-center gap-1.5 rounded-xl"
                            style={{
                                backgroundColor: '#F3F4F6',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                            }}
                        >
                            <Ionicons
                                name={orderBy === 'PNL' ? 'trending-up' : 'bar-chart'}
                                size={14}
                                color={YELLOW_DARK}
                            />
                            <Text className="text-xs font-semibold" style={{ color: Theme.textPrimary }}>
                                {orderBy === 'PNL' ? 'PnL' : 'Volume'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Leaderboard List */}
                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={YELLOW_DARK} />
                    </View>
                ) : (
                    <FlatList
                        data={traders}
                        renderItem={renderTrader}
                        keyExtractor={(item) => item.proxyWallet}
                        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={YELLOW_DARK}
                            />
                        }
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={renderFooter}
                        ListEmptyComponent={renderEmpty}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}
