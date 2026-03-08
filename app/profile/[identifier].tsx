import CopySettingsModal from "@/components/CopySettingsModal";
import PolymarketPositionCard from "@/components/PolymarketPositionCard";
import { Skeleton } from "@/components/Skeleton";
import { PositionsSkeleton } from "@/components/skeletons";
import { Theme } from "@/constants/theme";
import { useUser } from "@/contexts/UserContext";
import { useCopyTrading } from "@/hooks/useCopyTrading";
import { followApi, polymarketApi, profilesApi } from "@/lib/api";
import { ExternalProfile, HunchProfile, PolymarketClosedPosition, PolymarketPosition, UnifiedProfile } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const defaultProfileImage = require("@/assets/default.jpeg");
const hunchBadge = require("@/assets/icon-blue.png");
const xLogo = require("../../../xlogo.png");

const YELLOW = '#FACC15';
const YELLOW_DARK = '#EAB308';

type TabType = 'active' | 'previous';

const formatCurrency = (value: number | null | undefined, compact = false) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    if (compact) {
        if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
};

export default function UnifiedProfileScreen() {
    const { identifier } = useLocalSearchParams<{ identifier: string }>();
    const { backendUser } = useUser();
    const insets = useSafeAreaInsets();

    const [profile, setProfile] = useState<UnifiedProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followLoading, setFollowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('active');

    // Polymarket positions (for external profiles)
    const [positions, setPositions] = useState<PolymarketPosition[]>([]);
    const [closedPositions, setClosedPositions] = useState<PolymarketClosedPosition[]>([]);
    const [positionsLoading, setPositionsLoading] = useState(true);

    // Copy trading
    const { copySettings, fetchAllCopySettings } = useCopyTrading();
    const [isCopying, setIsCopying] = useState(false);
    const [copyModalVisible, setCopyModalVisible] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;
    const indicatorAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const tabWidth = (SCREEN_WIDTH - 40) / 2;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    const loadProfile = useCallback(async () => {
        if (!identifier) return;

        try {
            setLoading(true);
            setError(null);

            const viewerId = backendUser?.id;
            const profileData = await profilesApi.getProfile(identifier, viewerId);
            setProfile(profileData);

            // If external profile, load Polymarket positions
            if (profileData.profileType === 'external') {
                loadPolymarketPositions(profileData.walletAddress);
            } else {
                setPositionsLoading(false);
            }
        } catch (err: any) {
            console.error('Failed to load profile:', err);
            setError(err.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, [identifier, backendUser?.id]);

    const loadPolymarketPositions = async (walletAddress: string) => {
        try {
            setPositionsLoading(true);
            const [activeRes, closedRes] = await Promise.all([
                polymarketApi.getPositions({
                    user: walletAddress,
                    sortBy: 'CASHPNL',
                    sortDirection: 'DESC',
                    limit: 50,
                }),
                polymarketApi.getClosedPositions({
                    user: walletAddress,
                    sortBy: 'REALIZEDPNL',
                    sortDirection: 'DESC',
                    limit: 20,
                }),
            ]);
            setPositions(activeRes.positions);
            setClosedPositions(closedRes.positions);
        } catch (err) {
            console.error('Failed to load Polymarket positions:', err);
        } finally {
            setPositionsLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        if (copySettings && profile?.id) {
            setIsCopying(copySettings.some(s => s.leaderId === profile.id));
        }
    }, [copySettings, profile?.id]);

    const animateToTab = useCallback((tab: TabType) => {
        Animated.spring(slideAnim, {
            toValue: tab === 'active' ? 0 : -SCREEN_WIDTH + 40,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
        Animated.timing(indicatorAnim, {
            toValue: tab === 'active' ? 0 : tabWidth,
            duration: 260,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
        }).start();
        setActiveTab(tab);
    }, [slideAnim, indicatorAnim, tabWidth]);

    const handleFollow = async () => {
        if (!profile || profile.isOwnProfile || followLoading) return;

        const wasFollowing = profile.isFollowing;
        
        // Optimistic update
        setProfile(prev => prev ? { ...prev, isFollowing: !wasFollowing, followerCount: prev.followerCount + (wasFollowing ? -1 : 1) } : prev);
        setFollowLoading(true);

        try {
            if (profile.profileType === 'hunch') {
                if (wasFollowing) {
                    await followApi.unfollowHunchUser(profile.id);
                } else {
                    await followApi.followHunchUser(profile.id);
                }
            } else {
                if (wasFollowing) {
                    await followApi.unfollowExternalProfile(profile.walletAddress);
                } else {
                    await followApi.followExternalProfile({ walletAddress: profile.walletAddress });
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('Failed to follow/unfollow:', err);
            // Revert on error
            setProfile(prev => prev ? { ...prev, isFollowing: wasFollowing, followerCount: prev.followerCount + (wasFollowing ? 1 : -1) } : prev);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleOpenX = (xUsername: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Linking.openURL(`https://x.com/${xUsername}`);
    };

    if (error || (!loading && !profile)) {
        return (
            <View className="flex-1 bg-app-bg">
                <SafeAreaView className="flex-1">
                    <View className="flex-1 justify-center items-center px-10">
                        <Ionicons name="alert-circle-outline" size={64} color={Theme.error} />
                        <Text className="text-status-error text-base mt-4 mb-3 text-center">{error || "Profile not found"}</Text>
                        <TouchableOpacity className="bg-app-card py-2.5 px-5 rounded-lg" onPress={loadProfile}>
                            <Text className="text-txt-primary text-sm font-semibold">Retry</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    const isLikelyExternal = /^0x[0-9a-fA-F]+$/i.test(identifier || '');
    const isExternal = profile !== null ? profile.profileType === 'external' : isLikelyExternal;
    const externalProfile = profile as ExternalProfile;
    const hunchProfile = profile as HunchProfile;
    const showCopyButton = !!(profile && isExternal && !profile.isOwnProfile && backendUser && profile.isFollowing);

    const rawDisplayName = profile ? (profile.displayName ||
        (isExternal ? `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}` : hunchProfile.username) ||
        `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`) : '';
    const displayName = /^0x[0-9a-fA-F]{10,}/.test(rawDisplayName)
        ? `${rawDisplayName.slice(0, 5)}...${rawDisplayName.slice(-3)}`
        : rawDisplayName;

    const username = profile ? (isExternal
        ? (externalProfile.xUsername ? `@${externalProfile.xUsername}` : null)
        : (hunchProfile.username ? `@${hunchProfile.username}` : null)) : null;

    const profileImageUrl = profile?.avatarUrl?.replace('_normal', '');

    return (
        <View className="flex-1 bg-app-bg">
            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView
                    contentContainerStyle={{
                        paddingTop: 20,
                        paddingHorizontal: 20,
                        paddingBottom: showCopyButton ? insets.bottom + 88 : 24,
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Header */}
                    <View className="flex-row items-start gap-4 mb-5">
                        {loading ? (
                            <>
                                <Skeleton width={64} height={64} borderRadius={999} />
                                <View className="flex-1 pt-1 gap-3">
                                    <Skeleton width={160} height={24} borderRadius={6} />
                                    <Skeleton width={110} height={18} borderRadius={4} />
                                    <View className="flex-row gap-5">
                                        <Skeleton width={80} height={18} borderRadius={4} />
                                    </View>
                                    <Skeleton width={100} height={40} borderRadius={12} />
                                </View>
                            </>
                        ) : (
                        <>
                        {/* Avatar with Badge */}
                        <View className="relative">
                            <View className="w-16 h-16 rounded-full bg-app-card justify-center items-center overflow-hidden"
                                style={{ borderWidth: 2, borderColor: YELLOW }}
                            >
                                <Image
                                    source={profileImageUrl ? { uri: profileImageUrl } : defaultProfileImage}
                                    style={{ width: '100%', height: '100%', borderRadius: 32 }}
                                    contentFit="cover"
                                />
                            </View>
                            {/* Hunch Badge instead of Polymarket tag */}
                            {isExternal && (
                                <View className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white items-center justify-center"
                                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3 }}
                                >
                                    <Image
                                        source={hunchBadge}
                                        style={{ width: 20, height: 20, borderRadius: 10 }}
                                        contentFit="cover"
                                    />
                                </View>
                            )}
                        </View>

                        {/* Info */}
                        <View className="flex-1 pt-1">
                            <View className="flex-row items-center gap-2 mb-1">
                                <Text className="text-xl font-bold text-txt-primary" numberOfLines={1}>
                                    {displayName}
                                </Text>
                                {isExternal && externalProfile.verifiedBadge && (
                                    <Ionicons name="checkmark-circle" size={18} color={YELLOW_DARK} />
                                )}
                            </View>

                            {username && (
                                <TouchableOpacity
                                    className="flex-row items-center gap-1.5 mb-2"
                                    onPress={() => isExternal && externalProfile.xUsername ? handleOpenX(externalProfile.xUsername) : null}
                                    disabled={!isExternal || !externalProfile.xUsername}
                                    activeOpacity={isExternal && externalProfile.xUsername ? 0.7 : 1}
                                >
                                    <Text className="text-base text-txt-secondary">
                                        {username}
                                    </Text>
                                    {isExternal && externalProfile.xUsername && (
                                        <Image
                                            source={xLogo}
                                            style={{ width: 18, height: 18 }}
                                            contentFit="contain"
                                        />
                                    )}
                                </TouchableOpacity>
                            )}

                            {/* Source Badge replaced by Hunch icon badge on avatar — removed tag here */}

                            {/* Follower/Following Counts */}
                            <View className="flex-row gap-5 mb-3">
                                <Text className="text-base text-txt-secondary">
                                    <Text className="font-semibold text-txt-primary">{profile?.followerCount || 0}</Text> Followers
                                </Text>
                                {!isExternal && (
                                    <Text className="text-base text-txt-secondary">
                                        <Text className="font-semibold text-txt-primary">{profile?.followingCount || 0}</Text> Following
                                    </Text>
                                )}
                            </View>

                            {/* Follow Button */}
                            {!profile?.isOwnProfile && backendUser && (
                                <TouchableOpacity
                                    onPress={handleFollow}
                                    disabled={followLoading}
                                    className="flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-xl"
                                    style={{
                                        backgroundColor: profile?.isFollowing ? '#F3F4F6' : '#000',
                                    }}
                                >
                                    {followLoading ? (
                                        <ActivityIndicator size="small" color={profile?.isFollowing ? '#000' : '#fff'} />
                                    ) : (
                                        <Text className="text-sm font-semibold" style={{ color: profile?.isFollowing ? '#000' : '#fff' }}>
                                            {profile?.isFollowing ? 'Following' : 'Follow'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                        </>
                        )}
                    </View>

                    {/* Stats Card for External Profile */}
                    {loading && isLikelyExternal && (
                        <View className="flex-row rounded-2xl px-4 py-4 mb-6"
                            style={{ backgroundColor: `${YELLOW}12`, borderWidth: 1, borderColor: `${YELLOW}30` }}
                        >
                            <View className="flex-1 gap-2">
                                <Skeleton width={60} height={12} borderRadius={4} />
                                <Skeleton width={90} height={22} borderRadius={6} />
                            </View>
                            <View style={{ width: 1, backgroundColor: `${YELLOW}40`, marginHorizontal: 12 }} />
                            <View className="flex-1 gap-2">
                                <Skeleton width={60} height={12} borderRadius={4} />
                                <Skeleton width={90} height={22} borderRadius={6} />
                            </View>
                        </View>
                    )}
                    {!loading && isExternal && (externalProfile.cachedPnl !== null || externalProfile.cachedVolume !== null) && (
                        <View className="flex-row rounded-2xl px-4 py-4 mb-6"
                            style={{ backgroundColor: `${YELLOW}12`, borderWidth: 1, borderColor: `${YELLOW}30` }}
                        >
                            {externalProfile.cachedPnl !== null && (
                                <View className="flex-1">
                                    <Text className="text-xs text-txt-secondary mb-1">Total PnL</Text>
                                    <Text className="text-lg font-bold" style={{
                                        color: externalProfile.cachedPnl >= 0 ? '#16A34A' : '#DC2626',
                                    }}>
                                        {externalProfile.cachedPnl >= 0 ? '+' : ''}{formatCurrency(externalProfile.cachedPnl, true)}
                                    </Text>
                                </View>
                            )}
                            {externalProfile.cachedPnl !== null && externalProfile.cachedVolume !== null && (
                                <View style={{ width: 1, backgroundColor: `${YELLOW}40`, marginHorizontal: 12 }} />
                            )}
                            {externalProfile.cachedVolume !== null && (
                                <View className="flex-1">
                                    <Text className="text-xs text-txt-secondary mb-1">Volume</Text>
                                    <Text className="text-lg font-bold text-txt-primary">
                                        {formatCurrency(externalProfile.cachedVolume, true)}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Win Rate Card (replaces bio) */}
                    {isExternal && closedPositions.length > 0 && (() => {
                        const wins = closedPositions.filter(p => p.realizedPnl > 0).length;
                        const total = closedPositions.length;
                        const winRate = total > 0 ? (wins / total) * 100 : 0;
                        const avgWin = wins > 0
                            ? closedPositions.filter(p => p.realizedPnl > 0).reduce((s, p) => s + p.realizedPnl, 0) / wins
                            : 0;
                        const losses = total - wins;
                        const avgLoss = losses > 0
                            ? Math.abs(closedPositions.filter(p => p.realizedPnl <= 0).reduce((s, p) => s + p.realizedPnl, 0) / losses)
                            : 0;
                        const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 1;
                        // Only show win rate when there's enough data to be meaningful (at least one loss)
                        const showWinRate = losses > 0;
                        return (
                            <View className="rounded-2xl px-4 py-4 mb-6" style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6' }}>
                                <Text className="text-xs font-semibold text-txt-disabled uppercase mb-3">Performance</Text>
                                <View className="flex-row justify-between">
                                    {showWinRate && (
                                        <View className="items-center">
                                            <Text className="text-lg font-bold" style={{ color: winRate >= 50 ? '#16A34A' : '#DC2626' }}>
                                                {winRate.toFixed(0)}%
                                            </Text>
                                            <Text className="text-[11px] text-txt-disabled mt-0.5">Win Rate</Text>
                                        </View>
                                    )}
                                    <View className="items-center">
                                        <Text className="text-lg font-bold text-txt-primary">{wins}/{total}</Text>
                                        <Text className="text-[11px] text-txt-disabled mt-0.5">W/L</Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-lg font-bold" style={{ color: avgWin > 0 ? '#16A34A' : Theme.textSecondary }}>
                                            ${avgWin >= 1000 ? `${(avgWin/1000).toFixed(1)}K` : avgWin.toFixed(0)}
                                        </Text>
                                        <Text className="text-[11px] text-txt-disabled mt-0.5">Avg Win</Text>
                                    </View>
                                    <View className="items-center">
                                        <Text className="text-lg font-bold text-txt-primary">
                                            {profitFactor >= 99 ? '∞' : profitFactor.toFixed(1)}x
                                        </Text>
                                        <Text className="text-[11px] text-txt-disabled mt-0.5">PF</Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })()}

                    {/* Positions Section for External Profiles */}
                    {isExternal && (
                        <View className="flex-1">
                            {/* Tab Header */}
                            <View className="mb-4 flex-row items-center justify-between">
                                {/* Underline tab header matching (tabs)/profile.tsx */}
                                <View className="flex-1">
                                    <View className="flex-row relative border-b border-border/30 pb-1">
                                        {/* Animated sliding underline */}
                                        <Animated.View
                                            style={{
                                                position: 'absolute',
                                                bottom: -1,
                                                left: 0,
                                                height: 2,
                                                width: tabWidth,
                                                backgroundColor: '#000000',
                                                transform: [{ translateX: indicatorAnim }],
                                            }}
                                        />
                                        <TouchableOpacity
                                            className="flex-1 items-center py-3"
                                            onPress={() => animateToTab('active')}
                                            activeOpacity={0.6}
                                        >
                                            <View className="flex-row items-center gap-2">
                                                {activeTab === 'active' && (
                                                    <Animated.View
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: 4,
                                                            backgroundColor: Theme.success,
                                                            opacity: pulseAnim,
                                                            transform: [{ scale: pulseAnim }],
                                                        }}
                                                    />
                                                )}
                                                <Text
                                                    className="text-base font-bold"
                                                    style={{ color: activeTab === 'active' ? Theme.textPrimary : Theme.textSecondary }}
                                                >
                                                    ACTIVE{activeTab === 'active' ? ` (${positions.length})` : ''}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            className="flex-1 items-center py-3"
                                            onPress={() => animateToTab('previous')}
                                            activeOpacity={0.6}
                                        >
                                            <Text
                                                className="text-base font-bold"
                                                style={{ color: activeTab === 'previous' ? Theme.textPrimary : Theme.textSecondary }}
                                            >
                                                CLOSED{activeTab === 'previous' ? ` (${closedPositions.length})` : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Sliding Lists */}
                            <View style={styles.listContainer}>
                                <Animated.View style={[styles.slidingContainer, { transform: [{ translateX: slideAnim }] }]}>
                                    {/* Active Positions */}
                                    <View style={styles.listPane}>
                                        {positionsLoading ? (
                                            <PositionsSkeleton />
                                        ) : positions.length === 0 ? (
                                            <View className="p-10 items-center gap-3">
                                                <Ionicons name="bar-chart-outline" size={32} color={Theme.textDisabled} />
                                                <Text className="text-sm text-txt-disabled">No active positions</Text>
                                            </View>
                                        ) : (
                                            <View>
                                                {positions.map((position) => (
                                                    <PolymarketPositionCard
                                                        key={`${position.conditionId}-${position.outcomeIndex}`}
                                                        position={position}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    {/* Closed Positions */}
                                    <View style={styles.listPane}>
                                        {positionsLoading ? (
                                            <PositionsSkeleton />
                                        ) : closedPositions.length === 0 ? (
                                            <View className="p-10 items-center gap-3">
                                                <Ionicons name="time-outline" size={32} color={Theme.textDisabled} />
                                                <Text className="text-sm text-txt-disabled">No closed positions</Text>
                                            </View>
                                        ) : (
                                            <View>
                                                {closedPositions.map((position) => (
                                                    <PolymarketPositionCard
                                                        key={`${position.conditionId}-${position.outcomeIndex}`}
                                                        position={position}
                                                        isClosed
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </Animated.View>
                            </View>
                        </View>
                    )}

                    {/* For Hunch profiles, redirect to existing user profile */}
                    {!isExternal && profile && (
                        <View className="p-6 items-center">
                            <TouchableOpacity
                                onPress={() => router.replace({ pathname: '/user/[userId]', params: { userId: profile.id } })}
                                className="px-6 py-3 rounded-xl"
                                style={{ backgroundColor: YELLOW }}
                            >
                                <Text className="font-semibold" style={{ color: '#000' }}>View Full Profile</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* Fixed Copy Trade button at bottom center (only when viewing an external profile and following) */}
            {showCopyButton && (
                <View
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        paddingBottom: insets.bottom + 16,
                        alignItems: 'center',
                    }}
                    pointerEvents="box-none"
                >
                    <TouchableOpacity
                        className={`flex-row items-center gap-2 px-6 py-3.5 rounded-xl ${isCopying ? 'bg-green-500' : 'bg-black'}`}
                        onPress={() => {
                            Haptics.selectionAsync();
                            setCopyModalVisible(true);
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name={isCopying ? "checkmark-circle" : "copy-outline"} size={18} color="white" />
                        <Text className="text-base font-semibold text-white">{isCopying ? 'Copying' : 'Copy Trade'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Copy Settings Modal */}
            <CopySettingsModal
                isOpen={copyModalVisible}
                onClose={() => setCopyModalVisible(false)}
                leaderId={profile?.id ?? ''}
                leaderName={profile?.displayName || 'User'}
                onSave={() => {
                    fetchAllCopySettings();
                    setCopyModalVisible(false);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listContainer: {
        width: SCREEN_WIDTH - 40,
        overflow: 'hidden',
    },
    slidingContainer: {
        flexDirection: 'row',
        width: (SCREEN_WIDTH - 40) * 2,
    },
    listPane: {
        width: SCREEN_WIDTH - 40,
    },
});
