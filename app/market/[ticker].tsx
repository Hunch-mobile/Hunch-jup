import { marketsApi } from "@/lib/api";
import { Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Theme constants
const ACCENT = '#3FE3FF';
const BG_MAIN = '#000000';
const BG_CARD = '#111827';
const BG_ELEVATED = '#161C24';
const BORDER = '#1F2937';
const TEXT_PRIMARY = '#E5E7EB';
const TEXT_SECONDARY = '#9CA3AF';
const TEXT_DISABLED = '#6B7280';
const SUCCESS = '#4ade80';
const ERROR = '#f87171';

export default function MarketDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (ticker) {
      loadMarketDetails();
    }
  }, [ticker]);

  const loadMarketDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await marketsApi.fetchMarketDetails(ticker as string);
      setMarket(data);
    } catch (err) {
      console.error("Failed to fetch market details:", err);
      setError("Failed to load market details");
    } finally {
      setLoading(false);
    }
  };

  const handleTrade = () => {
    // TODO: Implement actual trading logic with Privy/Solana
    console.log(`Trading ${amount} on ${selectedSide} for ${market?.ticker}`);
    alert('Trading functionality will be connected to Solana wallet');
  };

  // Calculate probability from bid/ask if available
  const calculateProbability = () => {
    if (selectedSide === 'yes' && market?.yesBid && market?.yesAsk) {
      const bid = parseFloat(market.yesBid);
      const ask = parseFloat(market.yesAsk);
      return ((bid + ask) / 2 * 100).toFixed(1);
    } else if (selectedSide === 'no' && market?.noBid && market?.noAsk) {
      const bid = parseFloat(market.noBid);
      const ask = parseFloat(market.noAsk);
      return ((bid + ask) / 2 * 100).toFixed(1);
    }
    return '50'; // Default placeholder
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[BG_MAIN, '#0D1117', BG_CARD]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !market) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[BG_MAIN, '#0D1117', BG_CARD]} style={styles.gradient} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error || "Market not found"}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadMarketDetails}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const estimatedProbability = parseFloat(calculateProbability());

  return (
    <View style={styles.container}>
      <LinearGradient colors={[BG_MAIN, '#0D1117', BG_CARD]} style={styles.gradient} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={loadMarketDetails}>
            <Ionicons name="refresh" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Market Header */}
          <View style={styles.marketHeader}>
            <View style={styles.statusRow}>
              {market.status === 'active' && (
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>Active</Text>
                </View>
              )}
              <View style={styles.volumeContainer}>
                <Ionicons name="stats-chart" size={14} color={TEXT_SECONDARY} />
                <Text style={styles.volumeText}>${((market.volume || 0) / 1000).toFixed(1)}K Volume</Text>
              </View>
            </View>
            <Text style={styles.marketTitle}>{market.title}</Text>
            {market.subtitle && (
              <Text style={styles.marketSubtitle}>{market.subtitle}</Text>
            )}
            <View style={styles.outcomeRow}>
              {market.yesSubTitle && (
                <Text style={styles.outcomeText}>
                  <Text style={styles.outcomeLabel}>Yes: </Text>
                  {market.yesSubTitle}
                </Text>
              )}
            </View>
            {market.closeTime && (
              <Text style={styles.closeTimeText}>
                Closes: {new Date(market.closeTime * 1000).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            )}
          </View>

          {/* Probability Display */}
          <View style={styles.probabilityCard}>
            <Text style={styles.probabilityLabel}>Current Probability</Text>
            <Text style={styles.probabilityValue}>{estimatedProbability}%</Text>
            <View style={styles.probabilityBar}>
              <View style={[styles.probabilityFill, { width: `${estimatedProbability}%` }]} />
            </View>
            <View style={styles.probabilityLabels}>
              <Text style={styles.yesLabel}>Yes</Text>
              <Text style={styles.noLabel}>No</Text>
            </View>
          </View>

          {/* Trading Interface */}
          <View style={styles.tradingCard}>
            <Text style={styles.tradingTitle}>Place Your Trade</Text>

            {/* Side Selector */}
            <View style={styles.sideSelector}>
              <TouchableOpacity
                style={[
                  styles.sideButton,
                  styles.yesButton,
                  selectedSide === 'yes' && styles.sideButtonActive,
                ]}
                onPress={() => setSelectedSide('yes')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.sideButtonText,
                  selectedSide === 'yes' && styles.sideButtonTextActive,
                ]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sideButton,
                  styles.noButton,
                  selectedSide === 'no' && styles.sideButtonActive,
                ]}
                onPress={() => setSelectedSide('no')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.sideButtonText,
                  selectedSide === 'no' && styles.sideButtonTextActive,
                ]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Amount (USDC)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
              <View style={styles.quickAmounts}>
                {['10', '25', '50', '100'].map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={styles.quickAmountButton}
                    onPress={() => setAmount(value)}
                  >
                    <Text style={styles.quickAmountText}>${value}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Expected Return */}
            {amount && (
              <View style={styles.expectedReturn}>
                <View style={styles.returnRow}>
                  <Text style={styles.returnLabel}>Expected Return</Text>
                  <Text style={styles.returnValue}>
                    ${(parseFloat(amount || '0') * 1.85).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.returnRow}>
                  <Text style={styles.returnLabel}>Potential Profit</Text>
                  <Text style={[styles.returnValue, styles.profitValue]}>
                    +${(parseFloat(amount || '0') * 0.85).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Trade Button */}
            <TouchableOpacity
              style={[
                styles.tradeButton,
                (!amount || parseFloat(amount) <= 0) && styles.tradeButtonDisabled,
              ]}
              onPress={handleTrade}
              disabled={!amount || parseFloat(amount) <= 0}
              activeOpacity={0.8}
            >
              <Text style={styles.tradeButtonText}>
                Place Trade
              </Text>
              <Ionicons name="arrow-forward" size={20} color={BG_MAIN} />
            </TouchableOpacity>
          </View>

          {/* Market Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Market Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{market.status}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Volume</Text>
              <Text style={styles.infoValue}>${((market.volume || 0) / 1000).toFixed(1)}K</Text>
            </View>
            {market.openInterest && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Open Interest</Text>
                <Text style={styles.infoValue}>${(market.openInterest / 1000).toFixed(1)}K</Text>
              </View>
            )}
            {market.openTime && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Open Time</Text>
                <Text style={styles.infoValue}>
                  {new Date(market.openTime * 1000).toLocaleDateString()}
                </Text>
              </View>
            )}
            {market.rulesPrimary && (
              <View style={styles.rulesRow}>
                <Text style={styles.rulesLabel}>Rules</Text>
                <Text style={styles.rulesText}>{market.rulesPrimary}</Text>
              </View>
            )}
            {market.yesMint && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Yes Mint</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {market.yesMint.slice(0, 8)}...{market.yesMint.slice(-6)}
                </Text>
              </View>
            )}
            {market.noMint && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>No Mint</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {market.noMint.slice(0, 8)}...{market.noMint.slice(-6)}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_MAIN,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: ERROR,
    fontSize: 16,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: BG_CARD,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  marketHeader: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(63, 227, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  activeText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  volumeText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '500',
  },
  marketTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    lineHeight: 36,
  },
  marketTicker: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  marketSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 8,
    lineHeight: 20,
  },
  outcomeRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  outcomeText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  outcomeLabel: {
    fontWeight: '600',
    color: SUCCESS,
  },
  closeTimeText: {
    fontSize: 12,
    color: TEXT_DISABLED,
    fontStyle: 'italic',
    marginTop: 4,
  },
  probabilityCard: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  probabilityLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 8,
  },
  probabilityValue: {
    fontSize: 48,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 16,
  },
  probabilityBar: {
    height: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  probabilityFill: {
    height: '100%',
    backgroundColor: SUCCESS,
  },
  probabilityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yesLabel: {
    color: SUCCESS,
    fontSize: 12,
    fontWeight: '600',
  },
  noLabel: {
    color: ERROR,
    fontSize: 12,
    fontWeight: '600',
  },
  tradingCard: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tradingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  sideSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  sideButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  noButton: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  sideButtonActive: {
    borderWidth: 2,
  },
  sideButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  sideButtonTextActive: {
    color: TEXT_PRIMARY,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_ELEVATED,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    color: TEXT_SECONDARY,
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '600',
    paddingVertical: 16,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: BG_ELEVATED,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  quickAmountText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  expectedReturn: {
    backgroundColor: 'rgba(63, 227, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(63, 227, 255, 0.2)',
  },
  returnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  returnLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  returnValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  profitValue: {
    color: SUCCESS,
  },
  tradeButton: {
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  tradeButtonDisabled: {
    backgroundColor: 'rgba(63, 227, 255, 0.3)',
    opacity: 0.5,
  },
  tradeButtonText: {
    color: BG_MAIN,
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  infoLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  infoValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  rulesRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'column',
  },
  rulesLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  rulesText: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 20,
  },
});

