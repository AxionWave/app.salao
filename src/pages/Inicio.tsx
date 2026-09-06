import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import { authService } from '@core/services';
import { lyraClient } from '@core/services/http.service';
import { API_CONFIG } from '@core/config';
import { MODULOS } from '@/constants/moduleCodes';
import { Alert } from '@/components/ui';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';

interface MeResponse {
    product: string;
    sigla: string;
    userId: number;
    username: string;
    email: string;
    empresaId: number;
    roles: string[];
    modulos: string[];
}

export default function InicioPage() {
    const user = authService.getStoredUserInfo();
    const [me, setMe] = useState<MeResponse | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        lyraClient
            .get<MeResponse>(`${API_CONFIG.productBase}/me`)
            .then((r) => setMe(r.data))
            .catch((e) => setError(mensagemErroHttp(e, 'Não foi possível falar com a API Lyra. Suba a api.salao.')));
    }, []);

    return (
        <PageLayout titulo="Início" subtitulo="Painel">
            <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Olá, {user?.email || user?.username || 'usuário'}.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MODULOS.filter((m) => m.path !== '/inicio').map((m) => (
                    <Link key={m.codigo} to={m.path} className="lyra-card p-5">
                        <p className="text-sm font-semibold">{m.nome}</p>
                        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {m.descricao}
                        </p>
                    </Link>
                ))}
            </div>
            <PageCard fill={false} className="mt-8">
                <div className="p-5">
                    <h2 className="text-sm font-semibold">Integração API (GET {API_CONFIG.productBase}/me)</h2>
                    {error && (
                        <div className="mt-3">
                            <Alert titulo={tituloDeMensagem(error)}>{error}</Alert>
                        </div>
                    )}
                    {me && (
                        <pre
                            className="mt-3 overflow-auto rounded-lyra p-3 font-mono text-xs"
                            style={{ background: 'var(--background)', color: 'var(--muted-foreground)' }}
                        >
                            {JSON.stringify(me, null, 2)}
                        </pre>
                    )}
                </div>
            </PageCard>
        </PageLayout>
    );
}
