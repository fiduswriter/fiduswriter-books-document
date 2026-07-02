/** @type {import('jest').Config} */
export default {
    rootDir: ".",
    testEnvironment: "node",
    resolver: "ts-jest-resolver",
    extensionsToTreatAsEsm: [".ts"],
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: {
                    module: "NodeNext",
                    moduleResolution: "NodeNext"
                }
            }
        ]
    },
    moduleDirectories: ["node_modules"],
    moduleNameMapper: {
        "^downloadjs$": "<rootDir>/test/exporter/mocks/downloadjs.js",
        "^pretty$": "<rootDir>/test/exporter/mocks/pretty.js",
        "^fwtoolkit$": "<rootDir>/test/exporter/mocks/fwtoolkit.js",
        "^fwtoolkit/.*": "<rootDir>/test/exporter/mocks/fwtoolkit.js",
        "^@vivliostyle/print$": "<rootDir>/test/exporter/mocks/vivliostyle.js",
        "^mathlive$": "<rootDir>/test/exporter/mocks/mathlive.js",
        "^mathml2omml$": "<rootDir>/test/exporter/mocks/mathml2omml.js",
        "^biblatex-csl-converter$":
            "<rootDir>/test/exporter/mocks/biblatex-csl-converter.js",
        "^@fiduswriter/document/mathlive/opf_includes$":
            "<rootDir>/test/exporter/mocks/empty-module.js"
    },
    testMatch: ["<rootDir>/test/**/*.test.{js,ts}"],
    setupFiles: ["<rootDir>/test/setup.js"],
    moduleFileExtensions: ["ts", "js", "mjs", "json"]
}
