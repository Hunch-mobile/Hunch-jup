import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { Follow } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.id } })}
                activeOpacity={0.7}
            >
                <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                        {displayName.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{displayName}</Text>
                    <Text style={styles.userWallet}>
                        {item.walletAddress.slice(0, 6)}...{item.walletAddress.slice(-4)}
                    </Text>
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
                            <ActivityIndicator size="small" color={isFollowing ? "#fff" : "#4ade80"} />
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

    const currentData = activeTab === 'followers' ? followers : following;
    const currentLoading = activeTab === 'followers' ? loadingFollowers : loadingFollowing;

    return (
        <View style={styles.container}>
            <LinearGradient colors={["#0a0a0f", "#12121a", "#1a1a2e"]} style={styles.gradient} />
            
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {activeTab === 'followers' ? 'Followers' : 'Following'}
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
                        onPress={() => setActiveTab('followers')}
                    >
                        <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
                            Followers
                        </Text>
                        <Text style={[styles.tabCount, activeTab === 'followers' && styles.activeTabCount]}>
                            {followers.length}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'following' && styles.activeTab]}
                        onPress={() => setActiveTab('following')}
                    >
                        <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
                            Following
                        </Text>
                        <Text style={[styles.tabCount, activeTab === 'following' && styles.activeTabCount]}>
                            {following.length}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* List */}
                {currentLoading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#4ade80" />
                    </View>
                ) : currentData.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons 
                            name={activeTab === 'followers' ? "people-outline" : "person-add-outline"} 
                            size={64} 
                            color="rgba(255, 255, 255, 0.2)" 
                        />
                        <Text style={styles.emptyText}>
                            {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={currentData}
                        keyExtractor={(item) => item.id}
                        renderItem={renderUserItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.listContent}
                    />
                )}
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
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    headerSpacer: {
        width: 40,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    activeTab: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        borderColor: 'rgba(74, 222, 128, 0.3)',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.5)',
    },
    activeTabText: {
        color: '#4ade80',
    },
    tabCount: {
        fontSize: 13,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.4)',
    },
    activeTabCount: {
        color: '#4ade80',
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
    },
    emptyText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.4)',
        marginTop: 16,
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    userAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4ade80',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    userWallet: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        fontFamily: 'monospace',
    },
    followButton: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
        minWidth: 90,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followingButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    followButtonDisabled: {
        opacity: 0.6,
    },
    followButtonText: {
        color: '#4ade80',
        fontSize: 13,
        fontWeight: '600',
    },
    followingButtonText: {
        color: '#fff',
    },
});

