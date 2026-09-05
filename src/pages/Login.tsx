import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authService } from '@core/services';
import { APP_CONFIG } from '@core/config';
import { MODULOS_RAIZ, temModuloRaiz } from '@/constants/moduleCodes';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui';

export default function LoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (authService.isAuthenticated() && authService.needsPasswordChange()) {
            navigate('/primeiro-acesso', { replace: true });
            return;
        }
        if (authService.isAuthenticated() && temModuloRaiz((c) => authService.hasModulo(c))) {
            navigate('/inicio', { replace: true });
            return;
        }
        if (authService.isAuthenticated()) {
            setError(
                `Sessão Enterprise recebida, mas o JWT não tem ${MODULOS_RAIZ.join(' ou ')}. Use o login abaixo ou peça acesso no ASC.`
            );
        }
    }, [navigate]);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authService.login({ username: username.trim(), password });
            if (res.must_change_password) {
                navigate('/primeiro-acesso', { replace: true });
                return;
            }
            if (!temModuloRaiz((c) => authService.hasModulo(c))) {
                setError(
                    `Login ok, mas o JWT não tem ${MODULOS_RAIZ.join(' ou ')}. Rode o seed e faça login novamente.`
                );
                return;
            }
            navigate('/inicio', { replace: true });
        } catch (err) {
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.code === 'ERR_NETWORK')) {
                setError(
                    err.code === 'ERR_NETWORK'
                        ? 'Não foi possível contatar o Gateway. Confira VITE_GATEWAY_URL.'
                        : 'E-mail ou senha incorretos.'
                );
            } else {
                setError('Erro ao entrar. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[100dvh]" style={{ background: 'var(--lyra-bg)', color: 'var(--lyra-text)' }}>
            <aside
                className="lyra-glow relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden px-10 py-10 lg:flex xl:px-14"
                style={{ background: 'var(--lyra-sidebar)', color: 'var(--lyra-sidebar-fg)' }}
            >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--lyra-sidebar-muted)' }}>
                    {APP_CONFIG.sigla} · {APP_CONFIG.nome}
                </p>
                <div>
                    <h1 className="font-display text-5xl font-semibold tracking-tight xl:text-6xl">{APP_CONFIG.nome}</h1>
                    <p className="mt-5 max-w-sm text-base leading-relaxed" style={{ color: 'var(--lyra-sidebar-muted)' }}>
                        {APP_CONFIG.descricao}. Entre com a mesma conta Enterprise do ASC.
                    </p>
                    <ul className="mt-10 space-y-3 text-sm" style={{ color: 'var(--lyra-sidebar-muted)' }}>
                        <li>Agenda, serviços e clientes no mesmo login</li>
                        <li>Permissões por perfil de acesso</li>
                        <li>Operação do salão e da barbearia</li>
                    </ul>
                </div>
                <p className="text-xs opacity-70">
                    © {new Date().getFullYear()} {APP_CONFIG.empresa}
                </p>
            </aside>

            <section className="relative flex min-h-[100dvh] flex-1 flex-col">
                <div
                    className="flex items-center justify-between px-4 py-4 lg:hidden"
                    style={{ background: 'var(--lyra-sidebar)', color: 'var(--lyra-sidebar-fg)' }}
                >
                    <span className="font-display text-lg font-semibold">{APP_CONFIG.nome}</span>
                    <ThemeToggle />
                </div>

                <div className="absolute right-4 top-4 z-10 hidden lg:block">
                    <ThemeToggle />
                </div>

                <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
                    <div className="lyra-rise w-full max-w-md">
                        <p
                            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                            style={{ color: 'var(--lyra-faint)' }}
                        >
                            {APP_CONFIG.empresa}
                        </p>
                        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">Entrar</h2>
                        <p className="mt-2 text-sm" style={{ color: 'var(--lyra-muted)' }}>
                            Acesse sua conta em {APP_CONFIG.nome}
                        </p>

                        <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
                            <label className="block text-sm font-medium">
                                E-mail
                                <input
                                    className="lyra-input"
                                    name="username"
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="seu@email.com"
                                    required
                                    disabled={loading}
                                />
                            </label>
                            <label className="block text-sm font-medium">
                                Senha
                                <span className="relative mt-1 block">
                                    <input
                                        className="lyra-input pr-12"
                                        style={{ marginTop: 0 }}
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 flex items-center px-3 text-sm"
                                        style={{ color: 'var(--lyra-muted)' }}
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {showPassword ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                </span>
                            </label>
                            {error && (
                                <p
                                    className="rounded-lyra px-3 py-2 text-sm"
                                    style={{
                                        background: 'var(--lyra-danger-bg)',
                                        color: 'var(--lyra-danger)',
                                    }}
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                            <Button type="submit" disabled={loading} variant="primary" fullWidth>
                                {loading ? 'Entrando…' : 'Entrar'}
                            </Button>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
}
