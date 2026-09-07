import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import { Alert, Badge, Button, Input, Modal, Switch, Table, Textarea } from '@/components/ui';
import { authService } from '@core/services';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import {
    CATALOGO_FLAGS,
    ehClienteAdmin,
    ehFuncionarioLyra,
    ehPerfilFixo,
    flagsDoPerfil,
    flagsVazias,
    perfilAcessoService,
    rotuloFlags,
    type FlagsForm,
    type ModuloLyraCatalogo,
    type PerfilLyraCompleto,
} from '@/services/perfilAcesso.service';

export default function ConfiguracoesPage() {
    const empresaId = Number(authService.getStoredUserInfo()?.empresaId || 0);
    const [itens, setItens] = useState<PerfilLyraCompleto[]>([]);
    const [catalogo, setCatalogo] = useState<ModuloLyraCatalogo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erroLista, setErroLista] = useState('');
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState<PerfilLyraCompleto | null>(null);
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [flags, setFlags] = useState<FlagsForm>(flagsVazias);
    const [formErro, setFormErro] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [apagandoId, setApagandoId] = useState<number | null>(null);

    const carregar = useCallback(async () => {
        if (!empresaId) {
            setErroLista('O token não tem empresa. Faça login novamente.');
            setCarregando(false);
            return;
        }
        setCarregando(true);
        setErroLista('');
        try {
            const [lista, mods] = await Promise.all([
                perfilAcessoService.listarCompletos(empresaId),
                perfilAcessoService.catalogoModulosLyra(),
            ]);
            setItens(lista);
            setCatalogo(mods);
        } catch (e) {
            setErroLista(mensagemErroHttp(e));
            setItens([]);
        } finally {
            setCarregando(false);
        }
    }, [empresaId]);

    useEffect(() => {
        void carregar();
    }, [carregar]);

    const fecharForm = () => {
        if (salvando) return;
        setFormAberto(false);
        setEditando(null);
    };

    const abrirNovo = () => {
        setEditando(null);
        setNome('');
        setDescricao('');
        setFlags({ ...flagsVazias, agendar: true, clientes: true });
        setFormErro('');
        setFormAberto(true);
    };

    const abrirEditar = (p: PerfilLyraCompleto) => {
        setEditando(p);
        setNome(p.nome);
        setDescricao(p.descricao ?? '');
        setFlags(flagsDoPerfil(p));
        setFormErro('');
        setFormAberto(true);
    };

    const bloqueadoClienteAdmin = Boolean(editando && ehClienteAdmin(editando.nome));
    const nomeTravado = Boolean(editando && ehPerfilFixo(editando));
    const podeSalvar = nome.trim().length > 0 && !bloqueadoClienteAdmin;

    const salvar = async () => {
        if (!podeSalvar || !empresaId) {
            setFormErro('Dê um nome ao perfil.');
            return;
        }
        setSalvando(true);
        setFormErro('');
        try {
            if (editando) {
                await perfilAcessoService.atualizar(editando.id, {
                    nome,
                    descricao,
                    empresaId,
                    flags,
                    catalogo,
                });
            } else {
                await perfilAcessoService.criar({
                    nome,
                    descricao,
                    empresaId,
                    flags,
                    catalogo,
                });
            }
            setFormAberto(false);
            setEditando(null);
            await carregar();
        } catch (e) {
            setFormErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async (p: PerfilLyraCompleto) => {
        if (ehPerfilFixo(p)) return;
        setApagandoId(p.id);
        setErroLista('');
        try {
            await perfilAcessoService.desativar(p.id);
            await carregar();
        } catch (e) {
            setErroLista(mensagemErroHttp(e));
        } finally {
            setApagandoId(null);
        }
    };

    const vazioLista = useMemo(
        () => !carregando && itens.length === 0 && !erroLista,
        [carregando, itens.length, erroLista]
    );

    return (
        <PageLayout
            titulo="Configurações"
            subtitulo="Perfis e permissões"
            acoes={
                <Button size="sm" onClick={abrirNovo}>
                    Novo perfil
                </Button>
            }
        >
            <PageCard>
                <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Defina o que cada perfil pode fazer no Lyra (agendar, clientes, serviços, relatório,
                    configurações). Estas funções não se marcam no ASC — só aqui. Cliente Admin e
                    Funcionário Lyra são fixos: não se apagam nem se renomeiam.
                </p>

                {erroLista && (
                    <div className="mb-4">
                        <Alert titulo={tituloDeMensagem(erroLista)}>{erroLista}</Alert>
                    </div>
                )}

                {carregando && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando perfis…
                    </p>
                )}

                {vazioLista && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Nenhum perfil Lyra nesta empresa.
                    </p>
                )}

                {!carregando && itens.length > 0 && (
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Cell>Perfil</Table.Cell>
                                <Table.Cell>Permissões</Table.Cell>
                                <Table.Cell></Table.Cell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {itens.map((p) => {
                                const flagsP = flagsDoPerfil(p);
                                const fixo = ehPerfilFixo(p);
                                return (
                                    <Table.Row key={p.id}>
                                        <Table.Cell>
                                            <span className="font-medium" style={{ color: 'var(--ink)' }}>
                                                {p.nome}
                                            </span>
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                {fixo ? (
                                                    <Badge variant="faint" size="sm">
                                                        Fixo
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="copper" size="sm">
                                                        Empresa
                                                    </Badge>
                                                )}
                                                {ehClienteAdmin(p.nome) && (
                                                    <Badge variant="ok" size="sm">
                                                        Teto
                                                    </Badge>
                                                )}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p className="max-w-md text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                {rotuloFlags(flagsP)}
                                            </p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => abrirEditar(p)}>
                                                    {ehClienteAdmin(p.nome) ? 'Ver' : 'Editar'}
                                                </Button>
                                                {!fixo && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={apagandoId === p.id}
                                                        onClick={() => void excluir(p)}
                                                    >
                                                        Excluir
                                                    </Button>
                                                )}
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table>
                )}
            </PageCard>

            <Modal
                aberto={formAberto}
                titulo={editando ? editando.nome : 'Novo perfil'}
                eyebrow="Permissões Lyra"
                subtitulo={
                    bloqueadoClienteAdmin
                        ? 'Cliente Admin tem todas as permissões do Lyra. Não dá para desmarcar nem apagar.'
                        : ehFuncionarioLyra(editando?.nome || '')
                          ? 'Perfil fixo: dá para mudar as flags, não o nome.'
                          : 'Marque o que este perfil pode fazer no salão.'
                }
                onClose={fecharForm}
                largura="36rem"
                rodape={
                    <>
                        <Button variant="ghost" onClick={fecharForm} disabled={salvando}>
                            Fechar
                        </Button>
                        {!bloqueadoClienteAdmin && (
                            <Button onClick={() => void salvar()} disabled={salvando || !podeSalvar}>
                                {salvando ? 'Salvando…' : 'Salvar'}
                            </Button>
                        )}
                    </>
                }
            >
                {formErro && (
                    <div className="mb-4">
                        <Alert titulo={tituloDeMensagem(formErro)}>{formErro}</Alert>
                    </div>
                )}
                <div className="flex flex-col gap-4 pb-2">
                    <Input
                        label="Nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        disabled={nomeTravado || salvando}
                    />
                    <Textarea
                        label="Descrição"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        disabled={nomeTravado || salvando}
                    />
                    <div className="flex flex-col gap-2">
                        {CATALOGO_FLAGS.filter((item) =>
                            catalogo.some((m) => m.moduloCodigo === item.codigo)
                        ).map((item) => (
                            <Switch
                                key={item.id}
                                label={item.label}
                                descricao={item.detalhe}
                                checked={flags[item.id]}
                                disabled={bloqueadoClienteAdmin || salvando}
                                onChange={(v) => setFlags((f) => ({ ...f, [item.id]: v }))}
                            />
                        ))}
                    </div>
                </div>
            </Modal>
        </PageLayout>
    );
}
