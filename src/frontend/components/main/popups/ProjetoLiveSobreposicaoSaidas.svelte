<script lang="ts">
    // Projeto Live (somun tela, 19/11): "Ajustar por saída…" (botão direito na sobreposição).
    // Uma prévia por saída (Telão, Transmissão 16:9, Vertical 9:16). Em cada uma: mostrar ou não,
    // posição (cantos/meios/centro), tamanho e margem, ou arrastar na própria prévia.
    import { onDestroy } from "svelte"
    import { overlays, popupData } from "../../../stores"
    import Overlay from "../../output/layers/Overlay.svelte"
    import { ajusteDaSaida, caixaDosItens, MARGEM_PADRAO, POSICOES_PL, SAIDAS_PL } from "../../../utils/projetoLiveSobreposicao"
    import type { AjustePl, SaidaPl } from "../../../utils/projetoLiveSobreposicao"

    const id: string = $popupData?.id || ""
    $: overlay = $overlays[id]
    const transicao: any = { type: "none", duration: 0, easing: "linear" }

    // tamanho das prévias na tela (px): deitadas 300 de largura, a em pé 300 de altura
    function caixaPrevia(s: { largura: number; altura: number }) {
        return s.largura >= s.altura ? { w: 300, h: (300 * s.altura) / s.largura } : { w: (300 * s.largura) / s.altura, h: 300 }
    }

    function salvar(saida: SaidaPl, novo: AjustePl | null) {
        overlays.update((a) => {
            if (!a[id]) return a
            const por = { ...((a[id] as any).plPorSaida || {}) }
            if (novo) por[saida] = novo
            else delete por[saida]
            ;(a[id] as any).plPorSaida = por
            return a
        })
    }

    // ponto de partida quando ainda não há ajuste: o lugar onde ela já está (tamanho igual)
    function base(saida: SaidaPl): AjustePl {
        const atual = ajusteDaSaida(overlay, saida)
        if (atual?.posicao) return { ...atual }
        const c = caixaDosItens(overlay?.items)
        const tamanho = c ? (c.w / 1920) * 100 : 30
        return { mostrar: atual?.mostrar ?? true, posicao: "c", tamanho, margem: MARGEM_PADRAO }
    }

    function mudar(saida: SaidaPl, chave: keyof AjustePl, valor: any) {
        if (chave === "mostrar") {
            const atual = overlay?.plPorSaida?.[saida]
            // ligar de novo sem ter mexido no resto = volta ao padrão
            if (valor && atual && !atual.posicao) return salvar(saida, null)
            return salvar(saida, { ...(atual || {}), mostrar: !!valor })
        }
        salvar(saida, { ...base(saida), [chave]: valor })
    }

    // arrastar na prévia: posição "livre" com o centro onde o mouse está
    let arrastando: { saida: SaidaPl; el: HTMLElement } | null = null
    function moverPara(e: MouseEvent) {
        if (!arrastando) return
        const r = arrastando.el.getBoundingClientRect()
        const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))
        const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))
        salvar(arrastando.saida, { ...base(arrastando.saida), mostrar: true, posicao: "livre", x, y })
    }
    function comecar(e: MouseEvent, saida: SaidaPl) {
        arrastando = { saida, el: e.currentTarget as HTMLElement }
        moverPara(e)
    }
    function parar() {
        arrastando = null
    }
    onDestroy(parar)

    function valorDe(saida: SaidaPl, _o: any) {
        return ajusteDaSaida(overlay, saida)
    }
</script>

<svelte:window on:mousemove={moverPara} on:mouseup={parar} />

{#if !overlay}
    <p class="vazio">Sobreposição não encontrada.</p>
{:else}
    <p class="dica">Arraste na prévia para mudar o lugar. Cada saída tem o seu ajuste; o padrão já deixa uma margem para nada ficar cortado.</p>
    <div class="saidas">
        {#each SAIDAS_PL as s}
            {@const aj = valorDe(s.id, $overlays)}
            {@const prev = caixaPrevia(s)}
            {@const temProprio = !!overlay.plPorSaida?.[s.id]}
            <div class="saida">
                <p class="titulo">{s.nome}{#if !temProprio}<span class="padrao"> · padrão</span>{/if}</p>

                <div class="previa" class:apagada={aj?.mostrar === false} style="width: {prev.w}px;height: {prev.h}px;" role="none" on:mousedown={(e) => comecar(e, s.id)}>
                    <div class="tela" style="width: 1920px;height: {(1920 * s.altura) / s.largura}px;transform: scale({prev.w / 1920});">
                        <Overlay {overlay} {id} outputId="" transition={transicao} plSaida={s.id} plResolucao={{ width: s.largura, height: s.altura }} preview />
                    </div>
                    <i class="seguranca" style="inset: {MARGEM_PADRAO * (Math.min(prev.w, prev.h) / 100)}px;" />
                </div>

                <label class="linha">
                    <input type="checkbox" checked={aj?.mostrar !== false} on:change={(e) => mudar(s.id, "mostrar", e.currentTarget.checked)} />
                    Mostrar nesta saída
                </label>

                <label class="campo">
                    Posição
                    <select value={aj?.posicao || ""} disabled={aj?.mostrar === false} on:change={(e) => mudar(s.id, "posicao", e.currentTarget.value)}>
                        {#if !aj?.posicao}<option value="">Como foi desenhada</option>{/if}
                        {#each POSICOES_PL as p}
                            <option value={p.id}>{p.nome}</option>
                        {/each}
                    </select>
                </label>

                <label class="campo">
                    Tamanho <span>{Math.round(aj?.tamanho ?? base(s.id).tamanho ?? 30)}%</span>
                    <input type="range" min="2" max="100" step="1" value={aj?.tamanho ?? base(s.id).tamanho} disabled={aj?.mostrar === false} on:input={(e) => mudar(s.id, "tamanho", Number(e.currentTarget.value))} />
                </label>

                <label class="campo">
                    Margem <span>{Math.round(aj?.margem ?? MARGEM_PADRAO)}%</span>
                    <input type="range" min="0" max="15" step="0.5" value={aj?.margem ?? MARGEM_PADRAO} disabled={aj?.mostrar === false || aj?.posicao === "livre"} on:input={(e) => mudar(s.id, "margem", Number(e.currentTarget.value))} />
                </label>

                <button class="voltar" disabled={!temProprio} on:click={() => salvar(s.id, null)}>Voltar ao padrão</button>
            </div>
        {/each}
    </div>
{/if}

<style>
    .dica {
        font-size: 0.85em;
        color: #a8a8a8;
        margin-bottom: 14px;
        white-space: normal;
    }
    .vazio {
        padding: 20px;
        opacity: 0.6;
    }
    .saidas {
        display: flex;
        gap: 18px;
        align-items: flex-start;
    }
    .saida {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 300px;
    }
    .titulo {
        font-weight: 600;
    }
    .padrao {
        font-weight: 400;
        color: #8c8c8c;
    }
    .previa {
        position: relative;
        overflow: hidden;
        align-self: center;
        background-color: #000000;
        border: 1px solid #3a3a3a;
        border-radius: 4px;
        cursor: move;
    }
    .previa.apagada {
        opacity: 0.35;
    }
    .tela {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        pointer-events: none;
    }
    /* como no Zoomed.svelte (.slide .item): cada peça fica no lugar dela */
    .tela :global(.item) {
        position: absolute;
    }
    .seguranca {
        position: absolute;
        border: 1px dashed rgb(255 255 255 / 0.25);
        pointer-events: none;
    }
    .linha {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9em;
        cursor: pointer;
    }
    .campo {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.85em;
        color: #a8a8a8;
    }
    .campo span {
        color: var(--text);
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
    .voltar {
        font-family: inherit;
        color: var(--text);
        background-color: #1c1c1c;
        border: 1px solid #2a2a2a;
        border-radius: 6px;
        padding: 6px;
        cursor: pointer;
    }
    .voltar:disabled {
        opacity: 0.4;
        cursor: default;
    }
</style>
