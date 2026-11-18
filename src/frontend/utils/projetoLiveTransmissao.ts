// Projeto Live: janela "Transmissão" (18/11, pedido da pessoa).
//
// As duas saídas que vão para o OBS (deitada "pl_transmissao" e em pé "pl_transmissao_vertical") saem
// da área de saídas; os ajustes delas ficam numa janela só, lado a lado: letra (mostrar, fonte,
// tamanho, cor, posição), fundo (igual ao telão, cor, imagem, transparente), enquadramento das artes e
// vídeos (mostrar ou não na live).
//
// Decisão: a deitada continua IGUAL AO TELÃO (mesmo estilo da Primária) até a pessoa mexer em algo;
// aí ela ganha estilo próprio ("pl_transmissao_estilo", copiado do estilo do telão) e um botão volta
// a deixá-la igual ao telão. A em pé sempre tem o próprio ("pl_vertical").

import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import { clone } from "../components/helpers/array"
import { outputs, styles, templates } from "../stores"
import { atualizarEspelhoJuncao, SAIDA_TRANSMISSAO } from "./projetoLiveMirror"
import { ESTILO_VERTICAL, garantirEstiloVertical, SAIDA_VERTICAL } from "./projetoLiveVertical"
import { send } from "./request"

export const ESTILO_TRANSMISSAO = "pl_transmissao_estilo"
export const MODELO_TRANSMISSAO = "pl_letra_transmissao"

export type Formato = "h" | "v"
export type Fundo = "telao" | "cor" | "imagem" | "transparente"

export interface Ajustes {
    existe: boolean // a saída está ligada (o OBS pediu)
    proprio: boolean // deitada: já tem ajustes próprios (a em pé sempre tem)
    letra: boolean
    fonte: string
    tamanho: number
    cor: string
    posicao: "meio" | "embaixo"
    fundo: Fundo
    corFundo: string
    imagemFundo: string
    enquadramento: string
    videos: boolean
}

// Posições da caixa da letra: proporção de uma tela 1920x1080 esticada na saída (veja projetoLiveVertical.ts).
const POSICOES: { [f in Formato]: { meio: string; embaixo: string } } = {
    h: { meio: "top:88px;left:50px;height:904px;width:1820px;", embaixo: "top:770px;left:50px;height:280px;width:1820px;" },
    v: { meio: "top:270px;left:96px;width:1728px;height:540px;", embaixo: "top:690px;left:96px;width:1728px;height:330px;" }
}
const TAMANHO_PADRAO: { [f in Formato]: number } = { h: 100, v: 150 }

function saidaId(f: Formato) {
    return f === "h" ? SAIDA_TRANSMISSAO : SAIDA_VERTICAL
}

// estilo do telão (Primária): a primeira saída ligada, que não é das nossas
function estiloDoTelao(): string {
    const lista = Object.entries(get(outputs)).filter(([id, o]) => id !== SAIDA_TRANSMISSAO && id !== SAIDA_VERTICAL && o?.enabled && !o?.stageOutput && !(o as any)?.invisible)
    const telao = lista.find(([, o]) => o.active) || lista[0]
    return telao?.[1]?.style || ""
}

function proprioH() {
    return !!(get(styles)[ESTILO_TRANSMISSAO] as any)
}

export function estiloId(f: Formato): string {
    if (f === "v") return ESTILO_VERTICAL
    return proprioH() ? ESTILO_TRANSMISSAO : estiloDoTelao()
}

// --- ler -----------------------------------------------------------------------------------------

function cssValor(style: string, prop: string): string {
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i").exec(style || "")
    return m ? m[1].trim() : ""
}

function primeiroTexto(templateId: string) {
    const item = get(templates)[templateId || ""]?.items?.find((i: any) => (i?.type || "text") === "text")
    return { item, texto: item?.lines?.[0]?.text?.[0]?.style || "" }
}

export function lerAjustes(f: Formato): Ajustes {
    const id = estiloId(f)
    const s: any = get(styles)[id] || {}
    const { item, texto } = primeiroTexto(s.template)
    const top = Number(cssValor(item?.style || "", "top").replace("px", "")) || 0
    const saida: any = get(outputs)[saidaId(f)]
    return {
        existe: !!saida,
        proprio: f === "v" || proprioH(),
        letra: !Array.isArray(s.layers) || s.layers.includes("slide"),
        fonte: cssValor(texto, "font-family").replace(/["']/g, ""),
        tamanho: Number(cssValor(texto, "font-size").replace("px", "")) || TAMANHO_PADRAO[f],
        cor: cssValor(texto, "color") || "#ffffff",
        posicao: top > 540 ? "embaixo" : "meio",
        fundo: saida?.transparent ? "transparente" : s.plFundo || "telao",
        corFundo: s.background && s.background !== "transparent" ? s.background : "#000000",
        imagemFundo: s.backgroundImage || "",
        enquadramento: s.fit || "contain",
        videos: !s.plSemVideos
    }
}

// --- mudar ---------------------------------------------------------------------------------------

function trocarCss(style: string, prop: string, valor: string) {
    const limpo = (style || "")
        .split(";")
        .filter((p) => p.trim() && p.split(":")[0].trim().toLowerCase() !== prop)
        .join(";")
    return valor ? `${limpo ? limpo + ";" : ""}${prop}: ${valor};` : limpo + (limpo ? ";" : "")
}

// Deitada: ganha estilo próprio, copiado do estilo do telão.
function tornarProprio() {
    if (proprioH()) return
    const base: any = clone(get(styles)[estiloDoTelao()] || {})
    delete base.mascaras
    delete base.mascaraAtiva
    styles.update((a) => {
        a[ESTILO_TRANSMISSAO] = { ...base, name: "Transmissão (OBS)" }
        return a
    })
    atualizarEspelhoJuncao()
}

// Modelo da letra do formato (criado na primeira mudança de letra; o da deitada parte do modelo do
// telão, se ele usar um).
function garantirModelo(f: Formato): string {
    if (f === "v") garantirEstiloVertical()
    const s: any = get(styles)[estiloId(f)] || {}
    if (s.template && get(templates)[s.template] && (f === "v" || s.template === MODELO_TRANSMISSAO)) return s.template
    const id = f === "v" ? s.template || "pl_letra_vertical" : MODELO_TRANSMISSAO
    const deTelao = f === "h" && s.template ? clone(get(templates)[s.template]) : null
    const modelo: any = deTelao
        ? { ...deTelao, name: "Letra da transmissão", isDefault: false }
        : {
              name: f === "h" ? "Letra da transmissão" : "Letra vertical",
              color: null,
              category: "song",
              settings: { resolution: { width: 1920, height: 1080 } },
              items: [{ style: POSICOES[f].meio, align: "", textFit: "shrinkToFit", lines: [{ align: "", text: [{ value: "Letra", style: `font-size: ${TAMANHO_PADRAO[f]}px;` }] }] }]
          }
    templates.update((a) => {
        a[id] = modelo
        return a
    })
    styles.update((a) => {
        const e: any = a[estiloId(f)]
        if (e) {
            e.template = id
            e.templateScripture = id
        }
        return a
    })
    return id
}

function mudarModelo(f: Formato, fn: (item: any) => void) {
    const id = garantirModelo(f)
    templates.update((a) => {
        const t: any = a[id]
        ;(t?.items || []).forEach((item: any) => {
            if ((item?.type || "text") === "text") fn(item)
        })
        return a
    })
}

function mudarTextos(f: Formato, prop: string, valor: string) {
    mudarModelo(f, (item) => {
        ;(item.lines || []).forEach((line: any) => (line.text || []).forEach((t: any) => (t.style = trocarCss(t.style || "", prop, valor))))
    })
}

function mudarEstilo(f: Formato, fn: (s: any) => void) {
    if (f === "h") tornarProprio()
    else garantirEstiloVertical()
    const id = estiloId(f)
    styles.update((a) => {
        if (a[id]) fn(a[id])
        return a
    })
}

function transparente(f: Formato, ligado: boolean) {
    const id = saidaId(f)
    const atual = get(outputs)[id]
    if (!atual || !!atual.transparent === ligado) return
    outputs.update((a) => {
        a[id].transparent = ligado
        return a
    })
    send(OUTPUT, ["CREATE"], { ...get(outputs)[id], id })
}

export function mudar(f: Formato, chave: keyof Ajustes, valor: any) {
    if (chave === "letra") {
        mudarEstilo(f, (s) => (s.layers = valor ? ["background", "slide", "overlays"] : ["background", "overlays"]))
    } else if (chave === "fonte") {
        if (f === "h") tornarProprio()
        mudarTextos(f, "font-family", valor ? `"${valor}"` : "")
    } else if (chave === "tamanho") {
        if (f === "h") tornarProprio()
        mudarTextos(f, "font-size", `${Math.max(10, Number(valor) || TAMANHO_PADRAO[f])}px`)
    } else if (chave === "cor") {
        if (f === "h") tornarProprio()
        mudarTextos(f, "color", valor || "")
    } else if (chave === "posicao") {
        if (f === "h") tornarProprio()
        mudarModelo(f, (item) => (item.style = POSICOES[f][valor === "embaixo" ? "embaixo" : "meio"]))
    } else if (chave === "fundo") {
        const telao: any = get(styles)[estiloDoTelao()] || {}
        mudarEstilo(f, (s) => {
            s.plFundo = valor
            if (valor === "telao") {
                if (f === "h" && telao.background) s.background = telao.background
                else delete s.background
                if (f === "h" && telao.backgroundImage) s.backgroundImage = telao.backgroundImage
                else delete s.backgroundImage
            } else if (valor === "cor") {
                if (!s.background || s.background === "transparent") s.background = "#000000"
                delete s.backgroundImage
            } else if (valor === "transparente") {
                s.background = "transparent"
                delete s.backgroundImage
            }
        })
        transparente(f, valor === "transparente")
    } else if (chave === "corFundo") {
        mudarEstilo(f, (s) => {
            s.plFundo = "cor"
            s.background = valor || "#000000"
        })
    } else if (chave === "imagemFundo") {
        mudarEstilo(f, (s) => {
            s.plFundo = "imagem"
            if (valor) s.backgroundImage = valor
            else delete s.backgroundImage
        })
    } else if (chave === "enquadramento") {
        mudarEstilo(f, (s) => (s.fit = valor))
    } else if (chave === "videos") {
        mudarEstilo(f, (s) => {
            if (valor) delete s.plSemVideos
            else s.plSemVideos = true
        })
    }
}

// Deitada: volta a ser igual ao telão (apaga o estilo próprio).
export function voltarIgualAoTelao() {
    transparente("h", false)
    styles.update((a) => {
        delete a[ESTILO_TRANSMISSAO]
        return a
    })
    templates.update((a) => {
        delete a[MODELO_TRANSMISSAO]
        return a
    })
    atualizarEspelhoJuncao()
}
