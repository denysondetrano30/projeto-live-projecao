// Projeto Live: cultos que chegam do app do Diretor (veja src/electron/projetoLive/cultos.ts).
//
// Caminho de um culto:
// 1. Chega uma versão publicada (por enquanto colando o texto que o app do Diretor copia; com o
//    Firebase, vai chegar sozinha). "Publicado".
// 2. Os vídeos e imagens são baixados do Google Drive para o computador. "Baixado" quando todos
//    chegaram; se faltar algum, a tela diz qual e por quê. "Pronto para operar sem internet".
// 3. A versão vira um Projeto do FreeShow (músicas e leituras viram shows com slides; vídeos e
//    imagens, itens de mídia; o destino e a observação do diretor ficam nas notas do item).
//    A primeira versão abre sozinha; uma versão nova só troca quando o operador clica (a
//    apresentação em andamento e o que o operador mudou no projeto ficam como estão).
// 4. O operador confere telão, letra na Transmissão e som do primeiro vídeo: "Testado" (só neste
//    computador; trocar de versão pede conferir de novo).

import { get, writable } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import type { ProjectShowRef } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { convertText } from "../converters/txt"
import { requestMain, sendMain } from "../IPC/main"
import { activeProject, projects } from "../stores"

export const PL_FORMAT = "projeto-live-culto"

export type PLItemTipo = "musica" | "texto" | "imagem" | "video"
export type PLDestino = "telao" | "letra" | "midia"

export interface PLItem {
    id: string
    tipo: PLItemTipo
    titulo: string
    destino: PLDestino
    letra?: string
    link?: string
    obs?: string
}

// O que o app do Diretor manda (uma versão publicada).
export interface PLCultoVersao {
    formato: string
    cultoId: string
    nome: string
    data: string
    hora: string
    versao: number
    publicadaEm: string
    itens: PLItem[]
}

export type PLDownloadError = "no_link" | "not_shared" | "not_found" | "network" | "disk"

export interface PLArquivo {
    ok: boolean
    path?: string
    name?: string
    error?: PLDownloadError
}

export interface PLCultoLocal {
    nome: string
    data: string
    hora: string
    versoes: { [n: string]: { payload: PLCultoVersao; recebidaEm: string; arquivos: { [itemId: string]: PLArquivo } } }
    emUso: number | null
    projetos: { [n: string]: string }
    testado: { versao: number; em: string } | null
}

export interface PLCultosState {
    cultos: { [cultoId: string]: PLCultoLocal }
}

export const DESTINO_LABEL: { [d in PLDestino]: string } = {
    telao: "Só telão",
    letra: "Telão + letra na live",
    midia: "Telão + imagem e som na live"
}

export const ERROR_LABEL: { [e in PLDownloadError]: string } = {
    no_link: "o diretor não colocou o link do arquivo",
    not_shared: 'o arquivo não está compartilhado como "Qualquer pessoa com o link"',
    not_found: "o link não existe mais no Drive",
    network: "sem internet ou o download caiu",
    disk: "sem espaço ou sem permissão na pasta do FreeShow"
}

export const plCultos = writable<PLCultosState>({ cultos: {} })
// itemId -> baixando agora
export const plDownloading = writable<{ [itemId: string]: boolean }>({})

let loaded = false
export async function plCultosLoad() {
    if (loaded) return
    const state = await requestMain(Main.PROJETO_LIVE_CULTOS_LOAD)
    if (state && state.cultos) plCultos.set(state)
    loaded = true
}

function save() {
    sendMain(Main.PROJETO_LIVE_CULTOS_SAVE, { state: get(plCultos) })
}

// Mesmo jeito de ler o link que o app do Diretor usa.
export function driveIdFrom(link: string | undefined): string | null {
    const text = (link || "").trim()
    if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(text) || /\/folders\//.test(text)) return null
    const match = text.match(/\/d\/([A-Za-z0-9_-]{15,})/) || text.match(/[?&]id=([A-Za-z0-9_-]{15,})/)
    return match ? match[1] : null
}

export function isMedia(item: PLItem) {
    return item.tipo === "imagem" || item.tipo === "video"
}

// O texto copiado no app do Diretor: "PLCULTO1" + o JSON da versão. Aceita o JSON puro também.
export function parseCulto(text: string): PLCultoVersao | null {
    const start = (text || "").indexOf("{")
    if (start < 0) return null
    try {
        const data = JSON.parse(text.slice(start, text.lastIndexOf("}") + 1))
        if (data?.formato !== PL_FORMAT || !data.cultoId || !Array.isArray(data.itens) || !(data.versao > 0)) return null
        return data
    } catch {
        return null
    }
}

export function latestVersion(culto: PLCultoLocal) {
    return Math.max(0, ...Object.keys(culto.versoes).map(Number))
}

// Itens de mídia de uma versão que ainda não estão no computador.
export function missingFiles(culto: PLCultoLocal, versao: number) {
    const entry = culto.versoes[versao]
    if (!entry) return []
    return entry.payload.itens.filter((item) => isMedia(item) && !entry.arquivos[item.id]?.ok)
}

// Recebe uma versão. Devolve um texto curto para mostrar ao operador.
export async function plReceive(text: string): Promise<{ ok: boolean; message: string }> {
    await plCultosLoad()
    const payload = parseCulto(text)
    if (!payload) return { ok: false, message: "Isso não parece um culto copiado do app do Diretor." }

    let isNew = false
    plCultos.update((state) => {
        const culto = state.cultos[payload.cultoId] || { nome: payload.nome, data: payload.data, hora: payload.hora, versoes: {}, emUso: null, projetos: {}, testado: null }
        if (!culto.versoes[payload.versao]) {
            culto.versoes[payload.versao] = { payload, recebidaEm: new Date().toISOString(), arquivos: {} }
            isNew = true
        }
        if (payload.versao >= latestVersion(culto)) {
            culto.nome = payload.nome
            culto.data = payload.data
            culto.hora = payload.hora
        }
        state.cultos[payload.cultoId] = culto
        return state
    })
    save()
    if (!isNew) return { ok: true, message: `A v${payload.versao} de "${payload.nome}" já estava aqui.` }

    await plDownload(payload.cultoId, payload.versao)

    // A primeira versão abre sozinha; as próximas esperam o operador trocar.
    const culto = get(plCultos).cultos[payload.cultoId]
    if (culto && culto.emUso === null) plOpenVersion(payload.cultoId, payload.versao)
    return { ok: true, message: `Recebido: "${payload.nome}" v${payload.versao}.` }
}

// Baixa (ou confere) os vídeos e imagens de uma versão.
export async function plDownload(cultoId: string, versao: number) {
    const entry = get(plCultos).cultos[cultoId]?.versoes[versao]
    if (!entry) return

    // Arquivo apagado do computador depois de baixado: baixa de novo.
    const known = entry.payload.itens.filter((item) => isMedia(item) && entry.arquivos[item.id]?.ok && entry.arquivos[item.id].path)
    if (known.length) {
        const exist = (await requestMain(Main.PROJETO_LIVE_FILES_EXIST, { paths: known.map((item) => entry.arquivos[item.id].path!) })) || []
        known.forEach((item, i) => {
            if (exist[i] === false) setFile(cultoId, versao, item.id, { ok: false, error: "network" })
        })
    }

    for (const item of entry.payload.itens) {
        if (!isMedia(item)) continue
        if (get(plCultos).cultos[cultoId]?.versoes[versao]?.arquivos[item.id]?.ok) continue

        const driveId = driveIdFrom(item.link)
        if (!driveId) {
            setFile(cultoId, versao, item.id, { ok: false, error: "no_link" })
            continue
        }

        plDownloading.update((a) => ({ ...a, [item.id]: true }))
        const result = await requestMain(Main.PROJETO_LIVE_DRIVE_DOWNLOAD, { cultoId, driveId }, undefined, 2 * 60 * 60 * 1000)
        plDownloading.update((a) => {
            delete a[item.id]
            return a
        })
        if (result?.ok) setFile(cultoId, versao, item.id, { ok: true, path: result.path, name: result.name })
        else setFile(cultoId, versao, item.id, { ok: false, error: (result && !result.ok ? result.error : "network") as PLDownloadError })
    }

    save()
}

function setFile(cultoId: string, versao: number, itemId: string, file: PLArquivo) {
    plCultos.update((state) => {
        const entry = state.cultos[cultoId]?.versoes[versao]
        if (entry) entry.arquivos[itemId] = file
        return state
    })
    save()
}

function shortDate(data: string) {
    const parts = (data || "").split("-")
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : ""
}

// Monta o Projeto do FreeShow com a versão e passa a usar essa versão.
export function plOpenVersion(cultoId: string, versao: number) {
    const culto = get(plCultos).cultos[cultoId]
    const entry = culto?.versoes[versao]
    if (!culto || !entry) return

    const newShows: { id: string; show: Show }[] = []
    const items: ProjectShowRef[] = []

    entry.payload.itens.forEach((item) => {
        const title = item.titulo || (item.tipo === "musica" ? "Música" : item.tipo === "texto" ? "Leitura" : item.tipo === "video" ? "Vídeo" : "Imagem")
        const notes = DESTINO_LABEL[item.destino] + (item.obs ? " · " + item.obs : "")

        if (!isMedia(item)) {
            if (!(item.letra || "").trim()) {
                items.push({ id: uid(5), type: "section", name: title + " (sem letra)", notes })
                return
            }
            const { id, show } = convertText({ name: title, text: item.letra, noFormatting: true, returnData: true, open: false })
            show.name = checkName(show.name, id)
            newShows.push({ id, show })
            items.push({ id, type: "show", notes })
            return
        }

        const file = entry.arquivos[item.id]
        if (file?.ok && file.path) {
            items.push({ id: file.path, name: title, type: item.tipo === "video" ? "video" : "image", notes })
        } else {
            const why = file?.error ? ERROR_LABEL[file.error] : "ainda não baixou"
            items.push({ id: uid(5), type: "section", name: "FALTA ARQUIVO: " + title, notes: notes + " · " + why })
        }
    })

    if (newShows.length) history({ id: "SHOWS", newData: { data: newShows, projectImport: true } })

    const projectId = uid()
    const project = { name: `${culto.nome} · ${shortDate(culto.data)} (v${versao})`, created: Date.now(), parent: "/", shows: items }
    history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })

    plCultos.update((state) => {
        const local = state.cultos[cultoId]
        local.projetos[versao] = projectId
        if (local.emUso !== versao) local.testado = null
        local.emUso = versao
        return state
    })
    save()
    activeProject.set(projectId)
}

// Abre o projeto da versão em uso (se o operador apagou o projeto, monta de novo).
export function plShowProject(cultoId: string) {
    const culto = get(plCultos).cultos[cultoId]
    if (!culto || culto.emUso === null) return
    const projectId = culto.projetos[culto.emUso]
    if (projectId && get(projects)[projectId] && !get(projects)[projectId].deleted) activeProject.set(projectId)
    else plOpenVersion(cultoId, culto.emUso)
}

export function plMarkTested(cultoId: string) {
    plCultos.update((state) => {
        const culto = state.cultos[cultoId]
        if (culto && culto.emUso !== null) culto.testado = { versao: culto.emUso, em: new Date().toISOString() }
        return state
    })
    save()
}

export function plForget(cultoId: string) {
    plCultos.update((state) => {
        delete state.cultos[cultoId]
        return state
    })
    save()
}
