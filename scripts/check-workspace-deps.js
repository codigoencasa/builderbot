const fs = require('fs')
const path = require('path')

const rootDir = process.cwd()
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies']

const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
const workspacePatterns = rootPackageJson.workspaces || []

const packageJsonPaths = workspacePatterns
    .map((pattern) => {
        if (pattern.endsWith('/*')) {
            const baseDir = path.join(rootDir, pattern.slice(0, -2))
            if (!fs.existsSync(baseDir)) {
                return []
            }

            return fs
                .readdirSync(baseDir, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => path.join(baseDir, entry.name, 'package.json'))
                .filter((pkgPath) => fs.existsSync(pkgPath))
        }

        const pkgPath = path.join(rootDir, pattern, 'package.json')
        return fs.existsSync(pkgPath) ? [pkgPath] : []
    })
    .flat()

const violations = []

for (const packageJsonPath of packageJsonPaths) {
    const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const relativePath = path.relative(rootDir, packageJsonPath)

    for (const section of dependencySections) {
        const deps = content[section] || {}

        for (const [name, version] of Object.entries(deps)) {
            if (!name.startsWith('@builderbot/')) {
                continue
            }

            if (typeof version === 'string' && version.startsWith('workspace:')) {
                continue
            }

            violations.push(`${relativePath} -> ${section}.${name} = "${version}"`)
        }
    }
}

if (violations.length > 0) {
    console.error('Found internal dependencies without workspace protocol:')
    for (const violation of violations) {
        console.error(`- ${violation}`)
    }
    process.exit(1)
}

console.log('All internal @builderbot/* dependencies use workspace protocol.')
