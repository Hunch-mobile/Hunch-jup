import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { Animated, Dimensions, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH * 0.63; // ~1.586 aspect ratio

// Updated Theme constants for the new look
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255, 255, 255, 0.6)';

interface CreditCardProps {
    tradesCount: number;
    balance?: number;
    walletAddress?: string;
}

export default function CreditCard({ tradesCount, balance = 0, walletAddress }: CreditCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [copied, setCopied] = useState(false);
    const flipAnimation = useRef(new Animated.Value(0)).current;

    const toggleFlip = () => {
        Animated.spring(flipAnimation, {
            toValue: isFlipped ? 0 : 1,
            friction: 8,
            tension: 10,
            useNativeDriver: true,
        }).start();
        setIsFlipped(!isFlipped);
    };

    const copyAddress = async () => {
        if (walletAddress) {
            await Clipboard.setStringAsync(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const frontInterpolate = flipAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    const backInterpolate = flipAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['180deg', '360deg'],
    });

    const frontAnimatedStyle = {
        transform: [{ rotateY: frontInterpolate }],
    };

    const backAnimatedStyle = {
        transform: [{ rotateY: backInterpolate }],
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={toggleFlip} activeOpacity={0.9}>
                <View style={styles.cardContainer}>
                    {/* Front of the card */}
                    <Animated.View style={[styles.card, frontAnimatedStyle]}>
                        <ImageBackground
                            source={require('@/assets/images/text.jpg')}
                            style={styles.textureBackground}
                            imageStyle={styles.textureImage}
                        >
                            <LinearGradient
                                // Dark charcoal with subtle shading
                                colors={['rgba(20, 20, 25, 0.75)', 'rgba(35, 35, 45, 0.7)', 'rgba(25, 25, 30, 0.75)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.gradient}
                            >
                                {/* Decorative Blurs - subtle accent */}
                                <View style={[styles.blurCircle, styles.blur1]} />
                                <View style={[styles.blurCircle, styles.blur2]} />

                                {/* Shine Effect - subtle top highlight */}
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'transparent']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />

                                {/* Card Content */}
                                <View style={styles.contentContainer}>
                                    {/* Top Row */}
                                    <View style={styles.topRow}>
                                        <Text style={styles.tapText}>TAP TO FLIP</Text>
                                    </View>

                                    {/* Middle Row - Cash Balance */}
                                    <View style={styles.balanceSection}>
                                        <Text style={styles.label}>Balance</Text>
                                        <Text style={styles.balanceValue}>${balance.toFixed(2)}</Text>
                                    </View>

                                    {/* Bottom Row - Stats */}
                                    <View style={styles.statsRow}>
                                        <View>
                                            <Text style={styles.labelSmall}>Total Bets</Text>
                                            <Text style={styles.statValue}>{tradesCount}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.labelSmall}>P&L</Text>
                                            <Text style={styles.statValueDim}>--</Text>
                                        </View>
                                    </View>
                                </View>
                            </LinearGradient>
                        </ImageBackground>
                    </Animated.View>

                    {/* Back of the card */}
                    <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
                        <ImageBackground
                            source={require('@/assets/images/text.jpg')}
                            style={styles.textureBackground}
                            imageStyle={styles.textureImage}
                        >
                            <LinearGradient
                                // Dark charcoal matching front
                                colors={['rgba(25, 25, 30, 0.75)', 'rgba(40, 40, 50, 0.7)', 'rgba(20, 20, 25, 0.75)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.gradient}
                            >
                                {/* Decorative Blurs Back */}
                                <View style={[styles.blurCircle, styles.blurBack1]} />
                                <View style={[styles.blurCircle, styles.blurBack2]} />

                                {/* Shine Effect - subtle top highlight */}
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'transparent']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />

                                <View style={styles.contentContainer}>
                                    {/* Top Row - Copy Address */}
                                    <View style={styles.topRowBack}>
                                        <TouchableOpacity
                                            style={styles.copyButton}
                                            onPress={(e) => {
                                                e.stopPropagation(); // Prevent flip
                                                copyAddress();
                                            }}
                                        >
                                            {copied ? (
                                                <>
                                                    <Ionicons name="checkmark" size={16} color="#4ade80" />
                                                    <Text style={styles.copiedText}>Copied!</Text>
                                                </>
                                            ) : (
                                                <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.7)" />
                                            )}
                                        </TouchableOpacity>
                                    </View>

                                    <View style={{ flex: 1 }} />

                                    {/* Action Buttons */}
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                // Handle deposit
                                                console.log("Deposit clicked");
                                            }}
                                        >
                                            <Ionicons name="arrow-down" size={18} color="#FFF" />
                                            <Text style={styles.actionText}>Deposit</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.withdrawButton]}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                // Handle withdraw
                                                console.log("Withdraw clicked");
                                            }}
                                        >
                                            <Ionicons name="arrow-up" size={18} color="#FFF" />
                                            <Text style={styles.actionText}>Withdraw</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.tapBackText}>Tap to flip back</Text>
                                </View>
                            </LinearGradient>
                        </ImageBackground>
                    </Animated.View>
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 24,
        position: 'absolute',
        backfaceVisibility: 'hidden',
        overflow: 'hidden',
        // Shadow for "dark theme"
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    cardBack: {
        transform: [{ rotateY: '180deg' }],
    },
    gradient: {
        flex: 1,
        padding: 24,
    },
    textureBackground: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
    },
    textureImage: {
        borderRadius: 20,
        opacity: 0.1,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    // Decorative Blurs - subtle highlights
    blurCircle: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.25,
    },
    blur1: {
        top: -60,
        right: -60,
        width: 180,
        height: 180,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    blur2: {
        bottom: -50,
        left: -50,
        width: 150,
        height: 150,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    blurBack1: {
        top: -50,
        left: -50,
        width: 160,
        height: 160,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    blurBack2: {
        bottom: -50,
        right: -50,
        width: 180,
        height: 180,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    // Text Styles
    topRow: {
        alignItems: 'flex-end',
    },
    tapText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 1,
        fontWeight: '600',
    },
    balanceSection: {
        flex: 1,
        justifyContent: 'center',
    },
    label: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
        fontWeight: '500',
    },
    labelSmall: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.9)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
        fontWeight: '500',
    },
    balanceValue: {
        fontSize: 36,
        color: TEXT_PRIMARY,
        fontWeight: '600',
        letterSpacing: -1,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    statValue: {
        fontSize: 20,
        color: TEXT_PRIMARY,
        fontWeight: '600',
    },
    statValueDim: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '700',
    },
    // Back styles
    topRowBack: {
        alignItems: 'flex-end',
    },
    copyButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 8,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    copiedText: {
        color: '#4ade80',
        fontSize: 12,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    withdrawButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    actionText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    tapBackText: {
        textAlign: 'center',
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
    },
});
