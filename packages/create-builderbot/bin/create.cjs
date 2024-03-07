#!/usr/bin/env node
import('../dist/index.cjs')
    .then((m) => m.default.main())
    .catch((e) => console.log(`[Error CLI]:`, e))
