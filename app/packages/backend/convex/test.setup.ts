/// <reference types="vite/client" />
// Convex ignores files with more than one dot, so this never deploys.
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
