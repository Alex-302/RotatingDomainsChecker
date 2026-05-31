# TODO: Починить ссылку `View detailed log` на artifacts в GitHub Actions

## Проблема

В commit message / summary сейчас добавляется ссылка вида:

```text
https://github.com/<repo>/actions/runs/<runId>#artifacts
```

На практике `View detailed log` может вести "вникуда" или не открывать artifacts-блок ожидаемым образом.

Пример наблюдаемого кейса:

- `https://github.com/AdguardTeam/AdguardFilters/actions/runs/26095975580#artifacts`

## Предварительная локализация

Ссылка собирается в:

- `src/git.ts`
- также попадает в `dist/index.js` после сборки

Текущее поведение:

- если есть `GITHUB_ACTIONS`, `GITHUB_RUN_ID`, `GITHUB_REPOSITORY`, в commit message добавляется жёстко сшитый URL с
  hash-anchor `#artifacts`.

## Гипотеза

Проблема, вероятно, не в `runId`, а в том, что:

- GitHub UI не гарантирует стабильную навигацию по `#artifacts` на странице run;
- artifacts могут жить за другим URL/panel-state, чем простой hash-anchor;
- commit message генерируется без знания конкретного artifact id/url.

## Что проверить

### 1. Проверить минимально безопасный fallback

- [ ] Сравнить поведение ссылки на run page без hash:
  - `https://github.com/<repo>/actions/runs/<runId>`
- [ ] Если run page без hash надёжнее, рассмотреть замену текста на более нейтральный `View workflow run`

### 2. Проверить, можно ли получить прямую artifact-ссылку

- [ ] Посмотреть outputs `actions/upload-artifact@v6` в workflow examples
- [ ] Проверить, есть ли доступный artifact URL/id в runtime без отдельного API-запроса
- [ ] Если нет, оценить, нужен ли GitHub API call для построения прямой ссылки на artifact

### 3. Проверить UX-формулировку

- [ ] Если ссылка остаётся на run page, переименовать `View detailed log` в более честный текст:
  - `View workflow run`
  - `Open workflow run / artifacts`
- [ ] Не обещать artifact-page, если ссылка фактически ведёт только на общий run

### 4. Добавить регрессионную проверку

- [ ] Добавить/обновить тест для buildCommitMessage в `__tests__/git.test.ts`
- [ ] Зафиксировать ожидаемый формат ссылки/подписи

## Где смотреть

- `src/git.ts`
- `dist/index.js`
- `.github/workflows/example-local-testing.yml`
- `.github/workflows/example-external-public.yml`

## Комментарий по приоритету

Это не критичный runtime bug и не влияет на поиск доменов или replacements. Но это раздражающий UX/reporting дефект,
поэтому его стоит держать как low-priority follow-up.

## Требования AGENTS.md (после завершения)

- [ ] Задокументировать breaking changes (если есть)
- [ ] Проверить backward compatibility
- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Запустить `yarn lint` для проверки стиля кода
