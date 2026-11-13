// Projeto Live: o culto ao vivo com o diretor (bloco 6), pela conta do Projeto Live.
//
// Enquanto o projeto aberto é um culto recebido do Diretor e há conta conectada:
// - "Agora no telão": quando o operador escolhe outro item do projeto, a Projeção conta ao diretor
//   qual item do roteiro está agora (aoVivo/<cultoId>.agora);
// - recados do diretor (para Todos ou para a Projeção) aparecem no canto da tela, com respostas
//   prontas; a resposta volta para o diretor;
// - sugestões de mídia (link do Drive + onde entra): a Projeção baixa sozinha e mostra "Inserir" e
//   "Descartar". Só dá para inserir depois de baixada. O diretor vê o estado (baixando, na fila,
//   inserida, descartada, erro).
// Tudo depende de internet; se ela cair, o culto segue normal na Projeção e isso só volta depois.

import { get, writable } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { activeProject, activeShow, projects, shows } from "../stores"
import { driveIdFrom, ERROR_LABEL, plCultos, type PLDownloadError } from "./projetoLiveCultos"

const POLL_MS = 3000
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|wmv)$/i

export interface PLRecado {
    id: string
    texto: string
    em: string
}

export interface PLSugestao {
    id: string
    titulo: string
    link: string
    posicao: {
        tipo: "depoisAtual" | "depoisItem" | "quandoDer"
        itemId?: string
        titulo?: string
    }
    estado: "baixando" | "na_fila" | "erro"
    path?: string
    motivo?: string
}

export const plLiveRecados = writable<PLRecado[]>([])
export const plLiveSugestoes = writable<PLSugestao[]>([])

let timer: ReturnType<typeof setInterval> | null = null
let liveCulto: string | null = null
let since = ""
let polling = false
const seen = new Set<string>()

// O culto (do Diretor) cujo projeto está aberto agora, ou nada.
function cultoDoProjeto(): string | null {
    const projectId = get(activeProject)
    if (!projectId) return null
    const state = get(plCultos)
    for (const [cultoId, culto] of Object.entries(state.cultos)) {
        if (Object.values(culto.projetos || {}).includes(projectId)) return cultoId
    }
    return null
}

function account() {
    return get(plCultos).account || null
}

export function plLiveStart() {
    if (timer) return
    timer = setInterval(tick, POLL_MS)
    activeShow.subscribe(() => scheduleNow())
    activeProject.subscribe(() => scheduleNow())
}

async function tick() {
    const acc = account()
    const cultoId = acc ? cultoDoProjeto() : null
    if (cultoId !== liveCulto) {
        // Trocou de culto (ou fechou): limpa o canto e começa a ouvir o novo.
        liveCulto = cultoId
        plLiveRecados.set([])
        plLiveSugestoes.set([])
        seen.clear()
        // Recados de antes de abrir não aparecem; sugestões das últimas horas ainda podem entrar.
        since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        startedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        lastNow = ""
        scheduleNow()
    }
    if (!acc || !cultoId || polling) return
    polling = true
    try {
        // Pede com 2 minutos de folga: o relógio do celular e o do computador nunca batem certinho.
        // O que já foi visto é ignorado pelo id.
        const folga = since ? new Date(Date.parse(since) - 2 * 60 * 1000).toISOString() : ""
        const result = await requestMain(Main.PROJETO_LIVE_LIVE_EVENTS, { uid: acc.uid, refreshToken: acc.refreshToken, cultoId, since: folga }, undefined, 25000)
        if (!result?.ok || liveCulto !== cultoId) return
        for (const evento of result.eventos as any[]) {
            if (evento.em > since) since = evento.em
            if (seen.has(evento.id)) continue
            seen.add(evento.id)
            receive(cultoId, evento)
        }
    } finally {
        polling = false
    }
}

let startedAt = ""

function receive(cultoId: string, evento: any) {
    if (evento.de !== "diretor") return
    if (evento.tipo === "recado") {
        if (evento.para !== "todos" && evento.para !== "projecao") return
        if (evento.em < startedAt) return // recado antigo, de antes de abrir o culto
        plLiveRecados.update((list) => [...list, { id: evento.id, texto: evento.texto || "", em: evento.em }].slice(-3))
        return
    }
    if (evento.tipo === "sugestao") {
        // Já resolvida antes (inserida ou descartada noutra hora): não volta.
        if (evento.estado === "inserida" || evento.estado === "descartada") return
        const sugestao: PLSugestao = {
            id: evento.id,
            titulo: evento.titulo || "Mídia do diretor",
            link: evento.link || "",
            posicao: evento.posicao || { tipo: "quandoDer" },
            estado: "baixando"
        }
        plLiveSugestoes.update((list) => [...list, sugestao])
        download(cultoId, sugestao)
    }
}

async function download(cultoId: string, sugestao: PLSugestao) {
    const driveId = driveIdFrom(sugestao.link)
    let error: PLDownloadError | null = null
    let path = ""
    if (!driveId) error = "no_link"
    else {
        patch(cultoId, sugestao.id, { estado: "baixando" })
        const result = await requestMain(Main.PROJETO_LIVE_DRIVE_DOWNLOAD, { cultoId, driveId }, undefined, 2 * 60 * 60 * 1000)
        if (result?.ok) path = result.path
        else error = (result && !result.ok ? result.error : "network") as PLDownloadError
    }
    plLiveSugestoes.update((list) =>
        list.map((s) =>
            s.id === sugestao.id
                ? {
                      ...s,
                      estado: error ? "erro" : "na_fila",
                      path: path || undefined,
                      motivo: error ? ERROR_LABEL[error] : undefined
                  }
                : s
        )
    )
    patch(cultoId, sugestao.id, error ? { estado: "erro", motivo: ERROR_LABEL[error] } : { estado: "na_fila" })
}

function patch(cultoId: string, id: string, fields: any) {
    const acc = account()
    if (!acc) return
    requestMain(Main.PROJETO_LIVE_LIVE_PATCH, { uid: acc.uid, refreshToken: acc.refreshToken, cultoId, id, fields }, undefined, 25000)
}

// Põe a mídia sugerida no projeto, no lugar que o diretor pediu.
export function plLiveInsert(id: string) {
    const sugestao = get(plLiveSugestoes).find((s) => s.id === id)
    const projectId = get(activeProject)
    if (!sugestao?.path || !projectId || !liveCulto) return
    const project = get(projects)[projectId]
    if (!project) return

    const items = project.shows || []
    let at = items.length
    const after = (index: number) => (index >= 0 ? index + 1 : items.length)
    const current = get(activeShow)?.index ?? -1
    if (sugestao.posicao.tipo === "depoisItem" && sugestao.posicao.itemId) at = after(items.findIndex((ref: any) => ref.plItemId === sugestao.posicao.itemId))
    else if (sugestao.posicao.tipo === "depoisAtual" && sugestao.posicao.itemId) {
        const index = items.findIndex((ref: any) => ref.plItemId === sugestao.posicao.itemId)
        at = index >= 0 ? index + 1 : after(current)
    } else at = after(current)

    const ref: any = {
        id: sugestao.path,
        name: sugestao.titulo,
        type: VIDEO_EXT.test(sugestao.path) ? "video" : "image",
        notes: "Sugestão do diretor"
    }
    projects.update((all) => {
        const list = [...(all[projectId].shows || [])]
        list.splice(Math.min(at, list.length), 0, ref)
        all[projectId] = { ...all[projectId], shows: list, modified: Date.now() }
        return all
    })
    plLiveSugestoes.update((list) => list.filter((s) => s.id !== id))
    patch(liveCulto, id, { estado: "inserida" })
}

export function plLiveDiscard(id: string) {
    plLiveSugestoes.update((list) => list.filter((s) => s.id !== id))
    if (liveCulto) patch(liveCulto, id, { estado: "descartada" })
}

export function plLiveDismiss(id: string) {
    plLiveRecados.update((list) => list.filter((r) => r.id !== id))
}

// Resposta da Projeção ao diretor (respostas prontas ou texto).
export async function plLiveReply(recadoId: string | null, texto: string) {
    const acc = account()
    const text = texto.trim()
    if (!acc || !liveCulto || !text) return
    if (recadoId) plLiveDismiss(recadoId)
    await requestMain(
        Main.PROJETO_LIVE_LIVE_ADD,
        {
            uid: acc.uid,
            refreshToken: acc.refreshToken,
            cultoId: liveCulto,
            evento: { tipo: "recado", de: "projecao", para: "diretor", texto: text }
        },
        undefined,
        25000
    )
}

/* ---- "Agora no telão" ---- */

let nowTimer: ReturnType<typeof setTimeout> | null = null
let lastNow = ""

function scheduleNow() {
    if (nowTimer) clearTimeout(nowTimer)
    nowTimer = setTimeout(sendNow, 800)
}

async function sendNow() {
    const acc = account()
    const cultoId = cultoDoProjeto()
    const projectId = get(activeProject)
    const show = get(activeShow)
    if (!acc || !cultoId || !projectId || !show || typeof show.index !== "number") return
    const ref: any = get(projects)[projectId]?.shows?.[show.index]
    if (!ref) return

    const culto = get(plCultos).cultos[cultoId]
    const payload = culto?.emUso !== null && culto?.emUso !== undefined ? culto.versoes[culto.emUso]?.payload : null
    const roteiro = payload ? payload.itens : []
    const position = ref.plItemId ? roteiro.findIndex((item) => item.id === ref.plItemId) : -1
    const titulo = (position >= 0 ? roteiro[position].titulo : "") || ref.name || get(shows)[ref.id]?.name || "Item extra"
    const agora = {
        itemId: ref.plItemId || null,
        indice: position >= 0 ? position + 1 : null,
        titulo
    }

    const key = JSON.stringify([cultoId, agora])
    if (key === lastNow) return
    lastNow = key
    await requestMain(Main.PROJETO_LIVE_LIVE_NOW, { uid: acc.uid, refreshToken: acc.refreshToken, cultoId, agora }, undefined, 25000)
}
