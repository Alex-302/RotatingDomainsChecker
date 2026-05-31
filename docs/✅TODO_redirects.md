# ТЗ: Ранний выход при probe_text + JS redirect

## Проблема

При цепочке `рабочий домен → JS redirect → парковка/decoy` система доходит до последнего домена, probe_text не
совпадает → проверка падает → запускается эвристика, хотя рабочий домен был найден.

### Сценарий

```
betist219tv.live → HTTP redirect → betist220tv.live  (200, probe_text найден ✅)
    → JS location.replace() → tackchen.gitee.io (404, probe_text нет ❌)
```

Текущее поведение: следует по JS redirect до конца, probe_text не совпадает на финальном домене → `failed`.

Ожидаемое поведение: если probe_text найден на промежуточном домене, а следующий redirect — это JS redirect (не HTTP
Location header), остановиться и вернуть текущий домен как успешный.

## Почему это важно

Сайты используют JS redirect (`location.replace()`) как защиту от клонов и запуска devtools. Настоящий рабочий сайт
содержит probe_text, но редиректит на "decoy" страницу. Сейчас чекер не может использовать найденный рабочий домен.

## Что уже реализовано

- ✅ `extractJsRedirect` — парсит `meta refresh`, `location.replace()`, `window.location.href`, `location.href`
- ✅ Цепочечная обработка HTTP + JS redirects (`while` cycle с `redirectDepth`)
- ✅ `skip_text` проверяется на каждом шаге цепочки
- ✅ `probe_text` проверяется на каждом шаге, но результат используется только на финальном домене

## Решение

### Логика в `httpResolver.ts`

В цикле `resolve()` после обнаружения JS redirect:

```typescript
const jsRedirectUrl = this.extractJsRedirect(finalBody, currentUrl);
if (jsRedirectUrl) {
  // NEW: если probe_text уже совпал на текущем домене — остановиться
  // JS redirect — это клиентская логика, часто защита от клонирования.
  // HTTP Location redirect — серверный, обычно надёжный.
  if (hasProbeText) {
    return {
      success: true,
      finalUrl: currentUrl,         // текущий домен, не jsRedirectUrl
      finalHost: new URL(currentUrl).hostname,
      statusCode: response.status,
      redirectChain: chain,
      antibotDetected: false,
      finalBody,
      probeTextMatchedBeforeJsRedirect: true,  // флаг для логирования
    };
  }

  // 기존: продолжаем следовать JS redirect
  chain[chain.length - 1].location = jsRedirectUrl;
  currentUrl = jsRedirectUrl;
  depth++;
  // ...
}
```

### Детали

- **Применяется только к JS redirects** (`location.replace`, `window.location.href`, `location.href`)
- **Не применяется к meta refresh** — это серверно-подобный redirect, обычно легитимный
- **Требует probe_text** — если probe_text не настроен, поведение не меняется

### Логирование

```
[Site] probe_text matched on betist220tv.live, JS redirect detected → stopping chain
       (would redirect to: tackchen.gitee.io)
```

### Флаг в RedirectResult

```typescript
interface RedirectResult {
  // ...existing fields...
  /** True when probe_text matched on an intermediate domain but JS redirect was not followed */
  probeTextMatchedBeforeJsRedirect?: boolean;
}
```

### Побочные эффекты

1. **index.ts** — использовать `effectiveNewHost = result.finalHost` когда `probeTextMatchedBeforeJsRedirect = true`
2. **batch.ts** — не запускать эвристику если probe_text уже найден
3. **git.ts** — логировать что JS redirect был проигнорирован

## Интеграция с force_search_ahead

### Они НЕ взаимоисключающие

| Фаза | Что происходит | Применимо |
|------|---------------|-----------|
| **Phase 1** — проверка текущего/первичного домена | Ранний выход по probe_text + JS redirect | ✅ Новая фича |
| **Phase 2** — эвристика (кандидаты) | force_search_ahead продолжает искать все кандидаты | ✅ Уже работает |

### Сценарий интеграции

```
betist219tv.live (last_known_mirror)
  → HTTP redirect → betist220tv.live  (200, probe_text найден ✅)
    → JS location.replace() → tackchen.gitee.io (decoy)
```

**Ранний выход (новая фича):**
- `betist220tv.live` возвращён как успешный результат
- `result.finalHost = "betist220tv.live"`, `result.probeTextMatchedBeforeJsRedirect = true`

**force_search_ahead:**
- Если у сайта `force_search_ahead: true` → эвристика всё равно запускается
- Проверяются кандидаты `betist221tv.live`, `betist222tv.live` и т.д.
- Все дополнительные рабочие домены собираются в `additionalWorkingDomains`

**Итог:**
- `last_known_mirror` = `betist220tv.live` (из раннего выхода)
- `additionalWorkingDomains` = `[betist221tv.live, betist222tv.live, ...]` (из эвристики)
- Фильтры получают все домены через `replacer.ts`

### Что нужно учесть

1. **batch.ts строка ~453:**
   ```typescript
   // Уже: (failed || forceHeuristic || site.force_search_ahead) && !skipHeuristic
   // Ранний выход по probe_text возвращает success=true, но force_search_ahead
   // должен дополнительно проверяться для продолжения поиска
   // Решение: добавить shouldTriggerHeuristic в RedirectResult
   ```

2. **shouldTriggerHeuristic при раннем выходе:**
   - Если `force_search_ahead: true` → `shouldTriggerHeuristic = true` даже при `success: true`
   - Это позволит эвристики продолжиться после успешного раннего выхода
   - Существующая логика в `batch.ts` строка ~520 уже проверяет `r.result.shouldTriggerHeuristic`

3. **index.ts — обработка replacements:**
   - Первичная замена: `result.finalHost` → `betist220tv.live`
   - Дополнительные замены: `additionalWorkingDomains` из эвристики

### Тестовые случаи для force_search_ahead интеграции

7. **probe_text найден + JS redirect + force_search_ahead** → ранний выход на текущий домен, эвристика запущена, все
   кандидаты собраны ✅
8. **probe_text найден + JS redirect + NO force_search_ahead** → ранний выход, эвристика НЕ запущена ✅
9. **probe_text найден + HTTP redirect + force_search_ahead** → следовать HTTP redirect, затем эвристика ✅

## Тестовые случаи

1. **[x] probe_text найден + JS redirect** → остановить, вернуть текущий домен ✅
2. **[x] probe_text найден + meta refresh** → продолжить (meta refresh — это не JS) ✅
3. **[x] probe_text НЕ найден + JS redirect** → продолжить (старое поведение) ✅
4. **[x] probe_text найден + HTTP redirect** → продолжить (HTTP redirect — серверный) ✅
5. **[x] probe_text не настроен + JS redirect** → продолжить (старое поведение) ✅
6. **[x] Цепочка JS redirect → meta redirect** → остановить на первом JS если probe_text совпал ✅ (покрыт ранним exit — если probe совпал до JS, цепочка останавливается)
7. **[x] probe_text найден + JS redirect + force_search_ahead** → ранний выход + эвристика ✅
8. **[x] probe_text найден + JS redirect + NO force_search_ahead** → ранний выход без эвристики ✅

## Файлы для изменения

- [x] `src/httpResolver.ts` — основная логика раннего выхода + `shouldTriggerHeuristic`
- [x] `src/types.ts` — добавить `probeTextMatchedBeforeJsRedirect` в `RedirectResult`
- [x] `src/index.ts` — обработка нового флага (не требуется — флаг обрабатывается через shouldTriggerHeuristic)
- [x] `src/batch.ts` — корректная обработка результата (ранний выход + force_search_ahead, уже работает через shouldTriggerHeuristic)
- [x] `__tests__/httpResolver.test.ts` — тесты нового поведения

### 10. Обновить документацию

- [x] Обновить `docs/specs.md` — добавлена секция 5.5a "Early Exit on JS Redirect When probe_text Matched"
- [x] Обновить `README.md` — пункт 3 в "Replacement Logic" описывает early exit

## Требования AGENTS.md (после завершения)

- [x] Обновить/добавить тесты в `__tests__/` для новой функциональности (8 тестов в секции 6.12)
- [x] Задокументировать breaking changes (нет breaking changes, backward compatible)
- [x] Проверить backward compatibility (старое поведение без probe_text не изменилось)
- [x] Обновить `README.md` и `docs/specs.md` (пункт 3 в Replacement Logic + секция 5.5a)
- [x] Запустить `yarn build` для проверки сборки
- [x] Запустить `yarn test` для проверки тестов (415 тестов проходят)
- [x] Запустить `yarn lint` для проверки стиля кода (0 ошибок)
