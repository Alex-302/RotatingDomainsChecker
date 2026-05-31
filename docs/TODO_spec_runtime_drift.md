# TODO: Расхождения между specs.md и runtime (аудит 2026-05-23)

Результат сверки `docs/specs.md`, `docs/specs_discovery_entrypoint.md` и исходного кода. Содержит только
**недокументированные** расхождения — те, что не покрыты другими TODO-файлами.

## 1. DNS preflight threshold: spec требует 3/3, код допускает 2/3

**Spec (раздел 10.4):**

> If at least one of the three preflight hosts doesn't resolve via forced DNS resolver, the run is fatal and must
> terminate immediately.

**Код (`src/index.ts`, `dnsPreflightCheck`):**

```typescript
if (resolvedCount < 2) {
  // 0 или 1 успешных → fatal
  process.exit(1);
}
```

Код требует минимум **2 успешных** DNS-запроса из 3, т.е. допускает отказ одного DNS-сервера без останова.

**Решение:** обновить spec до текущего поведения (2/3 достаточно), т.к. это более устойчивое поведение в
production. 3/3 был бы слишком жёстким — один упавший DNS-сервер не должен блокировать весь прогон.

### Задачи

- [ ] Обновить `docs/specs.md` раздел 10.4: описать, что preflight считает DNS доступным если **не менее 2 из 3**
  хостов успешно разрешены
- [ ] Обновить раздел 10.2, если нужно явно указать, что все 3 хоста проверяются, но fatal требует отказа ≥2
- [ ] Проверить, что README.md согласован с новым описанием

## 2. Лог-файл не сохраняется при DNS preflight failure

При DNS preflight failure `dnsPreflightCheck()` вызывает `process.exit(1)` напрямую — до вызова
`logger.saveToFile()` в конце `main()`. Если `logging.saveToFile: true` в конфиге, log-файл **не создаётся** при
preflight-краше. Вся диагностика остаётся только в консоли.

**Spec (раздел 12.2):** описывает запись в файл при `saveToFile: true`, но не покрывает preflight-сценарий.

### Задачи

- [ ] В `dnsPreflightCheck()` добавить сохранение лога перед `process.exit(1)`, если `logging.saveToFile: true`
- [ ] Добавить тест: при DNS preflight failure с `saveToFile: true` файл должен содержать диагностику
- [ ] Обновить `docs/specs.md` раздел 12.2: явно описать поведение при preflight failure

## 3. Action output `updated-count` считает replacement pairs, а не sites

**Spec (раздел 2.2):**

> Action outputs: `updated-count`

**Код (`src/index.ts`):**

```typescript
appendFileSync(process.env.GITHUB_OUTPUT, `updated-count=${summary.replacements.length}\n`);
```

`summary.replacements` содержит отдельные записи `ReplacementPair`: для каждого `oldHost` и каждого
`additionalDomain` создаётся отдельная пара. Сайт с `force_search_ahead` и 5 дополнительными доменами даёт 6+ пар.

Имя `updated-count` подразумевает **количество обновлённых сайтов**, а количество записей не несёт практической
ценности для внешних вызывающих workflow.

### Задачи

- [ ] Заменить `summary.replacements.length` на количество уникальных сайтов, для которых были реальные изменения
  домена (newHost ≠ original last_known_mirror)
- [ ] Логика должна совпадать с `hasUniqueDomainChanges` — переиспользовать уже существующий подсчёт
- [ ] Добавить test для GitHub Actions output: убедиться что `updated-count` = количеству уникальных сайтов
- [ ] Обновить `docs/specs.md` раздел 2.2: явно описать, что `updated-count` — число обновлённых сайтов

## 4. Порядок `skip_text` evaluation и JS redirect в `httpResolver`

В `httpResolver.ts` при обработке финальной страницы (HTTP 200):

```text
1. Прочитать body
2. Проверить probe_text на текущем body
3. Проверить skip_text на текущем body    ← если найдено: return failure СРАЗУ
4. Проверить JS/meta redirect в body      ← НИКОГДА не исполняется, если skip_text сработал
```

**Spec (раздел 5.10)** говорит *«After reading the body, a search by global skip_text is performed»*.
**Spec (раздел 5.5)** говорит, что JS redirect — это *«continuation of the redirect chain, and is not treated as an
end successful page»*.

Логически модель spec описывает redirect chain как сквозной процесс, где skip_text проверяется на **финальной**
странице после всех переходов. Текущий код проверяет skip_text на промежуточной странице и может не следовать JS
redirect.

**Практический эффект:** если промежуточная страница содержит skip_text-фразу **и** JS redirect на рабочую страницу,
домен будет помечен как failed без перехода на финальный домен. Обычно это корректно (parked page → не нужно
следовать дальше), но порядок не описан в specs как намеренный.

### Задачи

- [ ] Явно зафиксировать в `docs/specs.md` текущий порядок как намеренное поведение: skip_text проверяется на каждой
  странице **до** JS/meta redirect, потому что parked page не должна следовать дальше
- [ ] Добавить комментарий в `httpResolver.ts` рядом с `containsSkipText` и `extractJsRedirect`, объясняющий порядок
- [ ] Добавить test: страница со skip_text + JS redirect → skip_text побеждает, JS redirect не исполняется

## Требования AGENTS.md (после завершения)

- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Обновить `docs/TODO.md` (master index) ссылкой на этот файл
