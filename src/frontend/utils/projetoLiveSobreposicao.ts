// Projeto Live (somun tela, 19/11): sobreposição por saída, como no OBS.
//
// O FreeShow desenha tudo numa tela de 1920 de largura e estica a altura para o formato da saída
// (no vertical 9:16 vira 1920x3413). Uma sobreposição feita no 16:9 (ex.: logo no canto de cima) fica
// esticada e quase sai da tela no vertical. Aqui cada sobreposição pode ter um ajuste por saída —
// Telão, Transmissão 16:9 e Vertical 9:16 — guardado em overlay.plPorSaida[saida]:
//   mostrar (sim/não), posicao (cantos, meios, centro ou "livre" = arrastado), tamanho (% da largura
//   da saída) e margem (% do lado menor). Com ajuste, a sobreposição é desenhada SEM esticar (as
//   proporções dela ficam iguais) e colocada no lugar pedido.
// Sem ajuste: Telão e 16:9 ficam como sempre; no Vertical entra um padrão automático com margem de
// segurança (mesmo canto/lado onde ela está no 16:9, mesmo tamanho relativo, 4% de margem). Coisas de
// tela inteira (moldura, vinheta) continuam esticando, como antes.

import type { Item } from "../../types/Show"

export type SaidaPl = "telao" | "transmissao" | "vertical"
export type PosicaoPl = "tl" | "tc" | "tr" | "ml" | "c" | "mr" | "bl" | "bc" | "br" | "livre"
export type AjustePl = { mostrar?: boolean; posicao?: PosicaoPl; tamanho?: number; margem?: number; x?: number; y?: number }

export const SAIDAS_PL: { id: SaidaPl; nome: string; largura: number; altura: number }[] = [
    { id: "telao", nome: "Telão", largura: 1920, altura: 1080 },
    { id: "transmissao", nome: "Transmissão 16:9", largura: 1920, altura: 1080 },
    { id: "vertical", nome: "Vertical 9:16", largura: 1080, altura: 1920 }
]

export const POSICOES_PL: { id: PosicaoPl; nome: string }[] = [
    { id: "tl", nome: "Canto de cima, esquerda" },
    { id: "tc", nome: "Em cima, no meio" },
    { id: "tr", nome: "Canto de cima, direita" },
    { id: "ml", nome: "Meio, esquerda" },
    { id: "c", nome: "Centro" },
    { id: "mr", nome: "Meio, direita" },
    { id: "bl", nome: "Canto de baixo, esquerda" },
    { id: "bc", nome: "Embaixo, no meio" },
    { id: "br", nome: "Canto de baixo, direita" },
    { id: "livre", nome: "Livre (arrastado)" }
]

export const MARGEM_PADRAO = 4

export function saidaDoOutput(outputId: string): SaidaPl {
    if (outputId === "pl_transmissao_vertical") return "vertical"
    if (outputId === "pl_transmissao") return "transmissao"
    return "telao"
}

type Caixa = { x: number; y: number; w: number; h: number }

function numero(style: string, chave: string, padrao: number) {
    const m = new RegExp("(?:^|;)\\s*" + chave + "\\s*:\\s*(-?[\\d.]+)px", "i").exec(style || "")
    return m ? Number(m[1]) : padrao
}

// caixa que envolve todos os itens (medidas da tela 1920x1080)
export function caixaDosItens(items: Item[] | undefined): Caixa | null {
    if (!items?.length) return null
    let x1 = Infinity
    let y1 = Infinity
    let x2 = -Infinity
    let y2 = -Infinity
    items.forEach((it) => {
        const s = it?.style || ""
        const x = numero(s, "left", 50)
        const y = numero(s, "top", 88)
        const w = numero(s, "width", 1820)
        const h = numero(s, "height", 904)
        x1 = Math.min(x1, x)
        y1 = Math.min(y1, y)
        x2 = Math.max(x2, x + w)
        y2 = Math.max(y2, y + h)
    })
    if (!isFinite(x1) || x2 <= x1 || y2 <= y1) return null
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

function telaInteira(c: Caixa) {
    return c.w >= 1700 && c.h >= 950
}

// padrão automático (só no vertical): mesmo canto/lado, mesmo tamanho relativo, margem de segurança
export function ajustePadrao(items: Item[] | undefined, saida: SaidaPl): AjustePl | null {
    if (saida !== "vertical") return null
    const c = caixaDosItens(items)
    if (!c || telaInteira(c)) return null
    const cx = c.x + c.w / 2
    const cy = c.y + c.h / 2
    const col = cx < 1920 / 3 ? "l" : cx > (1920 * 2) / 3 ? "r" : "c"
    const lin = cy < 1080 / 3 ? "t" : cy > (1080 * 2) / 3 ? "b" : "m"
    const mapa: Record<string, PosicaoPl> = { tl: "tl", tc: "tc", tr: "tr", ml: "ml", mc: "c", mr: "mr", bl: "bl", bc: "bc", br: "br" }
    return { mostrar: true, posicao: mapa[lin + col], tamanho: Math.min(92, (c.w / 1920) * 100), margem: MARGEM_PADRAO }
}

export function ajusteDaSaida(overlay: any, saida: SaidaPl): AjustePl | null {
    const proprio = overlay?.plPorSaida?.[saida]
    if (proprio) return proprio
    return ajustePadrao(overlay?.items, saida)
}

// lugar da sobreposição dentro da tela da saída (W x H na escala do FreeShow: W = 1920)
export function lugarNaSaida(items: Item[] | undefined, ajuste: AjustePl, W: number, H: number) {
    const c = caixaDosItens(items)
    if (!c) return null
    const tamanho = Math.max(2, Math.min(100, ajuste.tamanho ?? (c.w / 1920) * 100))
    const k = ((tamanho / 100) * W) / c.w
    const bw = c.w * k
    const bh = c.h * k
    const m = ((ajuste.margem ?? MARGEM_PADRAO) / 100) * Math.min(W, H)
    const pos = ajuste.posicao || "c"
    let x = 0
    let y = 0
    if (pos === "livre") {
        x = ((ajuste.x ?? 50) / 100) * W - bw / 2
        y = ((ajuste.y ?? 50) / 100) * H - bh / 2
    } else {
        const col = pos === "c" ? "c" : pos[1]
        const lin = pos === "c" ? "m" : pos[0]
        x = col === "l" ? m : col === "r" ? W - m - bw : (W - bw) / 2
        y = lin === "t" ? m : lin === "b" ? H - m - bh : (H - bh) / 2
    }
    return { k, x, y, bw, bh, caixa: c }
}

// estilo da "tela 1920x1080" que leva a sobreposição para o lugar certo, sem esticar
export function estiloDoEmbrulho(items: Item[] | undefined, ajuste: AjustePl | null, W: number, H: number): string {
    // sem posição (ex.: só "mostrar" mudou) = como foi desenhada
    if (!ajuste?.posicao) return ""
    const l = lugarNaSaida(items, ajuste, W, H)
    if (!l) return ""
    const left = l.x - l.caixa.x * l.k
    const top = l.y - l.caixa.y * l.k
    return `position:absolute;left:${left}px;top:${top}px;width:1920px;height:1080px;transform:scale(${l.k});transform-origin:0 0;`
}
