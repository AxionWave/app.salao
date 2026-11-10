import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui';

export default function ErroRota() {
    const erro = useRouteError();

    useEffect(() => {
        Sentry.captureException(erro);
    }, [erro]);

    return (
        <div
            className="flex min-h-[100dvh] items-center justify-center px-6"
            style={{ background: 'var(--lyra-bg)', color: 'var(--lyra-text)' }}
        >
            <div className="max-w-md space-y-4 text-center">
                <h1 className="text-xl font-semibold">Algo deu errado nesta tela</h1>
                <p className="text-sm opacity-80">
                    O erro foi registrado para a equipe. Recarregue a página para tentar de novo.
                </p>
                <Button variant="primary" onClick={() => window.location.reload()}>
                    Recarregar
                </Button>
            </div>
        </div>
    );
}
