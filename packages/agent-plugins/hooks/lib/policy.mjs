// Generated from packages/shared/hook-policy/src by scripts/sync-hook-policy.ts. Do not edit directly.
const ALLOW = {
	reason: "",
	verdict: "allow"
};
const RANK = {
	allow: 0,
	ask: 1,
	block: 2
};
/** The strictest decision wins; the first reason at that level is kept. */
const strictest = (decisions) => {
	let worst = ALLOW;
	for (const decision of decisions) {
		if (RANK[decision.verdict] > RANK[worst.verdict]) {
			worst = decision;
		}
	}
	return worst;
};
const ask = (reason) => ({
	reason,
	verdict: "ask"
});
const block = (reason) => ({
	reason,
	verdict: "block"
});
// ----- packages/shared/hook-policy/src/shell.ts -----
// Shared shell parsing: splitting a command line into simple commands, shared
// predicates over words, and exposing substitution and heredoc bodies as
// separate command texts. Imported by the git, env-dump, and email policies.
const SEPARATORS = new Set([
	"&&",
	"||",
	";",
	"|",
	"&",
	"\n"
]);
/**
* Split a shell command into simple commands of unquoted words. Quotes and backslash escapes are
* resolved; command substitution and redirection are kept as plain words, which errs toward
* classifying more text as a command rather than less.
*/
const splitCommands = (command) => {
	const commands = [];
	let words = [];
	let word = "";
	let inWord = false;
	let quote;
	const endWord = () => {
		if (inWord) {
			words.push(word);
		}
		word = "";
		inWord = false;
	};
	const endCommand = () => {
		endWord();
		if (words.length > 0) {
			commands.push(words);
		}
		words = [];
	};
	for (let index = 0; index < command.length; index += 1) {
		const char = command[index];
		if (quote !== undefined) {
			if (char === quote) {
				quote = undefined;
			} else if (char === "\\" && quote === "\"" && index + 1 < command.length) {
				index += 1;
				word += command[index];
			} else {
				word += char;
			}
		} else if (char === "\"" || char === "'") {
			quote = char;
			inWord = true;
		} else if (char === "\\" && index + 1 < command.length) {
			index += 1;
			if (command[index] !== "\n") {
				word += command[index];
				inWord = true;
			}
		} else if (SEPARATORS.has(command.slice(index, index + 2))) {
			endCommand();
			index += 1;
		} else if (SEPARATORS.has(char)) {
			endCommand();
		} else if (char === " " || char === "	" || char === "\r") {
			endWord();
		} else {
			word += char;
			inWord = true;
		}
	}
	endCommand();
	return commands;
};
const WRAPPERS = new Set([
	"command",
	"env",
	"exec",
	"nohup",
	"sudo",
	"time"
]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/u;
/** Drop leading environment assignments and wrapper commands such as `env` or `sudo`. */
const program = (words) => {
	let start = 0;
	while (start < words.length && (ASSIGNMENT.test(words[start]) || WRAPPERS.has(words[start]) || words[start].startsWith("-"))) {
		start += 1;
	}
	return words.slice(start);
};
const basename = (file) => file.slice(file.lastIndexOf("/") + 1);
/** Short flags in clusters such as `-an`; a flag in `valued` takes the rest of its cluster or the next word. */
const shortFlags = (args, valued) => {
	const flags = new Set();
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--") {
			break;
		}
		if (arg.startsWith("-") && !arg.startsWith("--") && arg.length > 1) {
			for (let position = 1; position < arg.length; position += 1) {
				flags.add(arg[position]);
				if (valued.includes(arg[position])) {
					if (position === arg.length - 1) {
						index += 1;
					}
					break;
				}
			}
		}
	}
	return flags;
};
const hasLong = (args, ...names) => args.some((arg) => names.some((name) => arg === name || arg.startsWith(`${name}=`)));
/** Positional arguments, skipping options and the values of options listed in `valued`. */
const positionals = (args, valued) => {
	const result = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--") {
			result.push(...args.slice(index + 1));
			break;
		}
		if (arg.startsWith("-")) {
			if (valued.has(arg)) {
				index += 1;
			}
		} else {
			result.push(arg);
		}
	}
	return result;
};
/** Index of the `)` that closes the `(` at `open`, skipping quoted text; the end when unclosed. */
const closingParen = (text, open) => {
	let depth = 0;
	let quote;
	for (let index = open; index < text.length; index += 1) {
		const char = text[index];
		if (quote === "'") {
			if (char === "'") {
				quote = undefined;
			}
		} else if (char === "\\") {
			index += 1;
		} else if (quote === "\"") {
			if (char === "\"") {
				quote = undefined;
			}
		} else if (char === "\"" || char === "'") {
			quote = char;
		} else if (char === "(") {
			depth += 1;
		} else if (char === ")") {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}
	return text.length;
};
/** Index of the backtick that closes the one at `open`; the end when unclosed. */
const closingBacktick = (text, open) => {
	for (let index = open + 1; index < text.length; index += 1) {
		if (text[index] === "\\") {
			index += 1;
		} else if (text[index] === "`") {
			return index;
		}
	}
	return text.length;
};
/** Expose subshells, process and command substitutions, and backticks as separate commands. */
const scanSubstitutions = (text, inDoubleQuotes = false) => {
	const nested = [];
	let plain = "";
	let quote = inDoubleQuotes ? "\"" : undefined;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (quote === "'") {
			plain += char;
			if (char === "'") {
				quote = undefined;
			}
		} else if (char === "\\" && index + 1 < text.length) {
			plain += char + text[index + 1];
			index += 1;
		} else if (quote === "\"") {
			if (char === "$" && text[index + 1] === "(") {
				const close = closingParen(text, index + 1);
				nested.push(text.slice(index + 2, close));
				index = close;
			} else if (char === "`") {
				const close = closingBacktick(text, index);
				nested.push(text.slice(index + 1, close));
				index = close;
			} else {
				plain += char;
				if (char === "\"") {
					quote = undefined;
				}
			}
		} else if (char === "\"" || char === "'") {
			plain += char;
			quote = char;
		} else {
			plain += char === "(" || char === ")" || char === "`" ? ";" : char;
		}
	}
	return {
		nested,
		plain
	};
};
const HEREDOC = /(?<!<)<<(?<dash>-?)[ \t]*(?<quote>\\|['"]?)(?<word>[A-Za-z_][\w.-]*)['"]?/gu;
/** Remove heredoc bodies, which are data, keeping the lines that start them. */
const stripHeredocs = (command) => {
	const lines = command.split("\n");
	const kept = [];
	const expanded = [];
	for (let index = 0; index < lines.length; index += 1) {
		kept.push(lines[index]);
		for (const match of lines[index].matchAll(HEREDOC)) {
			const { dash = "", quote = "", word = "" } = match.groups ?? {};
			const end = lines.findIndex((line, position) => position > index && (dash === "" ? line : line.replace(/^\t+/u, "")) === word);
			if (end !== -1) {
				if (quote === "") {
					expanded.push(lines.slice(index + 1, end).join("\n"));
				}
				index = end;
			}
		}
	}
	return {
		expanded,
		text: kept.join("\n")
	};
};
/** Every command text the shell would run: the line itself, then each substitution body. */
const commandTexts = (command) => {
	const { expanded, text } = stripHeredocs(command);
	const { nested, plain } = scanSubstitutions(text);
	const bodies = [...nested, ...expanded.flatMap((body) => scanSubstitutions(body, true).nested)];
	return [plain, ...bodies.flatMap(commandTexts)];
};
// ----- packages/shared/hook-policy/src/git.ts -----
// Git safety: blocks hook bypasses, asks before risky history edits and
// protected-branch commits or pushes. `parseGit` is also shared with the
// email policy, which reads `git commit` message text.
/** Git options before the subcommand that take a separate value. */
const GIT_VALUED_OPTIONS = new Set([
	"-C",
	"-c",
	"--config-env",
	"--exec-path",
	"--git-dir",
	"--namespace",
	"--super-prefix",
	"--work-tree"
]);
const HOOKS_PATH_OVERRIDE = /^core\.hookspath=/iu;
const parseGit = (words) => {
	if (words.length === 0 || basename(words[0]) !== "git") {
		return undefined;
	}
	let directory;
	let hooksPathOverride = false;
	let index = 1;
	while (index < words.length && words[index].startsWith("-")) {
		if (GIT_VALUED_OPTIONS.has(words[index])) {
			if (words[index] === "-C") {
				directory = directory === undefined ? words[index + 1] : `${directory}/${words[index + 1]}`;
			}
			if (words[index] === "-c" && HOOKS_PATH_OVERRIDE.test(words[index + 1] ?? "")) {
				hooksPathOverride = true;
			}
			index += 2;
		} else {
			index += 1;
		}
	}
	if (index >= words.length) {
		return undefined;
	}
	return {
		args: words.slice(index + 1),
		directory,
		hooksPathOverride,
		subcommand: words[index]
	};
};
const PROTECTED_BRANCH = /^(?:main|develop|staging|release\/.+)$/u;
const isProtected = (branch) => branch !== undefined && PROTECTED_BRANCH.test(branch);
const COMMIT_VALUED_SHORT = "mFCctS";
const PUSH_VALUED = new Set([
	"-o",
	"--push-option",
	"--repo",
	"--receive-pack",
	"--exec"
]);
const branchName = (ref) => ref.replace(/^refs\/heads\//u, "");
const skipsHooks = (bypass) => block(`${bypass} skips repository hooks; let the hooks run and fix what they report`);
const classifyCommit = (git, context) => {
	if (hasLong(git.args, "--no-verify") || shortFlags(git.args, COMMIT_VALUED_SHORT).has("n")) {
		return skipsHooks("git commit --no-verify");
	}
	if (git.hooksPathOverride) {
		return skipsHooks("git -c core.hooksPath=... commit");
	}
	const branch = context.currentBranch(git.directory);
	return isProtected(branch) ? ask(`git commit on the protected branch ${branch}; create a feature branch first`) : ALLOW;
};
const classifyPush = (git, context) => {
	if (hasLong(git.args, "--no-verify")) {
		return skipsHooks("git push --no-verify");
	}
	if (git.hooksPathOverride) {
		return skipsHooks("git -c core.hooksPath=... push");
	}
	const [, ...refspecs] = positionals(git.args, PUSH_VALUED);
	const decisions = [];
	if (hasLong(git.args, "--force", "--force-with-lease", "--force-if-includes", "--mirror") || shortFlags(git.args, "o").has("f") || refspecs.some((refspec) => refspec.startsWith("+"))) {
		decisions.push(ask("git push rewrites remote history (force push)"));
	}
	if (hasLong(git.args, "--all", "--branches", "--mirror")) {
		decisions.push(ask("git push of every branch includes protected branches"));
	}
	const targets = refspecs.length > 0 ? refspecs.map((refspec) => branchName(refspec.replace(/^\+/u, "").split(":").at(-1) ?? "")) : [context.currentBranch(git.directory)];
	const protectedTarget = targets.find(isProtected);
	if (protectedTarget !== undefined) {
		decisions.push(ask(`git push to the protected branch ${protectedTarget}`));
	}
	return strictest(decisions);
};
const classifyGit = (git, context) => {
	switch (git.subcommand) {
		case "commit": {
			return classifyCommit(git, context);
		}
		case "push": {
			return classifyPush(git, context);
		}
		case "reset": {
			return hasLong(git.args, "--hard") ? ask("git reset --hard discards uncommitted and committed work") : ALLOW;
		}
		case "clean": {
			return hasLong(git.args, "--force") || shortFlags(git.args, "e").has("f") ? ask("git clean -f deletes untracked files") : ALLOW;
		}
		case "checkout": {
			return git.args.includes("--") && git.args.indexOf("--") < git.args.length - 1 ? ask("git checkout -- <path> discards uncommitted changes to those paths") : ALLOW;
		}
		case "restore": {
			const staged = hasLong(git.args, "--staged") || shortFlags(git.args, "s").has("S");
			const worktree = hasLong(git.args, "--worktree") || shortFlags(git.args, "s").has("W");
			return staged && !worktree ? ALLOW : ask("git restore <path> discards uncommitted changes to those paths");
		}
		case "stash": {
			return git.args[0] === "drop" ? ask("git stash drop deletes a stash entry") : ALLOW;
		}
		default: {
			return ALLOW;
		}
	}
};
/** Git safety for one shell command line: blocks hook bypasses, asks before risky history edits. */
const classifyGitSafety = (command, context) => strictest(splitCommands(command).map((words) => {
	const git = parseGit(program(words));
	return git === undefined ? ALLOW : classifyGit(git, context);
}));
// ----- packages/shared/hook-policy/src/env.ts -----
// Environment-dump guard: asks before a shell command prints the whole
// environment, which would put every secret in it into the transcript.
const SHELL_KEYWORDS = new Set([
	"!",
	"{",
	"}",
	"do",
	"elif",
	"else",
	"if",
	"then",
	"until",
	"while"
]);
const PREFIX_COMMANDS = new Set([
	"builtin",
	"command",
	"exec",
	"nohup",
	"time"
]);
const ELEVATORS = new Set(["doas", "sudo"]);
const SUDO_VALUED = new Set([
	"-C",
	"-D",
	"-g",
	"-h",
	"-p",
	"-R",
	"-r",
	"-T",
	"-t",
	"-U",
	"-u"
]);
const REDIRECTION = /^(?:\d+|&)?(?:<<<|<<-?|>>|>\||<>|>&|<&|>|<)/u;
const PROC_ENVIRON = /^<?\/proc\/(?:self|thread-self|\d+|\$\$|\$\{?[A-Za-z_]\w*\}?)\/(?:task\/\d+\/)?environ$/u;
/** Prefixes such as dd's `if=` that attach a file path to a single word. */
const ATTACHED_PATH = /^[A-Za-z_][A-Za-z0-9_-]*=/u;
/** Commands that name a file without printing its contents. */
const NOT_READING = new Set([
	"[",
	"echo",
	"ls",
	"printf",
	"stat",
	"test"
]);
/** Words of a simple command without redirections and a trailing comment. */
const commandWords = (words) => {
	const result = [];
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		if (word.startsWith("#")) {
			break;
		}
		// A redirection attached to a word, as in `env>out.txt`, ends that word.
		const attached = /^(?<head>[^<>]*[^<>\d&])[<>]/u.exec(word)?.groups?.head;
		const redirect = REDIRECTION.exec(word);
		if (attached !== undefined) {
			result.push(attached);
		} else if (redirect === null) {
			result.push(word);
		} else if (redirect[0] === word) {
			index += 1;
		}
	}
	return result;
};
/** Drop keywords, assignments, and wrappers that run the next word, such as `sudo` or `exec`. */
const unwrap = (words) => {
	let index = 0;
	while (index < words.length) {
		const word = words[index];
		if (SHELL_KEYWORDS.has(word) || ASSIGNMENT.test(word)) {
			index += 1;
		} else if (ELEVATORS.has(basename(word)) || PREFIX_COMMANDS.has(word)) {
			if (word === "command" && ["-v", "-V"].includes(words[index + 1])) {
				return undefined;
			}
			index += 1;
			while (index < words.length && words[index].startsWith("-") && words[index] !== "--") {
				index += SUDO_VALUED.has(words[index]) || words[index] === "-a" ? 2 : 1;
			}
			if (words[index] === "--") {
				index += 1;
			}
		} else {
			break;
		}
	}
	return words.slice(index);
};
const ENV_VALUED = new Set([
	"-C",
	"-u",
	"--chdir",
	"--unset"
]);
/**
* The command `env` runs after its options and assignments, or `'dump'` when it runs none and
* prints the inherited environment. `-i` starts from an empty environment, and `-S` runs a command.
*/
const envCommand = (args) => {
	let empty = false;
	let index = 0;
	let options = true;
	while (index < args.length) {
		const arg = args[index];
		if (options && arg === "--") {
			options = false;
			index += 1;
		} else if (options && arg.startsWith("-")) {
			if (["--help", "--version"].includes(arg) || arg.startsWith("--split-string")) {
				return undefined;
			}
			const short = arg.startsWith("--") ? "" : arg.slice(1);
			if (arg === "-" || arg === "--ignore-environment" || short.includes("i")) {
				empty = true;
			}
			if (short.includes("S")) {
				return undefined;
			}
			index += ENV_VALUED.has(arg) || /[Cu]$/u.test(short) ? 2 : 1;
		} else if (ASSIGNMENT.test(arg)) {
			index += 1;
		} else {
			return args.slice(index);
		}
	}
	return empty ? undefined : "dump";
};
/** What a simple command dumps from the environment, or undefined when it reads none of it. */
const environmentDump = (raw) => {
	const words = unwrap(commandWords(raw));
	if (words === undefined || words.length === 0) {
		return undefined;
	}
	const [name, ...args] = words;
	const head = basename(name);
	if (!NOT_READING.has(head)) {
		const proc = raw.find((word) => PROC_ENVIRON.test(word.replace(ATTACHED_PATH, "")));
		if (proc !== undefined) {
			return `reading ${proc.replace(/^</u, "")}`;
		}
	}
	const options = args.filter((arg) => arg.startsWith("-"));
	const names = args.filter((arg) => !arg.startsWith("-"));
	switch (head) {
		case "env": {
			const rest = envCommand(args);
			if (rest === "dump") {
				return "env without a command";
			}
			return rest === undefined ? undefined : environmentDump(rest);
		}
		case "printenv": {
			return names.length === 0 && !hasLong(options, "--help", "--version") ? "printenv without a variable name" : undefined;
		}
		case "set": {
			return args.length === 0 ? "set without arguments" : undefined;
		}
		case "export": {
			return args.every((arg) => arg === "-p") ? ["export", ...args].join(" ") : undefined;
		}
		case "declare":
		case "typeset": {
			const flags = shortFlags(options, "");
			return names.length === 0 && (flags.has("x") || flags.has("p")) ? `${head} ${options.join(" ")} without names` : undefined;
		}
		default: {
			return undefined;
		}
	}
};
/**
* Ask before a shell command prints the whole environment, which puts every secret in it into the
* transcript: `env` or `printenv` alone, a bare `set`, `export -p`, `declare -x`/`-p` without
* names, or reading `/proc/<pid>/environ`, anywhere in a pipeline, list, subshell, or substitution.
*/
const classifyEnvDump = (command) => {
	for (const text of commandTexts(command)) {
		for (const words of splitCommands(text)) {
			const dump = environmentDump(words);
			if (dump !== undefined) {
				return ask(`${dump} prints the whole environment, secrets included, into the transcript; read the one variable by name (printenv NAME), and for a secret check presence only ([ -n "$NAME" ] && echo set)`);
			}
		}
	}
	return ALLOW;
};
// ----- packages/shared/hook-policy/src/email.ts -----
// Email scan: asks before PR, issue, API, or commit text that names a person
// by email address. Reads `git commit` commands with the shared git parser.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/gu;
const NOREPLY = /(?:^no-?reply@|@users\.noreply\.github\.com$)/iu;
/** Email addresses in `text`, excluding noreply addresses such as GitHub's commit emails. */
const findEmails = (text) => [...text.matchAll(EMAIL)].map((match) => match[0]).filter((email) => !NOREPLY.test(email));
/** An email with its local part masked, so a hook message does not repeat the address. */
const maskEmail = (email) => `${email[0]}***${email.slice(email.indexOf("@"))}`;
const readValue = (value, context) => value === "-" ? "" : context.readFile?.(value) ?? "";
const optionValues = (args, inline, files, context) => {
	const values = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		const equals = arg.indexOf("=");
		const short = arg.slice(0, 2);
		// `--name=value` and attached short values such as `-mTEXT` carry the value in the word.
		let name = arg;
		if (arg.startsWith("--") && equals > 0) {
			name = arg.slice(0, equals);
		} else if (!arg.startsWith("--") && arg.length > 2 && (inline.has(short) || files.has(short))) {
			name = short;
		}
		let attached = args[index + 1];
		if (name !== arg) {
			attached = name === short ? arg.slice(2) : arg.slice(equals + 1);
		}
		if (inline.has(name) || files.has(name)) {
			if (attached !== undefined) {
				values.push(files.has(name) ? readValue(attached, context) : attached);
			}
			if (name === arg) {
				index += 1;
			}
		}
	}
	return values;
};
const GH_TEXT = new Set([
	"--body",
	"--title",
	"-b",
	"-t"
]);
const GH_FILES = new Set(["--body-file", "-F"]);
const GH_API_FIELDS = new Set([
	"-f",
	"-F",
	"--field",
	"--raw-field"
]);
const GIT_MESSAGE = new Set(["-m", "--message"]);
const GIT_MESSAGE_FILES = new Set(["-F", "--file"]);
const GH_WRITES = {
	issue: new Set([
		"comment",
		"create",
		"edit"
	]),
	pr: new Set([
		"comment",
		"create",
		"edit",
		"review"
	])
};
/** Text a command publishes: PR, issue, and API bodies from `gh`, and `git commit` messages. */
const outgoingText = (command, context) => splitCommands(command).flatMap((raw) => {
	const words = program(raw);
	if (words.length > 1 && basename(words[0]) === "gh") {
		const [, area, action, ...rest] = words;
		if (area === "api") {
			return optionValues([action, ...rest], GH_API_FIELDS, new Set(), context).map((field) => field.includes("=@") ? readValue(field.slice(field.indexOf("=@") + 2), context) : field.slice(field.indexOf("=") + 1));
		}
		return GH_WRITES[area]?.has(action) ? optionValues(rest, GH_TEXT, GH_FILES, context) : [];
	}
	const git = parseGit(words);
	return git?.subcommand === "commit" ? optionValues(git.args, GIT_MESSAGE, GIT_MESSAGE_FILES, context) : [];
});
/** Ask before PR, issue, API, or commit text that names a person by email address. */
const classifyEmailScan = (command, context) => {
	const emails = outgoingText(command, context).flatMap(findEmails);
	return emails.length === 0 ? ALLOW : ask(`outgoing PR, issue, or commit text contains an email address (${[...new Set(emails)].map(maskEmail).join(", ")}); refer to people by id, count, or hash instead`);
};
// ----- packages/shared/hook-policy/src/generated.ts -----
// Generated-file guard: asks before an edit tool changes a file whose head
// carries a generated marker. Scripts that regenerate files are unaffected.
const GENERATED_MARKERS = [
	/@generated\b/u,
	/DO NOT EDIT/u,
	/Do not edit directly/iu,
	/\bGenerated (?:by|from)\b/u
];
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u;
/** The marker that shows a file is generated, read from its first five lines after any frontmatter. */
const generatedMarker = (text) => {
	const head = text.replace(FRONTMATTER, "").split("\n").slice(0, 5).join("\n");
	return GENERATED_MARKERS.map((marker) => marker.exec(head)?.[0]).find((found) => found !== undefined);
};
const PATH_KEYS = [
	"file_path",
	"filePath",
	"path",
	"target_file",
	"notebook_path",
	"filename"
];
const PATCH_KEYS = [
	"command",
	"input",
	"patch"
];
const PATCHED_FILE = /^\*\*\* (?:Update|Delete) File: (?<file>.+)$/gmu;
/** Existing files an edit or write tool call targets, from its path fields or an apply_patch body. */
const editTargets = (toolInput) => {
	if (typeof toolInput !== "object" || toolInput === null) {
		return [];
	}
	const field = (key) => Reflect.get(toolInput, key);
	const paths = PATH_KEYS.map(field).filter((value) => typeof value === "string" && value !== "");
	for (const key of PATCH_KEYS) {
		const value = field(key);
		if (typeof value === "string") {
			paths.push(...[...value.matchAll(PATCHED_FILE)].map((match) => match.groups?.file.trim() ?? ""));
		}
	}
	return [...new Set(paths)];
};
/** Ask before an edit tool changes a generated file; scripts that regenerate it are unaffected. */
const classifyGeneratedEdit = (files, readHead) => {
	for (const file of files) {
		const head = readHead(file);
		const marker = head === undefined ? undefined : generatedMarker(head);
		if (marker !== undefined) {
			return ask(`${file} is generated (${marker}); edit its source and regenerate`);
		}
	}
	return ALLOW;
};
export { ALLOW, strictest, splitCommands, classifyGitSafety, PROTECTED_BRANCH, classifyEnvDump, classifyEmailScan, findEmails, maskEmail, outgoingText, classifyGeneratedEdit, editTargets, generatedMarker };
