import React from 'react';
import { useApp } from '../contexts/AppContext';

const Header: React.FC = () => {
    const { pageTitle, refreshCallback, isRefreshing } = useApp();

    return (
        <header className="header">
            <h1 className="header-title">{pageTitle}</h1>
            <div className="header-actions">
                {refreshCallback && (
                    <button
                        className="btn btn-secondary"
                        onClick={refreshCallback}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? (
                            <span className="spinner" style={{ width: 16, height: 16 }} />
                        ) : (
                            '🔄'
                        )}
                        刷新
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
