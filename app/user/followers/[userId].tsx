import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Follow } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Import theme from central location
import { Theme } from '@/constants/theme';

// Theme constants - Monochrome design
const ACCENT = Theme.textPrimary;
const BG_MAIN = Theme.bgMain;
const BG_CARD = Theme.bgCard;
const BG_ELEVATED = Theme.bgElevated;
const BORDER = Theme.border;
const TEXT_PRIMARY = Theme.textPrimary;
const TEXT_SECONDARY = Theme.textSecondary;
const TEXT_DISABLED = Theme.textDisabled;

type TabType = 'followers' | 'following';

interface UserItem {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    walletAddress: string;
    followerCount?: number;
    followingCount?: number;
}

export default function FollowersFollowingScreen() {
    const { userId, tab } = useLocalSearchParams<{ userId: string; tab?: string }>();
    const { backendUser } = useUser();

    const [activeTab, setActiveTab] = useState<TabType>((tab as TabType) || 'followers');
    const [followers, setFollowers] = useState<UserItem[]>([]);
    const [following, setFollowing] = useState<UserItem[]>([]);
    const [loadingFollowers, setLoadingFollowers] = useState(true);
    const [loadingFollowing, setLoadingFollowing] = useState(true);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

    // Animation values - initialize based on tab parameter
    const initialTab = (tab as TabType) || 'followers';
    const slideAnim = useRef(new Animated.Value(initialTab === 'following' ? -SCREEN_WIDTH : 0)).current;
    const activeTabRef = useRef<TabType>(initialTab);

    // Animate slide when tab changes
    const animateToTab = useCallback((toTab: TabType) => {
        const toValue = toTab === 'followers' ? 0 : -SCREEN_WIDTH;
        Animated.spring(slideAnim, {
            toValue,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();
        activeTabRef.current = toTab;
        setActiveTab(toTab);
    }, [slideAnim]);

    // Swipe gesture handling with proper ref access
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to horizontal swipes with enough movement
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 15;
            },
            onPanResponderMove: (_, gestureState) => {
                // Real-time dragging feedback
                const currentOffset = activeTabRef.current === 'followers' ? 0 : -SCREEN_WIDTH;
                const newValue = currentOffset + gestureState.dx;
                // Clamp the value between -SCREEN_WIDTH and 0
                const clampedValue = Math.max(-SCREEN_WIDTH, Math.min(0, newValue));
                slideAnim.setValue(clampedValue);
            },
            onPanResponderRelease: (_, gestureState) => {
                const threshold = SCREEN_WIDTH * 0.25; // 25% of screen width

                if (activeTabRef.current === 'followers') {
                    // On followers tab, check for left swipe
                    if (gestureState.dx < -threshold || (gestureState.dx < 0 && gestureState.vx < -0.5)) {
                        animateToTab('following');
                    } else {
                        // Snap back to followers
                        animateToTab('followers');
                    }
                } else {
                    // On following tab, check for right swipe
                    if (gestureState.dx > threshold || (gestureState.dx > 0 && gestureState.vx > 0.5)) {
                        animateToTab('followers');
                    } else {
                        // Snap back to following
                        animateToTab('following');
                    }
                }
            },
        })
    ).current;

    useEffect(() => {
        if (userId) {
            loadFollowers();
            loadFollowing();
            if (backendUser) {
                loadMyFollowingList();
            }
        }
    }, [userId, backendUser]);

    const loadFollowers = async () => {
        try {
            setLoadingFollowers(true);
            const data = await api.getFollowers(userId as string);
            const users = data.map((f: Follow) => ({
                id: f.follower.id,
                displayName: f.follower.displayName,
                avatarUrl: f.follower.avatarUrl,
                walletAddress: f.follower.walletAddress,
            }));
            setFollowers(users);
        } catch (err) {
            console.error("Failed to fetch followers:", err);
        } finally {
            setLoadingFollowers(false);
        }
    };

    const loadFollowing = async () => {
        try {
            setLoadingFollowing(true);
            const data = await api.getFollowing(userId as string);
            const users = data.map((f: Follow) => ({
                id: f.following.id,
                displayName: f.following.displayName,
                avatarUrl: f.following.avatarUrl,
                walletAddress: f.following.walletAddress,
            }));
            setFollowing(users);
        } catch (err) {
            console.error("Failed to fetch following:", err);
        } finally {
            setLoadingFollowing(false);
        }
    };

    const loadMyFollowingList = async () => {
        if (!backendUser) return;

        try {
            const data = await api.getFollowing(backendUser.id);
            const ids = new Set(data.map(f => f.followingId));
            setFollowingIds(ids);
        } catch (error) {
            console.error("Failed to load following list:", error);
        }
    };

    const handleFollowUser = async (targetUserId: string) => {
        if (!backendUser || followingInProgress.has(targetUserId)) return;

        setFollowingInProgress(prev => new Set([...prev, targetUserId]));

        try {
            const isFollowing = followingIds.has(targetUserId);

            if (isFollowing) {
                await api.unfollowUser(backendUser.id, targetUserId);
                setFollowingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(targetUserId);
                    return newSet;
                });
            } else {
                await api.followUser(backendUser.id, targetUserId);
                setFollowingIds(prev => new Set([...prev, targetUserId]));
            }
        } catch (error) {
            console.error("Failed to follow/unfollow user:", error);
        } finally {
            setFollowingInProgress(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUserId);
                return newSet;
            });
        }
    };

    const renderUserItem = ({ item }: { item: UserItem }) => {
        const isFollowing = followingIds.has(item.id);
        const inProgress = followingInProgress.has(item.id);
        const isSelf = backendUser?.id === item.id;

        const displayName = item.displayName || `${item.walletAddress.slice(0, 6)}...${item.walletAddress.slice(-4)}`;
        const username = `@${displayName.toLowerCase().replace(/\s/g, '')}`;

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.id } })}
                activeOpacity={0.7}
            >
                <View style={styles.userAvatar}>
                    {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                        <Text style={styles.userAvatarText}>
                            {displayName.charAt(0).toUpperCase()}
                        </Text>
                    )}
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{displayName}</Text>
                    <Text style={styles.userHandle}>{username}</Text>
                </View>
                {!isSelf && backendUser && (
                    <TouchableOpacity
                        style={[
                            styles.followButton,
                            isFollowing && styles.followingButton,
                            inProgress && styles.followButtonDisabled
                        ]}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleFollowUser(item.id);
                        }}
                        disabled={inProgress}
                    >
                        {inProgress ? (
                            <ActivityIndicator size="small" color={TEXT_PRIMARY} />
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
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>


            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <View style={styles.headerSpacer} />
                    <TouchableOpacity style={styles.shareButton}>
                        <Ionicons name="share-outline" size={20} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                </View>

                {/* Tab Header */}
                <View style={styles.tabHeader}>
                    <TouchableOpacity
                        style={styles.tabHeaderItem}
                        onPress={() => animateToTab('followers')}
                    >
                        <Text style={[
                            styles.tabHeaderCount,
                            activeTab === 'followers' && styles.tabHeaderCountActive
                        ]}>
                            {followers.length}
                        </Text>
                        <Text style={[
                            styles.tabHeaderLabel,
                            activeTab === 'followers' && styles.tabHeaderLabelActive
                        ]}>
                            Followers
                        </Text>
                        {activeTab === 'followers' && <View style={styles.tabHeaderIndicator} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.tabHeaderItem}
                        onPress={() => animateToTab('following')}
                    >
                        <Text style={[
                            styles.tabHeaderCount,
                            activeTab === 'following' && styles.tabHeaderCountActive
                        ]}>
                            {following.length}
                        </Text>
                        <Text style={[
                            styles.tabHeaderLabel,
                            activeTab === 'following' && styles.tabHeaderLabelActive
                        ]}>
                            Following
                        </Text>
                        {activeTab === 'following' && <View style={styles.tabHeaderIndicator} />}
                    </TouchableOpacity>
                </View>

                {/* Animated Sliding List Container */}
                <View {...panResponder.panHandlers} style={styles.listContainer}>
                    <Animated.View
                        style={[
                            styles.slidingContainer,
                            { transform: [{ translateX: slideAnim }] }
                        ]}
                    >
                        {/* Followers List */}
                        <View style={styles.listPane}>
                            {loadingFollowers ? (
                                <View style={styles.centerContainer}>
                                    <ActivityIndicator size="large" color={TEXT_PRIMARY} />
                                </View>
                            ) : followers.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="people-outline" size={48} color={TEXT_DISABLED} />
                                    <Text style={styles.emptyText}>No followers yet</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={followers}
                                    keyExtractor={(item) => item.id}
                                    renderItem={renderUserItem}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={styles.listContent}
                                />
                            )}
                        </View>

                        {/* Following List */}
                        <View style={styles.listPane}>
                            {loadingFollowing ? (
                                <View style={styles.centerContainer}>
                                    <ActivityIndicator size="large" color={TEXT_PRIMARY} />
                                </View>
                            ) : following.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="person-add-outline" size={48} color={TEXT_DISABLED} />
                                    <Text style={styles.emptyText}>Not following anyone yet</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={following}
                                    keyExtractor={(item) => item.id}
                                    renderItem={renderUserItem}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={styles.listContent}
                                />
                            )}
                        </View>
                    </Animated.View>
                </View>
            </SafeAreaView>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerSpacer: {
        flex: 1,
    },
    shareButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabHeader: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
    },
    tabHeaderItem: {
        flex: 1,
        alignItems: 'center',
        paddingBottom: 12,
        position: 'relative',
    },
    tabHeaderCount: {
        fontSize: 16,
        fontWeight: '700',
        color: TEXT_DISABLED,
        marginBottom: 2,
    },
    tabHeaderCountActive: {
        color: TEXT_PRIMARY,
    },
    tabHeaderLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: TEXT_DISABLED,
    },
    tabHeaderLabelActive: {
        color: TEXT_SECONDARY,
    },
    tabHeaderIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: ACCENT,
    },
    listContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    slidingContainer: {
        flexDirection: 'row',
        width: SCREEN_WIDTH * 2,
        flex: 1,
    },
    listPane: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: TEXT_DISABLED,
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginBottom: 4,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: BG_ELEVATED,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
    },
    userAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
        color: TEXT_PRIMARY,
        marginBottom: 2,
    },
    userHandle: {
        fontSize: 13,
        color: TEXT_SECONDARY,
    },
    followButton: {
        backgroundColor: Theme.textPrimary,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followingButton: {
        backgroundColor: Theme.bgMain,
        borderWidth: 1.5,
        borderColor: Theme.textPrimary,
    },
    followButtonDisabled: {
        opacity: 0.6,
    },
    followButtonText: {
        color: Theme.textInverse,
        fontSize: 13,
        fontWeight: '600',
    },
    followingButtonText: {
        color: Theme.textPrimary,
    },
});
