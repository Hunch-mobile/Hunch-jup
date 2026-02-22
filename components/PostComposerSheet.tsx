import { Theme } from '@/constants/theme';
import { api } from '@/lib/api';
import { AggregatedPosition, User } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const defaultProfileImage = require('@/assets/default.jpeg');

interface EmbeddedPosition {
    marketTicker: string;
    side: 'yes' | 'no';
    title: string;
    subtitle?: string;
    totalCostBasis: number;
}

interface PostComposerSheetProps {
    visible: boolean;
    onClose: () => void;
    backendUser: User | null;
    onPostSuccess?: () => void;
}

export default function PostComposerSheet({
    visible,
    onClose,
    backendUser,
    onPostSuccess,
}: PostComposerSheetProps) {
    const insets = useSafeAreaInsets();
    const [text, setText] = useState('');
    const [activePositions, setActivePositions] = useState<AggregatedPosition[]>([]);
    const [loadingPositions, setLoadingPositions] = useState(false);
    const [showPositionPicker, setShowPositionPicker] = useState(false);
    const [embeddedPositions, setEmbeddedPositions] = useState<EmbeddedPosition[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (visible && backendUser) {
            loadPositions();
        }
        if (!visible) {
            setText('');
            setEmbeddedPositions([]);
            setShowPositionPicker(false);
        }
    }, [visible, backendUser]);

    const loadPositions = async () => {
        if (!backendUser) return;
        setLoadingPositions(true);
        try {
            const resp = await api.getPositions(backendUser.id);
            setActivePositions(resp.positions.active || []);
        } catch (err) {
            console.error('Failed to load positions:', err);
        } finally {
            setLoadingPositions(false);
        }
    };

    const addPosition = useCallback((pos: AggregatedPosition) => {
        const already = embeddedPositions.some(e => e.marketTicker === pos.marketTicker && e.side === pos.side);
        if (already) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEmbeddedPositions(prev => [
            ...prev,
            {
                marketTicker: pos.marketTicker,
                side: pos.side,
                title: pos.market?.title || pos.marketTicker,
                subtitle: pos.side === 'yes' ? pos.market?.yesSubTitle : pos.market?.noSubTitle,
                totalCostBasis: pos.totalCostBasis,
            },
        ]);
        setShowPositionPicker(false);
    }, [embeddedPositions]);

    const removePosition = useCallback((ticker: string, side: string) => {
        setEmbeddedPositions(prev => prev.filter(e => !(e.marketTicker === ticker && e.side === side)));
    }, []);

    const handlePost = async () => {
        if (!text.trim() && embeddedPositions.length === 0) return;
        if (!backendUser) return;

        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // For each embedded position, create a dummy trade with the post text as quote
            if (embeddedPositions.length > 0) {
                for (const pos of embeddedPositions) {
                    await api.createTrade({
                        userId: backendUser.id,
                        marketTicker: pos.marketTicker,
                        side: pos.side,
                        amount: '0',
                        transactionSig: `post-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        quote: text.trim() || undefined,
                        isDummy: true,
                    });
                }
            } else {
                // Post without position — just a text post on the first available market
                // For now, skip if no positions embedded
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onPostSuccess?.();
            onClose();
        } catch (err) {
            console.error('Failed to create post:', err);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const canPost = text.trim().length > 0 || embeddedPositions.length > 0;
    const avatarUrl = backendUser?.avatarUrl?.replace('_normal', '');

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Post</Text>
                    <TouchableOpacity
                        onPress={handlePost}
                        disabled={!canPost || isSubmitting}
                        style={[styles.postButton, canPost && styles.postButtonActive]}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={[styles.postButtonText, canPost && styles.postButtonTextActive]}>Post</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={insets.top + 50}
                >
                    {/* Compose Area */}
                    <View style={styles.composeArea}>
                        <View style={styles.avatarRow}>
                            <View style={styles.avatar}>
                                <Image
                                    source={avatarUrl ? { uri: avatarUrl } : defaultProfileImage}
                                    style={styles.avatarImage}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.displayName}>
                                    {backendUser?.displayName || backendUser?.username || 'You'}
                                </Text>
                            </View>
                        </View>

                        <TextInput
                            style={styles.textInput}
                            placeholder="What's on your mind?"
                            placeholderTextColor="#9CA3AF"
                            value={text}
                            onChangeText={setText}
                            multiline
                            maxLength={500}
                            textAlignVertical="top"
                            autoFocus
                        />

                        {text.length > 0 && (
                            <Text style={styles.charCount}>{text.length}/500</Text>
                        )}

                        {/* Embedded Positions */}
                        {embeddedPositions.length > 0 && (
                            <View style={styles.embeddedList}>
                                {embeddedPositions.map((pos) => (
                                    <View key={`${pos.marketTicker}-${pos.side}`} style={styles.embeddedCard}>
                                        <View style={styles.embeddedCardContent}>
                                            <Text
                                                style={[
                                                    styles.embeddedSide,
                                                    { color: pos.side === 'yes' ? '#32de12' : '#FF10F0' },
                                                ]}
                                            >
                                                {pos.side.toUpperCase()}
                                            </Text>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={styles.embeddedTitle} numberOfLines={1}>
                                                    {pos.subtitle || pos.title}
                                                </Text>
                                                <Text style={styles.embeddedAmount}>
                                                    ${pos.totalCostBasis.toFixed(2)}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => removePosition(pos.marketTicker, pos.side)}
                                                hitSlop={10}
                                            >
                                                <Ionicons name="close-circle" size={22} color="#9CA3AF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Toolbar */}
                    <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        <TouchableOpacity
                            style={styles.toolbarButton}
                            onPress={() => setShowPositionPicker(true)}
                        >
                            <Ionicons name="stats-chart" size={22} color={Theme.textPrimary} />
                            <Text style={styles.toolbarButtonText}>Add Position</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>

            {/* Position Picker Bottom Sheet */}
            <Modal
                visible={showPositionPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPositionPicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowPositionPicker(false)} />
                    <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <View style={styles.pickerHandle} />
                        <Text style={styles.pickerTitle}>Your Active Positions</Text>

                        {loadingPositions ? (
                            <View style={styles.pickerLoading}>
                                <ActivityIndicator size="large" color={Theme.textSecondary} />
                            </View>
                        ) : activePositions.length === 0 ? (
                            <View style={styles.pickerEmpty}>
                                <Ionicons name="wallet-outline" size={40} color="#D1D5DB" />
                                <Text style={styles.pickerEmptyText}>No active positions</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={activePositions}
                                keyExtractor={(item) => `${item.marketTicker}-${item.side}`}
                                style={{ maxHeight: 400 }}
                                renderItem={({ item }) => {
                                    const isYes = item.side === 'yes';
                                    const subtitle = isYes ? item.market?.yesSubTitle : item.market?.noSubTitle;
                                    const alreadyAdded = embeddedPositions.some(
                                        e => e.marketTicker === item.marketTicker && e.side === item.side
                                    );

                                    return (
                                        <TouchableOpacity
                                            style={[styles.positionRow, alreadyAdded && styles.positionRowDisabled]}
                                            onPress={() => !alreadyAdded && addPosition(item)}
                                            disabled={alreadyAdded}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.positionSide,
                                                    { color: isYes ? '#32de12' : '#FF10F0' },
                                                ]}
                                            >
                                                {item.side.toUpperCase()}
                                            </Text>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text style={styles.positionTitle} numberOfLines={1}>
                                                    {subtitle || item.market?.title || item.marketTicker}
                                                </Text>
                                                <Text style={styles.positionMeta}>
                                                    ${item.totalCostBasis.toFixed(2)} invested
                                                </Text>
                                            </View>
                                            {alreadyAdded ? (
                                                <Ionicons name="checkmark-circle" size={24} color="#32de12" />
                                            ) : (
                                                <Ionicons name="add-circle-outline" size={24} color={Theme.textPrimary} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerButton: {
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    cancelText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    postButton: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: '#D1D5DB',
    },
    postButtonActive: {
        backgroundColor: '#000000',
    },
    postButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#9CA3AF',
    },
    postButtonTextActive: {
        color: '#FFFFFF',
    },
    composeArea: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        marginRight: 12,
        backgroundColor: '#F3F4F6',
    },
    avatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    displayName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    textInput: {
        fontSize: 18,
        lineHeight: 26,
        color: '#111827',
        minHeight: 120,
        paddingTop: 0,
    },
    charCount: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'right',
        marginTop: 4,
    },
    embeddedList: {
        marginTop: 16,
        gap: 10,
    },
    embeddedCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 14,
    },
    embeddedCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    embeddedSide: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    },
    embeddedTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    embeddedAmount: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    toolbarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    toolbarButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-end',
    },
    pickerSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    pickerHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#D1D5DB',
        alignSelf: 'center',
        marginBottom: 16,
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    pickerLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    pickerEmpty: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 10,
    },
    pickerEmptyText: {
        fontSize: 15,
        color: '#9CA3AF',
    },
    positionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    positionRowDisabled: {
        opacity: 0.5,
    },
    positionSide: {
        fontSize: 16,
        fontWeight: '900',
        width: 36,
        letterSpacing: 0.5,
    },
    positionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    positionMeta: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
});
