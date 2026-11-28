<script lang="ts">
    // Projeto Live (somun tela, 28/11): Editor único. Junta o editor do slide e o antigo "Padrões":
    // a prévia mostra o slide de verdade (letra ou versículo), arrasta e muda o tamanho da caixa, tem os
    // nove lugares rápidos, Horizontal | Vertical 9:16, e o alcance (Vale para todas | Só nesta música |
    // Só neste slide). A lógica fica em utils/projetoLiveEditor.ts e utils/projetoLivePadroes.ts.
    import { onDestroy, onMount } from "svelte"
    import { activeEdit, activeShow, outputs, scriptureSettings, showsCache, styles, templates } from "../../stores"
    import { clone } from "../helpers/array"
    import { mergeWithTemplate, percentageStylePos } from "../helpers/output"
    import { getLayoutRef } from "../helpers/show"
    import Textbox from "../slide/Textbox.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import { escolherModeloDaBiblia, FONTES, lerPadrao, modelosDaBiblia, musicasUsamPadrao, temPadraoDeFabrica } from "../../utils/projetoLivePadroes"
    import type { SaidaPadrao, TipoPadrao, ValoresPadrao } from "../../utils/projetoLivePadroes"
    import { alcanceExistente, apagarExcecao, caixaDe, desfazer, existeExcecao, H, lugarRapido, modeloQueVale, moverCaixa, mudar, mudarDentro, podeDesfazer, ultimoVersiculo, voltarModeloDeFabrica, voltarPara, W } from "../../utils/projetoLiveEditor"
    import type { Alcance, Caixa, Contexto } from "../../utils/projetoLiveEditor"
    import { plEditorCompleto } from "../../utils/projetoLiveLayout"

    // ---------------------------------------------------------------- o que está aberto

    $: showId = $activeShow?.id || $activeEdit.showId || ""
    $: show = $showsCache[showId]
    $: ehBiblia = show?.reference?.type === "scripture"
    $: layoutRef = show ? getLayoutRef(showId, show) : []
    $: slideRef = $activeEdit.slide != null ? layoutRef[$activeEdit.slide] : null
    $: slideId = slideRef?.id || ""
    $: slide = slideId ? show?.slides?.[slideId] : null
    $: nomeMusica = show?.name || ""

    let tipoEscolhido: TipoPadrao | null = null
    $: if (showId) tipoEscolhido = null // abriu outra coisa: segue o que está aberto
    $: tipo = (tipoEscolhido || (ehBiblia ? "biblia" : "musica")) as TipoPadrao
    let saida: SaidaPadrao = "telao"
    $: temMusica = tipo === "musica" && !!show && !ehBiblia && !!slide

    // ao trocar de slide (ou de orientação), abre já no alcance que ele usa
    let alcance: Alcance = "todas"
    let ultimoLugar = ""
    $: lugarAtual = showId + "|" + slideId + "|" + saida + "|" + tipo
    $: if (lugarAtual !== ultimoLugar) {
        ultimoLugar = lugarAtual
        alcance = temMusica ? alcanceExistente(showId, slideId, saida) : "todas"
    }

    $: bibliaTelao = $scriptureSettings?.template || "scripture"
    $: ctx = { tipo, saida, alcance: temMusica ? alcance : "todas", showId: temMusica ? showId : "", slideId, bibliaTelao, nomeMusica } as Contexto
    $: modeloId = modeloQueVale(ctx.tipo, ctx.saida, ctx.alcance, ctx.showId, ctx.slideId, ctx.bibliaTelao, $templates)
    $: tpl = $templates[modeloId] as any
    $: v = lerPadrao(modeloId, tipo, $templates) as ValoresPadrao | null
    $: temExcecao = existeExcecao(ctx.alcance, ctx.showId, ctx.slideId, saida, $templates)
    $: usando = musicasUsamPadrao({ $outputs, $styles })

    $: listaBiblia = comAtual(modelosDaBiblia($templates), bibliaTelao)
    function comAtual(lista: { id: string; nome: string }[], atual: string) {
        if (!atual || lista.some((m) => m.id === atual) || !$templates[atual]) return lista
        return [...lista, { id: atual, nome: $templates[atual].name || atual }]
    }

    // ---------------------------------------------------------------- prévia com conteúdo de verdade

    const TELA = { telao: { width: 1920, height: 1080 }, vertical: { width: 1920, height: (1920 * 1920) / 1080 } }
    const VERTICAL = { width: 1080, height: 1920 }
    const EXEMPLO_LETRA = "Porque Ele vive, posso crer no amanhã"
    const EXEMPLO_VERSO = { texto: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito", referencia: "João 3:16" }

    function itensDaPrevia(t: any, s: SaidaPadrao, tp: TipoPadrao, sl: any, verso: { texto: string; referencia: string } | null) {
        if (!t) return []
        let itens: any[]
        if (tp === "musica" && sl?.items?.length) {
            itens = mergeWithTemplate(clone(sl.items), clone(t.items || []), true, true, false, t.settings?.mode || "") || []
        } else {
            itens = clone(t.items || [])
            const vv = verso || EXEMPLO_VERSO
            // igual ao telão (scripture.ts): com a referência no modelo, um versículo só vai sem número;
            // sem ela, o número é o do versículo (o fim da referência, "Gênesis 1:2" → 2)
            const temRef = /\{scripture1?_(reference|verse)/.test(JSON.stringify(t.items || []))
            const numero = temRef || $scriptureSettings?.verseNumbers === false ? "" : (vv.texto.match(/^\d+/) || [""])[0] || (vv.referencia.match(/(\d+)\D*$/) || [""])[1] || "16"
            let primeiroTexto = true
            itens.forEach((it: any) => {
                ;(it.lines || []).forEach((l: any) =>
                    (l.text || []).forEach((x: any) => {
                        let val = String(x.value || "")
                        if (tp === "biblia") val = val.replace("{scripture_text}", vv.texto.replace(/^\d+\s*/, "")).replace("{scripture_number}", numero).replace("{scripture_reference}", vv.referencia).replace(/\{scripture_[a-z_]+\}/g, "")
                        else if (primeiroTexto && (it.type || "text") === "text") val = EXEMPLO_LETRA
                        x.value = val
                    })
                )
                if ((it.type || "text") === "text") primeiroTexto = false
            })
        }
        if (s === "vertical") {
            itens.forEach((it: any) => {
                it.style = percentageStylePos(it.style || "", VERTICAL)
                // na prévia em pé o "encolher se não couber" não consegue medir: mostra o tamanho do modelo
                if (it.textFit === "shrinkToFit") delete it.textFit
            })
        }
        return itens
    }
    $: previa = itensDaPrevia(tpl, saida, tipo, temMusica ? slide : null, $ultimoVersiculo)

    // as caixas de texto do modelo (o que se arrasta)
    $: caixas = ((tpl?.items || []) as any[])
        .map((it, indice) => ({ it, indice }))
        .filter((x) => (x.it?.type || "text") === "text")
        .map((x) => ({ indice: x.indice, c: caixaDe(x.it), ref: JSON.stringify(x.it.lines || []).includes("{scripture_reference}") && !JSON.stringify(x.it.lines || []).includes("{scripture_text}") }))
    let selecionada = -1
    $: if (!caixas.some((c) => c.indice === selecionada)) selecionada = caixas.find((c) => !c.ref)?.indice ?? caixas[0]?.indice ?? -1

    // ---------------------------------------------------------------- arrastar

    let quadro: HTMLDivElement
    let arrasto: { modo: "mover" | "tamanho"; px: number; py: number; c: Caixa; indice: number; ctx: Contexto } | null = null
    function inicio(e: PointerEvent, indice: number, c: Caixa, modo: "mover" | "tamanho") {
        e.preventDefault()
        e.stopPropagation()
        selecionada = indice
        arrasto = { modo, px: e.clientX, py: e.clientY, c: { ...c }, indice, ctx: { ...ctx } }
        window.addEventListener("pointermove", mover)
        window.addEventListener("pointerup", fim, { once: true })
    }
    function mover(e: PointerEvent) {
        if (!arrasto || !quadro) return
        const r = quadro.getBoundingClientRect()
        const dx = ((e.clientX - arrasto.px) / r.width) * W
        const dy = ((e.clientY - arrasto.py) / r.height) * H
        const o = arrasto.c
        if (arrasto.modo === "mover") moverCaixa(arrasto.ctx, arrasto.indice, { ...o, left: o.left + dx, top: o.top + dy })
        else moverCaixa(arrasto.ctx, arrasto.indice, { ...o, width: o.width + dx, height: o.height + dy })
    }
    function fim() {
        arrasto = null
        window.removeEventListener("pointermove", mover)
    }

    // Ctrl+Z desfaz o que foi mexido aqui (antes do desfazer do resto do programa)
    function teclas(e: KeyboardEvent) {
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== "z") return
        if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) return
        if (!$podeDesfazer) return
        e.preventDefault()
        e.stopImmediatePropagation()
        desfazer()
    }
    onMount(() => window.addEventListener("keydown", teclas, true))
    onDestroy(() => {
        window.removeEventListener("keydown", teclas, true)
        window.removeEventListener("pointermove", mover)
    })

    // ---------------------------------------------------------------- ajustes

    function trocar(chave: keyof ValoresPadrao, valor: any) {
        mudar(ctx, chave, valor)
    }
    function num(e: Event) {
        return Number((e.currentTarget as HTMLInputElement).value)
    }
    function txt(e: Event) {
        return (e.currentTarget as HTMLInputElement | HTMLSelectElement).value
    }
    $: dentro = (() => {
        const a = String(tpl?.items?.[selecionada]?.align || "")
        return /flex-start/.test(a) ? "cima" : /flex-end/.test(a) ? "baixo" : "meio"
    })()

    let confirmar = false
    function voltarFabrica() {
        if (!confirmar) {
            confirmar = true
            setTimeout(() => (confirmar = false), 4000)
            return
        }
        confirmar = false
        voltarModeloDeFabrica(ctx)
    }

    function abrirModeloCompleto() {
        voltarPara.set(clone($activeEdit))
        activeEdit.set({ type: "template", id: modeloId, items: [] } as any)
    }

    $: aviso =
        ctx.alcance === "slide"
            ? "Mudando só este slide"
            : ctx.alcance === "musica"
              ? "Mudando só esta música"
              : tipo === "biblia"
                ? "Mudando o modelo de toda a Bíblia"
                : "Mudando o modelo de todas as músicas"
    $: avisoTelao = tipo === "musica" && saida === "telao" && !usando
</script>

<div class="unico">
    <div class="topo">
        <div class="chave">
            <button class:ativa={tipo === "musica"} on:click={() => (tipoEscolhido = "musica")}>Músicas</button>
            <button class:ativa={tipo === "biblia"} on:click={() => (tipoEscolhido = "biblia")}>Bíblia</button>
        </div>
        <div class="chave" title={temMusica ? "" : "Abra o slide de uma música para mudar só ela"}>
            <button class:ativa={ctx.alcance === "todas"} on:click={() => (alcance = "todas")}>{tipo === "biblia" ? "Vale para toda a Bíblia" : "Vale para todas"}</button>
            {#if tipo === "musica"}
                <button class:ativa={ctx.alcance === "musica"} disabled={!temMusica} on:click={() => (alcance = "musica")}>Só nesta música</button>
                <button class:ativa={ctx.alcance === "slide"} disabled={!temMusica} on:click={() => (alcance = "slide")}>Só neste slide</button>
            {/if}
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
        <div class="chave">
            <button class:ativa={saida === "telao"} on:click={() => (saida = "telao")}>Horizontal</button>
            <button class:ativa={saida === "vertical"} on:click={() => (saida = "vertical")}>Vertical 9:16</button>
        </div>
    </div>

    <div class="corpo">
        <div class="lado-previa">
            <div class="faixa" class:excecao={ctx.alcance !== "todas"}>
                <span>{aviso} · {saida === "vertical" ? "vertical" : "horizontal"}</span>
                {#if avisoTelao}<small>No telão, cada música ainda usa o visual dela; ao mexer aqui, este passa a valer para todas.</small>{/if}
                {#if !temMusica && tipo === "musica"}<small>Exemplo: abra o slide de uma música para ver a letra dela.</small>{/if}
                {#if tipo === "biblia"}<small>{$ultimoVersiculo ? "Último versículo que foi para a tela" : "Exemplo: mostre um versículo para ver ele aqui"}</small>{/if}
            </div>
            <div class="previa" class:em-pe={saida === "vertical"} bind:this={quadro}>
                {#key modeloId + saida}
                    <Zoomed resolution={TELA[saida]} background="#3a3a3a" style="width: 100%;height: 100%;" hideOverflow let:ratio>
                        {#each previa as item}
                            <!-- ratio: sem ele o "encolher se não couber" mede a miniatura e encolhe a letra (28/11) -->
                            <Textbox {item} {ratio} ref={{ type: "template", id: modeloId }} dynamicValues={false} isTemplatePreview />
                        {/each}
                    </Zoomed>
                {/key}
                {#each caixas as cx (cx.indice)}
                    <div
                        class="caixa"
                        class:sel={cx.indice === selecionada}
                        style="left: {(cx.c.left / W) * 100}%; top: {(cx.c.top / H) * 100}%; width: {(cx.c.width / W) * 100}%; height: {(cx.c.height / H) * 100}%;"
                        title={cx.ref ? "Referência: arraste para mudar de lugar" : "Arraste para mudar de lugar; a alça muda o tamanho"}
                        on:pointerdown={(e) => inicio(e, cx.indice, cx.c, "mover")}
                    >
                        {#if cx.ref}<span class="etiqueta">referência</span>{/if}
                        <span class="alca" on:pointerdown={(e) => inicio(e, cx.indice, cx.c, "tamanho")} />
                    </div>
                {/each}
                {#if selecionada >= 0}
                    <div class="nove" title="Lugares rápidos: empurram a caixa escolhida" on:pointerdown|stopPropagation>
                        {#each [0, 1, 2] as linha}
                            {#each [0, 1, 2] as coluna}
                                <button on:click={() => lugarRapido(ctx, selecionada, coluna, linha)} aria-label="Lugar rápido" />
                            {/each}
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        {#if v}
            <div class="ajustes">
                <h4>Aparência</h4>
                <label>
                    Fonte
                    <select value={v.fonte} on:change={(e) => trocar("fonte", txt(e))}>
                        {#each FONTES as f}
                            <option value={f}>{f || "Padrão"}</option>
                        {/each}
                        {#if v.fonte && !FONTES.includes(v.fonte)}<option value={v.fonte}>{v.fonte}</option>{/if}
                    </select>
                </label>
                {#if !v.automatico}
                    <label>Tamanho <span>{Math.round(v.tamanho)}px</span><input type="range" min="30" max="220" step="1" value={v.tamanho} on:change={(e) => trocar("tamanho", num(e))} /></label>
                {/if}
                <label class="linha"><input type="checkbox" checked={v.automatico} on:change={(e) => trocar("automatico", e.currentTarget.checked)} /> Tamanho automático (enche a caixa)</label>
                <label class="linha">Cor <input type="color" value={v.cor} on:change={(e) => trocar("cor", txt(e))} /></label>

                <span class="rotulo">Fundo atrás do texto</span>
                <div class="chave pequena">
                    {#each [["nada", "Nada"], ["faixa", "Faixa"], ["caixa", "Caixa"]] as [valor, nome]}
                        <button class:ativa={v.fundo === valor} on:click={() => trocar("fundo", valor)}>{nome}</button>
                    {/each}
                </div>
                {#if v.fundo !== "nada"}
                    <label class="linha">Cor do fundo <input type="color" value={v.fundoCor} on:change={(e) => trocar("fundoCor", txt(e))} /></label>
                    <label>Transparência <span>{100 - v.fundoOpacidade}%</span><input type="range" min="0" max="100" step="5" value={100 - v.fundoOpacidade} on:change={(e) => trocar("fundoOpacidade", 100 - num(e))} /></label>
                {/if}

                <details>
                    <summary>Contorno e sombra</summary>
                    <label>Contorno <span>{v.contorno}px</span><input type="range" min="0" max="10" step="1" value={v.contorno} on:change={(e) => trocar("contorno", num(e))} /></label>
                    {#if v.contorno > 0}
                        <label class="linha">Cor do contorno <input type="color" value={v.contornoCor} on:change={(e) => trocar("contornoCor", txt(e))} /></label>
                    {/if}
                    <label>Sombra <span>{v.sombra}%</span><input type="range" min="0" max="100" step="5" value={v.sombra} on:change={(e) => trocar("sombra", num(e))} /></label>
                </details>

                {#if tipo === "biblia"}
                    <details>
                        <summary>Referência</summary>
                        <label class="linha"><input type="checkbox" checked={v.refMostrar} on:change={(e) => trocar("refMostrar", e.currentTarget.checked)} /> Mostrar a referência (ex.: João 3:16)</label>
                        {#if v.refMostrar}
                            <label>Tamanho <span>{Math.round(v.refTamanho)}px</span><input type="range" min="20" max="140" step="1" value={Math.min(140, v.refTamanho)} on:change={(e) => trocar("refTamanho", num(e))} /></label>
                            <div class="chave pequena">
                                <button class:ativa={v.refLugar === "embaixo"} on:click={() => trocar("refLugar", "embaixo")}>Embaixo do texto</button>
                                <button class:ativa={v.refLugar === "emcima"} on:click={() => trocar("refLugar", "emcima")}>Em cima do texto</button>
                            </div>
                            <small class="dica">Se a referência estiver numa caixa própria, dá para arrastar ela na prévia.</small>
                        {/if}
                    </details>
                {/if}

                <details>
                    <summary>Mais opções</summary>
                    <span class="rotulo">Alinhar o texto</span>
                    <div class="chave pequena">
                        {#each [["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]] as [valor, nome]}
                            <button class:ativa={v.alinhamento === valor} on:click={() => trocar("alinhamento", valor)}>{nome}</button>
                        {/each}
                    </div>
                    <span class="rotulo">Texto dentro da caixa</span>
                    <div class="chave pequena">
                        {#each [["cima", "Em cima"], ["meio", "No meio"], ["baixo", "Embaixo"]] as [valor, nome]}
                            <button class:ativa={dentro === valor} on:click={() => mudarDentro(ctx, selecionada, valor === "cima" ? "cima" : valor === "baixo" ? "baixo" : "meio")}>{nome}</button>
                        {/each}
                    </div>
                    <button class="largo" on:click={abrirModeloCompleto}>Todas as opções (linhas, lista, rolagem, especial…)</button>
                    {#if slide}
                        <button class="largo" on:click={() => plEditorCompleto.set(true)}>Editar este slide no editor antigo</button>
                    {/if}
                    {#if ctx.alcance === "todas" && temPadraoDeFabrica(modeloId)}
                        <button class="largo" class:confirmar on:click={voltarFabrica}>{confirmar ? "Clique de novo para confirmar" : "Voltar ao padrão do somun"}</button>
                    {/if}
                </details>

                {#if temExcecao}
                    <button class="largo" on:click={() => apagarExcecao(ctx)}>{ctx.alcance === "slide" ? "Tirar a exceção deste slide" : "Tirar a exceção desta música"}</button>
                {/if}
                {#if $podeDesfazer}<small class="dica">Ctrl+Z desfaz a última mudança.</small>{/if}
            </div>
        {:else}
            <p class="vazio">Este modelo não tem caixa de texto para ajustar.</p>
        {/if}
    </div>
</div>

<style>
    .unico {
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: 100%;
        padding: 12px 16px;
        overflow: auto;
        background-color: var(--primary-darker);
    }
    .topo {
        display: flex;
        align-items: center;
        gap: 10px;
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
    .largo {
        font-family: inherit;
        color: var(--text);
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 5px 12px;
        cursor: pointer;
        white-space: nowrap;
    }
    .chave button:disabled {
        opacity: 0.4;
        cursor: default;
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
    .largo {
        border-color: #3a3a3a;
        text-align: start;
        white-space: normal;
        font-size: 0.85em;
    }
    .largo.confirmar {
        border-color: #e8e8e8;
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
    .rotulo {
        font-size: 0.85em;
        color: #a8a8a8;
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
        gap: 18px;
        align-items: flex-start;
        flex: 1;
        min-height: 0;
    }
    .lado-previa {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
    }
    .faixa {
        align-self: stretch;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 10px;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        background-color: #1c1c1c;
        font-size: 0.85em;
    }
    .faixa.excecao {
        border-color: #a8a8a8;
    }
    .faixa small {
        color: #8c8c8c;
    }
    .previa {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        max-height: 66vh;
        border: 1px solid #3a3a3a;
        border-radius: 6px;
        overflow: hidden;
        user-select: none;
        touch-action: none;
    }
    .previa.em-pe {
        width: auto;
        height: 66vh;
        aspect-ratio: 9 / 16;
    }
    .caixa {
        position: absolute;
        border: 1px dashed rgb(255 255 255 / 0.45);
        cursor: move;
        z-index: 10;
        box-sizing: border-box;
    }
    .caixa.sel {
        border: 2px solid #fff;
        box-shadow: 0 0 0 1px #000;
    }
    .etiqueta {
        position: absolute;
        top: -18px;
        left: 0;
        font-size: 11px;
        color: #fff;
        text-shadow: 0 1px 3px #000;
    }
    .alca {
        position: absolute;
        right: -7px;
        bottom: -7px;
        width: 14px;
        height: 14px;
        background: #fff;
        border: 2px solid #000;
        border-radius: 3px;
        cursor: nwse-resize;
        display: none;
    }
    .caixa.sel .alca {
        display: block;
    }
    .nove {
        position: absolute;
        right: 8px;
        bottom: 8px;
        z-index: 20;
        display: grid;
        grid-template-columns: repeat(3, 14px);
        gap: 3px;
        padding: 5px;
        border-radius: 6px;
        background-color: rgb(20 20 20 / 0.8);
        border: 1px solid #3a3a3a;
    }
    .nove button {
        width: 14px;
        height: 10px;
        padding: 0;
        border: 1px solid #8c8c8c;
        border-radius: 2px;
        background: transparent;
        cursor: pointer;
    }
    .nove button:hover {
        background-color: #f2f2f2;
    }
    .ajustes {
        width: 290px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    h4 {
        font-size: 0.75em;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #a8a8a8;
    }
    details {
        border-top: 1px solid #2a2a2a;
        padding-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    details[open] {
        padding-bottom: 4px;
    }
    details > :global(*:not(summary)) {
        margin-top: 8px;
    }
    summary {
        cursor: pointer;
        font-size: 0.9em;
    }
    .dica,
    .vazio {
        color: #8c8c8c;
        font-size: 0.8em;
    }
</style>
