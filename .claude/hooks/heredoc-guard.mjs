// PreToolUse hook for Bash: refuses a command with a heredoc longer than MAX_LINES.
// In Git Bash on Windows a long heredoc with quotes inside breaks off with
// "unexpected EOF" (CLAUDE.md, «Shell на Windows»): such a script goes to a file
// through Write and is run by its path.

const MAX_LINES = 10

let input = ''
for await (const chunk of process.stdin) input += chunk

const command = JSON.parse(input).tool_input?.command ?? ''
const lines = command.split('\n')

// The longest heredoc body in the command, in lines; one without its terminator runs
// to the end of the command.
function longestHeredoc() {
  let longest = 0
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1/g)) {
      const end = lines.findIndex((line, j) => j > i && line.trim() === match[2])
      longest = Math.max(longest, (end === -1 ? lines.length : end) - i - 1)
    }
  }
  return longest
}

const length = longestHeredoc()
if (length > MAX_LINES) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Heredoc в ${length} строк: в Git Bash на Windows длинный heredoc с кавычками обрывается с «unexpected EOF» (CLAUDE.md, «Shell на Windows»). ` +
          'Запиши скрипт или текст файлом в scratchpad через Write и запусти по пути (python <файл>, node <файл>, git commit -F <файл>, gh … --body-file <файл>).',
      },
    }),
  )
}
