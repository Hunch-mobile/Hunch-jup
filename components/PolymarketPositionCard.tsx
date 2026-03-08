import { PolymarketClosedPosition, PolymarketPosition } from "@/lib/types";
import { Image } from "expo-image";
import { Text, View } from "react-native";

const defaultIcon = require("@/assets/default.jpeg");
const hunchBadge = require("@/assets/icon-blue.png");

const YELLOW = '#FACC15';

const formatCurrency = (value: number | null | undefined, compact = false) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    if (compact) {
        if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
};

const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

interface PolymarketPositionCardProps {
    position: PolymarketPosition | PolymarketClosedPosition;
    isClosed?: boolean;
}

function isActivePosition(position: PolymarketPosition | PolymarketClosedPosition): position is PolymarketPosition {
    return 'currentValue' in position;
}

export default function PolymarketPositionCard({ position, isClosed = false }: PolymarketPositionCardProps) {
    const isYes = position.outcome.toLowerCase() === 'yes' || position.outcomeIndex === 0;
    const isActive = isActivePosition(position);

    const pnlValue = isActive ? position.cashPnl : position.realizedPnl;
    const pnlPercent = isActive ? position.percentPnl : null;
    const pnlColor = pnlValue >= 0 ? '#16A34A' : '#DC2626';

    const costBasis = isActive ? position.initialValue : position.totalBought;
    const currentValue = isActive ? position.currentValue : null;

    return (
        <View className="mb-3">
            <View className="rounded-2xl p-4 overflow-hidden" style={{ backgroundColor: '#F9FAFB' }}>
                {/* Header Row */}
                <View className="flex-row justify-between items-start gap-3 mb-2">
                    <Text className="text-lg font-bold flex-1" numberOfLines={2}>
                        {formatCurrency(costBasis)}{" "}
                        <Text
                            style={{ color: isYes ? '#16A34A' : '#DC2626', fontSize: 18, fontWeight: '800' }}
                        >
                            {position.outcome.toUpperCase()}
                        </Text>
                    </Text>
                    {position.endDate && (
                        <Text className="text-xs text-txt-disabled shrink-0">
                            {isClosed ? 'Closed' : `Ends ${formatDate(position.endDate)}`}
                        </Text>
                    )}
                </View>

                {/* Market Info Row */}
                <View className="flex-row items-center gap-3 mb-3">
                    <View className="relative">
                        <View className="w-12 h-12 rounded-xl overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
                            <Image
                                source={position.icon ? { uri: position.icon } : defaultIcon}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        </View>
                        {/* Hunch Badge */}
                        <View className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-white items-center justify-center"
                            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                        >
                            <Image
                                source={hunchBadge}
                                style={{ width: 14, height: 14, borderRadius: 7 }}
                                contentFit="cover"
                            />
                        </View>
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-medium text-txt-primary" numberOfLines={2}>
                            {position.title}
                        </Text>
                        {position.eventSlug && (
                            <Text className="text-xs text-txt-disabled mt-0.5" numberOfLines={1}>
                                {position.eventSlug.replace(/-/g, ' ')}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Stats Row */}
                <View className="flex-row items-start justify-between">
                    {/* Current Value (only for active positions) */}
                    {isActive && !isClosed && (
                        <View className="flex-1">
                            <Text className="text-[11px] text-txt-disabled uppercase">Value</Text>
                            <Text className="text-base font-semibold text-txt-primary">
                                {formatCurrency(currentValue)}
                            </Text>
                        </View>
                    )}

                    {/* Entry Price */}
                    <View className="flex-1">
                        <Text className="text-[11px] text-txt-disabled uppercase">Avg Price</Text>
                        <Text className="text-base font-semibold text-txt-primary">
                            {(position.avgPrice * 100).toFixed(0)}¢
                        </Text>
                    </View>

                    {/* Current Price (only for active) */}
                    {isActive && !isClosed && (
                        <View className="flex-1">
                            <Text className="text-[11px] text-txt-disabled uppercase">Price</Text>
                            <Text className="text-base font-semibold text-txt-primary">
                                {(position.curPrice * 100).toFixed(0)}¢
                            </Text>
                        </View>
                    )}

                    {/* PnL */}
                    <View className="flex-1 items-end">
                        <Text className="text-[11px] text-txt-disabled uppercase">
                            {isClosed ? 'Realized' : 'PnL'}
                        </Text>
                        <Text className="text-base font-semibold" style={{ color: pnlColor }}>
                            {pnlValue >= 0 ? '+' : ''}{formatCurrency(pnlValue)}
                        </Text>
                        {pnlPercent !== null && (
                            <Text className="text-[11px] font-medium" style={{ color: pnlColor }}>
                                {formatPercent(pnlPercent)}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Redeemable/Mergeable badges for active positions */}
                {isActive && (position.redeemable || position.mergeable) && (
                    <View className="flex-row gap-2 mt-3">
                        {position.redeemable && (
                            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: `${YELLOW}25` }}>
                                <Text className="text-xs font-medium" style={{ color: '#A16207' }}>Redeemable</Text>
                            </View>
                        )}
                        {position.mergeable && (
                            <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: `${YELLOW}25` }}>
                                <Text className="text-xs font-medium" style={{ color: '#A16207' }}>Mergeable</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}
