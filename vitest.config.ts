import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['apps/api/**/*.test.ts'],coverage:{reporter:['text','html']}}});
