# TODO: Semantics bugs in current branch

## Статус

- [x] Priority umbrella for the current branch semantics/runtime bugs

## Зачем нужен этот файл

В текущей ветке (`feat/state-semantics-success-since`, после расхождения с `master`) накопилось несколько связанных
runtime/state-semantics проблем вокруг `force_search_ahead`, `last_known_mirror`, `success_since` и replacement
surface.

Часть из них уже исправлена и покрыта тестами. Часть всё ещё открыта и требует отдельной правки спецификации,
README, runtime и regression-тестов. Этот TODO — верхний приоритетный трек, который связывает все такие баги в одну
понятную цепочку.

## Что уже исправлено и покрыто тестами

- [x] Не терять текущий рабочий alias при `force_search_ahead`, если он редиректит в общий final host
      — см. `✅TODO_force_search_ahead_current_alias_loss.md`
- [x] Не переписывать `success_since` на каждом run без реального изменения effective state
      — см. `✅TODO_runtime_churn_and_domain_wrapper.md`, Phase 1
- [x] Расширять single-domain `[$domain=old.com]` дополнительными рабочими доменами
      — см. `✅TODO_runtime_churn_and_domain_wrapper.md`, Phase 2
- [x] Удалять `success_since` при переходе `success -> failed`
      — см. `✅TODO_runtime_churn_and_domain_wrapper.md`, Phase 3

## Что остаётся открытым и ещё не закрыто тестами

### 1. Mixed pattern/non-pattern contamination in `force_search_ahead`

- [x] Исправлено
- [x] Есть dedicated regression test, который доказывает, что non-pattern из `additionalWorkingDomains`
      не может попасть в `last_known_mirror`
- [x] Есть regression test, который доказывает, что такой non-pattern не попадает в replacement rules

Связанный child TODO:

- [x] `✅TODO_force_search_ahead_mixed_pattern_nonpattern.md`

### 2. Canonical mirror semantics: alias candidate vs final redirect host

- [x] Решено по контракту
- [x] Есть явная спека, что canonical mirror при `many candidates -> one final host` — минимальный pattern alias
- [x] Есть dedicated regression test на ожидаемую canonicalization policy

Связанный child TODO:

- [x] `✅TODO_heuristic_alias_canonicalization.md`

## Итог выполнения

1. `✅TODO_force_search_ahead_mixed_pattern_nonpattern.md` закрыт
2. `✅TODO_heuristic_alias_canonicalization.md` закрыт
3. Runtime/spec/tests/README синхронизированы; дальнейшие работы вынесены в отдельные backlog tracks

## Почему mixed-pattern/non-pattern должен идти первым

Это уже не просто semantic ambiguity, а реальный runtime bug:

- при живых pattern-доменах non-pattern может попасть в `last_known_mirror`;
- это может сломать watcher state и следующий heuristic run;
- это может загрязнить replacement target / filter update surface;
- проблема воспроизводится на реальном кейсе (`dizipal2071.com`).

## Что обязательно сделать в рамках этого umbrella-трека

- [x] Обновить `docs/specs.md`
- [x] Обновить `README.md`
- [x] Добавить/обновить regression tests в `__tests__/`
- [x] Прогнать `yarn build`
- [x] Прогнать `yarn test`
- [x] Прогнать `yarn lint`, если изменения затронут runtime code

## Child TODOs

- `✅TODO_force_search_ahead_mixed_pattern_nonpattern.md`
- `✅TODO_heuristic_alias_canonicalization.md`
- `✅TODO_force_search_ahead_current_alias_loss.md` (уже закрыт; retained here as history)
- `✅TODO_runtime_churn_and_domain_wrapper.md` (уже закрыт; retained here as history)