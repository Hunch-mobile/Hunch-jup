import CreditCard from "@/components/CreditCard";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Import theme from central location
import SettingsSheet from "@/components/SettingsSheet";
import { Theme } from '@/constants/theme';
import { useFundSolanaWallet } from "@privy-io/expo/ui";

// Theme constants
const ACCENT = Theme.accentSubtle;
const BG_MAIN = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BG_ELEVATED = Theme.bgElevated;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;
const SUCCESS = Theme.success;
const ERROR = Theme.error;

type TradeTab = 'active' | 'previous';

export default function ProfileScreen() {
    const { user, logout } = usePrivy();
    const { backendUser, setBackendUser } = useUser();
    const router = useRouter();
    const { fundWallet } = useFundSolanaWallet();
    const [profileData, setProfileData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [activeTab, setActiveTab] = useState<TradeTab>('active');
    const [settingsVisible, setSettingsVisible] = useState(false);

    // Animation values
    const slideAnim = useRef(new Animated.Value(0)).current;

    const animateToTab = useCallback((tab: TradeTab) => {
        const toValue = tab === 'active' ? 0 : -SCREEN_WIDTH + 40; // Adjust for padding
        Animated.spring(slideAnim, {
            toValue,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
        setActiveTab(tab);
    }, [slideAnim]);

    useEffect(() => {
        loadProfile();
        loadTrades();
    }, [backendUser]);

    const loadProfile = async () => {
        if (!backendUser) {
            setIsLoading(false);
            return;
        }

        try {
            const data = await api.getUser(backendUser.id);
            setProfileData(data);
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadTrades = async () => {
        if (!backendUser) return;

        try {
            const data = await api.getUserTrades(backendUser.id, 50);
            setTrades(data);
        } catch (error) {
            console.error("Failed to load trades:", error);
        }
    };

    const handleLogout = async () => {
        await logout();
        setBackendUser(null);
        router.replace("/login");
    };

    // Get Twitter/X data from linked accounts and remove _normal for higher resolution
    const twitterAccount = user?.linked_accounts?.find((a: any) => a.type === 'twitter_oauth');
    const twitterHandle = (twitterAccount as any)?.username;
    const rawProfileImageUrl = (twitterAccount as any)?.profile_picture_url;
    const profileImageUrl = rawProfileImageUrl?.replace('_normal', '');

    const displayName = profileData?.displayName || backendUser?.displayName || "User";
    const followerCount = profileData?.followerCount || 0;
    const followingCount = profileData?.followingCount || 0;

    // Format joined date
    const joinedDate = profileData?.createdAt
        ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'Nov 2025';

    // Separate active and previous trades
    const now = new Date();
    const activeTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff < 24;
    });
    const previousTrades = trades.filter(trade => {
        const tradeDate = new Date(trade.createdAt);
        const hoursDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff >= 24;
    });

    const displayedTrades = activeTab === 'active' ? activeTrades : previousTrades;

    if (isLoading) {
        return (
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea} edges={['top']}>
                    <View style={[styles.content, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
                        <ActivityIndicator size="large" color={TEXT_PRIMARY} />
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Header Section */}
                    <View style={styles.profileHeader}>
                        {/* Menu Icon - Top Right */}
                        <View style={styles.logoutContainer}>
                            <TouchableOpacity
                                style={styles.headerBtn}
                                onPress={() => setSettingsVisible(true)}
                            >
                                <Ionicons name="menu-outline" size={24} color={TEXT_SECONDARY} />
                            </TouchableOpacity>
                        </View>

                        {/* Main Profile Row: Avatar + Info */}
                        <View style={styles.profileMainRow}>
                            {/* Avatar */}
                            <View style={styles.avatarContainer}>
                                <View style={styles.avatarWrapper}>
                                    <View style={styles.avatarInner}>
                                        {profileImageUrl ? (
                                            <Image
                                                source={{ uri: profileImageUrl }}
                                                style={styles.avatarImage}
                                            />
                                        ) : (
                                            <Text style={styles.avatarText}>
                                                {displayName.charAt(0).toUpperCase()}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* Info Section - Right of Avatar */}
                            <View style={styles.profileInfo}>
                                {/* Name */}
                                <Text style={styles.name}>{displayName}</Text>

                                {/* Following / Followers */}
                                <View style={styles.followRow}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (backendUser?.id) {
                                                router.push({
                                                    pathname: '/user/followers/[userId]',
                                                    params: { userId: backendUser.id, tab: 'following' }
                                                });
                                            }
                                        }}
                                    >
                                        <Text style={styles.followText}>
                                            <Text style={styles.followCount}>{followingCount}</Text> Following
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (backendUser?.id) {
                                                router.push({
                                                    pathname: '/user/followers/[userId]',
                                                    params: { userId: backendUser.id, tab: 'followers' }
                                                });
                                            }
                                        }}
                                    >
                                        <Text style={styles.followText}>
                                            <Text style={styles.followCount}>{followerCount}</Text> Followers
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Add Cash Button */}
                                <TouchableOpacity
                                    style={styles.addCashButton}
                                    onPress={() => {
                                        if (backendUser?.walletAddress) {
                                            fundWallet({
                                                address: backendUser.walletAddress,
                                                amount: "0.2", // SOL
                                            });
                                        }
                                    }}
                                >
                                    <Ionicons name="add-circle-outline" size={18} color={Theme.textPrimary} />
                                    <Text style={styles.addCashText}>Add Cash</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Credit Card with Balance */}
                    <View style={styles.cardContainer}>
                        <CreditCard
                            tradesCount={trades.length}
                            balance={0.00}
                            walletAddress={profileData?.walletAddress || backendUser?.walletAddress || ""}
                        />
                    </View>

                    {/* Trades Section with Tabs */}
                    <View style={styles.tradesSection}>
                        {/* New Tab Header */}
                        <View style={styles.tabHeader}>
                            <TouchableOpacity
                                style={styles.tabHeaderItem}
                                onPress={() => animateToTab('active')}
                            >
                                <Text style={[
                                    styles.tabHeaderLabel,
                                    activeTab === 'active' && styles.tabHeaderLabelActive
                                ]}>
                                    Active ({activeTrades.length})
                                </Text>
                                {activeTab === 'active' && <View style={styles.tabHeaderIndicator} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.tabHeaderItem}
                                onPress={() => animateToTab('previous')}
                            >
                                <Text style={[
                                    styles.tabHeaderLabel,
                                    activeTab === 'previous' && styles.tabHeaderLabelActive
                                ]}>
                                    Previous ({previousTrades.length})
                                </Text>
                                {activeTab === 'previous' && <View style={styles.tabHeaderIndicator} />}
                            </TouchableOpacity>
                        </View>

                        {/* Animated Sliding List Container */}
                        <View style={styles.listContainer}>
                            <Animated.View
                                style={[
                                    styles.slidingContainer,
                                    { transform: [{ translateX: slideAnim }] }
                                ]}
                            >
                                {/* Active Trades List */}
                                <View style={styles.listPane}>
                                    {activeTrades.length === 0 ? (
                                        <View style={styles.emptyTrades}>
                                            <Ionicons name="bar-chart-outline" size={32} color={TEXT_DISABLED} />
                                            <Text style={styles.emptyText}>No active trades</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.tradesList}>
                                            {activeTrades.map((trade) => (
                                                <TouchableOpacity
                                                    key={trade.id}
                                                    style={styles.tradeItem}
                                                    onPress={() => router.push({
                                                        pathname: '/market/[ticker]',
                                                        params: { ticker: trade.marketTicker }
                                                    })}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.tradeLeft}>
                                                        <View style={[
                                                            styles.tradeSideBadge,
                                                            trade.side === 'yes' ? styles.tradeSideBadgeYes : styles.tradeSideBadgeNo
                                                        ]}>
                                                            <Text style={[
                                                                styles.tradeSideText,
                                                                trade.side === 'yes' ? styles.tradeSideTextYes : styles.tradeSideTextNo
                                                            ]}>
                                                                {trade.side.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.tradeInfo}>
                                                            <Text style={styles.tradeTicker} numberOfLines={1}>
                                                                {trade.marketTicker}
                                                            </Text>
                                                            <Text style={styles.tradeDate}>
                                                                {new Date(trade.createdAt).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.tradeAmount}>
                                                        ${parseFloat(trade.amount).toFixed(2)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* Previous Trades List */}
                                <View style={styles.listPane}>
                                    {previousTrades.length === 0 ? (
                                        <View style={styles.emptyTrades}>
                                            <Ionicons name="time-outline" size={32} color={TEXT_DISABLED} />
                                            <Text style={styles.emptyText}>No previous trades</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.tradesList}>
                                            {previousTrades.map((trade) => (
                                                <TouchableOpacity
                                                    key={trade.id}
                                                    style={styles.tradeItem}
                                                    onPress={() => router.push({
                                                        pathname: '/market/[ticker]',
                                                        params: { ticker: trade.marketTicker }
                                                    })}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.tradeLeft}>
                                                        <View style={[
                                                            styles.tradeSideBadge,
                                                            trade.side === 'yes' ? styles.tradeSideBadgeYes : styles.tradeSideBadgeNo
                                                        ]}>
                                                            <Text style={[
                                                                styles.tradeSideText,
                                                                trade.side === 'yes' ? styles.tradeSideTextYes : styles.tradeSideTextNo
                                                            ]}>
                                                                {trade.side.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.tradeInfo}>
                                                            <Text style={styles.tradeTicker} numberOfLines={1}>
                                                                {trade.marketTicker}
                                                            </Text>
                                                            <Text style={styles.tradeDate}>
                                                                {new Date(trade.createdAt).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.tradeAmount}>
                                                        ${parseFloat(trade.amount).toFixed(2)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </Animated.View>
                        </View>
                    </View>

                    {/* Spacer for bottom navigation */}
                    <View style={{ height: 80 }} />
                </ScrollView>
            </SafeAreaView>

            {/* Settings Sheet */}
            <SettingsSheet
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                onSwitchTheme={() => {
                    // TODO: Implement theme switching logic
                    console.log("Switch theme clicked");
                }}
                onLogout={handleLogout}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_MAIN,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 20,
    },
    // Profile Header Section
    profileHeader: {
        marginBottom: 24,
        paddingTop: 16,
    },
    logoutContainer: {
        alignItems: 'flex-end',
        marginBottom: 20,
    },
    profileMainRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 16,
    },
    profileInfo: {
        flex: 1,
        paddingTop: 4,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        position: 'relative',
    },
    avatarInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: BG_CARD,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },

    headerBtn: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    name: {
        fontSize: 20,
        fontWeight: '700',
        color: TEXT_PRIMARY,
        marginBottom: 12,
    },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    username: {
        fontSize: 13,
        color: TEXT_SECONDARY,
    },
    twitterIcon: {
        opacity: 0.8,
    },
    followRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 8,
    },
    followText: {
        fontSize: 16,
        color: TEXT_SECONDARY,
    },
    followCount: {
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
    addCashButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: 'transparent',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: Theme.textPrimary,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    addCashText: {
        fontSize: 13,
        fontWeight: '600',
        color: Theme.textPrimary,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 12,
        color: TEXT_DISABLED,
    },
    // Card Container
    cardContainer: {
        marginBottom: 24,
    },
    // Trades Section
    tradesSection: {
        flex: 1,
    },
    tabHeader: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    tabHeaderItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    tabHeaderLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: TEXT_SECONDARY,
    },
    tabHeaderLabelActive: {
        color: TEXT_PRIMARY,
        fontWeight: '600',
    },
    tabHeaderIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: Theme.textPrimary,
    },
    listContainer: {
        width: SCREEN_WIDTH - 40, // Match content padding
        overflow: 'hidden',
    },
    slidingContainer: {
        flexDirection: 'row',
        width: (SCREEN_WIDTH - 40) * 2,
    },
    listPane: {
        width: SCREEN_WIDTH - 40,
    },
    emptyTrades: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: TEXT_DISABLED,
    },
    tradesList: {
        backgroundColor: BG_CARD,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BORDER,
    },
    tradeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    tradeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    tradeSideBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 10,
    },
    tradeSideBadgeYes: {
        backgroundColor: Theme.textPrimary,
    },
    tradeSideBadgeNo: {
        backgroundColor: Theme.bgMain,
        borderWidth: 1.5,
        borderColor: Theme.textPrimary,
    },
    tradeSideText: {
        fontSize: 11,
        fontWeight: '700',
    },
    tradeSideTextYes: {
        color: Theme.textInverse,
    },
    tradeSideTextNo: {
        color: Theme.textPrimary,
    },
    tradeInfo: {
        flex: 1,
    },
    tradeTicker: {
        fontSize: 14,
        fontWeight: '500',
        color: TEXT_PRIMARY,
        marginBottom: 2,
    },
    tradeDate: {
        fontSize: 12,
        color: TEXT_DISABLED,
    },
    tradeAmount: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
});
