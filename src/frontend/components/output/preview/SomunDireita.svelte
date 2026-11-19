<script lang="ts">
    // Projeto Live (somun Telão, 19/11): o que fica embaixo do telão na coluna da direita.
    // Só 2 botões de limpar à vista (letra e tudo); os outros limpar ficam no botão direito da
    // prévia. Controles de vídeo/áudio só quando tem mídia tocando. "Indo para a live": as prévias da
    // transmissão (16:9 e 9:16). Embaixo, o recado do diretor (antes ele flutuava no canto).
    import { activePopup, activeTimers, outLocked, outputs, overlays, overlayTimers, playingAudio, playingMetronome, timers } from "../../../stores"
    import { contagemNaTela, timerDaContagem } from "../../../utils/projetoLiveContagem"
    import ProjetoLiveAoVivo from "../../main/ProjetoLiveAoVivo.svelte"
    import { getExtension, getMediaType } from "../../helpers/media"
    import { isOutCleared } from "../../helpers/output"
    import { clearAll, clearSlide } from "../clear"
    import Audio from "../tools/Audio.svelte"
    import MediaControls from "../tools/MediaControls.svelte"
    import NextTimer from "../tools/NextTimer.svelte"
    import SomunTemporizador from "./SomunTemporizador.svelte"
    import PreviewOutput from "./PreviewOutput.svelte"

    export let currentOutput: any = null
    export let currentBgOutput: any = null
    export let backgroundOutputId = ""
    export let timer: any = null

    $: slideCleared = isOutCleared("slide", $outputs)
    $: audioClearedWithoutMics = !Object.values($playingAudio).filter((a: any) => !a.isMic).length && !$playingMetronome
    $: allCleared = isOutCleared(null, $outputs) && audioClearedWithoutMics

    // vídeo de fundo (imagem parada não precisa de controle)
    $: fundo = currentBgOutput?.out?.background || null
    $: fundoTipo = fundo ? fundo.type || getMediaType(getExtension(fundo.path || fundo.id || "")) : ""
    $: temVideo = !!fundo && (fundoTipo === "video" || fundoTipo === "player" || fundoTipo === "camera" || fundoTipo === "screen" || fundoTipo === "ndi")
    $: temAudio = !!Object.keys($playingAudio).length || !!$playingMetronome

    // somun tela (19/11, pedido dela): a linha do temporizador só aparece quando um está rodando/pausado
    // ou a contagem está no telão (como antes), não fixa
    $: temporizadorNoAr = $activeTimers.some((a) => !a.showId && $timers[a.id]) || (contagemNaTela($outputs) && !!$timers[timerDaContagem($overlays)])
    $: temLive = !!$outputs.pl_transmissao || !!$outputs.pl_transmissao_vertical

    function limparLetra() {
        if ($outLocked) return
        clearSlide()
    }
</script>

<div class="somunDireita">
    <div class="limpar">
        <button disabled={$outLocked || slideCleared} data-title="Tira a letra do telão (os outros limpar estão no botão direito da prévia) [F2]" on:click={limparLetra}>Limpar letra</button>
        <button class="principal" disabled={$outLocked || allCleared} data-title="Limpa tudo do telão [Esc]" on:click={() => clearAll(true)}>Limpar tudo · Esc</button>
    </div>

    {#if temVideo}
        <div class="bloco">
            <MediaControls currentOutput={currentBgOutput} outputId={backgroundOutputId} />
        </div>
    {/if}
    {#if temAudio}
        <div class="bloco">
            <Audio />
        </div>
    {/if}
    {#if timer?.timer && !Object.keys($overlayTimers).length}
        <div class="bloco">
            <NextTimer {currentOutput} {timer} />
        </div>
    {/if}
    <!-- somun tela (19/11): controle do temporizador sempre à vista quando existe temporizador -->
    {#if temporizadorNoAr}
        <div class="bloco">
            <SomunTemporizador />
        </div>
    {/if}

    {#if temLive}
        <div class="live">
            <p class="titulo">Indo para a live</p>
            <div class="previas" role="none" data-title="Abre a janela Transmissão" on:click={() => activePopup.set("projeto_live_transmissao")}>
                {#if $outputs.pl_transmissao}
                    <div class="deitada"><PreviewOutput outputId="pl_transmissao" /></div>
                {/if}
                {#if $outputs.pl_transmissao_vertical}
                    <div class="empe"><PreviewOutput outputId="pl_transmissao_vertical" /></div>
                {/if}
            </div>
        </div>
    {/if}

    <ProjetoLiveAoVivo modo="embutido" />
</div>

<style>
    .somunDireita {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px;
    }
    .limpar {
        display: flex;
        gap: 8px;
    }
    .limpar button {
        flex: 1;
        height: 34px;
        border-radius: 7px;
        border: 1px solid #3a3a3a;
        background-color: #1c1c1c;
        color: var(--text);
        font-family: inherit;
        font-size: 0.9em;
        cursor: pointer;
    }
    .limpar button:hover:not(:disabled) {
        background-color: #232323;
    }
    .limpar button.principal {
        background-color: #ffffff;
        border-color: #ffffff;
        color: #141414;
        font-weight: 600;
    }
    .limpar button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .bloco {
        border: 1px solid #2a2a2a;
        border-radius: 7px;
        overflow: hidden;
    }
    .titulo {
        font-size: 0.75em;
        color: #8c8c8c;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
    }
    .previas {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        cursor: pointer;
    }
    .deitada {
        flex: 1;
        min-width: 0;
        border: 1px solid #2a2a2a;
    }
    .empe {
        width: 22%;
        border: 1px solid #2a2a2a;
    }
</style>
