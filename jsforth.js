/*	
Copyright (C) 2013-2015 Phil Eaton
Contributors:
	The Geek on Skates (https://www.geekonskates.com)

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

/*
 * CONSTANTS
 */
var FORTH_TEXT = "\033[34mJSForth 0.2\033[0m\r\nType \033[1;33mhelp\033[0m to see some docs.",
	FORTH_PROMPT = "\r\n>>> ",
	FORTH_EOF = "bye",
	FORTH_DEFAULT_ALLOCATION = 2000,
	FORTH_ALLOCATION = 2000,
	FORTH_FALSE = 0,
	FORTH_TRUE = -1,
	FORTH_DEBUG = false,
	FORTH_HELP = "For more documentation on the FORTH language, visit http://www.complang.tuwien.ac.at/forth/gforth/Docs-html/ \
 \r\nFor a concise tutorial/introduction to FORTH, visit \033[1;34mhttp://www.ece.cmu.edu/~koopman/forth/hopl.html\033[0m \
 \r\nwww.forth.com is also a great resource. \
 \r\nPlease feel free to submit any bugs/comments/suggestions to me<at>eatonphil<dot>com \
 \r\n\nSupported Commands: \
 \r\n\033[1;34m+ - / * ^ < > <= >= = !=\033[0m \
 \r\n    ex: a b + // displays: Stack: (a+b) \
 \r\n\033[1;34m.\033[0m - returns the top element of the Stack \
 \r\n    ex: a b . // displays: b; Stack: a \
 \r\n\033[1;34m.s\033[0m - displays the current Stack and the size \
 \r\n    ex: a b .s // displays: a b <2>; Stack: a b \
 \r\n\033[1;34memit\033[0m - displays the top of the Stack as a character \
 \r\n    ex: 0 97 .c // displays: a <ok>; Stack: 0 97 \
 \r\n\033[1;34mdrop\033[0m - pops off the top element without returning it \
 \r\n    ex: a b drop // displays: nothing; Stack: a \
 \r\n\033[1;34mpick\033[0m - puts a copy of the nth element on the top of the Stack \
 \r\n    ex: a b c 2 pick // displays: nothing; Stack: a b c a \
 \r\n\033[1;34mrot\033[0m - rotates the Stack clockwise \
 \r\n    ex: a b c rot // displays: nothing; Stack: b c a \
 \r\n\033[1;34m-rot\033[0m - rotates the Stack counter-clockwise \
 \r\n    ex: a b c -rot // displays: nothing; Stack: c a b \
 \r\n\033[1;34mswap\033[0m - swaps the top two elements \
 \r\n    ex: a b // displays: nothing; Stack: b a \
 \r\n\033[1;34mover\033[0m - copies the second-to-last element to the top of the Stack \
 \r\n    ex: a b over // displays: nothing; Stack: a b a \
 \r\n\033[1;34mdup\033[0m - copies the top element \
 \r\n    ex: a b dup // displays: nothing; Stack: a b b \
 \r\n\033[1;34mif\033[0m ... then - executes what follows \"if\" if it evaluates true, continues on normally after optional \"then\" \
 \r\n    ex: a b > if c then d // displays: nothing; Stack: a b c d //if a > b; Stack: a b d //if a <= b \
 \r\n\033[1;34mdo033[0m ... [loop] - executes what is between \"do\" and \"loop\" or the end of the line \
 \r\n    ex: a b c do a + // displays: nothing; Stack: adds a to itself b times starting at c\
 \r\n\033[1;34minvert\033[0m - negates the top element of the Stack \
 \r\n    ex: a invert // displays: nothing; Stack: 0 //a != 0; Stack: 1 //a == 0 \
 \r\n\033[1;34mclear\033[0m - empties the Stack \
 \r\n    ex: a b clear // displays: nothing; Stack: \
 \r\n\033[1;34m:\033[0m - creates a new custom (potentially recursive) definition \
 \r\n    ex: a b c : add2 + + ; add2 // displays: nothing; Stack: (a+b+c) \
 \r\n\033[1;34mallocate\033[0m - reallocates the max recursion for a single line of input \
 \r\n    ex: 10 allocate \
 \r\n\033[1;34mcls\033[0m - clears the screen \
 \r\n\033[1;34mdebug\033[0m - toggles console debug mode\r\n\n",

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

	// MESSAGES
	FORTH_ERROR_GENERIC = "Forth Error.",	// Constant, basically a "something goofed but idk what" error (default/fallback)
	FORTH_ERROR_MESSAGE = "",				// Changes depending on what went wrong and where (more useful)

	// MISC.
	terminal,			// The terminal (lol obviously); now it's an xterm.js Terminal object
	user_def = {},
	main = [],			// Data stack
	RECUR_COUNT = 0,
	printBuffer = [],	// Stores terminal output
	line = "";			// Stores terminal input

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
		if (FORTH_DEBUG)
			console.log("current_token: "+token);
		if (!isNaN(parseFloat(token)) && isFinite(token)) {
			main.push(token);
		} else {
			token = token.toLowerCase();
			if (token == "cls") {
				terminal.write("\033[2J\033[H");
				return;
			} else if (token == "help") {
				terminal.write(FORTH_HELP);
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
                   printBuffer.push(" <" + main.length + "> " + main.join(" "));
                   continue;
			} else if (token == "emit") {
                   printBuffer.push(String.fromCharCode(main[main.length-1]));
                   continue;
               }

			if (token == "." || token == "if" || token == "invert" || token == "drop" || token == "dup")// if token represents a binary operator
			{
				if (main.length < 1 || IN_DEFINITION == true) {
					FORTH_ERROR = STACK_UNDERFLOW;
					FORTH_ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
				} else if (!IN_DEFINITION) {
					if (token == ".") {
						return main.pop();
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
					} else if (token == "dup") {
						first = main.pop();
						main.push(first);
						main.push(first);
					}
				}
			} else if (token == "+" || token == "-" || token == "*" || token == "^" || token == "/" || token == "swap" || token == "over" || token == "pick" || token == "=" || token == "!=" || token == ">=" || token == "<=" || token == ">" || token == "<" || token == "do" || token == "rot" || token == "-rot") {
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
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(second / first);
					} else if (token == "^") {
						first = Number(main.pop());
						second = Number(main.pop());
						main.push(pow(second, first));
					} else if (token == "swap") {
						first = main.pop();
						second = main.pop();
						main.push(first);
						main.push(second);
					} else if (token == "over") {
						first = main.pop();
						second = main.pop();
						main.push(second);
						main.push(first);
						main.push(second);
					} else if (token == "pick") {
						n = Number(main.pop());
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
					}
					else if (token == "<")
					{
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first<second)?Number(FORTH_TRUE):FORTH_FALSE);
					}
					else if (token == ">")
					{
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
					else if (token == "<=")
					{
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first<=second)?Number(FORTH_TRUE):FORTH_FALSE);
					}
					else if (token == "=")
					{
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first==second)?Number(FORTH_TRUE):FORTH_FALSE);
					} else if (token == "!=")
					{
						second = Number(main.pop());
						first = Number(main.pop());
						main.push((first!=second)?Number(FORTH_TRUE):FORTH_FALSE);
					} else if (token == "do")
					{
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
					}
                       else if (token == "rot")
                       {
                           var last = main.shift();
                           main.push(last);
                       }
                       else if (token == "-rot") {
                           var first = main.pop();
                           main.unshift(first);
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
						return "<def:" + func + "> modified";
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

function onInput(char) {
	var code = char.charCodeAt(0);
	if (char == "\r") {
		RECUR_COUNT = 0;
		var result = interpret(line);
		if (printBuffer.length) printBuffer.push(" ");
		if (FORTH_ERROR == "") {
			if (result) result += " ";
			else result = "";
			displayPrompt(printBuffer.join("") + result + FORTH_OK + "\r\n");
		}
		else displayPrompt("\033[1;31m" + (FORTH_ERROR_MESSAGE || FORTH_ERROR_GENERIC) + result + "\033[0m\r\n");
		line = "";
		printBuffer = [];
	} else if (code == 8 || code == 127) {
		if (line !== "") {
			line = line.substr(line.length - 2);
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
	interpret(": 2dup over over ;");
	//interpret(": 2swap 3 roll 3 roll ;");		// He didn't define roll - TO-DO
};
