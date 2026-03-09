import { api } from '@/lib/api';
import { isDemoTrading } from '@/lib/tradeService';
import { AuthError, CopyLeaderEntry, CopySettings, DelegationStatus, ExternalCopySetting } from '@/lib/types';
import { useEmbeddedSolanaWallet, usePrivy, useSessionSigners } from '@privy-io/expo';
import { useCallback, useState } from 'react';

// Key Quorum ID from environment — registered in Privy Dashboard (step 2 of docs)
const KEY_QUORUM_ID = process.env.EXPO_PUBLIC_KEY_QUORUM_ID || '';

export interface CopyTradingSettings {
    amountPerTrade: number;
    maxTotalAmount: number;
}

/** Step the UI can display during the enable flow */
export type CopyTradingStep = 'idle' | 'signer' | 'signing' | 'saving' | 'done' | 'error';

export interface UseCopyTradingReturn {
    // State
    isLoading: boolean;
    isSigningDelegation: boolean;
    error: string | null;
    delegationStatus: DelegationStatus | null;
    copySettings: CopySettings[];
    externalCopySettings: ExternalCopySetting[];
    allLeaders: CopyLeaderEntry[];
    /** Current step in the enable flow — useful for UI progress indicators */
    currentStep: CopyTradingStep;

    // Actions
    checkDelegationStatus: () => Promise<DelegationStatus>;
    hasExistingSigner: (walletAddress: string) => boolean;
    enableCopyTrading: (leaderId: string, leaderName: string, settings: CopyTradingSettings) => Promise<void>;
    enableExternalCopyTrading: (externalLeaderId: string, settings: CopyTradingSettings) => Promise<void>;
    disableCopyTrading: (leaderId: string) => Promise<void>;
    disableExternalCopyTrading: (externalLeaderId: string) => Promise<void>;
    getCopySettingsForLeader: (leaderId: string) => Promise<CopySettings | null>;
    getExternalCopySettingsForLeader: (externalLeaderId: string) => Promise<ExternalCopySetting | null>;
    fetchAllCopySettings: () => Promise<CopySettings[]>;
    fetchAllExternalCopySettings: () => Promise<ExternalCopySetting[]>;
    fetchAllLeaders: () => Promise<CopyLeaderEntry[]>;
    updateCopySettings: (leaderId: string, settings: CopyTradingSettings) => Promise<void>;
    clearError: () => void;
}

/**
 * Generate a human-readable delegation message for the user to sign.
 * The backend can verify this signature to confirm user consent.
 */
const generateDelegationMessage = (
    leaderName: string,
    leaderId: string,
    amountPerTrade: number,
    maxTotalAmount: number
): string => {
    const timestamp = new Date().toISOString();
    return [
        'HUNCH COPY TRADING DELEGATION',
        `I authorize Hunch to execute trades on my behalf by copying ${leaderName}.`,
        'Terms:',
        `- Amount per trade: $${amountPerTrade}`,
        `- Maximum total allocation: $${maxTotalAmount}`,
        `- Leader ID: ${leaderId}`,
        'This authorization can be revoked at any time by disabling copy trading.',
        `Timestamp: ${timestamp}`,
    ].join('\n');
};

/**
 * Hook for managing copy trading with Privy signers.
 *
 * Flow (per Privy docs §5 — React Native):
 *   1. Add the app's key-quorum as a **signer** on the user's embedded wallet
 *      via `useSigners().addSigners()` (one-time, skipped if already delegated).
 *   2. Have the user sign a human-readable delegation message so the backend
 *      can verify consent.
 *   3. POST copy-settings (per-leader config) to the backend.
 *
 * The hook exposes `currentStep` so the UI can show inline progress.
 */
export function useCopyTrading(): UseCopyTradingReturn {
    const { user } = usePrivy();
    const { wallets } = useEmbeddedSolanaWallet();

    const [isLoading, setIsLoading] = useState(false);
    const [isSigningDelegation, setIsSigningDelegation] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [delegationStatus, setDelegationStatus] = useState<DelegationStatus | null>(null);
    const [copySettings, setCopySettings] = useState<CopySettings[]>([]);
    const [externalCopySettings, setExternalCopySettings] = useState<ExternalCopySetting[]>([]);
    const [allLeaders, setAllLeaders] = useState<CopyLeaderEntry[]>([]);
    const [currentStep, setCurrentStep] = useState<CopyTradingStep>('idle');

    const wallet = wallets?.[0];

    const { addSessionSigners } = useSessionSigners();
    const addSignersFn = addSessionSigners ?? null;

    // ---------- helpers ----------

    /**
     * Check if wallet already has a signer (delegated = true in linked_accounts).
     * This prevents the "Duplicate Signer" error from Privy.
     */
    const hasExistingSigner = useCallback((walletAddress: string): boolean => {
        if (!user?.linked_accounts) return false;

        return user.linked_accounts.some(
            (account: any) =>
                account.type === 'wallet' &&
                'address' in account &&
                account.address?.toLowerCase() === walletAddress.toLowerCase() &&
                (account as any).delegated === true
        );
    }, [user]);

    /**
     * Fetch delegation status from backend
     */
    const checkDelegationStatus = useCallback(async (): Promise<DelegationStatus> => {
        try {
            const status = await api.getDelegationStatus();
            setDelegationStatus(status);
            return status;
        } catch (err: any) {
            console.error('[CopyTrading] Failed to check delegation status:', err);
            throw err;
        }
    }, []);

    /**
     * Sign a delegation message with the user's embedded wallet.
     * Returns a base64-encoded signature string.
     */
    const signDelegationMessage = async (message: string): Promise<string> => {
        if (!wallet) throw new Error('No wallet available for signing');

        const provider = await wallet.getProvider();
        const result = await provider.request({
            method: 'signMessage',
            params: { message },
        });

        return result.signature;
    };

    /**
     * Step 1: Add app key-quorum as a signer on the user's wallet.
     * Per Privy docs §5 (React Native): useSigners().addSigners()
     * Skips silently if signer already exists.
     */
    const ensureSigner = async (): Promise<void> => {
        if (!wallet) throw new Error('No wallet available');
        if (!KEY_QUORUM_ID) {
            console.warn('[CopyTrading] KEY_QUORUM_ID not set — skipping signer setup');
            return;
        }

        const walletAddress = wallet.address;

        // Fast path: already delegated
        if (hasExistingSigner(walletAddress)) {
            console.log('[CopyTrading] Signer already exists, skipping');
            return;
        }

        if (!addSignersFn) {
            console.warn('[CopyTrading] addSessionSigners not available from Privy SDK — skipping signer setup');
            return;
        }

        try {
            await addSignersFn({
                address: walletAddress,
                signers: [{
                    signerId: KEY_QUORUM_ID,
                    policyIds: []
                }]
            });
            console.log('[CopyTrading] Signer added successfully');
        } catch (err: any) {
            // Duplicate signer is fine — swallow gracefully
            if (err.message?.toLowerCase().includes('duplicate') ||
                err.message?.toLowerCase().includes('already exists')) {
                console.log('[CopyTrading] Signer already exists (caught duplicate)');
                return;
            }
            throw err;
        }
    };

    // ---------- public actions ----------

    /**
     * Enable copy trading for a leader.
     * Runs the full 3-step flow:
     *   signer → delegation signature → save settings
     *
     * Each step updates `currentStep` so the UI can show progress.
     */
    const enableCopyTrading = useCallback(async (
        leaderId: string,
        leaderName: string,
        settings: CopyTradingSettings
    ): Promise<void> => {
        if (!wallet) throw new Error('No wallet available');

        setIsLoading(true);
        setIsSigningDelegation(false);
        setError(null);
        setCurrentStep('signer');

        try {
            // ── Step 1: Ensure signer on wallet ──
            await ensureSigner();

            // ── Step 2: Sign delegation message ──
            setCurrentStep('signing');
            setIsSigningDelegation(true);

            const message = generateDelegationMessage(
                leaderName, leaderId,
                settings.amountPerTrade, settings.maxTotalAmount
            );
            const delegationSignature = await signDelegationMessage(message);
            setIsSigningDelegation(false);

            // ── Step 3: Save copy settings to backend ──
            setCurrentStep('saving');
            await api.createCopySettings({
                leaderId,
                amountPerTrade: settings.amountPerTrade,
                maxTotalAmount: settings.maxTotalAmount,
                delegationSignature,
                signedMessage: message,
            });

            // Refresh local state
            await fetchAllCopySettings();

            setCurrentStep('done');
            console.log('[CopyTrading] Copy trading enabled for', leaderName);
        } catch (err: any) {
            console.error('[CopyTrading] Failed to enable copy trading:', err);
            setIsSigningDelegation(false);
            setCurrentStep('error');

            // Demo mode: bypass errors with local-only state
            if (isDemoTrading) {
                console.log('[CopyTrading] Demo mode — creating local copy settings');
                setCopySettings(prev => {
                    if (prev.some(s => s.leaderId === leaderId)) return prev;
                    return [...prev, {
                        id: `demo_${leaderId}`,
                        followerId: '',
                        leaderId,
                        amountPerTrade: settings.amountPerTrade,
                        maxTotalAmount: settings.maxTotalAmount,
                        spentAmount: 0,
                        isActive: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    } as CopySettings];
                });
                setCurrentStep('done');
                return;
            }

            // Map backend error codes to user-facing messages
            if ((err as AuthError)?.code === 'DELEGATION_REQUIRED') {
                setError('Delegation signature required. Please try again.');
            } else if ((err as AuthError)?.code === 'MISSING_TOKEN') {
                setError('Authentication required. Please log in again.');
            } else if ((err as AuthError)?.code === 'INVALID_TOKEN') {
                setError('Session expired. Please log in again.');
            } else {
                setError(err.message || 'Failed to enable copy trading');
            }

            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [wallet, hasExistingSigner]);

    /**
     * Update existing copy settings for a leader without re-running signer setup.
     */
    const updateCopySettings = useCallback(async (
        leaderId: string,
        settings: CopyTradingSettings
    ): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            // Re-create with new values (backend upserts by leader)
            const message = `Hunch copy trading update for ${leaderId}`;
            const signature = Buffer.from(`update_${Date.now()}_${leaderId}`).toString('base64');

            await api.createCopySettings({
                leaderId,
                amountPerTrade: settings.amountPerTrade,
                maxTotalAmount: settings.maxTotalAmount,
                delegationSignature: signature,
                signedMessage: message,
            });

            await fetchAllCopySettings();
            console.log('[CopyTrading] Settings updated for leader:', leaderId);
        } catch (err: any) {
            console.error('[CopyTrading] Failed to update copy settings:', err);
            setError(err.message || 'Failed to update copy settings');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Disable copy trading for a leader
     */
    const disableCopyTrading = useCallback(async (leaderId: string): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            await api.deleteCopySettings(leaderId);
            setCopySettings(prev => prev.filter(s => s.leaderId !== leaderId));
            console.log('[CopyTrading] Disabled for leader:', leaderId);
        } catch (err: any) {
            console.error('[CopyTrading] Failed to disable copy trading:', err);
            setError(err.message || 'Failed to disable copy trading');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Get copy settings for a specific leader
     */
    const getCopySettingsForLeader = useCallback(async (leaderId: string): Promise<CopySettings | null> => {
        try {
            const settings = await api.getCopySettings(leaderId);
            return settings.length > 0 ? settings[0] : null;
        } catch (err: any) {
            console.error('[CopyTrading] Failed to get copy settings:', err);
            return null;
        }
    }, []);

    /**
     * Fetch all copy settings for the current user
     */
    const fetchAllCopySettings = useCallback(async (): Promise<CopySettings[]> => {
        try {
            const settings = await api.getCopySettings();
            setCopySettings(settings);
            return settings;
        } catch (err: any) {
            console.error('[CopyTrading] Failed to fetch copy settings:', err);
            return [];
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        setCurrentStep('idle');
    }, []);

    const fetchAllLeaders = useCallback(async (): Promise<CopyLeaderEntry[]> => {
        try {
            const data = await api.getAllCopyLeaders();
            setAllLeaders(data.leaders);
            return data.leaders;
        } catch (err: any) {
            console.error('[CopyTrading] Failed to fetch all leaders:', err);
            return [];
        }
    }, []);

    const fetchAllExternalCopySettings = useCallback(async (): Promise<ExternalCopySetting[]> => {
        try {
            const settings = await api.getExternalCopySettings();
            setExternalCopySettings(settings);
            return settings;
        } catch (err: any) {
            console.error('[CopyTrading] Failed to fetch external copy settings:', err);
            return [];
        }
    }, []);

    const getExternalCopySettingsForLeader = useCallback(async (externalLeaderId: string): Promise<ExternalCopySetting | null> => {
        try {
            const settings = await api.getExternalCopySettings();
            return settings.find(s => s.externalLeaderId === externalLeaderId) ?? null;
        } catch (err: any) {
            console.error('[CopyTrading] Failed to get external copy settings:', err);
            return null;
        }
    }, []);

    const enableExternalCopyTrading = useCallback(async (
        externalLeaderId: string,
        settings: CopyTradingSettings
    ): Promise<void> => {
        setIsLoading(true);
        setError(null);
        setCurrentStep('saving');
        try {
            await api.createExternalCopySettings({
                externalLeaderId,
                amountPerTrade: settings.amountPerTrade,
                maxTotalAmount: settings.maxTotalAmount,
            });
            await fetchAllExternalCopySettings();
            setCurrentStep('done');
        } catch (err: any) {
            console.error('[CopyTrading] Failed to enable external copy trading:', err);
            setCurrentStep('error');
            setError(err.message || 'Failed to enable copy trading');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [fetchAllExternalCopySettings]);

    const disableExternalCopyTrading = useCallback(async (externalLeaderId: string): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            await api.deleteExternalCopySettings(externalLeaderId);
            setExternalCopySettings(prev => prev.filter(s => s.externalLeaderId !== externalLeaderId));
        } catch (err: any) {
            console.error('[CopyTrading] Failed to disable external copy trading:', err);
            setError(err.message || 'Failed to disable copy trading');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        isLoading,
        isSigningDelegation,
        error,
        delegationStatus,
        copySettings,
        externalCopySettings,
        allLeaders,
        currentStep,

        checkDelegationStatus,
        hasExistingSigner,
        enableCopyTrading,
        enableExternalCopyTrading,
        disableCopyTrading,
        disableExternalCopyTrading,
        getCopySettingsForLeader,
        getExternalCopySettingsForLeader,
        fetchAllCopySettings,
        fetchAllExternalCopySettings,
        fetchAllLeaders,
        updateCopySettings,
        clearError,
    };
}
