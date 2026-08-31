import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import { authService } from '@core/services';
import { httpClient } from '@core/services/http.service';
import { API_CONFIG } from '@core/config';
import { MODULOS } from '@/constants/moduleCodes';

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
        httpClient
            .get<MeResponse>(`${API_CONFIG.productBase}/me`)
            .then((r) => setMe(r.data))
            .catch(() => setError('Não foi possível falar com a API via Gateway. Suba api.salao e confira a rota.'));
    }, []);

    return (
        <AppShell>
            <h1 className="text-2xl font-semibold text-slate-900">Painel Lyra</h1>
            <p className="mt-1 text-sm text-slate-500">Olá, {user?.email || user?.username || 'usuário'}.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MODULOS.filter((m) => m.path !== '/inicio').map((m) => (
                    <Link
                        key={m.codigo}
                        to={m.path}
                        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-accent"
                    >
                        <p className="text-sm font-semibold text-slate-900">{m.nome}</p>
                        <p className="mt-1 text-sm text-slate-500">{m.descricao}</p>
                        <p className="mt-3 font-mono text-[11px] text-slate-400">{m.codigo}</p>
                    </Link>
                ))}
            </div>

            <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">Integração API (GET {API_CONFIG.productBase}/me)</h2>
                {error && <p className="mt-2 text-sm text-amber-800">{error}</p>}
                {me && (
                    <pre className="mt-3 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                        {JSON.stringify(me, null, 2)}
                    </pre>
                )}
            </section>
        </AppShell>
    );
}
