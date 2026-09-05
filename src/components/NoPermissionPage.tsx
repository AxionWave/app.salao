import PageLayout from '@/components/layout/PageLayout';

export default function NoPermissionPage({
    message,
    description,
}: {
    message?: string;
    description?: string;
}) {
    const texto = [message, description].filter(Boolean).join(' ');
    return (
        <PageLayout
            titulo="Acesso negado"
            subtitulo="Permissão"
            accessDenied={{
                show: true,
                message:
                    texto ||
                    'Você não tem permissão para acessar este módulo. Peça acesso no ASC e faça login novamente.',
            }}
        />
    );
}
