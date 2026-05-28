import chalk from "chalk";

/**
 * Color theme map for conventional commit types.
 * Each key maps to a chalk color function used to style
 * the commit type prefix in terminal output.
 */
const commitTypeTheme: Record<string, (text: string) => string> = {
  feat:     chalk.green,
  fix:      chalk.red,
  docs:     chalk.blue,
  refactor: chalk.yellow,
  test:     chalk.cyan,
  chore:    chalk.magenta,
  build:    chalk.hex("#FFA500"),   // orange
  ci:       chalk.hex("#FFA500"),   // orange
  perf:     chalk.greenBright,
  style:    chalk.blueBright,
  revert:   chalk.redBright,
};

/**
 * Colorizes the commit-type prefix of a conventional commit message
 * for terminal display. The raw commit string is never modified —
 * only the text printed to stdout receives ANSI colors.
 * 
 * @param message - A conventional commit message string.
 * @returns The message with a colorized type prefix.
 */

export function colorizeCommitMessage(message: string): string {
  const match = message.match(/^([a-z]+)(\([^)]*\))?(!?):/);
  if (!match) return message;

  const type = match[1];
  const colorFn = commitTypeTheme[type];
  if (!colorFn) return message;

  const prefix = match[0].slice(0, -1);  
  const rest   = message.slice(prefix.length); 

  return colorFn(prefix) + rest;
}
