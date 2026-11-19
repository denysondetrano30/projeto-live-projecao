<script lang="ts">
    // Projeto Live (somun tela, 19/11): controle do temporizador na coluna da direita, sempre à vista
    // quando existe temporizador. Nome (escolher qual), o tempo, −1m −10s ▶/⏸ ■ +10s +1m e
    // "Mostrar no telão ▾" (a setinha escolhe "Meio, grande" ou "Canto, pequeno").
    import { onDestroy } from "svelte"
    import { activeTimers, outputs, outLocked, overlays, special, timers } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import Timer from "../../slide/views/Timer.svelte"
    import { playPauseGlobal, resetTimer } from "../../drawer/timers/timers"
    import { ajustarTempo, contagemNaTela, esconderContagem, mostrarContagem, POSICOES, posicaoContagem, timerDaContagem } from "../../../utils/projetoLiveContagem"
    import type { PosicaoContagem } from "../../../utils/projetoLiveContagem"

    let today = new Date()
    const intervalo = setInterval(() => (today = new Date()), 500)
    onDestroy(() => clearInterval(intervalo))

    $: lista = sortByName(keysToID($timers), "name", true)
    // qual mostrar: o escolhido aqui, senão o que está tocando, senão o primeiro
    $: tocando = $activeTimers.find((a) => !a.showId && $timers[a.id])?.id || ""
    // o que está rodando primeiro; senão o da contagem na tela; senão o último escolhido
    $: daTela = contagemNaTela($outputs) ? timerDaContagem($overlays) : ""
    $: escolhido = $special.plTimerEscolhido && $timers[$special.plTimerEscolhido] && ($activeTimers.some((t) => t.id === $special.plTimerEscolhido) || $special.plTimerEscolhido === daTela) ? $special.plTimerEscolhido : tocando || ($timers[daTela] ? daTela : "") || lista[0]?.id || ""
    $: timer = $timers[escolhido]
    $: ativo = $activeTimers.find((a) => a.id === escolhido && !a.showId)
    $: tocandoAgora = !!ativo && ativo.paused !== true
    $: ehContador = timer?.type === "counter"
    $: naTela = contagemNaTela($outputs) && timerDaContagem($overlays) === escolhido
    $: posicao = posicaoContagem($special)

    function escolher(e: Event) {
        const id = (e.target as HTMLSelectElement).value
        special.update((s) => ({ ...s, plTimerEscolhido: id }))
    }

    let menuAberto = false
    function alternarTela() {
        if ($outLocked) return
        if (naTela) esconderContagem()
        else mostrarContagem(escolhido)
    }
    function escolherPosicao(p: PosicaoContagem) {
        menuAberto = false
        if ($outLocked) return
        mostrarContagem(escolhido, p)
    }
</script>

{#if timer}
    <div class="tempo">
        <div class="linha">
            {#if lista.length > 1}
                <select class="nome" value={escolhido} on:change={escolher} data-title="Escolher o temporizador">
                    {#each lista as t}
                        <option value={t.id}>{t.name || "Sem nome"}</option>
                    {/each}
                </select>
            {:else}
                <span class="nome">{timer.name || "Sem nome"}</span>
            {/if}
            <span class="relogio" class:parado={!tocandoAgora}><Timer id={escolhido} {today} /></span>
        </div>

        {#if ehContador}
            <div class="linha botoes">
                <button data-title="Tirar 1 minuto" on:click={() => ajustarTempo(escolhido, -60)}>−1m</button>
                <button data-title="Tirar 10 segundos" on:click={() => ajustarTempo(escolhido, -10)}>−10s</button>
                <button class="icone" data-title={tocandoAgora ? "Pausar" : "Começar"} on:click={() => playPauseGlobal(escolhido, timer)}><Icon id={tocandoAgora ? "pause" : "play"} white size={1.1} /></button>
                <button class="icone" disabled={!ativo} data-title="Parar (volta ao começo)" on:click={() => resetTimer(escolhido)}><Icon id="stop" white size={1.1} /></button>
                <button data-title="Pôr 10 segundos" on:click={() => ajustarTempo(escolhido, 10)}>+10s</button>
                <button data-title="Pôr 1 minuto" on:click={() => ajustarTempo(escolhido, 60)}>+1m</button>
            </div>
        {/if}

        <div class="linha mostrar">
            <button class="tela" class:noAr={naTela} disabled={$outLocked} on:click={alternarTela}>{naTela ? "Esconder do telão" : "Mostrar no telão"}</button>
            <span class="posicao">
                <button class="seta" disabled={$outLocked} data-title="Onde aparece: {POSICOES.find((p) => p.id === posicao)?.nome}" on:click={() => (menuAberto = !menuAberto)}>▾</button>
                {#if menuAberto}
                    <div class="menu">
                        {#each POSICOES as p}
                            <button class:ativa={posicao === p.id} on:click={() => escolherPosicao(p.id)}>{p.nome}</button>
                        {/each}
                    </div>
                {/if}
            </span>
        </div>
    </div>
{/if}

<style>
    .tempo {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .linha {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .nome {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: inherit;
        font-size: 0.9em;
        color: var(--text);
        background: transparent;
        border: none;
        padding: 2px 0;
    }
    select.nome {
        cursor: pointer;
    }
    select.nome option {
        background-color: #1c1c1c;
    }
    .relogio {
        font-size: 1.25em;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    .relogio.parado {
        color: #a8a8a8;
    }
    button {
        font-family: inherit;
        color: var(--text);
        background-color: #1c1c1c;
        border: 1px solid #2a2a2a;
        border-radius: 6px;
        cursor: pointer;
        height: 28px;
    }
    button:hover:not(:disabled) {
        background-color: #2a2a2a;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .botoes button {
        flex: 1;
        font-size: 0.82em;
        padding: 0;
    }
    .botoes .icone {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .mostrar .tela {
        flex: 1;
        font-size: 0.88em;
    }
    .mostrar .tela.noAr {
        border-color: #e5483b;
        color: #ffffff;
    }
    .posicao {
        position: relative;
    }
    .seta {
        width: 30px;
    }
    .menu {
        position: absolute;
        bottom: 32px;
        inset-inline-end: 0;
        display: flex;
        flex-direction: column;
        min-width: 150px;
        padding: 4px;
        border-radius: 8px;
        border: 1px solid #3a3a3a;
        background-color: #1c1c1c;
        box-shadow: 0 6px 20px rgb(0 0 0 / 0.5);
        z-index: 20;
    }
    .menu button {
        border: 1px solid transparent;
        background: transparent;
        text-align: start;
        padding: 0 8px;
    }
    .menu button.ativa {
        border-color: #a8a8a8;
    }
</style>
