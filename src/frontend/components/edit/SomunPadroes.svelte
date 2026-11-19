<script lang="ts">
    // Projeto Live (somun tela, 19/11): "Padrões" da aba Editar — visual da Bíblia e das músicas, no
    // Telão e no Vertical 9:16, com prévia. A lógica fica em utils/projetoLivePadroes.ts.
    import { outputs, scriptureSettings, styles, templates } from "../../stores"
    import { clone } from "../helpers/array"
    import { percentageStylePos } from "../helpers/output"
    import Textbox from "../slide/Textbox.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import { escolherModeloDaBiblia, FONTES, lerPadrao, modeloDe, modelosDaBiblia, mudarPadrao, musicasUsamPadrao, temPadraoDeFabrica, usarPadraoNasMusicas, voltarAoPadrao } from "../../utils/projetoLivePadroes"
    import type { SaidaPadrao, TipoPadrao, ValoresPadrao } from "../../utils/projetoLivePadroes"
    import { plPadroesAberto } from "../../utils/projetoLiveLayout"

    let tipo: TipoPadrao = "biblia"
    let saida: SaidaPadrao = "telao"
    $: bibliaTelao = $scriptureSettings?.template || "scripture"

    $: listaBiblia = comAtual(modelosDaBiblia($templates), bibliaTelao)
    // se o que está na tela é um modelo que saiu da lista, ele continua aparecendo
    function comAtual(lista: { id: string; nome: string }[], atual: string) {
        if (!atual || lista.some((m) => m.id === atual) || !$templates[atual]) return lista
        return [...lista, { id: atual, nome: $templates[atual].name || atual }]
    }
    $: id = modeloDe(tipo, saida, bibliaTelao)
    $: v = lerPadrao(id, tipo, $templates) as ValoresPadrao | null
    $: usando = musicasUsamPadrao({ $outputs, $styles })
    $: desligado = tipo === "musica" && saida === "telao" && !usando

    const RES = { telao: { width: 1920, height: 1080 }, vertical: { width: 1080, height: 1920 } }
    // a Projeção desenha a saída em pé numa tela de 1920 de largura (altura 3413) e reduz: a prévia faz igual
    const TELA = { telao: { width: 1920, height: 1080 }, vertical: { width: 1920, height: (1920 * 1920) / 1080 } }
    const AMOSTRA_TEXTO = "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito"
    const AMOSTRA_LETRA = "Porque Ele vive, posso crer no amanhã"

    function itensDaPrevia(t: any, s: SaidaPadrao, tp: TipoPadrao) {
        const itens = clone(t?.items || [])
        let primeiroTexto = true
        itens.forEach((it: any) => {
            ;(it.lines || []).forEach((l: any) =>
                (l.text || []).forEach((x: any) => {
                    let val = String(x.value || "")
                    if (tp === "biblia") val = val.replace("{scripture_text}", AMOSTRA_TEXTO).replace("{scripture_number}", "16").replace("{scripture_reference}", "João 3:16").replace(/\{scripture_[a-z]+\}/g, "")
                    else if (primeiroTexto && (it.type || "text") === "text") val = AMOSTRA_LETRA
                    x.value = val
                })
            )
            if ((it.type || "text") === "text") primeiroTexto = false
            if (s === "vertical") {
                it.style = percentageStylePos(it.style || "", RES.vertical)
                // na prévia em pé o "encolher se não couber" não consegue medir e põe tudo em 50px: mostra o tamanho do modelo
                if (it.textFit === "shrinkToFit") delete it.textFit
            }
        })
        return itens
    }
    $: previa = itensDaPrevia($templates[id], saida, tipo)

    function mudar(chave: keyof ValoresPadrao, valor: any) {
        mudarPadrao(id, tipo, chave, valor)
    }
    function num(e: Event) {
        return Number((e.currentTarget as HTMLInputElement).value)
    }
    function txt(e: Event) {
        return (e.currentTarget as HTMLInputElement | HTMLSelectElement).value
    }

    let confirmar = false
    function voltar() {
        if (!confirmar) {
            confirmar = true
            setTimeout(() => (confirmar = false), 4000)
            return
        }
        confirmar = false
        voltarAoPadrao(id)
    }
</script>

<div class="padroes">
    <div class="topo">
        <div class="chave">
            <button class:ativa={tipo === "biblia"} on:click={() => (tipo = "biblia")}>Bíblia</button>
            <button class:ativa={tipo === "musica"} on:click={() => (tipo = "musica")}>Músicas</button>
        </div>
        <div class="chave">
            <button class:ativa={saida === "telao"} on:click={() => (saida = "telao")}>Telão</button>
            <button class:ativa={saida === "vertical"} on:click={() => (saida = "vertical")}>Vertical 9:16</button>
        </div>
        {#if tipo === "biblia" && saida === "telao"}
            <label class="modelo">
                Modelo na tela
                <select value={bibliaTelao} on:change={(e) => escolherModeloDaBiblia(txt(e))}>
                    {#each listaBiblia as m}
                        <option value={m.id}>{m.nome}</option>
                    {/each}
                </select>
            </label>
        {/if}
        <span class="espaco" />
        <button class="fechar" on:click={() => plPadroesAberto.set(false)}>Fechar</button>
    </div>

    {#if tipo === "musica" && saida === "telao"}
        <label class="usar">
            <input type="checkbox" checked={usando} on:change={(e) => usarPadraoNasMusicas(e.currentTarget.checked)} />
            Usar este padrão em todas as músicas no telão
            <span>{usando ? "(valendo por cima do visual de cada música; a transmissão 16:9 acompanha)" : "(desligado: cada música aparece com o visual dela)"}</span>
        </label>
    {/if}

    <div class="corpo">
        <div class="previa" class:em-pe={saida === "vertical"}>
            {#key id + saida}
                <Zoomed resolution={TELA[saida]} background="#4a4a4a" style="width: 100%;height: 100%;" hideOverflow>
                    {#each previa as item}
                        <Textbox {item} ref={{ type: "template", id }} dynamicValues={false} isTemplatePreview />
                    {/each}
                </Zoomed>
            {/key}
            {#if desligado}<p class="aviso">Desligado — ligue a caixinha acima para valer no telão</p>{/if}
        </div>

        {#if v}
            <div class="ajustes" class:apagado={desligado}>
                <h4>Letra</h4>
                <label>
                    Fonte
                    <select value={v.fonte} on:change={(e) => mudar("fonte", txt(e))}>
                        {#each FONTES as f}
                            <option value={f}>{f || "Padrão"}</option>
                        {/each}
                        {#if v.fonte && !FONTES.includes(v.fonte)}<option value={v.fonte}>{v.fonte}</option>{/if}
                    </select>
                </label>
                <label class="linha"><input type="checkbox" checked={v.automatico} on:change={(e) => mudar("automatico", e.currentTarget.checked)} /> Tamanho automático (enche a caixa)</label>
                {#if !v.automatico}
                    <label>Tamanho <span>{Math.round(v.tamanho)}px</span><input type="range" min="30" max="220" step="1" value={v.tamanho} on:change={(e) => mudar("tamanho", num(e))} /></label>
                {/if}
                <label class="linha">Cor <input type="color" value={v.cor} on:change={(e) => mudar("cor", txt(e))} /></label>

                <h4>Posição</h4>
                <div class="chave pequena">
                    {#each [["cima", "Em cima"], ["meio", "No meio"], ["baixo", "Embaixo"]] as [valor, nome]}
                        <button class:ativa={v.posicao === valor} on:click={() => mudar("posicao", valor)}>{nome}</button>
                    {/each}
                </div>
                <div class="chave pequena">
                    {#each [["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]] as [valor, nome]}
                        <button class:ativa={v.alinhamento === valor} on:click={() => mudar("alinhamento", valor)}>{nome}</button>
                    {/each}
                </div>

                {#if tipo === "biblia"}
                    <h4>Referência</h4>
                    <label class="linha"><input type="checkbox" checked={v.refMostrar} on:change={(e) => mudar("refMostrar", e.currentTarget.checked)} /> Mostrar a referência (ex.: João 3:16)</label>
                    {#if v.refMostrar}
                        <label>Tamanho <span>{Math.round(v.refTamanho)}px</span><input type="range" min="20" max="140" step="1" value={Math.min(140, v.refTamanho)} on:change={(e) => mudar("refTamanho", num(e))} /></label>
                        <div class="chave pequena">
                            <button class:ativa={v.refLugar === "embaixo"} on:click={() => mudar("refLugar", "embaixo")}>Embaixo do texto</button>
                            <button class:ativa={v.refLugar === "emcima"} on:click={() => mudar("refLugar", "emcima")}>Em cima do texto</button>
                        </div>
                    {/if}
                {/if}

                <h4>Fundo atrás do texto</h4>
                <div class="chave pequena">
                    {#each [["nada", "Nada"], ["faixa", "Faixa"], ["caixa", "Caixa"]] as [valor, nome]}
                        <button class:ativa={v.fundo === valor} on:click={() => mudar("fundo", valor)}>{nome}</button>
                    {/each}
                </div>
                {#if v.fundo !== "nada"}
                    <label class="linha">Cor <input type="color" value={v.fundoCor} on:change={(e) => mudar("fundoCor", txt(e))} /></label>
                    <label>Transparência <span>{100 - v.fundoOpacidade}%</span><input type="range" min="0" max="100" step="5" value={100 - v.fundoOpacidade} on:change={(e) => mudar("fundoOpacidade", 100 - num(e))} /></label>
                {/if}

                <h4>Contorno e sombra</h4>
                <label>Contorno <span>{v.contorno}px</span><input type="range" min="0" max="10" step="1" value={v.contorno} on:change={(e) => mudar("contorno", num(e))} /></label>
                {#if v.contorno > 0}
                    <label class="linha">Cor do contorno <input type="color" value={v.contornoCor} on:change={(e) => mudar("contornoCor", txt(e))} /></label>
                {/if}
                <label>Sombra <span>{v.sombra}%</span><input type="range" min="0" max="100" step="5" value={v.sombra} on:change={(e) => mudar("sombra", num(e))} /></label>

                {#if temPadraoDeFabrica(id)}
                    <button class="voltar" class:confirmar on:click={voltar}>{confirmar ? "Clique de novo para confirmar" : "Voltar ao padrão do somun"}</button>
                {/if}
            </div>
        {:else}
            <p class="aviso">Este modelo não tem caixa de texto para ajustar.</p>
        {/if}
    </div>
</div>

<style>
    .padroes {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        padding: 14px 18px;
        overflow: auto;
        background-color: var(--primary-darker);
    }
    .topo {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }
    .espaco {
        flex: 1;
    }
    .chave {
        display: flex;
        gap: 2px;
        padding: 2px;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
    }
    .chave button,
    .fechar,
    .voltar {
        font-family: inherit;
        color: var(--text);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 5px 14px;
        cursor: pointer;
    }
    .chave button.ativa {
        background-color: #2a2a2a;
        border-color: #3a3a3a;
    }
    .chave.pequena button {
        flex: 1;
        padding: 4px 8px;
        font-size: 0.85em;
    }
    .fechar {
        border-color: #3a3a3a;
    }
    .modelo,
    label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.85em;
        color: #a8a8a8;
    }
    .modelo {
        flex-direction: row;
        align-items: center;
        gap: 8px;
    }
    label span {
        color: var(--text);
    }
    label.linha {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        color: var(--text);
    }
    .usar {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        font-size: 0.95em;
        color: var(--text);
        padding: 8px 12px;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        background-color: #1c1c1c;
    }
    .usar span {
        color: #8c8c8c;
        font-size: 0.9em;
    }
    select {
        font-family: inherit;
        color: var(--text);
        background-color: #1c1c1c;
        border: 1px solid #2a2a2a;
        border-radius: 6px;
        padding: 5px;
    }
    select option {
        background-color: #1c1c1c;
    }
    input[type="range"] {
        accent-color: #e8e8e8;
    }
    input[type="color"] {
        width: 44px;
        height: 26px;
        border: 1px solid #3a3a3a;
        border-radius: 4px;
        background: transparent;
        padding: 0;
    }
    .corpo {
        display: flex;
        gap: 20px;
        align-items: flex-start;
        flex: 1;
        min-height: 0;
    }
    .previa {
        position: relative;
        flex: 1;
        aspect-ratio: 16 / 9;
        max-height: 70vh;
        border: 1px solid #3a3a3a;
        border-radius: 6px;
        overflow: hidden;
    }
    .previa.em-pe {
        flex: 0 0 auto;
        height: 70vh;
        aspect-ratio: 9 / 16;
    }
    .aviso {
        position: absolute;
        bottom: 10px;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 0.85em;
        color: #a8a8a8;
    }
    .ajustes {
        width: 300px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .ajustes.apagado {
        opacity: 0.45;
    }
    h4 {
        margin-top: 8px;
        font-size: 0.75em;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #a8a8a8;
    }
    .voltar {
        margin-top: 12px;
        border-color: #3a3a3a;
    }
    .voltar.confirmar {
        border-color: #e8e8e8;
    }
</style>
