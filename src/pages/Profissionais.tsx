import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';

export default function ProfissionaisPage() {
    return (
        <PageLayout titulo="Profissionais" subtitulo="Equipe">
            <PageCard>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Tela placeholder — o cadastro da equipe entra no passo 6.
                </p>
            </PageCard>
        </PageLayout>
    );
}
