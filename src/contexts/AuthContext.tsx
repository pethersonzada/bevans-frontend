import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { errorMessage, onSessionExpired } from '../config/api';
import { auth } from '../config/firebase';
import { EMPTY_USER, SESSION_KEYS, fetchSessionUser, type SessionUser } from '../services/session';

type AuthContextData = {
    user: SessionUser;
    isLoading: boolean;
    sessionError: string | null;
    retrySession: () => void;
    signIn: (userData: SessionUser) => Promise<void>;
    signOut: () => Promise<void>;
    updateAddress: (address: string) => Promise<void>;
};
const AuthContext = createContext<AuthContextData | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser>(EMPTY_USER);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);
    const revision = useRef(0);
    const storageQueue = useRef(Promise.resolve());
    const persist = useCallback((operation: () => Promise<void>) => {
        const next = storageQueue.current.catch(() => {}).then(operation);
        storageQueue.current = next;
        return next;
    }, []);

    const signOut = useCallback(async () => {
        revision.current++;
        setUser(EMPTY_USER);
        setSessionError(null);
        setIsLoading(false);
        const results = await Promise.allSettled([
            firebaseSignOut(auth),
            persist(() => AsyncStorage.multiRemove(SESSION_KEYS)),
        ]);
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
    }, [persist]);

    useEffect(() => {
        let initializing = true;
        const unsubscribeExpired = onSessionExpired(() => {
            void signOut().catch(error => console.error('Erro ao encerrar sessao', error));
        });
        const unsubscribeAuth = onAuthStateChanged(auth, async firebaseUser => {
            const currentRevision = ++revision.current;
            const active = () => revision.current === currentRevision && auth.currentUser === firebaseUser;
            setUser(EMPTY_USER);
            if (initializing) setIsLoading(true);
            initializing = false;
            setSessionError(null);
            try {
                if (!firebaseUser) {
                    await persist(() => AsyncStorage.multiRemove(SESSION_KEYS));
                    return;
                }
                const entries = Object.fromEntries(await AsyncStorage.multiGet(['userId', 'firebaseUid']));
                if (!active()) return;
                // Restore identity from the server, never from a cached numeric ID.
                // A new registration/login establishes its profile explicitly.
                if (!entries.userId || (entries.firebaseUid && entries.firebaseUid !== firebaseUser.uid)) return;
                const restored = await fetchSessionUser(firebaseUser.uid);
                if (active()) setUser(restored);
            } catch (error) {
                if (active()) setSessionError(errorMessage(error, 'Não foi possível restaurar sua sessão.'));
            } finally {
                if (active()) setIsLoading(false);
            }
        });
        return () => {
            revision.current++;
            unsubscribeAuth();
            unsubscribeExpired();
        };
    }, [persist, retry, signOut]);

    const signIn = useCallback(async (userData: SessionUser) => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser || !userData.id || !/^[1-9]\d*$/.test(userData.id)) {
            throw new Error('Sessão inválida. Entre novamente.');
        }
        const currentRevision = ++revision.current;
        await persist(() => AsyncStorage.multiSet([
            ['userId', userData.id!], ['userName', userData.nome], ['userTipo', userData.tipo],
            ['userEndereco', userData.endereco], ['firebaseUid', firebaseUser.uid],
        ]));
        if (revision.current !== currentRevision || auth.currentUser !== firebaseUser) return;
        setUser(userData);
        setSessionError(null);
        setIsLoading(false);
    }, [persist]);

    const updateAddress = useCallback(async (address: string) => {
        if (!user.id || !auth.currentUser) throw new Error('Sessão inválida. Entre novamente.');
        const currentRevision = revision.current;
        await persist(() => AsyncStorage.setItem('userEndereco', address));
        if (revision.current === currentRevision) setUser(previous => ({ ...previous, endereco: address }));
    }, [persist, user.id]);

    return (
        <AuthContext.Provider value={{ user, isLoading, sessionError, retrySession: () => setRetry(value => value + 1), signIn, signOut, updateAddress }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth requires AuthProvider.');
    return context;
}

