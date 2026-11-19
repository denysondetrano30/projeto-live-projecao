// Projeto Live (somun tela, 19/11): "Padrões" da aba Editar — o visual da Bíblia e das músicas sem
// precisar abrir o editor de modelos. Por baixo mexe nos próprios modelos (templates) que já são usados:
//   Bíblia · Telão    = o modelo escolhido aqui ("Bíblia", "Bíblia Lower Third"…); o que vai para a tela
//                       continua sendo o escolhido no painel da Bíblia (decisão dela);
//   Bíblia · Vertical = "Bíblia vertical" (pl_biblia_vertical);
//   Músicas · Telão   = "Músicas no telão" (pl_musica_telao), posto como modelo do estilo do telão quando
//                       ela liga "Usar este padrão em todas as músicas" (vale para todas, por cima do visual
//                       de cada uma; a 16:9 da transmissão acompanha o telão);
//   Músicas · Vertical= "Letra vertical" (pl_letra_vertical).
// "Voltar ao padrão do somun" põe de volta o modelo de fábrica (os que ela montou, createData.ts).

import { get } from "svelte/store"
import type { Template } from "../../types/Show"
import { clone } from "../components/helpers/array"
import { outputs, styles, templates } from "../stores"
import { modeloDeFabrica } from "./createData"
import { MODELO_BIBLIA_VERTICAL, MODELO_LETRA_VERTICAL, modeloBibliaVertical, modeloLetraVertical } from "./projetoLiveModelos"
import { SAIDA_TRANSMISSAO } from "./projetoLiveMirror"
import { SAIDA_VERTICAL } from "./projetoLiveVertical"

export type TipoPadrao = "biblia" | "musica"
export type SaidaPadrao = "telao" | "vertical"

export const MODELO_MUSICA_TELAO = "pl_musica_telao"
export const ESTILO_TELAO = "pl_telao"

export type Fundo = "nada" | "faixa" | "caixa"
export interface ValoresPadrao {
    fonte: string
    tamanho: number
    automatico: boolean
    cor: string
    posicao: "cima" | "meio" | "baixo"
    alinhamento: "left" | "center" | "right"
    refMostrar: boolean
    refTamanho: number
    refLugar: "embaixo" | "emcima"
    fundo: Fundo
    fundoCor: string
    fundoOpacidade: number
    contorno: number
    contornoCor: string
    sombra: number
}

export const FONTES = ["", "Outfit", "CMGSans", "Arial", "Verdana", "Georgia", "Impact"]
const MARGEM = 60

// ---------------------------------------------------------------- qual modelo

export function modelosDaBiblia(_atualizar: any = null): { id: string; nome: string }[] {
    return Object.entries(get(templates))
        .filter(([id, t]: [string, any]) => t?.settings?.mode === "scripture" && !id.startsWith("pl_"))
        .map(([id, t]: [string, any]) => ({ id, nome: t.name || id }))
        .sort((a, b) => (a.id === "scripture" ? -1 : b.id === "scripture" ? 1 : a.nome.localeCompare(b.nome)))
}

function modeloMusicaTelaoInicial(): Template {
    return {
        name: "Músicas no telão",
        color: null,
        category: "song",
        settings: {},
        items: [
            {
                style: "top:88px;left:50px;height:904px;width:1820px;",
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "", text: [{ value: "Letra", style: "font-size: 100px;font-weight: bold;text-shadow: 2px 2px 10px rgb(0 0 0 / 0.6);" }] }]
            }
        ]
    } as any
}

// garante que o modelo existe e devolve o id
export function modeloDe(tipo: TipoPadrao, saida: SaidaPadrao, bibliaTelao: string): string {
    let id = ""
    let novo: (() => Template) | null = null
    if (tipo === "biblia" && saida === "telao") {
        id = bibliaTelao || "scripture"
    } else if (tipo === "biblia") {
        id = MODELO_BIBLIA_VERTICAL
        novo = modeloBibliaVertical
    } else if (saida === "vertical") {
        id = MODELO_LETRA_VERTICAL
        novo = modeloLetraVertical
    } else {
        id = MODELO_MUSICA_TELAO
        novo = modeloMusicaTelaoInicial
    }
    if (!get(templates)[id]) {
        const t = novo ? novo() : modeloDeFabrica(id)
        if (t) {
            templates.update((a) => {
                a[id] = t
                return a
            })
        }
    }
    return id
}

// ---------------------------------------------------------------- estilo do telão (músicas)

export function idDoTelao(): string {
    const lista = Object.entries(get(outputs)).filter(([id, o]: [string, any]) => id !== SAIDA_TRANSMISSAO && id !== SAIDA_VERTICAL && o?.enabled && !o?.stageOutput && !o?.invisible)
    return (lista.find(([, o]: [string, any]) => o.active) || lista[0])?.[0] || ""
}

export function musicasUsamPadrao(_atualizar: any = null): boolean {
    const st = get(outputs)[idDoTelao()]?.style || ""
    return !!st && (get(styles)[st] as any)?.template === MODELO_MUSICA_TELAO
}

export function usarPadraoNasMusicas(ligar: boolean) {
    const telao = idDoTelao()
    if (!telao) return
    let estilo = get(outputs)[telao]?.style || ""
    if (ligar) {
        modeloDe("musica", "telao", "")
        // telão sem estilo: ganha um "Telão" vazio (igual a não ter estilo) só para levar o modelo
        if (!estilo || !get(styles)[estilo]) {
            estilo = ESTILO_TELAO
            if (!get(styles)[estilo]) {
                styles.update((a) => {
                    a[estilo] = { name: "Telão" } as any
                    return a
                })
            }
            outputs.update((a) => {
                if (a[telao]) a[telao].style = estilo
                return a
            })
        }
    }
    if (!estilo) return
    styles.update((a) => {
        const e: any = a[estilo]
        if (!e) return a
        if (ligar) e.template = MODELO_MUSICA_TELAO
        else if (e.template === MODELO_MUSICA_TELAO) delete e.template
        return a
    })
}

// ---------------------------------------------------------------- CSS

function css(style: string, prop: string): string {
    const m = new RegExp(`(?:^|;)\\s*${prop.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]*)`, "i").exec(style || "")
    return m ? m[1].trim() : ""
}
function trocar(style: string, prop: string, valor: string): string {
    const re = new RegExp(`(^|;)\\s*${prop.replace(/[-]/g, "\\-")}\\s*:[^;]*;?`, "gi")
    let limpo = (style || "").replace(re, "$1")
    if (limpo && !limpo.trim().endsWith(";")) limpo += ";"
    return valor === "" ? limpo : `${limpo}${prop}:${valor};`
}
function px(style: string, prop: string, padrao: number) {
    const v = parseFloat(css(style, prop))
    return isNaN(v) ? padrao : v
}
function hexDe(cor: string, padrao: string): string {
    if (!cor) return padrao
    if (/^#[0-9a-f]{6}$/i.test(cor)) return cor
    if (/^#[0-9a-f]{3}$/i.test(cor)) return "#" + cor.slice(1).split("").map((c) => c + c).join("")
    const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(cor)
    if (m) return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")
    return padrao
}
function opacidadeDe(cor: string): number {
    const m = /\/\s*([\d.]+)\s*\)|rgba\([^)]*,\s*([\d.]+)\s*\)/i.exec(cor || "")
    const v = m ? Number(m[1] ?? m[2]) : 1
    return Math.round((isNaN(v) ? 1 : v) * 100)
}
function rgb(hex: string, opacidade: number) {
    const h = hexDe(hex, "#000000")
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
    return `rgb(${r} ${g} ${b} / ${Math.round(opacidade) / 100})`
}

// ---------------------------------------------------------------- achar as partes do modelo

type Partes = { texto: any | null; spans: any[]; ref: any | null; refLinha: any | null; refSpans: any[] }

function partes(t: any, tipo: TipoPadrao): Partes {
    const itens: any[] = (t?.items || []).filter((i: any) => (i?.type || "text") === "text")
    const tem = (i: any, chave: string) => JSON.stringify(i?.lines || []).includes(chave)
    const texto = tipo === "biblia" ? itens.find((i) => tem(i, "{scripture_text}")) || null : itens[0] || null
    const spans: any[] = []
    let refLinha: any = null
    const refSpans: any[] = []
    ;(texto?.lines || []).forEach((l: any) => {
        const ehRef = tipo === "biblia" && JSON.stringify(l.text || []).includes("{scripture_reference}") && !JSON.stringify(l.text || []).includes("{scripture_text}")
        if (ehRef) {
            refLinha = l
            refSpans.push(...(l.text || []))
        } else spans.push(...(l.text || []))
    })
    let ref: any = null
    if (tipo === "biblia" && !refLinha) {
        ref = itens.find((i) => i !== texto && tem(i, "{scripture_reference}")) || null
        ;(ref?.lines || []).forEach((l: any) => (l.text || []).forEach((s: any) => String(s.value || "").includes("{scripture_reference}") && refSpans.push(s)))
    }
    return { texto, spans, ref, refLinha, refSpans }
}

// span principal (o maior): o do {scripture_text} na Bíblia, o primeiro nas músicas
function principal(p: Partes): any {
    return p.spans.find((s) => String(s.value || "").includes("{scripture_text}")) || p.spans[0] || null
}

// ---------------------------------------------------------------- ler

export function lerPadrao(id: string, tipo: TipoPadrao, _atualizar: any = null): ValoresPadrao | null {
    const t: any = get(templates)[id]
    if (!t) return null
    const p = partes(t, tipo)
    if (!p.texto) return null
    const s = principal(p)?.style || ""
    const box = p.texto.style || ""
    const top = px(box, "top", 88)
    const h = px(box, "height", 904)
    const centro = top + h / 2
    const alinhaTexto = css(p.texto.lines?.[0]?.align || "", "text-align") as any
    const fundoCor = css(box, "background-color")
    const largura = px(box, "width", 1820)
    const raio = px(box, "border-radius", 0)
    const stroke = css(s, "-webkit-text-stroke")
    const sombra = css(s, "text-shadow")
    const blur = sombra ? parseFloat((sombra.match(/(-?[\d.]+)px/g) || [])[2] || "0") : 0
    const guardada = t.settings?.plRefGuardada
    return {
        fonte: css(s, "font-family").replace(/['"]/g, ""),
        tamanho: px(s, "font-size", 100),
        automatico: p.texto.textFit === "growToFit",
        cor: hexDe(css(s, "color"), "#ffffff"),
        // o lugar do texto dentro da caixa (Padrões grava align-items) vale mais que o lugar da caixa
        posicao: /flex-start/.test(p.texto.align || "") ? "cima" : /flex-end/.test(p.texto.align || "") ? "baixo" : /center/.test(p.texto.align || "") && h > 540 ? "meio" : centro < 1080 / 3 ? "cima" : centro > (1080 * 2) / 3 ? "baixo" : "meio",
        alinhamento: alinhaTexto === "left" || alinhaTexto === "right" ? alinhaTexto : "center",
        refMostrar: tipo === "biblia" ? !guardada && (!!p.ref || !!p.refLinha) : false,
        refTamanho: px(p.refSpans[0]?.style || guardada?.tamanho || "", "font-size", 55),
        refLugar: p.ref ? (px(p.ref.style || "", "top", 900) < top ? "emcima" : "embaixo") : p.refLinha && p.texto.lines.indexOf(p.refLinha) === 0 ? "emcima" : "embaixo",
        fundo: !fundoCor || opacidadeDe(fundoCor) === 0 ? "nada" : largura >= 1900 && raio === 0 ? "faixa" : "caixa",
        fundoCor: hexDe(fundoCor, "#000000"),
        fundoOpacidade: fundoCor ? opacidadeDe(fundoCor) : 60,
        contorno: stroke ? parseFloat(stroke) || 0 : 0,
        contornoCor: hexDe(stroke.replace(/^[\d.]+px\s*/, ""), "#000000"),
        sombra: Math.max(0, Math.min(100, Math.round((blur / 20) * 100)))
    }
}

// ---------------------------------------------------------------- mudar

function moverCaixa(item: any, novoTop: number) {
    item.style = trocar(item.style || "", "top", `${Math.round(novoTop * 100) / 100}px`)
}

export function mudarPadrao(id: string, tipo: TipoPadrao, chave: keyof ValoresPadrao, valor: any) {
    templates.update((todos) => {
        const t: any = todos[id]
        if (!t) return todos
        const p = partes(t, tipo)
        if (!p.texto) return todos
        const atual = lerPadrao(id, tipo) as ValoresPadrao
        const todosSpans = [...p.spans]
        const prin = principal(p)

        if (chave === "fonte") [...todosSpans, ...p.refSpans].forEach((s) => (s.style = trocar(s.style || "", "font-family", valor ? `'${valor}'` : "")))
        else if (chave === "cor") todosSpans.forEach((s) => (s.style = trocar(s.style || "", "color", valor)))
        else if (chave === "tamanho" || chave === "automatico") {
            const auto = chave === "automatico" ? !!valor : false
            const tamanho = chave === "tamanho" ? Number(valor) : atual.tamanho
            if (auto) {
                p.texto.textFit = "growToFit"
                p.texto.auto = true
                if (prin) prin.style = trocar(prin.style || "", "font-size", "800px")
            } else {
                p.texto.textFit = "shrinkToFit"
                delete p.texto.auto
                // o número do versículo acompanha (metade do texto)
                todosSpans.forEach((s) => {
                    const ehNumero = String(s.value || "").trim() === "{scripture_number}"
                    s.style = trocar(s.style || "", "font-size", `${Math.round(ehNumero ? tamanho / 2 : tamanho)}px`)
                })
            }
        } else if (chave === "alinhamento") {
            ;(p.texto.lines || []).forEach((l: any) => (l.align = trocar(l.align || "", "text-align", valor)))
        } else if (chave === "posicao") {
            // a caixa vai para cima/meio/baixo (deixando lugar para a referência, se ela é separada)
            // e o texto encosta no mesmo lado dentro da caixa (caixa alta também muda na tela)
            const top = px(p.texto.style, "top", 88)
            const h = Math.min(1080 - 2 * MARGEM, px(p.texto.style, "height", 904))
            const rh = p.ref ? Math.min(300, px(p.ref.style, "height", 120)) : 0
            const refAcima = !!p.ref && px(p.ref.style, "top", 900) < top
            const espacoRef = p.ref ? rh + 10 : 0
            const livre = 1080 - 2 * MARGEM - h - espacoRef
            let novo = valor === "cima" ? MARGEM : valor === "baixo" ? MARGEM + Math.max(0, livre) : MARGEM + Math.max(0, livre) / 2
            if (refAcima) novo += espacoRef
            p.texto.style = trocar(p.texto.style || "", "height", `${h}px`)
            moverCaixa(p.texto, novo)
            p.texto.align = trocar(p.texto.align || "", "align-items", valor === "cima" ? "flex-start" : valor === "baixo" ? "flex-end" : "center")
            if (p.ref) moverCaixa(p.ref, refAcima ? novo - rh - 10 : Math.min(1080 - rh, novo + h + 10))
        } else if (chave === "refMostrar" && tipo === "biblia") {
            if (!valor && (p.ref || p.refLinha)) {
                t.settings = { ...(t.settings || {}), plRefGuardada: p.ref ? { item: clone(p.ref) } : { linha: clone(p.refLinha), indice: p.texto.lines.indexOf(p.refLinha) } }
                if (p.ref) t.items = t.items.filter((i: any) => i !== p.ref)
                else p.texto.lines = p.texto.lines.filter((l: any) => l !== p.refLinha)
            } else if (valor && t.settings?.plRefGuardada) {
                const g = t.settings.plRefGuardada
                if (g.item) t.items = [...t.items, g.item]
                else if (g.linha) p.texto.lines.splice(Math.min(g.indice ?? p.texto.lines.length, p.texto.lines.length), 0, g.linha)
                delete t.settings.plRefGuardada
            }
        } else if (chave === "refTamanho") {
            p.refSpans.forEach((s) => (s.style = trocar(s.style || "", "font-size", `${Math.round(Number(valor))}px`)))
            if (p.ref && p.ref.textFit === "growToFit") {
                p.ref.textFit = "shrinkToFit"
                delete p.ref.auto
            }
        } else if (chave === "refLugar") {
            if (p.ref) {
                const top = px(p.texto.style, "top", 88)
                const h = px(p.texto.style, "height", 904)
                const rh = px(p.ref.style, "height", 120)
                const novo = valor === "emcima" ? Math.max(0, top - rh - 10) : Math.min(1080 - rh, top + h + 10)
                moverCaixa(p.ref, novo)
            } else if (p.refLinha) {
                p.texto.lines = p.texto.lines.filter((l: any) => l !== p.refLinha)
                if (valor === "emcima") p.texto.lines.unshift(p.refLinha)
                else p.texto.lines.push(p.refLinha)
            }
        } else if (chave === "fundo" || chave === "fundoCor" || chave === "fundoOpacidade") {
            const fundo: Fundo = chave === "fundo" ? valor : atual.fundo
            const cor = chave === "fundoCor" ? valor : atual.fundoCor
            const op = chave === "fundoOpacidade" ? Number(valor) : atual.fundoOpacidade || 60
            let box = p.texto.style || ""
            // a faixa ocupa a largura toda; ao sair dela, a caixa volta à largura de antes
            if (fundo === "faixa" && atual.fundo !== "faixa") {
                t.settings = { ...(t.settings || {}), plLarguraAntes: { left: css(box, "left"), width: css(box, "width") } }
                box = trocar(trocar(box, "left", "0px"), "width", "1920px")
            } else if (fundo !== "faixa" && atual.fundo === "faixa" && t.settings?.plLarguraAntes) {
                box = trocar(trocar(box, "left", t.settings.plLarguraAntes.left || "30px"), "width", t.settings.plLarguraAntes.width || "1860px")
                delete t.settings.plLarguraAntes
            }
            box = trocar(box, "background-color", fundo === "nada" ? "" : rgb(cor, op))
            box = trocar(box, "border-radius", fundo === "caixa" ? "20px" : "0px")
            if (fundo !== "nada" && !px(box, "padding", 0)) box = trocar(box, "padding", "25px")
            p.texto.style = box
        } else if (chave === "contorno" || chave === "contornoCor") {
            const largura = chave === "contorno" ? Number(valor) : atual.contorno
            const cor = chave === "contornoCor" ? valor : atual.contornoCor
            ;[...todosSpans, ...p.refSpans].forEach((s) => (s.style = trocar(s.style || "", "-webkit-text-stroke", largura > 0 ? `${largura}px ${cor}` : "")))
        } else if (chave === "sombra") {
            const v = Number(valor)
            const sombra = v > 0 ? `${Math.round(v / 25) + 1}px ${Math.round(v / 25) + 1}px ${Math.round((v / 100) * 20)}px rgb(0 0 0 / ${Math.round(Math.min(1, 0.3 + v / 140) * 100) / 100})` : "0px 0px 0px #000000"
            ;[...todosSpans, ...p.refSpans].forEach((s) => (s.style = trocar(s.style || "", "text-shadow", sombra)))
        }

        t.modified = Date.now()
        return todos
    })
}

// ---------------------------------------------------------------- voltar ao padrão

export function voltarAoPadrao(id: string) {
    let t: Template | null = null
    if (id === MODELO_BIBLIA_VERTICAL) t = modeloBibliaVertical()
    else if (id === MODELO_LETRA_VERTICAL) t = modeloLetraVertical()
    else if (id === MODELO_MUSICA_TELAO) t = modeloMusicaTelaoInicial()
    else t = modeloDeFabrica(id)
    if (!t) return
    templates.update((a) => {
        a[id] = t as Template
        return a
    })
}

export function temPadraoDeFabrica(id: string) {
    return id === MODELO_BIBLIA_VERTICAL || id === MODELO_LETRA_VERTICAL || id === MODELO_MUSICA_TELAO || !!modeloDeFabrica(id)
}
