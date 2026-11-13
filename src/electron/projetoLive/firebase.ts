// Projeto Live: a Projeção busca os cultos publicados no app do Diretor (Firebase).
//
// Sem biblioteca do Firebase: só as chamadas web (REST) de login (e-mail e senha) e de leitura do
// Firestore. Fica no processo principal para não depender das regras de rede da janela.
//
// O que guarda (no cultos.json, via quem chama): o e-mail, o id da conta e o "refresh token" (o
// login que dura; a senha nunca é guardada). Cada busca troca o refresh token por um token de
// acesso de uma hora.
//
// O que lê: a coleção "cultos", só os documentos da própria conta (campo "owner"). Cada culto traz
// a última versão publicada inteira no campo "ultima" ({ n, em, retrato }), então uma leitura basta.

// Preenchido quando o projeto do Firebase existir (Configurações do projeto › Seus apps › app da
// Web). Estes dados não são senha: qualquer página do Firebase os mostra; quem protege os dados
// são o login e as regras do Firestore (firestore.rules no repositório do app do Diretor).
export const PL_FIREBASE = {
    apiKey: "AIzaSyBubqovhUfM_HFrlGfFhBygVg2FjMi5DD0",
    projectId: "projeto-live-e7ccb"
}

export function plFirebaseReady() {
    return !!(PL_FIREBASE.apiKey && PL_FIREBASE.projectId)
}

type Fail = { ok: false; error: "not_configured" | "wrong_password" | "no_user" | "network" | "expired" | "other"; detail?: string }

async function postJson(url: string, body: any, headers: { [key: string]: string } = {}) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
    })
    const data: any = await response.json().catch(() => ({}))
    return { status: response.status, data }
}

function authError(data: any): Fail {
    const code = String(data?.error?.message || "")
    if (/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|INVALID_EMAIL/.test(code)) return { ok: false, error: "wrong_password" }
    if (/EMAIL_NOT_FOUND|USER_DISABLED/.test(code)) return { ok: false, error: "no_user" }
    if (/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND/.test(code)) return { ok: false, error: "expired" }
    return { ok: false, error: "other", detail: code }
}

export async function plFirebaseSignIn(data: { email: string; password: string }): Promise<{ ok: true; email: string; uid: string; refreshToken: string } | Fail> {
    if (!plFirebaseReady()) return { ok: false, error: "not_configured" }
    try {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${PL_FIREBASE.apiKey}`
        const { status, data: answer } = await postJson(url, { email: data.email, password: data.password, returnSecureToken: true })
        if (status !== 200) return authError(answer)
        return { ok: true, email: answer.email, uid: answer.localId, refreshToken: answer.refreshToken }
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
}

// O token de acesso vale uma hora: guarda por 50 minutos para não pedir um novo a cada consulta.
let tokenCache: { refreshToken: string; token: string; until: number; nextRefresh: string } | null = null

async function accessToken(refreshToken: string): Promise<{ ok: true; token: string; refreshToken: string } | Fail> {
    if (tokenCache && tokenCache.refreshToken === refreshToken && tokenCache.until > Date.now()) {
        return { ok: true, token: tokenCache.token, refreshToken: tokenCache.nextRefresh }
    }
    try {
        const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${PL_FIREBASE.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken),
            signal: AbortSignal.timeout(20000)
        })
        const answer: any = await response.json().catch(() => ({}))
        if (response.status !== 200) return authError(answer)
        const next = answer.refresh_token || refreshToken
        tokenCache = { refreshToken, token: answer.id_token, until: Date.now() + 50 * 60 * 1000, nextRefresh: next }
        return { ok: true, token: answer.id_token, refreshToken: next }
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
}

// Valor do Firestore (com o tipo junto) para valor comum.
function plain(value: any): any {
    if (!value || typeof value !== "object") return null
    if ("stringValue" in value) return value.stringValue
    if ("integerValue" in value) return Number(value.integerValue)
    if ("doubleValue" in value) return Number(value.doubleValue)
    if ("booleanValue" in value) return !!value.booleanValue
    if ("timestampValue" in value) return value.timestampValue
    if ("nullValue" in value) return null
    if ("arrayValue" in value) return (value.arrayValue.values || []).map(plain)
    if ("mapValue" in value) {
        const result: any = {}
        Object.entries(value.mapValue.fields || {}).forEach(([key, field]) => {
            result[key] = plain(field)
        })
        return result
    }
    return null
}

// Os cultos publicados da conta, cada um com a última versão. Devolve também o refresh token novo
// (o Google pode trocar) para quem chama guardar.
export async function plFirebaseCultos(data: { uid: string; refreshToken: string }): Promise<{ ok: true; refreshToken: string; cultos: any[] } | Fail> {
    if (!plFirebaseReady()) return { ok: false, error: "not_configured" }
    const auth = await accessToken(data.refreshToken)
    if (!auth.ok) return auth

    try {
        const url = `https://firestore.googleapis.com/v1/projects/${PL_FIREBASE.projectId}/databases/(default)/documents:runQuery`
        const query = {
            structuredQuery: {
                from: [{ collectionId: "cultos" }],
                where: { fieldFilter: { field: { fieldPath: "owner" }, op: "EQUAL", value: { stringValue: data.uid } } }
            }
        }
        const { status, data: answer } = await postJson(url, query, { Authorization: "Bearer " + auth.token })
        if (status !== 200) return { ok: false, error: status === 401 || status === 403 ? "expired" : "other", detail: JSON.stringify(answer).slice(0, 300) }

        const cultos = (Array.isArray(answer) ? answer : [])
            .filter((row: any) => row.document)
            .map((row: any) => {
                const fields = plain({ mapValue: { fields: row.document.fields || {} } })
                fields.id = String(row.document.name || "").split("/").pop()
                return fields
            })
        return { ok: true, refreshToken: auth.refreshToken, cultos }
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
}

/* ------------------------------------------------------------------------- */
/* Ao vivo (bloco 6): "Agora no telão", recados e sugestões do diretor         */
//
// aoVivo/<cultoId>                 { owner, agora: { itemId, indice, titulo, em }, atualizadoEm }
// aoVivo/<cultoId>/eventos/<id>    { owner, tipo: "recado" | "sugestao", de, para, texto, link,
//                                    posicao: { tipo, itemId, titulo }, titulo, em, estado, motivo }
// "em" é a hora em texto ISO (UTC), o que deixa buscar "o que chegou depois de".

// Valor comum para valor do Firestore (com o tipo junto).
function typed(value: any): any {
    if (value === null || value === undefined) return { nullValue: null }
    if (typeof value === "string") return { stringValue: value }
    if (typeof value === "boolean") return { booleanValue: value }
    if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(typed) } }
    const fields: any = {}
    Object.entries(value).forEach(([key, item]) => {
        fields[key] = typed(item)
    })
    return { mapValue: { fields } }
}

function documentsUrl(path: string) {
    return `https://firestore.googleapis.com/v1/projects/${PL_FIREBASE.projectId}/databases/(default)/documents/${path}`
}

async function authed(data: { refreshToken: string }) {
    if (!plFirebaseReady()) return { ok: false as const, error: "not_configured" as const }
    return accessToken(data.refreshToken)
}

async function request(method: string, url: string, token: string, body?: any) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
    })
    const answer: any = await response.json().catch(() => ({}))
    return { status: response.status, answer }
}

function failFrom(status: number, answer: any): Fail {
    return { ok: false, error: status === 401 || status === 403 ? "expired" : "other", detail: JSON.stringify(answer).slice(0, 300) }
}

// Atualiza só os campos dados (cria o documento se ainda não existe).
async function patchDoc(path: string, token: string, fields: { [key: string]: any }) {
    const mask = Object.keys(fields)
        .map((key) => "updateMask.fieldPaths=" + encodeURIComponent(key))
        .join("&")
    const body = { fields: typed(fields).mapValue.fields }
    return request("PATCH", documentsUrl(path) + "?" + mask, token, body)
}

export async function plLiveSetNow(data: { uid: string; refreshToken: string; cultoId: string; agora: any }): Promise<{ ok: true } | Fail> {
    const auth = await authed(data)
    if (!auth.ok) return auth
    try {
        const now = new Date().toISOString()
        const { status, answer } = await patchDoc("aoVivo/" + encodeURIComponent(data.cultoId), auth.token, { owner: data.uid, agora: { ...data.agora, em: now }, atualizadoEm: now })
        return status === 200 ? { ok: true } : failFrom(status, answer)
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
}

// Os eventos que chegaram depois de "since" (hora ISO), do mais antigo para o mais novo.
export async function plLiveEvents(data: { uid: string; refreshToken: string; cultoId: string; since: string }): Promise<{ ok: true; eventos: any[] } | Fail> {
    const auth = await authed(data)
    if (!auth.ok) return auth
    try {
        const query = {
            structuredQuery: {
                from: [{ collectionId: "eventos" }],
                where: { fieldFilter: { field: { fieldPath: "em" }, op: "GREATER_THAN", value: { stringValue: data.since } } },
                orderBy: [{ field: { fieldPath: "em" }, direction: "ASCENDING" }],
                limit: 100
            }
        }
        const { status, answer } = await request("POST", documentsUrl("aoVivo/" + encodeURIComponent(data.cultoId)) + ":runQuery", auth.token, query)
        if (status !== 200) return failFrom(status, answer)
        const eventos = (Array.isArray(answer) ? answer : [])
            .filter((row: any) => row.document)
            .map((row: any) => {
                const fields = plain({ mapValue: { fields: row.document.fields || {} } })
                fields.id = String(row.document.name || "").split("/").pop()
                return fields
            })
        return { ok: true, eventos }
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
}

export async function plLiveAddEvent(data: { uid: string; refreshToken: string; cultoId: string; evento: any }): Promise<{ ok: true } | Fail> {
    const auth = await authed(data)
    if (!auth.ok) return auth
    try {
        const fields = typed({ ...data.evento, owner: data.uid, em: new Date().toISOString() }).mapValue.fields
        const { status, answer } = await request("POST", documentsUrl(`aoVivo/${encodeURIComponent(data.cultoId)}/eventos`), auth.token, { fields })
        return status === 200 ? { ok: true } : failFrom(status, answer)
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
}

export async function plLivePatchEvent(data: { uid: string; refreshToken: string; cultoId: string; id: string; fields: any }): Promise<{ ok: true } | Fail> {
    const auth = await authed(data)
    if (!auth.ok) return auth
    try {
        const { status, answer } = await patchDoc(`aoVivo/${encodeURIComponent(data.cultoId)}/eventos/${encodeURIComponent(data.id)}`, auth.token, data.fields)
        return status === 200 ? { ok: true } : failFrom(status, answer)
    } catch (err) {
        return { ok: false, error: "network", detail: String(err) }
    }
}
