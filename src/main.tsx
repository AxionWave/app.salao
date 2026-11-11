import './instrument';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { APP_CONFIG } from '@core/config';
import { consumeEnterpriseSsoFromHash } from '@core/auth/sso';
import { registrarServiceWorker } from '@/lib/push';
import './tailwind.css';

document.title = APP_CONFIG.nome;
consumeEnterpriseSsoFromHash();
registrarServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
