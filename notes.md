# TO-DO's

In no particular order...

* Check his existing words to see if they work like they would in other Forths.  I'll be using Gforth to test, but the results should be the same in Pforth etc.
* Add more Forth words in Forth (like I did for `2DUP`)
* Figure out how his memory system works and add `s"`
* Figure out how his variables work - `ALLOT` is not the same as his "allocate" (it was more like a C malloc, to increase the number of max recursion).  Add `ALLOT`
* Add `."`
* Finish debugging `(` (I think my current problems are due to my not having completely dealt with all the nit-pickitiveness of xterm.js - Alt-Tab is a char, etc.... need to cook up something like GNU Readline for this lol)
* Update the docs (both in the README and in the `HELP` word)
* Push to BitBucket, submit a PR and see if he goes for it.  Either way, keep on coding! :)
