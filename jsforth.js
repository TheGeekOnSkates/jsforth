/*	
Contributors:
	2013-2015 Phil Eaton
	2023 The Geek on Skates (https://www.geekonskates.com)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

if (!String.prototype.trim) {
	String.prototype.trim = function() {
    	return this.replace(/^\s+|\s+$/g,'');
	};
 }

// CONSTANTS
var FORTH_TEXT = "\033[34mJSForth 0.2\033[0m\r\nType \033[1;33mhelp\033[0m to see some docs.",
	FORTH_PROMPT = "\r\n>>> ",
	FORTH_EOF = "bye",
	FORTH_DEFAULT_ALLOCATION = 2000,
	FORTH_ALLOCATION = 2000,
	FORTH_FALSE = 0,
	FORTH_TRUE = -1,
	FORTH_DEBUG = false,

	// Ignore potential Stack underflow errors if an operator is within a definition.
	IN_DEFINITION = false,

	// ERRORS
	FORTH_OK = " ok",
	FORTH_ERROR = "",

	// CODES
	CMD_NOT_FOUND = -1,
	STACK_UNDERFLOW = -2,
	PICK_OUT_OF_BOUNDS = -3,
	STACK_OVERFLOW = -4,
	BAD_DEF_NAME = -5,
	IF_EXPECTED_THEN = -6,
	DIVISION_BY_ZERO = -7,

	// MESSAGES
	FORTH_ERROR_GENERIC = "Forth Error.",	// Constant, basically a "something goofed but idk what" error (default/fallback)
	FORTH_ERROR_MESSAGE = "",				// Changes depending on what went wrong and where (more useful)

	// MISC.
	terminal,							// The terminal (lol obviously); now it's an xterm.js Terminal object
	user_def = {},						// Dictionary of user-defined words
	main = [],							// Data stack
	memory = new Int32Array(65536),		// Memory for strings, variables and constants
	memoryPointer = 0,					// Used when assigning variables/constants
	RECUR_COUNT = 0,					
	printBuffer = [],					// Stores terminal output
	line = "";							// Stores terminal input

/**
 * This is where most of the heavy lifting is done.  It actually interprets the user's code.
 * @param {string} input The user's code
 * @returns {?????} Looks like it returns strings and/or numbers, but then again if that's the case than what's printBuffer for?
 * @todo Make sense of this - completely understand how it all works.  A lot of it is familiar, some is very much not. :D
 */
function interpret(input) {
	RECUR_COUNT++;
	
	if (RECUR_COUNT == FORTH_ALLOCATION) {
		FORTH_ERROR = STACK_OVERFLOW;
		FORTH_ERROR_MESSAGE = "Stack Overflow. If this is generated incorrectly, the Stack can be reallocated. Default max recursion for a line of input is "+FORTH_DEFAULT_ALLOCATION+".";
		return;
	}
	if (FORTH_DEBUG) {
		console.log("current_line: "+input);
	}
	tokens = input.toLowerCase().split(" ");
	raw = input.split(" ");
	for (var i = 0; i < tokens.length; i++) {
		token = tokens[i];
		if (FORTH_DEBUG) console.log("current_token: "+token);
		if (token == "\\") return;
		if (token == ".\"") {
			var printThis = [];
			i++;
			token = tokens[i];
			while(!token.endsWith("\"")) {
				printThis.push(raw[i]);
				i++;
				token = tokens[i];
				if (FORTH_DEBUG) console.log("to be printed: "+token);
			}
			printThis.push(raw[i].replace('"', ''));
			printBuffer.push(printThis.join(" "));
			continue;
		}
		if (token == "s\"") {
			var saveThis = [];
			i++;
			token = tokens[i];
			while(!token.endsWith("\"")) {
				saveThis.push(raw[i]);
				i++;
				token = tokens[i];
				if (FORTH_DEBUG) console.log("to be stored: "+token);
			}
			saveThis.push(raw[i].replace('"', ''));
			saveThis = saveThis.join(" ");
			if (FORTH_DEBUG) console.log("Full string to be stored: "+saveThis);
			main.push(memoryPointer);
			main.push(saveThis.length);
			for (var z = 0; z<saveThis.length; z++) {
				memory[memoryPointer] = saveThis.charCodeAt(z);
				memoryPointer++;
			}
			memoryPointer++;	// For the "NULL terminator"
			continue;
		}
		if (token == "(") {
			while(!token.endsWith(")")) {
				i++;
				token = tokens[i];
				if (FORTH_DEBUG) console.log("skipping "+token);
			}
			continue;
		}
		if (!isNaN(parseInt(token)) && isFinite(token)) {
			main.push(token);
		} else {
			token = token.toLowerCase();
			if (token == "cls") {
				terminal.write("\033[2J\033[H");
				return;
			} else if (token == "help") {
				window.open("manual.html");
				return;
			} else if (token == "debug") {
				FORTH_DEBUG = (FORTH_DEBUG?false:true);
				return "console debugging enabled: "+FORTH_DEBUG;
			} else if (token == "allocate") {
				FORTH_ALLOCATION = Number(main.pop());
				return "Stack max reallocated: "+FORTH_ALLOCATION;
			} else if (token == "depth") {
				main.push(main.length);
                   continue;
			} else if (token == ".s") {
                   printBuffer.push("<" + main.length + "> " + main.join(" "));
                   continue;
			} else if (token == "emit") {
                   printBuffer.push(String.fromCharCode(main.pop()));
                   continue;
			}

			if ([".", "if", "invert", "drop", "dup", "abs"].indexOf(token) > -1) {
				if (main.length < 1 || IN_DEFINITION == true) {
					FORTH_ERROR = STACK_UNDERFLOW;
					FORTH_ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
				} else if (!IN_DEFINITION) {
					if (token == ".") {
						printBuffer.push(main.pop() + " ");
						continue;
					} else if (token == "if") {
						var top = (Number(main.pop())==FORTH_FALSE);
						var then = tokens.indexOf("then");
						if (then !== -1) {
							if (top) {
								tokens = tokens.slice(then+1);
								if (tokens.join(" ") == "")
									return;
							}
							else {
								tokens = tokens.slice(tokens.indexOf("if")+1);
								then = tokens.indexOf("then");
								tokens.splice(then, 1);
							}
							console.log(tokens);
							return interpret(tokens.join(" "));
						} else {
							FORTH_ERROR = IF_EXPECTED_THEN;
							FORTH_ERROR_MESSAGE = "Expected \"then\" in input line.";
							return;
						}
					} else if (token == "invert") {
						top = main.pop();
						// Yes, I get that INVERT is supposed to do something like a bitwise-NOT of all bits, BUT...
						// (a) idk how to do that in JS, and
						// (b) the previous implementation didn't handle numbers other than true/false (like what happens if you do i.e. 65 invert?)
						// (c) in practice, the result is always something like this:
						main.push((top * -1) - 1);
					} else if (token == "drop") {
						main.pop();
					} else if (token == "abs") {
						main.push(Math.abs(parseInt(main.pop())));
					} else if (token == "dup") {
						first = main.pop();
						main.push(first);
						main.push(first);
					}
				}
			} else if (["+", "-", "*", "^", "/", "mod", "swap", "over", "pick", "roll", "=", "<>", ">=", "<=", ">", "<", "do", "rot", "-rot", "lshift", "rshift", "and", "or", "xor"].indexOf(token) > -1) {
				if (main.length < 2) {
					FORTH_ERROR = STACK_UNDERFLOW;
					FORTH_ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
				} else if (!IN_DEFINITION) {
					if (token == "+") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second + first);
					} else if (token == "-") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second - first);
					} else if (token == "*") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second * first);
					} else if (token == "/") {
						first = parseInt(main.pop());
						second = parseInt(main.pop());
						if (first == 0) {
							FORTH_ERROR = DIVISION_BY_ZERO;
							FORTH_ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> division by zero";
							return;
						}
						main.push(Math.floor(second / first));
					} else if (token == "mod") {
						first = Number(main.pop());
						second = Number(main.pop());
						if (first == 0) {
							FORTH_ERROR = DIVISION_BY_ZERO;
							FORTH_ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> division by zero";
							return;
						}
						main.push(second % first);
					} else if (token == "lshift") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second << first);
					} else if (token == "rshift") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second >> first);
					} else if (token == "and") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second & first);
					} else if (token == "or") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second | first);
					} else if (token == "xor") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second ^ first);
					} else if (token == "^") {
						first = parseInt(main.pop());
						second = parseInt(main.pop());
						main.push(Math.pow(second, first));
					} else if (token == "swap") {
						a = main.pop();
						b = main.pop();
						main.push(a);
						main.push(b);
					} else if (token == "over") {
						first = main.pop();
						second = main.pop();
						main.push(second);
						main.push(first);
						main.push(second);
					} else if (token == "pick") {
						n = parseInt(main.pop());
						if (n < main.length && n >= 1) {
							var popped = Array();
							for (var j = 0; j < n; j++) {
								popped.push(main.pop());
							}
							var picked = Number(main.pop());
							main.push(picked);
							for (var j = 0; j < n; j++) {
								main.push(popped.pop());
							}
							main.push(picked);
						} else {
							FORTH_ERROR = PICK_OUT_OF_BOUNDS;
							FORTH_ERROR_MESSAGE = "Pick out of bounds.";
						}
					} else if (token == "roll") {
						n = parseInt(main.pop());
						if (n < main.length && n >= 1) {
							var popped = Array();
							for (var j = 0; j < n; j++) {
								popped.push(main.pop());
							}
							var picked = Number(main.pop());
							for (var j = 0; j < n; j++) {
								main.push(popped.pop());
							}
							main.push(picked);
						} else {
							FORTH_ERROR = PICK_OUT_OF_BOUNDS;
							FORTH_ERROR_MESSAGE = "Roll out of bounds.";
						}
					} else if (token == "<") {
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first<second)?Number(FORTH_TRUE):FORTH_FALSE);
					} else if (token == ">") {
						second = Number(main.pop());
						first = Number(main.pop());
						console.log(first, second, first > second, Number(FORTH_TRUE), "f");
						main.push((first>second)?Number(FORTH_TRUE):FORTH_FALSE);
					}
					else if (token == ">=") {
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first>=second)?Number(FORTH_TRUE):FORTH_FALSE);
					}
					else if (token == "<=") {
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first<=second)?Number(FORTH_TRUE):FORTH_FALSE);
					}
					else if (token == "=") {
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first==second)?Number(FORTH_TRUE):FORTH_FALSE);
					} else if (token == "<>") {
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first!=second)?Number(FORTH_TRUE):FORTH_FALSE);
					} else if (token == "do") {
						var rest = Array();
						var func_def = Array();
						var index = main.pop();
						var iterations = main.pop();
						IN_DEFINITION = true;
						for (i++; i<tokens.length && tokens[i].toLowerCase() != "loop"; i++)
							func_def.push(tokens[i]);
						for (i++;i < tokens.length;i++) // gather up remaining tokens
							rest.push(tokens[i]);
						IN_DEFINITION = false;
						for (;index < iterations; index++)
							interpret(func_def.join(" "));
						if (rest.length)
							interpret(rest.join(" "));
					} else if (token == "rot") {
						var a = main.pop(), b = main.pop(), c = main.pop();
						main.push(b); main.push(a); main.push(c);
					} else if (token == "-rot") {
						var a = main.pop(), b = main.pop(), c = main.pop();
						main.push(a); main.push(c); main.push(b);
					}
				}
			// These functions have no requirements or are not found.
			} else {
				if (token == ":")
				{
					i++;
					var existed = false;
					var rest = Array();
					var func = tokens[i].toLowerCase();					
					var func_def = Array();
					IN_DEFINITION = true;
					for (i++;i<tokens.length && tokens[i] != ";"; i++)
						func_def.push(tokens[i]);
					for (i++;i < tokens.length;i++) // gather up remaining tokens
						rest.push(tokens[i]);
					IN_DEFINITION = false;
					if (func in window.user_def)
						existed = true;
					window.user_def[func] = func_def.join(" ").trim();
					if (rest.length)
						interpret(rest.join(" "));
					if (existed)
						return "<def:" + func + "> redefined";
					return "<def:" + func + "> created";
				}
				else if ((token in window.user_def) && !IN_DEFINITION) // !IN_DEFINITION allows recursion
				{
					var def = window.user_def[token];
					var rest = Array();
					for (i++;i < tokens.length;i++) // gather up remaining tokens
					{
						rest.push(tokens[i]);
					}
					if (FORTH_DEBUG) {
						console.log("recursive_def: "+window.user_def[token]);
						console.log(main.join(" "));
					}
					interpret(def);
					if (rest.length)
						interpret(rest.join(" "));// interpret any remaining tokens
				} else if (token == "clear") {
					main = [];
				} else {
					FORTH_ERROR = CMD_NOT_FOUND;
					if (token == "")
						token = "null";
					FORTH_ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> not found";
				}
			}
		}
	}
}

/**
 * Displays a message followed by the prompt
 * @param {string} The message (either "ok" or an error)
 */
function displayPrompt(m) {
	m = m || "";
	terminal.write(m + FORTH_PROMPT);
	terminal.focus();
}

/**
 * The terminal's onData event handler
 * @param {string} char The data (might not just be one character)
 */
function onInput(char) {
	var code = char.charCodeAt(0);
	if (char == "\r") {
		RECUR_COUNT = 0;
		var result = interpret(line);
		if (printBuffer.length) printBuffer.push(" ");
		if (FORTH_ERROR == "") {
			if (result) result += " ";
			else result = "";
			if (result === "" && !printBuffer.length)
				displayPrompt(FORTH_OK);
			else displayPrompt(" " + printBuffer.join("") + result + FORTH_OK);
		}
		else displayPrompt("\033[1;31m " + (FORTH_ERROR_MESSAGE || FORTH_ERROR_GENERIC) + "\033[0m\r\n");
		line = "";
		printBuffer = [];
		FORTH_ERROR = "";
	} else if (code == 8 || code == 127) {
		if (line !== "") {
			line = line.substr(0, line.length - 1);
			terminal.write("\033[D \033[D");
		}
	} else {
		terminal.write(char);
		line += char;
	}
}

/**
 * Initial setup
 */
window.onload = function() {
	// Set up the terminal
	terminal = new Terminal({
		screenReaderMode: true,
		customGlyphs: true
	});
	terminal.open(document.getElementById('repl'));
	terminal.onData(onInput);
	terminal.write(FORTH_TEXT);
	displayPrompt();

	// Add some more standard Forth words - written in Forth :)
	interpret(": cr 10 emit 13 emit ;");
	interpret(": space 32 emit ;");
	interpret(": 2dup over over ;");
	interpret(": /mod 2dup mod -rot / ;");
	interpret(": 2drop drop drop ;");
	interpret(": 2swap 3 roll 3 roll ;");
	interpret(": 2over 3 pick 3 pick ;");
	interpret(": */ -rot * swap / ;");
	interpret(": 0< 0 < ;");
	interpret(": 0= 0 = ;");
	interpret(": 1+ 1 + ;");
	interpret(": 1- 1 - ;");
};
