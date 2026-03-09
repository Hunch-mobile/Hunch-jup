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

// ── USDC helpers (no @solana/spl-token needed) ──
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_DECIMALS = 6;
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bSf");

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
}

function createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    ata: PublicKey,
    owner: PublicKey,
    mint: PublicKey
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
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: bigint
): TransactionInstruction {
    const data = Buffer.alloc(9);
    data.writeUInt8(3, 0); // instruction index 3 = Transfer
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
    Modal,
    PanResponder,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import QRCodeStyled from "react-native-qrcode-styled";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const APP_IDENTITY = {
    name: "Hunch",
    uri: "https://hunch.app",
    icon: "favicon.ico",
};

// ── Theme ──
const SHEET_BG = "#FFFFFF";
const TEXT_PRIMARY = "#11181C";
const TEXT_DIM = "rgba(0,0,0,0.62)";
const TEXT_MUTED = "rgba(0,0,0,0.45)";
const SURFACE_BG = "rgba(0,0,0,0.04)";
const SURFACE_BORDER = "rgba(0,0,0,0.08)";

type FundingTab = "wallet" | "qr" | "privy";

interface AddCashSheetProps {
    visible: boolean;
    onClose: () => void;
    walletAddress: string;
    /** Privy fundWallet callback */
    onPrivyFund: () => void;
}

const { height: SCREEN_H } = Dimensions.get("window");

export default function AddCashSheet({
    visible,
    onClose,
    walletAddress,
    onPrivyFund,
}: AddCashSheetProps) {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<FundingTab>("wallet");
    const [copied, setCopied] = useState(false);

    // ── Animation ──
    const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
            onPanResponderMove: (_, g) => {
                if (g.dy > 0) slideAnim.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 140) {
                    handleClose();
                } else {
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        useNativeDriver: true,
                        damping: 30,
                        stiffness: 500,
                        mass: 0.8,
                    }).start();
                }
            },
        })
    ).current;

    useEffect(() => {
        if (visible) {
            setActiveTab("wallet");
            setCopied(false);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 28,
                stiffness: 400,
                mass: 0.8,
            }).start();
        } else {
            slideAnim.setValue(SCREEN_H);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_H,
            duration: 250,
            useNativeDriver: true,
        }).start(() => onClose());
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
        // Small delay to let the sheet dismiss before Privy UI opens
        setTimeout(() => {
            onPrivyFund();
        }, 350);
    };

    const tabs: { key: FundingTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { key: "wallet", label: "Wallet", icon: "wallet-outline" },
        { key: "qr", label: "QR Code", icon: "qr-code-outline" },
        { key: "privy", label: "Card / Pay", icon: "card-outline" },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            paddingBottom: insets.bottom,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {/* Drag handle */}
                    <View style={styles.handleArea} {...panResponder.panHandlers}>
                        <View style={styles.dragHandle} />
                    </View>

                    {/* Title bar */}
                    <View style={styles.titleBar}>
                        <Text style={styles.title}>Add Cash</Text>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.closeBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>

                    {/* Tab selector */}
                    <View style={styles.tabRow}>
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[styles.tab, isActive && styles.tabActive]}
                                    onPress={() => {
                                        setActiveTab(tab.key);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={tab.icon}
                                        size={20}
                                        color={isActive ? "#FFFFFF" : TEXT_DIM}
                                    />
                                    <Text
                                        style={[
                                            styles.tabLabel,
                                            isActive && styles.tabLabelActive,
                                        ]}
                                    >
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        {activeTab === "wallet" && (
                            <WalletFundTab
                                walletAddress={walletAddress}
                                onCopy={copyAddress}
                                copied={copied}
                                shortenAddress={shortenAddress}
                            />
                        )}
                        {activeTab === "qr" && (
                            <QRTab
                                walletAddress={walletAddress}
                                onCopy={copyAddress}
                                copied={copied}
                                shortenAddress={shortenAddress}
                            />
                        )}
                        {activeTab === "privy" && (
                            <PrivyFundTab onFund={handlePrivyFund} />
                        )}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

// ─────────────────────────────────────────
// Tab 1: Fund from Wallet (MWA / external)
// ─────────────────────────────────────────
function WalletFundTab({
    walletAddress,
    onCopy,
    copied,
    shortenAddress,
}: {
    walletAddress: string;
    onCopy: () => void;
    copied: boolean;
    shortenAddress: (addr: string) => string;
}) {
    const [externalAddress, setExternalAddress] = useState<string | null>(null);
    const [solAmount, setSolAmount] = useState("");
    const [sending, setSending] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);

    const connectExternalWallet = async () => {
        try {
            const result = await transact(async (wallet: Web3MobileWallet) => {
                const authResult = await wallet.authorize({
                    chain: "solana:mainnet",
                    identity: APP_IDENTITY,
                });
                return authResult;
            });
            if (result?.accounts?.[0]) {
                const acct = result.accounts[0] as any;
                const addr = acct.display_address || acct.address;
                setExternalAddress(addr);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (e: any) {
            Alert.alert("Connection Failed", e?.message || "Could not connect to wallet.");
        }
    };

    const sendUsdcFromExternal = async () => {
        const amount = parseFloat(solAmount);
        if (!amount || amount <= 0) {
            Alert.alert("Invalid Amount", "Enter a valid USDC amount.");
            return;
        }
        if (!externalAddress || !walletAddress) return;

        setSending(true);
        setTxSignature(null);
        try {
            const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
            const signature = await transact(async (wallet: Web3MobileWallet) => {
                const authResult = await wallet.authorize({
                    chain: "solana:mainnet",
                    identity: APP_IDENTITY,
                });
                const senderPubkey = new PublicKey(authResult.accounts[0].address);
                const recipientPubkey = new PublicKey(walletAddress);

                const senderAta = getAssociatedTokenAddress(senderPubkey, USDC_MINT);
                const recipientAta = getAssociatedTokenAddress(recipientPubkey, USDC_MINT);

                const { blockhash } = await connection.getLatestBlockhash();
                const tx = new Transaction({ recentBlockhash: blockhash, feePayer: senderPubkey });

                // Create recipient ATA if it doesn't exist yet
                const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
                if (!recipientAtaInfo) {
                    tx.add(createAssociatedTokenAccountInstruction(
                        senderPubkey, recipientAta, recipientPubkey, USDC_MINT
                    ));
                }

                const atomicAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
                tx.add(createSPLTransferInstruction(senderAta, recipientAta, senderPubkey, atomicAmount));

                const sigs = await wallet.signAndSendTransactions({ transactions: [tx] });
                return sigs[0];
            });

            setTxSignature(signature);
            setSolAmount("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Transfer Sent", `$${amount} USDC transfer submitted.\nSignature: ${signature.slice(0, 12)}...`);
        } catch (e: any) {
            Alert.alert("Transfer Failed", e?.message || "Could not send transaction.");
        } finally {
            setSending(false);
        }
    };

    const disconnectWallet = () => {
        setExternalAddress(null);
        setSolAmount("");
        setTxSignature(null);
    };

    // ── Not connected state ──
    if (!externalAddress) {
        return (
            <View style={styles.tabContent}>
                <View style={styles.infoCard}>
                    <View style={styles.infoIconWrap}>
                        <Ionicons name="phone-portrait-outline" size={28} color="#000" />
                    </View>
                    <Text style={styles.infoTitle}>Fund from External Wallet</Text>
                    <Text style={styles.infoDesc}>
                        Connect Phantom, Solflare, or any Solana wallet on your device to send USDC directly to your Hunch account.
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.connectBtn}
                    onPress={connectExternalWallet}
                    activeOpacity={0.85}
                >
                    <Ionicons name="wallet" size={20} color="#FFFFFF" />
                    <Text style={styles.connectBtnText}>Connect External Wallet</Text>
                </TouchableOpacity>

                {/* Alternatively, copy the address manually */}
                <View style={styles.orDivider}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>or send manually</Text>
                    <View style={styles.orLine} />
                </View>

                <View style={styles.addressCard}>
                    <Text style={styles.addressLabel}>Your Deposit Address</Text>
                    <Text style={styles.addressValue} selectable>
                        {shortenAddress(walletAddress)}
                    </Text>
                    <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={onCopy}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={copied ? "checkmark" : "copy-outline"}
                            size={16}
                            color={copied ? "#00e003" : TEXT_PRIMARY}
                        />
                        <Text
                            style={[
                                styles.copyBtnText,
                                copied && { color: "#00e003" },
                            ]}
                        >
                            {copied ? "Copied!" : "Copy Address"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.networkBadge}>Solana Network</Text>
            </View>
        );
    }

    // ── Connected state: show transfer UI ──
    return (
        <View style={styles.tabContent}>
            {/* Connected wallet card */}
            <View style={styles.connectedCard}>
                <View style={styles.connectedHeader}>
                    <View style={styles.connectedDot} />
                    <Text style={styles.connectedLabel}>Connected</Text>
                    <TouchableOpacity onPress={disconnectWallet} hitSlop={8}>
                        <Ionicons name="close-circle-outline" size={18} color={TEXT_MUTED} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.connectedAddress}>{shortenAddress(externalAddress)}</Text>
            </View>

            {/* Amount input */}
            <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>Amount (USDC)</Text>
                <View style={styles.amountInputRow}>
                    <TextInput
                        style={styles.amountInput}
                        placeholder="0.00"
                        placeholderTextColor={TEXT_MUTED}
                        keyboardType="decimal-pad"
                        value={solAmount}
                        onChangeText={setSolAmount}
                        editable={!sending}
                    />
                    <Text style={styles.amountSuffix}>USDC</Text>
                </View>
            </View>

            {/* Destination */}
            <View style={styles.destRow}>
                <Ionicons name="arrow-down" size={16} color={TEXT_MUTED} />
                <Text style={styles.destText}>To: {shortenAddress(walletAddress)}</Text>
            </View>

            {/* Send button */}
            <TouchableOpacity
                style={[styles.connectBtn, sending && { opacity: 0.6 }]}
                onPress={sendUsdcFromExternal}
                activeOpacity={0.85}
                disabled={sending}
            >
                {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.connectBtnText}>
                    {sending ? "Sending..." : "Send USDC"}
                </Text>
            </TouchableOpacity>

            <Text style={styles.networkBadge}>Solana Network</Text>
        </View>
    );
}

// ─────────────────────────────────────────
// Tab 2: QR Code
// ─────────────────────────────────────────
function QRTab({
    walletAddress,
    onCopy,
    copied,
    shortenAddress,
}: {
    walletAddress: string;
    onCopy: () => void;
    copied: boolean;
    shortenAddress: (addr: string) => string;
}) {
    return (
        <View style={styles.tabContent}>
            {/* QR Code */}
            <View style={styles.qrContainer}>
                <View style={styles.qrWrapper}>
                    <QRCodeStyled
                        data={walletAddress}
                        style={styles.qrCode}
                        pieceSize={6}
                        color="#000000"
                        padding={16}
                        pieceCornerType="rounded"
                        pieceBorderRadius={2}
                        isPiecesGlued
                    />
                </View>
            </View>

            {/* Address below QR */}
            <TouchableOpacity
                style={styles.qrAddressRow}
                onPress={onCopy}
                activeOpacity={0.7}
            >
                <Text style={styles.qrAddress}>{shortenAddress(walletAddress)}</Text>
                <Ionicons
                    name={copied ? "checkmark-circle" : "copy-outline"}
                    size={16}
                    color={copied ? "#00e003" : TEXT_DIM}
                />
            </TouchableOpacity>

            <Text style={styles.qrHint}>
                Scan this QR code with any Solana wallet to send funds to your Hunch account.
            </Text>
        </View>
    );
}

// ─────────────────────────────────────────
// Tab 3: Privy Funding UI
// ─────────────────────────────────────────
function PrivyFundTab({ onFund }: { onFund: () => void }) {
    return (
        <View style={styles.tabContent}>
            <View style={styles.infoCard}>
                <View style={styles.infoIconWrap}>
                    <Ionicons name="card-outline" size={28} color="#000" />
                </View>
                <Text style={styles.infoTitle}>Buy with Card or Pay</Text>
                <Text style={styles.infoDesc}>
                    Purchase USDC directly using a credit card, debit card, Apple Pay, or bank transfer through our secure payment provider.
                </Text>
            </View>

            <TouchableOpacity
                style={styles.privyBtn}
                onPress={onFund}
                activeOpacity={0.85}
            >
                <Ionicons name="card" size={20} color="#FFFFFF" />
                <Text style={styles.privyBtnText}>Continue to Payment</Text>
            </TouchableOpacity>

            <View style={styles.privyBadges}>
                <View style={styles.badge}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={TEXT_DIM} />
                    <Text style={styles.badgeText}>Secure</Text>
                </View>
                <View style={styles.badge}>
                    <Ionicons name="flash-outline" size={14} color={TEXT_DIM} />
                    <Text style={styles.badgeText}>Instant</Text>
                </View>
                <View style={styles.badge}>
                    <Ionicons name="globe-outline" size={14} color={TEXT_DIM} />
                    <Text style={styles.badgeText}>Global</Text>
                </View>
            </View>
        </View>
    );
}

// ── Styles ──
const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    container: {
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        marginTop: "auto",
        maxHeight: "70%",
        overflow: "hidden",
    },
    handleArea: {
        alignItems: "center",
        paddingTop: 10,
        paddingBottom: 4,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(0,0,0,0.15)",
    },

    // Title bar
    titleBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: "800",
        color: TEXT_PRIMARY,
        letterSpacing: -0.3,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: SURFACE_BG,
        justifyContent: "center",
        alignItems: "center",
    },

    // Tab selector
    tabRow: {
        flexDirection: "row",
        marginHorizontal: 20,
        marginTop: 4,
        marginBottom: 16,
        backgroundColor: SURFACE_BG,
        borderRadius: 14,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        borderRadius: 11,
        gap: 6,
    },
    tabActive: {
        backgroundColor: "#000000",
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: TEXT_DIM,
    },
    tabLabelActive: {
        color: "#FFFFFF",
    },

    // Content
    content: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    tabContent: {
        alignItems: "center",
    },

    // Info card (shared by wallet & privy tabs)
    infoCard: {
        alignItems: "center",
        backgroundColor: SURFACE_BG,
        borderRadius: 16,
        padding: 20,
        width: "100%",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
    },
    infoIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "rgba(0,0,0,0.06)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: TEXT_PRIMARY,
        marginBottom: 6,
        textAlign: "center",
    },
    infoDesc: {
        fontSize: 13,
        color: TEXT_DIM,
        textAlign: "center",
        lineHeight: 18,
    },

    // Address card
    addressCard: {
        width: "100%",
        backgroundColor: SURFACE_BG,
        borderRadius: 14,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
        marginBottom: 12,
    },
    addressLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: TEXT_MUTED,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    addressValue: {
        fontSize: 15,
        fontWeight: "600",
        color: TEXT_PRIMARY,
        marginBottom: 12,
        fontFamily: "monospace",
    },
    copyBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(0,0,0,0.06)",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    copyBtnText: {
        fontSize: 13,
        fontWeight: "700",
        color: TEXT_PRIMARY,
    },
    networkBadge: {
        fontSize: 12,
        fontWeight: "600",
        color: TEXT_MUTED,
        backgroundColor: SURFACE_BG,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        overflow: "hidden",
    },

    // QR tab
    qrContainer: {
        alignItems: "center",
        marginBottom: 12,
    },
    qrWrapper: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 8,
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
    },
    qrCode: {
        width: 200,
        height: 200,
    },
    qrAddressRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: SURFACE_BG,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    qrAddress: {
        fontSize: 14,
        fontWeight: "600",
        color: TEXT_PRIMARY,
        fontFamily: "monospace",
    },
    qrHint: {
        fontSize: 12,
        color: TEXT_MUTED,
        textAlign: "center",
        lineHeight: 17,
        paddingHorizontal: 8,
    },

    // Privy tab
    privyBtn: {
        width: "100%",
        backgroundColor: "#000000",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 16,
        borderRadius: 14,
        marginBottom: 16,
    },
    privyBtnText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    privyBadges: {
        flexDirection: "row",
        gap: 16,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "600",
        color: TEXT_DIM,
    },

    // Connect wallet button
    connectBtn: {
        width: "100%",
        backgroundColor: "#000000",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 16,
        borderRadius: 14,
        marginBottom: 16,
    },
    connectBtnText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#FFFFFF",
    },

    // Or divider
    orDivider: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        marginBottom: 16,
    },
    orLine: {
        flex: 1,
        height: 1,
        backgroundColor: SURFACE_BORDER,
    },
    orText: {
        fontSize: 12,
        fontWeight: "600",
        color: TEXT_MUTED,
        marginHorizontal: 12,
    },

    // Connected wallet card
    connectedCard: {
        width: "100%",
        backgroundColor: SURFACE_BG,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(0,180,80,0.2)",
        marginBottom: 12,
    },
    connectedHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 6,
    },
    connectedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#00c853",
    },
    connectedLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#00c853",
        flex: 1,
    },
    connectedAddress: {
        fontSize: 14,
        fontWeight: "600",
        color: TEXT_PRIMARY,
        fontFamily: "monospace",
    },

    // Amount input
    amountCard: {
        width: "100%",
        backgroundColor: SURFACE_BG,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: SURFACE_BORDER,
        marginBottom: 12,
    },
    amountLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: TEXT_MUTED,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    amountInputRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    amountInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: "700",
        color: TEXT_PRIMARY,
        padding: 0,
    },
    amountSuffix: {
        fontSize: 16,
        fontWeight: "700",
        color: TEXT_MUTED,
    },

    // Destination row
    destRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 14,
    },
    destText: {
        fontSize: 13,
        fontWeight: "600",
        color: TEXT_MUTED,
    },
});
