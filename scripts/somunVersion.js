// somun tela: número da versão de cada montagem (base do FreeShow + "-somun.<número da montagem>").
// Assim cada montagem é "mais nova" que a anterior e a atualização automática a encontra.
// Uso (no GitHub Actions): node scripts/somunVersion.js <número>
const { readFileSync, writeFileSync } = require("fs")
const { join } = require("path")

const number = process.argv[2]
if (!/^\d+$/.test(number || "")) {
    console.error("Faltou o número da montagem")
    process.exit(1)
}

const file = join(__dirname, "..", "package.json")
const text = readFileSync(file, "utf8")
const pkg = JSON.parse(text)
const base = pkg.version.split("-")[0]
const version = `${base}-somun.${number}`
writeFileSync(file, text.replace(`"version": "${pkg.version}"`, `"version": "${version}"`))
console.log(version)
