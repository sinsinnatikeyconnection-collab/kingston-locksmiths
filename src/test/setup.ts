// Global test setup — run once before the first test in each file.
// Registers @testing-library/jest-dom custom matchers (toBeInTheDocument,
// toBeDisabled, toBeEnabled, ...) on Vitest's expect.
import "@testing-library/jest-dom";