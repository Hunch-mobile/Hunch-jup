import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { User as BackendUser, Trade } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface FeedItem extends Trade {
    type: 'trade';
}

export default function SocialScreen() {
    const { backendUser } = useUser();
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BackendUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFeed, setIsLoadingFeed] = useState(true);
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        loadFeed();
    }, [backendUser]);

    const loadFeed = async () => {
        if (!backendUser) {
            setIsLoadingFeed(false);
            return;
        }

        try {
            const trades = await api.getFeed(backendUser.id, 50, 0);
            const items: FeedItem[] = trades.map(trade => ({
                ...trade,
                type: 'trade' as const,
            }));
            setFeedItems(items);
        } catch (error) {
            console.error("Failed to load feed:", error);
        } finally {
            setIsLoadingFeed(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);

        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await api.searchUsers(query);
            setSearchResults(results);
        } catch (error) {
            console.error("Failed to search users:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFollowUser = async (userId: string) => {
        if (!backendUser) return;

        try {
            await api.followUser(backendUser.id, userId);
            // Refresh search results
            if (searchQuery) {
                handleSearch(searchQuery);
            }
        } catch (error) {
            console.error("Failed to follow user:", error);
        }
    };

    const renderSearchResult = ({ item }: { item: BackendUser }) => (
        <View style={styles.searchResultItem}>
            <View style={styles.searchResultAvatar}>
                <Text style={styles.searchResultAvatarText}>
                    {(item.displayName || item.walletAddress).charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultName}>{item.displayName || "Anonymous"}</Text>
                <Text style={styles.searchResultWallet}>
                    {item.walletAddress.slice(0, 6)}...{item.walletAddress.slice(-4)}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.followButton}
                onPress={() => handleFollowUser(item.id)}
            >
                <Text style={styles.followButtonText}>Follow</Text>
            </TouchableOpacity>
        </View>
    );

    const renderFeedItem = ({ item }: { item: FeedItem }) => (
        <View style={styles.feedItem}>
            <View style={styles.feedAvatar}>
                <Text style={styles.feedAvatarText}>
                    {(item.user?.displayName || item.user?.walletAddress || "U").charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.feedContent}>
                <View style={styles.feedHeader}>
                    <Text style={styles.userName}>{item.user?.displayName || "Anonymous"}</Text>
                    <Text style={styles.userHandle}>
                        @{item.user?.walletAddress?.slice(0, 6)}
                    </Text>
                    <Text style={styles.timeDot}>•</Text>
                    <Text style={styles.time}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                </View>

                <Text style={styles.actionText}>
                    {item.side === 'yes' ? 'bought Yes' : 'bought No'} on{' '}
                    <Text style={styles.highlight}>{item.marketTicker}</Text> for{' '}
                    <Text style={styles.highlight}>${item.amount}</Text>
                </Text>

                <View style={styles.interactions}>
                    <TouchableOpacity style={styles.interactionBtn}>
                        <Ionicons name="heart-outline" size={16} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.interactionText}>12</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.interactionBtn}>
                        <Ionicons name="chatbubble-outline" size={16} color="rgba(255,255,255,0.5)" />
                        <Text style={styles.interactionText}>4</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.interactionBtn}>
                        <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={["#0a0a0f", "#12121a", "#1a1a2e"]}
                style={styles.gradient}
            />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Social</Text>
                    <TouchableOpacity
                        style={styles.searchButton}
                        onPress={() => setShowSearch(!showSearch)}
                    >
                        <Ionicons name="search" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                {showSearch && (
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputContainer}>
                            <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by name or wallet address..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={searchQuery}
                                onChangeText={handleSearch}
                                autoFocus
                            />
                            {isSearching && <ActivityIndicator size="small" color="#4ade80" />}
                        </View>
                    </View>
                )}

                {showSearch && searchResults.length > 0 ? (
                    <FlatList
                        data={searchResults}
                        keyExtractor={(item) => item.id}
                        renderItem={renderSearchResult}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                ) : isLoadingFeed ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4ade80" />
                    </View>
                ) : feedItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.emptyText}>No activity yet</Text>
                        <Text style={styles.emptySubtext}>Follow users to see their trades</Text>
                    </View>
                ) : (
                    <FlatList
                        data={feedItems}
                        keyExtractor={(item) => item.id}
                        renderItem={renderFeedItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshing={isLoadingFeed}
                        onRefresh={loadFeed}
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
    },
    searchButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        paddingVertical: 12,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    searchResultAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    searchResultAvatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4ade80',
    },
    searchResultInfo: {
        flex: 1,
    },
    searchResultName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    searchResultWallet: {
        fontSize: 13,
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
    },
    followButtonText: {
        color: '#4ade80',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 100,
    },
    loadingContainer: {
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
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.4)',
        marginTop: 8,
        textAlign: 'center',
    },
    feedItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    feedAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    feedAvatarText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4ade80',
    },
    feedContent: {
        flex: 1,
    },
    feedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    userName: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
        marginRight: 6,
    },
    userHandle: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
    },
    timeDot: {
        color: 'rgba(255, 255, 255, 0.3)',
        marginHorizontal: 6,
    },
    time: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 13,
    },
    actionText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 15,
        lineHeight: 22,
    },
    highlight: {
        color: '#4ade80',
        fontWeight: '500',
    },
    interactions: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 24,
    },
    interactionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    interactionText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
    },
});
