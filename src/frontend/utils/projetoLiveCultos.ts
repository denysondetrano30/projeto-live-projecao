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
import { activeProject, projects, shows } from "../stores"

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
    // Música escolhida no banco de músicas da conta (documento e, se veio da Projeção, a música dela).
    musicaId?: string
    showId?: string
    // Cifra colada (acordes em cima da letra, como no Cifra Club): vira a música com os acordes
    // para o retorno de palco; o telão e a live mostram só a letra.
    cifra?: string
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
    // Conta do Projeto Live (Firebase): só o e-mail, o id e o login que dura; nunca a senha.
    account?: { email: string; uid: string; refreshToken: string } | null
    // Banco de músicas da conta: o que já subiu (hash por música) e o documento de cada música.
    musicas?: { hashes: { [showId: string]: string }; docs: { [showId: string]: string } }
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

export function plCultosSave() {
    save()
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

// Recebe uma versão colada (plano B, sem internet no app do Diretor).
export async function plReceive(text: string): Promise<{ ok: boolean; message: string }> {
    await plCultosLoad()
    const payload = parseCulto(text)
    if (!payload) return { ok: false, message: "Isso não parece um culto copiado do app do Diretor." }
    return plReceivePayload(payload)
}

// Recebe uma versão (colada ou buscada na conta). Devolve um texto curto para o operador.
export async function plReceivePayload(payload: PLCultoVersao): Promise<{ ok: boolean; message: string }> {
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

// Nome para comparar: sem acento, sem diferença de maiúscula e de espaços.
function sameName(name: string) {
    return (name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
}

// Música sem letra no roteiro: usa o show de mesmo nome que já está na biblioteca (o primeiro que achar).
function libraryShow(title: string): string | null {
    const wanted = sameName(title)
    if (!wanted) return null
    const found = Object.entries(get(shows)).filter(([, show]: [string, any]) => !show?.private && sameName(show?.name) === wanted)
    return found.length ? found[0][0] : null
}

// Cifra copiada de sites como o Cifra Club: tira o que não é música (tom, capotraste, afinação,
// tablatura, "Parte 1 de 3"). O conversor de texto do FreeShow põe cada acorde na sílaba certa.
export function plCifraTexto(cifra: string) {
    return cifra
        .replace(/\r/g, "")
        .split("\n")
        .filter((line) => {
            const t = line.trim()
            if (/^(tom|capotraste|afina[cç][aã]o)\s*:/i.test(t)) return false
            if (/^[EADGBe]\s*\|[-\d|hpbr/\\~x\s]*$/.test(t)) return false
            if (/^\[?tab\b.*\]?$/i.test(t)) return false
            if (/^parte\s+\d+\s+de\s+\d+$/i.test(t)) return false
            // "[Intro] F#m E D": parte só de instrumento (acordes sem letra) não vira slide.
            const label = t.match(/^\[[^\]]+\]\s+(.+)$/)
            if (label && /^[\sA-G#b0-9mMajinsudg()/|+*.-]+$/.test(label[1])) return false
            return true
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function bankShow(item: PLItem): string | null {
    const all = get(shows)
    if (item.showId && all[item.showId]) return item.showId
    if (!item.musicaId) return null
    const docs = get(plCultos).musicas?.docs || {}
    const found = Object.entries(docs).find(([, docId]) => docId === item.musicaId)
    return found && all[found[0]] ? found[0] : null
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
            const source = (item.cifra || "").trim() ? plCifraTexto(item.cifra || "") : item.letra || ""
            // Escolhida no banco de músicas: vai direto na música certa da biblioteca.
            const fromBank = bankShow(item)
            if (fromBank && item.musicaId) {
                items.push({ id: fromBank, type: "show", notes, plItemId: item.id } as any)
                return
            }
            if (!source.trim()) {
                const existing = fromBank || (item.titulo ? libraryShow(item.titulo) : null)
                if (existing) items.push({ id: existing, type: "show", notes, plItemId: item.id } as any)
                else items.push({ id: uid(5), type: "section", name: title + " (sem letra e não está na biblioteca)", notes, plItemId: item.id } as any)
                return
            }
            const { id, show } = convertText({ name: title, text: source, noFormatting: true, returnData: true, open: false })
            show.name = checkName(show.name, id)
            newShows.push({ id, show })
            // Música nova que o diretor também mandou para o banco: esta passa a ser a dela na
            // biblioteca (o banco de músicas não cria outra igual).
            if (item.musicaId) {
                plCultos.update((state) => {
                    state.musicas = state.musicas || { hashes: {}, docs: {} }
                    state.musicas.docs[id] = item.musicaId!
                    return state
                })
            }
            items.push({ id, type: "show", notes, plItemId: item.id } as any)
            return
        }

        const file = entry.arquivos[item.id]
        if (file?.ok && file.path) {
            items.push({ id: file.path, name: title, type: item.tipo === "video" ? "video" : "image", notes, plItemId: item.id } as any)
        } else {
            const why = file?.error ? ERROR_LABEL[file.error] : "ainda não baixou"
            items.push({ id: uid(5), type: "section", name: "FALTA ARQUIVO: " + title, notes: notes + " · " + why, plItemId: item.id } as any)
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

/* ------------------------------------------------------------------------- */
/* Conta do Projeto Live (Firebase): busca os cultos publicados sozinha       */

export const FIREBASE_ERROR: { [code: string]: string } = {
    not_configured: "A conta do Projeto Live ainda não foi configurada neste programa.",
    wrong_password: "E-mail ou senha errados.",
    no_user: "Não existe conta com esse e-mail.",
    network: "Sem internet agora. Os cultos já baixados continuam funcionando.",
    expired: "O login venceu. Entre de novo.",
    other: "O Firebase recusou o pedido."
}

export async function plFirebaseReady(): Promise<boolean> {
    return !!(await requestMain(Main.PROJETO_LIVE_FIREBASE_READY))
}

export async function plSignIn(email: string, password: string): Promise<{ ok: boolean; message: string }> {
    await plCultosLoad()
    const result = await requestMain(Main.PROJETO_LIVE_FIREBASE_SIGNIN, { email: email.trim(), password }, undefined, 30000)
    if (!result?.ok) return { ok: false, message: FIREBASE_ERROR[result?.error || "network"] || FIREBASE_ERROR.other }
    plCultos.update((state) => {
        state.account = { email: result.email, uid: result.uid, refreshToken: result.refreshToken }
        return state
    })
    save()
    return plFetch()
}

export function plSignOut() {
    plCultos.update((state) => {
        state.account = null
        // Outra conta pode entrar depois: o banco de músicas sobe de novo do zero para ela.
        state.musicas = undefined
        return state
    })
    save()
}

function daysAgo(days: number) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0")
}

// Busca os cultos publicados da conta (da última semana para frente) e recebe as versões novas.
let fetching = false
export async function plFetch(): Promise<{ ok: boolean; message: string }> {
    await plCultosLoad()
    const account = get(plCultos).account
    if (!account) return { ok: false, message: "" }
    if (fetching) return { ok: true, message: "" }
    fetching = true
    try {
        const result = await requestMain(Main.PROJETO_LIVE_FIREBASE_CULTOS, { uid: account.uid, refreshToken: account.refreshToken }, undefined, 30000)
        if (!result?.ok) {
            if (result?.error === "expired") plSignOut()
            return { ok: false, message: FIREBASE_ERROR[result?.error || "network"] || FIREBASE_ERROR.other }
        }
        if (result.refreshToken && result.refreshToken !== account.refreshToken) {
            plCultos.update((state) => {
                if (state.account) state.account.refreshToken = result.refreshToken
                return state
            })
            save()
        }

        const from = daysAgo(7)
        let received = 0
        for (const doc of result.cultos as any[]) {
            const last = doc?.ultima
            if (!last?.retrato || !(last.n > 0) || (last.retrato.data || "") < from) continue
            if (get(plCultos).cultos[doc.id]?.versoes[last.n]) continue
            const payload: PLCultoVersao = {
                formato: PL_FORMAT,
                cultoId: doc.id,
                nome: last.retrato.nome,
                data: last.retrato.data,
                hora: last.retrato.hora,
                versao: last.n,
                publicadaEm: last.em,
                itens: last.retrato.itens || []
            }
            await plReceivePayload(payload)
            received++
        }
        return { ok: true, message: received ? (received === 1 ? "1 versão nova recebida." : received + " versões novas recebidas.") : "Tudo em dia." }
    } finally {
        fetching = false
    }
}
