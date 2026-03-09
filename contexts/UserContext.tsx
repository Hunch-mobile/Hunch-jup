import { api } from '@/lib/api';
import { AggregatedPosition, User } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export interface UserPreferences {
    interests?: string[];
    habits?: string[]; // Keep for backwards compatibility
    hasCompletedOnboarding?: boolean;
}

interface UserContextType {
    backendUser: User | null;
    setBackendUser: (user: User | null) => void;
    syncUserWithBackend: (privyId: string, walletAddress: string, displayName?: string) => Promise<void>;
    isLoading: boolean;
    preferences: UserPreferences | null;
    loadPreferences: () => Promise<void>;
    isDevMode: boolean;
    setDevMode: (value: boolean) => void;
    usdcBalance: number;
    deductBalance: (amount: number) => void;
    setUsdcBalance: (balance: number) => void;
    positions: { active: AggregatedPosition[]; previous: AggregatedPosition[] };
    isLoadingPositions: boolean;
    addOptimisticPosition: (position: AggregatedPosition) => void;
    refreshPositions: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [backendUser, setBackendUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isDevMode, setIsDevModeState] = useState(false);
    const [usdcBalance, setUsdcBalanceState] = useState<number>(0);
    const [positions, setPositions] = useState<{ active: AggregatedPosition[]; previous: AggregatedPosition[] }>({ active: [], previous: [] });
    const [isLoadingPositions, setIsLoadingPositions] = useState(false);

    const deductBalance = (amount: number) => {
        setUsdcBalanceState(prev => Math.max(0, prev - amount));
    };

    const setUsdcBalance = (balance: number) => {
        setUsdcBalanceState(balance);
    };

    const addOptimisticPosition = useCallback((position: AggregatedPosition) => {
        setPositions(prev => ({
            ...prev,
            active: [
                position,
                ...prev.active.filter(p =>
                    !(p.marketTicker === position.marketTicker && p.side === position.side)
                ),
            ],
        }));
    }, []);

    const refreshPositions = useCallback(async () => {
        if (!backendUser) return;
        // Only show the loading skeleton on the very first fetch (no positions yet).
        // Subsequent refreshes are silent so optimistic positions stay visible.
        setPositions(prev => {
            const isEmpty = prev.active.length === 0 && prev.previous.length === 0;
            if (isEmpty) setIsLoadingPositions(true);
            return prev;
        });
        try {
            const data = await api.getPositions(backendUser.id);
            const all = [...data.positions.active, ...data.positions.previous];
            const serverActive = all.filter(p => p.positionStatus === 'OPEN' || p.positionStatus === 'PARTIALLY_CLOSED');
            const previous = all.filter(p => p.positionStatus !== 'OPEN' && p.positionStatus !== 'PARTIALLY_CLOSED');
            // Preserve optimistic positions the server doesn't know about yet
            setPositions(prev => {
                const serverTickers = new Set(serverActive.map(p => `${p.marketTicker}:${p.side}`));
                const optimisticKeep = prev.active.filter(p =>
                    !serverTickers.has(`${p.marketTicker}:${p.side}`) &&
                    !previous.some(pp => pp.marketTicker === p.marketTicker && pp.side === p.side)
                );
                return { active: [...serverActive, ...optimisticKeep], previous };
            });
        } catch (error) {
            console.error('Failed to refresh positions:', error);
        } finally {
            setIsLoadingPositions(false);
        }
    }, [backendUser]);

    // Load user from AsyncStorage on mount
    useEffect(() => {
        loadUser();
        AsyncStorage.getItem('devMode').then((v) => setIsDevModeState(v === 'true'));
    }, []);

    const setDevMode = async (value: boolean) => {
        setIsDevModeState(value);
        if (value) {
            await AsyncStorage.setItem('devMode', 'true');
        } else {
            await AsyncStorage.removeItem('devMode');
        }
    };

    // Load preferences when user changes
    useEffect(() => {
        if (backendUser) {
            loadPreferences();
        } else {
            setPreferences(null);
        }
    }, [backendUser]);

    const loadUser = async () => {
        try {
            const userJson = await AsyncStorage.getItem('backendUser');
            if (userJson) {
                setBackendUser(JSON.parse(userJson));
            }
        } catch (error) {
            console.error('Failed to load user from storage:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const syncUserWithBackend = async (privyId: string, walletAddress: string, displayName?: string) => {
        try {
            setIsLoading(true);
            const user = await api.syncUser({
                privyId,
                walletAddress,
                displayName,
            });
            setBackendUser(user);
            await AsyncStorage.setItem('backendUser', JSON.stringify(user));
        } catch (error) {
            console.error('Failed to sync user with backend:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const loadPreferences = async () => {
        if (!backendUser) return;
        try {
            const prefs = await api.getUserPreferences(backendUser.id);
            setPreferences(prefs);
            if (prefs) {
                await AsyncStorage.setItem('userPreferences', JSON.stringify(prefs));
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
            // Try to load from AsyncStorage as fallback
            try {
                const prefsJson = await AsyncStorage.getItem('userPreferences');
                if (prefsJson) {
                    setPreferences(JSON.parse(prefsJson));
                }
            } catch (err) {
                console.error('Failed to load preferences from storage:', err);
            }
        }
    };

    const handleSetBackendUser = async (user: User | null) => {
        setBackendUser(user);
        if (user) {
            await AsyncStorage.setItem('backendUser', JSON.stringify(user));
        } else {
            await AsyncStorage.removeItem('backendUser');
            await AsyncStorage.removeItem('userPreferences');
            setPreferences(null);
        }
    };

    return (
        <UserContext.Provider
            value={{
                backendUser,
                setBackendUser: handleSetBackendUser,
                syncUserWithBackend,
                isLoading,
                preferences,
                loadPreferences,
                isDevMode,
                setDevMode,
                usdcBalance,
                deductBalance,
                setUsdcBalance,
                positions,
                isLoadingPositions,
                addOptimisticPosition,
                refreshPositions,
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
