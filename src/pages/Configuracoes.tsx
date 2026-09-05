import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';

export default function ConfiguracoesPage() {
    return (
        <PageLayout titulo="Configurações" subtitulo="Unidade e perfis">
            <PageCard>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Tela placeholder — unidade e permissões entram no passo 9.
                </p>
            </PageCard>
        </PageLayout>
    );
}
