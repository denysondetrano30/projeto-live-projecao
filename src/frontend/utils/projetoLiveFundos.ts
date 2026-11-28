// Projeto Live (somun tela, 28/11): fundos do somun.
// Dois fundos desenhados por código ("Raios" e "Névoa", aprovados por ela em 27/11; os outros três ficaram
// para depois) e os mesmos controles por cima dos vídeos/imagens de fundo: velocidade, intensidade, duas
// cores + Mistura, paletas prontas e grão. Nos nossos fundos a cor manda; nos vídeos ela tinge.
// Decisões dela (28/11): painel "Fundo" embaixo do TELÃO no Culto (mexe no que está no ar, muda na hora) e
// cada fundo lembra os últimos ajustes (guardados em media[<fundo>].plFundo, que já vai para as saídas).

import { get } from "svelte/store"
import { media, outputs, special } from "../stores"
import { idDoTelao } from "./projetoLivePadroes"

export const PREFIXO = "somun:"

export const FUNDOS = [
    { id: "somun:raios", nome: "Raios", estilo: "raios" },
    { id: "somun:nevoa", nome: "Névoa", estilo: "nevoa" }
] as const

export const PALETAS: { nome: string; cores: [string, string] }[] = [
    { nome: "roxo + vermelho", cores: ["#4B2AA8", "#E5483B"] },
    { nome: "azul + verde-água", cores: ["#0B3B6F", "#12A5A0"] },
    { nome: "vinho + dourado", cores: ["#6B1030", "#E8A33D"] },
    { nome: "noite", cores: ["#101828", "#3C6FD1"] },
    { nome: "cinza", cores: ["#1A1A1A", "#8C8C8C"] }
]

export interface AjustesFundo {
    cor1: string
    cor2: string
    mistura: number // 0-100
    velocidade: number // 0-250 (%)
    intensidade: number // 10-160 (%)
    grao: number // 0-100
    tingir: number // 0-100, só nos vídeos/imagens
}

export const PADRAO_SOMUN: AjustesFundo = { cor1: "#4B2AA8", cor2: "#E5483B", mistura: 70, velocidade: 100, intensidade: 85, grao: 22, tingir: 0 }
// nos vídeos tudo começa "sem mexer": o vídeo aparece igual ao arquivo até alguém mexer
export const PADRAO_VIDEO: AjustesFundo = { cor1: "#4B2AA8", cor2: "#E5483B", mistura: 70, velocidade: 100, intensidade: 100, grao: 0, tingir: 0 }

export function ehFundoSomun(id: string | undefined) {
    return !!id && id.startsWith(PREFIXO)
}

export function estiloDe(id: string) {
    return FUNDOS.find((f) => f.id === id)?.estilo || "raios"
}

export function ajustesDe(id: string, todos: any = get(media)): AjustesFundo {
    const padrao = ehFundoSomun(id) ? PADRAO_SOMUN : PADRAO_VIDEO
    return { ...padrao, ...(todos?.[id]?.plFundo || {}) }
}

// vídeo/imagem com algum ajuste do somun (para o desenho sair na própria página e não pelo atalho)
export function temAjusteDeVideo(id: string, todos: any = get(media)) {
    const a = todos?.[id]?.plFundo
    if (!a) return false
    return (a.tingir || 0) > 0 || (a.grao || 0) > 0 || (a.intensidade ?? 100) !== 100 || (a.velocidade ?? 100) !== 100
}

export function mudarAjuste(id: string, chave: keyof AjustesFundo, valor: any) {
    if (!id) return
    media.update((a) => {
        const atual = a[id] || ({} as any)
        a[id] = { ...atual, plFundo: { ...ajustesDe(id, a), [chave]: valor } } as any
        return a
    })
}

export function mudarAjustes(id: string, valores: Partial<AjustesFundo>) {
    if (!id) return
    media.update((a) => {
        const atual = a[id] || ({} as any)
        a[id] = { ...atual, plFundo: { ...ajustesDe(id, a), ...valores } } as any
        return a
    })
}

export function voltarAjustes(id: string) {
    if (!id) return
    media.update((a) => {
        if (a[id]) {
            const atual: any = { ...a[id] }
            delete atual.plFundo
            a[id] = atual
        }
        return a
    })
}

// 28/11 (decisão dela): o que entra pela aba "Fundos" é fundo (repete, mudo, atrás da letra, a letra nunca
// fecha); o que entra pela "Mídia" é para assistir (toca uma vez e some). O fundo vai marcado com plFundo.
export function ehFundoNoAr(bg: any) {
    return !!bg && (bg.plFundo === true || bg.type === "somun" || ehFundoSomun(bg.id))
}

// a lista "Seus fundos" (vídeos e imagens que ela pôs na aba Fundos), guardada em special.plFundos
export type MeuFundo = { path: string; name: string }
export function meusFundos(s: any = get(special)): MeuFundo[] {
    return Array.isArray(s?.plFundos) ? s.plFundos : []
}
export function ehMeuFundo(path: string, s: any = get(special)) {
    return !!path && meusFundos(s).some((f) => f.path === path)
}
export function adicionarMeusFundos(caminhos: string[]) {
    const novos = caminhos.filter(Boolean)
    if (!novos.length) return
    special.update((a) => {
        const lista: MeuFundo[] = Array.isArray(a.plFundos) ? [...a.plFundos] : []
        novos.forEach((path) => {
            if (lista.some((f) => f.path === path)) return
            const name = String(path).split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || path
            lista.push({ path, name })
        })
        a.plFundos = lista
        return a
    })
}
export function tirarMeuFundo(path: string) {
    special.update((a) => {
        a.plFundos = (Array.isArray(a.plFundos) ? a.plFundos : []).filter((f: MeuFundo) => f.path !== path)
        return a
    })
}

// o fundo que está no ar no telão (id/caminho, nome e tipo); só o que entrou como fundo
export function fundoNoTelao(todas: any = get(outputs)): { id: string; nome: string; tipo: string } | null {
    const o = todas?.[idDoTelao()]
    const bg = o?.out?.background
    const id = bg?.path || bg?.id || ""
    if (!id || !ehFundoNoAr(bg)) return null
    const tipo = bg.type || ""
    // câmera, tela, NDI e afins não têm esses controles
    if (tipo && !["media", "video", "image", "somun"].includes(tipo)) return null
    const nome = bg.name || FUNDOS.find((f) => f.id === id)?.nome || String(id).split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || ""
    return { id, nome, tipo: ehFundoSomun(id) ? "somun" : tipo || "media" }
}

// ---------------------------------------------------------------- cor (das duas cores e da mistura)

type HSL = { h: number; s: number; l: number }

export function hexParaHsl(hx: string): HSL {
    const v = /^#?([0-9a-f]{6})$/i.exec(hx || "")?.[1] || "000000"
    const r = parseInt(v.slice(0, 2), 16) / 255
    const g = parseInt(v.slice(2, 4), 16) / 255
    const b = parseInt(v.slice(4, 6), 16) / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const d = mx - mn
    let h = 0
    let s = 0
    const l = (mx + mn) / 2
    if (d) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
        h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
        h *= 60
    }
    return { h, s: s * 100, l: l * 100 }
}
