/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/engine", "<rootDir>/entry", "<rootDir>/queue", "<rootDir>/bronze", "<rootDir>/flags", "<rootDir>/replay", "<rootDir>/simulation", "<rootDir>/stress"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["engine/**/*.ts", "entry/**/*.ts", "queue/**/*.ts", "bronze/**/*.ts", "flags/**/*.ts", "replay/**/*.ts", "simulation/**/*.ts", "stress/**/*.ts", "!**/*.test.ts"],
  coverageDirectory: "coverage",
  verbose: true,
};
