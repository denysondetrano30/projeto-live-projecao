<script lang="ts">
    // Projeto Live (somun Telão, 19/11): barra de cima do layout novo.
    // Esquerda: ícone "tela." + "Telão" e o seletor do culto (Cultos do Diretor + projetos).
    // Meio: Culto (o antigo Mostrar), Editar, Palco. Direita: Transmissão (bolinha do NDI), Telão
    // ligado/desligado (o mesmo ligar/desligar saída de antes) e o "⋯" (Desenhar,
    // Projetores, Configurações). O layout clássico usa a barra antiga (Top.svelte).
    import { fade } from "svelte/transition"
    import { activePage, activePopup, activeProject, dictionary, drawSettings, drawTool, outputDisplay, outputs, paintCache, projects, projectView } from "../../stores"
    import { translateText } from "../../utils/language"
    import { abrirGaveta } from "../../utils/projetoLiveLayout"
    import { plCultos, plCultosLoad, plShowProject } from "../../utils/projetoLiveCultos"
    import Icon from "../helpers/Icon.svelte"
    import { toggleOutputs } from "../helpers/output"
    import { openProject } from "../show/project"
    import TopButton from "../inputs/TopButton.svelte"
    import { onDestroy, onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain, sendMain } from "../../IPC/main"
    import { popupData } from "../../stores"
    import { plRelatarInstall } from "../../utils/projetoLiveRelatar"

    // registro técnico do "Relatar problema" desde o começo
    plRelatarInstall()

    export let editDisabled = false
    export let settingsDisabled = false
    export let noPhysicalOutputWindows = false
    export let openOutputSettings: () => void = () => {}

    // --- seletor do culto ---
    let seletorAberto = false
    $: projetoAtual = $projects[$activeProject || ""]
    $: nomeAtual = projetoAtual && !$projectView ? projetoAtual.name : "Escolha um culto"

    $: cultos = Object.entries($plCultos.cultos || {})
        .filter(([, c]) => c.emUso !== null)
        .sort((a, b) => `${b[1].data} ${b[1].hora}`.localeCompare(`${a[1].data} ${a[1].hora}`))
        .slice(0, 6)
    $: recentes = Object.entries($projects)
        .filter(([, p]) => p && !p.archived && !(p as any).deleted)
        .sort((a, b) => ((b[1] as any).used || b[1].modified || 0) - ((a[1] as any).used || a[1].modified || 0))
        .slice(0, 12)

    const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
    function quando(data: string, hora: string) {
        const p = (data || "").split("-").map(Number)
        if (p.length !== 3) return hora || ""
        const d = new Date(p[0], p[1] - 1, p[2])
        return `${DIAS[d.getDay()]} ${String(p[2]).padStart(2, "0")}/${String(p[1]).padStart(2, "0")}${hora ? " · " + hora.replace(":00", "h").replace(":", "h") : ""}`
    }

    function abrirSeletor() {
        seletorAberto = !seletorAberto
        if (seletorAberto) plCultosLoad()
    }
    function escolherProjeto(id: string) {
        seletorAberto = false
        activePage.set("show")
        openProject(id)
    }
    function escolherCulto(id: string) {
        seletorAberto = false
        activePage.set("show")
        projectView.set(false)
        plShowProject(id)
    }
    function todosOsProjetos() {
        seletorAberto = false
        activePage.set("show")
        projectView.set(true)
    }
    function cultosDoDiretor() {
        seletorAberto = false
        activePopup.set("projeto_live_cultos")
    }

    // --- Transmissão: bolinha do NDI (clara = o OBS está recebendo pelo NDI) ---
    $: ndiOk = !!$outputs.pl_transmissao?.ndi || !!$outputs.pl_transmissao_vertical?.ndi

    // --- Telão ligado/desligado (o mesmo ligar/desligar saída da barra antiga) ---
    let confirmar = false
    let travado = false
    let cancelar: NodeJS.Timeout | null = null
    function alternarTelao(e: MouseEvent) {
        if (cancelar) clearTimeout(cancelar)
        const forcar = e.ctrlKey || e.metaKey
        if (!$outputDisplay || confirmar) {
            if (confirmar) {
                travado = true
                setTimeout(() => (travado = false), 800)
            }
            confirmar = false
            toggleOutputs(null, { force: forcar })
            return
        }
        if (forcar) return
        confirmar = true
        cancelar = setTimeout(() => (confirmar = false), 1800)
    }

    // --- ⋯ ---
    let maisAberto = false
    $: desenhoAtivo = $drawTool === "fill" || ($drawTool === "zoom" && $drawSettings.zoom?.size !== 100) || !!($drawTool === "paint" && $paintCache?.length)
    function abrirMais(acao: () => void) {
        maisAberto = false
        acao()
    }

    // --- versão nova (decidido com ela 25/11): aviso discreto, só com o telão desligado ---
    let versaoNova = ""
    let versaoDispensada = false
    let versaoAberto = false
    let conferir: NodeJS.Timeout | null = null
    function conferirVersao() {
        requestMain(Main.PROJETO_LIVE_UPDATE_STATE, undefined, (estado) => {
            versaoNova = estado?.pronta ? estado.versao : ""
        })
    }
    onMount(() => {
        // somun hub: sinal de vida (quando o tela foi usado e a versão), com a conta do Diretor
        setTimeout(async () => {
            await plCultosLoad()
            const conta = $plCultos.account
            if (conta?.uid && conta.refreshToken) sendMain(Main.PROJETO_LIVE_SINAL, { uid: conta.uid, refreshToken: conta.refreshToken, email: conta.email })
        }, 10000)
        setTimeout(conferirVersao, 20000)
        conferir = setInterval(conferirVersao, 60000)
    })
    onDestroy(() => {
        if (conferir) clearInterval(conferir)
    })
    function atualizarAgora() {
        versaoAberto = false
        sendMain(Main.PROJETO_LIVE_UPDATE_NOW)
    }
    function atualizarDepois() {
        versaoAberto = false
        versaoDispensada = true
    }

    // --- Relatar problema (25/11): tira o print antes de abrir a janela ---
    function relatar() {
        requestMain(Main.PROJETO_LIVE_RELATAR_PRINT, undefined, (print) => {
            popupData.set({ relatarPrint: print || "" })
            activePopup.set("projeto_live_relatar")
        })
    }

    function fecharAoClicarFora(e: MouseEvent) {
        const alvo = e.target as HTMLElement
        if (!alvo.closest(".seletor")) seletorAberto = false
        if (!alvo.closest(".mais")) maisAberto = false
        if (!alvo.closest(".versao")) versaoAberto = false
    }

    // somun tela (28/11): a aparência da Bíblia e das músicas mora no Editor; pelo ⋯ abre mesmo sem nada
    // aberto (o Editar fica cinza nesse caso)
    function abrirPadroes() {
        activePage.set("edit")
    }
</script>

<svelte:window on:mousedown={fecharAoClicarFora} />

<span class="esquerda">
    <div class="marca" data-title="somun tela">
        <div class="icone"><b>tela</b><i /></div>
    </div>

    <div class="seletor">
        <button class="botaoSeletor" class:aberto={seletorAberto} data-title="Escolher o culto (projetos e cultos do Diretor)" on:click={abrirSeletor}>
            <span class="nomeCulto">{nomeAtual}</span>
            <Icon id="expand" size={0.9} white />
        </button>

        {#if seletorAberto}
            <div class="lista" transition:fade={{ duration: 80 }}>
                {#if cultos.length}
                    <p class="titulo">Cultos do Diretor</p>
                    {#each cultos as [id, culto]}
                        <button class="item" on:click={() => escolherCulto(id)}>
                            <span>{culto.nome}</span>
                            <small>{quando(culto.data, culto.hora)}</small>
                        </button>
                    {/each}
                {/if}
                <button class="item acao" on:click={cultosDoDiretor}>Cultos do Diretor…</button>

                <p class="titulo">Projetos</p>
                {#each recentes as [id, projeto]}
                    <button class="item" class:atual={id === $activeProject && !$projectView} on:click={() => escolherProjeto(id)}>
                        <span>{projeto.name}</span>
                    </button>
                {/each}
                <button class="item acao" on:click={todosOsProjetos}>Todos os projetos e pastas…</button>
            </div>
        {/if}
    </div>
</span>

<span class="meio">
    <TopButton id="show" texto="Culto" />
    <TopButton id="edit" disabled={editDisabled} />
    <TopButton id="stage" />
</span>

<span class="direita">
    <button class="botao" class:ativo={$activePopup === "projeto_live_transmissao"} data-title="Transmissão: o que vai para a live (deitado e em pé){ndiOk ? '<br>NDI ok' : '<br>NDI desligado'}" on:click={() => activePopup.set("projeto_live_transmissao")}>
        <i class="bolinha" class:ok={ndiOk} />
        Transmissão
    </button>

    <button
        id="output_window_button"
        class="botao telao context #output"
        class:ligado={$outputDisplay}
        data-title={translateText(`menu.${$outputDisplay ? (confirmar ? "again_confirm" : "_title_display_stop") : "_title_display"} [Ctrl+O]`, $dictionary)}
        disabled={noPhysicalOutputWindows || travado}
        on:click={alternarTelao}
    >
        {#if $outputDisplay && confirmar}
            Clique de novo para desligar
        {:else}
            Telão {$outputDisplay ? "ligado" : "desligado"}
        {/if}
    </button>
    {#if !$outputDisplay && noPhysicalOutputWindows}
        <div class="semTelao" data-title={translateText("No 'physical' outputs available!")} role="none" on:click={openOutputSettings} />
    {/if}

    {#if versaoNova && !versaoDispensada && !$outputDisplay}
        <div class="versao">
            <button class="botao versaoBotao" class:ativo={versaoAberto} data-title="Versão nova do somun (tela e live) pronta para instalar" on:click={() => (versaoAberto = !versaoAberto)}>
                <i class="bolinha ok" />
                versão nova
            </button>
            {#if versaoAberto}
                <div class="lista direitaLista versaoLista" transition:fade={{ duration: 80 }}>
                    <button class="item" on:click={atualizarAgora}><span class="duas"><b>Atualizar agora</b><small>fecha e abre de novo, já atualizado</small></span></button>
                    <button class="item" on:click={atualizarDepois}><span class="duas"><b>Depois</b><small>instala sozinho quando fechar o programa</small></span></button>
                </div>
            {/if}
        </div>
    {/if}

    <div class="mais">
        <button class="botao tresPontos" class:vermelho={desenhoAtivo} class:ativo={maisAberto} data-title="Mais: desenhar, projetores e configurações" on:click={() => (maisAberto = !maisAberto)}>⋯</button>
        {#if maisAberto}
            <div class="lista direitaLista" transition:fade={{ duration: 80 }}>
                <button class="item" on:click={() => abrirMais(abrirPadroes)}><Icon id="edit" size={1} white /> <span>Aparência da Bíblia e das músicas</span></button>
                <button class="item" on:click={() => abrirMais(() => activePage.set("draw"))}><Icon id="draw" size={1} white /> <span>Desenhar</span></button>
                <button class="item" on:click={() => abrirMais(() => abrirGaveta("projectors"))}><Icon id="pl_projetor" size={1} white /> <span>Projetores</span></button>
                {#if !settingsDisabled}
                    <button class="item" on:click={() => abrirMais(() => activePage.set("settings"))}><Icon id="settings" size={1} white /> <span>Configurações</span></button>
                {/if}
                <button class="item" on:click={() => abrirMais(relatar)}><Icon id="help" size={1} white /> <span>Relatar problema</span></button>
            </div>
        {/if}
    </div>
</span>

<style>
    span {
        display: flex;
        align-items: center;
    }
    .esquerda {
        gap: 14px;
        padding-inline-start: 12px;
        min-width: var(--navigation-width);
    }
    .direita {
        position: relative;
        gap: 6px;
        padding-inline-end: 8px;
        min-width: var(--navigation-width);
        justify-content: flex-end;
    }

    .marca {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .icone {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 7px;
        border-radius: 7px;
        background-color: #232323;
        border: 1px solid #3a3a3a;
        font-family: "Outfit", sans-serif;
    }
    .icone b {
        font-weight: 800;
        font-size: 0.95em;
        color: #ffffff;
        letter-spacing: -0.2px;
    }
    .icone i {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background-color: #e5483b;
        margin-inline-start: 1px;
        align-self: flex-end;
        margin-bottom: 8px;
    }

    button {
        font-family: inherit;
        font-size: 0.9em;
        color: var(--text);
        background: transparent;
        border: 1px solid transparent;
        cursor: pointer;
        -webkit-app-region: no-drag;
    }

    .seletor {
        position: relative;
    }
    .botaoSeletor {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 30px;
        padding: 0 10px;
        border-radius: 7px;
        border-color: #2a2a2a;
        background-color: #1c1c1c;
        max-width: 280px;
    }
    .botaoSeletor:hover,
    .botaoSeletor.aberto {
        border-color: #3a3a3a;
        background-color: #232323;
    }
    .nomeCulto {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .lista {
        position: absolute;
        top: 36px;
        inset-inline-start: 0;
        min-width: 280px;
        max-height: 70vh;
        overflow-y: auto;
        padding: 6px;
        border-radius: 8px;
        border: 1px solid #3a3a3a;
        background-color: #1c1c1c;
        box-shadow: 0 6px 20px rgb(0 0 0 / 0.5);
        display: flex;
        flex-direction: column;
        z-index: 60;
    }
    .direitaLista {
        inset-inline-start: unset;
        inset-inline-end: 0;
        min-width: 200px;
    }
    .titulo {
        font-size: 0.75em;
        color: #8c8c8c;
        padding: 8px 8px 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 7px 8px;
        border-radius: 5px;
        text-align: start;
    }
    .direitaLista .item {
        justify-content: flex-start;
    }
    .item:hover {
        background-color: #2a2a2a;
    }
    .item.atual {
        border-color: #a8a8a8;
    }
    .item small {
        color: #8c8c8c;
        white-space: nowrap;
    }
    .item.acao {
        color: #a8a8a8;
    }

    .meio {
        gap: 0;
    }

    .botao {
        display: flex;
        align-items: center;
        gap: 7px;
        height: 30px;
        padding: 0 12px;
        border-radius: 7px;
        border-color: #2a2a2a;
        background-color: #1c1c1c;
    }
    .botao:hover,
    .botao.ativo {
        border-color: #3a3a3a;
        background-color: #232323;
    }
    .botao:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .bolinha {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #3a3a3a;
    }
    .bolinha.ok {
        background-color: #f2f2f2;
    }
    .telao.ligado {
        background-color: #e5483b;
        border-color: #e5483b;
        color: #ffffff;
    }
    .tresPontos {
        font-size: 1.2em;
        padding: 0 10px;
        line-height: 1;
    }
    .tresPontos.vermelho {
        border-color: #e5483b;
    }
    .versao {
        position: relative;
    }
    .versaoBotao {
        color: #a8a8a8;
    }
    .versaoLista {
        min-width: 260px;
    }
    .duas {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }
    .duas b {
        font-weight: 500;
    }
    .duas small {
        color: #8c8c8c;
        font-size: 0.85em;
    }
    .semTelao {
        position: absolute;
        top: 0;
        height: 100%;
        width: 150px;
        inset-inline-end: 50px;
    }
</style>
