# TODO: GitHub Action — Публикация в Marketplace

## Создание релиза

- [ ] Создать git tag: `git tag -a v1.0.3 -m "Release v1.0.3"`
- [ ] Запушить tag: `git push origin v1.0.3`
- [ ] Создать GitHub Release:
  - Перейти в GitHub → Releases → Draft a new release
  - Выбрать tag `v1.0.3`
  - Заполнить Release title: `v1.0.3 — GitHub Action Release`
  - Описать изменения в Release notes
  - Отметить "Publish this Action to the GitHub Marketplace" (чекбокс вверху)
  - Убедиться что `action.yml` валиден (GitHub покажет preview)
  - Нажать "Publish release"
- [ ] Проверить что action появился в Marketplace: `https://github.com/marketplace/actions/rotating-domains-checker`

## Пост-публикация

- [ ] Протестировать установку из Marketplace в тестовом репозитории
- [ ] Создать major version tag: `git tag -fa v1` + `git push origin v1 --force`

## Подготовка

- [x] Проверить версию в `src/index.ts` (1.0.3)
- [x] Запустить `npm run build` — `dist/` актуален
