# 01. Shared Real-Update Predicate (`isRealDomainChange`)

## Goal

Создать единую функцию, которая отвечает на вопрос: "является ли данная замена реальным обновлением mirror?"
Она должна опираться на original `last_known_mirror` (сохранённый до старта проверки), а не только на `startedHost`.

## Зачем это нужно

Сейчас критерии расходятся между тремя слоями:

- **`src/index.ts`** (`hasUniqueDomainChanges`) — уже использует `originalLastKnownMirrors` **✔️**
- **`src/replacer.ts`** (фильтр `Redirected domains` таблицы) — уже использует `originalMirrors` **✔️**
- **`src/git.ts`** (`buildCommitMessage`) — **НЕТ** доступа к `originalLastKnownMirrors`, фильтрует только по
  `startedHost !== newHost` **❌**

Из-за этого в commit message попадают ложные "Updated domains", когда `startedHost` (entrypoint вроде `t.co`)
редиректит на тот же `last_known_mirror`, что уже был до старта.

## 🐛 Блокирующая проблема: `buildCommitMessage()` в `git.ts` не имеет доступа к originalLastKnownMirrors

Текущий код в `git.ts`:
```typescript
const uniqueChanges = [...primaryBySite.values()].filter(r => {
  const fromHost = r.startedHost || r.oldHost;
  return fromHost !== r.newHost;
});
```

**Контрпример:**
- `t.co → hdfilmcehennemi27.org`, где `originalLastKnownMirror` уже был `hdfilmcehennemi27.org`
- `startedHost = t.co !== hdfilmcehennemi27.org` = `true` → сайт попадает в "Updated domains"
- Хотя mirror не изменился — это просто redirect через entrypoint.

## Решение — упрощённое (без правки типов)

`originalLastKnownMirrors` создаётся в начале `main()` (строка ~87) и живёт до самого конца.
`commitOrCreatePR()` вызывается на строке ~728 — в той же функции, map уже в scope.

Достаточно:
1. Добавить опциональный параметр `originalLastKnownMirrors: Map<string, string> | undefined`
   в `commitOrCreatePR(summary, dryRun, originalLastKnownMirrors)` и `buildCommitMessage(summary, originalLastKnownMirrors)`.
2. В `buildCommitMessage` заменить фильтр на проверку через этот map.
3. Вынести `isRealDomainChange()` в `src/utils.ts` — переиспользовать в `index.ts` и `replacer.ts`.

**Не нужно:**
- Поле `originalLastKnownMirror` в `ReplacementPair` ❌
- Изменение `Summary` type ❌
- Сложная маршрутизация данных ❌

## Ожидаемая сигнатура

```typescript
// src/utils.ts
export function isRealDomainChange(
  replacement: ReplacementPair,
  originalLastKnownMirrors?: Map<string, string>,
): boolean {
  const originalMirror = originalLastKnownMirrors?.get(replacement.siteName);
  if (originalMirror !== undefined) {
    return replacement.newHost !== originalMirror;
  }
  // fallback: old behaviour
  const fromHost = replacement.startedHost || replacement.oldHost;
  return fromHost !== replacement.newHost;
}
```

## Изменения по файлам

### `src/git.ts`

```typescript
// Сигнатура
async commitOrCreatePR(
  summary: Summary,
  dryRun: boolean,
  originalLastKnownMirrors?: Map<string, string>,
): Promise<{...}>

// buildCommitMessage
private buildCommitMessage(
  summary: Summary,
  originalLastKnownMirrors?: Map<string, string>,
): string {
  const primaryBySite = new Map(...);
  const uniqueChanges = [...primaryBySite.values()].filter(r =>
    isRealDomainChange(r, originalLastKnownMirrors)
  );
  // ...
}
```

### `src/index.ts`

```typescript
// Вызов — просто передать существующий map
gitResult = await gitManager.commitOrCreatePR(summary, dryRun, originalLastKnownMirrors);

// hasUniqueDomainChanges — заменить на isRealDomainChange
const hasUniqueDomainChanges = [...primaryBySite.values()].some(r =>
  isRealDomainChange(r, originalLastKnownMirrors)
);
```

### `src/replacer.ts`

```typescript
// Фильтр Redirected domains таблицы — заменить на isRealDomainChange
const uniqueChanges = [...primaryBySite.values()].filter(r =>
  isRealDomainChange(r, originalMirrors)
);
```

## Подзадачи

- [x] Создать `isRealDomainChange()` в `src/utils.ts`, добавить export
- [x] `src/git.ts`: добавить параметр `originalLastKnownMirrors` в `commitOrCreatePR()` и `buildCommitMessage()`
- [x] `src/git.ts`: заменить фильтр в `buildCommitMessage()` на `isRealDomainChange()`
- [x] `src/git.ts`: обновить `getPRModeInfo()` — туда тоже нужно прокинуть (он вызывает buildCommitMessage)
- [x] `src/index.ts`: передать `originalLastKnownMirrors` в `gitManager.commitOrCreatePR()`
- [x] `src/index.ts`: заменить `hasUniqueDomainChanges` на `isRealDomainChange()`
- [x] `src/replacer.ts`: заменить фильтр Redirected domains таблицы на `isRealDomainChange()`
- [x] `__tests__/git.test.ts`: обновить mock-и для новой сигнатуры (опциональный параметр)
- [x] `__tests__/utils.test.ts`: unit-тесты `isRealDomainChange()` (см. `04_regression_tests.md`)
- [x] Убедиться, что backward compatibility соблюдена: без `originalLastKnownMirrors` функция ведёт себя как раньше

## Где смотреть

- `src/utils.ts` — новая функция
- `src/git.ts` — сигнатура + фильтр
- `src/index.ts` — вызов + hasUniqueDomainChanges → isRealDomainChange
- `src/replacer.ts` — фильтр Redirected domains таблицы
- `__tests__/git.test.ts`, `__tests__/utils.test.ts`

## Зависимости

Нет. Это **первый** шаг — без него остальная работа по разведению semantics не имеет смысла.
