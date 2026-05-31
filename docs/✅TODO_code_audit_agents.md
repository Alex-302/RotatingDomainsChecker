# TODO: Code Audit Against AGENTS.md

**Status:** ✅ DONE
**Created:** 2026-05-23
**Last Updated:** 2026-05-26
**Priority:** Medium

---

## Problem Summary

Нужно привести код к практическим требованиям из `AGENTS.md`, найденным аудитом 2026-05-23.

Первичный аудит выявил несколько классов проблем:

- использование `any` там, где нужен `unknown` или конкретный тип;
- silent-swallow `catch {}` без явной документации намерения;
- дублирование утилит;
- отсутствие streaming/incremental processing в больших файловых путях;
- sync I/O там, где допустим async path.

Задача не закрыта полностью, потому что часть пунктов уже исправлена, но два actionable пункта всё ещё остаются в коде.

---

## Current Status

### Closed in this workstream

- [x] `src/batch.ts`: `site: any` заменён на `WatcherSite`
- [x] `src/batch.ts`: `catch (err: any)` заменён на `catch (err: unknown)`
- [x] `src/httpResolver.ts`: error extraction переведён с `any` на `unknown` / narrowed object access
- [x] `src/diagnostics.ts`: callback payloads переведены с `message: any` на `message: unknown`
- [x] `naturalCompare()` вынесен в `src/utils.ts`
- [x] `calculateDaysSince()` вынесен в `src/utils.ts`
- [x] `src/index.ts` и `src/batch.ts` переведены на общие утилиты
- [x] `yarn build` был успешно выполнен после изменений
- [x] `yarn test` был успешно выполнен после изменений

### Still open

~~- [ ] `src/replacer.ts`: заменить full-file `readFile + split(/\r?\n/)` на streaming / incremental processing~~
~~- [ ] `src/config.ts`: заменить sync I/O (`readFileSync`) на async path там, где это имеет смысл для текущего API~~

Both resolved 2026-05-30:

- [x] `src/replacer.ts`: replaced with streaming via `readline/promises` + `createReadStream`. Line ending detection
  via async first-chunk read. (PR name: feat/code-audit-streaming-async)
- [x] `src/config.ts`: all three exports (`loadConfig`, `loadWatchers`, `saveWatchers`) converted to async using
  `fs.promises`. Call sites updated in `src/index.ts`, `__tests__/config.test.ts`, `__tests__/index.test.ts`,
  `__tests__/httpResolver.test.ts`.

Отдельно вынесено из этого TODO:

- [x] Atomic writes tracking moved to `docs/TODO_atomic_writes.md`.

### Accepted exception

- [x] `src/diagnostics.ts`: `subscriptions: any[]` оставлен как локальное исключение.
  Причина: попытка жёстко типизировать результат `diagnosticsChannel.subscribe(...)` привела к runtime/test teardown
  проблемам. Исключение локализовано в diagnostics helper и не влияет на публичные API или доменную логику.

---

## Scope

### Files already touched / normalized

- [x] `src/batch.ts`
- [x] `src/httpResolver.ts`
- [x] `src/diagnostics.ts`
- [x] `src/index.ts`
- [x] `src/utils.ts`

### Files still requiring work (all done)

- [x] `src/replacer.ts`
- [x] `src/config.ts`

---

## Requirements From AGENTS.md

- [x] Проверить код до изменения и зафиксировать реальные проблемные места
- [x] После code changes обновить/сверить связанные TODO-статусы
- [x] Проверить сборку через `yarn build`
- [x] Проверить тесты через `yarn test`
- [x] Завершить все actionable items перед переименованием файла в `✅TODO_*.md`
- [x] Синхронизировать статус с `docs/TODO.md`

---

## Remaining Work Plan

### 1. Streaming in replacer

~~- [ ] Перевести обработку filter files в `src/replacer.ts` с полного чтения файла на построчную / streaming processing~~
~~- [ ] Убедиться, что replacement semantics не меняются для существующих тестов~~
~~- [ ] При необходимости обновить `__tests__/replacer.test.ts`~~

- [x] Streaming implemented via `readline/promises` + `createReadStream`
- [x] All 403 tests pass — semantics unchanged
- [x] No changes needed to replacer tests

### 2. Async config I/O

~~- [ ] Проверить, нужен ли async refactor только для load-функций или для save-path тоже~~
~~- [ ] Перевести `src/config.ts` на async I/O без поломки текущих call sites~~
~~- [ ] При необходимости обновить `__tests__/config.test.ts`~~

- [x] All three functions (`loadConfig`, `loadWatchers`, `saveWatchers`) converted to async
- [x] Call sites updated in `src/index.ts`, `__tests__/config.test.ts`, `__tests__/index.test.ts`, `__tests__/httpResolver.test.ts`
- [x] All 403 tests pass

### 3. Final close-out

- [x] `yarn build` — успешно (ncc 0.38.4, 684kB)
- [x] `yarn test` — 403 passed, 0 failed
- [x] `TODO.md` master index синхронизирован
- [x] Файл готов к переименованию в `✅TODO_code_audit_agents.md`

---

## Validation History

- [x] Shared utils refactor validated by `yarn build`
- [x] Shared utils refactor validated by `yarn test`
- [x] `unknown` migration in `batch.ts` / `httpResolver.ts` validated by `yarn test`

---

## Manual Verification Notes

Для текущего состояния ручная проверка сводится к code-audit alignment, а не к user-facing runtime сценарию.
Практический check после завершения оставшихся пунктов:

- открыть `src/replacer.ts` и убедиться, что large-file path больше не держит весь файл целиком в памяти;
- открыть `src/config.ts` и убедиться, что sync reads больше не являются основным load path;
- запустить `yarn build`;
- запустить `yarn test`;
- убедиться, что summary в `docs/TODO.md` совпадает с фактическим состоянием кода.

---

## Audit Snapshot (2026-05-23)

Ниже краткий остаток исходного аудита, сохранённый как reference:

- `any` -> `unknown`: основной риск был в `src/batch.ts`, `src/httpResolver.ts`, `src/diagnostics.ts`
- silent catches: в основном низкий приоритет, значительная часть оправдана control-flow intent
- promise chains: в ряде мест признаны acceptable because of `Promise.race()` patterns
- no streaming: `src/replacer.ts`
- sync config I/O: `src/config.ts`
- duplicated utils: закрыто через `src/utils.ts`

Актуальным источником истины по статусу является этот TODO-файл, а не исторический snapshot аудита.
