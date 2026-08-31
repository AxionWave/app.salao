import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authService } from '@core/services';
import { APP_CONFIG } from '@core/config';
import { MODULO_RAIZ } from '@/constants/moduleCodes';

export default function LoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (authService.isAuthenticated() && authService.hasModulo(MODULO_RAIZ)) {
            navigate('/inicio', { replace: true });
        }
    }, [navigate]);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authService.login({ username: username.trim(), password });
            if (res.must_change_password) {
                setError('Sua senha precisa ser definida. Use o primeiro acesso no ASC e volte aqui.');
                authService.logout();
                return;
            }
            if (!authService.hasModulo(MODULO_RAIZ)) {
                setError(`Login ok, mas o JWT não tem ${MODULO_RAIZ}. Rode o seed e faça login novamente.`);
                return;
            }
            navigate('/inicio', { replace: true });
        } catch (err) {
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.code === 'ERR_NETWORK')) {
                setError(err.code === 'ERR_NETWORK'
                    ? 'Não foi possível contatar o Gateway. Confira VITE_GATEWAY_URL.'
                    : 'E-mail ou senha incorretos.');
            } else {
                setError('Erro ao entrar. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{APP_CONFIG.empresa}</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">{APP_CONFIG.nome}</h1>
                <p className="mt-1 text-sm text-slate-500">{APP_CONFIG.descricao}</p>
                <form className="mt-8 space-y-4" onSubmit={onSubmit}>
                    <label className="block text-sm font-medium text-slate-700">
                        E-mail
                        <input
                            className="mt-1 w-full rounded-lg border-slate-200 text-sm"
                            name="username"
                            autoComplete="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                        Senha
                        <input
                            className="mt-1 w-full rounded-lg border-slate-200 text-sm"
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>
                    {error && <p className="text-sm text-red-700">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                    >
                        {loading ? 'Entrando…' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
