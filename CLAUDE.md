## Shell на Windows

- Многострочный скрипт (Python, Node) — файлом в scratchpad через Write, потом запуск по пути. Длинный heredoc с кавычками внутри Git Bash обрывается с `unexpected EOF`.
- Кириллица в аргументах `curl` превращается в cp1251 и пишется в базу кракозябрами. Тело с кириллицей — UTF-8 файлом: `curl --data-binary @body.json -H "Content-Type: application/json; charset=utf-8"`.
- Python на Windows пишет текстовый файл с CRLF. Файлы репозитория — `write_text(..., encoding='utf-8', newline='\n')`; правки файлов лучше делать через Edit/Write.
- Кракозябры в выводе консоли — ещё не порча данных: проверь байты (`od -c`) или запусти Python с `PYTHONIOENCODING=utf-8`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`alexrehtide/knitting`), managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

Тикет читать только через `--json`: простой `gh issue view <n> --comments` здесь ничего не печатает и выходит с кодом 0, и тикет выглядит пустым.

```sh
gh issue view <n> --json number,title,state,labels,body,comments \
  --jq '{number, title, state, labels: [.labels[].name], body, comments: [.comments[] | {author: .author.login, body}]}'
```

### Triage labels

Default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.