import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { AppProvider } from '../contexts/AppContext';

const Layout: React.FC = () => {
    return (
        <AppProvider>
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Header />
                    <Outlet />
                </main>
            </div>
        </AppProvider>
    );
};

export default Layout;
