import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { VerifyPage } from './pages/VerifyPage';
import { RequestPage } from './pages/RequestPage';
import { CredentialsPage } from './pages/CredentialsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/requests/:id" element={<RequestPage />} />
            <Route path="/credentials/:address" element={<CredentialsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </WalletProvider>
  );
};
