// Projeto Live (somun tela, 19/11): modelos de fábrica que vieram dos modelos que a pessoa montou no
// PC dela (Config/templates.json). "Bíblia" e "Bíblia Lower Third" estão em createData.ts; aqui ficam
// os dois da saída vertical (9:16), usados também por projetoLiveVertical.ts.
//
// "Letra vertical" é um modelo de música: se tivesse os campos da Bíblia, um segundo campo
// ({scripture_reference}) apareceria nas letras. Por isso a Bíblia na vertical usa um irmão com o
// MESMO visual e os campos da Bíblia ("Bíblia vertical"); o estilo "Vertical (OBS)" aponta para ele.
// Assim some o aviso "template with no scripture values" sem mudar a aparência.

import type { Template } from "../../types/Show"

export const MODELO_LETRA_VERTICAL = "pl_letra_vertical"
export const MODELO_BIBLIA_VERTICAL = "pl_biblia_vertical"

const CAIXA_VERTICAL = "top:690px;left:96px;width:1728px;height:330px;"
const SOMBRA = "text-shadow: 4px 4px 12px rgb(0 0 0 / 80%);"

export function modeloLetraVertical(): Template {
    return {
        name: "Letra vertical",
        color: null,
        category: "song",
        settings: { resolution: { width: 1920, height: 1080 } },
        items: [
            {
                style: CAIXA_VERTICAL,
                align: "align-items:center;",
                textFit: "shrinkToFit",
                lines: [{ align: "", text: [{ value: "Letra vertical", style: "font-weight: bold;" + SOMBRA + "font-size: 100px;" }] }]
            }
        ]
    } as Template
}

export function modeloBibliaVertical(): Template {
    return {
        name: "Bíblia vertical",
        color: "#876543",
        category: "scripture",
        settings: { mode: "scripture", resolution: { width: 1920, height: 1080 } },
        items: [
            {
                style: CAIXA_VERTICAL,
                align: "align-items:center;",
                textFit: "shrinkToFit",
                lines: [
                    {
                        align: "",
                        text: [
                            { value: "{scripture_number} ", style: "font-weight: bold;" + SOMBRA + "font-size: 50px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture_text}", style: "font-weight: bold;" + SOMBRA + "font-size: 100px;" }
                        ]
                    },
                    { align: "", text: [{ value: "{scripture_reference}", style: SOMBRA + "font-size: 55px;color: rgb(255 255 255 / 0.8);" }] }
                ]
            }
        ]
    } as Template
}
