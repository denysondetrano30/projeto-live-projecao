// Projeto Live (somun tela, 28/11): Editor único — o antigo "Padrões" mora dentro do Editor.
// A diferença entre os dois nunca foi o que fazem, e sim o alcance:
//   Vale para todas    = o modelo (o que o Padrões mexia): pl_musica_telao / pl_letra_vertical nas músicas,
//                        o modelo da Bíblia escolhido / pl_biblia_vertical na Bíblia;
//   Só nesta música    = um modelo próprio da música:   pl_ex_<música>_<h|v>
//   Só neste slide     = um modelo próprio do slide:     pl_ex_<música>_<slide>_<h|v>
// As exceções são modelos de verdade (dá para abrir no editor completo) e começam como cópia do que vale
// para elas. Na saída, helpers/output.ts (getStyleTemplate) usa a exceção no lugar do modelo das músicas.
// Horizontal e vertical guardam cada um a sua posição e a sua exceção (decisão dela, 28/11).
// Mexer nas músicas no horizontal liga o padrão no telão sozinho (decisão dela, 28/11: sem caixinha).

import { get, writable } from "svelte/store"
import type { Template } from "../../types/Show"
import { clone } from "../components/helpers/array"
import { outputs, templates } from "../stores"
import { MODELO_MUSICA_TELAO, modeloDe, musicasUsamPadrao, mudarPadrao, px, trocar, usarPadraoNasMusicas, voltarAoPadrao } from "./projetoLivePadroes"
import type { SaidaPadrao, TipoPadrao, ValoresPadrao } from "./projetoLivePadroes"

export type Alcance = "todas" | "musica" | "slide"

export const W = 1920
export const H = 1080
const MARGEM = 60

export function idExcecao(showId: string, slideId: string | null, saida: SaidaPadrao) {
    const o = saida === "vertical" ? "v" : "h"
    return slideId ? `pl_ex_${showId}_${slideId}_${o}` : `pl_ex_${showId}_${o}`
}

// o modelo que vale hoje para este alcance (sem criar nada)
export function modeloQueVale(tipo: TipoPadrao, saida: SaidaPadrao, alcance: Alcance, showId: string, slideId: string, bibliaTelao: string, _atualizar: any = null): string {
    const base = modeloDe(tipo, saida, bibliaTelao)
    if (tipo !== "musica" || !showId || alcance === "todas") return base
    const todos = get(templates)
    const daMusica = idExcecao(showId, null, saida)
    if (alcance === "musica") return todos[daMusica] ? daMusica : base
    const doSlide = idExcecao(showId, slideId, saida)
    return todos[doSlide] ? doSlide : todos[daMusica] ? daMusica : base
}

// o alcance mais específico que já existe (para abrir o slide já mostrando a exceção dele)
export function alcanceExistente(showId: string, slideId: string, saida: SaidaPadrao): Alcance {
    const todos = get(templates)
    if (showId && slideId && todos[idExcecao(showId, slideId, saida)]) return "slide"
    if (showId && todos[idExcecao(showId, null, saida)]) return "musica"
    return "todas"
}

export function existeExcecao(alcance: Alcance, showId: string, slideId: string, saida: SaidaPadrao, _atualizar: any = null) {
    if (alcance === "todas" || !showId) return false
    return !!get(templates)[idExcecao(showId, alcance === "slide" ? slideId : null, saida)]
}

// o modelo que vai ser mexido: cria a exceção (cópia do que vale) na primeira mudança
function alvo(tipo: TipoPadrao, saida: SaidaPadrao, alcance: Alcance, showId: string, slideId: string, bibliaTelao: string, nomeMusica: string): string {
    if (tipo !== "musica" || !showId || alcance === "todas") return modeloDe(tipo, saida, bibliaTelao)
    const id = idExcecao(showId, alcance === "slide" ? slideId : null, saida)
    if (get(templates)[id]) return id
    const origem = alcance === "slide" ? modeloQueVale(tipo, saida, "musica", showId, slideId, bibliaTelao) : modeloDe(tipo, saida, bibliaTelao)
    const copia: any = clone(get(templates)[origem] || {})
    copia.name = (alcance === "slide" ? "Só neste slide · " : "Só nesta música · ") + (nomeMusica || "música") + (saida === "vertical" ? " · vertical" : "")
    copia.settings = { ...(copia.settings || {}), plExcecao: true }
    delete copia.isDefault
    registrar(id, true)
    templates.update((a) => {
        a[id] = copia as Template
        return a
    })
    return id
}

export interface Contexto {
    tipo: TipoPadrao
    saida: SaidaPadrao
    alcance: Alcance
    showId: string
    slideId: string
    bibliaTelao: string
    nomeMusica: string
}

function preparar(c: Contexto): string {
    const id = alvo(c.tipo, c.saida, c.alcance, c.showId, c.slideId, c.bibliaTelao, c.nomeMusica)
    // mexeu nas músicas no telão: o padrão passa a valer (sem caixinha)
    if (c.tipo === "musica" && c.saida === "telao" && !musicasUsamPadrao({ $outputs: get(outputs) })) usarPadraoNasMusicas(true)
    return id
}

// ---------------------------------------------------------------- desfazer (Ctrl+Z)

type Passo = { id: string; antes: Template | null }
const pilha: Passo[] = []
export const podeDesfazer = writable(false)
let agrupar = ""
let agruparAte = 0

// guarda como o modelo estava antes de mexer (arrastar vira um passo só)
function registrar(id: string, criado = false, grupo = "") {
    const agora = Date.now()
    if (grupo && grupo === agrupar && agora < agruparAte) {
        agruparAte = agora + 800
        return
    }
    agrupar = grupo
    agruparAte = agora + 800
    pilha.push({ id, antes: criado ? null : clone(get(templates)[id] || null) })
    if (pilha.length > 60) pilha.shift()
    podeDesfazer.set(true)
}

export function desfazer(): boolean {
    const passo = pilha.pop()
    podeDesfazer.set(pilha.length > 0)
    agrupar = ""
    if (!passo) return false
    templates.update((a) => {
        if (passo.antes) a[passo.id] = passo.antes
        else delete a[passo.id]
        return a
    })
    return true
}

// ---------------------------------------------------------------- mudar

export function mudar(c: Contexto, chave: keyof ValoresPadrao, valor: any) {
    const id = preparar(c)
    registrar(id, false, "v:" + id + ":" + chave)
    mudarPadrao(id, c.tipo, chave, valor)
}

// texto dentro da caixa: em cima, no meio ou embaixo (a caixa fica onde está)
export function mudarDentro(c: Contexto, indice: number, lugar: "cima" | "meio" | "baixo") {
    const id = preparar(c)
    registrar(id)
    templates.update((a) => {
        const item: any = (a[id] as any)?.items?.[indice]
        if (!item) return a
        item.align = trocar(item.align || "", "align-items", lugar === "cima" ? "flex-start" : lugar === "baixo" ? "flex-end" : "center")
        ;(a[id] as any).modified = Date.now()
        return a
    })
}

export type Caixa = { left: number; top: number; width: number; height: number }

export function caixaDe(item: any): Caixa {
    const s = item?.style || ""
    return { left: px(s, "left", 50), top: px(s, "top", 88), width: px(s, "width", 1820), height: px(s, "height", 904) }
}

function gravarCaixa(item: any, c: Caixa) {
    const r = (v: number) => `${Math.round(v * 100) / 100}px`
    let s = item.style || ""
    s = trocar(s, "left", r(c.left))
    s = trocar(s, "top", r(c.top))
    s = trocar(s, "width", r(c.width))
    s = trocar(s, "height", r(c.height))
    item.style = s
}

// arrastar e mudar tamanho na prévia (frações da tela: 0 a 1)
export function moverCaixa(c: Contexto, indice: number, caixa: Caixa) {
    const id = preparar(c)
    registrar(id, false, "caixa:" + id + ":" + indice)
    templates.update((a) => {
        const item: any = (a[id] as any)?.items?.[indice]
        if (!item) return a
        const w = Math.max(80, Math.min(W, caixa.width))
        const h = Math.max(40, Math.min(H, caixa.height))
        gravarCaixa(item, { width: w, height: h, left: Math.max(0, Math.min(W - w, caixa.left)), top: Math.max(0, Math.min(H - h, caixa.top)) })
        ;(a[id] as any).modified = Date.now()
        return a
    })
}

// os nove lugares rápidos: empurram a caixa (não mudam o tamanho)
export function lugarRapido(c: Contexto, indice: number, coluna: number, linha: number) {
    const tpl: any = get(templates)[modeloQueVale(c.tipo, c.saida, c.alcance, c.showId, c.slideId, c.bibliaTelao)]
    const atual = caixaDe(tpl?.items?.[indice])
    const w = Math.min(atual.width, W)
    const h = Math.min(atual.height, H)
    const left = coluna === 0 ? Math.min(MARGEM, W - w) : coluna === 1 ? (W - w) / 2 : Math.max(0, W - MARGEM - w)
    const top = linha === 0 ? Math.min(MARGEM, H - h) : linha === 1 ? (H - h) / 2 : Math.max(0, H - MARGEM - h)
    moverCaixa({ ...c }, indice, { left, top, width: w, height: h })
}

// apaga a exceção: o slide (ou a música) volta a seguir o de cima
export function apagarExcecao(c: Contexto) {
    if (c.alcance === "todas" || !c.showId) return
    const id = idExcecao(c.showId, c.alcance === "slide" ? c.slideId : null, c.saida)
    if (!get(templates)[id]) return
    registrar(id)
    templates.update((a) => {
        delete a[id]
        return a
    })
}

export function voltarModeloDeFabrica(c: Contexto) {
    const id = modeloDe(c.tipo, c.saida, c.bibliaTelao)
    registrar(id)
    voltarAoPadrao(id)
}

export function ehModeloDasMusicas(id: string) {
    return id === MODELO_MUSICA_TELAO
}

// ---------------------------------------------------------------- "Editor completo" de um modelo

// abre o modelo no editor de modelos do FreeShow (todas as opções); "Voltar ao Editor" volta para cá
export const voltarPara = writable<any>(null)

// ---------------------------------------------------------------- versículo de verdade para a prévia

// o último versículo que foi para a tela (a prévia da Bíblia mostra ele; sem nenhum, um exemplo)
export const ultimoVersiculo = writable<{ texto: string; referencia: string } | null>(null)
outputs.subscribe((todas) => {
    Object.values(todas || {}).forEach((o: any) => {
        const slide = o?.out?.slide
        if (slide?.id !== "temp" || !Array.isArray(slide.tempItems)) return
        const textos: string[] = slide.tempItems
            .filter((i: any) => (i?.type || "text") === "text")
            .map((i: any) => (i.lines || []).map((l: any) => (l.text || []).map((t: any) => String(t.value || "")).join("")).join(" "))
            .map((t: string) => t.replace(/\{[^}]*\}/g, "").trim())
            .filter(Boolean)
        if (!textos.length) return
        const referencia = String(slide.customDynamicValues?.scripture_reference || "")
        const texto = textos.sort((a, b) => b.length - a.length)[0].replace(referencia, "").trim()
        if (texto) ultimoVersiculo.set({ texto, referencia })
    })
})
