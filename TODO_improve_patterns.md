# TODO: Улучшение системы паттернов доменов

## Проблема

Текущая система паттернов имеет ограничения:

1. **Жестко закодированные регулярки** - паттерны скрыты в коде `batch.ts`
2. **Ограниченная поддержка** - только числовые последовательности (+1, +2, +3...)
3. **Нет человекочитаемости** - сложно понять какой паттерн используется для сайта
4. **Нет гибкости** - один размер для всех сайтов
5. **Сложная отладка** - непонятно почему паттерн не сработал

### Текущая реализация

```typescript
// batch.ts строки 258-273
// Pattern 1: domain[N].tld или domain[N][text].tld
match = failedUrl.match(/^(https?:\/\/)?(www\.)?([a-z-]+)(\d+)([a-z-]*)(\.[a-z.]+)(\/.*)?/i);

// Pattern 2: [N]domain.tld  
match = failedUrl.match(/^(https?:\/\/)?(www\.)?(\d+)([a-z-]+)(\.[a-z.]+)(\/.*)?/i);
```

### Поддерживаемые паттерны сейчас

- ✅ `kodtimetv16.com` → `kodtimetv17.com`, `kodtimetv18.com`
- ✅ `betist220tv.live` → `betist221tv.live`, `betist222tv.live`
- ✅ `14example.com` → `15example.com`, `16example.com`
- ✅ `example126tv.com` → `example127tv.com`, `example128tv.com`
- ❌ `site-2024-01.com` → `site-2024-02.com` (даты не поддерживаются)
- ❌ `app-v1.5.com` → `app-v1.6.com` (версии не поддерживаются)
- ❌ `sitea.com` → `siteb.com` (буквы не поддерживаются)

---

## Вариант 1: Конфигурируемые паттерны (рекомендуется)

### Концепция

Добавить поле `patterns` в `watchers.yml` для каждого сайта с явным описанием паттерна.

### Пример конфигурации

```yaml
# watchers.yml
sites:
  kodtimetv:
    last_known_mirror: kodtimetv16.com
    patterns:
      - type: "numeric_increment"
        template: "kodtimetv{N}.com"
        start: 16
        step: 1
        max_attempts: 50
        
  betist:
    last_known_mirror: betist220tv.live
    patterns:
      - type: "numeric_increment"
        template: "betist{N}tv.live"
        start: 220
        step: 1
        max_attempts: 50
        
  papazsports:
    last_known_mirror: papazsports942.pro
    patterns:
      - type: "numeric_increment"
        template: "papazsports{N}.pro"
        start: 942
        step: 1
        max_attempts: 50
```

### Структура типов

```typescript
interface PatternConfig {
  type: 'numeric_increment' | 'date_based' | 'letter_sequence' | 'custom';
  template: string;           // Шаблон с плейсхолдерами: {N}, {YYYY}, {letter}
  start: number | string;     // Начальное значение
  step: number | string;      // Шаг инкремента
  max_attempts?: number;      // Переопределение глобального maxAttempts
}

interface WatcherSite {
  // ... существующие поля
  patterns?: PatternConfig[];  // Новое поле
}
```

### Реализация

```typescript
class PatternGenerator {
  generate(config: PatternConfig, count: number): string[] {
    switch (config.type) {
      case 'numeric_increment':
        return this.generateNumeric(config, count);
      case 'date_based':
        return this.generateDate(config, count);
      case 'letter_sequence':
        return this.generateLetters(config, count);
      case 'custom':
        return this.generateCustom(config, count);
    }
  }

  private generateNumeric(config: PatternConfig, count: number): string[] {
    const start = Number(config.start);
    const step = Number(config.step);
    const results: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const value = start + (i * step);
      const domain = config.template.replace('{N}', String(value));
      results.push(domain);
    }
    
    return results;
  }
  
  // ... другие методы генерации
}
```

### Преимущества

- ✅ **Человекочитаемость** - понятно в конфиге какой паттерн используется
- ✅ **Масштабируемость** - разные паттерны для разных сайтов
- ✅ **Обратная совместимость** - текущие сайты продолжат работать (fallback на старую логику)
- ✅ **Отладка** - легко видеть какой паттерн сгенерировал домен
- ✅ **Гибкость** - легко добавить новый тип паттерна
- ✅ **Тестируемость** - легко написать тесты для каждого типа

### Недостатки

- ❌ Требует миграции существующих сайтов в `watchers.yml`
- ❌ Увеличивает размер `watchers.yml`
- ❌ Нужно обучить пользователей новому формату

### Сложность реализации

**Оценка:** ~2-3 дня

**Шаги:**

1. Расширить `WatcherSite` интерфейс (0.5 дня)
2. Создать `PatternGenerator` класс (1 день)
3. Интегрировать с `BatchProcessor.generateCandidates` (0.5 дня)
4. Написать тесты (0.5 дня)
5. Обновить документацию (0.5 дня)

---

## Вариант 2: Расширенные паттерны

### Концепция

Поддержка более сложных паттернов: даты, версии, буквы.

### Примеры конфигурации

```yaml
# Паттерн на основе дат
date_based_site:
  patterns:
    - type: "date_based"
      template: "site{YYYYMMDD}.com"
      format: "YYYYMMDD"
      start: "20260101"
      step: "1 day"
      max_attempts: 30

# Паттерн на основе версий
version_based_app:
  patterns:
    - type: "version_based"
      template: "app-v{MAJOR}.{MINOR}.com"
      start: "1.0"
      step: "0.1"
      max_attempts: 20

# Паттерн на основе букв
letter_based_site:
  patterns:
    - type: "letter_sequence"
      template: "site{letter}.com"
      alphabet: "abcdefghijklmnopqrstuvwxyz"
      start: "a"
      max_attempts: 26
```

### Реализация генераторов

```typescript
class DatePatternGenerator {
  generate(config: PatternConfig, count: number): string[] {
    const start = new Date(config.start as string);
    const results: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const formatted = this.formatDate(date, config.format);
      const domain = config.template.replace('{YYYYMMDD}', formatted);
      results.push(domain);
    }
    
    return results;
  }
}

class VersionPatternGenerator {
  generate(config: PatternConfig, count: number): string[] {
    const [major, minor] = (config.start as string).split('.').map(Number);
    const step = Number(config.step);
    const results: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const newMinor = minor + (i * step);
      const version = `${major}.${newMinor}`;
      const domain = config.template
        .replace('{MAJOR}', String(major))
        .replace('{MINOR}', String(newMinor));
      results.push(domain);
    }
    
    return results;
  }
}
```

### Преимущества

- ✅ **Универсальность** - поддержка любых типов паттернов
- ✅ **Мощность** - можно описать сложные схемы ротации
- ✅ **Будущее** - готовность к новым типам паттернов

### Недостатки

- ❌ **Сложность** - больше кода, больше тестов
- ❌ **Оверинжиниринг** - возможно, избыточно для текущих задач
- ❌ **Производительность** - парсинг дат/версий может быть медленнее

### Сложность реализации

**Оценка:** ~1 неделя

---

## Вариант 3: Гибридный подход

### Концепция

Комбинация простых и сложных паттернов с приоритетами.

### Пример конфигурации

```yaml
sites:
  complex_site:
    patterns:
      # Приоритет 1: попробовать числовой паттерн
      - type: "numeric_increment"
        template: "site{N}.com"
        priority: 1
        
      # Приоритет 2: попробовать паттерн с датой
      - type: "date_based"
        template: "site{YYYY}.com"
        priority: 2
        
      # Приоритет 3: кастомная регулярка
      - type: "custom"
        regex: "site([a-z]{2})\\.com"
        generator: "letter_sequence"
        priority: 3
```

### Логика выполнения

```typescript
async checkPatterns(site: WatcherSite): Promise<string | null> {
  // Сортировка паттернов по приоритету
  const sortedPatterns = site.patterns.sort((a, b) => a.priority - b.priority);
  
  for (const pattern of sortedPatterns) {
    const candidates = this.patternGenerator.generate(pattern);
    const result = await this.checkCandidates(candidates);
    
    if (result) {
      return result; // Найден рабочий домен
    }
  }
  
  return null; // Ни один паттерн не сработал
}
```

### Преимущества

- ✅ **Гибкость** - можно комбинировать разные стратегии
- ✅ **Надежность** - fallback на другие паттерны при неудаче
- ✅ **Оптимизация** - приоритеты позволяют начать с самых вероятных

### Недостатки

- ❌ **Сложность** - самый сложный вариант
- ❌ **Время выполнения** - проверка нескольких паттернов может быть долгой

### Сложность реализации

**Оценка:** ~1.5 недели

---

## Обратная совместимость

### Стратегия миграции

```typescript
private generateCandidates(
  siteName: string,
  siteIndex: number,
  site: WatcherSite,
  failedUrl: string
): HeuristicTask[] {
  // Новый подход: если есть patterns в конфиге
  if (site.patterns && site.patterns.length > 0) {
    return this.generateFromPatterns(site.patterns, siteName, siteIndex);
  }
  
  // Старый подход: fallback на текущую логику
  return this.generateCandidatesLegacy(siteName, siteIndex, site, failedUrl);
}
```

### Постепенная миграция

1. **Фаза 1:** Реализовать новую систему с fallback
2. **Фаза 2:** Мигрировать 1-2 сайта для тестирования
3. **Фаза 3:** Мигрировать все сайты постепенно
4. **Фаза 4:** Удалить старую логику (опционально)

---

## Рекомендация

### Начать с Варианта 1 (конфигурируемые паттерны)

**Почему:**

- Простота реализации (~2-3 дня)
- Решает основные проблемы (читаемость, гибкость)
- Обратная совместимость
- Легко расширить до Варианта 2 в будущем

### План реализации

#### Шаг 1: Расширение типов (0.5 дня)

```typescript
// types.ts
interface PatternConfig {
  type: 'numeric_increment';
  template: string;
  start?: number;
  step?: number;
  max_attempts?: number;
}

interface WatcherSite {
  // ... существующие поля
  patterns?: PatternConfig[];
}
```

#### Шаг 2: Создание PatternGenerator (1 день)

```typescript
// patternGenerator.ts
export class PatternGenerator {
  generate(config: PatternConfig, count: number): string[] {
    // Реализация генерации
  }
  
  private generateNumeric(config: PatternConfig, count: number): string[] {
    // Генерация числовых паттернов
  }
}
```

#### Шаг 3: Интеграция с BatchProcessor (0.5 дня)

```typescript
// batch.ts
private generateCandidates(...): HeuristicTask[] {
  if (site.patterns) {
    return this.generateFromPatterns(site.patterns, ...);
  }
  return this.generateCandidatesLegacy(...);
}
```

#### Шаг 4: Тестирование (0.5 дня)

```typescript
// __tests__/patternGenerator.test.ts
describe('PatternGenerator', () => {
  test('numeric_increment: generates correct sequence', () => {
    // Тесты
  });
});
```

#### Шаг 5: Документация (0.5 дня)

- Обновить README
- Добавить примеры в AGENTS.md
- Создать migration guide

---

## Примеры использования

### Простой числовой паттерн

```yaml
kodtimetv:
  last_known_mirror: kodtimetv16.com
  patterns:
    - type: "numeric_increment"
      template: "kodtimetv{N}.com"
```

### Паттерн с кастомным шагом

```yaml
special_site:
  last_known_mirror: site100.com
  patterns:
    - type: "numeric_increment"
      template: "site{N}.com"
      step: 10  # site100, site110, site120...
```

### Паттерн с www префиксом

```yaml
papazsports:
  last_known_mirror: www.papazsports942.pro
  patterns:
    - type: "numeric_increment"
      template: "www.papazsports{N}.pro"
```

---

## Тестовые случаи

### Базовые тесты

1. **Числовой инкремент** - `example{N}.com` → `example1.com`, `example2.com`
2. **С префиксом www** - `www.example{N}.com`
3. **С суффиксом** - `example{N}tv.com`
4. **Кастомный шаг** - step=5 → `example5.com`, `example10.com`
5. **Кастомный старт** - start=100 → `example100.com`, `example101.com`

### Граничные случаи

1. **Пустой patterns** - fallback на старую логику
2. **Некорректный template** - ошибка валидации
3. **Отрицательный step** - ошибка валидации
4. **Превышение max_attempts** - остановка генерации

### Интеграционные тесты

1. **Миграция со старой логики** - сайт без patterns работает
2. **Комбинация старых и новых** - часть сайтов с patterns, часть без
3. **Обновление watchers.yml** - корректное сохранение patterns

---

## Вопросы для обсуждения

1. **Автоматическое определение паттерна?**
   - Анализировать `last_known_mirror` и автоматически создавать `patterns`?
   - Или требовать явное указание в конфиге?

2. **Валидация паттернов?**
   - Проверять корректность template при загрузке конфига?
   - Или при первом использовании?

3. **Логирование паттернов?**
   - Показывать в логах какой паттерн используется?
   - Какой уровень детализации нужен?

4. **Миграция существующих сайтов?**
   - Автоматическая миграция через скрипт?
   - Или ручная миграция по мере необходимости?

5. **Приоритет паттернов?**
   - Нужна ли поддержка нескольких паттернов для одного сайта?
   - Как определять приоритет?

---

## Временная оценка

### Вариант 1 (рекомендуется)

- **Расширение типов**: 0.5 дня
- **PatternGenerator**: 1 день
- **Интеграция**: 0.5 дня
- **Тестирование**: 0.5 дня
- **Документация**: 0.5 дня

**Итого:** ~3 дня реализации

### Вариант 2 (расширенные паттерны)

- **Базовая реализация**: 3 дня (из Варианта 1)
- **Date generator**: 1 день
- **Version generator**: 1 день
- **Letter generator**: 0.5 дня
- **Дополнительные тесты**: 1 день

**Итого:** ~6.5 дней реализации

### Вариант 3 (гибридный)

- **Базовая реализация**: 6.5 дней (из Варианта 2)
- **Система приоритетов**: 1 день
- **Комбинированная логика**: 1.5 дня
- **Расширенные тесты**: 1 день

**Итого:** ~10 дней реализации

---

## Следующие шаги

1. **Обсудить** выбор варианта реализации
2. **Определить** приоритетные типы паттернов
3. **Создать** детальный план реализации
4. **Написать** proof-of-concept для одного сайта
5. **Протестировать** на реальных данных
6. **Мигрировать** существующие сайты постепенно

---

**Статус:** Планирование  
**Приоритет:** Средний  
**Зависимости:** Нет  
**Блокеры:** Нет
