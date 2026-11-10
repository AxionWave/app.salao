import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import {
    createRoutesFromChildren,
    matchRoutes,
    useLocation,
    useNavigationType,
} from 'react-router-dom';

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: import.meta.env.PROD ? 'production' : 'development',
        release: import.meta.env.VITE_SENTRY_RELEASE,
        // Dados de clientes (nome, telefone) não devem sair para o Sentry.
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
        },
        integrations: [
            Sentry.reactRouterV6BrowserTracingIntegration({
                useEffect,
                useLocation,
                useNavigationType,
                createRoutesFromChildren,
                matchRoutes,
            }),
            Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        ],
        tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
        // Só a API local aceita os cabeçalhos de trace; o Gateway de homolog/produção não foi liberado.
        tracePropagationTargets: [/^http:\/\/localhost:8092/],
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
    });
}
