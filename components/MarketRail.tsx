import { marketsApi } from '@/lib/api';
import { formatPercent, formatVolume, getMarketDisplayTitle, getScoredEventsForRail } from '@/lib/marketUtils';
import { Event, Market } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Import theme
import { Theme } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const CARD_MARGIN = 12;

interface RailItem {
    event: Event;
    market: Market;
    score: number;
}

export const MarketRail = () => {
    const [railItems, setRailItems] = useState<RailItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRailData();
    }, []);

    const loadRailData = async () => {
        try {
            setLoading(true);
            const events = await marketsApi.fetchEvents(100, {
                status: 'active',
                withNestedMarkets: true,
            });

            const scoredItems = getScoredEventsForRail(events, 7);
            setRailItems(scoredItems);
        } catch (error) {
            console.error('Failed to load market rail:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCardPress = (ticker: string) => {
        router.push({ pathname: '/event/[ticker]', params: { ticker } });
    };

    const renderRailCard = ({ item }: { item: RailItem }) => {
        const { event, market } = item;
        const marketTitle = getMarketDisplayTitle(market);
        const probability = formatPercent(market.yesBid);
        const volume = formatVolume(event.volume || event.volume24h);

        return (
            <TouchableOpacity
                style={styles.railCard}
                activeOpacity={0.7}
                onPress={() => handleCardPress(event.ticker)}
            >
                {/* Event Image */}
                {event.imageUrl ? (
                    <Image
                        source={{ uri: event.imageUrl }}
                        style={styles.railImage}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={styles.railImagePlaceholder}>
                        <Ionicons name="image-outline" size={40} color={Theme.textDisabled} />
                    </View>
                )}

                {/* Market Info */}
                <View style={styles.railContent}>
                    {event.competition && (
                        <Text style={styles.railCompetition} numberOfLines={1}>
                            {event.competition}
                        </Text>
                    )}

                    <Text style={styles.railMarketTitle} numberOfLines={2}>
                        {marketTitle}
                    </Text>

                    {/* Stats Row */}
                    <View style={styles.railStats}>
                        <View style={styles.railStatItem}>
                            <View style={styles.probabilityBadge}>
                                <Text style={styles.probabilityText}>{probability}</Text>
                            </View>
                        </View>

                        {volume !== '—' && (
                            <View style={styles.railStatItem}>
                                <Ionicons name="trending-up" size={12} color={Theme.textSecondary} />
                                <Text style={styles.railStatText}>{volume}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Theme.accent} />
            </View>
        );
    }

    if (railItems.length === 0) {
        return null;
    }

    return (
        <View style={styles.railContainer}>
            <View style={styles.railHeader}>
                <Text style={styles.railHeaderTitle}>Trending Markets</Text>
                <Ionicons name="flame" size={18} color={Theme.accent} />
            </View>

            <FlatList
                horizontal
                data={railItems}
                keyExtractor={(item) => item.event.ticker}
                renderItem={renderRailCard}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.railList}
                snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
                decelerationRate="fast"
                snapToAlignment="start"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    railContainer: {
        paddingVertical: 16,
        backgroundColor: Theme.bgMain,
    },
    railHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
        gap: 8,
    },
    railHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Theme.textPrimary,
    },
    railList: {
        paddingHorizontal: 8,
    },
    railCard: {
        width: CARD_WIDTH,
        backgroundColor: Theme.bgCard,
        borderRadius: 16,
        marginHorizontal: CARD_MARGIN,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Theme.border,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    railImage: {
        width: '100%',
        height: 140,
    },
    railImagePlaceholder: {
        width: '100%',
        height: 140,
        backgroundColor: Theme.bgElevated,
        justifyContent: 'center',
        alignItems: 'center',
    },
    railContent: {
        padding: 16,
    },
    railCompetition: {
        fontSize: 10,
        fontWeight: '700',
        color: Theme.accentSubtle,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    railMarketTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Theme.textPrimary,
        lineHeight: 20,
        marginBottom: 12,
    },
    railStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    railStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    railStatText: {
        fontSize: 11,
        fontWeight: '500',
        color: Theme.textSecondary,
    },
    probabilityBadge: {
        backgroundColor: Theme.bgDark,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    probabilityText: {
        fontSize: 13,
        fontWeight: '700',
        color: Theme.textInverse,
    },
});
