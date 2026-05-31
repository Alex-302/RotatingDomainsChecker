# TODO: Atomic Writes for User-Facing File Updates

## Problem Summary

Сейчас user-facing файлы в ряде путей пишутся напрямую в target path (`writeFile` / `writeFileSync`).

На практике это означает риск частично записанного файла, если процесс будет прерван между truncate/write и close:

- Ctrl-C / process kill;
- OOM / crash;
- внезапное завершение runner/job;
- power loss / filesystem interruption.

Для этого репозитория особенно важны пути, где мы переписываем пользовательские данные, а не временные служебные файлы:

- `src/replacer.ts` -> запись filter files;
- `src/config.ts` -> `saveWatchers()` для `watchers.yml`.

В отличие от `streaming` и `async I/O`, atomic writes решают не performance-задачу, а задачу целостности файла.

## Scope

### In scope

- [ ] `src/replacer.ts`: безопасная запись изменённого filter file
- [ ] `src/config.ts`: безопасная запись `watchers.yml` в `saveWatchers()`

### Explicitly out of scope for this TODO

- [ ] `src/logger.ts`: log files можно разбирать отдельно; partial write там менее критичен
- [ ] `src/git.ts`: временный body-file для PR не является user-facing durable state
- [ ] `readFile + split()` / streaming refactor в `src/replacer.ts` — это отдельная performance/memory задача

## Goal

При записи итоговый путь должен остаться либо в старом консистентном состоянии, либо в новом консистентном состоянии,
но не в частично записанном виде.

## Candidate Implementations

### Option A: Internal helper (`write tmp in same dir -> fsync -> rename`)

- [ ] Писать временный файл в той же директории, что и target
- [ ] Использовать уникальный суффикс (`.${pid}.${timestamp}.tmp`)
- [ ] После записи делать flush/fsync временного файла
- [ ] Затем `rename` на target path
- [ ] На POSIX дополнительно fsync directory после rename для durability
- [ ] На Windows добавить retry/backoff на sharing violation / antivirus lock

**Pros:**

- без внешней зависимости;
- полный контроль над поведением и логированием;
- можно точно ограничить helper user-facing файлами.

**Cons:**

- больше platform-specific edge cases;
- Windows semantics нужно отдельно тестировать.

### Option B: External package (`write-file-atomic` or equivalent)

- [ ] Проверить, подходит ли зрелая библиотека под ESM/Node 22+ и текущий build pipeline
- [ ] Проверить поддержку Windows replace semantics
- [ ] Проверить, поддерживает ли библиотека нужные guarantees и cleanup tmp files

**Pros:**

- меньше собственного platform-specific кода;
- уже учтены многие edge cases.

**Cons:**

- новая dependency;
- надо проверить, насколько поведение библиотеки совпадает с нашими требованиями для Linux/Windows.

### Option C: Best-effort rename without fsync

- [ ] tmp file в той же директории
- [ ] `writeFile(tmp)` -> `rename(tmp, target)`
- [ ] cleanup tmp on failure

**Pros:**

- минимальная сложность;
- уже сильно лучше прямого `writeFile(target)`.

**Cons:**

- weaker durability guarantees;
- не закрывает все crash-consistency cases;
- на Windows возможны replace/locking edge cases.

## Preferred Direction to Evaluate First

- [ ] Сначала сравнить Option A и Option B
- [ ] Если library решает Windows/Linux cases без лишней сложности, предпочесть library
- [ ] Если dependency не нужна или неудобна, реализовать internal helper с documented Windows/POSIX behavior

## Platform Notes

### Linux / POSIX

- `rename()` в рамках одной filesystem обычно atomic for name replacement
- durability после rename лучше усиливать через fsync файла и директории
- tmp file обязательно создавать в той же директории / filesystem

### Windows

- overwrite/rename поверх существующего файла может упереться в sharing violation
- antivirus/indexer/открытый handle могут временно блокировать replace
- нужен либо library with proven Windows behavior, либо retry/backoff strategy
- fallback через `unlink(target) -> rename(tmp, target)` нежелателен, потому что теряет atomicity window

## What to Verify

### 1. Replace path correctness

- [ ] При успешной записи target file содержит полностью новый content
- [ ] При ошибке записи/rename исходный target file не повреждается
- [ ] Временные `.tmp` файлы не остаются после success
- [ ] Временные `.tmp` файлы чистятся после failure best-effort

### 2. Cross-platform behavior

- [ ] Проверить поведение на Windows path/rename semantics
- [ ] Проверить поведение на Linux/POSIX rename-in-same-dir
- [ ] Задокументировать, какие guarantees реально даются на каждой платформе

### 3. Repo integration

- [ ] Не ломать существующее сохранение line endings
- [ ] Не ломать сохранение комментариев в `watchers.yml`
- [ ] Не ломать summary/logging в replacer path

## Tests

- [ ] Добавить unit/integration tests там, где это реалистично
- [ ] Для replacer проверить, что файл обновляется целиком и tmp cleanup path работает
- [ ] Для config path проверить, что `saveWatchers()` пишет ожидаемый YAML без потери комментариев

## Manual Testing

### Repro config / input

- `watchers.yml` с как минимум одним watcher-ом и комментариями рядом с полями
- test filter file с несколькими domain rules в `TestFilters/TestFilter/`

### Command / path to execute

- запустить сценарий, который вызывает replacements;
- отдельно вызвать путь, который сохраняет `watchers.yml`;
- при ручной проверке можно временно встроить failpoint между write tmp и rename либо искусственно держать target file open
  в Windows для проверки sharing violation path.

### Expected result

- до фикса: при неудачном write path возможен partially written target file;
- после фикса: target file остаётся либо в старой, либо в новой полной версии; tmp files не накапливаются.

## Related TODOs

- `docs/⏳TODO_code_audit_agents.md` — atomic writes не входят в текущий code-audit close-out
- `docs/TODO_watchers_comments.md` — важно не потерять comment-preservation при безопасной записи `watchers.yml`

## AGENTS.md Completion Checklist

- [ ] Обновить/добавить тесты в `__tests__/` для изменённого поведения
- [ ] При необходимости обновить `README.md` / `docs/specs.md`
- [ ] Запустить `yarn build`
- [ ] Запустить `yarn test`
- [ ] Если появится platform-specific behavior, явно задокументировать Windows/POSIX guarantees