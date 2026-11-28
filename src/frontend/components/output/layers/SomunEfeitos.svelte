<script lang="ts">
    // Projeto Live (somun tela, 28/11): os controles do painel "Fundo" por cima de um vídeo/imagem de fundo:
    // intensidade (brilho, contraste e cor juntos; 100% = o arquivo como é), tingir com as duas cores e grão.
    // A velocidade vai direto no vídeo (BackgroundMedia). Limite honesto: a cor do vídeo já vem pronta, dá
    // para tingir tudo, não dá para recolorir um elemento só.
    import type { AjustesFundo } from "../../../utils/projetoLiveFundos"

    export let ajustes: AjustesFundo

    $: it = (ajustes.intensidade ?? 100) / 100
    $: filtro = it === 1 ? "" : `filter: brightness(${0.45 + 0.55 * it}) contrast(${0.7 + 0.3 * it}) saturate(${0.4 + 0.6 * it});`
    $: tinta = (ajustes.tingir || 0) / 100
    $: grao = (ajustes.grao || 0) / 100
    $: mi = (ajustes.mistura ?? 70) / 100

    // ladrilho de ruído (feito uma vez, para todas as saídas)
    const ruido = (() => {
        try {
            const c = document.createElement("canvas")
            c.width = c.height = 160
            const nc = c.getContext("2d")
            if (!nc) return ""
            const d = nc.createImageData(160, 160)
            for (let i = 0; i < d.data.length; i += 4) {
                const v = (200 + Math.random() * 55) | 0
                d.data[i] = d.data[i + 1] = d.data[i + 2] = v
                d.data[i + 3] = 255
            }
            nc.putImageData(d, 0, 0)
            return c.toDataURL()
        } catch {
            return ""
        }
    })()
</script>

<div class="efeito" style={filtro}>
    <slot />
</div>
{#if tinta > 0}
    <!-- a "Mistura" puxa a segunda cor para dentro do degradê -->
    <div class="tinta" style="opacity: {tinta};background: linear-gradient(135deg, {ajustes.cor1} {Math.round((1 - mi) * 50)}%, {ajustes.cor2} {Math.round(100 - (1 - mi) * 50)}%);" />
{/if}
{#if grao > 0 && ruido}
    <div class="grao" style="opacity: {grao * 0.5};background-image: url({ruido});" />
{/if}

<style>
    .efeito,
    .tinta,
    .grao {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }
    .tinta {
        mix-blend-mode: color;
        pointer-events: none;
    }
    .grao {
        mix-blend-mode: overlay;
        background-repeat: repeat;
        pointer-events: none;
        animation: tremer 0.5s steps(6) infinite;
    }
    @keyframes tremer {
        0% {
            background-position: 0 0;
        }
        20% {
            background-position: -53px 31px;
        }
        40% {
            background-position: 71px -17px;
        }
        60% {
            background-position: -29px -88px;
        }
        80% {
            background-position: 97px 61px;
        }
        100% {
            background-position: 13px -42px;
        }
    }
</style>
