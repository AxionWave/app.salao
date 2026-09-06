import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '@core/services';
import { APP_CONFIG } from '@core/config';
import { Alert, Button } from '@/components/ui';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { mensagemErroHttp } from '@/exceptions';

function CampoSenha({
    id,
    label,
    value,
    onChange,
    disabled,
    autoComplete,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled: boolean;
    autoComplete: string;
}) {
    const [mostrar, setMostrar] = useState(false);
    return (
        <label className="block text-sm font-medium" htmlFor={id}>
            {label}
            <span className="relative mt-1 block">
                <input
                    id={id}
                    className="lyra-input pr-12"
                    style={{ marginTop: 0 }}
                    type={mostrar ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    minLength={6}
                    disabled={disabled}
                    placeholder="Mínimo 6 caracteres"
                />
                <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-sm"
                    style={{ color: 'var(--lyra-muted)' }}
                    onClick={() => setMostrar((v) => !v)}
                    aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    {mostrar ? 'Ocultar' : 'Mostrar'}
                </button>
            </span>
        </label>
    );
}

export default function PrimeiroAcessoPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const user = authService.getStoredUserInfo();
    const email = useMemo(
        () => (params.get('email') || user?.email || '').trim(),
        [params, user?.email],
    );

    const [novaSenha, setNovaSenha] = useState('');
    const [confirmacao, setConfirmacao] = useState('');
    const [erro, setErro] = useState('');
    const [salvando, setSalvando] = useState(false);

    if (!authService.isAuthenticated() && !email) {
        return <Navigate to="/login" replace />;
    }
    if (authService.isAuthenticated() && !authService.needsPasswordChange()) {
        return <Navigate to="/inicio" replace />;
    }

    const sair = () => {
        authService.logout();
        navigate('/login', { replace: true });
    };

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErro('');
        if (novaSenha.length < 6) {
            setErro('A nova senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (novaSenha !== confirmacao) {
            setErro('A confirmação da senha não confere.');
            return;
        }
        if (!email) {
            setErro('Não encontramos o e-mail da conta. Entre novamente.');
            return;
        }
        setSalvando(true);
        try {
            await authService.definirSenhaInicial(email, novaSenha);
            authService.clearPasswordChangeFlag();
            try {
                await authService.login({ username: email, password: novaSenha });
                authService.clearPasswordChangeFlag();
            } catch {
                /* senha já definida; sessão anterior segue válida */
            }
            navigate('/inicio', { replace: true });
        } catch (err) {
            setErro(mensagemErroHttp(err, 'Não foi possível definir a senha. Tente novamente.'));
        } finally {
            setSalvando(false);
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
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--copper)' }}>
                        Primeiro acesso
                    </p>
                    <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight xl:text-6xl">
                        Sua senha, no {APP_CONFIG.nome}
                    </h1>
                    <p className="mt-5 max-w-sm text-base leading-relaxed" style={{ color: 'var(--lyra-sidebar-muted)' }}>
                        Por segurança, troque a senha provisória (o CPF) antes de entrar na agenda.
                    </p>
                    <ul className="mt-10 space-y-3 text-sm" style={{ color: 'var(--lyra-sidebar-muted)' }}>
                        <li>Mínimo de 6 caracteres — prefira 8 ou mais</li>
                        <li>Misture letras, números e um símbolo</li>
                        <li>Não use o CPF nem dados óbvios</li>
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
                        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">Defina sua senha</h2>
                        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lyra-muted)' }}>
                            {user?.username || email ? (
                                <>
                                    Olá
                                    {user?.username ? (
                                        <>
                                            , <span className="font-medium" style={{ color: 'var(--lyra-text)' }}>{user.username}</span>
                                        </>
                                    ) : null}
                                    . Crie uma senha nova para {email || 'sua conta'}.
                                </>
                            ) : (
                                <>Crie uma senha nova para acessar o {APP_CONFIG.nome}.</>
                            )}
                        </p>

                        <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
                            <label className="block text-sm font-medium">
                                E-mail
                                <input className="lyra-input" type="email" value={email} readOnly disabled />
                            </label>
                            <CampoSenha
                                id="nova-senha"
                                label="Nova senha"
                                value={novaSenha}
                                onChange={setNovaSenha}
                                disabled={salvando}
                                autoComplete="new-password"
                            />
                            <CampoSenha
                                id="confirma-senha"
                                label="Confirmar senha"
                                value={confirmacao}
                                onChange={setConfirmacao}
                                disabled={salvando}
                                autoComplete="new-password"
                            />
                            {erro && <Alert titulo="Não foi possível salvar">{erro}</Alert>}
                            <Button type="submit" variant="primary" fullWidth disabled={salvando || !email}>
                                {salvando ? 'Salvando…' : 'Salvar senha e entrar'}
                            </Button>
                        </form>

                        <p className="mt-6 text-center">
                            <button
                                type="button"
                                className="text-sm font-medium"
                                style={{ color: 'var(--lyra-muted)' }}
                                onClick={sair}
                            >
                                Sair
                            </button>
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
