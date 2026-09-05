import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';

export default function AgendaPage() {
    return (
        <PageLayout titulo="Agenda" subtitulo="Horários e atendimentos">
            <PageCard>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Tela placeholder — o cadastro de horários entra no passo 7.
                </p>
            </PageCard>
        </PageLayout>
    );
}
