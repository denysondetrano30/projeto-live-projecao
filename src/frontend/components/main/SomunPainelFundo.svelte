<script lang="ts">
    // Projeto Live (somun tela, 28/11): painel "Fundo" embaixo do TELÃO no Culto (decisão dela). Mexe no fundo
    // que está no ar e muda no telão na hora; cada fundo lembra os últimos ajustes. Só aparece com fundo no ar.
    import { media, outputs } from "../../stores"
    import { ajustesDe, fundoNoTelao, mudarAjuste, mudarAjustes, PALETAS, voltarAjustes } from "../../utils/projetoLiveFundos"
    import type { AjustesFundo } from "../../utils/projetoLiveFundos"
    import { clearBackground } from "../output/clear"
    import { idDoTelao } from "../../utils/projetoLivePadroes"

    // na aba "Fundos" (lado direito) mostra um aviso quando não há fundo no ar
    export let vazio = false

    $: fundo = fundoNoTelao($outputs)
    $: a = fundo ? ajustesDe(fundo.id, $media) : null
    $: ehSomun = fundo?.tipo === "somun"
    // nos vídeos a cor só aparece quando tinge
    $: mostraCores = ehSomun || (a?.tingir || 0) > 0

    // com o vídeo/imagem, só "velocidade" faz sentido no vídeo
    $: ehImagem = !!fundo && !ehSomun && /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(fundo.id)

    function n(e: Event) {
        return Number((e.currentTarget as HTMLInputElement).value)
    }
    function s(e: Event) {
        return (e.currentTarget as HTMLInputElement).value
    }
    function muda(chave: keyof AjustesFundo, valor: any) {
        if (fundo) mudarAjuste(fundo.id, chave, valor)
    }
    function paleta(cores: [string, string]) {
        if (!fundo) return
        mudarAjustes(fundo.id, { cor1: cores[0], cor2: cores[1], ...(ehSomun || (a?.tingir || 0) > 0 ? {} : { tingir: 55 }) })
    }
    const igual = (x: string, y: string) => (x || "").toLowerCase() === (y || "").toLowerCase()
</script>

{#if fundo && a}
    <div class="painel">
        <div class="topo">
            <h4>Fundo</h4>
            <span class="nome" title={fundo.nome}>{fundo.nome}</span>
            <button class="tirar" title="Tirar o fundo do telão" on:click={() => clearBackground(idDoTelao())}>✕</button>
        </div>

        {#if !ehImagem}
            <label>Velocidade <span>{a.velocidade}%</span><input type="range" min={ehSomun ? 0 : 10} max="250" step="5" value={a.velocidade} on:input={(e) => muda("velocidade", n(e))} /></label>
        {/if}
        <label>Intensidade <span>{a.intensidade}%</span><input type="range" min="10" max="160" step="5" value={a.intensidade} on:input={(e) => muda("intensidade", n(e))} /></label>

        {#if !ehSomun}
            <label>Tingir <span>{a.tingir}%</span><input type="range" min="0" max="100" step="5" value={a.tingir} on:input={(e) => muda("tingir", n(e))} /></label>
        {/if}

        <div class="paletas" class:apagado={!mostraCores}>
            {#each PALETAS as p}
                <button class="bola" class:ativa={igual(a.cor1, p.cores[0]) && igual(a.cor2, p.cores[1])} title={p.nome} style="background: linear-gradient(135deg, {p.cores[0]} 50%, {p.cores[1]} 50%);" on:click={() => paleta(p.cores)} />
            {/each}
            <input type="color" title="Cor principal" value={a.cor1} on:input={(e) => muda("cor1", s(e))} />
            <input type="color" title="Cor secundária" value={a.cor2} on:input={(e) => muda("cor2", s(e))} />
        </div>
        <label class:apagado={!mostraCores}>Mistura <span>{a.mistura}%</span><input type="range" min="0" max="100" step="5" value={a.mistura} on:input={(e) => muda("mistura", n(e))} /></label>
        <label>Grão <span>{a.grao}%</span><input type="range" min="0" max="100" step="5" value={a.grao} on:input={(e) => muda("grao", n(e))} /></label>

        <button class="voltar" on:click={() => fundo && voltarAjustes(fundo.id)}>Voltar ao original</button>
    </div>
{:else if vazio}
    <div class="painel">
        <div class="topo"><h4>Fundo</h4></div>
        <p class="aviso">Nenhum fundo no telão. Escolha um ao lado: aqui aparecem cor, velocidade e o resto.</p>
    </div>
{/if}

<style>
    .painel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px 12px;
        flex: 1;
        min-height: 0;
        justify-content: flex-start;
        overflow-y: auto;
        font-size: 0.9em;
    }
    .topo {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    h4 {
        margin: 0;
        font-size: 0.8em;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #a8a8a8;
    }
    .nome {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .tirar {
        border: none;
        background: none;
        color: #8c8c8c;
        cursor: pointer;
        font-size: 1em;
        padding: 2px 6px;
    }
    .tirar:hover {
        color: #f2f2f2;
    }
    label {
        display: grid;
        grid-template-columns: 1fr auto;
        row-gap: 2px;
        color: #a8a8a8;
    }
    label span {
        color: #8c8c8c;
        font-size: 0.9em;
    }
    label input[type="range"] {
        grid-column: 1 / -1;
        width: 100%;
        accent-color: #f2f2f2;
    }
    .paletas {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }
    .bola {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid #3a3a3a;
        cursor: pointer;
        padding: 0;
    }
    .bola.ativa {
        border-color: #f2f2f2;
    }
    .paletas input[type="color"] {
        width: 30px;
        height: 24px;
        padding: 0;
        border: 1px solid #3a3a3a;
        border-radius: 5px;
        background: #232323;
        cursor: pointer;
    }
    .aviso {
        margin: 0;
        color: #8c8c8c;
        line-height: 1.4;
    }
    .apagado {
        opacity: 0.45;
    }
    .voltar {
        align-self: flex-start;
        margin-top: 2px;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid #3a3a3a;
        background: #232323;
        color: #a8a8a8;
        font-family: inherit;
        cursor: pointer;
    }
    .voltar:hover {
        color: #f2f2f2;
    }
</style>
