// Projeto Live: cultos que chegam do app do Diretor.
//
// Aqui (processo principal) ficam duas coisas que o resto do app não consegue fazer sozinho:
// - guardar o arquivo "cultos.json" com o que chegou (versões, arquivos baixados e "Testado");
// - baixar do Google Drive os vídeos e imagens do roteiro para o computador, para o culto rodar
//   sem internet.
//
// Tudo fica em <pasta de dados do FreeShow>/Cultos Projeto Live/: o cultos.json e uma pasta por
// culto com os arquivos. Um arquivo do Drive já baixado não é baixado de novo (o nome começa com o
// id do arquivo no Drive), nem quando chega uma versão nova do culto.

import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { createFolder, getDataFolderRoot } from "../utils/files"

const FOLDER_NAME = "Cultos Projeto Live"
const STATE_FILE = "cultos.json"
// Vídeo grande em internet lenta: dá bastante tempo antes de desistir.
const DOWNLOAD_TIMEOUT_MS = 2 * 60 * 60 * 1000

function rootFolder() {
    return createFolder(path.join(getDataFolderRoot(), FOLDER_NAME))
}

function safeName(name: string) {
    return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120) || "arquivo"
}

export function projetoLiveCultosLoad(): any {
    try {
        const file = path.join(rootFolder(), STATE_FILE)
        if (!fs.existsSync(file)) return { cultos: {} }
        const data = JSON.parse(fs.readFileSync(file, "utf8"))
        return data && typeof data === "object" && data.cultos ? data : { cultos: {} }
    } catch (err) {
        console.error("Projeto Live: não deu para ler cultos.json", err)
        return { cultos: {} }
    }
}

export function projetoLiveCultosSave(state: any) {
    try {
        const file = path.join(rootFolder(), STATE_FILE)
        const temp = file + ".tmp"
        fs.writeFileSync(temp, JSON.stringify(state, null, 1))
        fs.renameSync(temp, file)
    } catch (err) {
        console.error("Projeto Live: não deu para salvar cultos.json", err)
    }
}

// Nome do arquivo que o Drive manda no cabeçalho (com acentos, quando vem em UTF-8).
function fileNameFrom(disposition: string | null) {
    if (!disposition) return ""
    const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf) {
        try {
            return decodeURIComponent(utf[1].trim())
        } catch {
            // segue para o nome simples
        }
    }
    const plain = disposition.match(/filename="?([^";]+)"?/i)
    return plain ? plain[1].trim() : ""
}

const EXTENSIONS: { [type: string]: string } = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif"
}

export type DriveDownloadResult = { ok: true; path: string; name: string } | { ok: false; error: "not_shared" | "not_found" | "network" | "disk"; detail?: string }

export async function projetoLiveDriveDownload(data: { cultoId: string; driveId: string }): Promise<DriveDownloadResult> {
    const driveId = String(data.driveId || "").replace(/[^A-Za-z0-9_-]/g, "")
    if (!driveId) return { ok: false, error: "not_found" }
    const folder = createFolder(path.join(rootFolder(), safeName(String(data.cultoId || "culto"))))

    // Já baixado antes (outra versão do mesmo culto): usa o mesmo arquivo.
    const existing = fs.readdirSync(folder).find((name) => name.startsWith(driveId + "-") && !name.endsWith(".part"))
    if (existing) return { ok: true, path: path.join(folder, existing), name: existing.slice(driveId.length + 1) }

    // "confirm=t" pula a tela do Google que pergunta sobre arquivos grandes demais para checar vírus.
    const url = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`
    let response: Response
    try {
        response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
    if (response.status === 404) return { ok: false, error: "not_found" }
    if (response.status === 401 || response.status === 403) return { ok: false, error: "not_shared" }
    if (!response.ok || !response.body) return { ok: false, error: "network", detail: "HTTP " + response.status }

    // Arquivo não compartilhado: o Google responde com a página de login, em HTML, em vez do arquivo.
    const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
    if (type === "text/html") {
        try {
            await response.body.cancel()
        } catch {
            // nada a fazer
        }
        return { ok: false, error: "not_shared" }
    }

    let name = safeName(fileNameFrom(response.headers.get("content-disposition")))
    if (name === "arquivo" || !path.extname(name)) name = (name === "arquivo" ? driveId : name) + (EXTENSIONS[type] || "")
    const target = path.join(folder, driveId + "-" + name)
    const temp = target + ".part"
    try {
        await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(temp))
        fs.renameSync(temp, target)
    } catch (err) {
        try {
            fs.rmSync(temp, { force: true })
        } catch {
            // nada a fazer
        }
        const detail = String(err)
        return { ok: false, error: /ENOSPC|EACCES|EPERM/.test(detail) ? "disk" : "network", detail }
    }
    return { ok: true, path: target, name }
}

// Os arquivos baixados ainda estão no computador? (alguém pode ter apagado a pasta)
export function projetoLiveFilesExist(paths: string[]) {
    return (paths || []).map((filePath) => {
        try {
            return fs.existsSync(filePath)
        } catch {
            return false
        }
    })
}
