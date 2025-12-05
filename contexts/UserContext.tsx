import { api } from '@/lib/api';
import { User } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface UserContextType {
    backendUser: User | null;
    setBackendUser: (user: User | null) => void;
    syncUserWithBackend: (privyId: string, walletAddress: string, displayName?: string) => Promise<void>;
    isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [backendUser, setBackendUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user from AsyncStorage on mount
    useEffect(() => {
        loadUser();
    }, []);

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

    const handleSetBackendUser = async (user: User | null) => {
        setBackendUser(user);
        if (user) {
            await AsyncStorage.setItem('backendUser', JSON.stringify(user));
        } else {
            await AsyncStorage.removeItem('backendUser');
        }
    };

    return (
        <UserContext.Provider
            value={{
                backendUser,
                setBackendUser: handleSetBackendUser,
                syncUserWithBackend,
                isLoading,
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
