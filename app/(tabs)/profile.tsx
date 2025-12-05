import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { User } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy } from "@privy-io/expo";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
    const { user, logout } = usePrivy();
    const { backendUser, setBackendUser } = useUser();
    const router = useRouter();
    const [profileData, setProfileData] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProfile();
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

    if (isLoading) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={["#0a0a0f", "#12121a", "#1a1a2e"]}
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
                colors={["#0a0a0f", "#12121a", "#1a1a2e"]}
                style={styles.gradient}
            />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <TouchableOpacity onPress={handleLogout} style={styles.settingsBtn}>
                        <Ionicons name="log-out-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>
                                    {displayName.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.name}>{displayName}</Text>

                        <TouchableOpacity style={styles.walletContainer}>
                            <Ionicons name="wallet-outline" size={14} color="#4ade80" />
                            <Text style={styles.walletText}>{formattedAddress}</Text>
                        </TouchableOpacity>

                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{followingCount}</Text>
                                <Text style={styles.statLabel}>Following</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{followerCount}</Text>
                                <Text style={styles.statLabel}>Followers</Text>
                            </View>
                        </View>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.editProfileBtn}>
                                <Text style={styles.editProfileText}>Edit Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.shareBtn}>
                                <Ionicons name="share-outline" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Portfolio Value</Text>
                        <View style={styles.portfolioCard}>
                            <Text style={styles.portfolioAmount}>$1,240.50</Text>
                            <Text style={styles.portfolioChange}>+12.5% (24h)</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        <View style={styles.activityItem}>
                            <View style={styles.activityIcon}>
                                <Ionicons name="trending-up" size={16} color="#4ade80" />
                            </View>
                            <View style={styles.activityInfo}>
                                <Text style={styles.activityText}>Bought Yes on Bitcoin $100k</Text>
                                <Text style={styles.activityTime}>2h ago</Text>
                            </View>
                        </View>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    settingsBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingBottom: 100,
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatarPlaceholder: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '600',
        color: '#4ade80',
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    walletContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        gap: 6,
        marginBottom: 24,
    },
    walletText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        fontFamily: 'monospace',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        width: '100%',
    },
    editProfileBtn: {
        flex: 1,
        backgroundColor: '#fff',
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editProfileText: {
        color: '#000',
        fontWeight: '600',
        fontSize: 15,
    },
    shareBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    portfolioCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    portfolioAmount: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    portfolioChange: {
        fontSize: 14,
        color: '#4ade80',
        fontWeight: '500',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 12,
        marginBottom: 8,
    },
    activityIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activityInfo: {
        flex: 1,
    },
    activityText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        marginBottom: 2,
    },
    activityTime: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
    },
});
