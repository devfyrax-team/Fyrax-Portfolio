import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth';
import { App } from './App';
import './styles.css';
import { applyStoredTheme } from './components/theme';
import { installDemoApi } from './demo/mock';
import { DemoBanner } from './demo/DemoBanner';

installDemoApi();
try {
  localStorage.setItem('hrms.session', 'tenant'); // the demo opens already signed in
} catch {
  /* ignore */
}

applyStoredTheme();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <App />
          <DemoBanner />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
