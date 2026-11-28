<script lang="ts">
    // Projeto Live (somun tela, 28/11): fundo desenhado por código ("Raios" e "Névoa"), vindo da página de
    // teste aprovada por ela em 27/11. Nunca repete, não tem arquivo, qualquer resolução e a cor é a que ela
    // escolher. Os ajustes chegam pelo store `media` (media[<id>].plFundo), então mudam no telão na hora.
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { media } from "../../../stores"
    import { ajustesDe, estiloDe, hexParaHsl } from "../../../utils/projetoLiveFundos"

    export let id: string

    const dispatch = createEventDispatcher()

    $: ajustes = ajustesDe(id, $media)
    $: estilo = estiloDe(id)

    let quadro: HTMLDivElement
    let c: HTMLCanvasElement
    let x: CanvasRenderingContext2D | null = null
    let W = 1280
    let H = 720
    let t = Math.random() * 100
    let pedido = 0
    let ultimo = 0

    // ruído do grão (um ladrilho de 160px)
    const ruido = document.createElement("canvas")
    ruido.width = ruido.height = 160
    {
        const nc = ruido.getContext("2d")
        if (nc) {
            const d = nc.createImageData(160, 160)
            for (let i = 0; i < d.data.length; i += 4) {
                const v = (200 + Math.random() * 55) | 0
                d.data[i] = d.data[i + 1] = d.data[i + 2] = v
                d.data[i + 3] = 255
            }
            nc.putImageData(d, 0, 0)
        }
    }

    // o lado maior desenhado com 1280px; o canvas segue a forma da tela (horizontal ou vertical)
    function medir() {
        if (!quadro || !c) return
        const w = quadro.clientWidth || 1920
        const h = quadro.clientHeight || 1080
        const k = 1280 / Math.max(w, h)
        const nw = Math.max(16, Math.round(w * k))
        const nh = Math.max(16, Math.round(h * k))
        if (nw !== W || nh !== H || c.width !== nw) {
            W = c.width = nw
            H = c.height = nh
        }
    }

    let A = hexParaHsl("#4B2AA8")
    let B = hexParaHsl("#E5483B")
    function mix(p: number) {
        const mi = (ajustes.mistura ?? 70) / 100
        p = Math.max(0, Math.min(1, p)) * mi
        const dh = ((B.h - A.h + 540) % 360) - 180
        return { h: A.h + dh * p, s: A.s + (B.s - A.s) * p, l: A.l + (B.l - A.l) * p }
    }
    const hsl = (h: number, s: number, l: number, a: number) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`

    function raios(ctx: CanvasRenderingContext2D, it: number) {
        const cx = W * 0.5 + Math.sin(t * 0.25) * W * 0.12
        const cy = -H * 0.35
        ctx.globalCompositeOperation = "lighter"
        for (let k = 0; k < 9; k++) {
            const ang = 1.57 + (k - 4) * 0.17 + Math.sin(t * 0.4 + k) * 0.05
            const len = Math.max(W, H) * 1.2 + H
            const w = 0.055 + 0.03 * Math.sin(t * 0.9 + k * 1.7)
            const C = mix(k / 8)
            const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len)
            g.addColorStop(0, hsl(C.h, C.s, Math.min(70, C.l + 22), 0.34 * it))
            g.addColorStop(1, hsl(C.h, C.s, C.l, 0))
            ctx.fillStyle = g
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(cx + Math.cos(ang - w) * len, cy + Math.sin(ang - w) * len)
            ctx.lineTo(cx + Math.cos(ang + w) * len, cy + Math.sin(ang + w) * len)
            ctx.closePath()
            ctx.fill()
        }
        const CB = mix(1)
        const gb = ctx.createLinearGradient(0, H, 0, 0)
        gb.addColorStop(0, hsl(CB.h, CB.s, CB.l * 0.8, 0.3 * it))
        gb.addColorStop(1, hsl(CB.h, CB.s, CB.l * 0.8, 0))
        ctx.fillStyle = gb
        ctx.fillRect(0, 0, W, H)
    }

    function nevoa(ctx: CanvasRenderingContext2D, it: number) {
        const N0 = mix(0)
        const N1 = mix(1)
        const g = ctx.createLinearGradient(0, 0, 0, H)
        g.addColorStop(0, hsl(N0.h, N0.s * 0.8, N0.l * 0.4, 1))
        g.addColorStop(1, hsl(N1.h, N1.s * 0.8, N1.l * 0.2, 1))
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
        ctx.globalCompositeOperation = "lighter"
        for (let k = 0; k < 7; k++) {
            const cx = ((t * (0.04 + k * 0.012) * W * 0.5 + k * W * 0.22) % (W * 1.6)) - W * 0.3
            const cy = H * (0.25 + 0.1 * k) + Math.sin(t * 0.5 + k) * H * 0.07
            const rx = W * (0.34 + 0.07 * k)
            const ry = H * (0.1 + 0.03 * k)
            const CN = mix(k / 6)
            const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx)
            gg.addColorStop(0, hsl(CN.h, CN.s * 0.9, Math.min(68, CN.l + 20), 0.16 * it))
            gg.addColorStop(1, hsl(CN.h, CN.s * 0.9, CN.l, 0))
            ctx.save()
            ctx.translate(cx, cy)
            ctx.scale(1, ry / rx)
            ctx.translate(-cx, -cy)
            ctx.fillStyle = gg
            ctx.beginPath()
            ctx.arc(cx, cy, rx, 0, 6.3)
            ctx.fill()
            ctx.restore()
        }
    }

    function desenhar(agora: number) {
        pedido = requestAnimationFrame(desenhar)
        if (!x) return
        // o mesmo andar em qualquer taxa de quadros (a página de teste andava 0,006 por quadro a 60 fps)
        const dt = ultimo ? Math.min(0.1, (agora - ultimo) / 1000) : 1 / 60
        ultimo = agora
        A = hexParaHsl(ajustes.cor1)
        B = hexParaHsl(ajustes.cor2)
        const it = (ajustes.intensidade ?? 85) / 100
        const gq = (ajustes.grao ?? 0) / 100
        t += 0.36 * dt * ((ajustes.velocidade ?? 100) / 100)

        x.globalCompositeOperation = "source-over"
        x.globalAlpha = 1
        x.fillStyle = "#0b0b0b"
        x.fillRect(0, 0, W, H)
        if (estilo === "nevoa") nevoa(x, it)
        else raios(x, it)

        if (gq > 0) {
            x.globalCompositeOperation = "overlay"
            x.globalAlpha = gq * 0.5
            const ox = -Math.random() * 160
            const oy = -Math.random() * 160
            for (let a = ox; a < W; a += 160) for (let b = oy; b < H; b += 160) x.drawImage(ruido, a, b)
            x.globalAlpha = 1
        }
        x.globalCompositeOperation = "source-over"
        const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.55)
        v.addColorStop(0, "rgba(0,0,0,0)")
        v.addColorStop(1, "rgba(0,0,0,.55)")
        x.fillStyle = v
        x.fillRect(0, 0, W, H)
    }

    let observador: ResizeObserver | null = null
    onMount(() => {
        x = c.getContext("2d")
        medir()
        observador = new ResizeObserver(medir)
        observador.observe(quadro)
        pedido = requestAnimationFrame(desenhar)
        dispatch("loaded")
    })
    onDestroy(() => {
        cancelAnimationFrame(pedido)
        observador?.disconnect()
    })
</script>

<div class="fundo" bind:this={quadro}>
    <canvas bind:this={c} width="1280" height="720" />
</div>

<style>
    .fundo {
        position: absolute;
        inset: 0;
        background: #0b0b0b;
        overflow: hidden;
    }
    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>
