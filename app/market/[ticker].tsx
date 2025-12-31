import TradeQuoteSheet from "@/components/TradeQuoteSheet";
import { useUser } from "@/contexts/UserContext";
import { api, marketsApi } from "@/lib/api";
import { Market } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  const { backendUser } = useUser();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [showQuoteSheet, setShowQuoteSheet] = useState(false);
  const [lastTradeId, setLastTradeId] = useState<string | null>(null);

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

  const handleTrade = async () => {
    if (!market || !backendUser || !amount || parseFloat(amount) <= 0) return;

    Keyboard.dismiss();
    setIsTrading(true);
    setTradeError(null);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const trade = await api.createTrade({
        userId: backendUser.id,
        marketTicker: market.ticker,
        eventTicker: market.eventTicker,
        side: selectedSide,
        amount: amount,
        walletAddress: backendUser.walletAddress,
        transactionSig: 'dummy_transaction_' + Date.now(),
        isDummy: true,
      });

      setLastTradeId(trade.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show quote sheet after successful trade
      setShowQuoteSheet(true);
    } catch (err: any) {
      console.error("Trade placement error:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      let errorMessage = "Failed to place trade";
      if (err.message?.includes("insufficient")) {
        errorMessage = "Insufficient balance";
      } else if (err.message?.includes("market")) {
        errorMessage = "Market not available";
      }
      setTradeError(errorMessage);
    } finally {
      setIsTrading(false);
    }
  };

  const handleQuoteSubmit = async (quote: string) => {
    // TODO: Update trade with quote via API if needed
    console.log("Quote submitted:", quote, "for trade:", lastTradeId);
    setShowQuoteSheet(false);
    setAmount('');
    router.back();
  };

  const handleQuoteSkip = () => {
    setShowQuoteSheet(false);
    setAmount('');
    router.back();
  };

  // Calculate probability from bid/ask if available
  const calculateProbability = () => {
    if (market?.yesBid && market?.yesAsk) {
      const bid = parseFloat(market.yesBid);
      const ask = parseFloat(market.yesAsk);
      return ((bid + ask) / 2 * 100);
    }
    return 50; // Default placeholder
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

  const estimatedProbability = calculateProbability();
  const betAmount = parseFloat(amount || '0');
  const canTrade = betAmount > 0 && !isTrading && backendUser;

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

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Market Header */}
          <View style={styles.marketHeader}>
            <View style={styles.statusRow}>
              {market.status === 'active' && (
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>Live</Text>
                </View>
              )}
              <View style={styles.volumeContainer}>
                <Ionicons name="stats-chart" size={14} color={TEXT_SECONDARY} />
                <Text style={styles.volumeText}>${((market.volume || 0) / 1000).toFixed(1)}K</Text>
              </View>
            </View>
            <Text style={styles.marketTitle}>{market.title}</Text>
            {market.yesSubTitle && (
              <Text style={styles.outcomeText}>
                <Text style={styles.yesHighlight}>Yes</Text> = {market.yesSubTitle}
              </Text>
            )}
            {market.closeTime && (
              <View style={styles.closeTimeRow}>
                <Ionicons name="time-outline" size={14} color={TEXT_DISABLED} />
                <Text style={styles.closeTimeText}>
                  Closes {new Date(market.closeTime * 1000).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Probability Display */}
          <View style={styles.probabilityCard}>
            <View style={styles.probHeader}>
              <Text style={styles.probLabel}>Current Probability</Text>
              <Text style={styles.probValue}>{estimatedProbability.toFixed(1)}%</Text>
            </View>
            <View style={styles.probBarContainer}>
              <View style={styles.probBar}>
                <View style={[styles.probFill, { width: `${estimatedProbability}%` }]} />
              </View>
              <View style={styles.probLabels}>
                <Text style={styles.yesLabel}>Yes</Text>
                <Text style={styles.noLabel}>No</Text>
              </View>
            </View>
          </View>

          {/* Trading Card */}
          <View style={styles.tradingCard}>
            {/* Side Selector */}
            <View style={styles.sideSelector}>
              <TouchableOpacity
                style={[
                  styles.sideButton,
                  selectedSide === 'yes' && styles.yesSideActive,
                ]}
                onPress={() => {
                  setSelectedSide('yes');
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <View style={styles.sideContent}>
                  <Ionicons 
                    name="trending-up" 
                    size={20} 
                    color={selectedSide === 'yes' ? SUCCESS : TEXT_DISABLED} 
                  />
                  <Text style={[
                    styles.sideText,
                    selectedSide === 'yes' && styles.yesTextActive,
                  ]}>Yes</Text>
                </View>
                {selectedSide === 'yes' && (
                  <View style={styles.sideCheck}>
                    <Ionicons name="checkmark" size={14} color={SUCCESS} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sideButton,
                  selectedSide === 'no' && styles.noSideActive,
                ]}
                onPress={() => {
                  setSelectedSide('no');
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <View style={styles.sideContent}>
                  <Ionicons 
                    name="trending-down" 
                    size={20} 
                    color={selectedSide === 'no' ? ERROR : TEXT_DISABLED} 
                  />
                  <Text style={[
                    styles.sideText,
                    selectedSide === 'no' && styles.noTextActive,
                  ]}>No</Text>
                </View>
                {selectedSide === 'no' && (
                  <View style={styles.sideCheck}>
                    <Ionicons name="checkmark" size={14} color={ERROR} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount</Text>
              <View style={styles.amountInputRow}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={TEXT_DISABLED}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={(t) => {
                      setAmount(t.replace(',', '.'));
                      setTradeError(null);
                    }}
                  />
                </View>
              </View>
              <View style={styles.quickAmounts}>
                {['5', '10', '25', '50', '100'].map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.quickBtn,
                      amount === value && styles.quickBtnActive,
                    ]}
                    onPress={() => {
                      setAmount(value);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[
                      styles.quickBtnText,
                      amount === value && styles.quickBtnTextActive,
                    ]}>${value}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Payout Preview */}
            {betAmount > 0 && (
              <View style={styles.payoutPreview}>
                <View style={styles.payoutRow}>
                  <Text style={styles.payoutLabel}>If you win</Text>
                  <Text style={styles.payoutValue}>
                    ${(betAmount * (100 / estimatedProbability)).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.payoutRow}>
                  <Text style={styles.payoutLabel}>Profit</Text>
                  <Text style={styles.profitValue}>
                    +${((betAmount * (100 / estimatedProbability)) - betAmount).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Error Message */}
            {tradeError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={ERROR} />
                <Text style={styles.errorBannerText}>{tradeError}</Text>
              </View>
            )}

            {/* Trade Button */}
            <TouchableOpacity
              style={[styles.tradeButton, !canTrade && styles.tradeButtonDisabled]}
              onPress={handleTrade}
              disabled={!canTrade}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={canTrade ? [ACCENT, '#00B8D4'] : [BG_ELEVATED, BG_ELEVATED]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tradeGradient}
              >
                {isTrading ? (
                  <ActivityIndicator size="small" color={BG_MAIN} />
                ) : (
                  <>
                    <Text style={[styles.tradeButtonText, !canTrade && styles.tradeButtonTextDisabled]}>
                      {betAmount > 0 ? `Bet $${betAmount.toFixed(2)} on ${selectedSide.toUpperCase()}` : 'Enter Amount'}
                    </Text>
                    {canTrade && <Ionicons name="arrow-forward" size={18} color={BG_MAIN} />}
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Market Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Details</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={styles.infoValue}>{market.status}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Volume</Text>
                <Text style={styles.infoValue}>${((market.volume || 0) / 1000).toFixed(1)}K</Text>
              </View>
              {market.openInterest && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Open Interest</Text>
                  <Text style={styles.infoValue}>${(market.openInterest / 1000).toFixed(1)}K</Text>
                </View>
              )}
            </View>
            {market.rulesPrimary && (
              <View style={styles.rulesSection}>
                <Text style={styles.rulesLabel}>Rules</Text>
                <Text style={styles.rulesText}>{market.rulesPrimary}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Quote Sheet */}
      <TradeQuoteSheet
        visible={showQuoteSheet}
        onClose={() => setShowQuoteSheet(false)}
        onSubmit={handleQuoteSubmit}
        onSkip={handleQuoteSkip}
        tradeInfo={{
          side: selectedSide,
          amount: amount,
          marketTitle: market.title,
        }}
      />
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
    paddingVertical: 12,
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
    borderWidth: 1,
    borderColor: BORDER,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
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
  // Market Header
  marketHeader: {
    marginBottom: 20,
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
    backgroundColor: 'rgba(63, 227, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(63, 227, 255, 0.2)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  activeText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  volumeText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '500',
  },
  marketTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 10,
    lineHeight: 32,
  },
  outcomeText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 10,
  },
  yesHighlight: {
    fontWeight: '700',
    color: SUCCESS,
  },
  closeTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closeTimeText: {
    fontSize: 13,
    color: TEXT_DISABLED,
  },
  // Probability Card
  probabilityCard: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  probHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  probLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  probValue: {
    fontSize: 28,
    fontWeight: '700',
    color: ACCENT,
  },
  probBarContainer: {},
  probBar: {
    height: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.25)',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  probFill: {
    height: '100%',
    backgroundColor: SUCCESS,
    borderRadius: 999,
  },
  probLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yesLabel: {
    color: SUCCESS,
    fontSize: 11,
    fontWeight: '700',
  },
  noLabel: {
    color: ERROR,
    fontSize: 11,
    fontWeight: '700',
  },
  // Trading Card
  tradingCard: {
    backgroundColor: BG_CARD,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sideSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  sideButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: BG_ELEVATED,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sideContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sideText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DISABLED,
  },
  yesSideActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.4)',
  },
  noSideActive: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  yesTextActive: {
    color: SUCCESS,
  },
  noTextActive: {
    color: ERROR,
  },
  sideCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Amount Section
  amountSection: {
    marginBottom: 16,
  },
  amountLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  amountInputRow: {},
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_ELEVATED,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    color: TEXT_SECONDARY,
    fontSize: 24,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
    paddingVertical: 14,
    paddingLeft: 6,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: BG_ELEVATED,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  quickBtnActive: {
    backgroundColor: 'rgba(63, 227, 255, 0.1)',
    borderColor: 'rgba(63, 227, 255, 0.3)',
  },
  quickBtnText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },
  quickBtnTextActive: {
    color: ACCENT,
  },
  // Payout Preview
  payoutPreview: {
    backgroundColor: 'rgba(63, 227, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(63, 227, 255, 0.15)',
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  payoutLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  payoutValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  profitValue: {
    color: SUCCESS,
    fontSize: 14,
    fontWeight: '700',
  },
  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  errorBannerText: {
    color: ERROR,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  // Trade Button
  tradeButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  tradeButtonDisabled: {
    opacity: 0.7,
  },
  tradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  tradeButtonText: {
    color: BG_MAIN,
    fontSize: 16,
    fontWeight: '700',
  },
  tradeButtonTextDisabled: {
    color: TEXT_DISABLED,
  },
  // Info Card
  infoCard: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  infoItem: {
    backgroundColor: BG_ELEVATED,
    borderRadius: 10,
    padding: 12,
    minWidth: '30%',
    flex: 1,
  },
  infoLabel: {
    color: TEXT_DISABLED,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  rulesSection: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  rulesLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  rulesText: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 20,
  },
});

