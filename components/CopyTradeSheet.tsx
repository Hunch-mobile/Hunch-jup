import { Theme } from '@/constants/theme';
import { CopyTradingStep } from '@/hooks/useCopyTrading';
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
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
    /** Current step from useCopyTrading — drives the progress indicator */
    step?: CopyTradingStep;
    error?: string | null;
}

const STEP_LABELS: Record<CopyTradingStep, string> = {
    idle: '',
    signer: 'Setting up wallet signer...',
    signing: 'Sign to authorize copy trading',
    saving: 'Saving settings...',
    done: 'Copy trading enabled!',
    error: 'Something went wrong',
};

const STEP_ORDER: CopyTradingStep[] = ['signer', 'signing', 'saving', 'done'];

export default function CopyTradeSheet({
    visible,
    onClose,
    username,
    balance,
    onConfirm,
    loading = false,
    step = 'idle',
    error,
}: CopyTradeSheetProps) {
    const [perTrade, setPerTrade] = useState('');
    const [totalCap, setTotalCap] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const isProcessing = step !== 'idle' && step !== 'done' && step !== 'error';
    const showProgress = step !== 'idle';

    // Reset state when opening
    useEffect(() => {
        if (visible) {
            setPerTrade('');
            setTotalCap('');
            setValidationError(null);

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 280,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic),
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 320,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic),
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

    // Auto-close on success
    useEffect(() => {
        if (step === 'done' && visible) {
            const timeout = setTimeout(() => onClose(), 1200);
            return () => clearTimeout(timeout);
        }
    }, [step, visible]);

    const handleClose = () => {
        if (isProcessing) return; // Don't allow close while processing
        Keyboard.dismiss();
        onClose();
    };

    const handleConfirm = () => {
        setValidationError(null);

        const perTradeNum = parseFloat(perTrade);
        const totalCapNum = parseFloat(totalCap);

        if (isNaN(perTradeNum) || perTradeNum <= 0) {
            setValidationError('Enter a valid amount per trade');
            return;
        }
        if (isNaN(totalCapNum) || totalCapNum <= 0) {
            setValidationError('Enter a valid total cap');
            return;
        }
        if (perTradeNum > totalCapNum) {
            setValidationError('Per trade amount cannot exceed total cap');
            return;
        }
        if (totalCapNum > balance && balance > 0) {
            setValidationError('Total cap exceeds your balance');
            return;
        }

        Keyboard.dismiss();
        onConfirm(perTrade, totalCap);
    };

    if (!visible) return null;

    const displayError = validationError || error;
    const stepIndex = STEP_ORDER.indexOf(step);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={handleClose}>
                <View style={StyleSheet.absoluteFill}>
                    <BlurView intensity={25} tint="default" style={StyleSheet.absoluteFill} />
                    <Animated.View
                        style={[
                            styles.backdrop,
                            { opacity: fadeAnim }
                        ]}
                    />
                </View>
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
                                <Text className="text-xs text-txt-disabled tracking-wide">Your balance</Text>
                                <Text className="text-lg font-bold text-txt-primary">${balance.toFixed(0)}</Text>
                            </View>
                            {!isProcessing && (
                                <TouchableOpacity
                                    onPress={handleClose}
                                    className="p-2 bg-app-elevated rounded-full"
                                >
                                    <Ionicons name="close" size={20} color={Theme.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Step Progress Indicator */}
                    {showProgress && (
                        <View className="mb-5">
                            {/* Progress dots */}
                            <View className="flex-row items-center justify-center gap-2 mb-3">
                                {STEP_ORDER.map((s, i) => {
                                    const isComplete = stepIndex > i;
                                    const isCurrent = step === s;
                                    const bgColor = isComplete ? '#00e003'
                                        : isCurrent ? Theme.textPrimary
                                        : Theme.border;
                                    return (
                                        <View
                                            key={s}
                                            style={{
                                                width: isCurrent ? 24 : 8,
                                                height: 8,
                                                borderRadius: 4,
                                                backgroundColor: bgColor,
                                            }}
                                        />
                                    );
                                })}
                            </View>
                            {/* Step label */}
                            <View className="flex-row items-center justify-center gap-2">
                                {isProcessing && (
                                    <ActivityIndicator size="small" color={Theme.textPrimary} />
                                )}
                                {step === 'done' && (
                                    <Ionicons name="checkmark-circle" size={18} color="#00e003" />
                                )}
                                {step === 'error' && (
                                    <Ionicons name="close-circle" size={18} color="#FF10F0" />
                                )}
                                <Text
                                    className="text-sm font-medium"
                                    style={{
                                        color: step === 'done' ? '#00e003'
                                            : step === 'error' ? '#FF10F0'
                                            : Theme.textSecondary
                                    }}
                                >
                                    {STEP_LABELS[step]}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Inputs */}
                    <View style={styles.inputsSection} pointerEvents={isProcessing ? 'none' : 'auto'}>
                        <View style={[styles.inputBlock, isProcessing && { opacity: 0.5 }]}>
                            <Text className="text-sm font-medium text-txt-secondary mb-2 uppercase tracking-wide">
                                Per Trade
                            </Text>
                            <View className="flex-row items-center bg-app-elevated rounded-xl px-4 py-3 border border-border">
                                <Text style={{ fontSize: 18, fontWeight: '700', color: Theme.textPrimary, marginRight: 4, lineHeight: 24 }}>$</Text>
                                <TextInput
                                    style={{ flex: 1, fontSize: 18, fontWeight: '700', color: Theme.textPrimary, padding: 0, margin: 0, lineHeight: 24, includeFontPadding: false }}
                                    value={perTrade}
                                    onChangeText={(t) => { setPerTrade(t); setValidationError(null); }}
                                    keyboardType="numeric"
                                    placeholder="10"
                                    placeholderTextColor={Theme.textDisabled}
                                    selectionColor={Theme.accent}
                                    editable={!isProcessing}
                                />
                            </View>
                        </View>

                        <View style={[styles.inputBlock, isProcessing && { opacity: 0.5 }]}>
                            <Text className="text-sm font-medium text-txt-secondary mb-2 uppercase tracking-wide">
                                Total Cap
                            </Text>
                            <View className="flex-row items-center bg-app-elevated rounded-xl px-4 py-3 border border-border">
                                <Text style={{ fontSize: 18, fontWeight: '700', color: Theme.textPrimary, marginRight: 4, lineHeight: 24 }}>$</Text>
                                <TextInput
                                    style={{ flex: 1, fontSize: 18, fontWeight: '700', color: Theme.textPrimary, padding: 0, margin: 0, lineHeight: 24, includeFontPadding: false }}
                                    value={totalCap}
                                    onChangeText={(t) => { setTotalCap(t); setValidationError(null); }}
                                    keyboardType="numeric"
                                    placeholder="100"
                                    placeholderTextColor={Theme.textDisabled}
                                    selectionColor={Theme.accent}
                                    editable={!isProcessing}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Error display */}
                    {displayError && (
                        <View className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            <Text className="text-xs font-medium text-red-500">{displayError}</Text>
                        </View>
                    )}

                    {/* Buttons */}
                    <View className="flex-row gap-3 mt-6">
                        <TouchableOpacity
                            className="flex-1 py-3.5 rounded-xl border border-border items-center justify-center bg-transparent"
                            onPress={handleClose}
                            disabled={isProcessing}
                            style={isProcessing ? { opacity: 0.4 } : undefined}
                        >
                            <Text className="text-base font-semibold text-txt-primary">
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-1 py-3.5 rounded-xl bg-txt-primary items-center justify-center"
                            onPress={handleConfirm}
                            disabled={loading || isProcessing}
                            style={(loading || isProcessing) ? { opacity: 0.7 } : undefined}
                        >
                            {(loading || isProcessing) ? (
                                <ActivityIndicator size="small" color={Theme.textInverse} />
                            ) : (
                                <Text className="text-base font-bold text-txt-inverse">
                                    Start Copying
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
        shadowColor: "#000000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    inputsSection: {
        gap: 20,
        marginTop: 8,
    },
    inputBlock: {
        width: '100%',
    },
});
