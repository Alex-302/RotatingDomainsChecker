# TODO: Summary Reporting

> Не смешивать redirect-only и real mirror updates в summary / commit message.
> Разложено на упорядоченные этапы реализации.

## Проблема

Сейчас разные части отчётности используют разные критерии "обновления домена":

- таблица `Redirected domains` честно показывает, что стартовый/redirect source домен ушёл на другой домен;
- блок `Updated domains` в commit message иногда показывает те же сайты как "обновлённые", даже если целевой рабочий
  mirror относительно предыдущего `last_known_mirror` фактически не изменился.

Из-за этого в операторском сообщении появляются отвлекающие ложные обновления.

## Наблюдаемый пример

Из GitHub Actions:

```
Redirected domains
Turkifsaclub (turkifsaclub*.sbs)  turkifsaclub124.sbs  -> turkifsaclub125.sbs
PapazSports (papazsports*.pro)    papazsports922.pro   -> papazsports1010.pro

Updated domains:
Turkifsaclub (turkifsaclub*.sbs)       turkifsaclub124.sbs  → turkifsaclub125.sbs
HDFilmCehennemi (hdfilmcehennemi*.org) t.co                 → hdfilmcehennemi27.org
voe.sx                                 voe.sx               → ericeastweight.com
PapazSports (papazsports*.pro)         papazsports922.pro   → papazsports1010.pro
```

При этом `HDFilmCehennemi` и `PapazSports` не должны попадать в `Updated domains` —
их `last_known_mirror` не изменился, изменился только `startedHost` (redirect source).

## Локализованная причина

- в `src/index.ts` есть логика `hasUniqueDomainChanges`, которая уже умеет отличать реальное изменение mirror;
- в `src/git.ts` блок `Updated domains` фильтрует по `startedHost || oldHost !== newHost` — сравнивает
  стартовый источник проверки с найденным доменом, а не найденный домен с исходным `last_known_mirror`.

Следствие: discovery-entrypoint (`t.co`), redirect-only и force_search_ahead кейсы выглядят
как "обновление домена", хотя это не update replacement-target.

## Ожидаемое поведение

1. **`Redirected domains`** — диагностика, все redirect-цепочки (даже если mirror не изменился).
2. **`Mirror updates`** — только реальные изменения `last_known_mirror`.
3. **`Pattern domains list updates`** — diff по паттерновым доменам в фильтрах.
4. **`Changed pattern → non-pattern domains`** — переходы pattern→non-pattern.

## Порядок выполнения

| Этап | Файл | Что делает |
|------|------|-----------|
| 01 | `01_shared_real_update_predicate.md` | Единый критерий `isRealDomainChange()` в shared utils |
| 02 | `02_summary_semantics.md` | Разделение секций, Summary type, console counters |
| 03 | `03_replacer_pattern_diff.md` | Сбор и вывод per-watcher pattern diff из replacer |
| 04 | `04_regression_tests.md` | Регрессионные тесты для всех сценариев |

## Где смотреть

- `src/index.ts`
- `src/git.ts`
- `src/replacer.ts`
- `src/types.ts`
- `src/utils.ts`
- `__tests__/index.test.ts`, `git.test.ts`, `utils.test.ts`, `replacer.test.ts`
- `docs/specs.md`
- `README.md`

## Комментарий по scope

Это не блокирующий runtime bug в поиске доменов, а reporting bug.
Но он создаёт шум и мешает быстро читать результаты прогона.

## Notes

Legacy monolithic TODO: `docs/TODO_summary_reporting.old`
Umbrella item in `docs/TODO.md`: `TODO_summary_reporting/README.md`

## Notes

The legacy monolithic TODO was archived as `docs/TODO_summary_reporting.old`.
The umbrella item in `docs/TODO.md` now points to this folder.
