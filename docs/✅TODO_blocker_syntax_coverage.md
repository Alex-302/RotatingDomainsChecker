# TODO: Закрыть покрытие blocker syntax cases для replacer

## Оптимальный план реализации

### Этап 1. Сразу закрыть regression tests на каждый новый case, чтобы подтвердить проблемы

- [x] Добавить unit tests на exception markers, `$$` / `$@$`, uBO forms `##^...`, `#@#^...`, `##+js(...)`, `#@#+js(...)`, а также list-valued modifiers;
- [x] Добавить unit tests на literal `[$domain=...]`;
- [x] Добавить unit tests на wildcard single/mixed cases.

### Этап 2. Сначала закрыть parser bugs с минимальным риском

- [x] Вынести единый список marker-ов в общую константу;
- [x] Исправить порядок поиска marker-ов в `processLine()`: exception markers раньше базовых;
- [x] Добавить отдельную обработку `$$` / `$@$` до `$modifier=` parsing;
- [x] Синхронизировать `shouldSkipLine()` с тем же набором marker-ов.

### Этап 3. Потом расширить поддерживаемые входные формы

- [x] Добавить literal parsing для `[$domain=...]`;
- [x] Зафиксировать единое поведение для `$domain=`, `$from=`, `$denyallow=`, `$to=`;
- [x] Явно сохранить правило: wildcard-домены с `*` не заменяются.

### Этап 4. Добить file-based integration path

- [x] Добавить fixture с mixed marker families;
- [x] Проверить полный `FilterReplacer.applyReplacements()` end-to-end;
- [x] Убедиться, что новый parser contract не ломает уже рабочие `||host^` и `$domain=` cases.

### Этап 5. После кода закрыть contract и валидацию

- [x] Обновить `docs/specs.md` и `README.md`, если runtime contract уточнился;
- [x] Запустить `yarn build`, `yarn test`, `yarn lint`;
- [x] Сверить итог с Definition of Done ниже.

## Проблема

После расширения [docs/specs.md](c:/Work/AdGuard/Repos/Other/Alex-302/RotatingDomainsChecker/docs/specs.md)
runtime и tests в `src/replacer.ts` / `__tests__/replacer.test.ts` отстают от обещанного blocker-facing surface.

Сейчас спецификация уже описывает replacement как общий domain-list layer для ABP / EasyList, uBO и AdGuard
blocker syntax, но код и тесты покрывают только часть marker families и modifier forms.

## Подтверждённые факты по текущему коду

### 1. Что уже покрыто

- comma-separated hostname lists перед `##`;
- direct network tokens вида `||domain^`;
- list-valued parameters в форме `$domain=...|...`;
- generic path для `param=value` / `param=value1|value2` в хвосте после `$...`.

### 2. Что подтверждённо не покрыто или покрыто неверно

#### Marker families before non-network rules

В `processLine()` сейчас ищутся только:

- `##`
- `#$#`
- `#?#`
- `#$?#`
- `#%#`

В `shouldSkipLine()` используется тот же узкий набор marker-ов.

Из-за этого не покрыты или работают неверно:

- `#@#`
- `#@$#`
- `#@?#`
- `#@$?#`
- `#@%#`
- `$$` / `$@$`
- uBO forms `##^...`, `#@#^...`, `##+js(...)`, `#@#+js(...)`

#### Критичный баг: `#@##` ломается

Строка `example001.com#@##smartbanner.ios` сейчас не "инцидентно работает", а ломается.

Причина:

- `indexOf("##")` находит `##` внутри `#@##`;
- левая часть становится `example001.com#@`;
- `#@` попадает в список доменов.

Это нужно считать обычным parser bug, а не частичной поддержкой.

#### `$$` / `$@$` конфликтуют с `$modifier=` parsing

После marker-поиска `processLine()` пытается обработать хвост через:

```typescript
out.match(/\$([^$]+)$/)
```

Для `example126tv.com$$script:contains(duyuruModal)` это даёт ложный заход в `$param`-ветку. Сейчас строка не
ломается только потому, что в хвосте нет `=`. Это случайность, а не корректная поддержка.

#### Wrapper syntax `[$domain=...]` вообще не виден текущему parser-у

Строки вида:

```text
[$domain=example001.com|nopattern.com]#%#//scriptlet('set-constant', 'ads', 'false')
```

сейчас не попадают:

- ни в cosmetic-ветку, потому что marker идёт после `]`;
- ни в `$param`-ветку, потому что parsing хвоста ориентирован на финальный `$...`, а не на prefix-wrapper.

#### Wildcard domains должны сохраняться как есть

Домены с `*` не должны подвергаться замене.

Пример ожидаемого поведения:

- `example.*##.ad` — не меняется;
- `nopattern.com,example.*,testsite.com##.banner` — меняются только полные домены, `example.*` остаётся как есть.

#### `$from=` / `$denyallow=` / `$to=` считаются domain-list modifiers

Для этого TODO принято решение:

- `$from=`
- `$denyallow=`
- `$to=`

обрабатываются так же, как `$domain=`: список доменов с разделителем `|`.

Регексы в значении должны пропускаться без замены:

```text
$domain=/regexp/
$from=/regexp/
$to=/regexp/
```

В рамках этого TODO речь только про literal domain lists. Regex-based values не поддерживаются и не должны
преобразовываться.

## Что взять из FiltersCompiler как ориентир

В `AdguardTeam/FiltersCompiler` / `@adguard/agtree` уже есть явные маски для этих marker-ов:

- `MASK_ELEMENT_HIDING` → `##`
- `MASK_ELEMENT_HIDING_EXCEPTION` → `#@#`
- `MASK_CSS_INJECT_RULE` → `#$#`
- `MASK_CSS_EXCEPTION_INJECT_RULE` → `#@$#`
- `MASK_CSS_EXTENDED_CSS_RULE` → `#?#`
- `MASK_CSS_EXCEPTION_EXTENDED_CSS_RULE` → `#@?#`
- `MASK_CSS_INJECT_EXTENDED_CSS_RULE` → `#$?#`
- `MASK_CSS_EXCEPTION_INJECT_EXTENDED_CSS_RULE` → `#@$?#`
- `MASK_SCRIPT` → `#%#`
- `MASK_SCRIPT_EXCEPTION` → `#@%#`
- `MASK_CONTENT` → `$$`
- `MASK_CONTENT_EXCEPTION` → `$@$`

Также там есть отдельная защита для `$$` / `$@$`, чтобы не путать их со scriptlet rules, содержащими `$$` внутри
тела скриптлета.

Этот TODO не требует копировать parser целиком из FiltersCompiler, но требует привести replacement parsing к той же
базовой разметке marker-ов. Не перечисленные там uBO forms обработать тем же lightweight replacement layer.

## Scope этого TODO

### In scope

- явное распознавание exception markers;
- распознавание `$$` / `$@$` без конфликта с `$modifier=` parsing;
- поддержка uBO forms `##^...`, `#@#^...`, `##+js(...)`, `#@#+js(...)` на уровне domain-list replacement;
- поддержка literal wrapper syntax `[$domain=...]`;
- tests для wildcard-доменов в mixed domain lists;
- integration test для полного цикла `applyReplacements()`.

### Out of scope

- regex wrapper forms вроде `[$domain=/regexp/]...`;
- полноценный blocker parser уровня FiltersCompiler / agtree;
- переписывание replacer на AST.

Игнорировать, например, такие формы:

```text
[$domain=/example\d+\.com/]#%#//scriptlet('abort-on-property-read', 'popns')
[$domain=/regexp/]##
```

## Конкретный план работ

### 1. Зафиксировать parser contract

- [x] Составить короткую matrix: `marker/modifier -> parser support -> unit coverage`;
- [x] Для каждого case отметить статус: `supported`, `broken`, `unsupported`, `untested`.

### 2. Исправить marker detection в `processLine()`

- [x] Ввести единый список marker-ов для domain-scoped non-network rules;
- [x] Искать exception markers раньше базовых;
- [x] Использовать порядок вида:

```text
#@$?# -> #@$# -> #@?# -> #@%# -> #@# -> #$?# -> #?# -> #$# -> #%# -> ##
```

- [x] Отдельно обработать `$$` / `$@$` до `$param`-ветки;
- [x] Не считать `indexOf("##")` внутри `#@##` допустимым поведением.

### 3. Добавить wrapper parsing для literal `[$domain=...]`

- [x] Распознавать prefix-wrapper `[$domain=...]`;
- [x] Извлекать literal domain list;
- [x] Прогонять домены через ту же replacement logic;
- [x] Возвращать строку в исходной blocker form без изменения selector/body части;
- [x] Regex-based wrapper values пропускать без обработки.

### 4. Уточнить modifier handling

- [x] Зафиксировать, что `$domain=`, `$from=`, `$denyallow=`, `$to=` (`$param=`) обрабатываются одинаково как pipe-separated domain lists;
- [x] Добавить tests на literal values;
- [x] Добавить tests на regexp values, которые должны остаться нетронутыми.

### 5. Защитить wildcard domains

- [x] Зафиксировать тестами, что домены с `*` не заменяются;
- [x] Проверить single wildcard case;
- [x] Проверить mixed list case, где заменяются только полные домены.

### 6. Расширить `shouldSkipLine()`

- [x] Синхронизировать набор marker-ов с `processLine()`;
- [x] Убедиться, что wildcard lines с exception/uBO marker-ами не скипаются ошибочно;
- [x] При необходимости вынести marker list в общую константу.

### 7. Добавить unit tests в `__tests__/replacer.test.ts`

- [x] `#@#`, `#@$#`, `#@?#`, `#@$?#`, `#@%#`;
- [x] `$$`, `$@$`;
- [x] `##^...`, `#@#^...`, `##+js(...)`, `#@#+js(...)`;
- [x] `$from=`, `$denyallow=`, `$to=`;
- [x] `[$domain=...]` with literal hosts;
- [x] wildcard domains stay untouched.

### 8. Добавить integration test для `applyReplacements()`

- [x] Создать fixture-файл с mixed marker families;
- [x] Прогнать полный `FilterReplacer.applyReplacements()`;
- [x] Проверить, что:
  - exception markers не ломают левую доменную часть;
  - wildcard domains не меняются;
  - `||host^` и list-valued modifiers продолжают работать;
  - wrapper syntax реально проходит весь file-based pipeline.

## Примеры тестовых строк

**Важно:** использовать только вымышленные домены по конвенции проекта.

### AdGuard / common markers

```text
example001.com###smartbanner.ios
example001.com#@##smartbanner.ios

nopattern.com#?#.mb-6:contains(gesponsord)
nopattern.com#@?#.mb-6:contains(gesponsord)

testsite.com#$#body { background: #fff !important; }
testsite.com#@$#body { background: #fff !important; }

testsite.com#$?#meta[name="apple-itunes-app"] { remove: true; }
testsite.com#@$?#meta[name="apple-itunes-app"] { remove: true; }

old.com#%#//scriptlet('remove-class', 'no_scroll', 'body.no_scroll')
old.com#@%#//scriptlet('remove-class', 'no_scroll', 'body.no_scroll')

example126tv.com$$script:contains(duyuruModal)
example126tv.com$@$script:contains(duyuruModal)
```

### uBO-specific forms

```text
www.91example.com##^script:has-text(runCount)
www.91example.com#@#^script:has-text(runCount)

example001.com##+js(acs, jQuery, cookie)
example001.com#@#+js(acs, jQuery, cookie)
```

### Wrapper syntax

```text
[$domain=example001.com|nopattern.com]#%#//scriptlet('set-constant', 'ads', 'false')
[$domain=testsite.com]#@#.selector
[$domain=example001.com|nopattern.com]###banner
```

### Wildcard domains

```text
example.*##.ad
nopattern.com,example.*#@#.tracker
testsite.com,example.*,old.com##.banner
```

### List-valued modifiers

```text
||example001.com^$domain=nopattern.com|testsite.com
||old.com^$from=new.com|example001.com
||mirror.com^$denyallow=nopattern.com|testsite.com
||example001.com^$to=example002.com|example003.com
```

## Definition of Done

- [x] Все in-scope marker/modifier forms либо поддержаны, либо явно отмечены как unsupported в tests/docs
- [x] `#@##` больше не ломает доменную часть
- [x] `$$` / `$@$` не путаются с `$modifier=` parsing
- [x] literal `[$domain=...]` проходит replacement path
- [x] wildcard domains остаются без замены
- [x] добавлены unit tests и integration test
- [x] при изменении contract одновременно обновлены `docs/specs.md` и `README.md`

## Требования AGENTS.md (после завершения)

- [x] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [x] Задокументировать breaking changes (если есть)
- [x] Проверить backward compatibility
- [x] Обновить `README.md` или соответствующую спецификацию в `docs/`, если поведение изменилось
- [x] Запустить `yarn build` для проверки сборки
- [x] Запустить `yarn test` для проверки тестов
- [x] Запустить `yarn lint` для проверки стиля кода

## Референс: как парсить markers и modifiers в AdGuard-логике с покрытием синтаксиса uBO

### Базовая модель: `@adguard/agtree`

В качестве опорной логики здесь полезнее всего брать `@adguard/agtree`: там marker detection идёт линейным проходом по
строке, а не через substring-поиск базового separator-а.

Для hash-based cosmetic markers распознаются:

```text
##       → ElementHiding
#@#      → ElementHidingException
#?#      → ExtendedElementHiding
#@?#     → ExtendedElementHidingException
#$#      → AdgCssInjection
#@$#     → AdgCssInjectionException
#$?#     → AdgExtendedCssInjection
#@$?#    → AdgExtendedCssInjectionException
#%#      → AdgJsInjection
#@%#     → AdgJsInjectionException
```

Для dollar-based cosmetic markers распознаются:

```text
$$       → AdgHtmlFiltering
$@$      → AdgHtmlFilteringException
```

Ключевой контракт для нашего случая:

- separator детектируется явно;
- exception marker не считается частным случаем базового marker-а;
- `$$` / `$@$` живут в отдельной ветке, а не внутри generic `$param=` parsing;
- modifier list `[$domain=...]` разбирается до поиска separator-а.

### Как расширить эту логику на синтаксис uBO

Для replacer не нужен отдельный второй parser под uBO. Нужен тот же явный scanner marker-ов, но с поддержкой uBO-specific
body forms после уже найденного separator-а.

Это означает:

- `##^...` и `#@#^...` распознаются как те же element-hiding / exception markers, но с HTML-filtering body shorthand;
- `##+js(...)` и `#@#+js(...)` распознаются как те же element-hiding / exception markers, но с scriptlet body shorthand;
- `##` и `#@#` не должны теряться только потому, что сразу после marker-а идёт `^` или `+js(`;
- `shouldSkipLine()` должен считать такие строки blocker rules, а не шумом.

Практически это значит: расширяется не список базовых separator families, а список допустимых body forms после уже
найденных `##` / `#@#`.

### Modifiers / параметры: что важно взять для uBO

Для network-side modifiers нужно сохранить и явно тестировать list-valued domain modifiers:

```text
$domain=
$from=
$denyallow=
$to=
```

Для нашего lightweight replacement layer они должны трактоваться одинаково:

- это domain-list modifiers;
- значения разделяются через `|`;
- literal domains можно заменять;
- regexp values нужно пропускать без замены.

То есть для задач replacer-а уместно применить одну и ту же AdGuard-style domain-list logic и к `$domain=`, и к
uBO-style `$from=` / `$denyallow=` / `$to=`.

### Почему это важно именно для нашей реализации

Если оставить текущую substring-логику, она ломается на двух типах случаев:

- exception markers вроде `#@##...`, где `##` совпадает внутри исключения;
- uBO body shorthands, где после `##` / `#@#` сразу идёт `^` или `+js(`.

Если же взять AdGuard-style explicit separator detection и расширить её на uBO syntax, мы получаем единый и
предсказуемый контракт:

- один marker scanner;
- одна ветка для exception markers;
- одна отдельная ветка для `$$` / `$@$`;
- один общий подход к `$domain=` / `$from=` / `$denyallow=` / `$to=`;
- поддержка `[$domain=...]` до separator detection;
- поддержка uBO-specific body forms без второго parser-а.

### Дополнительная валидация из `AdguardBrowserExtension`

Редакторские regex-правила в `mode-adguard.js` подтверждают тот же базовый taxonomy marker-ов:

- `#@?\$\??#` → `#$#`, `#@$#`, `#$?#`, `#@$?#`
- `#@?\??#` → `##`, `#@#`, `#?#`, `#@?#`
- `#@?%#\/\/` и `#@?%#` → `#%#`, `#@%#`
- `\$@?\$` → `$$`, `$@$`

Это не эталон runtime parser-а, но это дополнительное подтверждение списка marker families, который мы должны держать
единым в replacer.

## Выбранная стратегия

Для `src/replacer.ts` выбрать lightweight parser по образцу AdGuard-стека, а не substring-поиск базовых marker-ов.

### Что именно выбрать

- [x] Один явный scanner marker-ов с посимвольной проверкой separator families;
- [x] Отдельную ветку для `$$` / `$@$` до `$modifier=` parsing;
- [x] Разбор literal `[$domain=...]` до поиска marker-а;
- [x] Единый marker list / helper, который переиспользуется в `processLine()` и `shouldSkipLine()`.

### Почему это решение подходит лучше всего

- Оно соответствует нашему scope: нам нужен не полный AST-parser, а безопасное выделение domain-list части без порчи строки.
- Оно устраняет корневой баг `#@##`, потому что exception markers распознаются явно, а не через совпадение `##` внутри них.
- Оно естественно закрывает конфликт `$$` / `$@$` против `$modifier=` parsing.
- Оно совпадает с уже подтверждённой таксономией marker-ов из `@adguard/agtree` и `AdguardBrowserExtension`.
- Оно проще и надёжнее для текущего replacer, чем частично переносить более тяжёлую parser-пайплайн модель.

### Что не делать

- [x] Не использовать `indexOf("##")` как основной способ поиска separator-а;
- [x] Не держать разные неполные списки marker-ов в `processLine()` и `shouldSkipLine()`;
- [x] Не смешивать parsing `$$` / `$@$` с generic `$param=` логикой;
