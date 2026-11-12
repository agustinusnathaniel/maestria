// Generated from packages/shared/hook-policy/src by scripts/sync-hook-policy.ts. Do not edit directly.
// packages/shared/hook-policy/src/types.ts
var ALLOW = {
	reason: "",
	verdict: "allow"
};
var RANK = {
	allow: 0,
	ask: 1,
	block: 2
};
/** The strictest decision wins; the first reason at that level is kept. */
var strictest = (decisions) => {
	let worst = ALLOW;
	for (const decision of decisions) if (RANK[decision.verdict] > RANK[worst.verdict]) worst = decision;
	return worst;
};
var ask = (reason) => ({
	reason,
	verdict: "ask"
});
var block = (reason) => ({
	reason,
	verdict: "block"
});
// packages/shared/hook-policy/src/shell.ts
var SEPARATORS = /* @__PURE__ */ new Set([
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
var splitCommands = (command) => {
	const commands = [];
	let words = [];
	let word = "";
	let inWord = false;
	let quote;
	const endWord = () => {
		if (inWord) words.push(word);
		word = "";
		inWord = false;
	};
	const endCommand = () => {
		endWord();
		if (words.length > 0) commands.push(words);
		words = [];
	};
	for (let index = 0; index < command.length; index += 1) {
		const char = command[index];
		if (quote !== void 0) {
			if (char === quote) quote = void 0;
			else if (char === "\\" && quote === "\"" && index + 1 < command.length) {
				index += 1;
				word += command[index];
			} else word += char;
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
		} else if (SEPARATORS.has(char)) endCommand();
		else if (char === " " || char === "	" || char === "\r") endWord();
		else {
			word += char;
			inWord = true;
		}
	}
	endCommand();
	return commands;
};
var WRAPPERS = /* @__PURE__ */ new Set([
	"command",
	"env",
	"exec",
	"nohup",
	"sudo",
	"time"
]);
var ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/u;
/** Drop leading environment assignments and wrapper commands such as `env` or `sudo`. */
var program = (words) => {
	let start = 0;
	while (start < words.length && (ASSIGNMENT.test(words[start]) || WRAPPERS.has(words[start]) || words[start].startsWith("-"))) start += 1;
	return words.slice(start);
};
var basename = (file) => file.slice(file.lastIndexOf("/") + 1);
/** Short flags in clusters such as `-an`; a flag in `valued` takes the rest of its cluster or the next word. */
var shortFlags = (args, valued) => {
	const flags = /* @__PURE__ */ new Set();
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--") break;
		if (arg.startsWith("-") && !arg.startsWith("--") && arg.length > 1) for (let position = 1; position < arg.length; position += 1) {
			flags.add(arg[position]);
			if (valued.includes(arg[position])) {
				if (position === arg.length - 1) index += 1;
				break;
			}
		}
	}
	return flags;
};
var hasLong = (args, ...names) => args.some((arg) => names.some((name) => arg === name || arg.startsWith(`${name}=`)));
/** Positional arguments, skipping options and the values of options listed in `valued`. */
var positionals = (args, valued) => {
	const result = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--") {
			result.push(...args.slice(index + 1));
			break;
		}
		if (arg.startsWith("-")) {
			if (valued.has(arg)) index += 1;
		} else result.push(arg);
	}
	return result;
};
/** Index of the `)` that closes the `(` at `open`, skipping quoted text; the end when unclosed. */
var closingParen = (text, open) => {
	let depth = 0;
	let quote;
	for (let index = open; index < text.length; index += 1) {
		const char = text[index];
		if (quote === "'") {
			if (char === "'") quote = void 0;
		} else if (char === "\\") index += 1;
		else if (quote === "\"") {
			if (char === "\"") quote = void 0;
		} else if (char === "\"" || char === "'") quote = char;
		else if (char === "(") depth += 1;
		else if (char === ")") {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return text.length;
};
/** Index of the backtick that closes the one at `open`; the end when unclosed. */
var closingBacktick = (text, open) => {
	for (let index = open + 1; index < text.length; index += 1) if (text[index] === "\\") index += 1;
	else if (text[index] === "`") return index;
	return text.length;
};
/** Expose subshells, process and command substitutions, and backticks as separate commands. */
var scanSubstitutions = (text, inDoubleQuotes = false) => {
	const nested = [];
	const substitutions = [];
	let plain = "";
	let inWord = inDoubleQuotes;
	let quote = inDoubleQuotes ? "\"" : void 0;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (quote === "'") {
			plain += char;
			if (char === "'") quote = void 0;
		} else if (char === "\\") {
			plain += text.slice(index, index + 2);
			inWord ||= text[index + 1] !== "\n";
			index += 1;
		} else if (char === "`") {
			const close = closingBacktick(text, index);
			nested.push(text.slice(index + 1, close));
			plain += quote === "\"" ? "" : ";";
			inWord = true;
			index = close;
		} else if (quote === "\"") {
			if (text.startsWith("$(", index)) {
				const close = closingParen(text, index + 1);
				nested.push(text.slice(index + 2, close));
				index = close;
			} else {
				plain += char;
				if (char === "\"") quote = void 0;
			}
		} else if (/["']/u.test(char)) {
			plain += char;
			quote = char;
			inWord = true;
		} else if (char === "#" && !inWord) {
			const end = text.indexOf("\n", index);
			index = (end === -1 ? text.length : end) - 1;
		} else {
			plain += /[()`]/u.test(char) ? ";" : char;
			if (char === "(") {
				substitutions.push(/[$<>]/u.test(text.charAt(index - 1)));
				inWord = false;
			} else if (char === ")") inWord = substitutions.pop() === true;
			else inWord = !/[\s;|&]/u.test(char);
		}
	}
	return {
		nested,
		plain
	};
};
var HEREDOC = /\\.|'[^']*'|"(?:\\.|[^"\\])*"|(?<!<)<<(?<dash>-?)[ \t]*(?<quote>\\|['"]?)(?<word>[A-Za-z_][\w.-]*)['"]?/gu;
/** Remove heredoc bodies, which are data, keeping the lines that start them. */
var stripHeredocs = (command) => {
	const lines = command.split("\n");
	const kept = [];
	const expanded = [];
	for (let index = 0; index < lines.length; index += 1) {
		kept.push(lines[index]);
		const pending = [lines[index]];
		for (const text of pending) {
			const { nested, plain } = scanSubstitutions(text);
			for (const body of nested) pending.push(body);
			for (const match of plain.matchAll(HEREDOC)) {
				if (match.groups?.word === void 0) continue;
				const { dash = "", quote = "", word } = match.groups;
				const end = lines.findIndex((line, position) => position > index && (dash === "" ? line : line.replace(/^\t+/u, "")) === word);
				if (end !== -1) {
					if (quote === "") expanded.push(lines.slice(index + 1, end).join("\n"));
					index = end;
				}
			}
		}
	}
	return {
		expanded,
		text: kept.join("\n")
	};
};
/** Every command text the shell would run: the line itself, then each substitution body. */
var commandTexts = (command) => {
	const { expanded, text } = stripHeredocs(command);
	const { nested, plain } = scanSubstitutions(text);
	return [plain, ...[...nested, ...expanded.flatMap((body) => scanSubstitutions(body, true).nested)].flatMap(commandTexts)];
};
// packages/shared/hook-policy/src/git.ts
/** Git options before the subcommand that take a separate value. */
var GIT_VALUED_OPTIONS = /* @__PURE__ */ new Set([
	"-C",
	"-c",
	"--config-env",
	"--exec-path",
	"--git-dir",
	"--namespace",
	"--super-prefix",
	"--work-tree"
]);
var HOOKS_PATH_OVERRIDE = /^core\.hookspath=/iu;
var parseGit = (words) => {
	if (words.length === 0 || basename(words[0]) !== "git") return;
	let directory;
	let hooksPathOverride = false;
	let index = 1;
	while (index < words.length && words[index].startsWith("-")) if (GIT_VALUED_OPTIONS.has(words[index])) {
		if (words[index] === "-C") directory = directory === void 0 ? words[index + 1] : `${directory}/${words[index + 1]}`;
		if (words[index] === "-c" && HOOKS_PATH_OVERRIDE.test(words[index + 1] ?? "")) hooksPathOverride = true;
		index += 2;
	} else index += 1;
	if (index >= words.length) return;
	return {
		args: words.slice(index + 1),
		directory,
		hooksPathOverride,
		subcommand: words[index]
	};
};
var PROTECTED_BRANCH = /^(?:main|develop|staging|release\/.+)$/u;
var isProtected = (branch) => branch !== void 0 && PROTECTED_BRANCH.test(branch);
var COMMIT_VALUED_SHORT = "mFCctS";
var PUSH_VALUED = /* @__PURE__ */ new Set([
	"-o",
	"--push-option",
	"--repo",
	"--receive-pack",
	"--exec"
]);
var branchName = (ref) => ref.replace(/^refs\/heads\//u, "");
var skipsHooks = (bypass) => block(`${bypass} skips repository hooks; let the hooks run and fix what they report`);
var classifyCommit = (git, context) => {
	if (hasLong(git.args, "--no-verify") || shortFlags(git.args, COMMIT_VALUED_SHORT).has("n")) return skipsHooks("git commit --no-verify");
	if (git.hooksPathOverride) return skipsHooks("git -c core.hooksPath=... commit");
	const branch = context.currentBranch(git.directory);
	return isProtected(branch) ? ask(`git commit on the protected branch ${branch}; create a feature branch first`) : ALLOW;
};
var classifyPush = (git, context) => {
	if (hasLong(git.args, "--no-verify")) return skipsHooks("git push --no-verify");
	if (git.hooksPathOverride) return skipsHooks("git -c core.hooksPath=... push");
	const [, ...refspecs] = positionals(git.args, PUSH_VALUED);
	const decisions = [];
	if (hasLong(git.args, "--force", "--force-with-lease", "--force-if-includes", "--mirror") || shortFlags(git.args, "o").has("f") || refspecs.some((refspec) => refspec.startsWith("+"))) decisions.push(ask("git push rewrites remote history (force push)"));
	if (hasLong(git.args, "--all", "--branches", "--mirror")) decisions.push(ask("git push of every branch includes protected branches"));
	const protectedTarget = (refspecs.length > 0 ? refspecs.map((refspec) => branchName(refspec.replace(/^\+/u, "").split(":").at(-1) ?? "")) : [context.currentBranch(git.directory)]).find(isProtected);
	if (protectedTarget !== void 0) decisions.push(ask(`git push to the protected branch ${protectedTarget}`));
	return strictest(decisions);
};
var classifyGit = (git, context) => {
	switch (git.subcommand) {
		case "commit": return classifyCommit(git, context);
		case "push": return classifyPush(git, context);
		case "reset": return hasLong(git.args, "--hard") ? ask("git reset --hard discards uncommitted and committed work") : ALLOW;
		case "clean": return hasLong(git.args, "--force") || shortFlags(git.args, "e").has("f") ? ask("git clean -f deletes untracked files") : ALLOW;
		case "checkout": return git.args.includes("--") && git.args.indexOf("--") < git.args.length - 1 ? ask("git checkout -- <path> discards uncommitted changes to those paths") : ALLOW;
		case "restore": {
			const staged = hasLong(git.args, "--staged") || shortFlags(git.args, "s").has("S");
			const worktree = hasLong(git.args, "--worktree") || shortFlags(git.args, "s").has("W");
			return staged && !worktree ? ALLOW : ask("git restore <path> discards uncommitted changes to those paths");
		}
		case "stash": return git.args[0] === "drop" ? ask("git stash drop deletes a stash entry") : ALLOW;
		default: return ALLOW;
	}
};
/** Git safety for one shell command line: blocks hook bypasses, asks before risky history edits. */
var classifyGitSafety = (command, context) => strictest(splitCommands(command).map((words) => {
	const git = parseGit(program(words));
	return git === void 0 ? ALLOW : classifyGit(git, context);
}));
// packages/shared/hook-policy/src/env.ts
var SHELL_KEYWORDS = /* @__PURE__ */ new Set([
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
var PREFIX_COMMANDS = /* @__PURE__ */ new Set([
	"builtin",
	"command",
	"exec",
	"nohup",
	"time"
]);
var ELEVATORS = /* @__PURE__ */ new Set(["doas", "sudo"]);
var SUDO_VALUED = /* @__PURE__ */ new Set([
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
var REDIRECTION = /^(?:\d+|&)?(?:<<<|<<-?|>>|>\||<>|>&|<&|>|<)/u;
var PROC_ENVIRON = /^<?\/proc\/(?:self|thread-self|\d+|\$\$|\$\{?[A-Za-z_]\w*\}?)\/(?:task\/\d+\/)?environ$/u;
/** Prefixes such as dd's `if=` that attach a file path to a single word. */
var ATTACHED_PATH = /^[A-Za-z_][A-Za-z0-9_-]*=/u;
/** Commands that name a file without printing its contents. */
var NOT_READING = /* @__PURE__ */ new Set([
	"[",
	"echo",
	"ls",
	"printf",
	"stat",
	"test"
]);
/** Words of a simple command without redirections and a trailing comment. */
var commandWords = (words) => {
	const result = [];
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index];
		if (word.startsWith("#")) break;
		const attached = /^(?<head>[^<>]*[^<>\d&])[<>]/u.exec(word)?.groups?.head;
		const redirect = REDIRECTION.exec(word);
		if (attached !== void 0) result.push(attached);
		else if (redirect === null) result.push(word);
		else if (redirect[0] === word) index += 1;
	}
	return result;
};
/** Drop keywords, assignments, and wrappers that run the next word, such as `sudo` or `exec`. */
var unwrap = (words, start = 0) => {
	let index = start;
	while (index < words.length) {
		const word = words[index];
		if (SHELL_KEYWORDS.has(word) || ASSIGNMENT.test(word)) index += 1;
		else if (ELEVATORS.has(basename(word)) || PREFIX_COMMANDS.has(word)) {
			if (word === "command" && ["-v", "-V"].includes(words[index + 1])) return words.length;
			index += 1;
			while (index < words.length && words[index].startsWith("-") && words[index] !== "--") index += SUDO_VALUED.has(words[index]) || words[index] === "-a" ? 2 : 1;
			if (words[index] === "--") index += 1;
		} else break;
	}
	return index;
};
var ENV_VALUED = /* @__PURE__ */ new Set([
	"-C",
	"-u",
	"--chdir",
	"--unset"
]);
/**
* The command `env` runs after its options and assignments, or `'dump'` when it runs none and
* prints the inherited environment. `-i` starts from an empty environment, and `-S` runs a command.
*/
var envCommand = (args, start) => {
	let empty = false;
	let index = start;
	let options = true;
	while (index < args.length) {
		const arg = args[index];
		if (options && arg === "--") {
			options = false;
			index += 1;
		} else if (options && arg.startsWith("-")) {
			if (["--help", "--version"].includes(arg) || arg.startsWith("--split-string")) return;
			const short = arg.startsWith("--") ? "" : arg.slice(1);
			const valueAt = short.search(/[CuS]/u);
			const flags = valueAt === -1 ? short : short.slice(0, valueAt + 1);
			if (arg === "-" || arg === "--ignore-environment" || flags.includes("i")) empty = true;
			if (flags.includes("S")) return;
			index += ENV_VALUED.has(arg) || valueAt !== -1 && valueAt === short.length - 1 ? 2 : 1;
		} else if (ASSIGNMENT.test(arg)) index += 1;
		else return index;
	}
	return empty ? void 0 : "dump";
};
/** What a simple command dumps from the environment, or undefined when it reads none of it. */
var environmentDump = (raw) => {
	const words = commandWords(raw);
	let start = unwrap(words);
	if (start >= words.length) return;
	if (!NOT_READING.has(basename(words[start]))) {
		const proc = raw.find((word) => PROC_ENVIRON.test(word.replace(ATTACHED_PATH, "")));
		if (proc !== void 0) return `reading ${proc.replace(/^</u, "")}`;
	}
	while (basename(words[start]) === "env") {
		const next = envCommand(words, start + 1);
		if (next === "dump") return "env without a command";
		start = next === void 0 ? words.length : unwrap(words, next);
		if (start >= words.length) return;
	}
	const head = basename(words[start]);
	const args = words.slice(start + 1);
	const options = args.filter((arg) => arg.startsWith("-"));
	const names = args.filter((arg) => !arg.startsWith("-"));
	switch (head) {
		case "printenv": return names.length === 0 && !hasLong(options, "--help", "--version") ? "printenv without a variable name" : void 0;
		case "set": return args.length === 0 ? "set without arguments" : void 0;
		case "export": return args.every((arg) => arg === "-p") ? ["export", ...args].join(" ") : void 0;
		case "declare":
		case "typeset": {
			const flags = shortFlags(options, "");
			return names.length === 0 && (flags.has("x") || flags.has("p")) ? `${head} ${options.join(" ")} without names` : void 0;
		}
		default: return;
	}
};
/**
* Ask before a shell command prints the whole environment, which puts every secret in it into the
* transcript: `env` or `printenv` alone, a bare `set`, `export -p`, `declare -x`/`-p` without
* names, or reading `/proc/<pid>/environ`, anywhere in a pipeline, list, subshell, or substitution.
*/
var classifyEnvDump = (command) => {
	for (const text of commandTexts(command)) for (const words of splitCommands(text)) {
		const dump = environmentDump(words);
		if (dump !== void 0) return ask(`${dump} prints the whole environment, secrets included, into the transcript; read the one variable by name (printenv NAME), and for a secret check presence only ([ -n "$NAME" ] && echo set)`);
	}
	return ALLOW;
};
// packages/shared/hook-policy/src/email.ts
var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/gu;
var NOREPLY = /(?:^no-?reply@|@users\.noreply\.github\.com$)/iu;
/** Email addresses in `text`, excluding noreply addresses such as GitHub's commit emails. */
var findEmails = (text) => [...text.matchAll(EMAIL)].map((match) => match[0]).filter((email) => !NOREPLY.test(email));
/** An email with its local part masked, so a hook message does not repeat the address. */
var maskEmail = (email) => `${email[0]}***${email.slice(email.indexOf("@"))}`;
var readValue = (value, context) => value === "-" ? "" : context.readFile?.(value) ?? "";
var optionValues = (args, inline, files, context) => {
	const values = [];
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		const equals = arg.indexOf("=");
		const short = arg.slice(0, 2);
		let name = arg;
		if (arg.startsWith("--") && equals > 0) name = arg.slice(0, equals);
		else if (!arg.startsWith("--") && arg.length > 2 && (inline.has(short) || files.has(short))) name = short;
		let attached = args[index + 1];
		if (name !== arg) attached = name === short ? arg.slice(2) : arg.slice(equals + 1);
		if (inline.has(name) || files.has(name)) {
			if (attached !== void 0) values.push(files.has(name) ? readValue(attached, context) : attached);
			if (name === arg) index += 1;
		}
	}
	return values;
};
var GH_TEXT = /* @__PURE__ */ new Set([
	"--body",
	"--title",
	"-b",
	"-t"
]);
var GH_FILES = /* @__PURE__ */ new Set(["--body-file", "-F"]);
var GH_API_FIELDS = /* @__PURE__ */ new Set([
	"-f",
	"-F",
	"--field",
	"--raw-field"
]);
var GIT_MESSAGE = /* @__PURE__ */ new Set(["-m", "--message"]);
var GIT_MESSAGE_FILES = /* @__PURE__ */ new Set(["-F", "--file"]);
var GH_WRITES = {
	issue: /* @__PURE__ */ new Set([
		"comment",
		"create",
		"edit"
	]),
	pr: /* @__PURE__ */ new Set([
		"comment",
		"create",
		"edit",
		"review"
	])
};
/** Text a command publishes: PR, issue, and API bodies from `gh`, and `git commit` messages. */
var outgoingText = (command, context) => splitCommands(command).flatMap((raw) => {
	const words = program(raw);
	if (words.length > 1 && basename(words[0]) === "gh") {
		const [, area, action, ...rest] = words;
		if (area === "api") return optionValues([action, ...rest], GH_API_FIELDS, /* @__PURE__ */ new Set(), context).map((field) => field.includes("=@") ? readValue(field.slice(field.indexOf("=@") + 2), context) : field.slice(field.indexOf("=") + 1));
		return GH_WRITES[area]?.has(action) ? optionValues(rest, GH_TEXT, GH_FILES, context) : [];
	}
	const git = parseGit(words);
	return git?.subcommand === "commit" ? optionValues(git.args, GIT_MESSAGE, GIT_MESSAGE_FILES, context) : [];
});
/** Ask before PR, issue, API, or commit text that names a person by email address. */
var classifyEmailScan = (command, context) => {
	const emails = outgoingText(command, context).flatMap(findEmails);
	return emails.length === 0 ? ALLOW : ask(`outgoing PR, issue, or commit text contains an email address (${[...new Set(emails)].map(maskEmail).join(", ")}); refer to people by id, count, or hash instead`);
};
// packages/shared/hook-policy/src/generated.ts
var GENERATED_MARKERS = [
	/@generated\b/u,
	/DO NOT EDIT/u,
	/Do not edit directly/iu,
	/\bGenerated (?:by|from)\b/u
];
var FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u;
/** The marker that shows a file is generated, read from its first five lines after any frontmatter. */
var generatedMarker = (text) => {
	const head = text.replace(FRONTMATTER, "").split("\n").slice(0, 5).join("\n");
	return GENERATED_MARKERS.map((marker) => marker.exec(head)?.[0]).find((found) => found !== void 0);
};
var PATH_KEYS = [
	"file_path",
	"filePath",
	"path",
	"target_file",
	"notebook_path",
	"filename"
];
var PATCH_KEYS = [
	"command",
	"input",
	"patch"
];
var PATCHED_FILE = /^\*\*\* (?:Update|Delete) File: (?<file>.+)$/gmu;
/** Existing files an edit or write tool call targets, from its path fields or an apply_patch body. */
var editTargets = (toolInput) => {
	if (typeof toolInput !== "object" || toolInput === null) return [];
	const field = (key) => Reflect.get(toolInput, key);
	const paths = PATH_KEYS.map(field).filter((value) => typeof value === "string" && value !== "");
	for (const key of PATCH_KEYS) {
		const value = field(key);
		if (typeof value === "string") paths.push(...[...value.matchAll(PATCHED_FILE)].map((match) => match.groups?.file.trim() ?? ""));
	}
	return [...new Set(paths)];
};
/** Ask before an edit tool changes a generated file; scripts that regenerate it are unaffected. */
var classifyGeneratedEdit = (files, readHead) => {
	for (const file of files) {
		const head = readHead(file);
		const marker = head === void 0 ? void 0 : generatedMarker(head);
		if (marker !== void 0) return ask(`${file} is generated (${marker}); edit its source and regenerate`);
	}
	return ALLOW;
};
export { ALLOW, PROTECTED_BRANCH, classifyEmailScan, classifyEnvDump, classifyGeneratedEdit, classifyGitSafety, editTargets, findEmails, generatedMarker, maskEmail, outgoingText, splitCommands, strictest };
