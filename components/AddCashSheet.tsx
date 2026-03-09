import { Ionicons } from "@expo/vector-icons";
import {
    transact,
    Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
    clusterApiUrl,
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";

// ── USDC helpers ──
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_DECIMALS = 6;
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MAINNET_RPC_FALLBACK = clusterApiUrl("mainnet-beta");

function getMainnetRpcUrl(): string {
    const configuredRpc = process.env.EXPO_PUBLIC_SOLANA_RPC_URL?.trim();
    if (configuredRpc && /^https?:\/\//i.test(configuredRpc)) return configuredRpc;
    return MAINNET_RPC_FALLBACK;
}

function getWalletAccountPublicKey(account: any): PublicKey | null {
    if (!account) return null;

    if (Array.isArray(account.address)) {
        try { return new PublicKey(Uint8Array.from(account.address)); } catch { /* noop */ }
    }

    if (typeof account.address === "string") {
        try { return new PublicKey(account.address); } catch { /* noop */ }
        try { return new PublicKey(Buffer.from(account.address, "base64")); } catch { /* noop */ }
    }

    if (typeof account.display_address === "string") {
        try { return new PublicKey(account.display_address); } catch { /* noop */ }
    }

    return null;
}

function getWalletAccountAddressBase64(account: any): string | null {
    if (!account) return null;
    if (typeof account.address === "string") {
        try {
            const decoded = Buffer.from(account.address, "base64");
            if (decoded.length === 32) return account.address;
        } catch {
            /* noop */
        }
        try {
            return new PublicKey(account.address).toBuffer().toString("base64");
        } catch {
            return null;
        }
    }
    if (Array.isArray(account.address)) {
        try {
            return Buffer.from(Uint8Array.from(account.address)).toString("base64");
        } catch {
            return null;
        }
    }
    return null;
}

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
}

function createAssociatedTokenAccountInstruction(
    payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey
): TransactionInstruction {
    return new TransactionInstruction({
        keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: ata, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.alloc(0),
    });
}

function createSPLTransferInstruction(
    source: PublicKey, destination: PublicKey, owner: PublicKey, amount: bigint
): TransactionInstruction {
    const data = Buffer.alloc(9);
    data.writeUInt8(3, 0);
    data.writeBigUInt64LE(amount, 1);
    return new TransactionInstruction({
        keys: [
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: owner, isSigner: true, isWritable: false },
        ],
        programId: TOKEN_PROGRAM_ID,
        data,
    });
}

import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import QRCodeStyled from "react-native-qrcode-styled";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const APP_IDENTITY = { name: "Hunch", uri: "https://hunch.app", icon: "favicon.ico" };

// ── Theme — matches SendSheet / WithdrawSheet exactly ──
const SHEET_BG      = "#e8d723";
const SURFACE_BG    = "rgba(0,0,0,0.07)";
const SURFACE_BORDER= "rgba(0,0,0,0.14)";
const TEXT_PRIMARY  = "#11181C";
const TEXT_DIM      = "rgba(0,0,0,0.62)";
const TEXT_MUTED    = "rgba(0,0,0,0.42)";
const SUCCESS       = "#00C853";
const DANGER        = "#FF3B30";

type FundingOption = "wallet" | "qr" | "privy";
type SheetStep     = "select" | "detail";

interface AddCashSheetProps {
    visible: boolean;
    onClose: () => void;
    walletAddress: string;
    onPrivyFund: () => void | Promise<void>;
    onFundsAdded?: () => void | Promise<void>;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const COMPACT_H        = 260;
const EXPANDED_H       = SCREEN_H * 0.8;
const EXPANDED_WALLET_H = SCREEN_H * 0.6;

const OPTIONS: {
    key: FundingOption;
    label: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    badge?: string;
}[] = [
    {
        key: "wallet",
        label: "Connect your SOL wallet",
        subtitle: "Use Phantom, Solflare, or any Solana wallet",
        icon: "wallet-outline",
    },
    {
        key: "qr",
        label: "Receive on address",
        subtitle: "Copy your Hunch USDC deposit address",
        icon: "qr-code-outline",
    },
    {
        key: "privy",
        label: "Debit / Pay",
        subtitle: "Deposit USDC with card or Apple Pay",
        icon: "card-outline",
    },
];

export default function AddCashSheet({
    visible, onClose, walletAddress, onPrivyFund, onFundsAdded,
}: AddCashSheetProps) {
    const insets = useSafeAreaInsets();
    const [step, setStep]           = useState<SheetStep>("select");
    const [option, setOption]       = useState<FundingOption>("wallet");
    const [copied, setCopied]       = useState(false);

    const slideAnim       = useRef(new Animated.Value(SCREEN_H)).current;
    const contentHeightAnim = useRef(new Animated.Value(COMPACT_H)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 8,
            onPanResponderMove:   (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
            onPanResponderRelease:(_, g) => {
                if (g.dy > 140) {
                    handleClose();
                } else {
                    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 30, stiffness: 500, mass: 0.8 }).start();
                }
            },
        })
    ).current;

    useEffect(() => {
        if (visible) {
            setStep("select");
            setCopied(false);
            contentHeightAnim.setValue(COMPACT_H);
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 400, mass: 0.8 }).start();
        } else {
            slideAnim.setValue(SCREEN_H);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: true })
            .start(() => onClose());
    };

    const selectOption = (o: FundingOption) => {
        setOption(o);
        setStep("detail");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const targetHeight = o === "wallet" ? EXPANDED_WALLET_H : EXPANDED_H;
        Animated.spring(contentHeightAnim, {
            toValue: targetHeight,
            useNativeDriver: false,
            damping: 22,
            stiffness: 180,
            mass: 0.9,
        }).start();
    };

    const goBack = () => {
        setStep("select");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Animated.spring(contentHeightAnim, { toValue: COMPACT_H, useNativeDriver: false, damping: 28, stiffness: 300 }).start();
    };

    const copyAddress = async () => {
        if (!walletAddress) return;
        await Clipboard.setStringAsync(walletAddress);
        setCopied(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setCopied(false), 2000);
    };

    const shortenAddress = (addr: string) =>
        addr.length > 16 ? `${addr.slice(0, 6)}...${addr.slice(-6)}` : addr;

    const handlePrivyFund = () => {
        handleClose();
        setTimeout(async () => {
            try {
                await onPrivyFund();
                await onFundsAdded?.();
            } catch (e) {
                console.error("Privy funding failed:", e);
            }
        }, 350);
    };

    const OPTION_LABEL: Record<FundingOption, string> = {
        wallet: "Fund Wallet",
        qr:     "QR Code",
        privy:  "Card / Pay",
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
            <View style={[StyleSheet.absoluteFill, S.backdrop]}>
                <Animated.View
                    style={[
                        S.sheet,
                        {
                            paddingBottom: insets.bottom + 8,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >

                    {/* Drag handle */}
                    <View style={S.handleWrap} {...panResponder.panHandlers}>
                        <View style={S.handle} />
                    </View>

                    {/* Header */}
                    <View style={S.header}>
                        {step === "detail" ? (
                            <TouchableOpacity style={S.headerSide} onPress={goBack} activeOpacity={0.6}>
                                <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
                            </TouchableOpacity>
                        ) : (
                            <View style={S.headerSide} />
                        )}
                        <Text style={S.headerTitle}>
                            {step === "detail" ? OPTION_LABEL[option] : "Add Cash"}
                        </Text>
                        <TouchableOpacity style={S.headerSide} onPress={handleClose} activeOpacity={0.6}>
                            <Ionicons name="close" size={17} color={TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <Animated.View style={{ minHeight: contentHeightAnim, overflow: "hidden" }}>
                        {step === "select" ? (
                            /* ─── Step 1: vertical sheet list ─── */
                            <View style={S.listContainer}>
                                <View style={S.listSurface}>
                                    {OPTIONS.map((opt, index) => {
                                        const isLast = index === OPTIONS.length - 1;
                                        return (
                                            <TouchableOpacity
                                                key={opt.key}
                                                style={[S.listItem, !isLast && S.listItemDivider]}
                                                onPress={() => selectOption(opt.key)}
                                                activeOpacity={0.78}
                                            >
                                                <View style={S.listLeft}>
                                                    <View style={S.listIconWrap}>
                                                        <Ionicons name={opt.icon} size={22} color={TEXT_PRIMARY} />
                                                    </View>
                                                    <View style={S.listTextWrap}>
                                                        <View style={S.listTitleRow}>
                                                            <Text style={S.listTitle}>{opt.label}</Text>
                                                            {opt.badge && (
                                                                <View style={S.badgePill}>
                                                                    <Text style={S.badgePillText}>{opt.badge}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text style={S.listSubtitle} numberOfLines={2}>
                                                            {opt.subtitle}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : (
                            /* ─── Step 2: expanded detail ─── */
                            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={S.detailScroll}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    {option === "wallet" && (
                                        <WalletFundTab
                                            walletAddress={walletAddress}
                                            onCopy={copyAddress}
                                            copied={copied}
                                            shortenAddress={shortenAddress}
                                            onFundsAdded={onFundsAdded}
                                        />
                                    )}
                                    {option === "qr" && (
                                        <QRTab
                                            walletAddress={walletAddress}
                                            onCopy={copyAddress}
                                            copied={copied}
                                            shortenAddress={shortenAddress}
                                        />
                                    )}
                                    {option === "privy" && (
                                        <PrivyFundTab onFund={handlePrivyFund} />
                                    )}
                                </ScrollView>
                            </KeyboardAvoidingView>
                        )}
                    </Animated.View>

                </Animated.View>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────
// Tab 1 — Fund from external wallet
// ─────────────────────────────────────
function WalletFundTab({ walletAddress, onCopy, copied, shortenAddress, onFundsAdded }: {
    walletAddress: string; onCopy: () => void; copied: boolean; shortenAddress: (a: string) => string;
    onFundsAdded?: () => void | Promise<void>;
}) {
    const [externalAddress, setExternalAddress] = useState<string | null>(null);
    const [externalOwnerAddress, setExternalOwnerAddress] = useState<string | null>(null);
    const [externalAddressBase64, setExternalAddressBase64] = useState<string | null>(null);
    const [walletAuthToken, setWalletAuthToken] = useState<string | null>(null);
    const [walletUriBase, setWalletUriBase] = useState<string | null>(null);
    const [usdcBalance,     setUsdcBalance]     = useState<number | null>(null);
    const [loadingBalance,  setLoadingBalance]  = useState(false);
    const [solAmount,       setSolAmount]       = useState("");
    const [sending,         setSending]         = useState(false);

    const fetchUsdcBalance = async (address: string) => {
        setLoadingBalance(true);
        try {
            const rpcUrl = getMainnetRpcUrl();
            const connection = new Connection(rpcUrl, "confirmed");
            const pubkey = new PublicKey(address);
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, { mint: USDC_MINT });
            const totalBalance = tokenAccounts.value.reduce((sum, accountInfo) => {
                const amount = (accountInfo.account.data as any)?.parsed?.info?.tokenAmount?.uiAmount;
                return sum + (typeof amount === "number" ? amount : 0);
            }, 0);
            setUsdcBalance(totalBalance);
        } catch { setUsdcBalance(0); }
        finally  { setLoadingBalance(false); }
    };

    const connectWallet = async () => {
        try {
            const result = await transact(async (wallet: Web3MobileWallet) => {
                return wallet.authorize({ chain: "solana:mainnet", identity: APP_IDENTITY });
            });
            if (result?.accounts?.[0]) {
                const acct = result.accounts[0] as any;
                const ownerPk = getWalletAccountPublicKey(acct);
                const accountAddressBase64 = getWalletAccountAddressBase64(acct);
                if (!ownerPk) {
                    Alert.alert("Connection Failed", "Could not read a valid Solana wallet address.");
                    return;
                }
                const rawAddr = ownerPk.toBase58();
                const displayAddr = acct.display_address || rawAddr;
                setExternalAddress(displayAddr);
                setExternalOwnerAddress(rawAddr);
                setExternalAddressBase64(accountAddressBase64);
                setWalletAuthToken(typeof (result as any)?.auth_token === "string" ? (result as any).auth_token : null);
                setWalletUriBase(typeof (result as any)?.wallet_uri_base === "string" ? (result as any).wallet_uri_base : null);
                fetchUsdcBalance(rawAddr);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (e: any) {
            Alert.alert("Connection Failed", e?.message || "Could not connect to wallet.");
        }
    };

    const sendUsdc = async () => {
        const amount = parseFloat(solAmount);
        if (!amount || amount <= 0) { Alert.alert("Invalid Amount", "Enter a valid USDC amount."); return; }
        if (usdcBalance !== null && amount > usdcBalance) {
            Alert.alert("Insufficient Balance", `You only have ${usdcBalance.toFixed(2)} USDC.`); return;
        }
        if (!externalAddress || !externalOwnerAddress) {
            Alert.alert("Wallet Not Connected", "Please connect your external wallet again.");
            return;
        }
        if (!walletAddress) {
            Alert.alert("Missing Deposit Address", "Your Hunch wallet address is unavailable. Please try again.");
            return;
        }
        setSending(true);
        try {
            const rpcUrl = getMainnetRpcUrl();
            const connection = new Connection(rpcUrl, "confirmed");
            const expectedSenderPK = new PublicKey(externalOwnerAddress);
            const recipientPK = new PublicKey(walletAddress);
            const amountRaw = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));

            const recipAta = getAssociatedTokenAddress(recipientPK, USDC_MINT);
            const senderUsdcAccounts = await connection.getParsedTokenAccountsByOwner(expectedSenderPK, {
                mint: USDC_MINT,
            });
            const sourceAccount = senderUsdcAccounts.value
                .map((acc) => {
                    const rawAmount = (acc.account.data as any)?.parsed?.info?.tokenAmount?.amount;
                    let parsedAmount = 0n;
                    try { parsedAmount = BigInt(typeof rawAmount === "string" ? rawAmount : "0"); }
                    catch { parsedAmount = 0n; }
                    return { pubkey: acc.pubkey, amount: parsedAmount };
                })
                .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0))
                .find((acc) => acc.amount >= amountRaw);

            if (!sourceAccount) {
                throw new Error("No mainnet USDC token account with enough balance was found for this wallet.");
            }

            const recipAtaInfo = await connection.getAccountInfo(recipAta);
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            const tx = new Transaction();
            tx.recentBlockhash = blockhash;
            tx.feePayer = expectedSenderPK;
            if (!recipAtaInfo) {
                tx.add(createAssociatedTokenAccountInstruction(expectedSenderPK, recipAta, recipientPK, USDC_MINT));
            }
            tx.add(createSPLTransferInstruction(sourceAccount.pubkey, recipAta, expectedSenderPK, amountRaw));

            const transactConfig = walletUriBase ? { baseUri: walletUriBase } : undefined;

            const signedTx = await transact(async (wallet: Web3MobileWallet) => {
                let authResult: any;
                if (walletAuthToken) {
                    try {
                        authResult = await wallet.reauthorize({
                            auth_token: walletAuthToken,
                            identity: APP_IDENTITY,
                        });
                    } catch {
                        authResult = await wallet.authorize({
                            chain: "solana:mainnet",
                            identity: APP_IDENTITY,
                        });
                    }
                } else {
                    authResult = await wallet.authorize({
                        chain: "solana:mainnet",
                        identity: APP_IDENTITY,
                    });
                }

                if (typeof authResult?.auth_token === "string" && authResult.auth_token !== walletAuthToken) {
                    setWalletAuthToken(authResult.auth_token);
                }
                if (typeof authResult?.wallet_uri_base === "string" && authResult.wallet_uri_base !== walletUriBase) {
                    setWalletUriBase(authResult.wallet_uri_base);
                }

                const authorizedAccounts = Array.isArray(authResult?.accounts) ? authResult.accounts : [];
                if (authorizedAccounts.length > 0) {
                    const preferredAccount = authorizedAccounts.find((acct: any) => {
                        const pk = getWalletAccountPublicKey(acct);
                        const b64 = getWalletAccountAddressBase64(acct);
                        return pk?.toBase58() === externalOwnerAddress || (!!externalAddressBase64 && b64 === externalAddressBase64);
                    });
                    if (!preferredAccount) {
                        throw new Error("Authorized account changed. Please reconnect the same wallet account and try again.");
                    }
                    const authorizedPK = getWalletAccountPublicKey(preferredAccount);
                    if (!authorizedPK || !authorizedPK.equals(expectedSenderPK)) {
                        throw new Error("Authorized account does not match connected wallet account.");
                    }
                    const refreshedB64 = getWalletAccountAddressBase64(preferredAccount);
                    if (refreshedB64) setExternalAddressBase64(refreshedB64);
                }

                const signedTxs = await wallet.signTransactions({ transactions: [tx] });
                const signed = signedTxs?.[0];
                if (!signed || typeof (signed as any).serialize !== "function") {
                    throw new Error("Wallet returned no signed transaction.");
                }
                return signed;
            }, transactConfig);

            const rawTx = (signedTx as any).serialize();
            const signature = await connection.sendRawTransaction(rawTx, {
                skipPreflight: false,
                preflightCommitment: "confirmed",
            });

            const sigStr = typeof signature === "string"
                ? signature
                : Buffer.from(signature).toString("base64");

            setSolAmount("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Transfer Sent", `$${amount} USDC submitted.\nTx: ${sigStr.slice(0, 12)}...`);
            if (externalOwnerAddress) {
                fetchUsdcBalance(externalOwnerAddress);
            }
            await onFundsAdded?.();
        } catch (e: any) {
            console.error("USDC transfer failed:", e);
            Alert.alert("Transfer Failed", e?.message || "Could not send transaction.");
        } finally { setSending(false); }
    };

    const amountNum      = parseFloat(solAmount);
    const exceedsBalance = usdcBalance !== null && !isNaN(amountNum) && amountNum > usdcBalance;
    const isValid        = !isNaN(amountNum) && amountNum > 0;

    if (!externalAddress) {
        return (
            <View style={S.detailContent}>
                {/* Icon + heading */}
                <View style={S.hero}>
                    <View style={S.heroIcon}>
                        <Ionicons name="wallet-outline" size={40} color={TEXT_PRIMARY} />
                    </View>
                    <Text style={S.heroTitle}>Connect Your Wallet</Text>
                    <Text style={S.heroSub}>Use Phantom, Solflare, or any Solana wallet to send USDC directly to your Hunch account.</Text>
                </View>

                <TouchableOpacity style={S.primaryBtn} onPress={connectWallet} activeOpacity={0.85}>
                    <Ionicons name="wallet-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={S.primaryBtnText}>Connect Wallet</Text>
            </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={S.detailContent}>
            {/* Connected badge */}
            <View style={[S.surface, S.connectedSurface]}>
                <View style={S.connectedDot} />
                <View style={{ flex: 1 }}>
                    <Text style={S.connectedLabel}>Wallet Connected</Text>
                    <Text style={S.monoText}>{shortenAddress(externalAddress)}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        setExternalAddress(null);
                        setExternalOwnerAddress(null);
                        setExternalAddressBase64(null);
                        setWalletAuthToken(null);
                        setWalletUriBase(null);
                        setUsdcBalance(null);
                        setSolAmount("");
                    }}
                    hitSlop={8}
                >
                    <Ionicons name="close-circle-outline" size={22} color={TEXT_MUTED} />
                </TouchableOpacity>
            </View>

            {/* Balance */}
            <View style={S.surface}>
                <Text style={S.surfaceLabel}>Available Balance</Text>
                <View style={S.balanceRow}>
                    {loadingBalance ? <ActivityIndicator size="small" color={TEXT_MUTED} /> : (
                        <>
                            <Text style={S.balanceValue}>{usdcBalance !== null ? `$${usdcBalance.toFixed(2)}` : "—"}</Text>
                            <Text style={S.balanceCurrency}>USDC</Text>
                        </>
                    )}
                    {usdcBalance != null && usdcBalance > 0 && !loadingBalance && (
                        <TouchableOpacity style={S.maxPill} onPress={() => setSolAmount(usdcBalance.toFixed(6))} activeOpacity={0.75}>
                            <Text style={S.maxPillText}>MAX</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Amount */}
            <View style={S.amountSection}>
                <Text style={S.surfaceLabel}>Send Amount</Text>
                <View style={[S.amountRow, exceedsBalance && S.amountRowErr]}>
                    <Text style={S.currencySign}>$</Text>
                    <TextInput
                        style={S.amountInput}
                        placeholder="0.00"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                        value={solAmount}
                        onChangeText={setSolAmount}
                        editable={!sending}
                    />
                    <Text style={S.amountCurrency}>USDC</Text>
                </View>
                {exceedsBalance && <Text style={S.errorText}>Exceeds balance of ${usdcBalance?.toFixed(2)} USDC</Text>}
            </View>

            <View style={S.destRow}>
                <Ionicons name="arrow-forward-circle-outline" size={15} color={TEXT_MUTED} />
                <Text style={S.destText}>To your Hunch account · {shortenAddress(walletAddress)}</Text>
            </View>

            <TouchableOpacity
                style={[S.primaryBtn, (sending || exceedsBalance || !isValid) && S.primaryBtnDisabled]}
                onPress={sendUsdc}
                activeOpacity={0.85}
                disabled={sending || exceedsBalance || !isValid}
            >
                {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={S.primaryBtnText}>{isValid ? `Deposit $${amountNum.toFixed(2)} USDC` : "Deposit USDC"}</Text>
                }
            </TouchableOpacity>

            <Text style={S.networkNote}>Solana Mainnet · USDC only</Text>
        </View>
    );
}

// ─────────────────────────────────────
// Tab 2 — QR Code
// ─────────────────────────────────────
function QRTab({ walletAddress, onCopy, copied, shortenAddress }: {
    walletAddress: string; onCopy: () => void; copied: boolean; shortenAddress: (a: string) => string;
}) {
    return (
        <View style={S.detailContent}>
            <View style={S.qrHeaderRow}>
                <Text style={S.surfaceLabel}>Deposit QR</Text>
                <Text style={S.qrHint}>Scan with any Solana wallet</Text>
            </View>

            {/* QR */}
            <View style={S.qrCenter}>
                <View style={S.qrWrapper}>
                    <QRCodeStyled
                        data={walletAddress}
                        style={S.qrCode}
                        color="#0A0A0A"
                        padding={20}
                        pieceCornerType="rounded"
                        pieceBorderRadius={2.5}
                        isPiecesGlued
                    />
                </View>
            </View>

            {/* Address */}
            <TouchableOpacity style={S.surface} onPress={onCopy} activeOpacity={0.75}>
                <View style={S.qrAddressInner}>
                    <View style={{ flex: 1 }}>
                        <Text style={S.surfaceLabel}>Wallet Address</Text>
                        <Text style={S.monoText}>{shortenAddress(walletAddress)}</Text>
                    </View>
                    <View style={[S.pill, copied && S.pillSuccess]}>
                        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={copied ? "#fff" : TEXT_PRIMARY} />
                        <Text style={[S.pillText, copied && { color: "#fff" }]}>{copied ? "Copied!" : "Copy"}</Text>
                    </View>
                </View>
            </TouchableOpacity>

            <Text style={S.networkNote}>Solana Mainnet · USDC only</Text>
        </View>
    );
}

// ─────────────────────────────────────
// Tab 3 — Privy / Card
// ─────────────────────────────────────
function PrivyFundTab({ onFund }: { onFund: () => void }) {
    return (
        <View style={S.detailContent}>
            <View style={S.hero}>
                <View style={S.heroIcon}>
                    <Ionicons name="card-outline" size={40} color={TEXT_PRIMARY} />
                </View>
                <Text style={S.heroTitle}>Buy with Card or Pay</Text>
                <Text style={S.heroSub}>Purchase USDC with a credit card, debit card, Apple Pay, or bank transfer via our secure payment provider.</Text>
            </View>

            <View style={S.payRow}>
                {([
                    { icon: "card-outline"          as const, label: "Credit / Debit" },
                    { icon: "phone-portrait-outline" as const, label: "Apple Pay"      },
                    { icon: "business-outline"       as const, label: "Bank Transfer"  },
                ] as { icon: keyof typeof Ionicons.glyphMap; label: string }[]).map((m) => (
                    <View key={m.label} style={S.payCard}>
                        <Ionicons name={m.icon} size={26} color={TEXT_PRIMARY} />
                        <Text style={S.payCardLabel}>{m.label}</Text>
                    </View>
                ))}
            </View>

            <TouchableOpacity style={S.primaryBtn} onPress={onFund} activeOpacity={0.85}>
                <Text style={S.primaryBtnText}>Continue to Payment</Text>
            </TouchableOpacity>

            <View style={S.badgeRow}>
                {[
                    { icon: "shield-checkmark-outline" as const, label: "Secure"  },
                    { icon: "flash-outline"             as const, label: "Instant" },
                    { icon: "globe-outline"             as const, label: "Global"  },
                ].map((b) => (
                    <View key={b.label} style={S.badge}>
                        <Ionicons name={b.icon} size={14} color={TEXT_MUTED} />
                        <Text style={S.badgeText}>{b.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ── Styles ──────────────────────────────────────────────────────────
const CARD_W = (SCREEN_W - 40 - 16) / 3;  // 3 equal cards with 8px gaps

const S = StyleSheet.create({
    // ── Modal shell ──
    backdrop: { backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "flex-end" },
    sheet: {
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 24,
    },

    // ── Handle ──
    handleWrap: { alignItems: "center", paddingTop: 12, paddingBottom: 6 },
    handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.18)" },

    // ── Header ──
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerSide: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitle: {
        flex: 1,
        textAlign: "center",
        fontSize: 24,
        fontWeight: "800",
        color: TEXT_PRIMARY,
        letterSpacing: -0.6,
    },

    // ── Step 1: vertical option list ──
    listContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 26,
        gap: 12,
    },
    listSurface: {
        gap: 12,
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 18,
        paddingVertical: 18,
        gap: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
        backgroundColor: SURFACE_BG,
    },
    listItemDivider: {
        marginBottom: 4,
    },
    listLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    listIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: "rgba(0,0,0,0.08)",
        justifyContent: "center",
        alignItems: "center",
    },
    listTextWrap: {
        flex: 1,
    },
    listTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 2,
    },
    listTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: TEXT_PRIMARY,
        letterSpacing: -0.15,
    },
    listSubtitle: {
        fontSize: 13,
        color: TEXT_DIM,
        lineHeight: 18,
    },

    // ── Step 2: scroll container ──
    detailScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
    detailContent: { gap: 16 },

    // ── Hero ──
    hero: { alignItems: "center", gap: 10, paddingVertical: 6 },
    heroIcon: {
        width: 80, height: 80, borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.08)",
        justifyContent: "center", alignItems: "center",
        marginBottom: 4,
    },
    heroTitle: { fontSize: 22, fontWeight: "700", color: TEXT_PRIMARY, letterSpacing: -0.4, textAlign: "center" },
    heroSub:   { fontSize: 15, color: TEXT_DIM, textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },

    // ── Surface card ──
    surface: {
        backgroundColor: SURFACE_BG,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
        gap: 6,
    },
    surfaceLabel: {
        fontSize: 11, fontWeight: "700", color: TEXT_MUTED,
        textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 2,
    },
    monoText: { fontSize: 16, fontWeight: "600", color: TEXT_PRIMARY, fontFamily: "monospace" },

    // ── Connected ──
    connectedSurface: {
        flexDirection: "row", alignItems: "center",
        borderColor: "rgba(0,200,83,0.35)", gap: 10,
    },
    connectedDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: SUCCESS },
    connectedLabel: {
        fontSize: 11, fontWeight: "700", color: SUCCESS,
        textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2,
    },

    // ── Balance ──
    balanceRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    balanceValue: { fontSize: 36, fontWeight: "700", color: TEXT_PRIMARY, letterSpacing: -1 },
    balanceCurrency: { fontSize: 15, fontWeight: "500", color: TEXT_MUTED, alignSelf: "flex-end", marginBottom: 5 },
    maxPill: { marginLeft: "auto" as any, backgroundColor: "#11181C", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    maxPillText: { fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },

    // ── Amount input ──
    amountSection: { gap: 6 },
    amountRow: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: SURFACE_BG, borderRadius: 14,
        paddingVertical: 14, paddingHorizontal: 16, gap: 4,
        borderWidth: 1, borderColor: SURFACE_BORDER,
    },
    amountRowErr: { backgroundColor: "rgba(255,59,48,0.1)", borderColor: "rgba(255,59,48,0.4)" },
    currencySign: { fontSize: 28, fontWeight: "300", color: TEXT_MUTED, marginRight: 2 },
    amountInput:  {
        flex: 1, fontSize: 38, fontWeight: "700", color: TEXT_PRIMARY,
        padding: 0, letterSpacing: -1,
    },
    amountCurrency: { fontSize: 15, fontWeight: "600", color: TEXT_MUTED, alignSelf: "flex-end", marginBottom: 5 },
    errorText: { fontSize: 13, color: DANGER, fontWeight: "600" },

    destRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -6 },
    destText: { fontSize: 13, color: TEXT_MUTED, fontWeight: "500" },

    // ── Primary button ──
    primaryBtn: {
        backgroundColor: "#11181C",
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        paddingVertical: 17, borderRadius: 16,
    },
    primaryBtnText:     { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: -0.2 },
    primaryBtnDisabled: { opacity: 0.35 },

    // ── Or divider ──
    orRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
    orLine: { flex: 1, height: 1, backgroundColor: "rgba(0,0,0,0.13)" },
    orText: { fontSize: 13, color: TEXT_MUTED, fontWeight: "500" },

    // ── Copy pill ──
    pill: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(0,0,0,0.1)",
        paddingHorizontal: 14, paddingVertical: 9,
        borderRadius: 22, alignSelf: "flex-start",
    },
    pillSuccess: { backgroundColor: SUCCESS },
    pillText:    { fontSize: 13, fontWeight: "600", color: TEXT_PRIMARY },

    // ── Network note ──
    networkNote: { fontSize: 12, color: TEXT_MUTED, textAlign: "center", fontWeight: "500" },

    // ── QR ──
    qrCenter: { alignItems: "center", marginTop: 4, marginBottom: 12 },
    qrWrapper: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 8,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.12)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    qrCode:        { width: 280, height: 280 },
    qrAddressInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

    qrHeaderRow: {
        alignItems: "flex-start",
        gap: 4,
    },
    qrHint: {
        fontSize: 13,
        color: TEXT_DIM,
    },

    // ── Pay cards ──
    payRow: { flexDirection: "row", gap: 10 },
    payCard: {
        flex: 1, backgroundColor: SURFACE_BG,
        borderRadius: 14, paddingVertical: 18,
        alignItems: "center", gap: 8,
        borderWidth: 1, borderColor: SURFACE_BORDER,
    },
    payCardLabel: { fontSize: 12, fontWeight: "600", color: TEXT_DIM, textAlign: "center" },

    // ── Badges ──
    badgeRow: { flexDirection: "row", justifyContent: "center", gap: 24 },
    badge:    { flexDirection: "row", alignItems: "center", gap: 5 },
    badgeText: { fontSize: 13, fontWeight: "500", color: TEXT_MUTED },

    // ── "NEW" pill for Debit / Pay row ──
    badgePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: "#11181C",
    },
    badgePillText: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.8,
        color: "#fff",
    },
});
