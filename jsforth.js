/*	
Copyright 2013-2015 Phil Eaton
Additional contributions 2023 The Geek on Skates (https://www.geekonskates.com)

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

var FORTH_PROMPT = "\r\n>>> ",            // Text to display to let the user know the REPL is ready for input
	FORTH_DEFAULT_ALLOCATION = 2000,      // Default max recursions (I think this is to prevent crashing the browser due to infinite loops)
	FORTH_ALLOCATION = 2000,              // Max recursions for interpret() - this can be reset with the word ALLOCATE
	FORTH_DEBUG = false,                  // Turns a debug mode on or off; in debug mode, JSForth prints info on what it's doing to the JS console
	IN_DEFINITION = false,                // Ignore potential Stack underflow errors if an operator is within a definition.
	FORTH_OK = " ok",                     // The "ok" message to show when everything works
	FORTH_ERROR = "",                     // An error code set if something goes wrong - not sure if we need it, but it looks like we do, so I'm leaving it for now
	// Error codes
	CMD_NOT_FOUND = -1,                   // Unknown word
	STACK_UNDERFLOW = -2,                 // Stack underflow
	PICK_OUT_OF_BOUNDS = -3,              // Pick (or roll) out of bounds
	STACK_OVERFLOW = -4,                  // Stack overflow
	IF_EXPECTED_THEN = -5,                // Missing "THEN"
	DIVISION_BY_ZERO = -6,                // Divisiion by zero
	EXPECTED_VAR_NAME = -7,               // Expected variable (or constant) name
	JS_ERROR = -8,                        // JavaScript error (in the "JS" word)
	// Error messages
	FORTH_ERROR_GENERIC = "Forth Error.", // Constant, basically a "something goofed but idk what" error (default/fallback)
	FORTH_ERROR_MESSAGE = "",             // The message to show the user
	// Misc.
	terminal,                             // The terminal (lol obviously); now it's an xterm.js Terminal object
	user_def = {},                        // Dictionary of user-defined words (and also variables)
	constants = {                         // Dictionary of user-defined constants
		true: -1, false: 0                // Right now just true/false
	},
	main = [],                            // Data stack
	memory = new Int32Array(65536),       // Memory for strings, variables and constants
	memoryPointer = 0,                    // Used when assigning variables/constants
	RECUR_COUNT = 0,					  // I think this tells interpret() how many recursions deep we are (see FORTH_ALLOCATION)
	printBuffer = [],                     // Stores terminal output
	line = "";                            // Stores terminal input

/**
 * This is where most of the heavy lifting is done.  It actually interprets the user's code.
 * @param {string} input The user's code
 * @returns {?????} Looks like it returns strings and/or numbers, but then again if that's the case than what's printBuffer for?
 * @todo Make sense of this - completely understand how it all works.  A lot of it is familiar, some is very much not. :D
 */
function interpret(input) {
	
	// Update the recursion counter
	RECUR_COUNT++;
	if (RECUR_COUNT == FORTH_ALLOCATION) {
		FORTH_ERROR = STACK_OVERFLOW;
		FORTH_ERROR_MESSAGE = "Stack Overflow. If this is generated incorrectly, the Stack can be reallocated. Default max recursion for a line of input is "+FORTH_DEFAULT_ALLOCATION+".";
		if (FORTH_DEBUG) console.log(FORTH_ERROR_MESSAGE);
		return;
	}
	
	// If in debug mode, show the user what's about to run
	if (FORTH_DEBUG) console.log("current_line: "+input);
	
	// Split the input string into tokens
	tokens = input.split(" ");
	
	// Loop through the tokens, running each one
	for (var i = 0; i < tokens.length; i++) {
		
		// If it's a comment, we're done with the entire line
		token = tokens[i].toLowerCase();
		if (token == "\\") return;
		
		// Log the line if in debug mode
		if (FORTH_DEBUG) console.log("current_token: "+token);
		
		// If it's the other kind of comment, skip until the )
		if (token == "(") {
			while(!token.endsWith(")")) {
				i++;
				token = tokens[i];
				if (FORTH_DEBUG) console.log("skipping "+token);
			}
			continue;
		}
		
		// If it's a constant, push it to the stack
		if (constants.hasOwnProperty(token)) {
			main.push(constants[token]);
			continue;
		}
		
		// If it's a number, put that on the stack
		if (!isNaN(parseInt(token)) && isFinite(token)) {
			if (token.indexOf(".") > -1) {
				var n = parseInt(token.replace(".", ""));
				 main.push(n);
				 main.push(n > 0 ? 0 : -1);
			}
			else main.push(parseInt(token));
			continue;
		}
		
		// And from here on out it's all about the words.
		if (token == ".\"") {
			var printThis = [];
			i++;
			token = tokens[i];
			while(!token.endsWith("\"")) {
				printThis.push(tokens[i]);
				i++;
				token = tokens[i];
				if (FORTH_DEBUG) console.log("to be printed: "+token);
			}
			printThis.push(tokens[i].replace('"', ''));
			printBuffer.push(printThis.join(" "));
			continue;
		}
		if (token == "s\"") {
			var saveThis = [];
			i++;
			token = tokens[i];
			while(!token.endsWith("\"")) {
				saveThis.push(tokens[i]);
				i++;
				token = tokens[i];
				if (FORTH_DEBUG) console.log("to be stored: "+token);
			}
			saveThis.push(tokens[i].replace('"', ''));
			saveThis = saveThis.join(" ");
			i++;
			if (FORTH_DEBUG) {
				console.log("Full string to be stored: "+saveThis);
				console.log("Next word: " + tokens[i]);
			}
			main.push(memoryPointer);
			main.push(saveThis.length);
			for (var z = 0; z<saveThis.length; z++) {
				memory[memoryPointer] = saveThis.charCodeAt(z);
				memoryPointer++;
			}
			memoryPointer++;	// For the "NULL terminator"
			continue;
		}
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
		} else if (token == "variable") {
			i++;
			if (i == tokens.length) {
				FORTH_ERROR = EXPECTED_VAR_NAME;
				FORTH_ERROR_MESSAGE = "expected variable name";
				return;
			}
			if (FORTH_DEBUG) console.log("Defining variable: " + tokens[i] + " " + memoryPointer + " ;")
			user_def[tokens[i]] = memoryPointer.toString();
			memoryPointer++;
			continue;
		} else if (token == "rows") {
			main.push(terminal.rows);
			continue;
		} else if (token == "cols") {
			main.push(terminal.cols);
			continue;
		} else if (token == "random") {
			main.push(parseInt(Math.random().toString().replace("0.","")));
			continue;
		}

		// These words require ONE number to be on the stack.
		if ([".", "if", "invert", "drop", "dup", "abs", "count", "@", "constant", "allot"].indexOf(token) > -1) {
			if (main.length < 1 || IN_DEFINITION == true) {
				FORTH_ERROR = STACK_UNDERFLOW;
				FORTH_ERROR_MESSAGE = "Too few arguments: \""+token+"\".";
			} else if (!IN_DEFINITION) {
				if (token == ".") {
					printBuffer.push(main.pop() + " ");
					continue;
				} else if (token == "if") {
					var top = (Number(main.pop())==0);
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
				} else if (token == "allot") {
					memoryPointer += main.pop();
				} else if (token == "@") {
					var addr = main.pop();
					if (!addr < 0 || addr > memory.length) {
						FORTH_ERROR = DIVISION_BY_ZERO;
						FORTH_ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> invalid memory address";
						return;
					}
					else main.push(memory[addr]);
				} else if (token == "constant") {
					i++;
					if (i == tokens.length) {
						FORTH_ERROR = EXPECTED_VAR_NAME;
						FORTH_ERROR_MESSAGE = "expected constant name";
						return;
					}
					if (FORTH_DEBUG) console.log("Defining constant: " + tokens[i] + " " + memoryPointer + " ;")
					constants[tokens[i]] = main.pop().toString();
					continue;
				} else if (token == "count") {
					var n = 0, z = main.pop();
					main.push(z);
					for (; z<memory.length; z++) {
						if (memory[z] == 0) break;
						n++;
					}
					main.push(n);
				} else if (token == "dup") {
					first = main.pop();
					main.push(first);
					main.push(first);
				}
			}

		// These words require that TWO numbers be on the stack
		} else if (["+", "-", "*", "^", "/", "mod", "!", "swap", "over", "pick", "roll", "=", "<>", ">=", "<=", ">", "<", "do", "rot", "-rot", "lshift", "rshift", "and", "or", "xor", "type", "prompt", "js"].indexOf(token) > -1) {
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
				} else if (token == "type") {
					var length = main.pop(), start = main.pop(), str = "";
					for(; start<length; start++) {
						str += String.fromCharCode(memory[start]);
					}
					printBuffer.push(str);
				} else if (token == "!") {
					var addr = main.pop(), value = main.pop();
					if (!addr < 0 || addr > memory.length) {
						FORTH_ERROR = DIVISION_BY_ZERO;
						FORTH_ERROR_MESSAGE = "<def:" + token + ";line:"+input+";pos:"+i+"> invalid memory address";
						return;
					}
					else memory[addr] = value;
				} else if (token == "prompt") {
					var length = main.pop(), start = main.pop(), str = "";
					for(; start<length; start++) {
						str += String.fromCharCode(memory[start]);
					}
					FORTH_PROMPT = str;
				} else if (token == "js") {
					var length = main.pop(), start = main.pop(), str = "";
					for(; start<length; start++) {
						str += String.fromCharCode(memory[start]);
					}
					try { eval(str); } catch(e) {
						if (FORTH_DEBUG) console.log("JS error: ", e);
						FORTH_ERROR = JS_ERROR;
						FORTH_ERROR_MESSAGE = e.message || e;
						return;
					}
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
					main.push((first<second)?Number(-1):0);
				} else if (token == ">") {
					second = Number(main.pop());
					first = Number(main.pop());
					console.log(first, second, first > second, Number(-1), "f");
					main.push((first>second)?Number(-1):0);
				}
				else if (token == ">=") {
					second = Number(main.pop());
					first = Number(main.pop());
					main.push((first>=second)?Number(-1):0);
				}
				else if (token == "<=") {
					second = Number(main.pop());
					first = Number(main.pop());
					main.push((first<=second)?Number(-1):0);
				}
				else if (token == "=") {
					second = Number(main.pop());
					first = Number(main.pop());
					main.push((first==second)?Number(-1):0);
				} else if (token == "<>") {
					second = Number(main.pop());
					first = Number(main.pop());
					main.push((first!=second)?Number(-1):0);
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
	if (char[0] == "\033") {
		// For now, just don't do anything.
		// Eventually, I'd like to add suport for:
		//		* Arrow keys
		//		* Home/End
		//		* Delete
		return;
	}
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
	terminal.write("\033[34mJSForth 0.2\033[0m\r\nType \033[1;33mhelp\033[0m to see some docs.");
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
	interpret(": +! + ! ;");
	interpret(": cells 8 * ;");
};
