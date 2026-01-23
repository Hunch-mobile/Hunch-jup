import { Theme } from '@/constants/theme';
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Keyboard,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CopyTradeSheetProps {
    visible: boolean;
    onClose: () => void;
    username: string;
    balance: number;
    onConfirm: (perTrade: string, totalCap: string) => void;
    loading?: boolean;
}

export default function CopyTradeSheet({
    visible,
    onClose,
    username,
    balance,
    onConfirm,
    loading = false,
}: CopyTradeSheetProps) {
    const [perTrade, setPerTrade] = useState('');
    const [totalCap, setTotalCap] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Reset state when opening
    useEffect(() => {
        if (visible) {
            setPerTrade('');
            setTotalCap('');

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 20,
                    mass: 0.8,
                    stiffness: 100,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleClose = () => {
        Keyboard.dismiss();
        onClose();
    };

    const handleConfirm = () => {
        onConfirm(perTrade, totalCap);
    };

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View
                    style={[
                        styles.backdrop,
                        { opacity: fadeAnim }
                    ]}
                />
            </TouchableWithoutFeedback>

            <View style={styles.sheetContainer} pointerEvents="box-none">
                <Animated.View
                    style={[
                        styles.sheet,
                        { transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-1">
                            <Text className="text-xl font-bold text-txt-primary">
                                Copy Trading
                            </Text>
                            <Text className="text-base font-medium text-txt-secondary">
                                {username}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <View className="items-end">
                                <Text className="text-xs text-txt-disabled uppercase tracking-wide">Balance</Text>
                                <Text className="text-lg font-bold text-txt-primary">${balance.toFixed(2)}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={handleClose}
                                className="p-2 bg-app-elevated rounded-full"
                            >
                                <Ionicons name="close" size={20} color={Theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Inputs */}
                    <View className="gap-5 mb-8">
                        {/* Per Trade Input */}
                        <View>
                            <Text className="text-sm font-medium text-txt-secondary mb-2 uppercase tracking-wide">
                                Per Trade
                            </Text>
                            <View className="flex-row items-center bg-app-elevated rounded-xl px-4 py-3 border border-border">
                                <Text className="text-lg font-bold text-txt-primary mr-2">$</Text>
                                <TextInput
                                    className="flex-1 text-lg font-bold text-txt-primary p-0"
                                    value={perTrade}
                                    onChangeText={setPerTrade}
                                    keyboardType="numeric"
                                    placeholder="10"
                                    placeholderTextColor={Theme.textDisabled}
                                    selectionColor={Theme.accent}
                                />
                            </View>
                        </View>

                        {/* Total Cap Input */}
                        <View>
                            <Text className="text-sm font-medium text-txt-secondary mb-2 uppercase tracking-wide">
                                Total Cap
                            </Text>
                            <View className="flex-row items-center bg-app-elevated rounded-xl px-4 py-3 border border-border">
                                <Text className="text-lg font-bold text-txt-primary mr-2">$</Text>
                                <TextInput
                                    className="flex-1 text-lg font-bold text-txt-primary p-0"
                                    value={totalCap}
                                    onChangeText={setTotalCap}
                                    keyboardType="numeric"
                                    placeholder="100"
                                    placeholderTextColor={Theme.textDisabled}
                                    selectionColor={Theme.accent}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Buttons */}
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="flex-1 py-3.5 rounded-xl border border-border items-center justify-center bg-transparent"
                            onPress={handleClose}
                        >
                            <Text className="text-base font-semibold text-txt-primary">
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-1 py-3.5 rounded-xl bg-txt-primary items-center justify-center"
                            onPress={handleConfirm}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={Theme.textInverse} />
                            ) : (
                                <Text className="text-base font-bold text-txt-inverse">
                                    Continue
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Safe Area Bottom Padding */}
                    <View className="h-safe-bottom" />
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheetContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: Theme.bgCard,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        width: '100%',
        minHeight: SCREEN_HEIGHT * 0.8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
});
