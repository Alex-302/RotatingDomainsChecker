# TODO: Сохранение комментариев и структуры в watchers.yml

## Проблема

Сейчас `watchers.yml` при сохранении фактически сериализуется заново через YAML document stringify path в
`src/config.ts`.

Практический эффект:

- ручные комментарии в `watchers.yml` пропадают;
- layout/formatting файла может переписываться целиком;
- пользовательские пояснения рядом с watcher entries не переживают обычный runtime update.

Это особенно неприятно, потому что `watchers.yml` используется как живой operational file, а не только как
machine-owned state dump.

## Текущий root cause

Сохраняющий путь проходит через `saveWatchers()` в `src/config.ts`:

- файл читается через `parseDocument(...)`;
- затем значения `sites.*` перезаписываются программно;
- затем весь документ снова выводится через `stringify(doc)`.

Даже если часть comments иногда сохраняется, текущее поведение недостаточно надёжно для сохранения user-authored
comments и локальной структуры файла.

## Почему текущие тесты недостаточны

В `__tests__/config.test.ts` уже есть test `saveWatchers preserves comments`, но он проверяет только то, что после save
в файле появился обновлённый `last_known_mirror`.

Он не проверяет:

- сохранение top-level comments;
- сохранение site-local comments;
- сохранение inline comments рядом с полями;
- отсутствие полного rewrite/layout churn там, где меняется только одно значение.

Из-за этого тест даёт ложное ощущение, что comment preservation уже закрыт.

## Что сделать

### 1. Зафиксировать целевое поведение

- [ ] Решить, считается ли `watchers.yml` partially user-owned file, в котором comments нужно сохранять best-effort;
- [ ] Зафиксировать минимальную гарантию: какие comments обязаны переживать save path;
- [ ] Зафиксировать, допустим ли partial formatting churn, если comments сохранены.

### 2. Усилить тесты

- [ ] Обновить `__tests__/config.test.ts` так, чтобы test реально проверял сохранение comments;
- [ ] Добавить кейс с top-level comment перед `sites:`;
- [ ] Добавить кейс с comment перед конкретным watcher;
- [ ] Добавить кейс с inline comment возле поля watcher-а;
- [ ] Добавить кейс, где меняется одно поле, а остальные comments/structure остаются.

### 3. Исправить serialization path

- [ ] Проверить, можно ли обновлять YAML AST точечнее, не заставляя библиотеку полностью пересобирать structure;
- [ ] Если текущая библиотека не даёт надёжной гарантии, выбрать более comment-preserving подход для `watchers.yml`;
- [ ] Убедиться, что save path не удаляет пользовательские comments при обычном run.

### 4. Согласовать docs/runtime expectations

- [ ] Уточнить в docs, является ли `watchers.yml` machine-managed или user-maintained-with-comments файлом;
- [ ] Если comments officially supported, описать это в README или spec рядом с форматом watcher state.

## Где смотреть

- `src/config.ts`
- `__tests__/config.test.ts`
- `watchers.yml`
- `README.md`
- `docs/specs.md`

## Комментарий по приоритету

Это не аварийный runtime bug, но это прямой UX/data-loss issue: пользовательские комментарии стираются при обычном
обновлении state. По приоритету это стоит держать рядом с state/serialization задачами по `watchers.yml`.

## Связанный трек

Этот TODO стоит делать в одном цикле с `docs/TODO_state_semantics.md`, а не отдельно.

Причина:

- оба трека упираются в один и тот же `watchers.yml` save/serialization path;
- оба затрагивают `src/config.ts`, `__tests__/config.test.ts`, а частично и `src/index.ts`;
- раздельная работа повышает риск дважды переписывать YAML update logic и снова получить churn в `watchers.yml`.

Практическое правило:

- если в PR меняется semantics/state persistence в `watchers.yml`, туда же стоит включать comment-preservation
  guarantees и соответствующие tests.

## Требования AGENTS.md (после завершения)

- [ ] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [ ] Задокументировать breaking changes (если есть)
- [ ] Проверить backward compatibility
- [ ] Обновить `README.md` или соответствующую спецификацию в `docs/`,
      если поведение изменилось
- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Запустить `yarn lint` для проверки стиля кода
