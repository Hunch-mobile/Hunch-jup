import CreditCard from "@/components/CreditCard";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Trade Item Component
const TradeItem = ({ trade, onPress }: { trade: Trade; onPress: () => void }) => {
    const isYes = trade.side === 'yes';

    return (
        <TouchableOpacity style={styles.tradeItem} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.tradeLeft}>
                <View style={[
                    styles.tradeSideBadge,
                    isYes ? styles.tradeSideBadgeYes : styles.tradeSideBadgeNo
                ]}>
                    <Ionicons
                        name={isYes ? "trending-up" : "trending-down"}
                        size={12}
                        color={isYes ? "#4ade80" : "#f87171"}
                    />
                    <Text style={[
                        styles.tradeSideText,
                        isYes ? styles.tradeSideTextYes : styles.tradeSideTextNo
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
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </Text>
                </View>
            </View>
            <View style={styles.tradeRight}>
                <Text style={styles.tradeAmount}>
                    ${parseFloat(trade.amount).toFixed(2)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </View>
        </TouchableOpacity>
    );
};

export default function ProfileScreen() {
    const { user, logout } = usePrivy();
    const { backendUser, setBackendUser } = useUser();
    const router = useRouter();
    const [profileData, setProfileData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [showAllTrades, setShowAllTrades] = useState(false);

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

    const walletAccount = user?.linked_accounts?.find((a: any) => a.type === 'wallet' || a.type === 'embedded_wallet');
    const walletAddress = (walletAccount as any)?.address;
    const formattedAddress = walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : "No wallet connected";

    const displayName = profileData?.displayName || backendUser?.displayName || "User";
    const followerCount = profileData?.followerCount || 0;
    const followingCount = profileData?.followingCount || 0;

    const displayedTrades = showAllTrades ? trades : trades.slice(0, 5);

    if (isLoading) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={["#0a0a0f", "#0d0d14", "#111118"]}
                    style={styles.gradient}
                />
                <SafeAreaView style={styles.safeArea}>
                    <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
                        <ActivityIndicator size="large" color="#4ade80" />
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#0a0a0f", "#0d0d14", "#111118"]}
                style={styles.gradient}
            />
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.headerBtn}>
                            <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
                            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Header Card */}
                    <View style={styles.profileCard}>
                        {/* Avatar with Glow */}
                        <View style={styles.avatarWrapper}>
                            <LinearGradient
                                colors={['#4ade80', '#22c55e', '#16a34a']}
                                style={styles.avatarGlow}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            <View style={styles.avatarInner}>
                                <Text style={styles.avatarText}>
                                    {displayName.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        {/* Name & Wallet */}
                        <Text style={styles.name}>{displayName}</Text>

                        <TouchableOpacity style={styles.walletBadge} activeOpacity={0.7}>
                            <Ionicons name="wallet-outline" size={14} color="#4ade80" />
                            <Text style={styles.walletText}>{formattedAddress}</Text>
                            <Ionicons name="copy-outline" size={12} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <TouchableOpacity
                                style={styles.statBox}
                                onPress={() => {
                                    if (backendUser?.id) {
                                        router.push({
                                            pathname: '/user/followers/[userId]',
                                            params: { userId: backendUser.id, tab: 'following' }
                                        });
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.statNumber}>{followingCount}</Text>
                                <Text style={styles.statLabel}>Following</Text>
                            </TouchableOpacity>

                            <View style={styles.statDivider} />

                            <TouchableOpacity
                                style={styles.statBox}
                                onPress={() => {
                                    if (backendUser?.id) {
                                        router.push({
                                            pathname: '/user/followers/[userId]',
                                            params: { userId: backendUser.id, tab: 'followers' }
                                        });
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.statNumber}>{followerCount}</Text>
                                <Text style={styles.statLabel}>Followers</Text>
                            </TouchableOpacity>

                            <View style={styles.statDivider} />

                            <View style={styles.statBox}>
                                <Text style={styles.statNumber}>{trades.length}</Text>
                                <Text style={styles.statLabel}>Trades</Text>
                            </View>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
                                <Text style={styles.editBtnText}>Edit Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.7}>
                                <Ionicons name="share-outline" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Balance Card */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Balance</Text>
                        </View>
                        <CreditCard tradesCount={trades.length} />
                    </View>

                    {/* Trades Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Your Trades</Text>
                            {trades.length > 5 && (
                                <TouchableOpacity
                                    onPress={() => setShowAllTrades(!showAllTrades)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.showAllText}>
                                        {showAllTrades ? 'Show Less' : `Show All (${trades.length})`}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {trades.length === 0 ? (
                            <View style={styles.emptyTrades}>
                                <Ionicons name="bar-chart-outline" size={40} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyTradesText}>No trades yet</Text>
                                <Text style={styles.emptyTradesSubtext}>
                                    Start trading to see your positions here
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.tradesList}>
                                {displayedTrades.map((trade) => (
                                    <TradeItem
                                        key={trade.id}
                                        trade={trade}
                                        onPress={() => router.push({
                                            pathname: '/market/[ticker]',
                                            params: { ticker: trade.marketTicker }
                                        })}
                                    />
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Spacer for bottom navigation */}
                    <View style={{ height: 100 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0a0a0f",
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.5,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    content: {
        paddingHorizontal: 20,
    },
    profileCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginBottom: 20,
    },
    avatarWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        marginBottom: 16,
        position: 'relative',
    },
    avatarGlow: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
        opacity: 0.3,
    },
    avatarInner: {
        position: 'absolute',
        top: 3,
        left: 3,
        right: 3,
        bottom: 3,
        borderRadius: 45,
        backgroundColor: '#0d0d14',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(74, 222, 128, 0.3)',
    },
    avatarText: {
        fontSize: 36,
        fontWeight: '700',
        color: '#4ade80',
    },
    name: {
        fontSize: 26,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    walletBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.08)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 100,
        gap: 8,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.15)',
    },
    walletText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
        fontFamily: 'monospace',
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        width: '100%',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    editBtn: {
        flex: 1,
        backgroundColor: '#fff',
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editBtnText: {
        color: '#0a0a0f',
        fontWeight: '600',
        fontSize: 15,
    },
    shareBtn: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    section: {
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        letterSpacing: -0.3,
    },
    showAllText: {
        fontSize: 14,
        color: '#4ade80',
        fontWeight: '500',
    },
    tradesList: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    tradeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    tradeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    tradeSideBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 12,
    },
    tradeSideBadgeYes: {
        backgroundColor: 'rgba(74, 222, 128, 0.12)',
    },
    tradeSideBadgeNo: {
        backgroundColor: 'rgba(248, 113, 113, 0.12)',
    },
    tradeSideText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    tradeSideTextYes: {
        color: '#4ade80',
    },
    tradeSideTextNo: {
        color: '#f87171',
    },
    tradeInfo: {
        flex: 1,
    },
    tradeTicker: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    tradeDate: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.4)',
    },
    tradeRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tradeAmount: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    emptyTrades: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    emptyTradesText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: 12,
    },
    emptyTradesSubtext: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.4)',
        marginTop: 4,
        textAlign: 'center',
    },
});
