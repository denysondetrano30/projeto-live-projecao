<script lang="ts">
    // Projeto Live: centro da aba Mapeamento › Projetores (assistente de junção e ajuste dos 4 cantos)
    import { activePage, outputs, settingsTab } from "../../../stores"
    import { aplicarJuncao, calcularJuncao, CANTOS_ZERO, desfazerJuncao, mudarMapa, tamanhoProjetor } from "./mapa"
    import type { Juncao } from "./mapa"
    import { plMascaraUI, saidasDeTela } from "./mascaras"

    $: saidas = saidasDeTela($outputs)
    $: saida = saidas.find((s) => s.id === $plMascaraUI.outputId)
    $: temJuncao = saidas.some((s) => s.o.mapa?.juncao)

    let vista: "juncao" | "cantos" = "juncao"

    // ---- junção ----
    let j: Juncao = { colunas: 2, linhas: 1, sobreH: 200, sobreV: 150, celulas: [] }
    let iniciado = false
    $: if (!iniciado && saidas.length) iniciar()
    function iniciar() {
        iniciado = true
        const naJuncao = saidas.filter((s) => s.o.mapa?.juncao)
        if (naJuncao.length) {
            // reconstrói a grade a partir das regiões salvas
            const xs = [...new Set(naJuncao.map((s) => +(s.o.mapa?.regiao?.x || 0).toFixed(4)))].sort((a, b) => a - b)
            const ys = [...new Set(naJuncao.map((s) => +(s.o.mapa?.regiao?.y || 0).toFixed(4)))].sort((a, b) => a - b)
            const cel: string[] = Array(xs.length * ys.length).fill("")
            naJuncao.forEach((s) => {
                const c = xs.indexOf(+(s.o.mapa?.regiao?.x || 0).toFixed(4))
                const l = ys.indexOf(+(s.o.mapa?.regiao?.y || 0).toFixed(4))
                cel[l * xs.length + c] = s.id
            })
            const { pw, ph } = tamanhoProjetor($outputs, naJuncao.map((s) => s.id))
            const r0 = naJuncao[0].o.mapa?.bordas || {}
            j = { colunas: xs.length, linhas: ys.length, sobreH: Math.round((r0.dir || r0.esq || 0) * pw) || 200, sobreV: Math.round((r0.baixo || r0.cima || 0) * ph) || 150, celulas: cel }
        } else {
            j = { ...j, colunas: Math.min(4, Math.max(1, saidas.length)), celulas: saidas.slice(0, 4).map((s) => s.id) }
        }
    }
    function tamanhoGrade(col: number, lin: number) {
        const n = col * lin
        const cel = [...j.celulas]
        cel.length = n
        j = { ...j, colunas: col, linhas: lin, celulas: Array.from({ length: n }, (_, i) => cel[i] || "") }
    }
    function escolher(i: number, id: string) {
        const cel = j.celulas.map((c, k) => (k === i ? id : c === id && id ? "" : c))
        j = { ...j, celulas: cel }
    }
    $: idsGrade = j.celulas.filter(Boolean)
    $: ({ pw, ph } = tamanhoProjetor($outputs, idsGrade.length ? idsGrade : saidas.map((s) => s.id)))
    $: previa = calcularJuncao(j, pw, ph)
    $: nome = (id: string) => saidas.find((s) => s.id === id)?.nome || "—"
    let aplicado = ""
    function aplicar() {
        const r = aplicarJuncao(j)
        if (r) aplicado = `Junção aplicada: imagem inteira de ${r.CW} × ${r.CH} px.`
    }

    function abrirSaidas() {
        settingsTab.set("display_settings")
        activePage.set("settings")
    }
    $: faltam = j.colunas * j.linhas - saidas.length

    // ---- 4 cantos ----
    $: cantos = saida?.o.mapa?.cantos?.length === 4 ? saida.o.mapa.cantos : CANTOS_ZERO
    $: bw = saida?.o.bounds?.width || 1920
    $: bh = saida?.o.bounds?.height || 1080
    let caixa: HTMLDivElement
    let arrasto: { i: number; px: number; py: number; c: { x: number; y: number } } | null = null
    function inicio(e: PointerEvent, i: number) {
        e.preventDefault()
        arrasto = { i, px: e.clientX, py: e.clientY, c: { ...cantos[i] } }
        window.addEventListener("pointermove", mover)
        window.addEventListener("pointerup", fim, { once: true })
    }
    function mover(e: PointerEvent) {
        if (!arrasto || !caixa || !saida) return
        const r = caixa.getBoundingClientRect()
        const a = arrasto
        const nx = Math.max(-0.5, Math.min(0.5, a.c.x + (e.clientX - a.px) / r.width))
        const ny = Math.max(-0.5, Math.min(0.5, a.c.y + (e.clientY - a.py) / r.height))
        mudarMapa(saida.id, (m) => {
            const c = (m.cantos?.length === 4 ? m.cantos : CANTOS_ZERO).map((k) => ({ ...k }))
            c[a.i] = { x: Math.round(nx * 10000) / 10000, y: Math.round(ny * 10000) / 10000 }
            m.cantos = c
        })
    }
    function fim() {
        arrasto = null
        window.removeEventListener("pointermove", mover)
    }
    function zerarCantos() {
        if (saida) mudarMapa(saida.id, (m) => delete m.cantos)
    }
    // pontos do quadrilátero dentro da caixa (a caixa tem margem de 25% para os cantos poderem sair)
    const M = 0.25
    $: base = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
    ]
    $: pontos = base.map(([x, y], i) => [(M + x + (cantos[i]?.x || 0)) / (1 + 2 * M), (M + y + (cantos[i]?.y || 0)) / (1 + 2 * M)])
    const NOMES_CANTOS = ["Sup. esquerdo", "Sup. direito", "Inf. direito", "Inf. esquerdo"]
</script>

<div class="editor">
    <div class="topo">
        <div class="abas">
            <button class:on={vista === "juncao"} on:click={() => (vista = "juncao")}>Junção de projetores</button>
            <button class:on={vista === "cantos"} on:click={() => (vista = "cantos")}>4 cantos{saida ? ` · ${saida.nome}` : ""}</button>
        </div>
        <span class="espaco" />
        {#if saida}
            <label class="check"><input type="checkbox" checked={!!saida.o.mapa?.grade} on:change={(e) => saida && mudarMapa(saida.id, (m) => (e.currentTarget.checked ? (m.grade = true) : delete m.grade))} /> Grade de teste em {saida.nome}</label>
        {/if}
    </div>

    {#if vista === "juncao"}
        <div class="juncao">
            <div class="controles">
                <label>Colunas <input type="number" min="1" max="6" value={j.colunas} on:change={(e) => tamanhoGrade(Math.max(1, Math.min(6, +e.currentTarget.value || 1)), j.linhas)} /></label>
                <label>Linhas <input type="number" min="1" max="4" value={j.linhas} on:change={(e) => tamanhoGrade(j.colunas, Math.max(1, Math.min(4, +e.currentTarget.value || 1)))} /></label>
                {#if j.colunas > 1}
                    <label>Sobreposição lado a lado (px) <input type="number" min="0" value={j.sobreH} on:change={(e) => (j = { ...j, sobreH: Math.max(0, +e.currentTarget.value || 0) })} /></label>
                {/if}
                {#if j.linhas > 1}
                    <label>Sobreposição em cima/embaixo (px) <input type="number" min="0" value={j.sobreV} on:change={(e) => (j = { ...j, sobreV: Math.max(0, +e.currentTarget.value || 0) })} /></label>
                {/if}
            </div>

            {#if faltam > 0}
                <div class="falta">
                    <span>Cada quadrinho é uma <b>saída</b> da Projeção (não a tela do computador). Para essa grade faltam <b>{faltam}</b> saída{faltam === 1 ? "" : "s"}: crie no <b>+</b> e escolha em qual tela cada uma aparece.</span>
                    <button on:click={abrirSaidas}>Criar saídas</button>
                </div>
            {/if}

            <div class="celulas" style="grid-template-columns: repeat({j.colunas}, minmax(0, 1fr));">
                {#each j.celulas as id, i}
                    <select value={id} on:change={(e) => escolher(i, e.currentTarget.value)}>
                        <option value="">— vazio —</option>
                        {#each saidas as s}
                            <option value={s.id}>{s.nome}</option>
                        {/each}
                    </select>
                {/each}
            </div>

            <div class="area">
                <div class="quadro" style="aspect-ratio: {previa.CW} / {previa.CH};">
                    {#each Object.entries(previa.porSaida) as [id, m], k}
                        {@const r = m.regiao}
                        {#if r}
                            <div class="regiao" style="left: {r.x * 100}%; top: {r.y * 100}%; width: {r.w * 100}%; height: {r.h * 100}%; --cor: hsl({(k * 67) % 360} 70% 55% / 0.35);">
                                <span>{nome(id)}</span>
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>

            <div class="rodape">
                <span class="muted">Imagem inteira: <b>{previa.CW} × {previa.CH}</b> px · cada projetor {pw} × {ph}. As faixas mais claras são as sobreposições.</span>
                <span class="espaco" />
                {#if temJuncao}<button on:click={() => (desfazerJuncao(), (aplicado = "Junção desfeita: cada saída volta a mostrar a imagem inteira."))}>Desfazer junção</button>{/if}
                <button class="primario" disabled={!idsGrade.length} on:click={aplicar}>{temJuncao ? "Atualizar junção" : "Aplicar junção"}</button>
            </div>
            {#if aplicado}<p class="ok">{aplicado} Ajuste fino: escolha a saída à esquerda (bordas, gama e 4 cantos).</p>{/if}
        </div>
    {:else if !saida}
        <div class="aviso">Escolha uma saída à esquerda.</div>
    {:else}
        <div class="cantos">
            <p class="muted">Arraste os pontos para os cantos reais da tela/parede. Muda na hora no projetor; ligue a grade de teste para alinhar.</p>
            <div class="area">
                <div class="caixa" bind:this={caixa} style="aspect-ratio: {bw * (1 + 2 * M)} / {bh * (1 + 2 * M)};">
                    <div class="tela" style="left: {(M / (1 + 2 * M)) * 100}%; top: {(M / (1 + 2 * M)) * 100}%; width: {(1 / (1 + 2 * M)) * 100}%; height: {(1 / (1 + 2 * M)) * 100}%;" />
                    <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                        <polygon points={pontos.map((p) => p.join(",")).join(" ")} />
                    </svg>
                    {#each pontos as p, i}
                        <span class="ponto" title={NOMES_CANTOS[i]} style="left: {p[0] * 100}%; top: {p[1] * 100}%;" on:pointerdown={(e) => inicio(e, i)} />
                    {/each}
                </div>
            </div>
            <div class="rodape">
                <span class="muted">Contorno pontilhado = tela do projetor sem ajuste.</span>
                <span class="espaco" />
                <button on:click={zerarCantos}>Zerar cantos</button>
            </div>
        </div>
    {/if}
</div>

<style>
    .editor {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 10px;
        gap: 10px;
        box-sizing: border-box;
    }
    .topo,
    .rodape,
    .controles {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }
    .espaco {
        flex: 1;
    }
    .abas {
        display: flex;
        gap: 4px;
    }
    .abas button.on,
    .primario {
        background: var(--secondary);
        color: var(--secondary-text);
        border-color: var(--secondary);
        font-weight: 600;
    }
    button,
    select,
    input[type="number"] {
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 6px 12px;
        font-family: inherit;
        font-size: 0.9em;
    }
    button {
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .controles label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.8em;
        opacity: 0.9;
    }
    .controles input {
        width: 120px;
    }
    .check {
        display: flex;
        gap: 6px;
        align-items: center;
        font-size: 0.9em;
    }
    .juncao,
    .cantos {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        min-height: 0;
    }
    .celulas {
        display: grid;
        gap: 6px;
    }
    .area {
        flex: 1;
        min-height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        container-type: size;
    }
    .quadro,
    .caixa {
        position: relative;
        max-width: 100%;
        max-height: 100%;
        width: 100cqw;
    }
    @container (min-aspect-ratio: 16/9) {
        .quadro,
        .caixa {
            width: auto;
            height: 100cqh;
        }
    }
    .quadro {
        background: linear-gradient(120deg, #2a2f45, #1a1d2b);
        outline: 1px solid var(--primary-lighter);
    }
    .regiao {
        position: absolute;
        background: var(--cor);
        outline: 2px solid rgb(255 255 255 / 0.7);
        outline-offset: -2px;
        display: flex;
        align-items: center;
        justify-content: center;
        mix-blend-mode: screen;
    }
    .regiao span {
        font-weight: 700;
        text-shadow: 0 1px 3px #000;
    }
    .caixa {
        background: #111;
        border-radius: 4px;
        touch-action: none;
        user-select: none;
    }
    .tela {
        position: absolute;
        border: 2px dashed rgb(255 255 255 / 0.4);
        box-sizing: border-box;
    }
    .caixa svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }
    polygon {
        fill: rgb(120 140 255 / 0.25);
        stroke: var(--secondary);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
    }
    .ponto {
        position: absolute;
        width: 16px;
        height: 16px;
        margin: -8px 0 0 -8px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #000;
        cursor: grab;
    }
    .falta {
        display: flex;
        gap: 10px;
        align-items: center;
        background: rgb(242 184 75 / 0.12);
        border: 1px solid rgb(242 184 75 / 0.5);
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 0.9em;
    }
    .falta span {
        flex: 1;
    }
    .muted {
        opacity: 0.65;
        font-size: 0.85em;
    }
    .ok {
        margin: 0;
        color: #7bd47f;
        font-size: 0.9em;
    }
    .aviso {
        margin: auto;
        opacity: 0.8;
    }
</style>
