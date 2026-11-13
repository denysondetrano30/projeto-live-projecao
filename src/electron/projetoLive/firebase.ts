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
    apiKey: "",
    projectId: ""
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

async function accessToken(refreshToken: string): Promise<{ ok: true; token: string; refreshToken: string } | Fail> {
    try {
        const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${PL_FIREBASE.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken),
            signal: AbortSignal.timeout(20000)
        })
        const answer: any = await response.json().catch(() => ({}))
        if (response.status !== 200) return authError(answer)
        return { ok: true, token: answer.id_token, refreshToken: answer.refresh_token || refreshToken }
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
