# TODO - Rotating Domains Checker

## Product / Runtime

[x] [✅TODO_semantics.md](✅TODO_semantics.md): Приоритетный umbrella-трек по semantics/runtime-багам текущей ветки.
  Закрыт 2026-05-25: зафиксированы mixed pattern/non-pattern правила в `force_search_ahead`,
  canonical mirror semantics для alias-vs-final-host, runtime/tests/spec/README обновлены.
[x] [✅TODO_force_search_ahead_mixed_pattern_nonpattern.md](✅TODO_force_search_ahead_mixed_pattern_nonpattern.md):
  Mixed pattern/non-pattern canonicalization в `force_search_ahead` **(DONE 2026-05-25)**
[x] [✅TODO_heuristic_alias_canonicalization.md](✅TODO_heuristic_alias_canonicalization.md): Canonical mirror при
  `many candidates -> one final host` — минимальный reachable pattern alias **(DONE 2026-05-25)**
[x] [✅TODO_blocker_syntax_coverage.md](✅TODO_blocker_syntax_coverage.md): Проверить и дожать parser/test coverage для
  ABP/uBO/AdGuard domain-list markers и modifiers **(DONE 2026-05-23)**
[x] [✅TODO_non_pattern_mirror_runtime.md](✅TODO_non_pattern_mirror_runtime.md): Runtime-semantic для
  `non_pattern_mirror` и защита `last_known_mirror` от перезаписи non-pattern доменом **(DONE 2026-05-24)**
[x] [✅TODO_force_search_ahead_current_alias_loss.md](✅TODO_force_search_ahead_current_alias_loss.md): Не терять текущий
  рабочий alias `last_known_mirror`, если он редиректит в общий final host **(DONE 2026-05-24)**
[x] [✅TODO_force_search_ahead_heuristic_alias_ordering.md](✅TODO_force_search_ahead_heuristic_alias_ordering.md):
  Order-dependent bug: redirecting heuristic alias can disappear from `workingDomains` and then from filter rules
  depending on whether its shared final host was collected earlier
[ ] [TODO_duplicate_domains_after_replacement.md](TODO_duplicate_domains_after_replacement.md): Дубликаты доменов в
  filter rules после replacements для discovery-entrypoint / non-pattern cases
[x] [✅TODO_redirects.md](✅TODO_redirects.md): Ранний выход при `probe_text` + JS redirect **(DONE 2026-05-31)**
[ ] [TODO_heuristic.md](TODO_heuristic.md): Улучшения эвристики: множественные числа, списки зеркал
[ ] [TODO_leading_zeros.md](TODO_leading_zeros.md): Сохранять leading zeros при генерации кандидатов (example003 → example004, а не example4)
[ ] [TODO_parked_domain.md](TODO_parked_domain.md): Детект parked-доменов по заголовкам и дополнительным сигналам
[ ] [TODO_same_pattern_watcher_isolation.md](TODO_same_pattern_watcher_isolation.md): Изолировать watcher-ы с одинаковым
  numeric pattern в replacement/cleanup logic
[x] [✅TODO_state_semantics.md](✅TODO_state_semantics.md): Семантика watcher state: rename `last_seen` → `success_since`,
  миграция, noise suppression и `failed_days` day-bucket — **DONE 2026-05-24**
  (state churn полностью подавлен; +8 тестов в `__tests__/index.test.ts` секции 11.4/11.5)
[ ] [TODO_watchers_comments.md](TODO_watchers_comments.md): Сохранение комментариев и структуры в `watchers.yml` при
  runtime update
[x] [✅TODO_summary_reporting/README.md](✅TODO_summary_reporting/README.md): Не смешивать redirect-only и real mirror
  updates в summary/commit message; разложено по этапам в `docs/✅TODO_summary_reporting/`
[ ] [TODO_artifact_link.md](TODO_artifact_link.md): Разобраться с битой ссылкой `View detailed log` на artifacts/run page
[x] [✅TODO_runtime_churn_and_domain_wrapper.md](✅TODO_runtime_churn_and_domain_wrapper.md): Runtime-баги для
  force_search_ahead: `success_since` перезаписывается при каждом run несмотря на идентичный effective state;
  `[$domain=old.com]##rule` не расширяется дополнительными рабочими доменами (в отличие от `domain1,domain2##rule`);
  при переходе success → failed `success_since` не удалялся (семантический конфликт с `failed_since`)
  **(DONE 2026-05-25, Phase 1: guard в shouldUpdate, Phase 2: см. ✅TODO_domain_wrapper_expansion.md, Phase 3: delete success_since on failure)**
[x] [✅TODO_domain_wrapper_expansion.md](✅TODO_domain_wrapper_expansion.md): Wrapper parity for single-domain
  `[$domain=old.com]` expansion via the common domain-list pipeline **(DONE 2026-05-25)**
[x] [✅TODO_runtime_churn_suppression.md](✅TODO_runtime_churn_suppression.md): Narrow split file for
  `success_since` churn suppression under `force_search_ahead` **(DONE 2026-05-25; kept as history)**

## Docs / Spec Alignment

[x] [✅TODO_spec_alignment.md](✅TODO_spec_alignment.md): Align `specs.md`, `README.md`, types, and runtime **(DONE 2026-05-24)**
  Формат всех date-полей (`success_since`, `failed_since`) унифицирован к `YYYY-MM-DD HH:MM`, `non_pattern_mirror`
  runtime реализован, `forced DNS helper` стабилизирован, терминология `pattern_changed` согласована.
  В рамках этого трека также выполнен rename `last_seen` → `success_since` и state-churn suppression
  (см. `✅TODO_state_semantics.md` статус 2026-05-24).

[ ] [TODO_spec_runtime_drift.md](TODO_spec_runtime_drift.md): 4 расхождения между specs и runtime, найденные при
  аудите 2026-05-23: DNS preflight threshold, log при preflight failure, updated-count output, skip_text vs JS redirect
  order

## Ops / Release

[ ] [TODO_monitoring.md](TODO_monitoring.md): Уведомления о критических изменениях
[ ] [TODO_publish.md](TODO_publish.md): Публикация GitHub Action в Marketplace

## Code Quality

[x] [✅TODO_code_audit_agents.md](✅TODO_code_audit_agents.md): Привести код в
  соответствие с правилами AGENTS.md — замена `any` на `unknown`, устранение
  пустых `catch {}`, рефакторинг Promise chains, внедрение стриминга для
  больших файлов.
  **(DONE 2026-05-30: streaming в replacer.ts через readline/promises + createReadStream;
  config.ts: loadConfig/loadWatchers/saveWatchers конвертированы в async;
  все call sites и тесты обновлены. 403 тестов проходят.)**
[ ] [TODO_atomic_writes.md](TODO_atomic_writes.md): Безопасная atomic-запись user-facing файлов (`replacer.ts`,
  `saveWatchers()`) с отдельной оценкой Windows/POSIX semantics и альтернатив реализации
[x] [✅TODO_shared_utils.md](✅TODO_shared_utils.md): Вынести дублирующиеся функции
  `naturalCompare` и `calculateDaysSince` в общий модуль `src/utils.ts`
  **(DONE 2026-05-26)**

## Notes

[⏳] [⏳TODO_plan.md](⏳TODO_plan.md): Рабочий план цикла по state semantics и spec alignment — основной трек DONE 2026-05-24, открыты задачи 2.5 (watchers comments) и 3 (redirect bugfix)
[ ] `specs_discovery_entrypoint.md` is already split into a standalone spec and does not need an additional TODO file.
[ ] Устаревший `TODO_small.md` удалён: его пункты либо уже реализованы, либо перенесены в более точные backlog-файлы.
