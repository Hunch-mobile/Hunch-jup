import { Theme } from "@/constants/theme";
import { LeaderboardOrderBy, PolymarketTrader } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Text, TouchableOpacity, View } from "react-native";

const defaultProfileImage = require("@/assets/default.jpeg");
const hunchBadge = require("@/assets/icon-blue.png");

const GREEN_LIGHT = '#4ADE80';

// Compute a demo score 0-100 from available trader data
// consistency 25% | returns 25% | win rate 20% | max loss 15% | profit factor 15%
const computeScore = (trader: PolymarketTrader): number => {
    // returns component: normalised pnl/vol ratio (higher = better returns efficiency)
    const returnRatio = trader.vol > 0 ? Math.min(trader.pnl / trader.vol, 1) : 0;
    const returnsScore = Math.max(returnRatio, 0) * 100; // 0-100

    // consistency: how positive pnl is relative to vol (smooth proxy)
    const consistencyScore = trader.pnl >= 0 ? Math.min((trader.pnl / Math.max(trader.vol, 1)) * 300, 100) : 0;

    // win rate proxy: pnl > 0 gives a base, capped by magnitude
    const winRateScore = trader.pnl > 0 ? Math.min(50 + (trader.pnl / Math.max(trader.vol, 1)) * 200, 100) : 0;

    // max loss proxy: penalise negative pnl
    const maxLossScore = trader.pnl >= 0 ? 100 : Math.max(0, 100 + (trader.pnl / Math.max(trader.vol, 1)) * 200);

    // profit factor proxy
    const pfScore = trader.pnl > 0 ? Math.min((trader.pnl / Math.max(trader.vol * 0.1, 1)) * 10, 100) : 0;

    return Math.round(
        consistencyScore * 0.25 +
        returnsScore * 0.25 +
        winRateScore * 0.20 +
        maxLossScore * 0.15 +
        pfScore * 0.15
    );
};

const getScoreColor = (score: number): string => {
    if (score >= 70) return '#4ADE80';
    if (score >= 40) return '#FACC15';
    return '#F87171';
};

const YELLOW = '#FACC15';
const YELLOW_DARK = '#EAB308';

interface LeaderboardRowProps {
    trader: PolymarketTrader;
    orderBy: LeaderboardOrderBy;
    onPress: () => void;
}

const formatCurrency = (value: number): string => {
    if (Math.abs(value) >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
        return `$${(value / 1_000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
};

const trimUsername = (name: string): string => {
    if (name.length <= 16) return name;
    return `${name.slice(0, 5)}...${name.slice(-3)}`;
};

const getRankDisplay = (rank: number): { emoji: string | null; color: string } => {
    switch (rank) {
        case 1: return { emoji: '🥇', color: YELLOW };
        case 2: return { emoji: '🥈', color: '#C0C0C0' };
        case 3: return { emoji: '🥉', color: '#CD7F32' };
        default: return { emoji: null, color: Theme.textSecondary };
    }
};

export default function LeaderboardRow({ trader, orderBy, onPress }: LeaderboardRowProps) {
    const rank = parseInt(trader.rank, 10);
    const rankInfo = getRankDisplay(rank);
    const isPositivePnl = trader.pnl >= 0;
    const isTop3 = rank <= 3;

    const displayValue = orderBy === 'PNL' ? trader.pnl : trader.vol;
    const displayLabel = orderBy === 'PNL' ? 'PnL' : 'Vol';
    const score = computeScore(trader);
    const scoreColor = getScoreColor(score);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.6}
            className="flex-row items-center py-3.5 mb-1"
            style={{
                backgroundColor: isTop3 ? `${YELLOW}08` : 'transparent',
                borderRadius: 16,
                paddingHorizontal: 12,
            }}
        >
            {/* Rank */}
            <View className="w-8 items-center mr-2.5">
                {rankInfo.emoji ? (
                    <Text style={{ fontSize: 20 }}>{rankInfo.emoji}</Text>
                ) : (
                    <Text className="text-sm font-semibold" style={{ color: Theme.textDisabled }}>
                        {trader.rank}
                    </Text>
                )}
            </View>

            {/* Avatar with badge overlay */}
            <View className="relative mr-3">
                <View className="w-11 h-11 rounded-full overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
                    <Image
                        source={trader.profileImage ? { uri: trader.profileImage } : defaultProfileImage}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                    />
                </View>
                {/* Hunch Badge */}
                <View className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-white items-center justify-center"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                >
                    <Image
                        source={hunchBadge}
                        style={{ width: 14, height: 14, borderRadius: 7 }}
                        contentFit="cover"
                    />
                </View>
            </View>

            {/* User Info */}
            <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                    <Text className="text-[15px] font-semibold text-txt-primary" numberOfLines={1}>
                        {trimUsername(trader.userName || `${trader.proxyWallet.slice(0, 6)}...${trader.proxyWallet.slice(-4)}`)}
                    </Text>
                    {trader.verifiedBadge && (
                        <Ionicons name="checkmark-circle" size={14} color={YELLOW_DARK} />
                    )}
                </View>
                {trader.xUsername && (
                    <Text className="text-xs text-txt-disabled mt-0.5" numberOfLines={1}>
                        @{trader.xUsername}
                    </Text>
                )}
            </View>

            {/* Score pill */}
            <View
                className="items-center justify-center mx-2 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${scoreColor}18` }}
            >
                <Text style={{ fontSize: 11, fontWeight: '700', color: scoreColor }}>{score}</Text>
            </View>

            {/* Value Display */}
            <View className="items-end ml-3">
                <Text
                    style={{
                        fontSize: 17,
                        fontWeight: '800',
                        color: orderBy === 'PNL'
                            ? isPositivePnl ? GREEN_LIGHT : '#F87171'
                            : Theme.textPrimary,
                    }}
                >
                    {orderBy === 'PNL' && isPositivePnl ? '+' : ''}
                    {formatCurrency(displayValue)}
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: Theme.textDisabled }}>
                    {displayLabel}
                </Text>
            </View>
        </TouchableOpacity>
    );
}
