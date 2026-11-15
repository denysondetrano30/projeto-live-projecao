// Projeto Live: mapeamento de projetores (igual à "Advanced Output" do Resolume).
// Cada saída pode mostrar só uma REGIÃO de uma imagem maior (crop de entrada), fundir as bordas
// com a vizinha (fusão com gama) e corrigir a imagem torta arrastando os 4 cantos (corner pin).
// O assistente monta uma grade de projetores (colunas × linhas) com sobreposição e cria um estilo
// com a proporção da imagem inteira, para o conteúdo sair largo.
import { get } from "svelte/store"
import type { Output, PLMapa } from "../../../../types/Output"
import { outputs, styles } from "../../../stores"
import { clone } from "../../helpers/array"

export const CANTOS_ZERO = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
]

export function mapaAtivo(m: PLMapa | undefined | null) {
    if (!m) return false
    const r = m.regiao
    const regiao = !!r && (r.x !== 0 || r.y !== 0 || r.w !== 1 || r.h !== 1)
    const b = m.bordas
    const bordas = !!b && !!(b.esq || b.dir || b.cima || b.baixo)
    const cantos = !!m.cantos?.some((c) => c.x || c.y)
    return regiao || bordas || cantos || !!m.grade
}

// --- fusão com gama -------------------------------------------------------------------------
// t = 0 na beira de fora da sobreposição, 1 na beira de dentro. A curva f soma 1 com a do
// projetor vizinho (f(t) + f(1-t) = 1), e a gama corrige o brilho real do projetor.
function curva(t: number) {
    return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
}
export function gradienteFusao(direcao: string, gama = 2.2) {
    const passos = 16
    const paradas: string[] = []
    for (let i = 0; i <= passos; i++) {
        const t = i / passos
        const luz = Math.pow(curva(t), 1 / (gama || 2.2))
        paradas.push(`rgba(0,0,0,${(1 - luz).toFixed(4)}) ${(t * 100).toFixed(2)}%`)
    }
    return `linear-gradient(${direcao}, ${paradas.join(", ")})`
}

// --- 4 cantos (corner pin) ------------------------------------------------------------------
// Leva o retângulo (0,0)-(W,H) para os 4 pontos (sup. esq., sup. dir., inf. dir., inf. esq.).
export function matrizCantos(W: number, H: number, cantos: { x: number; y: number }[]) {
    if (!cantos?.some((c) => c.x || c.y) || !W || !H) return ""
    const src = [
        [0, 0],
        [W, 0],
        [W, H],
        [0, H]
    ]
    const dst = src.map(([x, y], i) => [x + (cantos[i]?.x || 0) * W, y + (cantos[i]?.y || 0) * H])
    // resolve o sistema 8×8 da homografia
    const A: number[][] = []
    const b: number[] = []
    for (let i = 0; i < 4; i++) {
        const [x, y] = src[i]
        const [u, v] = dst[i]
        A.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
        b.push(u)
        A.push([0, 0, 0, x, y, 1, -x * v, -y * v])
        b.push(v)
    }
    const h = resolver(A, b)
    if (!h) return ""
    const [a, bb, c, d, e, f, g, hh] = h
    const m = [a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1]
    return `matrix3d(${m.map((n) => +n.toFixed(10)).join(",")})`
}
function resolver(A: number[][], b: number[]) {
    const n = b.length
    const M = A.map((linha, i) => [...linha, b[i]])
    for (let col = 0; col < n; col++) {
        let piv = col
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
        if (Math.abs(M[piv][col]) < 1e-12) return null
        ;[M[col], M[piv]] = [M[piv], M[col]]
        for (let r = 0; r < n; r++) {
            if (r === col) continue
            const k = M[r][col] / M[col][col]
            for (let c = col; c <= n; c++) M[r][c] -= k * M[col][c]
        }
    }
    return M.map((linha, i) => linha[n] / linha[i])
}

// --- assistente de junção -------------------------------------------------------------------
export interface Juncao {
    colunas: number
    linhas: number
    sobreH: number // sobreposição em pixels do projetor (entre colunas)
    sobreV: number // entre linhas
    celulas: string[] // id da saída em cada célula, linha por linha
}

export function tamanhoProjetor(lista: Record<string, Output>, ids: string[]) {
    const o = ids.map((id) => lista[id]).find((x) => x?.bounds?.width)
    return { pw: o?.bounds?.width || 1920, ph: o?.bounds?.height || 1080 }
}

export function calcularJuncao(j: Juncao, pw: number, ph: number) {
    const sh = Math.max(0, Math.min(j.sobreH, pw * 0.9))
    const sv = Math.max(0, Math.min(j.sobreV, ph * 0.9))
    const CW = j.colunas * pw - (j.colunas - 1) * sh
    const CH = j.linhas * ph - (j.linhas - 1) * sv
    const porSaida: Record<string, PLMapa> = {}
    for (let l = 0; l < j.linhas; l++) {
        for (let c = 0; c < j.colunas; c++) {
            const id = j.celulas[l * j.colunas + c]
            if (!id) continue
            porSaida[id] = {
                regiao: { x: (c * (pw - sh)) / CW, y: (l * (ph - sv)) / CH, w: pw / CW, h: ph / CH },
                bordas: { esq: c > 0 ? sh / pw : 0, dir: c < j.colunas - 1 ? sh / pw : 0, cima: l > 0 ? sv / ph : 0, baixo: l < j.linhas - 1 ? sv / ph : 0 },
                gama: 2.2,
                juncao: true
            }
        }
    }
    return { CW: Math.round(CW), CH: Math.round(CH), porSaida }
}

export const ESTILO_JUNCAO = "pl_juncao"

export function aplicarJuncao(j: Juncao) {
    const lista = get(outputs)
    const ids = j.celulas.filter(Boolean)
    if (!ids.length) return
    const { pw, ph } = tamanhoProjetor(lista, ids)
    const { CW, CH, porSaida } = calcularJuncao(j, pw, ph)

    // estilo com a proporção da imagem inteira (copia o estilo que a 1ª saída já usava)
    const base = lista[ids[0]]?.style
    styles.update((a) => {
        const antigo = base && base !== ESTILO_JUNCAO && a[base] ? clone(a[base]) : { name: "" }
        a[ESTILO_JUNCAO] = { ...antigo, name: "Junção de projetores", aspectRatio: { width: CW, height: CH } }
        return a
    })

    outputs.update((a: any) => {
        // tira da junção quem saiu da grade
        Object.keys(a).forEach((id) => {
            if (a[id]?.mapa?.juncao && !porSaida[id]) desfazerSaida(a[id])
        })
        ids.forEach((id) => {
            const o = a[id]
            if (!o) return
            const antes = o.mapa?.juncao ? o.mapa.estiloAntes : o.style || ""
            o.mapa = { ...(o.mapa || {}), ...porSaida[id], estiloAntes: antes }
            o.style = ESTILO_JUNCAO
            // todas as saídas da junção recebem o mesmo conteúdo (no FreeShow, só as "ativas" recebem)
            o.enabled = true
            o.active = true
        })
        return a
    })
    return { CW, CH }
}

function desfazerSaida(o: any) {
    if (!o?.mapa) return
    if (o.mapa.juncao) {
        if (o.mapa.estiloAntes) o.style = o.mapa.estiloAntes
        else delete o.style
    }
    const cantos = o.mapa.cantos
    delete o.mapa
    if (cantos?.some((c: any) => c.x || c.y)) o.mapa = { cantos }
}

export function desfazerJuncao() {
    outputs.update((a: any) => {
        Object.values(a).forEach((o: any) => {
            if (o?.mapa?.juncao) desfazerSaida(o)
        })
        return a
    })
}

export function mudarMapa(outputId: string, f: (m: PLMapa) => void) {
    outputs.update((a: any) => {
        const o = a[outputId]
        if (!o) return a
        if (!o.mapa) o.mapa = {}
        f(o.mapa)
        return a
    })
}
