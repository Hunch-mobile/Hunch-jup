import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface CreditCardProps {
    tradesCount: number;
}

export default function CreditCard({ tradesCount }: CreditCardProps) {
    const [flipped, setFlipped] = useState(false);
    const [flipAnimation] = useState(new Animated.Value(0));

    const handleFlip = () => {
        Animated.timing(flipAnimation, {
            toValue: flipped ? 0 : 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
        setFlipped(!flipped);
    };

    const frontRotation = flipAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    const backRotation = flipAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['180deg', '360deg'],
    });

    return (
        <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={handleFlip}
            style={styles.container}
        >
            {/* Front Side */}
            <Animated.View style={[styles.card, { transform: [{ rotateY: frontRotation }] }]}>
                <LinearGradient
                    colors={['#10b981', '#22c55e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    <Image
                        source={require('@/assets/images/texture.jpeg')}
                        style={styles.texture}
                        contentFit="cover"
                    />

                    <View style={styles.content}>
                        <Text style={styles.hint}>Tap to flip</Text>
                        
                        <View style={styles.balance}>
                            <Text style={styles.balanceLabel}>Balance</Text>
                            <Text style={styles.balanceValue}>$300</Text>
                        </View>

                        <View style={styles.stats}>
                            <View>
                                <Text style={styles.statLabel}>Trades</Text>
                                <Text style={styles.statValue}>{tradesCount}</Text>
                            </View>
                            <View style={styles.statRight}>
                                <Text style={styles.statLabel}>P&L</Text>
                                <Text style={styles.statValue}>--</Text>
                            </View>
                        </View>
                    </View>

                    <LinearGradient
                        colors={['transparent', 'rgba(255, 255, 255, 0.1)']}
                        style={styles.shine}
                    />
                </LinearGradient>
            </Animated.View>

            {/* Back Side */}
            <Animated.View style={[styles.card, styles.cardBack, { transform: [{ rotateY: backRotation }] }]}>
                <LinearGradient
                    colors={['#1e293b', '#334155']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    <Image
                        source={require('@/assets/images/texture.jpeg')}
                        style={[styles.texture, { opacity: 0.2 }]}
                        contentFit="cover"
                    />

                    <View style={styles.content}>
                        <View style={{ flex: 1 }} />
                        
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.depositBtn}>
                                <Ionicons name="add" size={18} color="#fff" />
                                <Text style={styles.btnText}>Deposit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.withdrawBtn}>
                                <Ionicons name="arrow-up" size={18} color="#fff" />
                                <Text style={styles.btnText}>Withdraw</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.hint}>Tap to flip back</Text>
                    </View>
                </LinearGradient>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        aspectRatio: 1.586,
    },
    card: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backfaceVisibility: 'hidden',
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardBack: {
        transform: [{ rotateY: '180deg' }],
    },
    gradient: {
        flex: 1,
    },
    texture: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.4,
    },
    shine: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'space-between',
    },
    hint: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        alignSelf: 'flex-end',
    },
    balance: {
        flex: 1,
        justifyContent: 'center',
    },
    balanceLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    balanceValue: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff',
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statLabel: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    statRight: {
        alignItems: 'flex-end',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    depositBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 12,
        borderRadius: 10,
    },
    withdrawBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    btnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});

