import { PolymarketClosedPosition, PolymarketPosition } from "@/lib/types";
import { Image } from "expo-image";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

const defaultIcon = require("@/assets/default.jpeg");

const formatCurrency = (value: number | null | undefined, compact = false) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    if (compact) {
        if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

interface PolymarketPositionCardProps {
    position: PolymarketPosition | PolymarketClosedPosition;
    isClosed?: boolean;
    onPress?: () => void;
    loading?: boolean;
}

function isActivePosition(position: PolymarketPosition | PolymarketClosedPosition): position is PolymarketPosition {
    return 'currentValue' in position;
}

export default function PolymarketPositionCard({
    position,
    isClosed = false,
    onPress,
    loading = false,
}: PolymarketPositionCardProps) {
    const isYes = position.outcome.toLowerCase() === 'yes' || position.outcomeIndex === 0;
    const isActive = isActivePosition(position);

    const pnlValue = isActive ? position.cashPnl : position.realizedPnl;
    const pnlColor = pnlValue >= 0 ? '#16A34A' : '#DC2626';

    return (
        <TouchableOpacity className="mb-3" onPress={onPress} activeOpacity={0.85} disabled={!onPress || loading}>
            <View className="rounded-2xl px-5 py-4 overflow-hidden" style={{ backgroundColor: '#F9FAFB' }}>
                {/* Market row */}
                <View className="flex-row items-center gap-4">
                    <View className="w-14 h-14 rounded-2xl overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
                        <Image
                            source={position.icon ? { uri: position.icon } : defaultIcon}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-semibold text-txt-primary" numberOfLines={2}>
                            {position.title}
                        </Text>
                        <View className="flex-row items-center gap-1.5 mt-1">
                            <Text
                                className="text-sm font-bold"
                                style={{ color: isYes ? '#16A34A' : '#DC2626' }}
                            >
                                {position.outcome.toUpperCase()}
                            </Text>
                            <Text className="text-sm text-txt-disabled">·</Text>
                            <Text className="text-sm text-txt-disabled">
                                {(position.avgPrice * 100).toFixed(0)}¢ avg
                            </Text>
                            {isActive && !isClosed && (
                                <>
                                    <Text className="text-sm text-txt-disabled">→</Text>
                                    <Text className="text-sm text-txt-disabled">
                                        {(position.curPrice * 100).toFixed(0)}¢
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                    {/* PnL */}
                    <View className="items-end">
                        {loading ? (
                            <ActivityIndicator size="small" color="#9CA3AF" />
                        ) : (
                            <Text className="text-base font-bold" style={{ color: pnlColor }}>
                                {pnlValue >= 0 ? '+' : ''}{formatCurrency(pnlValue, true)}
                            </Text>
                        )}
                        {isClosed && position.endDate && (
                            <Text className="text-xs text-txt-disabled mt-0.5">
                                {formatDate(position.endDate)}
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
