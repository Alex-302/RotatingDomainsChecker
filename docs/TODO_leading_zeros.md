# TODO - Heuristic: preserve leading zeros in numeric pattern

## Status: [ ] Open

## Problem

`generateCandidates()` в `src/batch.ts:314-323` теряет leading zeros при генерации кандидатов.

### Текущее поведение

```typescript
const currentNum = parseInt(numStr, 10);  // "003" → 3
const startNum = currentNum + 1;          // 4

for (let i = 0; i < this.config.heuristic.maxAttempts; i++) {
  const num = startNum + i;  // 4, 5, 6
  const candidateUrl = `${prefix}${num}${suffix}`;
  // "example" + 4 + ".com" = "example4.com"  ← потерял нули!
}
```

### Пример

| Вход | Сгенерирует | Должен |
|---|---|---|
| `dizipal2065.com` | `dizipal2066, 2067, …` ✅ | `dizipal2066, 2067, …` ✅ |
| `dizipal065.com` | `dizipal66, 67, …` ❌ | `dizipal066, 067, …` |
| `example003.com` | `example4, 5, …` ❌ | `example004, 005, …` |
| `testsite1.com` | `testsite2, 3, …` ✅ | `testsite2, 3, …` ✅ |

### Влияние

- **Критичность**: низкая — большинство реальных сайтов в `watchers.yml` используют числа без leading zeros
- **Воздействие**: скрипт будет проверять несуществующие домены, тратя время и ресурсы
- **Вероятность**: низкая — формат `example001.com` встречается редко

## Proposed Fix

Сохранить длину исходной строки `numStr` и использовать `padStart` при генерации:

```typescript
const originalLen = numStr.length;
const padLen = numStr.startsWith('0') ? originalLen : 0;

const currentNum = parseInt(numStr, 10);
const startNum = currentNum + 1;

for (let i = 0; i < this.config.heuristic.maxAttempts; i++) {
  const num = startNum + i;
  const numStr = padLen > 0
    ? String(num).padStart(padLen, '0')
    : String(num);
  // ...
}
```

## Testing

Добавить тесты в `__tests__/batch.test.ts`:

```typescript
test('heuristic: preserves leading zeros in pattern (example003 → example004)', async () => {
  const site = makeSite({ last_known_mirror: 'example003.com' });
  // ... expect candidates: example004.com, example005.com
});

test('heuristic: no leading zeros → no padding (example3 → example4)', async () => {
  const site = makeSite({ last_known_mirror: 'example3.com' });
  // ... expect candidates: example4.com, example5.com
});
```

## Related Files

- `src/batch.ts:314-323` — место генерации кандидатов
- `__tests__/batch.test.ts` — тесты для heuristic pattern generation
