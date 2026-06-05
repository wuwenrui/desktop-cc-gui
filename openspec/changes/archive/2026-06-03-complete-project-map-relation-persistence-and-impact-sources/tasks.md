## 1. OpenSpec artifacts

- [x] 1.1 [P0] Complete design/spec/tasks artifacts. Input: proposal and existing project specs. Output: design.md, specs delta, tasks.md. Verification: `openspec status` shows all artifacts complete.

## 2. Relation persistence round trip

- [x] 2.1 [P0] Extend Tauri Project Map read/write storage contract for `relations/latest.json`. Input: `src-tauri/src/project_map.rs`. Output: safe write path and read response relation field. Verification: backend whitelist accepts only the intended relation path.
- [x] 2.2 [P0] Ensure frontend dataset builder consumes relation snapshots. Input: existing Project Map persistence service. Output: `dataset.relations` survives read/write when backend returns relation data. Verification: `npm run typecheck` passes.

## 3. Git impact source

- [x] 3.1 [P0] Add frontend git status impact source adapter. Input: `getGitStatus` response. Output: unique changed file paths and source metadata. Verification: status files become changed-file input without mutation.
- [x] 3.2 [P0] Wire ProjectMapPanel to derive impact files from active workspace git status when no explicit input is supplied. Input: active workspace and optional prop override. Output: Project Map impact overlay uses git-derived files. Verification: explicit input takes precedence; git failure degrades to empty source.
- [x] 3.3 [P1] Display impact source metadata in the Project Map panel. Input: impact source state. Output: panel indicates source kind and file count. Verification: metadata is visible when impact source exists.

## 4. Validation and tracking

- [x] 4.1 [P0] Mark tasks complete as implementation lands. Input: completed changes. Output: checked tasks. Verification: OpenSpec apply instructions report all tasks complete.
- [x] 4.2 [P0] Run OpenSpec strict validation and TypeScript typecheck. Input: completed implementation. Output: validation result. Verification: both commands pass or failures are reported.
