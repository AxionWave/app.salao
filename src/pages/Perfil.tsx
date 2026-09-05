import { authService } from '@core/services';
import { APP_CONFIG, urlInicioAsc } from '@core/config';
import { buildSsoLaunchUrl } from '@core/auth/sso';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import { Badge, Button } from '@/components/ui';

export default function PerfilPage() {
    const user = authService.getStoredUserInfo();
    const roles = authService.getRoles();
    const modulos = authService.getModulos();

    return (
        <PageLayout titulo="Perfil" subtitulo="Sua conta">
            <PageCard fill={false}>
                <div className="p-6 md:p-8">
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Dados do JWT Enterprise. Para alterar senha, use o ASC.
                    </p>
                    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                                E-mail
                            </dt>
                            <dd className="mt-1 text-sm">{user?.email || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                                Usuário
                            </dt>
                            <dd className="mt-1 text-sm">{user?.username || '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                                Empresa
                            </dt>
                            <dd className="mt-1 text-sm">{user?.empresaNome || APP_CONFIG.empresa}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                                Empresa ID
                            </dt>
                            <dd className="mt-1 font-mono text-sm">{user?.empresaId || '—'}</dd>
                        </div>
                    </dl>
                    <div className="mt-6">
                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                            Perfis / roles
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {roles.length === 0 ? (
                                <Badge variant="faint">nenhum no token</Badge>
                            ) : (
                                roles.map((r) => (
                                    <Badge key={r} variant="copper">
                                        {r}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="mt-6">
                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--faint)' }}>
                            Módulos no JWT
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {modulos.length === 0 ? (
                                <Badge variant="faint">nenhum</Badge>
                            ) : (
                                modulos.map((m) => (
                                    <Badge key={m} variant="faint">
                                        {m}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="mt-8">
                        <Button
                            variant="secondary"
                            onClick={() => window.location.assign(buildSsoLaunchUrl(urlInicioAsc()))}
                        >
                            Abrir ASC para alterar senha
                        </Button>
                    </div>
                </div>
            </PageCard>
        </PageLayout>
    );
}
