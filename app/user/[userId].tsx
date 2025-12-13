import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Trade, User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TabType = 'active' | 'history';

export default function UserProfileScreen() {
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { backendUser: currentUser } = useUser();
    
    const [profile, setProfile] = useState<User | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [tradesLoading, setTradesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('active');

    const isOwnProfile = currentUser?.id === userId;

    useEffect(() => {
        if (userId) {
            loadProfile();
            loadTrades();
            if (currentUser && !isOwnProfile) {
                checkFollowStatus();
            }
        }
    }, [userId, currentUser]);

    const loadProfile = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getUser(userId as string);
            setProfile(data);
        } catch (err: any) {
            console.error("Failed to fetch profile:", err);
            setError(err.message || "Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const loadTrades = async () => {
        try {
            setTradesLoading(true);
            const data = await api.getUserTrades(userId as string, 50);
            setTrades(data);
        } catch (err) {
            console.error("Failed to fetch trades:", err);
        } finally {
            setTradesLoading(false);
        }
    };

    const checkFollowStatus = async () => {
        if (!currentUser) return;
        
        try {
            const following = await api.getFollowing(currentUser.id);
            setIsFollowing(following.some(f => f.followingId === userId));
        } catch (err) {
            console.error("Failed to check follow status:", err);
        }
    };

    const handleFollow = async () => {
        if (!currentUser || isOwnProfile || followLoading) return;

        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setFollowLoading(true);

        try {
            if (wasFollowing) {
                await api.unfollowUser(currentUser.id, userId as string);
                setProfile(prev => prev ? { 
                    ...prev, 
                    followerCount: Math.max(0, prev.followerCount - 1) 
                } : prev);
            } else {
                await api.followUser(currentUser.id, userId as string);
                setProfile(prev => prev ? { 
                    ...prev, 
                    followerCount: prev.followerCount + 1 
                } : prev);
            }
        } catch (error) {
            console.error("Failed to follow/unfollow:", error);
            setIsFollowing(wasFollowing);
        } finally {
            setFollowLoading(false);
        }
    };

    const renderTradeItem = ({ item }: { item: Trade }) => (
        <View style={styles.tradeItem}>
            <View style={styles.tradeHeader}>
                <View style={[
                    styles.sideBadge,
                    item.side === 'yes' ? styles.sideBadgeYes : styles.sideBadgeNo
                ]}>
                    <Text style={[
                        styles.sideText,
                        item.side === 'yes' ? styles.sideTextYes : styles.sideTextNo
                    ]}>
                        {item.side.toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.tradeDate}>
                    {new Date(item.createdAt).toLocaleDateString()}
                </Text>
            </View>
            <TouchableOpacity 
                onPress={() => router.push({ 
                    pathname: '/market/[ticker]', 
                    params: { ticker: item.marketTicker } 
                })}
            >
                <Text style={styles.tradeTicker}>{item.marketTicker}</Text>
            </TouchableOpacity>
            <View style={styles.tradeFooter}>
                <Text style={styles.tradeAmount}>${parseFloat(item.amount).toFixed(2)}</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.4)" />
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={["#0a0a0f", "#12121a", "#1a1a2e"]} style={styles.gradient} />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#4ade80" />
                        <Text style={styles.loadingText}>Loading profile...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    if (error || !profile) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={["#0a0a0f", "#12121a", "#1a1a2e"]} style={styles.gradient} />
                <SafeAreaView style={styles.safeArea}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <View style={styles.centerContainer}>
                        <Ionicons name="alert-circle-outline" size={64} color="#f87171" />
                        <Text style={styles.errorText}>{error || "User not found"}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    const displayName = profile.displayName || `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`;

    return (
        <View style={styles.container}>
            <LinearGradient colors={["#0a0a0f", "#12121a", "#1a1a2e"]} style={styles.gradient} />
            
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Profile Card */}
                    <View style={styles.profileCard}>
                        {/* Avatar and Basic Info */}
                        <View style={styles.profileHeader}>
                            {profile.avatarUrl ? (
                                <Image
                                    source={{ uri: profile.avatarUrl }}
                                    style={styles.avatar}
                                    contentFit="cover"
                                />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarText}>
                                        {displayName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.profileInfo}>
                                <Text style={styles.displayName}>{displayName}</Text>
                                <Text style={styles.walletAddress}>
                                    {profile.walletAddress.slice(0, 8)}...{profile.walletAddress.slice(-6)}
                                </Text>

                                {/* Stats */}
                                <View style={styles.stats}>
                                    <TouchableOpacity 
                                        style={styles.statItem}
                                        onPress={() => router.push({ 
                                            pathname: '/user/followers/[userId]', 
                                            params: { userId: userId as string, tab: 'followers' } 
                                        })}
                                    >
                                        <Text style={styles.statValue}>{profile.followerCount}</Text>
                                        <Text style={styles.statLabel}>Followers</Text>
                                    </TouchableOpacity>
                                    <View style={styles.statDivider} />
                                    <TouchableOpacity 
                                        style={styles.statItem}
                                        onPress={() => router.push({ 
                                            pathname: '/user/followers/[userId]', 
                                            params: { userId: userId as string, tab: 'following' } 
                                        })}
                                    >
                                        <Text style={styles.statValue}>{profile.followingCount}</Text>
                                        <Text style={styles.statLabel}>Following</Text>
                                    </TouchableOpacity>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{trades.length}</Text>
                                        <Text style={styles.statLabel}>Trades</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Follow Button */}
                        {!isOwnProfile && currentUser && (
                            <TouchableOpacity
                                style={[
                                    styles.followButton,
                                    isFollowing && styles.followingButton
                                ]}
                                onPress={handleFollow}
                                disabled={followLoading}
                            >
                                {followLoading ? (
                                    <ActivityIndicator size="small" color={isFollowing ? "#fff" : "#000"} />
                                ) : (
                                    <Text style={[
                                        styles.followButtonText,
                                        isFollowing && styles.followingButtonText
                                    ]}>
                                        {isFollowing ? "Following" : "Follow"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}

                        {/* Stats Card */}
                        <View style={styles.statsCard}>
                            <LinearGradient
                                colors={["rgba(74, 222, 128, 0.1)", "rgba(34, 197, 94, 0.05)"]}
                                style={styles.statsGradient}
                            >
                                <View style={styles.statsRow}>
                                    <View style={styles.statsCol}>
                                        <Text style={styles.statsLabel}>Cash Balance</Text>
                                        <Text style={styles.statsValue}>$300</Text>
                                    </View>
                                    <View style={styles.statsCol}>
                                        <Text style={styles.statsLabel}>P&L</Text>
                                        <Text style={[styles.statsValue, styles.statsValueNegative]}>
                                            -12.50%
                                        </Text>
                                    </View>
                                </View>
                            </LinearGradient>
                        </View>
                    </View>

                    {/* Trades Section */}
                    <View style={styles.tradesSection}>
                        <Text style={styles.sectionTitle}>Recent Trades</Text>

                        {tradesLoading ? (
                            <View style={styles.tradesLoading}>
                                <ActivityIndicator size="small" color="#4ade80" />
                            </View>
                        ) : trades.length === 0 ? (
                            <View style={styles.emptyTrades}>
                                <Ionicons name="swap-horizontal-outline" size={48} color="rgba(255, 255, 255, 0.2)" />
                                <Text style={styles.emptyText}>No trades yet</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={trades}
                                keyExtractor={(item) => item.id}
                                renderItem={renderTradeItem}
                                scrollEnabled={false}
                                contentContainerStyle={styles.tradesList}
                            />
                        )}
                    </View>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButtonHeader: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    headerSpacer: {
        width: 40,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 20,
    },
    backText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
        marginTop: 12,
    },
    errorText: {
        color: '#f87171',
        fontSize: 16,
        marginTop: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    profileCard: {
        margin: 20,
        padding: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    profileHeader: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#4ade80',
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4ade80',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#4ade80',
    },
    profileInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    displayName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    walletAddress: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        fontFamily: 'monospace',
        marginBottom: 12,
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    followButton: {
        backgroundColor: '#4ade80',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    followingButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    followButtonText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '700',
    },
    followingButtonText: {
        color: '#fff',
    },
    statsCard: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    statsGradient: {
        padding: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statsCol: {
        alignItems: 'center',
    },
    statsLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    statsValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    statsValueNegative: {
        color: '#f87171',
    },
    tradesSection: {
        marginHorizontal: 20,
        marginBottom: 40,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
    },
    tradesLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyTrades: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
        marginTop: 12,
    },
    tradesList: {
        gap: 12,
    },
    tradeItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    tradeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sideBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    sideBadgeYes: {
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
    },
    sideBadgeNo: {
        backgroundColor: 'rgba(248, 113, 113, 0.2)',
    },
    sideText: {
        fontSize: 10,
        fontWeight: '700',
    },
    sideTextYes: {
        color: '#4ade80',
    },
    sideTextNo: {
        color: '#f87171',
    },
    tradeDate: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.4)',
    },
    tradeTicker: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    tradeFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tradeAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4ade80',
    },
});

