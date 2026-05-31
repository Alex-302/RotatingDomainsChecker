# TODO: Улучшение детектирования паркованных доменов

## Текущая реализация

`skip_text` в `config.yml` — список фраз, при наличии которых в теле ответа домен считается паркованным/мёртвым.
Проверяется в `httpResolver.ts → containsSkipText()`.

Проблема: только text-based детект. Некоторые парковщики не оставляют явных текстовых маркеров.

## Задачи

### 1. Детект по заголовкам ответа (headers-based)

Парковочные сервисы (parklogic.com и др.) выставляют характерные заголовки:

```
permissions-policy: ch-ua=(self "https://*.parklogic.com"), ch-ua-arch=(self "https://*.parklogic.com"), ...
```

**Реализация:**
- Добавить в `config.yml`: `skip_headers` — список паттернов заголовков
- Проверять заголовки ответа в `httpResolver.ts` аналогично `skip_text`

```yaml
# config.yml
skip_headers:
  - "parklogic.com"
  - "domainparking.com"
  - "sedo.com"
```

### 2. Детект по характерным body-фразам (редиректы на парковку)

Страницы-перехватчики, которые делают JS-редирект на парковку, часто имеют характерное содержимое:

Добавить в `skip_text` в `config.yml`:
```yaml
skip_text:
  - "Redirecting..."        # уже может быть
  - "window.location.href"  # JS redirect на парковку без probe_text
  - "router.parklogic.com"  # parklogic router
  - "Temporary Redirect"
```

Это расширение существующего механизма, не требует изменений кода.

### 3. Защита от false positives

При добавлении новых фраз в `skip_text` важно не заблокировать рабочие сайты.
Существующий механизм `skip_text_allow` (per-site override) уже решает эту задачу.

## Требования AGENTS.md (после завершения)

- [ ] Обновить тесты в `__tests__/httpResolver.test.ts` для header-based детекта
- [ ] Задокументировать новые поля конфига (`skip_headers`) в `docs/specs.md` и
      `README.md`
- [ ] Задокументировать breaking changes (если есть)
- [ ] Проверить backward compatibility
- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Запустить `yarn lint` для проверки стиля кода

## Связи

- `src/httpResolver.ts` — `containsSkipText()`, добавить `containsSkipHeaders()`
- `src/config.ts` — расширить тип `Config` полем `skip_headers`
- `config.yml` — добавить `skip_headers` секцию
- `__tests__/httpResolver.test.ts` — тесты для header-based детекта
