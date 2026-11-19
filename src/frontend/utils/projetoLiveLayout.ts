// Projeto Live (somun Telão): layout novo da Projeção (19/11, proposta "Tamo Telão simplificado"
// aprovada pela pessoa, com a identidade somun).
//
// - Na primeira vez, a Projeção passa a usar o tema "somun" (preto/cinzas, Outfit, vermelho só para o
//   que está no ar).
// - Saída de segurança: Configurações > Geral > "Layout clássico do FreeShow" volta o tema e a tela
//   antigos (special.plLayoutClassico). As partes novas da tela olham `layoutClassico`.

import { derived, get, writable } from "svelte/store"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { clone } from "../components/helpers/array"
import { activeDrawerTab, activeEdit, activePage, activeProject, drawer, loaded, projects, projectView, special, theme, themes } from "../stores"
import { openProject } from "../components/show/project"
import { updateThemeValues } from "./updateSettings"

export const TEMA_SOMUN = "somun"

export const layoutClassico = derived(special, ($special) => !!$special?.plLayoutClassico)

// "Padrões" da aba Editar (somun tela, 19/11): aberto no lugar do editor; fecha ao escolher outra coisa para editar
export const plPadroesAberto = writable(false)
activeEdit.subscribe(() => plPadroesAberto.set(false))

function garantirTema() {
    if (get(themes)[TEMA_SOMUN]) return
    themes.update((a) => {
        a[TEMA_SOMUN] = clone(defaultThemes[TEMA_SOMUN])
        return a
    })
}

function usarTema(id: string) {
    if (id === TEMA_SOMUN) garantirTema()
    const valores = get(themes)[id] || defaultThemes[id] || defaultThemes.default
    theme.set(get(themes)[id] ? id : "default")
    // os degradês do somun não existem nos outros temas: volta ao valor do global.css
    ;["--pl-gradiente", "--pl-gradiente-borda", "--pl-gradiente-barra"].forEach((v) => document.documentElement.style.removeProperty(v))
    updateThemeValues(valores)
}

export function definirLayoutClassico(classico: boolean) {
    special.update((a) => {
        if (classico) a.plLayoutClassico = true
        else delete a.plLayoutClassico
        return a
    })
    usarTema(classico ? "default" : TEMA_SOMUN)
}

// "⋯" > Máscaras / Projetores: abas da gaveta que saíram da lista de abas
export function abrirGaveta(aba: "masks" | "projectors") {
    activePage.set("show")
    activeDrawerTab.set(aba as any)
    if (get(drawer).height <= 40) drawer.set({ height: 300, stored: get(drawer).height })
}

// Sem culto aberto: abre o último projeto usado (decisão de 19/11)
function abrirUltimoProjeto() {
    if (get(activeProject) && get(projects)[get(activeProject) || ""]) return
    const lista = Object.entries(get(projects)).filter(([, p]: [string, any]) => p && !p.archived && !p.deleted)
    if (!lista.length) return
    lista.sort((a: any, b: any) => (b[1].used || b[1].modified || 0) - (a[1].used || a[1].modified || 0))
    projectView.set(false)
    openProject(lista[0][0])
}

// Primeira vez (depois das configurações carregadas): tema somun, a não ser que o clássico esteja ligado.
let feito = false
loaded.subscribe((ok) => {
    if (!ok || feito) return
    feito = true
    setTimeout(() => {
        const s = get(special) || {}
        if (s.plLayoutClassico) return
        abrirUltimoProjeto()
        if (!s.plSomunTema) {
            special.update((a) => {
                a.plSomunTema = true
                return a
            })
            usarTema(TEMA_SOMUN)
        } else if (get(theme) === TEMA_SOMUN) {
            // o tema pode ter sido salvo antes desta versão: garante as cores atuais
            themes.update((a) => {
                a[TEMA_SOMUN] = clone(defaultThemes[TEMA_SOMUN])
                return a
            })
            updateThemeValues(get(themes)[TEMA_SOMUN])
        }
    }, 0)
})
