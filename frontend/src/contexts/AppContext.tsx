import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppContextType {
    pageTitle: string;
    setPageTitle: (title: string) => void;
    refreshCallback?: () => void;
    setRefreshCallback: (callback?: () => void) => void;
    isRefreshing: boolean;
    setIsRefreshing: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [pageTitle, setPageTitle] = useState('Office 365 管理系统');
    const [refreshCallback, setRefreshCallback] = useState<(() => void) | undefined>(undefined);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const value = {
        pageTitle,
        setPageTitle,
        refreshCallback,
        setRefreshCallback: (callback?: () => void) => {
            setRefreshCallback(() => callback);
        },
        isRefreshing,
        setIsRefreshing,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
};
